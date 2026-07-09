"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitByStation = exports.classifyStation = exports.PRINT_JOBS_COLLECTION = void 0;
exports.initialJobKey = initialJobKey;
exports.buildInitialPrintJobs = buildInitialPrintJobs;
const stationRouting_1 = require("./stationRouting");
Object.defineProperty(exports, "classifyStation", { enumerable: true, get: function () { return stationRouting_1.classifyStation; } });
Object.defineProperty(exports, "splitByStation", { enumerable: true, get: function () { return stationRouting_1.splitByStation; } });
exports.PRINT_JOBS_COLLECTION = 'qr_print_jobs';
/** Deterministic idempotency key / doc id for a station's INITIAL job. */
function initialJobKey(orderId, station) {
    return `${orderId}:${station}:INITIAL`;
}
function toLine(it) {
    const line = {
        qty: Number(it.quantity ?? 0),
        name: typeof it.productName === 'string' ? it.productName : '',
    };
    const note = typeof it.notes === 'string' ? it.notes.trim() : '';
    if (note)
        line.note = note;
    return line;
}
/**
 * Build the INITIAL print-job docs for a released order — one per station that
 * has at least one line. Stations with no lines produce NO job (a drinks-only
 * order yields only a BAR job; a food-only order only a KITCHEN job). Pure:
 * returns the docs to create; the caller writes them (adding `createdAt`) inside
 * the release transaction. `paid` is true because release is PAID-gated.
 */
function buildInitialPrintJobs(orderId, order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const byStation = (0, stationRouting_1.splitByStation)(items);
    const businessUnitId = typeof order.businessUnitId === 'string' ? order.businessUnitId : '';
    const displayOrderNumber = typeof order.orderNumber === 'string' ? order.orderNumber : orderId;
    const tableNumber = (typeof order.tableNumber === 'string' && order.tableNumber) ||
        (typeof order.tableId === 'string' && order.tableId) || '—';
    const jobs = [];
    for (const station of ['KITCHEN', 'BAR']) {
        const stationItems = byStation[station];
        if (stationItems.length === 0)
            continue; // only create a job for a station with items
        const lines = stationItems.map(toLine);
        const notes = lines.map(l => l.note).filter((n) => !!n);
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
//# sourceMappingURL=printJobLogic.js.map