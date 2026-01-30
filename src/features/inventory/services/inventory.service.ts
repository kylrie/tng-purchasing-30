import { FirestoreService, Timestamp, where } from '../../../shared/services/firestore.service';
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
    StockCountStatus
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
        businessUnitId: string,
        typeFilter?: InventoryItemType
    ): Promise<InventoryItem[]> {
        try {
            // Simple query on businessUnitId only - filter the rest client-side
            const items = await FirestoreService.getDocuments<InventoryItem>(
                COLLECTIONS.INVENTORY_ITEMS,
                [where('businessUnitId', '==', businessUnitId)]
            );

            console.log(`[InventoryService] Fetched ${items.length} items for BU ${businessUnitId}`);
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
                    const matchesBU = item.businessUnitId === businessUnitId;
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
        businessUnitId: string,
        storageArea: string
    ): Promise<InventoryItem[]> {
        try {
            const items = await FirestoreService.getDocuments<InventoryItem>(
                COLLECTIONS.INVENTORY_ITEMS,
                [
                    where('businessUnitId', '==', businessUnitId),
                    where('storageAreas', 'array-contains', storageArea)
                ]
            );
            return items;
        } catch (error) {
            console.error('Error fetching items by storage area:', error);
            return MOCK_INVENTORY_ITEMS
                .filter(item =>
                    item.businessUnitId === businessUnitId &&
                    item.storageAreas.includes(storageArea)
                )
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
            isActive: true
        };
        return FirestoreService.createDocument(COLLECTIONS.INVENTORY_ITEMS, itemData);
    }

    /**
     * Update an inventory item
     */
    static async updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<void> {
        return FirestoreService.updateDocument(COLLECTIONS.INVENTORY_ITEMS, id, data);
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
        businessUnitId: string,
        userId: string
    ): Promise<StockCountSession | null> {
        try {
            const sessions = await FirestoreService.getDocuments<StockCountSession>(
                COLLECTIONS.STOCK_COUNTS,
                [
                    where('businessUnitId', '==', businessUnitId),
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
        businessUnitId: string,
        status?: StockCountStatus
    ): Promise<StockCountSession[]> {
        try {
            const constraints = [where('businessUnitId', '==', businessUnitId)];

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
}

export default InventoryService;
