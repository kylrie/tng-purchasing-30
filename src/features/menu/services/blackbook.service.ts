import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type {
    BlackBookRecipe,
    CreateBlackBookRecipeInput,
    BlackBookApprovalStatus,
    VersionLog
} from '../types/blackbook.types';

const COLLECTION = 'blackBookRecipes';

export class BlackBookService {
    /**
     * Get all Black Book recipes for a business unit
     */
    static async getRecipes(businessUnitId: string): Promise<BlackBookRecipe[]> {
        const recipesRef = collection(db, COLLECTION);
        const q = query(
            recipesRef,
            where('businessUnitId', '==', businessUnitId),
            orderBy('name', 'asc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as BlackBookRecipe[];
    }

    /**
     * Get a single Black Book recipe by ID
     */
    static async getRecipe(recipeId: string): Promise<BlackBookRecipe | null> {
        const docRef = doc(db, COLLECTION, recipeId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return {
            id: docSnap.id,
            ...docSnap.data()
        } as BlackBookRecipe;
    }

    /**
     * Create a new Black Book recipe
     */
    static async createRecipe(input: CreateBlackBookRecipeInput): Promise<BlackBookRecipe> {
        // Generate a human-readable recipe ID
        const stationPrefix = input.prepStation.substring(0, 2).toUpperCase();
        const timestamp = Date.now().toString(36).toUpperCase();
        const recipeId = `BB-${stationPrefix}-${timestamp}`;

        const now = Timestamp.now();

        const initialVersion: VersionLog = {
            version: 'v1.0',
            status: 'Draft',
            date: new Date().toISOString(),
            description: 'Initial creation'
        };

        const recipeData = {
            businessUnitId: input.businessUnitId,
            recipeId,
            name: input.name,
            prepStation: input.prepStation,
            productionRecipeId: input.productionRecipeId ?? null,
            menuItemId: input.menuItemId ?? null,
            version: 'v1.0',
            approvalStatus: 'Draft' as BlackBookApprovalStatus,
            isLocked: false,
            lastApprovedDate: null,
            lastApprovedBy: null,
            batchYield: input.batchYield,
            cookTempTime: input.cookTempTime,
            costPerServing: input.costPerServing,
            ingredients: input.ingredients,
            methodSteps: input.methodSteps,
            platingPhotoUrl: input.platingPhotoUrl ?? null,
            trainingVideoUrl: input.trainingVideoUrl ?? null,
            mistakesFixes: input.mistakesFixes,
            qualityChecklist: input.qualityChecklist,
            versionHistory: [initialVersion],
            youtubeVideoUrl: input.youtubeVideoUrl ?? null,
            createdAt: now,
            updatedAt: now
        };

        const docRef = await addDoc(collection(db, COLLECTION), recipeData);

        return {
            id: docRef.id,
            ...recipeData,
            lastApprovedDate: undefined,
            lastApprovedBy: undefined
        } as BlackBookRecipe;
    }

    /**
     * Update an existing Black Book recipe (creates a new version)
     */
    static async updateRecipe(
        id: string,
        updates: Partial<Omit<BlackBookRecipe, 'id' | 'createdAt'>>,
        versionDescription: string,
        updatedBy?: string
    ): Promise<void> {
        const docRef = doc(db, COLLECTION, id);
        const existing = await getDoc(docRef);
        if (!existing.exists()) throw new Error('Recipe not found');

        const data = existing.data() as BlackBookRecipe;

        // Parse current version and increment
        const currentVersionNum = parseFloat(data.version.replace('v', ''));
        const newVersion = `v${(currentVersionNum + 0.1).toFixed(1)}`;

        const versionEntry: VersionLog = {
            version: newVersion,
            status: 'Pending',
            date: new Date().toISOString(),
            description: versionDescription,
            approvedBy: updatedBy
        };

        await updateDoc(docRef, {
            ...updates,
            version: newVersion,
            approvalStatus: 'Pending',
            versionHistory: [...(data.versionHistory || []), versionEntry],
            updatedAt: Timestamp.now()
        });
    }

    /**
     * Approve a Black Book recipe version
     */
    static async approveRecipe(id: string, approvedBy: string): Promise<void> {
        const docRef = doc(db, COLLECTION, id);
        const existing = await getDoc(docRef);
        if (!existing.exists()) throw new Error('Recipe not found');

        const data = existing.data() as BlackBookRecipe;

        // Update the latest version entry to Approved
        const updatedHistory = [...(data.versionHistory || [])];
        if (updatedHistory.length > 0) {
            updatedHistory[updatedHistory.length - 1].status = 'Approved';
            updatedHistory[updatedHistory.length - 1].approvedBy = approvedBy;
        }

        await updateDoc(docRef, {
            approvalStatus: 'Approved',
            isLocked: true,
            lastApprovedDate: new Date().toISOString(),
            lastApprovedBy: approvedBy,
            versionHistory: updatedHistory,
            updatedAt: Timestamp.now()
        });
    }

    /**
     * Toggle lock status on a recipe
     */
    static async toggleLock(id: string, isLocked: boolean): Promise<void> {
        const docRef = doc(db, COLLECTION, id);
        await updateDoc(docRef, {
            isLocked,
            updatedAt: Timestamp.now()
        });
    }
}
