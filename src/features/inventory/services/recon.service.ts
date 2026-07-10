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
import { getTenantConstraints, getUserVisibleBuIds } from '../../../shared/utils/tenantFilters';
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
        user: User,
        businessUnitId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ReconRow[]> {
        if (!user) {
            throw new Error('Access denied: Authentication context is missing');
        }

        // Validate business unit access (Multi-Tenancy)
        const allowedBUs = getUserVisibleBuIds(user);
        if (allowedBUs !== null && !allowedBUs.includes(businessUnitId)) {
            throw new Error('Access denied: Unauthorized access to this business unit');
        }

        // 1. Fetch active inventory items
        const itemsQ = query(
            collection(db, COL.INVENTORY_ITEMS),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const itemsSnap = await getDocs(itemsQ);
        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as (InventoryItem & { id: string })[];

        // 2. Perform a SINGLE PASS query for all transactions within the date range
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
                    uom: item.units?.recipeUnit || (item.units as { countUnit?: string })?.countUnit || 'pcs',
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
        user: User,
        rows: ReconRow[],
        businessUnitId: string,
        periodLabel: string
    ): Promise<ReconSaveResult> {
        if (!user) {
            throw new Error('Access denied: Authentication context is missing');
        }

        // Validate business unit access (Multi-Tenancy)
        const allowedBUs = getUserVisibleBuIds(user);
        if (allowedBUs !== null && !allowedBUs.includes(businessUnitId)) {
            throw new Error('Access denied: Unauthorized access to this business unit');
        }

        const rowsWithCounts = rows.filter(r => r.endingActual !== null);
        if (rowsWithCounts.length === 0) {
            throw new Error('No physical counts entered. Please enter at least one actual count.');
        }

        // Validate counts are safe, valid positive numbers
        for (const row of rowsWithCounts) {
            const val = row.endingActual;
            if (val === null || typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
                throw new Error(`Invalid actual count value for item: ${row.itemName}`);
            }
            if (val < 0) {
                throw new Error(`Actual count value cannot be negative for item: ${row.itemName}`);
            }
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
                    performedBy: user.id,
                    performedByName: user.name,
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

        const periodParts = periodLabel.split('→');
        const periodStart = periodParts[0] || periodLabel;
        const periodEnd = periodParts[1] || periodLabel;

        const historyDoc = await addDoc(collection(db, COL.RECON_HISTORY), {
            businessUnitId: businessUnitId || '',
            periodStart: periodStart || '',
            periodEnd: periodEnd || '',
            savedAt: Timestamp.now(),
            savedBy: user.id || 'unknown',
            savedByName: user.name || 'Unknown User',
            totalItems: rowsWithCounts.length,
            itemsWithVariance: varianceItems.length,
            totalVarianceCost: totalVarianceCost || 0,
            rows: rowsWithCounts.map(r => ({
                itemId: r.itemId || '',
                itemName: r.itemName || '',
                category: r.category || '',
                uom: r.uom || 'pcs',
                beginningInventory: r.beginningInventory ?? 0,
                purchasesIn: r.purchasesIn ?? 0,
                purchasesOut: r.purchasesOut ?? 0,
                stockOnHand: r.stockOnHand ?? 0,
                posSales: r.posSales ?? 0,
                eventSales: r.eventSales ?? 0,
                endingSystem: r.endingSystem ?? 0,
                endingActual: r.endingActual ?? null,
                variance: r.endingActual !== null ? r.endingActual - r.endingSystem : null,
                costPerUnit: r.costPerUnit ?? 0,
            })),
        });

        const result = { updatedItems, adjustmentsCreated, historyId: historyDoc.id };

        // Activity log — fire and forget
        ActivityLogService.log(
            'Reconciliation',
            'Recon Saved',
            `${updatedItems} item(s) reconciled, ${adjustmentsCreated} adjustment(s) created — ${periodLabel}`,
            { id: user.id || 'unknown', name: user.name || 'Unknown User' },
            businessUnitId,
            { entityId: historyDoc.id, entityType: 'Recon Session', severity: adjustmentsCreated > 0 ? 'warning' : 'success' }
        );

        return result;
    }

    /**
     * Get recon history records.
     *
     * @param user         - Authenticated user context
     * @param businessUnitId - Selected business unit ID to filter on.
     * @param maxRecords  - Max records to return (default 20).
     */
    static async getHistory(
        user: User,
        businessUnitId?: string,
        maxRecords = 20
    ): Promise<ReconHistoryRecord[]> {
        if (!user) {
            throw new Error('Access denied: Authentication context is missing');
        }

        const allowedBUs = getUserVisibleBuIds(user);

        // Build robust multi-tenant queries
        const queryConstraints: any[] = [];

        if (businessUnitId) {
            // Verify access to specific BU
            if (allowedBUs !== null && !allowedBUs.includes(businessUnitId)) {
                throw new Error('Access denied: Unauthorized access to this business unit');
            }
            queryConstraints.push(where('businessUnitId', '==', businessUnitId));
        } else if (allowedBUs !== null) {
            if (allowedBUs.length === 0) return [];
            queryConstraints.push(where('businessUnitId', 'in', allowedBUs));
        }

        const q = query(
            collection(db, COL.RECON_HISTORY),
            ...queryConstraints,
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
    }
}

export default ReconService;
