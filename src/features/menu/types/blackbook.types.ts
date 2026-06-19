import { Timestamp } from 'firebase/firestore';
import type { RecipeIngredient } from './menu.types';

// ============================================================
// DIGITAL BLACK BOOK TYPES
// ============================================================

export type BlackBookApprovalStatus = 'Approved' | 'Pending' | 'Draft' | 'Archived';

export type PrepStation =
    | 'Breakfast Station'
    | 'Hot Kitchen'
    | 'Cold Kitchen'
    | 'Dessert Station'
    | 'Cafe Bar'
    | 'Bar Station'
    | 'Prep Station'
    | 'Other';

export const PREP_STATIONS: PrepStation[] = [
    'Breakfast Station',
    'Hot Kitchen',
    'Cold Kitchen',
    'Dessert Station',
    'Cafe Bar',
    'Bar Station',
    'Prep Station',
    'Other'
];

// Extended ingredient with Black Book-specific fields
export interface BlackBookIngredient extends RecipeIngredient {
    specStandard: string;       // e.g. "2 mm slice, chilled, no excess tendons"
    allowedSubstitute: string;  // e.g. "Beef tapa cut, owner-approved supplier"
}

// Step-by-step method instruction
export interface MethodStep {
    stepNumber: number;
    instruction: string;
}

// Common mistake + fix entry
export interface MistakeFix {
    mistake: string;
    howToPrevent: string;
    managerCheck: string;
}

// Quality checklist item
export interface QualityCheckItem {
    id: string;
    label: string;
    checked: boolean;
}

// Version log entry
export interface VersionLog {
    version: string;            // e.g. "v1.8"
    status: BlackBookApprovalStatus;
    date: string;               // ISO date string
    description: string;
    approvedBy?: string;
}

// Main Black Book Recipe document
export interface BlackBookRecipe {
    id: string;
    businessUnitId: string;
    // Core identification
    recipeId: string;               // Human-readable ID like "BB-BF-001"
    name: string;                   // Recipe title
    prepStation: PrepStation;
    // Links to existing data
    productionRecipeId?: string;    // FK to productionRecipes collection
    menuItemId?: string;            // FK to menu_items collection
    // Status & versioning
    version: string;                // Current version e.g. "v1.8"
    approvalStatus: BlackBookApprovalStatus;
    isLocked: boolean;              // If true, prevents edits
    lastApprovedDate?: string;      // ISO date string
    lastApprovedBy?: string;        // User name
    // Metrics
    batchYield: string;             // e.g. "20 servings / 2.4 kg cooked tapa"
    cookTempTime: string;           // e.g. "Medium-high heat · 4-5 min per batch"
    costPerServing: string;         // e.g. "₱86.40 target food cost"
    // Recipe details
    ingredients: BlackBookIngredient[];
    methodSteps: MethodStep[];
    // Media
    platingPhotoUrl?: string;
    trainingVideoUrl?: string;      // Google Drive sharing link (raw input)
    youtubeVideoUrl?: string;       // YouTube link
    // Quality controls
    mistakesFixes: MistakeFix[];
    qualityChecklist: QualityCheckItem[];
    // Versioning
    versionHistory: VersionLog[];
    // Timestamps
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Input type for creating a new Black Book recipe
export interface CreateBlackBookRecipeInput {
    businessUnitId: string;
    name: string;
    prepStation: PrepStation;
    productionRecipeId?: string;
    menuItemId?: string;
    batchYield: string;
    cookTempTime: string;
    costPerServing: string;
    ingredients: BlackBookIngredient[];
    methodSteps: MethodStep[];
    platingPhotoUrl?: string;
    trainingVideoUrl?: string;
    youtubeVideoUrl?: string;
    mistakesFixes: MistakeFix[];
    qualityChecklist: QualityCheckItem[];
}
