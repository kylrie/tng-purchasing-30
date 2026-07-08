/**
 * ESC/POS station-ticket builder — PORTED VERBATIM from the app's proven
 * qrPrinter.service.ts `buildTicket` (commit 1412790 / 5c820d1). Fred's manual
 * physical test on the XP-Q801 printed exactly these bytes, so the automatic path
 * MUST emit the same output. Do not "improve" the layout here without re-proving
 * on paper — keep it byte-identical to the app.
 *
 * Pure: takes a ticket description, returns the raw ESC/POS Buffer. No I/O.
 */

export type Station = 'KITCHEN' | 'BAR';

export interface TicketLine { qty: number; name: string; note?: string; }

export interface TicketData {
    orderNumber: string;   // displayOrderNumber, e.g. "QR-00042"
    tableNumber: string;
    station: Station;
    lines: TicketLine[];
    paid: boolean;
    atMillis: number;
    isReprint?: boolean;
}

const ESC = 0x1b;
const GS = 0x1d;

const INIT = [ESC, 0x40];                 // ESC @  — reset
const ALIGN_LEFT = [ESC, 0x61, 0x00];
const ALIGN_CENTER = [ESC, 0x61, 0x01];
const BOLD_ON = [ESC, 0x45, 0x01];
const BOLD_OFF = [ESC, 0x45, 0x00];
const SIZE_NORMAL = [GS, 0x21, 0x00];      // GS ! 0
const SIZE_2X = [GS, 0x21, 0x11];          // GS ! — double width + height
const SIZE_2H = [GS, 0x21, 0x01];          // double height only
const FEED = (n: number): number[] => Array(n).fill(0x0a);
const CUT = [GS, 0x56, 0x41, 0x00];        // GS V A — full cut

function line(text: string): number[] {
    return [...Array.from(Buffer.from(text, 'utf8')), 0x0a];
}

/** Build the ESC/POS byte payload for one station ticket (byte-identical to the
 *  app's buildTicket). */
export function buildTicket(t: TicketData): Buffer {
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
        ...SIZE_NORMAL,
        ...(t.isReprint ? line('** REPRINT **') : []),
        ...BOLD_OFF, ...ALIGN_LEFT,
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
    return Buffer.from(data);
}
