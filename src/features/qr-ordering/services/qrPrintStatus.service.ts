// QR Operations — automatic-print status + control (Phase 6).
//
// Read-only live views of the local Print Bridge and the durable print jobs, plus
// the two server-mediated controls (auto-print toggle, retry a failed job).
// `qr_print_jobs` / `qr_print_bridge_status` / `qr_print_config` are all
// `write: if false` for clients, so writes go through the setAutoPrint /
// retryPrintJob callables (staff-authed, BU-scoped). Reads are direct onSnapshots.

import { httpsCallable } from 'firebase/functions';
import type { Unsubscribe } from 'firebase/firestore';
import { FirestoreService, where, Timestamp } from '../../../shared/services/firestore.service';
import { getQrFunctions } from './qrFunctions';
import type { Station } from './qrPrinter.service';

const BRIDGE_STATUS_COLLECTION = 'qr_print_bridge_status';
const PRINT_JOBS_COLLECTION = 'qr_print_jobs';

/** Heartbeat considered stale after 3 missed beats (bridge beats every ~15s). */
const HEARTBEAT_STALE_MS = 45_000;

export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED';
export type PrinterState = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface LastPrint { at: number; status: 'PRINTED' | 'FAILED'; order: string; station: string }

export interface BridgeStatus {
    id: string;
    online?: boolean;
    autoPrint?: boolean;
    version?: string;
    printers?: Record<string, string>;
    printerStatus?: Record<string, 'ONLINE' | 'OFFLINE'>;
    lastPrint?: LastPrint | null;
    lastHeartbeat?: Timestamp;
}

export interface PrintJobView {
    id: string;
    orderId?: string;
    station?: Station;
    status?: PrintJobStatus;
    lastError?: string | null;
    attemptCount?: number;
    printedAt?: Timestamp;
}

/** Live subscription to this business unit's bridge heartbeat doc. */
export function subscribeBridgeStatus(
    businessUnitId: string,
    onData: (status: BridgeStatus | null) => void,
    onError?: (err: Error) => void,
): Unsubscribe {
    return FirestoreService.subscribeToDocument<BridgeStatus>(BRIDGE_STATUS_COLLECTION, businessUnitId, onData, onError);
}

/** Live subscription to the print jobs for ONE order (0–2 rows). Single equality
 *  filter → no composite index. */
export function subscribeOrderPrintJobs(
    orderId: string,
    onData: (jobs: PrintJobView[]) => void,
    onError?: (err: Error) => void,
): Unsubscribe {
    return FirestoreService.subscribeToCollection<PrintJobView>(
        PRINT_JOBS_COLLECTION, onData, [where('orderId', '==', orderId)], onError,
    );
}

/** Turn auto-print ON/OFF for this business unit (persists; the bridge honors it). */
export async function setAutoPrint(businessUnitId: string, enabled: boolean): Promise<void> {
    const callable = httpsCallable<{ businessUnitId: string; enabled: boolean }, { autoPrint: boolean }>(
        getQrFunctions(), 'setAutoPrint',
    );
    await callable({ businessUnitId, enabled });
}

/** Re-queue a FAILED print job so the bridge re-attempts it. */
export async function retryPrintJob(jobId: string): Promise<void> {
    const callable = httpsCallable<{ jobId: string }, { status: string }>(getQrFunctions(), 'retryPrintJob');
    await callable({ jobId });
}

// ── Pure derivations (exported for testing) ──────────────────────────────────

/** The bridge is ONLINE only if it says so AND its heartbeat is fresh (so a
 *  crashed bridge that never wrote `online:false` still reads as OFFLINE). */
export function isBridgeOnline(status: BridgeStatus | null, now: number): boolean {
    if (!status || status.online !== true) return false;
    const beat = status.lastHeartbeat?.toMillis?.();
    return typeof beat === 'number' && (now - beat) < HEARTBEAT_STALE_MS;
}

/** Printer state for the UI: UNKNOWN when the bridge is offline/stale (we can't
 *  tell), otherwise the bridge's last probe result for that station. */
export function printerStateFor(status: BridgeStatus | null, station: Station, now: number): PrinterState {
    if (!isBridgeOnline(status, now)) return 'UNKNOWN';
    const s = status?.printerStatus?.[station];
    return s === 'ONLINE' ? 'ONLINE' : s === 'OFFLINE' ? 'OFFLINE' : 'UNKNOWN';
}

/** Overall printer state (both stations share one printer in the MVP). */
export function overallPrinterState(status: BridgeStatus | null, now: number): PrinterState {
    if (!isBridgeOnline(status, now)) return 'UNKNOWN';
    const k = printerStateFor(status, 'KITCHEN', now);
    const b = printerStateFor(status, 'BAR', now);
    if (k === 'ONLINE' || b === 'ONLINE') return 'ONLINE';
    if (k === 'OFFLINE' || b === 'OFFLINE') return 'OFFLINE';
    return 'UNKNOWN';
}
