import { FirestoreService, where } from '../../../shared/services/firestore.service';
import type { StockCountSession, StockCountItem, InventoryItem } from '../types/InventoryItem';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';

// ============================================================
// TYPES
// ============================================================

export interface VarianceReportItem {
    itemId: string;
    itemName: string;
    starting: number;           // Count from Start Session
    purchased: number;          // Sum of purchases between sessions
    theoreticalUsage: number;   // Placeholder for Sales (0 if no POS)
    expected: number;           // starting + purchased - theoreticalUsage
    actual: number;             // Count from End Session
    variance: number;           // actual - expected (negative = missing)
    varianceCost: number;       // variance * costPerUnit
    costPerUnit: number;        // For reference
    unit: string;               // Unit of measure
}

export interface VarianceReport {
    startSession: {
        id: string;
        startedAt: Date;
        location: string;
        performedByName?: string;
    };
    endSession: {
        id: string;
        startedAt: Date;
        location: string;
        performedByName?: string;
    };
    items: VarianceReportItem[];
    summary: {
        totalItems: number;
        itemsWithVariance: number;
        totalVarianceCost: number;      // Sum of all variance costs
        totalMissingCost: number;       // Sum of negative variance costs
        totalSurplusCost: number;       // Sum of positive variance costs
    };
    generatedAt: Date;
    businessUnitId: string;
}

// Collection names
const COLLECTIONS = {
    STOCK_COUNTS: 'stock_counts',
    INVENTORY_ITEMS: 'inventory_items',
    REQUISITIONS: 'requisitions'
} as const;

// ============================================================
// INVENTORY REPORTS SERVICE
// ============================================================

export class InventoryReportsService {
    /**
     * Get all completed stock count sessions for a business unit
     * For use in session selector dropdowns
     */
    static async getCompletedSessions(businessUnitId: string): Promise<StockCountSession[]> {
        try {
            const sessions = await FirestoreService.getDocuments<StockCountSession>(
                COLLECTIONS.STOCK_COUNTS,
                [
                    where('businessUnitId', '==', businessUnitId),
                    where('status', '==', 'COMPLETED')
                ]
            );

            // Sort by date descending (most recent first)
            return sessions.sort((a, b) => {
                const dateA = a.completedAt?.toDate?.() || a.startedAt?.toDate?.() || new Date(0);
                const dateB = b.completedAt?.toDate?.() || b.startedAt?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });
        } catch (error) {
            console.error('Error fetching completed sessions:', error);
            return [];
        }
    }

    /**
     * Get purchases (requisition items) between two dates for a business unit
     * Only considers requisitions with status FUNDS_RELEASED (completed purchases)
     */
    static async getPurchasesBetweenDates(
        businessUnitId: string,
        startDate: Date,
        endDate: Date
    ): Promise<Map<string, number>> {
        try {
            // Fetch all requisitions for the business unit
            const requisitions = await FirestoreService.getDocuments<Requisition>(
                COLLECTIONS.REQUISITIONS,
                [where('businessId', '==', businessUnitId)]
            );

            // Filter to only FUNDS_RELEASED (completed purchases) within date range
            const purchaseMap = new Map<string, number>();

            for (const req of requisitions) {
                // Check if status indicates completed purchase
                if (req.status !== RequisitionStatus.FUNDS_RELEASED &&
                    req.status !== RequisitionStatus.LIQUIDATION_FILED &&
                    req.status !== RequisitionStatus.AUDITED_CLEARED) {
                    continue;
                }

                // Check if fund release date is within range
                const releaseDate = req.fundReleaseDate ? new Date(req.fundReleaseDate) : null;
                if (!releaseDate || releaseDate < startDate || releaseDate > endDate) {
                    continue;
                }

                // Sum up quantities by item name (since PRF items don't have inventory item IDs)
                for (const item of req.items) {
                    const key = item.name.toLowerCase().trim();
                    const currentQty = purchaseMap.get(key) || 0;
                    purchaseMap.set(key, currentQty + item.quantity);
                }
            }

            return purchaseMap;
        } catch (error) {
            console.error('Error fetching purchases:', error);
            return new Map();
        }
    }

    /**
     * Get inventory items for cost lookup
     */
    static async getInventoryItemsMap(businessUnitId: string): Promise<Map<string, InventoryItem>> {
        try {
            const items = await FirestoreService.getDocuments<InventoryItem>(
                COLLECTIONS.INVENTORY_ITEMS,
                [where('businessUnitId', '==', businessUnitId)]
            );

            const itemMap = new Map<string, InventoryItem>();
            for (const item of items) {
                itemMap.set(item.id, item);
                // Also map by name (lowercase) for PRF matching
                itemMap.set(item.name.toLowerCase().trim(), item);
            }
            return itemMap;
        } catch (error) {
            console.error('Error fetching inventory items:', error);
            return new Map();
        }
    }

    /**
     * Generate Variance Report using the Wisk Formula
     * 
     * Formula:
     * - Expected Stock = Starting Stock + Purchases - Theoretical Usage
     * - Variance = Actual Stock - Expected Stock
     * 
     * Negative variance = Missing stock (shrinkage, theft, spoilage)
     * Positive variance = Surplus (miscount, unreported receipts)
     */
    static async generateVarianceReport(
        startSessionId: string,
        endSessionId: string
    ): Promise<VarianceReport> {
        // Step 1: Fetch both session documents
        const [startSession, endSession] = await Promise.all([
            FirestoreService.getDocument<StockCountSession>(COLLECTIONS.STOCK_COUNTS, startSessionId),
            FirestoreService.getDocument<StockCountSession>(COLLECTIONS.STOCK_COUNTS, endSessionId)
        ]);

        if (!startSession || !endSession) {
            throw new Error('One or both sessions not found');
        }

        // Extract dates for purchase query
        const startDate = startSession.completedAt?.toDate?.() ||
            startSession.startedAt?.toDate?.() ||
            new Date(0);
        const endDate = endSession.completedAt?.toDate?.() ||
            endSession.startedAt?.toDate?.() ||
            new Date();
        const businessUnitId = endSession.businessUnitId;

        // Step 2: Fetch purchases between sessions and inventory items
        const [purchaseMap, inventoryMap] = await Promise.all([
            this.getPurchasesBetweenDates(businessUnitId, startDate, endDate),
            this.getInventoryItemsMap(businessUnitId)
        ]);

        // Step 3: Build starting stock map from start session
        const startingStockMap = new Map<string, StockCountItem>();
        for (const item of startSession.items || []) {
            startingStockMap.set(item.itemId, item);
        }

        // Step 4: Calculate variance for each item in end session
        const varianceItems: VarianceReportItem[] = [];

        for (const endItem of endSession.items || []) {
            const startItem = startingStockMap.get(endItem.itemId);
            const inventoryItem = inventoryMap.get(endItem.itemId);

            // Get starting stock (0 if not in start session = new item)
            const starting = startItem ? (startItem.count + (startItem.partialCount || 0)) : 0;

            // Get purchases by item name (match by lowercase name)
            const itemNameKey = endItem.itemName?.toLowerCase().trim() || '';
            const purchased = purchaseMap.get(itemNameKey) || 0;

            // Theoretical usage (placeholder for Sales - set to 0 for now)
            const theoreticalUsage = 0;

            // Calculate expected stock
            const expected = starting + purchased - theoreticalUsage;

            // Actual stock from end session
            const actual = endItem.count + (endItem.partialCount || 0);

            // Variance = Actual - Expected
            const variance = actual - expected;

            // Get cost per unit from inventory
            const costPerUnit = inventoryItem?.costPerUnit || 0;
            const varianceCost = variance * costPerUnit;

            varianceItems.push({
                itemId: endItem.itemId,
                itemName: endItem.itemName || inventoryItem?.name || 'Unknown Item',
                starting,
                purchased,
                theoreticalUsage,
                expected,
                actual,
                variance,
                varianceCost,
                costPerUnit,
                unit: endItem.unit || inventoryItem?.units?.countUnit || 'unit'
            });
        }

        // Step 5: Calculate summary
        const itemsWithVariance = varianceItems.filter(i => Math.abs(i.variance) > 0.01);
        const totalVarianceCost = varianceItems.reduce((sum, i) => sum + i.varianceCost, 0);
        const totalMissingCost = varianceItems
            .filter(i => i.variance < 0)
            .reduce((sum, i) => sum + Math.abs(i.varianceCost), 0);
        const totalSurplusCost = varianceItems
            .filter(i => i.variance > 0)
            .reduce((sum, i) => sum + i.varianceCost, 0);

        return {
            startSession: {
                id: startSession.id,
                startedAt: startSession.startedAt?.toDate?.() || new Date(),
                location: startSession.location,
                performedByName: startSession.performedByName
            },
            endSession: {
                id: endSession.id,
                startedAt: endSession.startedAt?.toDate?.() || new Date(),
                location: endSession.location,
                performedByName: endSession.performedByName
            },
            items: varianceItems.sort((a, b) => a.variance - b.variance), // Worst variances first
            summary: {
                totalItems: varianceItems.length,
                itemsWithVariance: itemsWithVariance.length,
                totalVarianceCost,
                totalMissingCost,
                totalSurplusCost
            },
            generatedAt: new Date(),
            businessUnitId
        };
    }
}

export default InventoryReportsService;
