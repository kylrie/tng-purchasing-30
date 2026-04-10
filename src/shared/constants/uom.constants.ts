// ============================================================
// HARDCODED UNITS OF MEASUREMENT (UOM)
// These are system-defined and cannot be added, edited, or deleted by users.
// ============================================================

export interface UOMDefinition {
    code: string;       // The stored code (e.g., "KG")
    label: string;      // Human-readable label (e.g., "Kilogram")
    category: 'Count' | 'Weight' | 'Volume' | 'Packaging';
}

export const HARDCODED_UOMS: UOMDefinition[] = [
    // ── Count / Piece ──────────────────────────────────────────
    { code: 'EA',     label: 'Each / Piece',  category: 'Count' },
    { code: 'DZ',     label: 'Dozen',         category: 'Count' },
    { code: 'PR',     label: 'Pair',          category: 'Count' },
    { code: 'SET',    label: 'Set',           category: 'Count' },

    // ── Packaging ──────────────────────────────────────────────
    { code: 'BG',     label: 'Bag',           category: 'Packaging' },
    { code: 'BX',     label: 'Box',           category: 'Packaging' },
    { code: 'CA',     label: 'Case',          category: 'Packaging' },
    { code: 'CT',     label: 'Carton',        category: 'Packaging' },
    { code: 'RM',     label: 'Ream',          category: 'Packaging' },
    { code: 'PLT',    label: 'Pallet',        category: 'Packaging' },
    { code: 'TRAY',   label: 'Tray',          category: 'Packaging' },
    { code: 'PACK',   label: 'Pack',          category: 'Packaging' },
    { code: 'CAN',    label: 'Can',           category: 'Packaging' },

    // ── Weight ─────────────────────────────────────────────────
    { code: 'KG',     label: 'Kilogram',      category: 'Weight' },
    { code: 'G',      label: 'Gram',          category: 'Weight' },
    { code: 'LB',     label: 'Pound',         category: 'Weight' },
    { code: 'OZ',     label: 'Ounce',         category: 'Weight' },

    // ── Volume ─────────────────────────────────────────────────
    { code: 'L',      label: 'Liter',         category: 'Volume' },
    { code: 'ML',     label: 'Milliliter',    category: 'Volume' },
    { code: 'GAL',    label: 'Gallon (US)',   category: 'Volume' },
    { code: 'QT',     label: 'Quart',         category: 'Volume' },
    { code: 'PT',     label: 'Pint',          category: 'Volume' },
    { code: 'BARREL', label: 'Barrel',        category: 'Volume' },
];

/**
 * Quick-lookup: code → label  (e.g.  "KG" → "Kilogram")
 */
export const UOM_LABEL: Record<string, string> = Object.fromEntries(
    HARDCODED_UOMS.map(u => [u.code, u.label])
);

/**
 * A plain string array of UOM codes – drop-in replacement for the old
 * Firestore-backed `uomOptions` array used across the app.
 */
export const UOM_CODES: string[] = HARDCODED_UOMS.map(u => u.code);

// ============================================================
// FULL UNIT CONVERSION TABLE
// All keys are UPPERCASE to match UOM codes above.
// Conversion factor: "how many [toUnit] are in 1 [fromUnit]"
// ============================================================

export const UOM_CONVERSIONS: Record<string, Record<string, number>> = {
    // ── Weight ─────────────────────────────────────────────────
    KG: {
        G:   1000,
        LB:  2.20462,
        OZ:  35.274,
    },
    G: {
        KG:  0.001,
        LB:  0.00220462,
        OZ:  0.035274,
    },
    LB: {
        G:   453.592,
        KG:  0.453592,
        OZ:  16,
    },
    OZ: {
        G:   28.3495,
        KG:  0.0283495,
        LB:  0.0625,
    },

    // ── Volume ─────────────────────────────────────────────────
    L: {
        ML:  1000,
        GAL: 0.264172,
        QT:  1.05669,
        PT:  2.11338,
    },
    ML: {
        L:   0.001,
        GAL: 0.000264172,
        QT:  0.00105669,
        PT:  0.00211338,
    },
    GAL: {
        L:   3.78541,
        ML:  3785.41,
        QT:  4,
        PT:  8,
    },
    QT: {
        L:   0.946353,
        ML:  946.353,
        GAL: 0.25,
        PT:  2,
    },
    PT: {
        L:   0.473176,
        ML:  473.176,
        GAL: 0.125,
        QT:  0.5,
    },
    BARREL: {
        L:   158.987,
        ML:  158987,
        GAL: 42,
    },

    // ── Count ──────────────────────────────────────────────────
    DZ: {
        EA: 12,
    },
    EA: {
        DZ: 0.0833,   // inverse of 12, approx
    },
    PR: {
        EA: 2,
    },
    SET: {
        EA: 1,        // Sets are 1-for-1 with each (contextual)
    },
};
