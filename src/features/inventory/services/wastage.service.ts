import { writeBatch, doc, collection, getDocs, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Timestamp } from '../../../shared/services/firestore.service';
import type { WastageRecord, RecordWastageInput, WastageReason } from '../types/InventoryItem';
import type { StockTransaction } from '../../pos/types/pos-import.types';
import { InventoryService } from './inventory.service';
import { getTenantConstraints } from '../../../shared/utils/tenantFilters';
import type { User } from '../../procurement/types';

// ============================================================
// WASTAGE REASONS — Single source of truth
// ============================================================

export const WASTAGE_REASONS: WastageReason[] = [
    'Spillage',
    'Expired',
    'Damaged',
    'Contaminated',
    'Overproduction',
    'Equipment Failure',
    'Human Error',
    'Other'
];

// ============================================================
// WASTAGE SERVICE
// Atomic stock deduction + audit trail via writeBatch
// ============================================================

export class WastageService {

    /**
     * Record wastage: Atomically deducts stock, creates a wastage_record,
     * and logs a stock_transaction (type: WASTAGE).
     * Mirrors the `receiveGoodsBatch` pattern in InventoryService.
     */
    static async recordWastage(input: RecordWastageInput): Promise<WastageRecord> {
        // 1. Fetch the current item to get fresh stock & cost
        const allItems = await InventoryService.getInventory(input.businessUnitId);
        const item = allItems.find(i => i.id === input.itemId);

        if (!item) {
            throw new Error(`Inventory item ${input.itemId} not found in BU ${input.businessUnitId}.`);
        }

        // Guard: only RAW_MATERIAL and PRODUCTION allowed
        if (item.type !== 'RAW_MATERIAL' && item.type !== 'PRODUCTION') {
            throw new Error(`Wastage can only be recorded for RAW_MATERIAL or PRODUCTION items. Got: ${item.type}`);
        }

        const displayUnit = item.units?.recipeUnit || ('countUnit' in item.units ? (item.units as unknown as Record<string, string>).countUnit : undefined) || 'unit';

        if (input.quantity <= 0) {
            throw new Error('Wastage quantity must be greater than 0.');
        }

        if (input.quantity > item.currentStock) {
            throw new Error(
                `Cannot waste ${input.quantity} ${displayUnit}(s). Current stock is only ${item.currentStock}.`
            );
        }

        // 2. Compute derived values
        const costPerUnit = item.baseCost ?? item.costPerUnit ?? 0;
        const totalCost = input.quantity * costPerUnit;
        const newStock = item.currentStock - input.quantity;
        const now = Timestamp.now();

        // 3. Prepare Firestore refs
        const batch = writeBatch(db);

        // 3a. Deduct stock on inventory_items
        const itemRef = doc(db, 'inventory_items', item.id);
        batch.update(itemRef, {
            currentStock: newStock,
            updatedAt: now
        });

        // 3b. Create wastage_records document (immutable)
        const wastageId = doc(collection(db, 'wastage_records')).id;
        const wastageRef = doc(db, 'wastage_records', wastageId);

        const wastageRecord: WastageRecord = {
            id: wastageId,
            businessUnitId: input.businessUnitId,
            itemId: item.id,
            itemName: item.name,
            itemType: item.type,
            quantity: input.quantity,
            unit: displayUnit,
            reason: input.reason,
            notes: input.notes || '',
            costPerUnit,
            totalCost,
            balanceAfter: newStock,
            performedBy: input.performedBy.id,
            performedByName: input.performedBy.name,
            createdAt: now
        };

        batch.set(wastageRef, wastageRecord);

        // 3c. Create stock_transactions audit entry
        const txnId = doc(collection(db, 'stock_transactions')).id;
        const txnRef = doc(db, 'stock_transactions', txnId);

        const txnData: StockTransaction = {
            id: txnId,
            itemId: item.id,
            itemName: item.name,
            businessUnitId: input.businessUnitId,
            type: 'WASTAGE',
            quantity: input.quantity,
            balanceAfter: newStock,
            referenceId: wastageId,
            notes: `Wastage: ${input.reason}${input.notes ? ' — ' + input.notes : ''}`,
            performedBy: input.performedBy.id,
            performedByName: input.performedBy.name,
            timestamp: now
        };

        batch.set(txnRef, txnData);

        // 4. Commit atomically
        await batch.commit();

        console.log(
            `[WastageService] Recorded ${input.quantity} ${displayUnit} wastage for "${item.name}" (${input.reason}). New stock: ${newStock}`
        );

        return wastageRecord;
    }

    /**
     * Fetch wastage records ordered newest-first.
     *
     * @param userOrBuId - Pass a `User` object for multi-BU-aware filtering,
     *                     or a plain `string` businessUnitId for single-BU queries
     *                     (e.g. when recording wastage for a specific BU).
     */
    static async getWastageRecords(
        userOrBuId: User | string,
        maxRecords: number = 200
    ): Promise<WastageRecord[]> {
        try {
            // Determine constraints based on caller type
            const tenantConstraints = typeof userOrBuId === 'string'
                ? [where('businessUnitId', '==', userOrBuId)]
                : getTenantConstraints(userOrBuId, 'businessUnitId');

            const q = query(
                collection(db, 'wastage_records'),
                ...tenantConstraints,
                orderBy('createdAt', 'desc'),
                firestoreLimit(maxRecords)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(docSnap => ({
                ...docSnap.data(),
                id: docSnap.id
            } as WastageRecord));
        } catch (error) {
            console.error('[WastageService] Error fetching wastage records:', error);
            return [];
        }
    }
}
