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
     * Aggregate all data needed for the reconciliation table in a single optimized pass.
     */
    static async getReconData(
        businessUnitId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ReconRow[]> {

        // 1. Fetch active inventory items
        const itemsQ = query(
            collection(db, COL.INVENTORY_ITEMS),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const itemsSnap = await getDocs(itemsQ);
        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as (InventoryItem & { id: string })[];

        // 2. Perform a SINGLE PASS query for all transactions within the date range
        // IMPORTANT: This relies on the existing composite index { businessUnitId: ASC, timestamp: DESC }
        const txQuery = query(
            collection(db, COL.STOCK_TRANSACTIONS),
            where('businessUnitId', '==', businessUnitId),
            where('timestamp', '>=', Timestamp.fromDate(startDate)),
            where('timestamp', '<=', Timestamp.fromDate(endDate)),
            orderBy('timestamp', 'desc')
        );
        
        const txSnap = await getDocs(txQuery);
        
        const purchasesMap = new Map<string, number>();
        const returnsMap = new Map<string, number>();
        const posSalesMap = new Map<string, number>();
        const eventSalesMap = new Map<string, number>();

        // Single pass O(N) aggregation of filtered documents
        for (const docSnap of txSnap.docs) {
            const data = docSnap.data();
            const type = data.type as string;
            const itemId = data.itemId as string;
            const qty = Math.abs((data.quantity as number) || 0);

            if (['RECEIVE', 'PRODUCTION_OUTPUT'].includes(type)) {
                purchasesMap.set(itemId, (purchasesMap.get(itemId) || 0) + qty);
            } else if (['RETURN', 'TRANSFER_OUT'].includes(type)) {
                returnsMap.set(itemId, (returnsMap.get(itemId) || 0) + qty);
            } else if (['THEORETICAL_USAGE', 'POS_SALE'].includes(type)) {
                posSalesMap.set(itemId, (posSalesMap.get(itemId) || 0) + qty);
            } else if (['PRODUCTION_CONSUMPTION', 'PRODUCTION_CONSUME', 'WASTAGE'].includes(type)) {
                eventSalesMap.set(itemId, (eventSalesMap.get(itemId) || 0) + qty);
            }
        }

        // 3. Build and return rows
        return items
            .filter(item => item.type === 'RAW_MATERIAL' || item.type === 'PRODUCTION')
            .map(item => {
                const purchasesIn = purchasesMap.get(item.id) || 0;
                const purchasesOut = returnsMap.get(item.id) || 0;
                const posSales = posSalesMap.get(item.id) || 0;
                const eventSales = eventSalesMap.get(item.id) || 0;

                let beginningInventory = item.currentStock ?? 0;
                if (Number.isNaN(beginningInventory)) beginningInventory = 0;

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
    }

    /**
     * Save physical counts safely using chunked batches to respect Firestore's 500 op limit
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

        let updatedItems = 0;
        let adjustmentsCreated = 0;
        
        // Firestore batch limit is 500. We use 450 to be safe.
        const BATCH_LIMIT = 450; 
        const batches: ReturnType<typeof writeBatch>[] = [];
        let currentBatch = writeBatch(db);
        let opCount = 0;

        for (const row of rowsWithCounts) {
            const actualCount = row.endingActual!;
            const variance = actualCount - row.endingSystem;

            // 1. Update currentStock on the inventory item
            const itemRef = doc(db, COL.INVENTORY_ITEMS, row.itemId);
            currentBatch.update(itemRef, {
                currentStock: actualCount,
                theoreticalStock: actualCount, // Reset theoretical to match physical
                updatedAt: Timestamp.now(),
                lastReconAt: Timestamp.now(), // Sentinel: POS import should skip deductions for transactions before this
            });
            updatedItems++;
            opCount++;

            // 2. If there's a variance, create an ADJUSTMENT transaction
            if (Math.abs(variance) > 0.001) {
                const txRef = doc(collection(db, COL.STOCK_TRANSACTIONS));
                currentBatch.set(txRef, {
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
                opCount++;
            }

            // Chunk management
            if (opCount >= BATCH_LIMIT) {
                batches.push(currentBatch);
                currentBatch = writeBatch(db);
                opCount = 0;
            }
        }
        
        if (opCount > 0) batches.push(currentBatch);

        // Commit all batches
        await Promise.all(batches.map(batch => batch.commit()));

        // 3. Save a history snapshot
        const varianceItems = rowsWithCounts.filter(r => Math.abs((r.endingActual! - r.endingSystem)) > 0.001);
        const totalVarianceCost = varianceItems.reduce((sum, r) => {
            return sum + ((r.endingActual! - r.endingSystem) * r.costPerUnit);
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
            rows: rowsWithCounts.map(r => ({ ...r, variance: r.endingActual! - r.endingSystem })),
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
