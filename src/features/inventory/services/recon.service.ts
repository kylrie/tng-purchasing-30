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
    addDoc,
    type QueryConstraint
} from 'firebase/firestore';
import type { InventoryItem } from '../types/InventoryItem';
import { getUserVisibleBuIds } from '../../../shared/utils/tenantFilters';
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
    eventSales: number;       // Linked to Event Sales Import
    prodWaste: number;        // Linked to Production consumption / Wastage
    endingSystem: number;     // Calculated: stockOnHand - posSales - eventSales - prodWaste
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
    STOCK_COUNTS: 'stock_counts',
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

        // 2. Look for the most recent completed recon whose periodEnd is before this startDate
        //    This gives us a trusted anchor for beginningInventory
        const anchorMap = new Map<string, number>(); // itemId -> endingActual from prior recon
        const reconQ = query(
            collection(db, COL.RECON_HISTORY),
            where('businessUnitId', '==', businessUnitId),
            orderBy('savedAt', 'desc'),
            firestoreLimit(10) // Check recent recons
        );
        const reconSnap = await getDocs(reconQ);
        
        // Find the most recent recon whose periodEnd is strictly before our startDate
        // IMPORTANT: Use local date formatting, NOT toISOString() which converts to UTC
        // and shifts dates backward in positive UTC offset timezones (e.g. UTC+8)
        const pad = (n: number) => String(n).padStart(2, '0');
        const startDateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
        
        for (const reconDoc of reconSnap.docs) {
            const reconData = reconDoc.data();
            const reconPeriodEnd = reconData.periodEnd as string; // ISO date string e.g. "2026-07-14"
            
            if (reconPeriodEnd && reconPeriodEnd <= startDateStr) {
                // This recon ended on or before our period starts — use it as anchor
                const rows = reconData.rows as Array<{ itemId: string; endingActual: number | null }>;
                if (rows) {
                    for (const row of rows) {
                        if (row.endingActual !== null && row.endingActual !== undefined) {
                            anchorMap.set(row.itemId, row.endingActual);
                        }
                    }
                }
                break; // Use the most recent matching recon
            }
        }

        // 3. Query transactions for the period
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);
        
        // If we have an anchor, we only need transactions within [startDate, endDate] for column aggregation
        // If no anchor, we need transactions from startDate to NOW for rollback calculation
        const txQueryConstraints = [
            where('businessUnitId', '==', businessUnitId),
            where('timestamp', '>=', startTimestamp),
            orderBy('timestamp', 'desc')
        ];
        
        const txQuery = query(
            collection(db, COL.STOCK_TRANSACTIONS),
            ...txQueryConstraints
        );
        
        const txSnap = await getDocs(txQuery);
        const purchasesMap = new Map<string, number>();
        const returnsMap = new Map<string, number>();
        const posSalesMap = new Map<string, number>();
        const eventSalesMap = new Map<string, number>();
        const prodWasteMap = new Map<string, number>();
        const netChangeMap = new Map<string, number>(); // All changes from startDate to NOW (for rollback)
        const periodNetChangeMap = new Map<string, number>(); // Changes within [startDate, endDate] only

        // Single pass O(N) aggregation
        for (const docSnap of txSnap.docs) {
            const data = docSnap.data();
            const type = data.type as string;
            const itemId = data.itemId as string;
            const qty = Math.abs((data.quantity as number) || 0);
            const rawQty = (data.quantity as number) || 0;
            const ts = data.timestamp as Timestamp;

            // Calculate net effect on stock
            let effect = 0;
            if (['RECEIVE', 'PRODUCTION_OUTPUT', 'POS_REVERSAL'].includes(type)) {
                effect = qty;
            } else if (['RETURN', 'TRANSFER_OUT', 'THEORETICAL_USAGE', 'POS_SALE', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_CONSUME', 'WASTAGE', 'EVENT_CONSUMPTION'].includes(type)) {
                effect = -qty;
            } else if (type === 'ADJUSTMENT') {
                effect = rawQty;
            }
            
            // netChange includes everything from startDate to NOW (for currentStock rollback fallback)
            netChangeMap.set(itemId, (netChangeMap.get(itemId) || 0) + effect);

            // Only aggregate columns and period net change within [startDate, endDate]
            if (ts.toMillis() <= endTimestamp.toMillis()) {
                periodNetChangeMap.set(itemId, (periodNetChangeMap.get(itemId) || 0) + effect);
                
                if (['RECEIVE', 'PRODUCTION_OUTPUT'].includes(type)) {
                    purchasesMap.set(itemId, (purchasesMap.get(itemId) || 0) + qty);
                } else if (['RETURN', 'TRANSFER_OUT'].includes(type)) {
                    returnsMap.set(itemId, (returnsMap.get(itemId) || 0) + qty);
                } else if (type === 'THEORETICAL_USAGE') {
                    const isEvent = data.notes?.includes('for Event:') || data.notes?.includes('for Event ');
                    if (isEvent) {
                        eventSalesMap.set(itemId, (eventSalesMap.get(itemId) || 0) + qty);
                    } else {
                        posSalesMap.set(itemId, (posSalesMap.get(itemId) || 0) + qty);
                    }
                } else if (type === 'POS_SALE') {
                    posSalesMap.set(itemId, (posSalesMap.get(itemId) || 0) + qty);
                } else if (['EVENT_CONSUMPTION'].includes(type)) {
                    eventSalesMap.set(itemId, (eventSalesMap.get(itemId) || 0) + qty);
                } else if (['PRODUCTION_CONSUMPTION', 'PRODUCTION_CONSUME', 'WASTAGE'].includes(type)) {
                    prodWasteMap.set(itemId, (prodWasteMap.get(itemId) || 0) + qty);
                }
            }
        }

        // 4. Build and return rows
        return items
            .filter(item => item.type === 'RAW_MATERIAL' || item.type === 'PRODUCTION')
            .map(item => {
                const purchasesIn = purchasesMap.get(item.id) || 0;
                const purchasesOut = returnsMap.get(item.id) || 0;
                const posSales = posSalesMap.get(item.id) || 0;
                const eventSales = eventSalesMap.get(item.id) || 0;
                const prodWaste = prodWasteMap.get(item.id) || 0;

                let beginningInventory: number;
                
                if (anchorMap.has(item.id)) {
                    // Use the ending actual from the previous recon as our beginning
                    beginningInventory = anchorMap.get(item.id)!;
                } else {
                    // Fallback: rollback from currentStock using ALL transactions from startDate to NOW
                    const netChange = netChangeMap.get(item.id) || 0;
                    beginningInventory = (item.currentStock ?? 0) - netChange;
                }

                if (Number.isNaN(beginningInventory) || beginningInventory < 0) {
                    beginningInventory = 0;
                }

                const stockOnHand = beginningInventory + purchasesIn - purchasesOut;
                const endingSystem = stockOnHand - posSales - eventSales - prodWaste;
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
                    prodWaste,
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
        periodLabel: string,
        periodEndDate?: Date
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
            const ts = periodEndDate ? Timestamp.fromDate(periodEndDate) : Timestamp.now();
            currentBatch.update(itemRef, {
                currentStock: actualCount,
                theoreticalStock: actualCount, // Reset theoretical to match physical
                updatedAt: Timestamp.now(),
                lastReconAt: ts, // Sentinel: POS import should skip deductions for transactions before this
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
                    timestamp: ts,
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
                prodWaste: r.prodWaste ?? 0,
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
        const queryConstraints: QueryConstraint[] = [];

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
