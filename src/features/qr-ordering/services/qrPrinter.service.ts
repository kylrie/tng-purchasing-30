// QR Operations — station ticket printing over the PROVEN POS Bluetooth path.
//
// This is a THIN wrapper: it reuses POSPrinterService (Web Bluetooth + ESC/POS,
// the exact mechanism Fred's POS test print used) — no new print bridge. It adds
// (1) Kitchen/Bar ESC/POS ticket generation and (2) a localStorage idempotency
// ledger so a ticket isn't accidentally printed twice (INITIAL vs REPRINT).
//
// Web Bluetooth constraints (see audit): pairing needs a user gesture and the
// connection is lost on reload — so printing is MANUAL (button-triggered) for now.

import { POSPrinterService } from '../../pos/services/pos-printer.service';

export type Station = 'KITCHEN' | 'BAR';
export type PrintJobStatus = 'PENDING' | 'PRINTED' | 'FAILED';

export interface TicketLine { qty: number; name: string; note?: string; }
export interface TicketData {
    orderNumber: string;
    tableNumber: string;
    station: Station;
    lines: TicketLine[];
    paid: boolean;
    atMillis: number;
}

// ── ESC/POS builders ─────────────────────────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;
const enc = new TextEncoder();

const INIT = [ESC, 0x40];                 // ESC @  — reset
const ALIGN_LEFT = [ESC, 0x61, 0x00];
const ALIGN_CENTER = [ESC, 0x61, 0x01];
const BOLD_ON = [ESC, 0x45, 0x01];
const BOLD_OFF = [ESC, 0x45, 0x00];
const SIZE_NORMAL = [GS, 0x21, 0x00];      // GS ! 0
const SIZE_2X = [GS, 0x21, 0x11];          // GS ! — double width + height
const SIZE_2H = [GS, 0x21, 0x01];          // double height only
const FEED = (n: number) => Array(n).fill(0x0a);
const CUT = [GS, 0x56, 0x41, 0x00];        // GS V A — full cut

function line(text: string): number[] {
    return [...Array.from(enc.encode(text)), 0x0a];
}

/** Build the ESC/POS byte payload for a station ticket. Large, high-contrast,
 *  minimal paper — matches the approved format. Pure + exported for testing. */
export function buildTicket(t: TicketData): Uint8Array {
    const time = new Date(t.atMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const notes = t.lines.map(l => l.note?.trim()).filter((n): n is string => !!n);
    const data: number[] = [
        ...INIT,
        ...ALIGN_LEFT,
        // Header: order # + table (double height, bold)
        ...BOLD_ON, ...SIZE_2H,
        ...line(t.orderNumber),
        ...line(`TABLE ${t.tableNumber}`),
        ...SIZE_NORMAL, ...BOLD_OFF,
        ...line(time),
        ...FEED(1),
        // Station heading (biggest, centered)
        ...ALIGN_CENTER, ...BOLD_ON, ...SIZE_2X,
        ...line(t.station),
        ...SIZE_NORMAL, ...BOLD_OFF, ...ALIGN_LEFT,
        ...FEED(1),
        // Item lines (double height for legibility)
        ...SIZE_2H, ...BOLD_ON,
        ...t.lines.flatMap(l => line(`${l.qty}x ${l.name}`)),
        ...SIZE_NORMAL, ...BOLD_OFF,
    ];
    if (notes.length) {
        data.push(...FEED(1), ...BOLD_ON, ...line('NOTES:'), ...BOLD_OFF);
        for (const n of notes) data.push(...line(n));
    }
    data.push(
        ...FEED(1),
        ...BOLD_ON, ...SIZE_2H, ...line(t.paid ? 'PAID' : 'UNPAID'), ...SIZE_NORMAL, ...BOLD_OFF,
        ...FEED(3),
        ...CUT,
    );
    return new Uint8Array(data);
}

// ── Connection (reuse the POS Bluetooth engine verbatim) ─────────────────────
/** Pair / connect a Bluetooth printer — MUST be called from a user gesture. */
export async function connectPrinter(): Promise<boolean> {
    return POSPrinterService.connectBluetooth();
}
export function isPrinterConnected(): boolean {
    return POSPrinterService.isBluetoothConnected();
}
export function disconnectPrinter(): void {
    POSPrinterService.disconnectBluetooth();
}

/** Print a station ticket over the current Bluetooth connection. */
export async function printTicket(t: TicketData): Promise<void> {
    await POSPrinterService.print({ type: 'bluetooth' }, buildTicket(t));
}

/** A short, readable test ticket (proves pairing + paper output). */
export async function printTest(): Promise<void> {
    await printTicket({
        orderNumber: 'TEST TICKET', tableNumber: '—', station: 'KITCHEN',
        lines: [{ qty: 1, name: 'QR PRINTER TEST' }], paid: true, atMillis: Date.now(),
    });
}

// ── Idempotency ledger (localStorage) — duplicate protection ─────────────────
// Key: qr_print:<orderId>:<STATION>:<kind>  →  PrintJobStatus
// kind = INITIAL (the one automatic/first copy) or REPRINT (deliberate extra).
const LS_PREFIX = 'qr_print';
function jobKey(orderId: string, station: Station): string {
    return `${LS_PREFIX}:${orderId}:${station}:INITIAL`;
}

export function getJobStatus(orderId: string, station: Station): PrintJobStatus | null {
    try { return (localStorage.getItem(jobKey(orderId, station)) as PrintJobStatus) || null; }
    catch { return null; }
}
function setJobStatus(orderId: string, station: Station, status: PrintJobStatus): void {
    try { localStorage.setItem(jobKey(orderId, station), status); } catch { /* ignore */ }
}

export interface StationPrintResult { ok: boolean; error?: string; }

/**
 * Print the INITIAL station ticket with duplicate protection. If it was already
 * PRINTED this is a no-op unless `reprint` is true (a deliberate second copy).
 * A FAILED prior job is retried transparently (RETRY = re-attempt the original).
 */
export async function printStation(
    t: TicketData,
    orderId: string,
    opts: { reprint?: boolean } = {},
): Promise<StationPrintResult> {
    const prior = getJobStatus(orderId, t.station);
    if (prior === 'PRINTED' && !opts.reprint) {
        return { ok: true }; // already printed — idempotent no-op (use reprint for an extra copy)
    }
    if (!opts.reprint) setJobStatus(orderId, t.station, 'PENDING');
    try {
        await printTicket(t);
        if (!opts.reprint) setJobStatus(orderId, t.station, 'PRINTED');
        return { ok: true };
    } catch (e) {
        if (!opts.reprint) setJobStatus(orderId, t.station, 'FAILED');
        return { ok: false, error: (e as Error)?.message || 'Print failed' };
    }
}
