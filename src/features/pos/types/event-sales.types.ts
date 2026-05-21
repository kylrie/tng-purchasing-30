import { Timestamp } from 'firebase/firestore';

// ============================================================
// EVENT PACKAGE TEMPLATE - Stored in `event_package_templates`
// Defines the structure, pricing, consumables, and flexible
// choice groups for a reusable event package.
// ============================================================

export interface EventPackageTemplate {
  id: string;
  businessUnitId: string;
  name: string;                     // e.g., "Gold Wedding Package", "Corporate Gala Tier 1"
  basePrice: number;                // Selling price of the package itself (flat-rate or per-pax)
  isPerPaxPricing: boolean;         // True if price is multiplied by guest count

  // 1. Consumable Allowance Rules
  consumableType: 'MONETARY' | 'ITEMS' | 'NONE';
  consumableAllowance: number;      // e.g., ₱50,000 bar tab allowance or item qty limit
  standardItemsIncluded: {          // Standard items automatically served to every guest
    inventoryItemId: string;        // Finished Good ID
    inventoryItemName: string;      // Denormalized for display
    qtyPerPax: number;              // e.g., 1 bottle of mineral water per guest
  }[];

  // 2. Flexible Selection Groups (e.g., guest chooses their entrees)
  flexibleChoices: EventFlexibleChoiceGroup[];

  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EventFlexibleChoiceGroup {
  choiceGroupId: string;            // e.g., "entree_selection"
  groupName: string;                // e.g., "Main Course (Select 1)"
  allowedQty: number;               // Number of selections allowed per pax (usually 1)
  options: {                        // Array of allowed Finished Goods
    inventoryItemId: string;
    inventoryItemName: string;      // Denormalized for display
  }[];
}

// ============================================================
// EVENT SALES RECORD - Stored in `event_sales`
// Represents a finalized event with line-item detail.
// ============================================================

export interface EventSalesRecord {
  id: string;
  batchImportId: string;            // Linked to import batch for traceability
  businessUnitId: string;
  eventName: string;                // e.g., "Acme Corp Annual Dinner"
  packageName: string;              // Package label from upload (optional reference)
  eventDate: string;                // YYYY-MM-DD
  paxCount: number;                 // Number of guests (used as multiplier)

  // Line items served at the event
  items: EventSaleItem[];

  // Financial Metrics
  totalRevenue: number;             // Package base price + any over-allowance consumables
  totalIngredientCost: number;      // Combined recipe cost of all items
  totalProfit: number;              // Revenue - Cost

  performedBy: string;              // User ID
  performedByName: string;
  createdAt: Timestamp;
}

export interface EventSaleItem {
  inventoryItemId: string;          // Matched Finished Good / RM ID
  inventoryItemName: string;        // Denormalized
  qty: number;                      // Quantity served
}

// ============================================================
// EVENT IMPORT BATCH - Metadata for idempotent uploads
// ============================================================

export interface EventImportBatch {
  id: string;
  businessUnitId: string;
  fileHash: string;
  fileName: string;
  totalEvents: number;
  totalPax: number;
  totalRevenue: number;
  importedBy: string;
  importedByName: string;
  importedAt: Timestamp;
}

// ============================================================
// EXCEL PARSER - Vertical line-item format
// One event = multiple rows. First row has the event metadata,
// subsequent rows only have ITEM + QTY.
// ============================================================

export interface EventImportRow {
  eventDate: string;                // Raw from Excel
  eventName: string;
  packageName: string;              // Free-text (optional reference)
  paxCount: number;
  items: { name: string; qty: number }[];
}

export type EventMatchStatus = 'MATCHED' | 'UNMATCHED' | 'PARTIAL';

export interface EventImportMappedRow extends EventImportRow {
  rowIndex: number;

  // Resolved line items
  resolvedItems: {
    inputText: string;              // What the user typed
    qty: number;
    matchedItemId: string | null;
    matchedItemName: string | null;
    matchStatus: EventMatchStatus;
  }[];

  // Flags
  hasErrors: boolean;               // True if any item is UNMATCHED
}

// ============================================================
// EVENT BOM SIMULATION - Dry-run deduction preview
// ============================================================

export interface EventSimulatedDeduction {
  itemId: string;
  itemName: string;
  type: 'FG' | 'FG_DIRECT' | 'RM' | 'PRODUCTION';
  currentTheoreticalStock: number;
  deductionAmount: number;
  newTheoreticalStock: number;
  parentItemId?: string;
  parentItemName?: string;
  eventName: string;                // Which event triggered this deduction
}

// ============================================================
// FIRESTORE COLLECTION CONSTANTS
// ============================================================

export const EVENT_COL = {
  EVENT_PACKAGE_TEMPLATES: 'event_package_templates',
  EVENT_SALES: 'event_sales',
  EVENT_IMPORT_BATCHES: 'event_import_batches',
} as const;
