// QR Operations → Tables — pure helpers for showing the ACTIVE ORDER on an
// OCCUPIED table card + modal. Framework-free + unit-testable (node:test). No
// Firestore, no mutation — this is READ-ONLY view logic that reuses the SAME
// active-status rule the board already uses to decide OCCUPIED, so the card can
// never disagree with the status chip.

import { isActiveStatus } from './qrOpsStatus';

/** Minimal order shape needed to summarize a table's active order — a subset of
 *  the ops live feed's OpsOrder, so callers pass their existing order objects
 *  as-is (extra fields are ignored). */
export interface TableOrderLite {
    id: string;
    orderNumber: string;
    tableId?: string;
    tableNumber: string;
    status: string;
    paymentStatus: string;
    items: { name: string; qty: number }[];
    totalAmount: number;
    currency?: string;
    createdAtMillis: number;
}

/**
 * The active orders on one table, most-recently-created first. Match rule mirrors
 * the occupancy resolver: an order belongs to the table by authoritative tableId,
 * else by tableNumber; only `isActiveStatus` orders count. Pure — the exact same
 * predicate that turns a table OCCUPIED, so the summary and the chip stay in sync.
 *
 * The tableNumber fallback is safe because tableNumbers are immutable today (there
 * is no table-rename callable — only createQrTable). If a rename feature is ever
 * added, tighten this to "tableId when present, else tableNumber" so a stale order
 * referencing an old tableId can't surface on a renamed table's card.
 */
export function activeOrdersForTable<T extends TableOrderLite>(
    orders: readonly T[], tableId: string, tableNumber: string,
): T[] {
    return orders
        .filter(o => isActiveStatus(o.status))
        .filter(o => (!!o.tableId && o.tableId === tableId) || (!!tableNumber && o.tableNumber === tableNumber))
        .slice()
        .sort((a, b) => b.createdAtMillis - a.createdAtMillis);
}

export interface ItemSummary {
    /** The first `maxLines` order lines, shown on the compact card. */
    lines: { name: string; qty: number }[];
    /** How many distinct order lines were hidden (drives "+X more"). */
    moreLines: number;
    /** Total quantity across the hidden lines (available if a qty-based label is wanted). */
    moreQty: number;
}

/** First `maxLines` item lines for the compact card, plus how many were hidden. */
export function summarizeItems(
    items: readonly { name: string; qty: number }[] | undefined,
    maxLines = 3,
): ItemSummary {
    const safe = Array.isArray(items) ? items : [];
    const lines = safe.slice(0, maxLines);
    const hidden = safe.slice(maxLines);
    return {
        lines,
        moreLines: hidden.length,
        moreQty: hidden.reduce((n, l) => n + (Number.isFinite(l.qty) ? l.qty : 0), 0),
    };
}

/** Peso money for the board. Whole pesos show no decimals (₱1,235); a fractional
 *  amount shows 2 (₱1,234.50). Never throws on a bad number. */
export function formatMoney(amount: number, currency = 'PHP'): string {
    const n = Number.isFinite(amount) ? amount : 0;
    const symbol = currency === 'PHP' ? '₱' : '';
    const frac = Number.isInteger(n) ? 0 : 2;
    return symbol + n.toLocaleString('en-PH', { minimumFractionDigits: frac, maximumFractionDigits: 2 });
}

/** Compact elapsed label from a positive duration in ms → "5m" / "1h 5m" / "just now". */
export function elapsedLabel(ms: number): string {
    if (!Number.isFinite(ms) || ms < 60_000) return 'just now';
    const totalMin = Math.floor(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
