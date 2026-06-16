import { db } from '../../../config/firebase';
import { resolveItemCostPerUnit } from '../utils/inventory.utils';
import { ActivityLogService } from '../../../shared/services/activityLog.service';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    writeBatch,
    Timestamp,
    orderBy,
    limit as firestoreLimit,
    addDoc
} from 'firebase/firestore';
import type { InventoryItem } from '../types/InventoryItem';
import { getTenantConstraints } from '../../../shared/utils/tenantFilters';
import type { User } from '../../procurement/types';

// ============================================================
// TYPES
// ============================================================

export interface ReconRow {
    itemId: string;
    itemName: string;
    category: string;        // RAW MAT / FG
    uom: string;
    beginningInventory: number;
    purchasesIn: number;
    purchasesOut: number;     // Returns
    stockOnHand: number;      // Calculated: beginning + in - out
    posSales: number;
    eventSales: number;
    endingSystem: number;     // Calculated: stockOnHand - posSales - eventSales
    endingActual: number | null; // Editable — user-entered physical count
    variance: number | null;     // Calculated: endingActual - endingSystem
    costPerUnit: number;
}

export interface ReconSaveResult {
    updatedItems: number;
    adjustmentsCreated: number;
    historyId: string;
}

export interface ReconHistoryRecord {
    id: string;
    businessUnitId: string;
    periodStart: string;     // ISO date
    periodEnd: string;       // ISO date
    savedAt: Date;
    savedBy: string;
    savedByName: string;
    totalItems: number;
    itemsWithVariance: number;
    totalVarianceCost: number;
    rows: ReconRow[];        // Full snapshot
}

// ============================================================
// COLLECTIONS
// ============================================================

const COL = {
    INVENTORY_ITEMS: 'inventory_items',
    STOCK_TRANSACTIONS: 'stock_transactions',
    POS_SALES: 'pos_sales',
    REQUISITIONS: 'requisitions',
    RECON_HISTORY: 'recon_history',
} as const;

// ============================================================
// SERVICE
// ============================================================

export class ReconService {

    /**
     * Aggregate all data needed for the reconciliation table
     */
    static async getReconData(
        businessUnitId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ReconRow[]> {

        // 1. Fetch all active inventory items for this BU
        const itemsQ = query(
            collection(db, COL.INVENTORY_ITEMS),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const itemsSnap = await getDocs(itemsQ);
        const items = itemsSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as (InventoryItem & { id: string })[];

        // 2. Aggregate purchases (goods receiving writes type = 'RECEIVE')
        //    Also include PRODUCTION_OUTPUT (production batches that yield new stock)
        const purchasesMap = await this.aggregateTransactions(
            businessUnitId, startDate, endDate, ['RECEIVE', 'PRODUCTION_OUTPUT']
        );

        // 3. Aggregate returns/outgoing
        const returnsMap = await this.aggregateTransactions(
            businessUnitId, startDate, endDate, ['RETURN', 'TRANSFER_OUT']
        );

        // 4. Aggregate POS sales from stock_transactions (THEORETICAL_USAGE / POS_SALE)
        const posSalesMap = await this.aggregatePosSales(businessUnitId, startDate, endDate);

        // 5. Aggregate production consumption + wastage from stock_transactions
        //    PRODUCTION_CONSUMPTION = inventory.service.ts batch production
        //    PRODUCTION_CONSUME     = production-recipe.service.ts recipe runs
        //    WASTAGE                = wastage.service.ts manual wastage entries
        const eventSalesMap = await this.aggregateTransactions(
            businessUnitId, startDate, endDate, ['PRODUCTION_CONSUMPTION', 'PRODUCTION_CONSUME', 'WASTAGE']
        );

        // 6. Build rows
        // CRITICAL: FINISHED_GOOD items are intentionally excluded from physical counting.
        // FG stock is managed virtually (via BOM explosion from POS sales), not physically counted.
        // Only RAW_MATERIAL and PRODUCTION items require a physical count.
        const rows: ReconRow[] = items
            .filter(item => item.type === 'RAW_MATERIAL' || item.type === 'PRODUCTION')
            .map(item => {
                const purchasesIn = purchasesMap.get(item.id) || 0;
                const purchasesOut = returnsMap.get(item.id) || 0;
                const posSales = posSalesMap.get(item.id) || 0;
                const eventSales = eventSalesMap.get(item.id) || 0;

                // Beginning inventory = currentStock (the last verified physical count / manual entry).
                // We intentionally do NOT use theoreticalStock here because it is a running
                // deduction tracker (decremented by POS sales & production) and can drift deeply
                // negative over time, producing impossible opening balances.
                // currentStock always reflects the last physical or manually-set value shown
                // in the Inventory Items view — so both screens will agree.
                let beginningInventory = item.currentStock ?? 0;
                if (Number.isNaN(beginningInventory)) beginningInventory = 0;

                // Calculated columns
                const stockOnHand = beginningInventory + purchasesIn - purchasesOut;
                const endingSystem = stockOnHand - posSales - eventSales;

                const categoryLabel = item.type === 'RAW_MATERIAL' ? 'RAW MAT' : 'PROD';

                return {
                    itemId: item.id,
                    itemName: item.name,
                    category: categoryLabel,
                    uom: item.units.recipeUnit,
                    beginningInventory,
                    purchasesIn,
                    purchasesOut,
                    stockOnHand,
                    posSales,
                    eventSales,
                    endingSystem,
                    endingActual: null,
                    variance: null,
                    costPerUnit: resolveItemCostPerUnit(item),
                };
            })
            .sort((a, b) => a.itemName.localeCompare(b.itemName));

        return rows;
    }

    /**
     * Aggregate stock_transactions by type(s) for a date range
     * Returns Map<itemId, totalQuantity>
     */
    private static async aggregateTransactions(
        businessUnitId: string,
        startDate: Date,
        endDate: Date,
        types: string[]
    ): Promise<Map<string, number>> {
        const result = new Map<string, number>();

        try {
            const q = query(
                collection(db, COL.STOCK_TRANSACTIONS),
                where('businessUnitId', '==', businessUnitId)
            );
            const snap = await getDocs(q);

            for (const docSnap of snap.docs) {
                const data = docSnap.data();
                const txType = data.type as string;
                if (!types.includes(txType)) continue;

                // Client-side date filter to avoid composite index
                const txDate = data.timestamp?.toDate?.() || new Date(data.timestamp);
                if (txDate < startDate || txDate > endDate) continue;

                const itemId = data.itemId as string;
                const qty = Math.abs(data.quantity as number || 0);
                result.set(itemId, (result.get(itemId) || 0) + qty);
            }
        } catch (error) {
            console.error('Error aggregating transactions:', error);
        }

        return result;
    }

    /**
     * Aggregate POS sales deductions from stock_transactions.
     * BOM-exploded deductions are stored as THEORETICAL_USAGE (raw materials)
     * and direct FG deductions as POS_SALE — both are the real inventory movements.
     * Returns Map<itemId, totalQuantity>
     */
    private static async aggregatePosSales(
        businessUnitId: string,
        startDate: Date,
        endDate: Date
    ): Promise<Map<string, number>> {
        return this.aggregateTransactions(
            businessUnitId, startDate, endDate, ['THEORETICAL_USAGE', 'POS_SALE']
        );
    }

    /**
     * Save physical counts:
     * 1. Update currentStock to the new actual count
     * 2. Create ADJUSTMENT stock_transactions for variance audit trail
     */
    static async savePhysicalCounts(
        rows: ReconRow[],
        businessUnitId: string,
        userId: string,
        userName: string,
        periodLabel: string
    ): Promise<ReconSaveResult> {
        const rowsWithCounts = rows.filter(r => r.endingActual !== null);
        if (rowsWithCounts.length === 0) {
            throw new Error('No physical counts entered. Please enter at least one actual count.');
        }

        const batch = writeBatch(db);
        let updatedItems = 0;
        let adjustmentsCreated = 0;

        for (const row of rowsWithCounts) {
            const actualCount = row.endingActual!;
            const variance = actualCount - row.endingSystem;

            // 1. Update currentStock on the inventory item
            const itemRef = doc(db, COL.INVENTORY_ITEMS, row.itemId);
            batch.update(itemRef, {
                currentStock: actualCount,
                theoreticalStock: actualCount, // Reset theoretical to match physical
                updatedAt: Timestamp.now(),
                lastReconAt: Timestamp.now(), // Sentinel: POS import should skip deductions for
                                               // transactions timestamped before this value
            });
            updatedItems++;

            // 2. If there's a variance, create an ADJUSTMENT transaction
            if (Math.abs(variance) > 0.001) {
                const txRef = doc(collection(db, COL.STOCK_TRANSACTIONS));
                batch.set(txRef, {
                    itemId: row.itemId,
                    itemName: row.itemName,
                    businessUnitId,
                    type: 'ADJUSTMENT',
                    quantity: variance,
                    balanceAfter: actualCount,
                    referenceId: `RECON-${periodLabel}`,
                    notes: `Inventory Recon: System expected ${row.endingSystem.toFixed(1)}, actual count ${actualCount}. Variance: ${variance > 0 ? '+' : ''}${variance.toFixed(1)}`,
                    performedBy: userId,
                    performedByName: userName,
                    timestamp: Timestamp.now(),
                });
                adjustmentsCreated++;
            }
        }

        await batch.commit();

        // 3. Save a history snapshot
        const varianceItems = rowsWithCounts.filter(r => Math.abs((r.endingActual! - r.endingSystem)) > 0.001);
        const totalVarianceCost = varianceItems.reduce((sum, r) => {
            const v = r.endingActual! - r.endingSystem;
            return sum + (v * r.costPerUnit);
        }, 0);

        const historyDoc = await addDoc(collection(db, COL.RECON_HISTORY), {
            businessUnitId,
            periodStart: periodLabel.split('→')[0] || periodLabel,
            periodEnd: periodLabel.split('→')[1] || periodLabel,
            savedAt: Timestamp.now(),
            savedBy: userId,
            savedByName: userName,
            totalItems: rowsWithCounts.length,
            itemsWithVariance: varianceItems.length,
            totalVarianceCost,
            rows: rowsWithCounts.map(r => ({
                ...r,
                variance: r.endingActual! - r.endingSystem,
            })),
        });

        const result = { updatedItems, adjustmentsCreated, historyId: historyDoc.id };

        // Activity log — fire and forget
        ActivityLogService.log(
            'Reconciliation',
            'Recon Saved',
            `${updatedItems} item(s) reconciled, ${adjustmentsCreated} adjustment(s) created — ${periodLabel}`,
            { id: userId, name: userName },
            businessUnitId,
            { entityId: historyDoc.id, entityType: 'Recon Session', severity: adjustmentsCreated > 0 ? 'warning' : 'success' }
        );

        return result;
    }

    /**
     * Get recon history records.
     *
     * @param userOrBuId - Pass a `User` for cross-BU history, or a `string` BU ID
     *                     to scope to a single business unit.
     * @param maxRecords  - Max records to return (default 20).
     */
    static async getHistory(
        userOrBuId: User | string,
        maxRecords = 20
    ): Promise<ReconHistoryRecord[]> {
        try {
            const tenantConstraints = typeof userOrBuId === 'string'
                ? [where('businessUnitId', '==', userOrBuId)]
                : getTenantConstraints(userOrBuId, 'businessUnitId');

            const q = query(
                collection(db, COL.RECON_HISTORY),
                ...tenantConstraints,
                orderBy('savedAt', 'desc'),
                firestoreLimit(maxRecords)
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    savedAt: data.savedAt?.toDate?.() || new Date(data.savedAt),
                } as ReconHistoryRecord;
            });
        } catch (error) {
            console.error('Error fetching recon history:', error);
            return [];
        }
    }
}

export default ReconService;
