import { Timestamp } from 'firebase/firestore';

// ============================================================
// MENU ITEM CATEGORIES
// ============================================================

export type MenuCategory =
    | 'Appetizers'
    | 'Mains'
    | 'Desserts'
    | 'Beverages'
    | 'Cocktails'
    | 'Sides'
    | 'Specials'
    | 'Other';

// ============================================================
// UNIT CONVERSION DEFINITIONS
// ============================================================

// Standard unit conversions for recipes
export interface UnitConversionMap {
    [fromUnit: string]: {
        [toUnit: string]: number;
    };
}

// Common conversions used in recipes
export const UNIT_CONVERSIONS: UnitConversionMap = {
    // Volume conversions
    'bottle': {
        'ml': 750,      // Standard 750ml bottle
        'shot': 25,     // 30ml shots per bottle
        'oz': 25.36,    // Fluid ounces
        'liter': 0.75,
    },
    'liter': {
        'ml': 1000,
        'shot': 33.33,
        'oz': 33.81,
        'bottle': 1.33,
    },
    'ml': {
        'liter': 0.001,
        'shot': 0.0333,
        'oz': 0.0338,
    },
    'shot': {
        'ml': 30,
        'oz': 1.01,
    },
    // Weight conversions
    'kg': {
        'g': 1000,
        'lb': 2.205,
        'oz': 35.27,
    },
    'g': {
        'kg': 0.001,
        'oz': 0.0353,
    },
    // Count conversions (piece-based)
    'piece': {
        'unit': 1,
    },
    'unit': {
        'piece': 1,
    },
};

// ============================================================
// RECIPE INGREDIENT
// ============================================================

export interface RecipeIngredient {
    inventoryItemId: string;
    inventoryItemName: string;      // Denormalized for display
    quantity: number;               // Amount in recipe unit
    unit: string;                   // Recipe unit (ml, g, shots, etc.)
    baseQuantity: number;           // Converted to inventory base unit
    costPerBaseUnit: number;        // Cost from inventory (per base unit)
    totalCost: number;              // Calculated: baseQuantity × costPerBaseUnit
    wastagePercent?: number;        // Expected prep-loss as percentage (0–100). e.g. 10 means 10% of ingredient is wasted. Audit/cost tracking only — does NOT change stock.
}

// ============================================================
// MENU ITEM
// ============================================================

export interface MenuItem {
    id: string;
    businessUnitId: string;
    name: string;
    category: MenuCategory;
    description?: string;
    sellingPrice: number;
    ingredients: RecipeIngredient[];
    calculatedCost: number;         // Sum of ingredient totalCost
    grossMargin: number;            // sellingPrice - calculatedCost
    marginPercent: number;          // (grossMargin / sellingPrice) × 100
    foodCostPercent: number;        // (calculatedCost / sellingPrice) × 100
    imageUrl?: string;
    linkedInventoryItemId?: string; // Link to FINISHED_GOOD in inventory
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ============================================================
// PRODUCTION RECIPE (for intermediate products)
// ============================================================

export type ProductionCategory =
    | 'Syrups'
    | 'Mixes'
    | 'Sauces'
    | 'Prep Items'
    | 'Bases'
    | 'Other';

export const PRODUCTION_CATEGORIES: ProductionCategory[] = [
    'Syrups',
    'Mixes',
    'Sauces',
    'Prep Items',
    'Bases',
    'Other'
];

export interface ProductionRecipe {
    id: string;
    businessUnitId: string;
    name: string;
    category: ProductionCategory;
    description?: string;
    yieldQuantity: number;          // How much this recipe produces
    yieldUnit: string;              // Unit of production (ml, kg, servings, etc.)
    ingredients: RecipeIngredient[]; // Uses RAW_MATERIAL items
    calculatedCost: number;         // Sum of ingredient costs
    costPerUnit: number;            // calculatedCost / yieldQuantity
    linkedInventoryItemId?: string; // Link to PRODUCTION item in inventory
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface CreateProductionRecipeInput {
    businessUnitId: string;
    name: string;
    category: ProductionCategory;
    description?: string;
    yieldQuantity: number;
    yieldUnit: string;
    ingredients: Omit<RecipeIngredient, 'totalCost'>[];
}

// Type to represent a production recipe as an ingredient in finished goods
export interface ProductionRecipeIngredient {
    productionRecipeId: string;
    productionRecipeName: string;   // Denormalized for display
    quantity: number;               // Amount used
    unit: string;                   // Unit used
    costPerUnit: number;            // Cost from production recipe
    totalCost: number;              // Calculated: quantity × costPerUnit
}

// ============================================================
// INPUT TYPES
// ============================================================

export interface CreateMenuItemInput {
    businessUnitId: string;
    name: string;
    category: MenuCategory;
    description?: string;
    sellingPrice: number;
    ingredients: Omit<RecipeIngredient, 'totalCost'>[];
    imageUrl?: string;
}

export interface RecipeIngredientInput {
    inventoryItemId: string;
    quantity: number;
    unit: string;
}

// ============================================================
// MARGIN THRESHOLDS
// ============================================================

export const FOOD_COST_THRESHOLDS = {
    EXCELLENT: 25,      // Green - Excellent margin
    GOOD: 30,           // Green - Good margin
    WARNING: 35,        // Yellow - Warning
    DANGER: 40,         // Red - Too high
} as const;

export function getFoodCostStatus(foodCostPercent: number): 'excellent' | 'good' | 'warning' | 'danger' {
    if (foodCostPercent <= FOOD_COST_THRESHOLDS.EXCELLENT) return 'excellent';
    if (foodCostPercent <= FOOD_COST_THRESHOLDS.GOOD) return 'good';
    if (foodCostPercent <= FOOD_COST_THRESHOLDS.WARNING) return 'warning';
    return 'danger';
}

export function getFoodCostColor(status: 'excellent' | 'good' | 'warning' | 'danger'): string {
    switch (status) {
        case 'excellent': return 'text-emerald-400';
        case 'good': return 'text-green-400';
        case 'warning': return 'text-amber-400';
        case 'danger': return 'text-red-400';
    }
}

export function getFoodCostBgColor(status: 'excellent' | 'good' | 'warning' | 'danger'): string {
    switch (status) {
        case 'excellent': return 'bg-emerald-500/20 border-emerald-500/50';
        case 'good': return 'bg-green-500/20 border-green-500/50';
        case 'warning': return 'bg-amber-500/20 border-amber-500/50';
        case 'danger': return 'bg-red-500/20 border-red-500/50';
    }
}

// ============================================================
// MOCK MENU CATEGORIES
// ============================================================

export const MENU_CATEGORIES: MenuCategory[] = [
    'Appetizers',
    'Mains',
    'Desserts',
    'Beverages',
    'Cocktails',
    'Sides',
    'Specials',
    'Other'
];
