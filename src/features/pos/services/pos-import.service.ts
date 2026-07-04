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
    static async parseFile(file: File): Promise<{ rows: PosImportRow[]; hasAmountColumn: boolean; rawRowCount: number; consolidatedCount: number }> {
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
            else if (['amount', 'total', 'sales', 'gross sales', 'net sales', 'revenue',
                       'price', 'total sales', 'total amount', 'net amount', 'gross amount',
                       'selling price', 'sell price'].includes(normalized)) headerMap[key] = 'amount';
            else if (normalized === 'costs' || normalized === 'cost') headerMap[key] = 'costs';
            else if (normalized === 'profit' || normalized === 'net') headerMap[key] = 'profit';
            else if (normalized === 'discount' || normalized === 'discounts') headerMap[key] = 'discount';
        }

        // Debug: log header mapping for troubleshooting
        console.log('[POS Import] File columns:', Object.keys(firstRow));
        console.log('[POS Import] Mapped headers:', JSON.stringify(headerMap));

        // Check if the file has an amount column
        const mappedFields = Object.values(headerMap);
        const hasAmountColumn = mappedFields.includes('amount');

        // Validate minimum required columns (amount is now optional)
        const requiredFields: { key: keyof PosImportRow; display: string }[] = [
            { key: 'itemName', display: 'ITEM NAME' },
            { key: 'qtySold',  display: 'QTY SOLD'  },
        ];
        const missing = requiredFields.filter(f => !mappedFields.includes(f.key)).map(f => f.display);
        if (missing.length > 0) {
            throw new Error(
                `Missing required column(s): ${missing.join(', ')}. ` +
                `Columns found in file: ${Object.keys(firstRow).join(', ')}`
            );
        }

        if (!hasAmountColumn) {
            console.warn('[POS Import] No amount column found — will auto-fill from FG selling prices during matching.');
        }

        // Helper: safely parse numbers that may contain currency symbols, commas, or whitespace
        const parseNumber = (val: unknown): number => {
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            if (!val) return 0;
            // Strip currency symbols (₱, $, €, etc.), commas, spaces
            const cleaned = String(val).replace(/[₱$€¥£,\s]/g, '').trim();
            const num = Number(cleaned);
            return isNaN(num) ? 0 : num;
        };

        // Map rows to typed objects
        const parsed = rawRows.map((raw) => {
            const getVal = (field: keyof PosImportRow) =>
                raw[Object.keys(headerMap).find(k => headerMap[k] === field) || ''];

            const row: PosImportRow = {
                category: String(getVal('category') || '').trim(),
                itemName: String(getVal('itemName') || '').trim(),
                qtySold: parseNumber(getVal('qtySold')),
                qtyFoc: 0,   // Always starts at 0 — user sets this in the preview UI
                discount: parseNumber(getVal('discount')),
                isDirectSale: false,
                amount: parseNumber(getVal('amount')),
                costs: parseNumber(getVal('costs')),
                profit: parseNumber(getVal('profit')),
            };
            
            // If discount is provided in file, ensure it deducts from amount and profit
            if (row.discount > 0) {
                row.amount = Math.max(0, row.amount - row.discount);
                row.profit = row.amount - row.costs;
            }
            
            return row;
        }).filter(row => row.itemName && row.qtySold > 0); // Skip empty/zero rows

        const rawRowCount = parsed.length;

        // ── SMART CONSOLIDATION ──────────────────────────────────────
        // Group rows with the same item name (case-insensitive) and sum
        // their qtySold, amount, costs, and profit into a single row.
        // This turns e.g. 9 "BOTTLED WATER" lines into 1 consolidated row.
        const consolidationMap = new Map<string, PosImportRow>();
        for (const row of parsed) {
            const key = row.itemName.toUpperCase().trim();
            const existing = consolidationMap.get(key);
            if (existing) {
                existing.qtySold += row.qtySold;
                existing.amount += row.amount;
                existing.costs += row.costs;
                existing.profit += row.profit;
                existing.discount += row.discount;
                // Keep the first-seen category (they should be the same item)
            } else {
                // Clone the row so we don't mutate the original
                consolidationMap.set(key, { ...row });
            }
        }
        const consolidated = Array.from(consolidationMap.values());

        // Debug: log consolidation stats
        if (consolidated.length > 0) {
            console.log(`[POS Import] Consolidated ${rawRowCount} raw rows → ${consolidated.length} unique items`);
            console.log('[POS Import] Sample consolidated rows:', consolidated.slice(0, 3));
            console.log('[POS Import] Has amount column:', hasAmountColumn);
        }

        return { rows: consolidated, hasAmountColumn, rawRowCount, consolidatedCount: consolidated.length };
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
        businessUnitId: string,
        hasAmountColumn: boolean = true
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

        // Always pre-fetch menu items for accurate selling prices (SRP) and recipe costs
        // MenuItem.sellingPrice = the retail price (SRP)
        // MenuItem.calculatedCost = sum of all ingredient costs = the FG recipe cost per unit
        const menuSellingPriceMap = new Map<string, number>();
        const menuCostMap = new Map<string, number>();
        try {
            const menuQuery = query(
                collection(db, 'menu_items'),
                where('businessUnitId', '==', businessUnitId),
                where('isActive', '==', true)
            );
            const menuSnap = await getDocs(menuQuery);
            menuSnap.docs.forEach(d => {
                const data = d.data();
                // Map by linkedInventoryItemId so we can look up by FG inventory id
                if (data.linkedInventoryItemId) {
                    if (data.sellingPrice > 0) {
                        menuSellingPriceMap.set(data.linkedInventoryItemId, data.sellingPrice);
                    }
                    // calculatedCost is the FG recipe cost (sum of all ingredient totalCost)
                    if ((data.calculatedCost ?? 0) > 0) {
                        menuCostMap.set(data.linkedInventoryItemId, data.calculatedCost);
                    }
                }
            });
            console.log(`[POS Import] Loaded ${menuSellingPriceMap.size} selling prices, ${menuCostMap.size} recipe costs.`);
        } catch (err) {
            console.warn('[POS Import] Could not load menu items for selling price lookup:', err);
        }

        // Inject sellingPrice and baseCost onto each inventory item so the dashboard can
        // access both during manual re-matching without a second Firestore fetch.
        // baseCost priority: menu_items.calculatedCost > InventoryItem.baseCost (legacy)
        const enrichedItems = inventoryItems.map(item => ({
            ...item,
            sellingPrice: menuSellingPriceMap.get(item.id) ?? undefined,
            baseCost: menuCostMap.get(item.id) ?? item.baseCost ?? undefined,
        }));

        const mappedRows: PosImportMappedRow[] = rows.map((row, index) => {
            const normalizedName = row.itemName.toLowerCase().trim();

            // Priority 1: Exact match (case-insensitive)
            let match = enrichedItems.find(item =>
                item.name.toLowerCase().trim() === normalizedName
            );

            // Priority 2: Contains match
            if (!match) {
                match = enrichedItems.find(item =>
                    item.name.toLowerCase().trim().includes(normalizedName) ||
                    normalizedName.includes(item.name.toLowerCase().trim())
                );
            }

            // For FGs WITH recipes, stock deductions happen at the ingredient level (BOM explosion),
            // NOT at the FG level. So only check negative stock for recipe-less FGs (direct deduction).
            const hasRecipe = match?.recipe && match.recipe.length > 0;
            const newStock = match && !hasRecipe
                ? (match.theoreticalStock ?? match.currentStock ?? 0) - row.qtySold
                : null;

            // AMOUNT = (QTY SOLD - FOC QTY) × Selling Price (SRP from menu engineering)
            // FOC items are given free — they reduce billable revenue but raw material is still consumed.
            const billedQty = Math.max(0, row.qtySold - (row.qtyFoc ?? 0));
            let resolvedAmount = row.amount;
            let amountSource: 'file' | 'selling_price' = 'file';

            if (match && (!hasAmountColumn || row.amount === 0)) {
                const srp = match.sellingPrice ?? 0; // injected above from menu_items
                if (srp > 0) {
                    resolvedAmount = srp * billedQty;
                    amountSource = 'selling_price';
                }
            }

            // COST = QTY SOLD × baseCost (FG recipe cost from menu_items.calculatedCost)
            // Full qtySold used — FOC items still consume raw materials
            const unitCost = match ? (match.baseCost ?? 0) : 0;
            const recipeCost = match ? unitCost * row.qtySold : row.costs;

            // PROFIT = AMOUNT − COST
            const recipeProfit = match ? resolvedAmount - recipeCost : row.profit;

            return {
                ...row,
                amount: resolvedAmount,
                costs: recipeCost,
                profit: recipeProfit,
                rowIndex: index,
                matchedItemId: match?.id || null,
                matchedItemName: match?.name || null,
                matchStatus: match ? 'MATCHED' : 'UNMATCHED',
                currentStock: match ? (match.theoreticalStock ?? match.currentStock) : null,
                negativeStockFlag: newStock !== null ? newStock < 0 : false,
                amountSource,
            };
        });

        return { mappedRows, inventoryItems: enrichedItems };
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

            // Direct Sale: Bypass stock deduction simulation
            if (row.isDirectSale) {
                continue;
            }

            // Deduction qty = qtySold (all prepared items, FOC is a revenue-reducing subset)
            // FOC reduces AMOUNT=(qtySold-FOC)*SRP, but ALL items consume raw materials
            const totalQty = row.qtySold;

            if (fgItem.recipe && fgItem.recipe.length > 0) {
                // Push the FG header so the preview modal can group children under it
                const safeStockFG = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? v : 0;
                const fgCurrent = safeStockFG(fgItem.theoreticalStock) || safeStockFG(fgItem.currentStock);
                simulatedDeductions.push({
                    itemId: fgItem.id,
                    itemName: fgItem.name,
                    type: 'FG',
                    currentTheoreticalStock: fgCurrent,
                    deductionAmount: 0, // FG stock is not deducted — only ingredients
                    newTheoreticalStock: fgCurrent, // unchanged
                    parentItemId: row.matchedItemId!,
                    parentItemName: row.matchedItemName || row.itemName,
                });

                // FG has a recipe — explode into underlying ingredient deductions
                // Use totalQty so FOC items also consume raw materials
                this.simulateRecursiveBOM(
                    fgItem,
                    totalQty,
                    row.matchedItemId!,
                    row.matchedItemName || row.itemName,
                    allItemsMap,
                    runningStock,
                    simulatedDeductions
                );
            } else {
                // No recipe — deduct the FINISHED_GOOD's own stock directly
                // (e.g., bottled retail items, simple countable products)
                const safeStock = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? v : 0;
                const currentStock = runningStock.has(fgItem.id)
                    ? runningStock.get(fgItem.id)!
                    : safeStock(fgItem.theoreticalStock) || safeStock(fgItem.currentStock);
                const newStock = currentStock - totalQty;
                runningStock.set(fgItem.id, newStock);

                simulatedDeductions.push({
                    itemId: fgItem.id,
                    itemName: fgItem.name,
                    type: 'FG_DIRECT',
                    currentTheoreticalStock: currentStock,
                    deductionAmount: totalQty,
                    newTheoreticalStock: newStock,
                    parentItemId: row.matchedItemId!,
                    parentItemName: row.matchedItemName || row.itemName,
                });
            }
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

            const safeStock = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? v : 0;

            const currentStock = runningStock.has(ingredientItem.id)
                ? runningStock.get(ingredientItem.id)!
                : safeStock(ingredientItem.theoreticalStock) || safeStock(ingredientItem.currentStock);

            if (ingredientItem.type === 'RAW_MATERIAL' || ingredientItem.type === 'FINISHED_GOOD') {
                // Direct deduction — allow negative stock
                const newStock = currentStock - totalDeduction;
                runningStock.set(ingredientItem.id, newStock);

                simulatedDeductions.push({
                    itemId: ingredientItem.id,
                    itemName: ingredientItem.name,
                    type: ingredientItem.type === 'FINISHED_GOOD' ? 'FG_DIRECT' : 'RM',
                    currentTheoreticalStock: currentStock,
                    deductionAmount: totalDeduction,
                    newTheoreticalStock: newStock,
                    parentItemId,
                    parentItemName,
                });
            } else if (ingredientItem.type === 'PRODUCTION') {
                // ── AUTO-EXPLODE FALLBACK ──
                // Check if we have enough prep stock to fulfill the demand
                const availablePrep = Math.max(0, currentStock);
                const deductedFromPrep = Math.min(availablePrep, totalDeduction);
                const shortfall = totalDeduction - deductedFromPrep;

                if (deductedFromPrep > 0) {
                    // Deduct what we can from the prep item
                    const newPrepStock = currentStock - deductedFromPrep;
                    runningStock.set(ingredientItem.id, newPrepStock);

                    simulatedDeductions.push({
                        itemId: ingredientItem.id,
                        itemName: ingredientItem.name,
                        type: 'PRODUCTION',
                        currentTheoreticalStock: currentStock,
                        deductionAmount: deductedFromPrep,
                        newTheoreticalStock: newPrepStock,
                        parentItemId,
                        parentItemName,
                    });
                }

                if (shortfall > 0) {
                    // Not enough prep stock — auto-explode the shortfall into raw materials
                    if (deductedFromPrep === 0) {
                        // Zero stock — show the prep item with 0 deduction + alert
                        simulatedDeductions.push({
                            itemId: ingredientItem.id,
                            itemName: ingredientItem.name,
                            type: 'PRODUCTION',
                            currentTheoreticalStock: currentStock,
                            deductionAmount: 0,
                            newTheoreticalStock: currentStock,
                            parentItemId,
                            parentItemName,
                            alert: `⚠️ No production stock available. ${shortfall} units auto-exploded to raw materials below.`,
                        });
                    } else {
                        // Partial stock — update the existing deduction's alert
                        const lastDed = simulatedDeductions[simulatedDeductions.length - 1];
                        lastDed.alert = `⚠️ Only ${deductedFromPrep} of ${totalDeduction} available. ${shortfall} units auto-exploded to raw materials below.`;
                    }

                    // Recurse into the production item's recipe for the shortfall quantity
                    if (ingredientItem.recipe && ingredientItem.recipe.length > 0) {
                        for (const subIng of ingredientItem.recipe) {
                            const subItem = allItemsMap.get(subIng.ingredientId);
                            if (!subItem) continue;

                            const explodedQty = subIng.quantityUsed * shortfall;
                            const subCurrentStock = runningStock.has(subItem.id)
                                ? runningStock.get(subItem.id)!
                                : safeStock(subItem.theoreticalStock) || safeStock(subItem.currentStock);
                            const subNewStock = subCurrentStock - explodedQty;
                            runningStock.set(subItem.id, subNewStock);

                            simulatedDeductions.push({
                                itemId: subItem.id,
                                itemName: subItem.name,
                                type: 'RM',
                                currentTheoreticalStock: subCurrentStock,
                                deductionAmount: explodedQty,
                                newTheoreticalStock: subNewStock,
                                parentItemId,
                                parentItemName,
                                alert: `Auto-produced from ${ingredientItem.name} — no production record found`,
                            });
                        }
                    }
                }
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
    /**
     * Convert a "YYYY-MM-DD" string into a Firestore Timestamp at midnight LOCAL time.
     * This ensures that the selected import date is stored correctly regardless of timezone.
     */
    private static importDateToTimestamp(dateStr: string): Timestamp {
        // Parse as local date (not UTC) by splitting the parts
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day, 0, 0, 0, 0); // local midnight
        return Timestamp.fromDate(d);
    }

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

        // Convert the user-selected date once — used for ALL Firestore timestamps
        // so that history filtering and reports show records under the correct date.
        const importDateTs = PosImportService.importDateToTimestamp(importDate);

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
        // Track recipe-less FGs that need direct stock deduction
        const fgDirectDeductionMap = new Map<string, { totalQty: number; fgName: string }>();

        // Running stock tracker for PRODUCTION items to support auto-explode fallback
        const safeNum = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? v : 0;
        const prodRunningStock = new Map<string, number>();
        for (const [, item] of allItemsMap) {
            if (item.type === 'PRODUCTION') {
                prodRunningStock.set(item.id, safeNum(item.theoreticalStock) || safeNum(item.currentStock));
            }
        }

        // Track unrecorded production logs for database alert
        interface AutoProductionLog {
            productionItemId: string;
            productionItemName: string;
            shortageQty: number;
            finishedGoodName: string;
            rawMaterialsExploded: { itemId: string; itemName: string; qty: number; unit: string }[];
        }
        const autoProductionLogs: AutoProductionLog[] = [];

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

                if (iItem.type === 'RAW_MATERIAL' || iItem.type === 'FINISHED_GOOD') {
                    const prev = rmDeductionMap.get(ingredient.ingredientId);
                    rmDeductionMap.set(ingredient.ingredientId, {
                        totalQty: (prev?.totalQty ?? 0) + ded,
                        fgName: prev?.fgName ?? rootFgName,
                    });
                } else if (iItem.type === 'PRODUCTION') {
                    // ── AUTO-EXPLODE FALLBACK ──
                    const currentPrepStock = prodRunningStock.get(iItem.id) ?? 0;
                    const availablePrep = Math.max(0, currentPrepStock);
                    const deductedFromPrep = Math.min(availablePrep, ded);
                    const shortfall = ded - deductedFromPrep;

                    if (deductedFromPrep > 0) {
                        // Deduct from prep stock
                        prodRunningStock.set(iItem.id, currentPrepStock - deductedFromPrep);
                        const prev = rmDeductionMap.get(ingredient.ingredientId);
                        rmDeductionMap.set(ingredient.ingredientId, {
                            totalQty: (prev?.totalQty ?? 0) + deductedFromPrep,
                            fgName: prev?.fgName ?? rootFgName,
                        });
                    }

                    if (shortfall > 0) {
                        // Auto-explode the shortfall into raw materials
                        if (deductedFromPrep === 0) {
                            prodRunningStock.set(iItem.id, currentPrepStock); // unchanged
                        }

                        const explodedRMs: AutoProductionLog['rawMaterialsExploded'] = [];

                        if (iItem.recipe && iItem.recipe.length > 0) {
                            for (const subIng of iItem.recipe) {
                                const subItem = allItemsMap.get(subIng.ingredientId);
                                if (!subItem) continue;

                                const explodedQty = subIng.quantityUsed * shortfall;
                                const prev = rmDeductionMap.get(subIng.ingredientId);
                                rmDeductionMap.set(subIng.ingredientId, {
                                    totalQty: (prev?.totalQty ?? 0) + explodedQty,
                                    fgName: prev?.fgName ?? `${rootFgName} (auto-produced ${iItem.name})`,
                                });

                                explodedRMs.push({
                                    itemId: subItem.id,
                                    itemName: subItem.name,
                                    qty: explodedQty,
                                    unit: subIng.unit || subItem.units?.recipeUnit || '',
                                });
                            }
                        }

                        // Queue the unrecorded production log
                        autoProductionLogs.push({
                            productionItemId: iItem.id,
                            productionItemName: iItem.name,
                            shortageQty: shortfall,
                            finishedGoodName: rootFgName,
                            rawMaterialsExploded: explodedRMs,
                        });
                    }
                }
            }
        };

        for (const row of rowsToCommit) {
            const fgItem = allItemsMap.get(row.matchedItemId!);
            if (!fgItem) continue;
            const fgName = row.matchedItemName || row.itemName;

            // Direct Sale: Bypass stock deductions
            if (row.isDirectSale) {
                continue;
            }

            // Deduction qty = qtySold — FOC is a subset of sold qty that removes revenue,
            // not an additive quantity. All prepared items (including FOC) consume raw materials.
            const totalQty = row.qtySold;

            if (fgItem.recipe && fgItem.recipe.length > 0) {
                // Has recipe — explode into raw material deductions using totalQty
                recursiveExplosion(fgItem, totalQty, fgName);
            } else {
                // No recipe — track for direct FG stock deduction using totalQty
                const prev = fgDirectDeductionMap.get(row.matchedItemId!);
                fgDirectDeductionMap.set(row.matchedItemId!, {
                    totalQty: (prev?.totalQty ?? 0) + totalQty,
                    fgName: prev?.fgName ?? fgName,
                });
            }
        }

        // Pre-load raw material theoretical stock for balanceAfter calculation
        const rmStockMap = new Map<string, number>();
        for (const [rmId] of rmDeductionMap) {
            const rmItem = allItemsMap.get(rmId);
            if (rmItem) {
                rmStockMap.set(rmId, safeNum(rmItem.theoreticalStock) || safeNum(rmItem.currentStock));
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
                qtyFoc: row.qtyFoc ?? 0,
                amount: row.amount,
                costs: row.costs,
                profit: row.profit,
                negativeStockFlag: false, // FG stock is not tracked
                importDate,
                // Use the user-selected date (not now) so report date filters work correctly
                createdAt: importDateTs,
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
                unitCost: rmItem.costPerUnit ?? 0,
                totalValue: totalQty * (rmItem.costPerUnit ?? 0),
                balanceAfter: newTheoStock,
                referenceId: batchImportId,
                notes: `Deducted ${totalQty} ${rmItem.units?.recipeUnit ?? ''} ${rmItem.name} for POS Sale: ${fgName} (${fileName})`,
                performedBy: userId,
                performedByName: userName,
                // Use importDate so stock transaction history matches the selected date
                timestamp: importDateTs,
                createdAt: importDateTs,
            });
            opCount++;

            // Update raw material stock — both currentStock and theoreticalStock
            // so POS deductions are immediately visible in the Inventory Items view.
            ensureBatch();
            const rmCurrentStock = safeNum(rmItem.currentStock);
            const newRmCurrentStock = rmCurrentStock - totalQty;
            currentBatch.update(doc(db, COL.INVENTORY_ITEMS, rmId), {
                currentStock: newRmCurrentStock,
                theoreticalStock: newTheoStock,
                updatedAt: importDateTs,
            });
            opCount++;
        }

        // ================================================================
        // STEP E: Direct FG deductions (no-recipe items)
        // These items are countable products (bottled goods, retail, etc.)
        // whose stock is tracked directly on the FINISHED_GOOD document.
        // ================================================================
        for (const [fgId, { totalQty }] of fgDirectDeductionMap) {
            const fgItem = allItemsMap.get(fgId);
            if (!fgItem) continue;

            const theoStock = safeNum(fgItem.theoreticalStock) || safeNum(fgItem.currentStock);
            const newTheoStock = theoStock - totalQty;

            // Write POS_SALE stock transaction for the FG itself
            const fgTxRef = doc(collection(db, COL.STOCK_TRANSACTIONS));
            ensureBatch();
            currentBatch.set(fgTxRef, {
                itemId: fgId,
                itemName: fgItem.name,
                businessUnitId,
                type: 'POS_SALE',
                quantity: totalQty,
                unitCost: fgItem.baseCost ?? fgItem.costPerUnit ?? 0,
                totalValue: totalQty * (fgItem.baseCost ?? fgItem.costPerUnit ?? 0),
                balanceAfter: newTheoStock,
                referenceId: batchImportId,
                notes: `Deducted ${totalQty} ${fgItem.units?.recipeUnit ?? ''} ${fgItem.name} — direct POS sale (no recipe) (${fileName})`,
                performedBy: userId,
                performedByName: userName,
                timestamp: importDateTs,
                createdAt: importDateTs,
            });
            opCount++;

            // Update FG stock — both currentStock and theoreticalStock.
            // Unlike BOM-exploded raw materials (which only adjust theoreticalStock
            // until a physical count reconciles them), no-recipe FG items are discrete
            // countable goods (bottles, retail packs) whose on-hand stock should
            // reflect POS deductions immediately.
            ensureBatch();
            const fgCurrentStock = safeNum(fgItem.currentStock);
            const newCurrentStock = fgCurrentStock - totalQty;
            currentBatch.update(doc(db, COL.INVENTORY_ITEMS, fgId), {
                currentStock: newCurrentStock,
                theoreticalStock: newTheoStock,
                updatedAt: importDateTs,
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
            importDate, // store the string for display
            // Use the selected date so history filtering shows records under the right day
            importedAt: importDateTs,
        });
        opCount++;

        // ================================================================
        // STEP F: Write UNRECORDED_AUTO_PRODUCTION alerts
        // When a PRODUCTION item had insufficient stock and was auto-exploded
        // into raw materials, log it so management can track unrecorded prep.
        // ================================================================
        for (const log of autoProductionLogs) {
            const logRef = doc(collection(db, 'production_logs'));
            ensureBatch();
            currentBatch.set(logRef, {
                id: logRef.id,
                businessUnitId,
                type: 'UNRECORDED_AUTO_PRODUCTION',
                productionItemId: log.productionItemId,
                productionItemName: log.productionItemName,
                shortageQuantity: log.shortageQty,
                finishedGoodSold: log.finishedGoodName,
                rawMaterialsExploded: log.rawMaterialsExploded,
                referenceId: batchImportId,
                referenceType: 'POS_IMPORT',
                fileName,
                importDate,
                notes: `⚠️ Auto-produced ${log.shortageQty} units of "${log.productionItemName}" from raw materials — no production batch was recorded before POS sale of "${log.finishedGoodName}"`,
                performedBy: userId,
                performedByName: userName,
                timestamp: importDateTs,
                createdAt: importDateTs,
            });
            opCount++;
        }

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

    /**
     * Delete an import batch and reverse inventory deductions.
     * Hard-coded for Super Admin use.
     *
     * What this does:
     * 1. Deletes all pos_sales docs for this batch
     * 2. Deletes all original stock_transactions (THEORETICAL_USAGE / POS_SALE) for this batch
     *    → This is critical: Recon and Variance reports query stock_transactions by date range.
     *      If we leave the originals behind, the deductions keep appearing in both reports
     *      even after the batch is "deleted".
     * 3. Adds a POS_REVERSAL audit transaction per item (for the ledger trail)
     * 4. Restores currentStock and theoreticalStock on each affected inventory item
     * 5. Deletes the batch metadata doc
     */
    static async deleteImportBatch(
        batchImportId: string,
        userId: string,
        userName: string
    ): Promise<void> {
        // 1. Get the batch metadata
        const batchRef = doc(db, COL.POS_SALES_BATCHES, batchImportId);

        // 2. Get all pos_sales for this batch
        const salesQuery = query(
            collection(db, COL.POS_SALES),
            where('batchImportId', '==', batchImportId)
        );
        const salesSnap = await getDocs(salesQuery);

        // 3. Get all original stock_transactions for this batch
        //    These are the THEORETICAL_USAGE and POS_SALE records written during commitImport.
        //    We must delete them so Recon/Variance queries no longer see them.
        const txQuery = query(
            collection(db, COL.STOCK_TRANSACTIONS),
            where('referenceId', '==', batchImportId)
        );
        const txSnap = await getDocs(txQuery);

        // 4. Calculate total deducted per item from the original transactions.
        //    We only want THEORETICAL_USAGE and POS_SALE (the deductions written on import).
        //    Skip any POS_REVERSAL rows (from a previous partial rollback attempt).
        const DEDUCTION_TYPES = new Set(['THEORETICAL_USAGE', 'POS_SALE']);
        const deductionsByItem = new Map<string, {
            qty: number;
            businessUnitId: string;
            unitCost: number;
            itemName: string;
        }>();

        txSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!DEDUCTION_TYPES.has(data.type)) return; // skip reversals / adjustments
            const itemId = data.itemId as string;
            const prev = deductionsByItem.get(itemId);
            deductionsByItem.set(itemId, {
                qty: (prev?.qty || 0) + Math.abs(data.quantity as number || 0),
                businessUnitId: data.businessUnitId,
                unitCost: data.unitCost || 0,
                itemName: data.itemName || 'Unknown Item',
            });
        });

        // 5. Fetch current inventory state for affected items (to compute new balances)
        const itemIds = Array.from(deductionsByItem.keys());
        const itemsMap = new Map<string, Partial<InventoryItem>>();

        const chunkArray = <T>(arr: T[], size: number): T[][] => {
            const chunks = [];
            for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
            return chunks;
        };

        for (const chunk of chunkArray(itemIds, 10)) {
            const q = query(
                collection(db, COL.INVENTORY_ITEMS),
                where('__name__', 'in', chunk)
            );
            const snap = await getDocs(q);
            snap.docs.forEach(d => itemsMap.set(d.id, d.data()));
        }

        // ================================================================
        // Build Firestore batches
        // ================================================================
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

        const now = Timestamp.now();
        const safeNum = (v: unknown): number =>
            typeof v === 'number' && Number.isFinite(v) ? v : 0;

        // 6. Delete all pos_sales docs
        salesSnap.docs.forEach(docSnap => {
            ensureBatch();
            currentBatch.delete(docSnap.ref);
            opCount++;
        });

        // 7. Delete the original stock_transactions (THEORETICAL_USAGE / POS_SALE).
        //    This is the key step — without this, Recon and Variance reports keep
        //    reading these deductions inside the date range and showing wrong numbers.
        txSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!DEDUCTION_TYPES.has(data.type)) return; // only delete the originals
            ensureBatch();
            currentBatch.delete(docSnap.ref);
            opCount++;
        });

        // 8. For each affected item: add a POS_REVERSAL audit record and restore stock
        for (const [itemId, info] of deductionsByItem.entries()) {
            const itemData = itemsMap.get(itemId);
            if (!itemData) continue;

            const currentTheo = safeNum(itemData.theoreticalStock);
            const currentPhys = safeNum(itemData.currentStock);

            // Restore: add back what was originally deducted
            const newTheoStock = currentTheo + info.qty;
            const newCurrentStock = currentPhys + info.qty;

            // Audit trail — POS_REVERSAL is NOT counted by Recon aggregation
            // (aggregatePosSales only reads THEORETICAL_USAGE and POS_SALE)
            const adjTxRef = doc(collection(db, COL.STOCK_TRANSACTIONS));
            ensureBatch();
            currentBatch.set(adjTxRef, {
                itemId,
                itemName: info.itemName,
                businessUnitId: info.businessUnitId,
                type: 'POS_REVERSAL',
                quantity: info.qty,   // positive = stock returned
                unitCost: info.unitCost,
                totalValue: info.qty * info.unitCost,
                balanceAfter: newTheoStock,
                referenceId: batchImportId,
                notes: `Reversed POS Import Batch ${batchImportId} — ${info.qty} ${info.itemName} returned to stock`,
                performedBy: userId,
                performedByName: userName,
                timestamp: now,
                createdAt: now,
            });
            opCount++;

            // Restore item stock fields
            const itemRef = doc(db, COL.INVENTORY_ITEMS, itemId);
            ensureBatch();
            currentBatch.update(itemRef, {
                currentStock: newCurrentStock,
                theoreticalStock: newTheoStock,
                updatedAt: now,
            });
            opCount++;
        }

        // 9. Delete the batch metadata document
        ensureBatch();
        currentBatch.delete(batchRef);
        opCount++;

        batches.push(currentBatch);

        for (const batch of batches) {
            await batch.commit();
        }
    }
}
