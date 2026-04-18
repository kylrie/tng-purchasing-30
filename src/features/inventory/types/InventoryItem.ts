import { Timestamp } from 'firebase/firestore';

// ============================================================
// ITEM TYPE ENUM - Required for multi-type inventory
// ============================================================

export type InventoryItemType =
  | 'RAW_MATERIAL'    // Flour, Whiskey - Used in recipes
  | 'FINISHED_GOOD'   // Bottled Sauce - Something you sell or count
  | 'PRODUCTION'      // Pre-batched Mixes - Made in-house
  | 'ASSET';          // Blender, Chair - Fixed assets

export type InventoryCategory =
  | 'Spirits'
  | 'Wine'
  | 'Beer'
  | 'Mixers'
  | 'Beverage'
  | 'Food'
  | 'Frozen Good'
  | 'Dry Goods'
  | 'Equipment'
  | 'Furniture'
  | 'Supplies'
  | 'Glassware'
  | 'Souvenir'
  | 'Other';

// ============================================================
// UNIT CONVERSION TYPES - Wisk-style multi-unit handling
// ============================================================

export interface UnitConversion {
  recipeUnit: string;    // Base recipe/costing unit (e.g., "G", "ML", "piece")
  buyUnit: string;       // Purchasing unit (e.g., "case", "box")
  conversion: number;    // How many recipeUnits in a buyUnit
}


// ============================================================
// ASSET DETAILS - For Fixed Assets tracking
// ============================================================

export type AssetStatus = 'Active' | 'Broken' | 'In Repair' | 'Decommissioned';

export interface AssetDetails {
  serialNumber?: string;        // Asset tag / Serial number
  purchaseDate?: string;        // YYYY-MM-DD format
  status: AssetStatus;          // Current condition
  assignedTo?: string;          // Employee name
  assignedToId?: string;        // Employee user ID
  location?: string;            // Physical location
  warrantyExpiry?: string;      // YYYY-MM-DD format
  purchasePrice?: number;       // Original purchase price
  depreciationRate?: number;    // Annual depreciation %
}

// ============================================================
// BOM (Bill of Materials) INGREDIENT - For recipe explosion
// ============================================================

export interface BomIngredient {
  ingredientId: string;        // ID of the RAW_MATERIAL inventory item
  ingredientName: string;      // Denormalized for display
  quantityUsed: number;        // Amount per 1 unit of FG sold / per batch
  unit: string;                // Unit (g, ml, piece, etc.)
  wastagePercent?: number;     // % of quantityUsed that becomes waste during prep (0–100)
                               // e.g. 40 means 40% of mango weight is seeds/skin
}

// ============================================================
// INVENTORY ITEM TYPES - Multi-Tenant
// ============================================================

export interface InventoryItem {
  id: string;
  businessUnitId: string;            // CRUCIAL - Multi-tenant filter
  name: string;
  type: InventoryItemType;           // RAW_MATERIAL, FINISHED_GOOD, PRODUCTION, ASSET
  category: InventoryCategory;
  sku?: string;
  imageUrl?: string;
  storageAreas: string[];            // e.g., ["Kitchen", "Storage Room"]
  units: UnitConversion;
  parLevel: number;                  // Minimum stock level (in recipeUnits)
  currentStock: number;              // Physical stock from stock counts (in recipeUnits)
  theoreticalStock: number;          // POS-derived expected stock (deducted by sales imports)
  costPerUnit: number;               // Legacy Cost per recipeUnit (kept for compatibility)
  buyCost?: number;                  // Cost per Buy Unit (e.g. per case)
  baseCost?: number;                 // Cost per Base Unit (used by POS BOM explosion and Recipe builder)
  supplier?: string;
  notes?: string;
  menuItemId?: string;               // Link to menu item if FINISHED_GOOD from Menu Engineering
  assetDetails?: AssetDetails;       // Asset-specific details (only for type='ASSET')
  recipe?: BomIngredient[];           // BOM recipe for FG → raw material explosion during POS import
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// STOCK COUNT SESSION TYPES - Multi-Tenant
// ============================================================

export type StockCountStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';

export interface StockCountItem {
  itemId: string;
  itemName: string;
  count: number;                     // Whole units counted
  partialCount: number;              // Partial unit (0.0 - 1.0) for partial bottles
  unit: string;
}

export interface StockCountSession {
  id: string;
  businessUnitId: string;            // Multi-tenant filter
  status: StockCountStatus;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  performedBy: string;
  performedByName?: string;
  location: string;                  // Storage area being counted
  items: StockCountItem[];
  totalValue?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// COGS & REPORTING TYPES
// ============================================================

export interface COGSReport {
  id: string;
  businessUnitId: string;
  periodStart: Date;
  periodEnd: Date;
  beginningInventoryValue: number;
  purchasesValue: number;
  endingInventoryValue: number;
  cogs: number;
  generatedAt: Timestamp;
  generatedBy: string;
}

export interface StockValueTrend {
  date: string;
  value: number;
  category?: string;
}

// ============================================================
// FORM/INPUT TYPES
// ============================================================

export interface CreateInventoryItemInput {
  businessUnitId: string;
  name: string;
  type: InventoryItemType;
  category: InventoryCategory;
  sku?: string;
  imageUrl?: string;
  storageAreas: string[];
  units: UnitConversion;
  parLevel: number;
  currentStock: number;
  theoreticalStock?: number;          // Defaults to currentStock if not provided
  costPerUnit: number;                // Legacy
  buyCost?: number;                   // Cost per Buy Unit
  baseCost?: number;                  // Cost per Base Unit (primary value for POS BOM explosion and Recipe builder)
  supplier?: string;
  notes?: string;
  menuItemId?: string;  // Link to menu item if this is a FINISHED_GOOD from Menu Engineering
  recipe?: BomIngredient[];           // BOM recipe for FG
}

export interface StartSessionInput {
  businessUnitId: string;
  location: string;
  performedBy: string;
  performedByName: string;
}

export interface SaveCountInput {
  sessionId: string;
  itemId: string;
  itemName: string;
  count: number;
  unit: string;
  partialCount: number;
}

// ============================================================
// RECEIVING GOODS
// ============================================================

export interface ReceiveGoodsPayload {
  inventoryItemId: string;    // The mapped item ID
  qtyReceived: number;        // The quantity entered by user (in buy units)
  unitPrice: number;          // The unit price entered by user
}

// ============================================================
// WASTAGE TRACKING TYPES
// ============================================================

export type WastageReason =
  | 'Spillage'
  | 'Expired'
  | 'Damaged'
  | 'Contaminated'
  | 'Overproduction'
  | 'Equipment Failure'
  | 'Human Error'
  | 'Other';

export interface WastageRecord {
  id: string;
  businessUnitId: string;           // Multi-tenant filter
  itemId: string;                   // Inventory item FK
  itemName: string;                 // Denormalized for log display
  itemType: InventoryItemType;      // RAW_MATERIAL or PRODUCTION
  quantity: number;                 // Amount wasted (in recipeUnits, always positive)
  unit: string;                     // Unit label (e.g., "kg", "bottle")
  reason: WastageReason;
  notes?: string;
  costPerUnit: number;              // Snapshot of cost at time of wastage
  totalCost: number;                // quantity × costPerUnit
  balanceAfter: number;             // Stock snapshot after deduction
  performedBy: string;              // User UID
  performedByName: string;          // User display name
  createdAt: Timestamp;
}

export interface RecordWastageInput {
  businessUnitId: string;
  itemId: string;
  quantity: number;
  reason: WastageReason;
  notes?: string;
  performedBy: { id: string; name: string };
}

// ============================================================
// PRODUCTION BATCH TYPES
// ============================================================

export interface ProductionBatchInput {
  businessUnitId: string;
  productionItemId: string;          // The PRODUCTION item whose stock is being increased
  batchMultiplier: number;           // How many batches are being produced (default: 1)
  performedBy: { id: string; name: string };
  notes?: string;
}

export interface ProductionBatchResult {
  productionItem: string;            // Name of the produced item
  batchesProduced: number;
  outputAdded: number;               // recipeUnits added to PRODUCTION item stock
  ingredientsConsumed: { name: string; qty: number; unit: string }[];
  wastageRecorded: { name: string; qty: number; unit: string; cost: number }[];
  totalWastageCost: number;
}

// ============================================================
// MOCK DATA - Multi-Tenant with Types
// ============================================================

export const MOCK_STORAGE_AREAS: string[] = [
  'Kitchen',
  'Storage Room',
  'Bar',
  'Walk-in Cooler',
  'Office'
];

export const MOCK_INVENTORY_ITEMS: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // RAW MATERIALS
  {
    businessUnitId: 'bu-1',
    name: 'All-Purpose Flour',
    type: 'RAW_MATERIAL',
    category: 'Dry Goods',
    storageAreas: ['Kitchen', 'Storage Room'],
    units: { recipeUnit: 'kg', buyUnit: 'sack', conversion: 25 },
    parLevel: 50,
    currentStock: 75,
    theoreticalStock: 75,
    costPerUnit: 45,
    isActive: true
  },
  {
    businessUnitId: 'bu-1',
    name: 'Jameson Irish Whiskey',
    type: 'RAW_MATERIAL',
    category: 'Spirits',
    storageAreas: ['Bar', 'Storage Room'],
    units: { recipeUnit: 'bottle', buyUnit: 'case', conversion: 12 },
    parLevel: 6,
    currentStock: 8,
    theoreticalStock: 8,
    costPerUnit: 1200,
    isActive: true
  },
  // PRODUCTION
  {
    businessUnitId: 'bu-1',
    name: 'House Margarita Mix',
    type: 'PRODUCTION',
    category: 'Mixers',
    storageAreas: ['Bar'],
    units: { recipeUnit: 'liter', buyUnit: 'batch', conversion: 5 },
    parLevel: 10,
    currentStock: 15,
    theoreticalStock: 15,
    costPerUnit: 150,
    isActive: true
  },
  // FINISHED GOODS
  {
    businessUnitId: 'bu-1',
    name: 'Bottled Hot Sauce',
    type: 'FINISHED_GOOD',
    category: 'Food',
    storageAreas: ['Kitchen', 'Storage Room'],
    units: { recipeUnit: 'bottle', buyUnit: 'case', conversion: 24 },
    parLevel: 48,
    currentStock: 72,
    theoreticalStock: 72,
    costPerUnit: 85,
    isActive: true
  },
  // ASSETS
  {
    businessUnitId: 'bu-1',
    name: 'Commercial Blender',
    type: 'ASSET',
    category: 'Equipment',
    storageAreas: ['Kitchen'],
    units: { recipeUnit: 'unit', buyUnit: 'unit', conversion: 1 },
    parLevel: 2,
    currentStock: 3,
    theoreticalStock: 3,
    costPerUnit: 15000,
    isActive: true
  },
  {
    businessUnitId: 'bu-1',
    name: 'Bar Stool',
    type: 'ASSET',
    category: 'Furniture',
    storageAreas: ['Bar'],
    units: { recipeUnit: 'piece', buyUnit: 'piece', conversion: 1 },
    parLevel: 20,
    currentStock: 24,
    theoreticalStock: 24,
    costPerUnit: 3500,
    isActive: true
  },
  // Different Business Unit
  {
    businessUnitId: 'bu-2',
    name: 'Absolut Vodka',
    type: 'RAW_MATERIAL',
    category: 'Spirits',
    storageAreas: ['Bar'],
    units: { recipeUnit: 'bottle', buyUnit: 'case', conversion: 12 },
    parLevel: 8,
    currentStock: 10,
    theoreticalStock: 10,
    costPerUnit: 950,
    isActive: true
  }
];
