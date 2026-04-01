import * as XLSX from 'xlsx';
import {
    collection,
    doc,
    getDocs,
    query,
    where,
    writeBatch,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import type {
    PosImportRow,
    PosImportMappedRow,
    PosImportBatch,
    PosSaleRecord,
    SimulatedDeduction,
} from '../types/pos-import.types';

// Collection names (mirrored from COLLECTIONS for direct use)
const COL = {
    POS_SALES: 'pos_sales',
    POS_SALES_BATCHES: 'pos_sales_batches',
    STOCK_TRANSACTIONS: 'stock_transactions',
    INVENTORY_ITEMS: 'inventory_items',
} as const;

/**
 * POS Sales Import Service
 * Handles file parsing, inventory matching, and batch Firestore writes
 */
export class PosImportService {

    // ================================================================
    // FILE PARSING
    // ================================================================

    /**
     * Parse an .xlsx or .csv file into typed PosImportRow[]
     * Normalizes column headers (case-insensitive, trimmed)
     */
    static async parseFile(file: File): Promise<PosImportRow[]> {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Get raw JSON rows with header normalization
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawRows.length === 0) {
            throw new Error('The uploaded file contains no data rows.');
        }

        // Normalize headers: map any casing to our expected fields
        const headerMap: Record<string, keyof PosImportRow> = {};
        const firstRow = rawRows[0];
        for (const key of Object.keys(firstRow)) {
            const normalized = key.trim().toLowerCase().replace(/\s+/g, ' ');
            if (normalized === 'category') headerMap[key] = 'category';
            else if (normalized === 'item name' || normalized === 'itemname' || normalized === 'item') headerMap[key] = 'itemName';
            else if (normalized === 'qty sold' || normalized === 'qtysold' || normalized === 'qty' || normalized === 'quantity') headerMap[key] = 'qtySold';
            else if (normalized === 'amount' || normalized === 'total' || normalized === 'sales') headerMap[key] = 'amount';
            else if (normalized === 'costs' || normalized === 'cost') headerMap[key] = 'costs';
            else if (normalized === 'profit' || normalized === 'net') headerMap[key] = 'profit';
        }

        // Validate that we found the minimum required columns
        const mapped = Object.values(headerMap);
        const required: (keyof PosImportRow)[] = ['itemName', 'qtySold', 'amount'];
        for (const field of required) {
            if (!mapped.includes(field)) {
                throw new Error(`Required column "${field}" not found. Found columns: ${Object.keys(firstRow).join(', ')}`);
            }
        }

        // Map rows to typed objects
        return rawRows.map((raw) => {
            const row: PosImportRow = {
                category: String(raw[Object.keys(headerMap).find(k => headerMap[k] === 'category') || ''] || '').trim(),
                itemName: String(raw[Object.keys(headerMap).find(k => headerMap[k] === 'itemName') || ''] || '').trim(),
                qtySold: Number(raw[Object.keys(headerMap).find(k => headerMap[k] === 'qtySold') || ''] || 0),
                amount: Number(raw[Object.keys(headerMap).find(k => headerMap[k] === 'amount') || ''] || 0),
                costs: Number(raw[Object.keys(headerMap).find(k => headerMap[k] === 'costs') || ''] || 0),
                profit: Number(raw[Object.keys(headerMap).find(k => headerMap[k] === 'profit') || ''] || 0),
            };
            return row;
        }).filter(row => row.itemName && row.qtySold > 0); // Skip empty/zero rows
    }

    // ================================================================
    // FILE HASHING FOR IDEMPOTENCY
    // ================================================================

    /**
     * Generate a SHA-256 hash of the file contents for duplicate detection
     */
    static async generateFileHash(file: File): Promise<string> {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Check if a file has already been imported for this business unit
     */
    static async checkDuplicateImport(fileHash: string, businessUnitId: string): Promise<PosImportBatch | null> {
        const q = query(
            collection(db, COL.POS_SALES_BATCHES),
            where('fileHash', '==', fileHash),
            where('businessUnitId', '==', businessUnitId)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const docData = snapshot.docs[0];
        return { id: docData.id, ...docData.data() } as PosImportBatch;
    }

    // ================================================================
    // SMART MATCHING
    // ================================================================

    /**
     * Match parsed rows to FINISHED_GOOD inventory items
     * Strategy: exact match first, then case-insensitive contains
     */
    static async matchItemsToInventory(
        rows: PosImportRow[],
        businessUnitId: string
    ): Promise<{ mappedRows: PosImportMappedRow[]; inventoryItems: (InventoryItem & { id: string })[] }> {

        // Fetch all FINISHED_GOOD items for this business unit
        const q = query(
            collection(db, COL.INVENTORY_ITEMS),
            where('businessUnitId', '==', businessUnitId),
            where('type', '==', 'FINISHED_GOOD'),
            where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        const inventoryItems = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as (InventoryItem & { id: string })[];

        const mappedRows: PosImportMappedRow[] = rows.map((row, index) => {
            const normalizedName = row.itemName.toLowerCase().trim();

            // Priority 1: Exact match (case-insensitive)
            let match = inventoryItems.find(item =>
                item.name.toLowerCase().trim() === normalizedName
            );

            // Priority 2: Contains match
            if (!match) {
                match = inventoryItems.find(item =>
                    item.name.toLowerCase().trim().includes(normalizedName) ||
                    normalizedName.includes(item.name.toLowerCase().trim())
                );
            }

            const newStock = match ? (match.theoreticalStock ?? match.currentStock) - row.qtySold : null;

            // Override costs with recipe-derived costPerUnit when matched
            const recipeCost = match ? (match.costPerUnit ?? 0) * row.qtySold : row.costs;
            const recipeProfit = match ? row.amount - recipeCost : row.profit;

            return {
                ...row,
                costs: recipeCost,
                profit: recipeProfit,
                rowIndex: index,
                matchedItemId: match?.id || null,
                matchedItemName: match?.name || null,
                matchStatus: match ? 'MATCHED' : 'UNMATCHED',
                currentStock: match ? (match.theoreticalStock ?? match.currentStock) : null,
                negativeStockFlag: newStock !== null ? newStock < 0 : false,
            };
        });

        return { mappedRows, inventoryItems };
    }

    // ================================================================
    // SIMULATED IMPORT (DRY RUN)
    // ================================================================

    /**
     * Simulate a POS import without writing to Firestore.
     * Useful for seeing what BOM explosion (theoreticalStock deductions) will happen.
     */
    static async simulatePosImport(
        mappedRows: PosImportMappedRow[],
        allItemsMap: Map<string, InventoryItem & { id: string }>
    ): Promise<SimulatedDeduction[]> {
        const rowsToCommit = mappedRows.filter(r => r.matchedItemId !== null);
        const simulatedDeductions: SimulatedDeduction[] = [];

        // Running theoretical stock tracker — shared across all POS rows
        // so cumulative deductions are applied correctly
        const runningStock = new Map<string, number>();

        for (const row of rowsToCommit) {
            const fgItem = allItemsMap.get(row.matchedItemId!);
            if (!fgItem) continue;

            // FINISHED_GOOD is a pure routing mechanism — do NOT add it to the
            // deduction map and do NOT touch its theoreticalStock.
            // Only explode its recipe into underlying ingredients.
            this.simulateRecursiveBOM(
                fgItem,
                row.qtySold,
                row.matchedItemId!,
                row.matchedItemName || row.itemName, // pass FG name for context
                allItemsMap,
                runningStock,
                simulatedDeductions
            );
        }

        return simulatedDeductions;
    }

    private static simulateRecursiveBOM(
        item: InventoryItem & { id: string },
        multiplier: number,
        parentItemId: string,
        parentItemName: string, // FG or PRODUCTION name, for audit note context
        allItemsMap: Map<string, InventoryItem & { id: string }>,
        runningStock: Map<string, number>,
        simulatedDeductions: SimulatedDeduction[]
    ) {
        if (!item.recipe || item.recipe.length === 0) return;

        for (const ingredient of item.recipe) {
            const ingredientItem = allItemsMap.get(ingredient.ingredientId);
            if (!ingredientItem) continue;

            const totalDeduction = ingredient.quantityUsed * multiplier;

            const currentStock = runningStock.has(ingredientItem.id)
                ? runningStock.get(ingredientItem.id)!
                : (ingredientItem.theoreticalStock ?? ingredientItem.currentStock ?? 0);

            if (ingredientItem.type === 'RAW_MATERIAL') {
                const newStock = currentStock - totalDeduction;
                runningStock.set(ingredientItem.id, newStock);

                simulatedDeductions.push({
                    itemId: ingredientItem.id,
                    itemName: ingredientItem.name,
                    type: 'RM',
                    currentTheoreticalStock: currentStock,
                    deductionAmount: totalDeduction,
                    newTheoreticalStock: newStock,
                    parentItemId,
                    parentItemName,
                });
            } else if (ingredientItem.type === 'PRODUCTION') {
                // PRODUCTION sub-assemblies are routing nodes — show them in the
                // preview hierarchy but do NOT deduct their own stock.
                simulatedDeductions.push({
                    itemId: ingredientItem.id,
                    itemName: ingredientItem.name,
                    type: 'PRODUCTION',
                    currentTheoreticalStock: currentStock,
                    deductionAmount: totalDeduction,
                    newTheoreticalStock: currentStock, // unchanged
                    parentItemId,
                    parentItemName,
                });

                // Recurse into the sub-assembly's own recipe
                this.simulateRecursiveBOM(
                    ingredientItem,
                    totalDeduction,
                    ingredientItem.id,
                    ingredientItem.name,
                    allItemsMap,
                    runningStock,
                    simulatedDeductions
                );
            }
        }
    }

    // ================================================================
    // COMMIT IMPORT (BATCH WRITE)
    // ================================================================

    /**
     * Commit all matched rows to Firestore using batch writes
     * Creates: pos_sales docs, stock_transactions docs, updates inventory_items
     * Also creates a pos_sales_batches metadata doc for idempotency
     *
     * BOM EXPLOSION: For each Finished Good with a recipe[], raw material
     * theoreticalStock is reduced by (ingredient.quantityUsed × qtySold)
     * and THEORETICAL_USAGE stock_transactions are logged for the audit trail.
     *
     * Rows with matchedItemId === null are SKIPPED (unmatched)
     */
    static async commitImport(params: {
        mappedRows: PosImportMappedRow[];
        businessUnitId: string;
        userId: string;
        userName: string;
        fileHash: string;
        fileName: string;
        importDate: string;
    }): Promise<string> {
        const { mappedRows, businessUnitId, userId, userName, fileHash, fileName, importDate } = params;

        // Only process matched rows
        const rowsToCommit = mappedRows.filter(r => r.matchedItemId !== null);
        if (rowsToCommit.length === 0) {
            throw new Error('No matched rows to import. Please match at least one item.');
        }

        // ================================================================
        // STEP A: Pre-fetch ALL inventory items for this BU (FG + RAW_MATERIAL)
        // so we have recipes and raw material stock in memory
        // ================================================================
        const allItemsQuery = query(
            collection(db, COL.INVENTORY_ITEMS),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const allItemsSnap = await getDocs(allItemsQuery);
        const allItemsMap = new Map<string, InventoryItem & { id: string }>();
        allItemsSnap.docs.forEach(d => {
            allItemsMap.set(d.id, { id: d.id, ...d.data() } as InventoryItem & { id: string });
        });

        // ================================================================
        // STEP B: BOM Explosion — aggregate raw material deductions.
        // RULE: FINISHED_GOOD is only a routing mechanism.
        //   - Do NOT deduct FG theoreticalStock.
        //   - Do NOT write stock_transactions for the FG.
        //   - ONLY deduct the underlying RAW_MATERIAL (and recursed PRODUCTION) ingredients.
        // ================================================================
        const rmDeductionMap = new Map<string, { totalQty: number; fgName: string }>();

        const recursiveExplosion = (
            itemArg: InventoryItem & { id: string },
            multiplier: number,
            rootFgName: string // for audit notes: "Deducted Xg Beef Patty for POS Sale: Cheeseburger"
        ) => {
            if (!itemArg.recipe || itemArg.recipe.length === 0) return;
            for (const ingredient of itemArg.recipe) {
                const iItem = allItemsMap.get(ingredient.ingredientId);
                if (!iItem) continue;
                const ded = ingredient.quantityUsed * multiplier;

                if (iItem.type === 'RAW_MATERIAL') {
                    const prev = rmDeductionMap.get(ingredient.ingredientId);
                    rmDeductionMap.set(ingredient.ingredientId, {
                        totalQty: (prev?.totalQty ?? 0) + ded,
                        fgName: prev?.fgName ?? rootFgName, // keep first FG for single-item batches
                    });
                } else if (iItem.type === 'PRODUCTION') {
                    // Route through PRODUCTION — do not add to deduction map itself
                    recursiveExplosion(iItem, ded, rootFgName);
                }
                // FINISHED_GOOD nested inside a recipe is unusual but handled the same way
            }
        };

        for (const row of rowsToCommit) {
            const fgItem = allItemsMap.get(row.matchedItemId!);
            if (!fgItem) continue;
            const fgName = row.matchedItemName || row.itemName;
            recursiveExplosion(fgItem, row.qtySold, fgName);
        }

        // Pre-load raw material theoretical stock for balanceAfter calculation
        const rmStockMap = new Map<string, number>();
        for (const [rmId] of rmDeductionMap) {
            const rmItem = allItemsMap.get(rmId);
            if (rmItem) {
                rmStockMap.set(rmId, rmItem.theoreticalStock ?? rmItem.currentStock ?? 0);
            }
        }

        // Generate batch import ID
        const batchDocRef = doc(collection(db, COL.POS_SALES_BATCHES));
        const batchImportId = batchDocRef.id;

        // Build batch writes — Firestore limit is 500 ops per batch
        const MAX_OPS = 490;

        const batches: ReturnType<typeof writeBatch>[] = [];
        let currentBatch = writeBatch(db);
        let opCount = 0;

        const ensureBatch = () => {
            if (opCount >= MAX_OPS) {
                batches.push(currentBatch);
                currentBatch = writeBatch(db);
                opCount = 0;
            }
        };

        // ================================================================
        // STEP C: Write pos_sales docs (for reporting only — no FG stock changes)
        // ================================================================
        for (const row of rowsToCommit) {
            const saleRef = doc(collection(db, COL.POS_SALES));
            ensureBatch();
            currentBatch.set(saleRef, {
                batchImportId,
                businessUnitId,
                inventoryItemId: row.matchedItemId,
                inventoryItemName: row.matchedItemName || row.itemName,
                category: row.category,
                qtySold: row.qtySold,
                amount: row.amount,
                costs: row.costs,
                profit: row.profit,
                negativeStockFlag: false, // FG stock is not tracked
                importDate,
                createdAt: Timestamp.now(),
            });
            opCount++;
            // NOTE: No POS_SALE stock_transaction for the FINISHED_GOOD.
            // FG is a routing mechanism only — its stock is derived from raw material availability.
        }

        // ================================================================
        // STEP D: BOM Explosion writes — raw material deductions only
        // Notes include the originating Finished Good name for full audit trail.
        // ================================================================
        const runningRmStock = new Map<string, number>();
        for (const [rmId, stock] of rmStockMap) {
            runningRmStock.set(rmId, stock);
        }

        for (const [rmId, { totalQty, fgName }] of rmDeductionMap) {
            const rmItem = allItemsMap.get(rmId);
            if (!rmItem) continue;

            const theoStock = runningRmStock.get(rmId) ?? 0;
            const newTheoStock = theoStock - totalQty;
            runningRmStock.set(rmId, newTheoStock);

            // Write THEORETICAL_USAGE stock transaction
            const rmTxRef = doc(collection(db, COL.STOCK_TRANSACTIONS));
            ensureBatch();
            currentBatch.set(rmTxRef, {
                itemId: rmId,
                itemName: rmItem.name,
                businessUnitId,
                type: 'THEORETICAL_USAGE',
                quantity: totalQty,
                unitCost: rmItem.costPerUnit ?? 0,           // cost per count unit (for dashboard KPI)
                totalValue: totalQty * (rmItem.costPerUnit ?? 0), // pre-computed ₱ value for fast aggregation
                balanceAfter: newTheoStock,
                referenceId: batchImportId,
                notes: `Deducted ${totalQty} ${rmItem.units?.countUnit ?? ''} ${rmItem.name} for POS Sale: ${fgName} (${fileName})`,
                performedBy: userId,
                performedByName: userName,
                timestamp: Timestamp.now(),
                createdAt: Timestamp.now(), // duplicate for query compatibility
            });
            opCount++;

            // Update raw material theoreticalStock
            ensureBatch();
            currentBatch.update(doc(db, COL.INVENTORY_ITEMS, rmId), {
                theoreticalStock: newTheoStock,
                updatedAt: Timestamp.now(),
            });
            opCount++;
        }

        // 3. Write batch metadata
        const totalAmount = rowsToCommit.reduce((sum, r) => sum + r.amount, 0);
        const totalProfit = rowsToCommit.reduce((sum, r) => sum + r.profit, 0);

        ensureBatch();
        currentBatch.set(batchDocRef, {
            businessUnitId,
            fileHash,
            fileName,
            totalRows: rowsToCommit.length,
            matchedRows: rowsToCommit.length,
            totalAmount,
            totalProfit,
            importedBy: userId,
            importedByName: userName,
            importedAt: Timestamp.now(),
        });
        opCount++;

        // Push final batch
        batches.push(currentBatch);

        // Commit all batches
        try {
            for (const batch of batches) {
                await batch.commit();
            }
            return batchImportId;
        } catch (error) {
            console.error('POS Import batch commit failed:', error);
            throw new Error('Failed to commit POS import. No data was written. Please try again.');
        }
    }

    // ================================================================
    // IMPORT HISTORY
    // ================================================================

    /**
     * Get past import batches for a business unit
     */
    static async getImportHistory(businessUnitId: string): Promise<PosImportBatch[]> {
        const q = query(
            collection(db, COL.POS_SALES_BATCHES),
            where('businessUnitId', '==', businessUnitId)
        );
        const snapshot = await getDocs(q);
        const batches = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as PosImportBatch[];

        // Sort by importedAt descending (client-side to avoid composite index)
        return batches.sort((a, b) => {
            const aTime = a.importedAt?.toMillis?.() ?? 0;
            const bTime = b.importedAt?.toMillis?.() ?? 0;
            return bTime - aTime;
        });
    }

    /**
     * Get individual sale records for a specific import batch
     */
    static async getSalesByBatchId(batchImportId: string): Promise<PosSaleRecord[]> {
        const q = query(
            collection(db, COL.POS_SALES),
            where('batchImportId', '==', batchImportId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as PosSaleRecord[];
    }

    /**
     * Get all sales records for a business unit
     */
    static async getAllSales(businessUnitId: string): Promise<PosSaleRecord[]> {
        const q = query(
            collection(db, COL.POS_SALES),
            where('businessUnitId', '==', businessUnitId)
        );
        const snapshot = await getDocs(q);
        const sales = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as PosSaleRecord[];

        return sales.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? 0;
            return bTime - aTime;
        });
    }

    /**
     * Get sales records for a business unit within a date range
     */
    static async getSalesByDateRange(
        businessUnitId: string,
        start: Date,
        end: Date
    ): Promise<PosSaleRecord[]> {
        const q = query(
            collection(db, COL.POS_SALES),
            where('businessUnitId', '==', businessUnitId),
            where('createdAt', '>=', Timestamp.fromDate(start)),
            where('createdAt', '<=', Timestamp.fromDate(end))
        );
        const snapshot = await getDocs(q);
        const sales = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as PosSaleRecord[];

        return sales.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? 0;
            return bTime - aTime;
        });
    }
}
