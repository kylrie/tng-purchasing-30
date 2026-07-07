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

// Print transport:
//  - 'bluetooth' : Web Bluetooth + raw ESC/POS (Fred's spare test printer).
//  - 'system'    : window.print() of an 80mm HTML ticket → the OS-installed driver
//                  (the real XP-Q801 at the location). Reuses the exact path POS
//                  already uses for receipts (ReceiptModal). No raw TCP (browsers
//                  can't); no new infrastructure. A local bridge (raw ESC/POS to
//                  :9100) is a later option for silent/auto printing.
export type PrintMode = 'bluetooth' | 'system';
const LS_MODE = 'qr_print_mode';
export function getPrintMode(): PrintMode {
    try { return (localStorage.getItem(LS_MODE) as PrintMode) === 'system' ? 'system' : 'bluetooth'; }
    catch { return 'bluetooth'; }
}
export function setPrintMode(mode: PrintMode): void {
    try { localStorage.setItem(LS_MODE, mode); } catch { /* ignore */ }
}

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

// ── System printing: 80mm HTML ticket via window.print() → OS driver ─────────
// Reuses the exact mechanism POS already uses (ReceiptModal). The OS driver (e.g.
// the installed XP-Q801) renders the 80mm page and performs the cut per its
// settings. Prints via a hidden iframe so only the ticket prints (not the app).
const esc = (s: string): string => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

/** Build the printable 80mm HTML for a station ticket (large, high-contrast). */
export function buildTicketHtml(t: TicketData): string {
    const time = new Date(t.atMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const notes = t.lines.map(l => l.note?.trim()).filter((n): n is string => !!n);
    const items = t.lines.map(l => `<div class="item">${l.qty}× ${esc(l.name)}</div>`).join('');
    const notesHtml = notes.length ? `<div class="notes"><b>NOTES</b>${notes.map(n => `<div>${esc(n)}</div>`).join('')}</div>` : '';
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.orderNumber)} ${t.station}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 80mm; background: #fff; color: #000;
    font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; }
  .w { padding: 4mm 3mm 8mm; }
  .hdr { font-size: 24pt; font-weight: 900; line-height: 1.05; }
  .time { font-size: 11pt; margin-top: 1mm; }
  .station { font-size: 34pt; font-weight: 900; text-align: center; margin: 3mm 0; letter-spacing: 1px; }
  .item { font-size: 19pt; font-weight: 800; line-height: 1.25; }
  .notes { font-size: 13pt; margin-top: 3mm; border: 2px solid #000; padding: 2mm; }
  .paid { font-size: 22pt; font-weight: 900; text-align: center; margin-top: 4mm; border-top: 2px dashed #000; padding-top: 3mm; }
  hr { border: 0; border-top: 2px solid #000; margin: 2mm 0; }
</style></head><body><div class="w">
  <div class="hdr">${esc(t.orderNumber)}</div>
  <div class="hdr">TABLE ${esc(t.tableNumber)}</div>
  <div class="time">${time}</div>
  <div class="station">${t.station}</div>
  <hr>${items}${notesHtml}
  <div class="paid">${t.paid ? 'PAID' : 'UNPAID'}</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},80);};</script>
</body></html>`;
}

/** Print a station ticket via the OS driver using a hidden iframe. Resolves once
 *  the print is dispatched (browser gives no reliable success signal). */
export function printTicketSystem(t: TicketData): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        try {
            const iframe = document.createElement('iframe');
            iframe.setAttribute('aria-hidden', 'true');
            iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
            document.body.appendChild(iframe);
            const cleanup = () => { window.setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* */ } }, 1500); };
            const win = iframe.contentWindow;
            const doc = iframe.contentWindow?.document;
            if (!win || !doc) { document.body.removeChild(iframe); reject(new Error('Print frame unavailable.')); return; }
            win.addEventListener('afterprint', () => { cleanup(); resolve(); });
            doc.open(); doc.write(buildTicketHtml(t)); doc.close();
            // Fallback in case afterprint never fires (dialog dismissed, etc.).
            window.setTimeout(() => { cleanup(); resolve(); }, 2000);
        } catch (e) { reject(e as Error); }
    });
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

/** Print a station ticket over the current Bluetooth connection (raw ESC/POS). */
export async function printTicket(t: TicketData): Promise<void> {
    await POSPrinterService.print({ type: 'bluetooth' }, buildTicket(t));
}

/** Print a ticket via the currently selected transport (bluetooth or system). */
export async function printByMode(t: TicketData): Promise<void> {
    if (getPrintMode() === 'system') return printTicketSystem(t);
    return printTicket(t);
}

/** A short, readable test ticket (proves the printer + paper output). */
export async function printTest(): Promise<void> {
    await printByMode({
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
        await printByMode(t);
        if (!opts.reprint) setJobStatus(orderId, t.station, 'PRINTED');
        return { ok: true };
    } catch (e) {
        if (!opts.reprint) setJobStatus(orderId, t.station, 'FAILED');
        return { ok: false, error: (e as Error)?.message || 'Print failed' };
    }
}
