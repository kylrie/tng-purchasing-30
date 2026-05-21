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
// Represents a finalized event that occurred, logging what
// was actually served, matched, and consumed.
// ============================================================

export interface EventSalesRecord {
  id: string;
  batchImportId: string;            // Linked to import batch for traceability
  businessUnitId: string;
  eventName: string;                // e.g., "Acme Corp Annual Dinner"
  packageTemplateId: string;        // FK to event_package_templates
  packageTemplateName: string;      // Denormalized for reports
  eventDate: string;                // YYYY-MM-DD
  paxCount: number;                 // Number of guests (used as multiplier)

  // 1. Resolved Flexible Selections
  flexibleSelections: EventFlexibleSelection[];

  // 2. Actual Consumables Used
  actualConsumables: EventActualConsumable[];

  // 3. Standard Items Included (auto-populated from template × pax)
  standardItems: EventStandardItem[];

  // Financial Metrics
  totalRevenue: number;             // Package base price + any over-allowance consumables
  totalIngredientCost: number;      // Combined recipe cost of all items
  totalProfit: number;              // Revenue - Cost

  performedBy: string;              // User ID
  performedByName: string;
  createdAt: Timestamp;
}

export interface EventFlexibleSelection {
  choiceGroupId: string;            // e.g., "entree_selection"
  groupName: string;                // e.g., "Main Course (Select 1)"
  selectedItemId: string;           // Matched Finished Good ID
  selectedItemName: string;         // Denormalized
  qtyServed: number;                // Typically paxCount × allowedQty
}

export interface EventActualConsumable {
  inventoryItemId: string;          // Finished Good ID
  inventoryItemName: string;
  qtyConsumed: number;
  unitPrice: number;                // Retail price at time of event
  isOverAllowance: boolean;         // Flag if it exceeded package consumable credit
}

export interface EventStandardItem {
  inventoryItemId: string;          // Finished Good ID
  inventoryItemName: string;
  totalQty: number;                 // qtyPerPax × paxCount
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
// EXCEL PARSER - Intermediary parsed row before match
// ============================================================

export interface EventImportRow {
  eventDate: string;                // Raw from Excel
  eventName: string;
  packageName: string;              // Free-text to match against templates
  paxCount: number;
  selections: Record<string, string>;  // { "Main": "Grilled Salmon", "Dessert": "Tiramisu" }
  consumablesRaw: string;           // Raw semicolon-delimited string (e.g., "Craft Beer:80; House Wine:30")
}

export type EventMatchStatus = 'MATCHED' | 'UNMATCHED' | 'PARTIAL';

export interface EventImportMappedRow extends EventImportRow {
  rowIndex: number;
  // Package Match
  matchedPackageId: string | null;
  matchedPackageName: string | null;
  packageMatchStatus: EventMatchStatus;

  // Resolved Selections per group
  resolvedSelections: {
    choiceGroupId: string;
    groupName: string;
    inputText: string;              // What the user typed
    matchedItemId: string | null;
    matchedItemName: string | null;
    matchStatus: EventMatchStatus;
    qtyServed: number;              // paxCount × allowedQty
  }[];

  // Parsed Consumables
  resolvedConsumables: {
    inputText: string;              // What the user typed
    qty: number;
    matchedItemId: string | null;
    matchedItemName: string | null;
    matchStatus: EventMatchStatus;
  }[];

  // Standard Items (auto-populated from template)
  resolvedStandardItems: {
    inventoryItemId: string;
    inventoryItemName: string;
    totalQty: number;
  }[];

  // Flags
  hasErrors: boolean;               // True if any sub-match is UNMATCHED
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
