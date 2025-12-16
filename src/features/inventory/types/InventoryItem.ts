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
  | 'Food'
  | 'Dry Goods'
  | 'Equipment'
  | 'Furniture'
  | 'Supplies'
  | 'Glassware'
  | 'Other';

// ============================================================
// UNIT CONVERSION TYPES - Wisk-style multi-unit handling
// ============================================================

export interface UnitConversion {
  countUnit: string;     // Default counting unit (e.g., "bottle", "piece")
  buyUnit: string;       // Purchasing unit (e.g., "case", "box")
  conversion: number;    // How many countUnits in a buyUnit
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
  parLevel: number;                  // Minimum stock level (in countUnits)
  currentStock: number;              // Current stock in countUnits
  costPerUnit: number;               // Cost per countUnit
  supplier?: string;
  notes?: string;
  menuItemId?: string;               // Link to menu item if FINISHED_GOOD from Menu Engineering
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
  costPerUnit: number;
  supplier?: string;
  notes?: string;
  menuItemId?: string;  // Link to menu item if this is a FINISHED_GOOD from Menu Engineering
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
    units: { countUnit: 'kg', buyUnit: 'sack', conversion: 25 },
    parLevel: 50,
    currentStock: 75,
    costPerUnit: 45,
    isActive: true
  },
  {
    businessUnitId: 'bu-1',
    name: 'Jameson Irish Whiskey',
    type: 'RAW_MATERIAL',
    category: 'Spirits',
    storageAreas: ['Bar', 'Storage Room'],
    units: { countUnit: 'bottle', buyUnit: 'case', conversion: 12 },
    parLevel: 6,
    currentStock: 8,
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
    units: { countUnit: 'liter', buyUnit: 'batch', conversion: 5 },
    parLevel: 10,
    currentStock: 15,
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
    units: { countUnit: 'bottle', buyUnit: 'case', conversion: 24 },
    parLevel: 48,
    currentStock: 72,
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
    units: { countUnit: 'unit', buyUnit: 'unit', conversion: 1 },
    parLevel: 2,
    currentStock: 3,
    costPerUnit: 15000,
    isActive: true
  },
  {
    businessUnitId: 'bu-1',
    name: 'Bar Stool',
    type: 'ASSET',
    category: 'Furniture',
    storageAreas: ['Bar'],
    units: { countUnit: 'piece', buyUnit: 'piece', conversion: 1 },
    parLevel: 20,
    currentStock: 24,
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
    units: { countUnit: 'bottle', buyUnit: 'case', conversion: 12 },
    parLevel: 8,
    currentStock: 10,
    costPerUnit: 950,
    isActive: true
  }
];
