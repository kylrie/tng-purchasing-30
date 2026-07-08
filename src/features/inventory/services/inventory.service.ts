import { FirestoreService, Timestamp, where } from '../../../shared/services/firestore.service';
import { ActivityLogService } from '../../../shared/services/activityLog.service';
import { writeBatch, doc, collection, runTransaction } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { getTenantConstraints } from '../../../shared/utils/tenantFilters';
import type { User } from '../../procurement/types';

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
    ReceiveGoodsPayload,
    ProductionBatchInput,
    ProductionBatchResult,
    GoodsReceivingLog,
    GoodsReceivingLogItem,
    StocktakeAuditLog
} from '../types/InventoryItem';
import { MOCK_INVENTORY_ITEMS, MOCK_STORAGE_AREAS } from '../types/InventoryItem';

// Collection names
const COLLECTIONS = {
    INVENTORY_ITEMS: 'inventory_items',
    STOCK_COUNTS: 'stock_counts',
    STORAGE_AREAS: 'storage_areas',
    GOODS_RECEIVING_LOGS: 'goods_receiving_logs',
    STOCKTAKE_AUDIT_LOGS: 'stocktake_audit_logs'
} as const;

/** Optional metadata for receiving sessions (PRF link, input method, etc.) */
export interface ReceivingMeta {
    prfId?: string;
    prfIdentifier?: string;
    supplierName?: string;
    documentType?: string;
    inputMethod?: 'upload' | 'camera' | 'manual';
}

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
            throw error;
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
            throw error;
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
     * Batch update multiple inventory items (fastest, skips recipe recalculation)
     */
    static async batchUpdateInventoryItems(updates: { id: string; data: Partial<InventoryItem> }[]): Promise<void> {
        return FirestoreService.batchUpdateDocuments(COLLECTIONS.INVENTORY_ITEMS, updates);
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

                // Run both recalculations in parallel — they are independent
                await Promise.all([
                    ProductionRecipeService.recalculateCosts(businessUnitId),
                    RecipesService.recalculateAllCosts(businessUnitId),
                ]);

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

            // Sanitize all fields — Firestore rejects undefined values
            const countItem: StockCountItem = {
                itemId: input.itemId,
                itemName: input.itemName ?? '',
                count: typeof input.count === 'number' && !isNaN(input.count) ? input.count : 0,
                unit: input.unit ?? '',
                partialCount: typeof input.partialCount === 'number' && !isNaN(input.partialCount) ? input.partialCount : 0,
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
     * Submit session - Update stock levels and write per-item audit logs
     */
    static async submitSession(sessionId: string, sessionName?: string): Promise<void> {
        try {
            const session = await FirestoreService.getDocument<StockCountSession>(
                COLLECTIONS.STOCK_COUNTS,
                sessionId
            );

            if (!session) {
                throw new Error('Session not found');
            }

            const now = Timestamp.now();
            const auditLogs: Omit<StocktakeAuditLog, 'id'>[] = [];
            const inventoryUpdates: { id: string; data: Partial<InventoryItem> }[] = [];

            // Update inventory stock levels and collect audit data
            for (const countItem of session.items) {
                const itemDoc = await FirestoreService.getDocument<InventoryItem>(
                    COLLECTIONS.INVENTORY_ITEMS,
                    countItem.itemId
                );

                if (!itemDoc) continue;

                const conversion = itemDoc.units.conversion > 0 ? itemDoc.units.conversion : 1;
                const stockBefore = itemDoc.currentStock ?? 0;
                const newStock = (countItem.count + countItem.partialCount) * conversion;

                inventoryUpdates.push({
                    id: countItem.itemId,
                    data: { currentStock: newStock }
                });

                // Build audit log entry for this item
                auditLogs.push({
                    sessionId,
                    businessUnitId: session.businessUnitId,
                    itemId: itemDoc.id,
                    itemName: itemDoc.name,
                    itemType: itemDoc.type,
                    stockBefore,
                    stockAfter: newStock,
                    variance: newStock - stockBefore,
                    unit: itemDoc.units?.recipeUnit || '',
                    countedBy: session.performedBy,
                    countedByName: session.performedByName ?? 'Unknown',
                    submittedAt: now
                });
            }

            // Batch update inventory items
            try {
                const BATCH_SIZE = 400; // Firebase limit is 500
                for (let i = 0; i < inventoryUpdates.length; i += BATCH_SIZE) {
                    const chunk = inventoryUpdates.slice(i, i + BATCH_SIZE);
                    await FirestoreService.batchUpdateDocuments(COLLECTIONS.INVENTORY_ITEMS, chunk);
                }
            } catch (invErr) {
                console.error('[InventoryService] Failed to batch update inventory items:', invErr);
                throw invErr;
            }

            // Write all audit logs using batches to avoid Firebase concurrent connection limits
            try {
                const BATCH_SIZE = 400; // Firebase limit is 500
                for (let i = 0; i < auditLogs.length; i += BATCH_SIZE) {
                    const chunk = auditLogs.slice(i, i + BATCH_SIZE);
                    await FirestoreService.batchCreateDocuments(COLLECTIONS.STOCKTAKE_AUDIT_LOGS, chunk);
                }
            } catch (logErr) {
                console.error('[InventoryService] Failed to write stocktake audit logs:', logErr);
                // Non-critical — don't fail the submit if logging fails
            }

            // Mark session as completed (include name if provided)
            const updateData: Record<string, unknown> = {
                status: 'COMPLETED' as StockCountStatus,
                completedAt: now
            };
            if (sessionName) {
                updateData.name = sessionName;
            }
            await FirestoreService.updateDocument(COLLECTIONS.STOCK_COUNTS, sessionId, updateData);
        } catch (error) {
            console.error('Error submitting session:', error);
            throw error;
        }
    }

    /**
     * Fetch stocktake audit logs for a business unit, sorted newest first
     */
    static async getStocktakeAuditLogs(
        businessUnitId: string
    ): Promise<StocktakeAuditLog[]> {
        try {
            const logs = await FirestoreService.getDocuments<StocktakeAuditLog>(
                COLLECTIONS.STOCKTAKE_AUDIT_LOGS,
                businessUnitId === 'ALL'
                    ? []
                    : [where('businessUnitId', '==', businessUnitId)]
            );
            // Sort client-side: newest first
            return logs.sort((a, b) =>
                (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0)
            );
        } catch (error) {
            console.error('[InventoryService] Error fetching stocktake audit logs:', error);
            return [];
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
     *
     * @param periodStart  - Start of the reporting period
     * @param periodEnd    - End of the reporting period
     * @param beginningInventoryValue - Total inventory value at periodStart
     *        (source from a recon_history snapshot for the start of the period)
     * @param purchasesValue - Total value of goods received during the period
     */
    static async calculateCOGS(
        periodStart: Date,
        periodEnd: Date,
        beginningInventoryValue: number,
        purchasesValue: number = 0
    ): Promise<COGSReport> {
        try {
            // Get current inventory value (excluding assets)
            const items = await this.getInventoryItems();
            const consumableItems = items.filter(i => i.type !== 'ASSET');

            const endingInventoryValue = consumableItems.reduce((sum, item) =>
                sum + (item.currentStock * item.costPerUnit), 0
            );

            // COGS = Beginning Inventory + Purchases − Ending Inventory
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
        referenceId: string = '',
        receivingMeta?: ReceivingMeta
    ): Promise<void> {
        if (!receivedItems.length) return;

        const now = Timestamp.now();
        const logItems: GoodsReceivingLogItem[] = [];
        
        // Group items to prevent duplicate reads/writes if the same item is scanned twice
        const uniqueItemsMap = new Map<string, ReceiveGoodsPayload>();
        receivedItems.forEach(item => {
            if (uniqueItemsMap.has(item.inventoryItemId)) {
                uniqueItemsMap.get(item.inventoryItemId)!.qtyReceived += item.qtyReceived;
            } else {
                uniqueItemsMap.set(item.inventoryItemId, { ...item });
            }
        });

        await runTransaction(db, async (transaction) => {
            const itemRefs = Array.from(uniqueItemsMap.keys()).map(id => doc(db, COLLECTIONS.INVENTORY_ITEMS, id));
            
            // 1. READ PHASE: Read all items within the transaction lock
            const itemDocs = await Promise.all(itemRefs.map(ref => transaction.get(ref)));
            const inventoryDataMap = new Map<string, InventoryItem>();
            
            itemDocs.forEach(docSnap => {
                if (docSnap.exists()) {
                    inventoryDataMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as InventoryItem);
                }
            });

            // 2. WRITE PHASE
            for (const [itemId, received] of uniqueItemsMap.entries()) {
                const inventoryItem = inventoryDataMap.get(itemId);
                if (!inventoryItem) continue;

                // Safe division check
                const conversion = inventoryItem.units.conversion > 0 ? inventoryItem.units.conversion : 1;
                const baseQtyToAdd = received.qtyReceived * conversion;
                const oldStock = inventoryItem.currentStock || 0;
                
                const newCurrentStock = oldStock + baseQtyToAdd;
                const newTheoreticalStock = (inventoryItem.theoreticalStock || 0) + baseQtyToAdd;

                const updateData: Partial<InventoryItem> & { updatedAt: Timestamp } = {
                    currentStock: newCurrentStock,
                    theoreticalStock: newTheoreticalStock,
                    updatedAt: now
                };

                // Process Cost Updates using Weighted Average Cost (WAC)
                if (received.unitPrice > 0 && received.unitPrice !== inventoryItem.buyCost) {
                    const oldTotalValue = oldStock * (inventoryItem.buyCost || 0);
                    const newTotalValue = received.qtyReceived * received.unitPrice;
                    const totalQty = oldStock + received.qtyReceived; // In buy units
                    
                    // Calculate WAC
                    const newBuyCost = totalQty > 0 ? (oldTotalValue + newTotalValue) / totalQty : received.unitPrice;

                    updateData.buyCost = newBuyCost;
                    const newBaseCost = newBuyCost / conversion;
                    updateData.baseCost = newBaseCost;
                    updateData.costPerUnit = newBaseCost; 
                }

                const itemRef = doc(db, COLLECTIONS.INVENTORY_ITEMS, itemId);
                transaction.update(itemRef, updateData);

                // Create Stock Transaction Log IN THE SAME TRANSACTION
                const transactionRef = doc(collection(db, 'stock_transactions'));
                transaction.set(transactionRef, {
                    id: transactionRef.id,
                    itemId: inventoryItem.id,
                    itemName: inventoryItem.name,
                    businessUnitId,
                    type: 'RECEIVE',
                    quantity: baseQtyToAdd,
                    balanceAfter: newCurrentStock,
                    referenceId: referenceId || 'MANUAL_RECEIVE',
                    notes: `Received ${received.qtyReceived} ${inventoryItem.units.buyUnit}(s) via receiving module.`,
                    performedBy: performedBy.id,
                    performedByName: performedBy.name,
                    timestamp: now
                });

                // Clean floating point math for log
                const safeTotalPrice = Math.round((received.qtyReceived * received.unitPrice) * 100) / 100;
                logItems.push({
                    inventoryItemId: inventoryItem.id,
                    inventoryItemName: inventoryItem.name,
                    qtyReceived: received.qtyReceived,
                    buyUnit: inventoryItem.units.buyUnit || 'EA',
                    unitPrice: received.unitPrice,
                    totalPrice: safeTotalPrice
                });
            }

            // Save receiving log IN THE SAME TRANSACTION
            if (logItems.length > 0) {
                const receivingLogRef = doc(collection(db, COLLECTIONS.GOODS_RECEIVING_LOGS));
                transaction.set(receivingLogRef, {
                    id: receivingLogRef.id,
                    businessUnitId,
                    prfId: receivingMeta?.prfId || null,
                    prfIdentifier: receivingMeta?.prfIdentifier || null,
                    referenceNumber: referenceId || '',
                    documentType: receivingMeta?.documentType || 'receipt',
                    supplierName: receivingMeta?.supplierName || 'Unknown',
                    inputMethod: receivingMeta?.inputMethod || 'manual',
                    items: logItems,
                    totalItems: logItems.length,
                    totalValue: logItems.reduce((sum, i) => sum + i.totalPrice, 0),
                    receivedBy: performedBy.id,
                    receivedByName: performedBy.name,
                    receivedAt: now
                });
            }
        });

        // Activity log — fire and forget
        ActivityLogService.log(
            'Goods Receiving',
            'Goods Received',
            `${receivedItems.length} item(s) received${referenceId ? ' (Ref: ' + referenceId + ')' : ''}`,
            performedBy,
            businessUnitId,
            { entityId: referenceId || undefined, entityType: 'Goods Receiving', severity: 'success' }
        );
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

    // ============================================================
    // PRODUCTION BATCH
    // Consumes raw-material ingredients, increases PRODUCTION item
    // stock, and creates wastage_records for prep waste — all atomic.
    // ============================================================

    /**
     * Produce one or more batches of a PRODUCTION item.
     *
     * For each BOM ingredient the service will:
     *  1. Deduct (quantityUsed × multiplier) from the raw-material's currentStock
     *  2. If the ingredient has a wastagePercent, create a wastage_record for that
     *     portion (the "edible" portion is already accounted for in the deduction
     *     because the full quantityUsed was subtracted — the wastage record is purely
     *     an audit / cost-tracking entry).
     *  3. Add the batch yield (production item's buyUnit × multiplier) to the
     *     PRODUCTION item's currentStock.
     *
     * Everything is committed in a single writeBatch.
     */
    static async produceProductionBatch(
        input: ProductionBatchInput
    ): Promise<ProductionBatchResult> {
        const { businessUnitId, productionItemId, batchMultiplier, performedBy, notes } = input;

        if (batchMultiplier <= 0) throw new Error('Batch multiplier must be greater than 0.');

        // 1. Load all items for this BU
        const allItems = await InventoryService.getInventory(businessUnitId);
        const productionItem = allItems.find(i => i.id === productionItemId);

        if (!productionItem) throw new Error(`Production item ${productionItemId} not found.`);
        if (productionItem.type !== 'PRODUCTION') {
            throw new Error(`Item "${productionItem.name}" is not a PRODUCTION item.`);
        }
        if (!productionItem.recipe || productionItem.recipe.length === 0) {
            throw new Error(`"${productionItem.name}" has no recipe defined. Please add ingredients first.`);
        }

        const now = Timestamp.now();
        const batch = writeBatch(db);

        const ingredientsConsumed: ProductionBatchResult['ingredientsConsumed'] = [];
        const wastageRecorded: ProductionBatchResult['wastageRecorded'] = [];
        let totalWastageCost = 0;

        // 2. Process each BOM ingredient
        for (const ing of productionItem.recipe) {
            const rawItem = allItems.find(i => i.id === ing.ingredientId);
            if (!rawItem) {
                throw new Error(
                    `Ingredient "${ing.ingredientName}" (${ing.ingredientId}) not found in inventory.`
                );
            }

            const totalConsumed = ing.quantityUsed * batchMultiplier;

            if (rawItem.currentStock < totalConsumed) {
                throw new Error(
                    `Insufficient stock for "${rawItem.name}". ` +
                    `Need ${totalConsumed} ${ing.unit}, have ${rawItem.currentStock} ${rawItem.units.recipeUnit}.`
                );
            }

            // 2a. Deduct full consumed quantity from raw material
            const rawItemRef = doc(db, 'inventory_items', rawItem.id);
            const rawNewStock = rawItem.currentStock - totalConsumed;
            batch.update(rawItemRef, { currentStock: rawNewStock, theoreticalStock: rawNewStock, updatedAt: now });

            // 2b. Stock transaction audit for the deduction
            const deductTxnId = doc(collection(db, 'stock_transactions')).id;
            batch.set(doc(db, 'stock_transactions', deductTxnId), {
                id: deductTxnId,
                itemId: rawItem.id,
                itemName: rawItem.name,
                businessUnitId,
                type: 'PRODUCTION_CONSUMPTION',
                quantity: -totalConsumed,
                balanceAfter: rawNewStock,
                referenceId: productionItemId,
                notes: `Consumed for ${batchMultiplier}× batch of "${productionItem.name}"${notes ? ': ' + notes : ''}`,
                performedBy: performedBy.id,
                performedByName: performedBy.name,
                timestamp: now
            });

            ingredientsConsumed.push({ name: rawItem.name, qty: totalConsumed, unit: ing.unit });

            // 2c. If there's a wastage percent, create a wastage_record
            if (ing.wastagePercent && ing.wastagePercent > 0) {
                const wasteQty = parseFloat(
                    (totalConsumed * (ing.wastagePercent / 100)).toFixed(4)
                );
                if (wasteQty > 0) {
                    const costPerUnit = rawItem.baseCost ?? rawItem.costPerUnit ?? 0;
                    const wastageCost = wasteQty * costPerUnit;
                    totalWastageCost += wastageCost;

                    const wastageId = doc(collection(db, 'wastage_records')).id;
                    batch.set(doc(db, 'wastage_records', wastageId), {
                        id: wastageId,
                        businessUnitId,
                        itemId: rawItem.id,
                        itemName: rawItem.name,
                        itemType: rawItem.type,
                        quantity: wasteQty,
                        unit: ing.unit,
                        reason: 'Production Batch',
                        notes: `Auto-generated prep waste for ${batchMultiplier}× batch of "${productionItem.name}" (${ing.wastagePercent}% wastage)`,
                        costPerUnit,
                        totalCost: wastageCost,
                        // balanceAfter already reflects the full deduction — waste is a sub-portion
                        balanceAfter: rawNewStock,
                        performedBy: performedBy.id,
                        performedByName: performedBy.name,
                        createdAt: now
                    });

                    wastageRecorded.push({
                        name: rawItem.name,
                        qty: wasteQty,
                        unit: ing.unit,
                        cost: wastageCost
                    });
                }
            }
        }

        // 3. Increase PRODUCTION item stock by (buyUnit × multiplier)
        //    Each "batch" = 1 buyUnit worth of output (e.g. 1 batch = 5 litres)
        const outputAdded = productionItem.units.conversion * batchMultiplier;
        const prodNewStock = productionItem.currentStock + outputAdded;
        const prodItemRef = doc(db, 'inventory_items', productionItem.id);
        batch.update(prodItemRef, { currentStock: prodNewStock, theoreticalStock: prodNewStock, updatedAt: now });

        // 3a. Stock transaction for the production output
        const prodTxnId = doc(collection(db, 'stock_transactions')).id;
        batch.set(doc(db, 'stock_transactions', prodTxnId), {
            id: prodTxnId,
            itemId: productionItem.id,
            itemName: productionItem.name,
            businessUnitId,
            type: 'PRODUCTION_OUTPUT',
            quantity: outputAdded,
            balanceAfter: prodNewStock,
            referenceId: productionItemId,
            notes: `${batchMultiplier}× batch produced${notes ? ': ' + notes : ''}`,
            performedBy: performedBy.id,
            performedByName: performedBy.name,
            timestamp: now
        });

        // 4. Commit everything atomically
        await batch.commit();

        // Activity log — fire and forget
        ActivityLogService.log(
            'Inventory',
            'Production Batch',
            `${batchMultiplier}× batch of "${productionItem.name}" produced`,
            performedBy,
            businessUnitId,
            { entityId: productionItemId, entityType: 'Inventory Item', severity: 'success' }
        );

        console.log(
            `[InventoryService] Produced ${batchMultiplier}× batch of "${productionItem.name}". ` +
            `Output: +${outputAdded} ${productionItem.units.recipeUnit}. ` +
            `Wastage cost: ₱${totalWastageCost.toFixed(2)}`
        );

        return {
            productionItem: productionItem.name,
            batchesProduced: batchMultiplier,
            outputAdded,
            ingredientsConsumed,
            wastageRecorded,
            totalWastageCost
        };
    }
    // ============================================================
    // GOODS RECEIVING LOGS
    // ============================================================

    /**
     * Save a receiving session log to Firestore
     */
    static async saveReceivingLog(
        logData: Omit<GoodsReceivingLog, 'id'>
    ): Promise<string> {
        const logId = doc(collection(db, COLLECTIONS.GOODS_RECEIVING_LOGS)).id;
        const logRef = doc(db, COLLECTIONS.GOODS_RECEIVING_LOGS, logId);

        const fullLog: GoodsReceivingLog = {
            id: logId,
            ...logData
        };

        const { writeBatch: wb } = await import('firebase/firestore');
        const singleBatch = wb(db);
        singleBatch.set(logRef, fullLog);
        await singleBatch.commit();

        console.log(`[InventoryService] Saved receiving log ${logId} (${logData.totalItems} items, ₱${logData.totalValue.toFixed(2)})`);
        return logId;
    }

    /**
     * Get receiving logs for a business unit, ordered by date descending
     */
    static async getReceivingLogs(
        businessUnitId: string
    ): Promise<GoodsReceivingLog[]> {
        try {
            const logs = await FirestoreService.getDocuments<GoodsReceivingLog>(
                COLLECTIONS.GOODS_RECEIVING_LOGS,
                [where('businessUnitId', '==', businessUnitId)]
            );
            // Sort by receivedAt descending (newest first)
            return logs.sort((a, b) => {
                const aTime = a.receivedAt?.toMillis?.() || 0;
                const bTime = b.receivedAt?.toMillis?.() || 0;
                return bTime - aTime;
            });
        } catch (error) {
            console.error('[InventoryService] Error fetching receiving logs:', error);
            return [];
        }
    }
}

export default InventoryService;
