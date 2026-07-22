/**
 * QR Ordering — durable print-job logic (automatic kitchen/bar ticket printing).
 *
 * When a PAID order is RELEASED (see releaseOrder.ts) it produces one INITIAL
 * print job per station that has lines: `qr_print_jobs/{orderId}:{STATION}:INITIAL`.
 * A local Print Bridge on the POS machine claims each PENDING job, prints raw
 * ESC/POS to the station's thermal printer, and reports the outcome back.
 *
 * EXACTLY-ONCE: the doc id IS the idempotency key. Jobs are created inside the
 * SAME transaction that sets the order `released:true` (an idempotent, one-way
 * guard), so a duplicate webhook / payment replay / re-driven release creates
 * ZERO new jobs. A deliberate extra copy is a REPRINT (a separate record), never
 * a re-created INITIAL job.
 *
 * This module is PURE (no firebase-admin import, no I/O) so it is fully unit-
 * testable; the caller writes the returned docs with a server timestamp.
 */

import { classifyStation, splitByStation, type Station } from './stationRouting';

export type { Station };
export const PRINT_JOBS_COLLECTION = 'qr_print_jobs';

/** Job lifecycle: created PENDING → bridge claims PRINTING → PRINTED | FAILED.
 *  A FAILED job is retried (same job) up to the bridge's attempt cap. */
export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED';

/** One printable line on a station ticket (station-filtered). */
export interface PrintJobLine {
    qty: number;
    name: string;
    note?: string;
}

/** The `qr_print_jobs/{id}` document shape (the writer adds `createdAt`). */
export interface PrintJobDoc {
    /** == idempotencyKey == the Firestore doc id. */
    id: string;
    idempotencyKey: string;
    orderId: string;
    businessUnitId: string;
    /** Human-facing order number, e.g. "QR-00001". */
    displayOrderNumber: string;
    tableNumber: string;
    station: Station;
    /** This station's lines ONLY (kitchen = food, bar = drink). */
    lines: PrintJobLine[];
    /** Order-level notes convenience (per-line notes also live on `lines`). */
    notes: string[];
    paid: boolean;
    status: PrintJobStatus;
    attemptCount: number;
    lastError: string | null;
    /** Resolved by the bridge from its local config (station → printer). Null at
     *  creation so the backend never hardcodes a LAN printer address. */
    printerTarget: string | null;
    kind: 'INITIAL';
}

/** The kind marker is fixed for now; REPRINT jobs (a later, deliberate copy) use
 *  a distinct id suffix so they never collide with the INITIAL idempotency key. */
export type PrintJobKind = 'INITIAL' | 'REPRINT';

/** Deterministic idempotency key / doc id for a station's INITIAL job. */
export function initialJobKey(orderId: string, station: Station): string {
    return `${orderId}:${station}:INITIAL`;
}

/** The minimal order shape needed to build print jobs (a subset of QrOrder). */
export interface PrintableOrder {
    businessUnitId?: string;
    orderNumber?: string;
    tableNumber?: string;
    tableId?: string;
    items?: { productName?: string; quantity?: number; notes?: string; category?: string }[];
    paymentStatus?: string;
    status?: string;
}

function toLine(it: { productName?: string; quantity?: number; notes?: string }): PrintJobLine {
    const line: PrintJobLine = {
        qty: Number(it.quantity ?? 0),
        name: typeof it.productName === 'string' ? it.productName : '',
    };
    const note = typeof it.notes === 'string' ? it.notes.trim() : '';
    if (note) line.note = note;
    return line;
}

/**
 * Build the INITIAL print-job docs for a released order — one per station that
 * has at least one line. Stations with no lines produce NO job (a drinks-only
 * order yields only a BAR job; a food-only order only a KITCHEN job). Pure:
 * returns the docs to create; the caller writes them (adding `createdAt`) inside
 * the release transaction. `paid` is true because release is PAID-gated.
 */
export function buildInitialPrintJobs(orderId: string, order: PrintableOrder): PrintJobDoc[] {
    const items = Array.isArray(order.items) ? order.items : [];
    const businessUnitId = typeof order.businessUnitId === 'string' ? order.businessUnitId : '';
    // Route per business unit: The Fun Roof (b1) forces its fine drink categories
    // to BAR; all other units keep the generic classification (b3 unchanged).
    const byStation = splitByStation(items, businessUnitId);
    const displayOrderNumber = typeof order.orderNumber === 'string' ? order.orderNumber : orderId;
    const tableNumber =
        (typeof order.tableNumber === 'string' && order.tableNumber) ||
        (typeof order.tableId === 'string' && order.tableId) || '—';

    const jobs: PrintJobDoc[] = [];
    for (const station of ['KITCHEN', 'BAR'] as Station[]) {
        const stationItems = byStation[station];
        if (stationItems.length === 0) continue; // only create a job for a station with items
        const lines = stationItems.map(toLine);
        const notes = lines.map(l => l.note).filter((n): n is string => !!n);
        const id = initialJobKey(orderId, station);
        jobs.push({
            id,
            idempotencyKey: id,
            orderId,
            businessUnitId,
            displayOrderNumber,
            tableNumber,
            station,
            lines,
            notes,
            paid: true, // release is PAID-gated (evaluateReleaseEligibility)
            status: 'PENDING',
            attemptCount: 0,
            lastError: null,
            printerTarget: null,
            kind: 'INITIAL',
        });
    }
    return jobs;
}

/** Re-exported so callers/tests share the single source of the split. */
export { classifyStation, splitByStation };
