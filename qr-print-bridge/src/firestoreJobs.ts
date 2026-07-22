/**
 * Firestore access for the print bridge (Admin SDK, service-account auth).
 *
 * The Admin SDK bypasses security rules, so `qr_print_jobs` stays `write:if false`
 * for browser clients while the bridge can claim + complete jobs. All the exactly-
 * once safety lives in claimJob(): a job is only picked up if it is still PENDING,
 * atomically flipped to PRINTING. Two bridges (or a bridge + a restart) therefore
 * never print the same job twice.
 */

import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import type { BridgeConfig } from './config';
import type { Station } from './escpos';

export const PRINT_JOBS_COLLECTION = 'qr_print_jobs';
export const BRIDGE_STATUS_COLLECTION = 'qr_print_bridge_status';
export const PRINT_CONFIG_COLLECTION = 'qr_print_config';

export interface PrintJob {
    id: string;
    orderId: string;
    businessUnitId: string;
    displayOrderNumber: string;
    tableNumber: string;
    station: Station;
    lines: { qty: number; name: string; note?: string }[];
    paid: boolean;
    status: 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED';
    attemptCount: number;
    createdAt?: FirebaseFirestore.Timestamp;
    kind?: string;
}

export function initFirestore(config: BridgeConfig): { app: App; db: Firestore } {
    const serviceAccount = JSON.parse(fs.readFileSync(config.serviceAccountPath, 'utf8'));
    const app = initializeApp({ credential: cert(serviceAccount) });
    // getFirestore(app, databaseId) targets the NAMED database (tng-systems), the
    // same one the app + functions use.
    const db = getFirestore(app, config.databaseId);
    return { app, db };
}

/** Read the current PENDING jobs for this business unit (used by the safety poll
 *  and the initial catch-up on start). Two equality filters → no composite index. */
export async function fetchPendingJobs(db: Firestore, businessUnitId: string): Promise<PrintJob[]> {
    const snap = await db.collection(PRINT_JOBS_COLLECTION)
        .where('businessUnitId', '==', businessUnitId)
        .where('status', '==', 'PENDING')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PrintJob, 'id'>) }));
}

/**
 * Atomically claim a job for printing. Returns the claimed job iff it was still
 * PENDING (now PRINTING, attemptCount incremented); returns null if it was
 * already claimed/printed/failed by someone else. This is the double-print guard.
 */
export async function claimJob(db: Firestore, jobId: string): Promise<PrintJob | null> {
    const ref = db.collection(PRINT_JOBS_COLLECTION).doc(jobId);
    return db.runTransaction(async (txn) => {
        const snap = await txn.get(ref);
        if (!snap.exists) return null;
        const job = { id: snap.id, ...(snap.data() as Omit<PrintJob, 'id'>) };
        if (job.status !== 'PENDING') return null; // someone else has it / already done
        txn.update(ref, {
            status: 'PRINTING',
            attemptCount: (job.attemptCount ?? 0) + 1,
            claimedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { ...job, status: 'PRINTING' as const, attemptCount: (job.attemptCount ?? 0) + 1 };
    });
}

/** Mark a claimed job printed. */
export async function completeJob(db: Firestore, jobId: string, printerTarget: string): Promise<void> {
    await db.collection(PRINT_JOBS_COLLECTION).doc(jobId).update({
        status: 'PRINTED',
        printerTarget,
        printedAt: FieldValue.serverTimestamp(),
        lastError: null,
        updatedAt: FieldValue.serverTimestamp(),
    });
}

/** Mark a claimed job failed (after exhausting in-process retries). The Ops UI
 *  surfaces FAILED + a manual Retry; a manual retry flips it back to PENDING. */
export async function failJob(db: Firestore, jobId: string, error: string): Promise<void> {
    await db.collection(PRINT_JOBS_COLLECTION).doc(jobId).update({
        status: 'FAILED',
        lastError: error.slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
    });
}

export interface HeartbeatInfo {
    version: string;
    printers: Record<string, string>;
    autoPrint: boolean;
    /** Per-station printer reachability, e.g. { KITCHEN: 'ONLINE', BAR: 'OFFLINE' }. */
    printerStatus: Record<string, 'ONLINE' | 'OFFLINE'>;
    /** The most recent print outcome (for the UI's "Last print" row). */
    lastPrint?: { at: number; status: 'PRINTED' | 'FAILED'; order: string; station: string } | null;
}

/** Heartbeat doc so the Ops UI can show Bridge ONLINE/OFFLINE, printer status,
 *  auto-print state, and last activity. */
export async function writeHeartbeat(db: Firestore, businessUnitId: string, info: HeartbeatInfo): Promise<void> {
    await db.collection(BRIDGE_STATUS_COLLECTION).doc(businessUnitId).set({
        businessUnitId,
        online: true,
        version: info.version,
        printers: info.printers,
        printerStatus: info.printerStatus,
        autoPrint: info.autoPrint,
        lastPrint: info.lastPrint ?? null,
        lastHeartbeat: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/** Watch the per-BU auto-print toggle. Calls back with the current value; when the
 *  config doc is absent, auto-print defaults to ON (true). Returns an unsubscribe. */
export function subscribeAutoPrint(db: Firestore, businessUnitId: string, cb: (autoPrint: boolean) => void): () => void {
    return db.collection(PRINT_CONFIG_COLLECTION).doc(businessUnitId).onSnapshot(
        (snap) => {
            const v = snap.exists ? (snap.data() as Record<string, unknown>).autoPrint : undefined;
            cb(v !== false); // default ON unless explicitly false
        },
        () => cb(true), // on error, fail safe to ON (don't silently stop printing)
    );
}

/** Best-effort "going offline" marker on graceful shutdown. */
export async function markOffline(db: Firestore, businessUnitId: string): Promise<void> {
    try {
        await db.collection(BRIDGE_STATUS_COLLECTION).doc(businessUnitId).set({
            online: false, stoppedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    } catch { /* ignore — shutting down */ }
}
