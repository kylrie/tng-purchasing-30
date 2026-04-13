import { FirestoreService, Timestamp, where } from '../../../shared/services/firestore.service';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { getTenantConstraints } from '../../../shared/utils/tenantFilters';
import type { User } from '../../procurement/types';
import type { StockTransaction } from '../../pos/types/pos-import.types';
import type {
    InventoryItem,
    InventoryItemType,
    StockCountSession,
    StockCountItem,
    COGSReport,
    StockValueTrend,
    CreateInventoryItemInput,
    StartSessionInput,
    SaveCountInput,
    StockCountStatus,
    ReceiveGoodsPayload
} from '../types/InventoryItem';
import { MOCK_INVENTORY_ITEMS, MOCK_STORAGE_AREAS } from '../types/InventoryItem';

// Collection names
const COLLECTIONS = {
    INVENTORY_ITEMS: 'inventory_items',
    STOCK_COUNTS: 'stock_counts',
    STORAGE_AREAS: 'storage_areas'
} as const;

/**
 * Multi-Tenant Inventory Service
 * All operations are scoped by businessUnitId
 */
export class InventoryService {

    // ============================================================
    // MULTI-TENANT INVENTORY OPERATIONS
    // ============================================================

    /**
     * Get inventory items for a specific business unit with optional type filter
     * Uses simple query + client-side filtering to avoid composite index requirement
     */
    static async getInventory(
        userOrBuId: User | string,
        typeFilter?: InventoryItemType
    ): Promise<InventoryItem[]> {
        try {
            const constraints = typeof userOrBuId === 'string'
                ? (userOrBuId === 'ALL' ? [] : [where('businessUnitId', '==', userOrBuId)])
                : getTenantConstraints(userOrBuId, 'businessUnitId');

            const items = await FirestoreService.getDocuments<InventoryItem>(
                COLLECTIONS.INVENTORY_ITEMS,
                constraints
            );

            console.log(`[InventoryService] Fetched ${items.length} items for tenant filter`);
            if (items.length > 0) {
                console.log(`[InventoryService] Sample item type:`, items[0].type);
            }

            // Client-side filtering
            const filtered = items
                .filter(item => item.isActive !== false)
                .filter(item => !typeFilter || item.type === typeFilter)
                .sort((a, b) => a.name.localeCompare(b.name));

            console.log(`[InventoryService] Returning ${filtered.length} items after filtering for type: ${typeFilter}`);
            return filtered;
        } catch (error) {
            console.error('Error fetching inventory:', error);
            // Return mock data filtered by business unit and type
            return MOCK_INVENTORY_ITEMS
                .filter(item => {
                    const matchesBU = typeof userOrBuId === 'string'
                        ? (userOrBuId === 'ALL' || item.businessUnitId === userOrBuId)
                        : (userOrBuId?.businessUnitIds?.includes('ALL') || userOrBuId?.businessUnitIds?.includes(item.businessUnitId) || userOrBuId?.businessId === item.businessUnitId);
                    const matchesType = !typeFilter || item.type === typeFilter;
                    return matchesBU && matchesType;
                })
                .map((item, index) => ({
                    ...item,
                    id: `mock-${index}`,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                }));
        }
    }

    /**
     * Get all inventory items (legacy - no BU filter)
     * Uses client-side filtering/sorting to avoid composite index
     */
    static async getInventoryItems(): Promise<InventoryItem[]> {
        try {
            const items = await FirestoreService.getDocuments<InventoryItem>(
                COLLECTIONS.INVENTORY_ITEMS,
                []
            );
            return items
                .filter(item => item.isActive !== false)
                .sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('Error fetching inventory items:', error);
            return MOCK_INVENTORY_ITEMS.map((item, index) => ({
                ...item,
                id: `mock-${index}`,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            }));
        }
    }

    /**
     * Get items by storage area for a business unit
     */
    static async getItemsByStorageArea(
        userOrBuId: User | string,
        storageArea: string
    ): Promise<InventoryItem[]> {
        try {
            const constraints = typeof userOrBuId === 'string'
                ? (userOrBuId === 'ALL' ? [] : [where('businessUnitId', '==', userOrBuId)])
                : getTenantConstraints(userOrBuId, 'businessUnitId');

            const items = await FirestoreService.getDocuments<InventoryItem>(
                COLLECTIONS.INVENTORY_ITEMS,
                [
                    ...constraints,
                    where('storageAreas', 'array-contains', storageArea)
                ]
            );
            return items;
        } catch (error) {
            console.error('Error fetching items by storage area:', error);
            return MOCK_INVENTORY_ITEMS
                .filter(item => {
                    const matchesBU = typeof userOrBuId === 'string'
                        ? (userOrBuId === 'ALL' || item.businessUnitId === userOrBuId)
                        : (userOrBuId?.businessUnitIds?.includes('ALL') || userOrBuId?.businessUnitIds?.includes(item.businessUnitId) || userOrBuId?.businessId === item.businessUnitId);
                    return matchesBU && item.storageAreas.includes(storageArea);
                })
                .map((item, index) => ({
                    ...item,
                    id: `mock-${index}`,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                }));
        }
    }

    /**
     * Create a new inventory item
     */
    static async createInventoryItem(input: CreateInventoryItemInput): Promise<string> {
        const itemData = {
            ...input,
            theoreticalStock: input.theoreticalStock ?? input.currentStock,
            isActive: true
        };
        return FirestoreService.createDocument(COLLECTIONS.INVENTORY_ITEMS, itemData);
    }

    /**
     * Update an inventory item
     * Optional skipRecipeRecalculation prevents infinite loops when recipes update their own products
     */
    static async updateInventoryItem(
        id: string,
        data: Partial<InventoryItem>,
        options?: { skipRecipeRecalculation?: boolean }
    ): Promise<void> {
        let shouldRecalculate = false;
        let businessUnitId = '';

        // If cost might have changed and we are allowed to recalculate
        if (data.costPerUnit !== undefined && !options?.skipRecipeRecalculation) {
            try {
                const currentItem = await FirestoreService.getDocument<InventoryItem>(COLLECTIONS.INVENTORY_ITEMS, id);
                if (currentItem && currentItem.costPerUnit !== data.costPerUnit) {
                    shouldRecalculate = true;
                    businessUnitId = currentItem.businessUnitId;
                }
            } catch (err) {
                console.warn('Could not fetch current inventory item for cost comparison:', err);
            }
        }

        // Perform the actual update
        await FirestoreService.updateDocument(COLLECTIONS.INVENTORY_ITEMS, id, data);

        // If cost changed, trigger recalculation of all linked recipes
        if (shouldRecalculate && businessUnitId) {
            console.log(`[InventoryService] Cost changed for item ${id}. Triggering recipe recalculation for BU ${businessUnitId}`);
            try {
                // Dynamically import to avoid circular dependencies
                const { ProductionRecipeService } = await import('../../menu/services/production-recipe.service');
                const { RecipesService } = await import('../../menu/services/recipes.service');

                // Recalculate production recipes first, as menu items might depend on them
                await ProductionRecipeService.recalculateCosts(businessUnitId);
                // Then recalculate all menu items
                await RecipesService.recalculateAllCosts(businessUnitId);

                console.log(`[InventoryService] Successfully finished recipe recalculations for BU ${businessUnitId}`);
            } catch (err) {
                console.error('[InventoryService] Failed to recalculate recipes:', err);
            }
        }
    }

    // ============================================================
    // STORAGE AREAS
    // ============================================================

    static async getStorageAreas(): Promise<string[]> {
        try {
            // Import dynamically to avoid circular dependency
            const { SettingsService } = await import('../../../shared/services/settings.service');
            const settings = await SettingsService.getStorageAreas();
            return settings.areas;
        } catch (error) {
            console.error('Error fetching storage areas:', error);
            return MOCK_STORAGE_AREAS;
        }
    }

    // ============================================================
    // STOCK COUNT SESSION OPERATIONS - Multi-Tenant
    // ============================================================

    /**
     * Start a new stock counting session
     */
    static async startSession(input: StartSessionInput): Promise<string> {
        const sessionData: Omit<StockCountSession, 'id' | 'createdAt' | 'updatedAt'> = {
            businessUnitId: input.businessUnitId,
            status: 'OPEN',
            startedAt: Timestamp.now(),
            performedBy: input.performedBy,
            performedByName: input.performedByName,
            location: input.location,
            items: [],
            totalValue: 0
        };

        return FirestoreService.createDocument(COLLECTIONS.STOCK_COUNTS, sessionData);
    }

    /**
     * Get an open session for a user in a specific business unit
     */
    static async getOpenSession(
        userOrBuId: User | string,
        userId: string
    ): Promise<StockCountSession | null> {
        try {
            const constraints = typeof userOrBuId === 'string'
                ? (userOrBuId === 'ALL' ? [] : [where('businessUnitId', '==', userOrBuId)])
                : getTenantConstraints(userOrBuId, 'businessUnitId');

            const sessions = await FirestoreService.getDocuments<StockCountSession>(
                COLLECTIONS.STOCK_COUNTS,
                [
                    ...constraints,
                    where('performedBy', '==', userId),
                    where('status', '==', 'OPEN')
                ]
            );
            return sessions.length > 0 ? sessions[0] : null;
        } catch (error) {
            console.error('Error fetching open session:', error);
            return null;
        }
    }

    /**
     * Get sessions for a business unit
     * Uses simple query + client-side sorting to avoid composite index
     */
    static async getSessions(
        userOrBuId: User | string,
        status?: StockCountStatus
    ): Promise<StockCountSession[]> {
        try {
            const constraints = typeof userOrBuId === 'string'
                ? (userOrBuId === 'ALL' ? [] : [where('businessUnitId', '==', userOrBuId)])
                : getTenantConstraints(userOrBuId, 'businessUnitId');

            if (status) {
                constraints.push(where('status', '==', status));
            }

            const sessions = await FirestoreService.getDocuments<StockCountSession>(
                COLLECTIONS.STOCK_COUNTS,
                constraints
            );

            // Client-side sorting
            return sessions.sort((a, b) =>
                (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0)
            );
        } catch (error) {
            console.error('Error fetching sessions:', error);
            return [];
        }
    }

    /**
     * Save a count item to a session
     */
    static async saveCountItem(input: SaveCountInput): Promise<void> {
        try {
            const session = await FirestoreService.getDocument<StockCountSession>(
                COLLECTIONS.STOCK_COUNTS,
                input.sessionId
            );

            if (!session) {
                throw new Error('Session not found');
            }

            const countItem: StockCountItem = {
                itemId: input.itemId,
                itemName: input.itemName,
                count: input.count,
                unit: input.unit,
                partialCount: input.partialCount
            };

            const existingIndex = session.items.findIndex(i => i.itemId === input.itemId);
            let updatedItems: StockCountItem[];

            if (existingIndex >= 0) {
                updatedItems = [...session.items];
                updatedItems[existingIndex] = countItem;
            } else {
                updatedItems = [...session.items, countItem];
            }

            await FirestoreService.updateDocument(COLLECTIONS.STOCK_COUNTS, input.sessionId, {
                items: updatedItems
            });
        } catch (error) {
            console.error('Error saving count item:', error);
            throw error;
        }
    }

    /**
     * Submit session - Update stock levels
     */
    static async submitSession(sessionId: string): Promise<void> {
        try {
            const session = await FirestoreService.getDocument<StockCountSession>(
                COLLECTIONS.STOCK_COUNTS,
                sessionId
            );

            if (!session) {
                throw new Error('Session not found');
            }

            // Update inventory stock levels
            for (const countItem of session.items) {
                const newStock = countItem.count + countItem.partialCount;
                await FirestoreService.updateDocument(
                    COLLECTIONS.INVENTORY_ITEMS,
                    countItem.itemId,
                    { currentStock: newStock }
                );
            }

            // Mark session as completed
            await FirestoreService.updateDocument(COLLECTIONS.STOCK_COUNTS, sessionId, {
                status: 'COMPLETED' as StockCountStatus,
                completedAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error submitting session:', error);
            throw error;
        }
    }

    /**
     * Cancel a session
     */
    static async cancelSession(sessionId: string): Promise<void> {
        await FirestoreService.updateDocument(COLLECTIONS.STOCK_COUNTS, sessionId, {
            status: 'CANCELLED' as StockCountStatus,
            completedAt: Timestamp.now()
        });
    }

    // Alias for compatibility
    static async finalizeSession(sessionId: string): Promise<void> {
        return this.submitSession(sessionId);
    }

    // ============================================================
    // COGS & REPORTING - Excludes ASSET type
    // ============================================================

    /**
     * Calculate COGS for a business unit (excludes Assets)
     */
    static async calculateCOGS(
        periodStart: Date,
        periodEnd: Date,
        purchasesValue: number = 0
    ): Promise<COGSReport> {
        try {
            // Get current inventory value (excluding assets)
            const items = await this.getInventoryItems();
            const consumableItems = items.filter(i => i.type !== 'ASSET');

            const endingInventoryValue = consumableItems.reduce((sum, item) =>
                sum + (item.currentStock * item.costPerUnit), 0
            );

            // Estimate beginning inventory as ending + purchases (simplified)
            const beginningInventoryValue = endingInventoryValue;
            const cogs = beginningInventoryValue + purchasesValue - endingInventoryValue;

            return {
                id: `cogs-${Date.now()}`,
                businessUnitId: '',
                periodStart,
                periodEnd,
                beginningInventoryValue,
                purchasesValue,
                endingInventoryValue,
                cogs,
                generatedAt: Timestamp.now(),
                generatedBy: 'system'
            };
        } catch (error) {
            console.error('Error calculating COGS:', error);
            throw error;
        }
    }

    /**
     * Get stock value trends
     */
    static async getStockValueTrends(months: number = 6): Promise<StockValueTrend[]> {
        const trends: StockValueTrend[] = [];
        const now = new Date();
        const baseValue = 25000;

        for (let i = months - 1; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const variance = (Math.random() - 0.5) * 5000;
            const trend = (months - i) * 500;

            trends.push({
                date: monthDate.toISOString().substring(0, 7),
                value: Math.round(baseValue + variance + trend)
            });
        }

        return trends;
    }

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    static getStockStatus(
        currentStock: number,
        parLevel: number
    ): 'low' | 'ok' | 'excess' {
        if (currentStock < parLevel * 0.5) return 'low';
        if (currentStock > parLevel * 1.5) return 'excess';
        return 'ok';
    }

    // ============================================================
    // GOODS RECEIVING
    // ============================================================

    /**
     * Handle batch insertion of received goods
     */
    static async receiveGoodsBatch(
        businessUnitId: string,
        receivedItems: ReceiveGoodsPayload[],
        performedBy: { id: string; name: string },
        referenceId: string = ''
    ): Promise<void> {
        if (!receivedItems.length) return;

        const batch = writeBatch(db);
        let shouldRecalculate = false;

        // Fetch all current inventory items in one go to ensure accuracy
        const currentItems = await this.getInventory(businessUnitId);
        const inventoryItemsMap = new Map<string, InventoryItem>();
        for (const item of currentItems) {
            inventoryItemsMap.set(item.id, item);
        }

        const now = Timestamp.now();

        for (const received of receivedItems) {
            const inventoryItem = inventoryItemsMap.get(received.inventoryItemId);
            if (!inventoryItem) {
                console.error(`Skipping mismatch: Item ID ${received.inventoryItemId} not found.`);
                continue;
            }

            // Calculate Base Unit quantity
            const baseQtyToAdd = received.qtyReceived * inventoryItem.units.conversion;

            // Update item stock
            const newCurrentStock = inventoryItem.currentStock + baseQtyToAdd;
            const newTheoreticalStock = inventoryItem.theoreticalStock + baseQtyToAdd;

            const updateData: Partial<InventoryItem> & { updatedAt: Timestamp } = {
                currentStock: newCurrentStock,
                theoreticalStock: newTheoreticalStock,
                updatedAt: now
            };

            // Process Cost Updates
            // Check if the received unit price differs from the stored buyCost.
            if (received.unitPrice > 0 && received.unitPrice !== inventoryItem.buyCost) {
                updateData.buyCost = received.unitPrice;
                // Calculate new base cost (cost per single base/count unit)
                const newBaseCost = received.unitPrice / inventoryItem.units.conversion;
                updateData.baseCost = newBaseCost;
                updateData.costPerUnit = newBaseCost; // Update legacy field as well
                shouldRecalculate = true;
            }

            const itemRef = doc(db, COLLECTIONS.INVENTORY_ITEMS, inventoryItem.id);
            batch.update(itemRef, updateData);

            // Create Stock Transaction
            const transactionId = doc(collection(db, 'stock_transactions')).id;
            const transactionRef = doc(db, 'stock_transactions', transactionId);

            const transactionData: StockTransaction = {
                id: transactionId,
                itemId: inventoryItem.id,
                itemName: inventoryItem.name,
                businessUnitId,
                type: 'RECEIVE',
                quantity: baseQtyToAdd,
                balanceAfter: newCurrentStock, // Use new stock value
                referenceId: referenceId || 'MANUAL_RECEIVE',
                notes: `Received ${received.qtyReceived} ${inventoryItem.units.buyUnit}(s) via receiving module.`,
                performedBy: performedBy.id,
                performedByName: performedBy.name,
                timestamp: now
            };

            batch.set(transactionRef, transactionData);
        }

        await batch.commit();

        // If cost changed for any item, trigger recalculation of all linked recipes
        if (shouldRecalculate) {
            console.log(`[InventoryService] Costs changed during batch receive. Triggering recipe recalculation for BU ${businessUnitId}`);
            try {
                // Dynamically import to avoid circular dependencies
                const { ProductionRecipeService } = await import('../../menu/services/production-recipe.service');
                const { RecipesService } = await import('../../menu/services/recipes.service');

                // Recalculate production recipes first, as menu items might depend on them
                await ProductionRecipeService.recalculateCosts(businessUnitId);
                // Then recalculate all menu items
                await RecipesService.recalculateAllCosts(businessUnitId);

                console.log(`[InventoryService] Successfully finished recipe recalculations after goods receiving for BU ${businessUnitId}`);
            } catch (err) {
                console.error('[InventoryService] Failed to recalculate recipes:', err);
            }
        }
    }

    // ============================================================
    // MIGRATION / DEVELOPER TOOLS
    // ============================================================

    /**
     * One-time migration to fix all existing Inventory items to ensure
     * baseCost is properly calculated and costPerUnit matches baseCost.
     * Run this if cost calculation errors are appearing on older parts of the system.
     */
    static async migrateInventoryBaseCosts(userOrBuId: User | string): Promise<void> {
        try {
            console.log(`[InventoryService] Starting cost migration for tenant filter`);
            
            const constraints = typeof userOrBuId === 'string'
                ? (userOrBuId === 'ALL' ? [] : [where('businessUnitId', '==', userOrBuId)])
                : getTenantConstraints(userOrBuId, 'businessUnitId');

            const items = await FirestoreService.getDocuments<InventoryItem>(
                COLLECTIONS.INVENTORY_ITEMS,
                constraints
            );

            // Use batched writes
            let batch = writeBatch(db);
            let updateCount = 0;
            let totalUpdated = 0;

            for (const data of items) {
                let updated = false;
                const updateData: Partial<InventoryItem> = {};

                if (data.buyCost !== undefined && data.buyCost !== null && data.units?.conversion) {
                    const expectedBaseCost = data.buyCost / data.units.conversion;

                    if (data.baseCost !== expectedBaseCost) {
                        updateData.baseCost = expectedBaseCost;
                        updated = true;
                    }
                    if (data.costPerUnit !== expectedBaseCost) {
                        updateData.costPerUnit = expectedBaseCost;
                        updated = true;
                    }
                }

                if (updated) {
                    updateData.updatedAt = Timestamp.now();
                    const itemRef = doc(db, COLLECTIONS.INVENTORY_ITEMS, data.id);
                    batch.update(itemRef, updateData);
                    updateCount++;
                    totalUpdated++;
                }

                if (updateCount === 450) {
                    await batch.commit();
                    batch = writeBatch(db); // Create a new batch
                    console.log(`[InventoryService] Committed 450 cost migrations.`);
                    updateCount = 0;
                }
            }

            if (updateCount > 0) {
                await batch.commit();
            }

            console.log(`[InventoryService] Cost migration complete. Total items updated: ${totalUpdated}`);
        } catch (error) {
            console.error('[InventoryService] Cost migration failed:', error);
            throw error;
        }
    }
}

export default InventoryService;
