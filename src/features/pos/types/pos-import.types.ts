import { Timestamp } from 'firebase/firestore';

// ============================================================
// POS IMPORT - Raw parsed row from Excel/CSV
// ============================================================

export interface PosImportRow {
  category: string;
  itemName: string;
  qtySold: number;
  qtyFoc: number;        // Free of Charge quantity — deducted from stock but earns no revenue
  discount: number;      // Discount applied to this sale, reducing total amount
  isDirectSale: boolean; // True if this item goes straight to sales without deducting inventory
  amount: number;
  costs: number;
  profit: number;
}

// ============================================================
// POS IMPORT - Mapped row with inventory match status
// ============================================================

export type MatchStatus = 'MATCHED' | 'UNMATCHED';

export interface PosImportMappedRow extends PosImportRow {
  rowIndex: number;
  matchedItemId: string | null;
  matchedItemName: string | null;
  matchStatus: MatchStatus;
  currentStock: number | null;        // Snapshot of stock before deduction
  negativeStockFlag: boolean;         // True if deduction would make stock < 0
  amountSource?: 'file' | 'selling_price';  // Where the amount value came from
}

// ============================================================
// POS SALES RECORD - Firestore document in `pos_sales`
// ============================================================

export interface PosSaleRecord {
  id: string;
  batchImportId: string;
  businessUnitId: string;
  inventoryItemId: string;
  inventoryItemName: string;
  category: string;
  qtySold: number;
  qtyFoc: number;        // Free of Charge quantity saved for audit trail
  discount: number;      // Discount amount applied
  isDirectSale: boolean; // Flag to indicate if this bypassed inventory deduction
  amount: number;
  costs: number;
  profit: number;
  negativeStockFlag: boolean;
  importDate: string;                 // ISO string of the import date
  createdAt: Timestamp;
}

// ============================================================
// STOCK TRANSACTION - Audit trail for inventory movements
// ============================================================

export type StockTransactionType =
  | 'RECEIVE'
  | 'ISSUE'
  | 'ADJUSTMENT'
  | 'POS_SALE'
  | 'THEORETICAL_USAGE'   // BOM explosion: raw material deducted from FG sale
  | 'PRODUCTION_YIELD'    // Production run: finished production item yield increase
  | 'PRODUCTION_CONSUME'  // Production run: raw material consumed during production
  | 'STOCK_COUNT'
  | 'WASTAGE'            // Material wastage: stock manually deducted due to loss
  | 'EVENT_CONSUMPTION'; // Event package: direct FG deducted from event sale

export interface StockTransaction {
  id: string;
  itemId: string;
  itemName: string;
  businessUnitId: string;
  type: StockTransactionType;
  quantity: number;                    // Always positive; context from `type`
  balanceAfter: number;               // Snapshot after this transaction
  referenceId: string;                // batchImportId for POS_SALE
  notes?: string;
  performedBy: string;
  performedByName: string;
  timestamp: Timestamp;
}

// ============================================================
// POS IMPORT BATCH - Metadata per import for idempotency
// ============================================================

export interface PosImportBatch {
  id: string;
  businessUnitId: string;
  fileHash: string;
  fileName: string;
  totalRows: number;
  matchedRows: number;
  totalAmount: number;
  totalProfit: number;
  importedBy: string;
  importedByName: string;
  importedAt: Timestamp;
  importDate?: string;
}

// ============================================================
// POS IMPORT - Simulation for Dry Run Preview
// ============================================================

export interface SimulatedDeduction {
  itemId: string;
  itemName: string;
  type: 'FG' | 'FG_DIRECT' | 'RM' | 'PRODUCTION';
  currentTheoreticalStock: number;
  deductionAmount: number;
  newTheoreticalStock: number;
  parentItemId?: string;    // ID of the FG or PRODUCTION parent
  parentItemName?: string;  // Display name of the parent (e.g., "Cheeseburger")
  alert?: string;           // Note indicating conditional BOM explosion behavior
}
