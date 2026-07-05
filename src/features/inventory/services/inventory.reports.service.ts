import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { FirestoreService, where as fsWhere } from '../../../shared/services/firestore.service';
import type { StockCountSession, StockCountItem, InventoryItem } from '../types/InventoryItem';
// Removed unused imports

// ============================================================
// TYPES
// ============================================================

export interface VarianceReportItem {
    itemId: string;
    itemName: string;
    starting: number;           // Count from Start Session
    purchased: number;          // Sum of purchases between sessions
    wastage: number;            // Sum of wastage records between sessions
    wastageCost: number;        // wastage * costPerUnit
    theoreticalUsage: number;   // From POS Sales / BOM Explosion
    adjustments: number;        // Positive or negative adjustments from counts/manual
    expected: number;           // starting + purchased - wastage - theoreticalUsage + adjustments
    actual: number;             // Count from End Session
    variance: number;           // actual - expected (negative = missing)
    varianceCost: number;       // variance * costPerUnit
    costPerUnit: number;        // For reference
    unit: string;               // Unit of measure
}

export interface TransactionAggregates {
    purchased: number;
    wastage: number;
    theoreticalUsage: number;
    adjustments: number; // Positive or negative
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
        totalWastageCost: number;       // Sum of all wastage costs in the period
    };
    generatedAt: Date;
    businessUnitId: string;
}

// Collection names
const COLLECTIONS = {
    STOCK_COUNTS: 'stock_counts',
    INVENTORY_ITEMS: 'inventory_items',
    STOCK_TRANSACTIONS: 'stock_transactions'
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
     * Get aggregated stock data using the pre-computed Cloud Function aggregates.
     * O(1) scaling regardless of transaction volume.
     */
    static async getTransactionAggregates(
        businessUnitId: string,
        startDate: Date,
        endDate: Date
    ): Promise<Map<string, TransactionAggregates>> {
        try {
            const q = query(
                collection(db, 'inventory_aggregates'),
                fsWhere('businessUnitId', '==', businessUnitId),
                fsWhere('date', '>=', startDate.toISOString().split('T')[0]),
                fsWhere('date', '<=', endDate.toISOString().split('T')[0])
            );
            
            const snapshot = await getDocs(q);
            const aggMap = new Map<string, TransactionAggregates>();

            for (const doc of snapshot.docs) {
                const data = doc.data();
                const itemId = data.itemId;
                
                let entry = aggMap.get(itemId);
                if (!entry) {
                    entry = { purchased: 0, wastage: 0, theoreticalUsage: 0, adjustments: 0 };
                    aggMap.set(itemId, entry);
                }
                
                // Sum across the dates
                // Assuming positive quantities for POSITIVE increments, and signed for ADJUSTMENTS
                entry.purchased += Math.abs(data.RECEIVE_qty || 0) + Math.abs(data.PRODUCTION_YIELD_qty || 0);
                entry.wastage += Math.abs(data.WASTAGE_qty || 0);
                entry.theoreticalUsage += Math.abs(data.THEORETICAL_USAGE_qty || 0) + Math.abs(data.EVENT_CONSUMPTION_qty || 0) + Math.abs(data.PRODUCTION_CONSUME_qty || 0) + Math.abs(data.POS_SALE_qty || 0);
                // Adjustments are signed
                entry.adjustments += (data.ADJUSTMENT_qty || 0);
            }

            console.log(`[InventoryReportsService] Fetched ${snapshot.size} aggregated records between ${startDate.toISOString()} and ${endDate.toISOString()}`);
            return aggMap;
        } catch (error) {
            console.error('Error fetching stock transactions:', error);
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

        // Step 2: Fetch transactions and inventory items in parallel
        const [aggMap, inventoryMap] = await Promise.all([
            this.getTransactionAggregates(businessUnitId, startDate, endDate),
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

            // Get aggregates from the ledger
            const agg = aggMap.get(endItem.itemId) || { purchased: 0, wastage: 0, theoreticalUsage: 0, adjustments: 0 };
            
            const purchased = agg.purchased;
            const wastage = agg.wastage;
            const theoreticalUsage = agg.theoreticalUsage;
            const adjustments = agg.adjustments;

            // Calculate expected stock: Starting + Purchases − Wastage − Usage + Adjustments
            const expected = starting + purchased - wastage - theoreticalUsage + adjustments;

            // Actual stock from end session
            const actual = endItem.count + (endItem.partialCount || 0);

            // Variance = Actual - Expected
            const variance = actual - expected;

            // Get cost per unit from inventory
            const costPerUnit = inventoryItem?.costPerUnit || 0;
            const varianceCost = variance * costPerUnit;
            const wastageCost = wastage * costPerUnit;

            varianceItems.push({
                itemId: endItem.itemId,
                itemName: endItem.itemName || inventoryItem?.name || 'Unknown Item',
                starting,
                purchased,
                wastage,
                wastageCost,
                theoreticalUsage,
                adjustments,
                expected,
                actual,
                variance,
                varianceCost,
                costPerUnit,
                unit: endItem.unit || inventoryItem?.units?.recipeUnit || 'unit'
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
        const totalWastageCost = varianceItems.reduce((sum, i) => sum + i.wastageCost, 0);

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
                totalSurplusCost,
                totalWastageCost
            },
            generatedAt: new Date(),
            businessUnitId
        };
    }
}

export default InventoryReportsService;
