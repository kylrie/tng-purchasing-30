/**
 * Bridge orchestration. Watches Firestore for PENDING print jobs for this
 * business unit and, for each, atomically claims it, prints the ESC/POS ticket to
 * the station's printer (with a few in-process retries), and records PRINTED or
 * FAILED. A live onSnapshot gives near-instant printing; a periodic safety poll
 * catches anything the stream missed (reconnects, etc.).
 *
 * Concurrency: an in-memory `inFlight` set makes sure the same job id is never
 * processed twice at once within this process; claimJob() guards against OTHER
 * processes. Together with the deterministic job id (orderId:STATION:INITIAL) and
 * server-side exactly-once job creation, a paid order prints once.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { BridgeConfig } from './config';
import { buildTicket, type Station } from './escpos';
import { sendRaw, probe } from './printer';
import { shouldRetry, nextRetryDelayMs } from './retry';
import {
    PRINT_JOBS_COLLECTION, claimJob, completeJob, failJob, fetchPendingJobs,
    writeHeartbeat, subscribeAutoPrint, type PrintJob,
} from './firestoreJobs';

const VERSION = '1.0.0';
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export class Bridge {
    private readonly inFlight = new Set<string>();
    private stopped = false;
    private autoPrint = true; // honored live from qr_print_config; default ON
    private lastPrint: { at: number; status: 'PRINTED' | 'FAILED'; order: string; station: string } | null = null;
    private unsub: (() => void) | null = null;
    private configUnsub: (() => void) | null = null;
    private timers: NodeJS.Timeout[] = [];

    constructor(private readonly db: Firestore, private readonly config: BridgeConfig) {}

    private log(msg: string, extra?: Record<string, unknown>): void {
        const stamp = new Date().toISOString();
        console.log(`[${stamp}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`);
    }

    start(): void {
        this.log('bridge.start', {
            businessUnitId: this.config.businessUnitId,
            database: this.config.databaseId,
            printers: this.printerSummary(),
        });

        // 1. Live stream of PENDING jobs (two equality filters → no composite index).
        this.unsub = this.db.collection(PRINT_JOBS_COLLECTION)
            .where('businessUnitId', '==', this.config.businessUnitId)
            .where('status', '==', 'PENDING')
            .onSnapshot(
                (snap) => {
                    for (const doc of snap.docs) {
                        void this.process({ id: doc.id, ...(doc.data() as Omit<PrintJob, 'id'>) });
                    }
                },
                (err) => this.log('bridge.snapshot.error', { message: err.message }),
            );

        // 2. Live auto-print toggle (qr_print_config). When OFF, jobs wait as
        //    PENDING and staff print manually; when back ON, the safety poll
        //    catches up. Fails safe to ON.
        this.configUnsub = subscribeAutoPrint(this.db, this.config.businessUnitId, (on) => {
            if (on !== this.autoPrint) this.log('bridge.autoprint', { autoPrint: on });
            this.autoPrint = on;
            if (on) void this.pollOnce(); // catch up anything queued while OFF
        });

        // 3. Heartbeat so the Ops UI can show Bridge ONLINE + printer status.
        void this.beat();
        this.timers.push(setInterval(() => void this.beat(), this.config.heartbeatMs));

        // 4. Safety poll — re-scan PENDING periodically in case the stream dropped one.
        this.timers.push(setInterval(() => void this.pollOnce(), this.config.pollIntervalMs));
        void this.pollOnce(); // immediate catch-up on start
    }

    async stop(): Promise<void> {
        this.stopped = true;
        if (this.unsub) { try { this.unsub(); } catch { /* */ } }
        if (this.configUnsub) { try { this.configUnsub(); } catch { /* */ } }
        for (const t of this.timers) clearInterval(t);
        this.timers = [];
    }

    private printerSummary(): Record<string, string> {
        return {
            KITCHEN: `${this.config.printers.KITCHEN.host}:${this.config.printers.KITCHEN.port}`,
            BAR: `${this.config.printers.BAR.host}:${this.config.printers.BAR.port}`,
        };
    }

    private async beat(): Promise<void> {
        try {
            // Probe each configured printer so the Ops UI can show ONLINE/OFFLINE.
            const [kOk, bOk] = await Promise.all([
                probe(this.config.printers.KITCHEN, 3000),
                probe(this.config.printers.BAR, 3000),
            ]);
            await writeHeartbeat(this.db, this.config.businessUnitId, {
                version: VERSION,
                printers: this.printerSummary(),
                autoPrint: this.autoPrint,
                printerStatus: { KITCHEN: kOk ? 'ONLINE' : 'OFFLINE', BAR: bOk ? 'ONLINE' : 'OFFLINE' },
                lastPrint: this.lastPrint,
            });
        } catch (e) {
            this.log('bridge.heartbeat.error', { message: (e as Error).message });
        }
    }

    private async pollOnce(): Promise<void> {
        if (this.stopped) return;
        try {
            const jobs = await fetchPendingJobs(this.db, this.config.businessUnitId);
            for (const job of jobs) void this.process(job);
        } catch (e) {
            this.log('bridge.poll.error', { message: (e as Error).message });
        }
    }

    /** Claim → print (with retries) → complete/fail. Safe to call repeatedly for
     *  the same job — the inFlight guard + claimJob() make extra calls no-ops. */
    private async process(candidate: PrintJob): Promise<void> {
        const jobId = candidate.id;
        // Auto-print OFF → leave the job PENDING for a manual print (do not claim).
        if (this.stopped || !this.autoPrint || this.inFlight.has(jobId)) return;
        this.inFlight.add(jobId);
        try {
            const job = await claimJob(this.db, jobId);
            if (!job) return; // already claimed/printed by someone else — nothing to do

            const target = this.config.printers[job.station as Station];
            const targetStr = `${target.host}:${target.port}`;
            const bytes = buildTicket({
                orderNumber: job.displayOrderNumber,
                tableNumber: job.tableNumber,
                station: job.station as Station,
                lines: (job.lines ?? []).map(l => ({ qty: l.qty, name: l.name, note: l.note })),
                paid: job.paid !== false,
                atMillis: job.createdAt?.toMillis?.() ?? Date.now(),
            });

            let attempts = 0;
            let lastErr = '';
            while (attempts < this.config.maxAttempts) {
                try {
                    await sendRaw(target, bytes, this.config.socketTimeoutMs);
                    await completeJob(this.db, jobId, targetStr);
                    this.lastPrint = { at: Date.now(), status: 'PRINTED', order: job.displayOrderNumber, station: job.station };
                    this.log('bridge.printed', { jobId, station: job.station, order: job.displayOrderNumber, table: job.tableNumber, target: targetStr });
                    return;
                } catch (e) {
                    attempts += 1;
                    lastErr = (e as Error).message;
                    this.log('bridge.print.attempt_failed', { jobId, attempt: attempts, error: lastErr });
                    if (shouldRetry(attempts, this.config.maxAttempts)) {
                        await sleep(nextRetryDelayMs(attempts, this.config.retryDelayMs));
                    }
                }
            }
            await failJob(this.db, jobId, lastErr || 'print failed');
            this.lastPrint = { at: Date.now(), status: 'FAILED', order: job.displayOrderNumber, station: job.station };
            this.log('bridge.print.failed', { jobId, station: job.station, error: lastErr });
        } catch (e) {
            this.log('bridge.process.error', { jobId, message: (e as Error).message });
        } finally {
            this.inFlight.delete(jobId);
        }
    }
}
