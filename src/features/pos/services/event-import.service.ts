import * as XLSX from 'xlsx';
import {
    collection, doc, getDocs, query, where, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import type {
    EventImportRow, EventImportMappedRow, EventImportBatch,
    EventSalesRecord, EventSimulatedDeduction, EventSaleItem,
} from '../types/event-sales.types';
import { EVENT_COL } from '../types/event-sales.types';

const COL = {
    STOCK_TRANSACTIONS: 'stock_transactions',
    INVENTORY_ITEMS: 'inventory_items',
    ...EVENT_COL,
} as const;

const safeNum = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? v : 0;

const fuzzyMatch = (input: string, target: string): boolean => {
    const a = input.toLowerCase().trim();
    const b = target.toLowerCase().trim();
    return a === b || b.includes(a) || a.includes(b);
};

const importDateToTimestamp = (dateStr: string): Timestamp => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return Timestamp.fromDate(new Date(year, month - 1, day, 0, 0, 0, 0));
};

const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export class EventImportService {

    static async generateFileHash(file: File): Promise<string> {
        return generateFileHash(file);
    }

    // ================================================================
    // FILE PARSING — Vertical line-item format
    // Row with EVENT DATE/EVENT NAME starts a new event.
    // Subsequent rows with only ITEM/QTY belong to the same event.
    // ================================================================

    static async parseFile(file: File): Promise<EventImportRow[]> {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawRows.length === 0) throw new Error('The uploaded file contains no data rows.');

        const headers = Object.keys(rawRows[0]).map(h => h.trim());
        const normalize = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

        const findCol = (keywords: string[]): string | null =>
            headers.find(h => keywords.some(kw => normalize(h).includes(normalize(kw)))) || null;

        const dateCol = findCol(['eventdate', 'date']);
        const nameCol = findCol(['eventname', 'event']);
        const pkgCol = findCol(['packagename', 'package']);
        const paxCol = findCol(['guestcount', 'pax', 'guests']);
        const itemCol = findCol(['item', 'itemname', 'product']);
        const qtyCol = findCol(['qty', 'quantity']);

        if (!itemCol) throw new Error('Missing required ITEM column.');

        const raw = (row: Record<string, unknown>, key: string | null): string =>
            key ? String(row[key] ?? '').trim() : '';

        const events: EventImportRow[] = [];
        let current: EventImportRow | null = null;

        for (const row of rawRows) {
            const eventName = raw(row, nameCol);
            const itemName = raw(row, itemCol);
            const qtyRaw = qtyCol ? Number(row[qtyCol]) : 0;
            const qty = Number.isFinite(qtyRaw) ? qtyRaw : 0;

            // If this row has an event name, start a new event
            if (eventName) {
                if (current && current.items.length > 0) events.push(current);
                current = {
                    eventDate: raw(row, dateCol),
                    eventName,
                    packageName: raw(row, pkgCol),
                    paxCount: paxCol ? (parseInt(String(row[paxCol]), 10) || 0) : 0,
                    items: [],
                };
            }

            // Add item to current event
            if (current && itemName) {
                current.items.push({ name: itemName, qty });
            }
        }

        // Push last event
        if (current && current.items.length > 0) events.push(current);
        if (events.length === 0) throw new Error('No valid events found in the file.');

        return events;
    }

    // ================================================================
    // SMART MATCHING
    // ================================================================

    static async matchRowsToInventory(
        rows: EventImportRow[],
        businessUnitId: string
    ): Promise<{
        mappedRows: EventImportMappedRow[];
        inventoryItems: (InventoryItem & { id: string })[];
    }> {
        const invQuery = query(
            collection(db, COL.INVENTORY_ITEMS),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const invSnap = await getDocs(invQuery);
        const inventoryItems = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem & { id: string }));

        const matchableItems = inventoryItems.filter(i =>
            i.type === 'FINISHED_GOOD' || i.type === 'PRODUCTION' || i.type === 'RAW_MATERIAL'
        );

        const matchItem = (text: string): { id: string; name: string } | null => {
            const exact = matchableItems.find(i => i.name.toLowerCase() === text.toLowerCase().trim());
            if (exact) return { id: exact.id, name: exact.name };
            const fuzzy = matchableItems.find(i => fuzzyMatch(text, i.name));
            if (fuzzy) return { id: fuzzy.id, name: fuzzy.name };
            return null;
        };

        const mappedRows: EventImportMappedRow[] = rows.map((row, idx) => {
            const resolvedItems = row.items.map(item => {
                const matched = matchItem(item.name);
                return {
                    inputText: item.name,
                    qty: item.qty,
                    matchedItemId: matched?.id ?? null,
                    matchedItemName: matched?.name ?? null,
                    matchStatus: matched ? 'MATCHED' as const : 'UNMATCHED' as const,
                };
            });

            const hasErrors = resolvedItems.some(i => i.matchStatus === 'UNMATCHED');

            return { ...row, rowIndex: idx, resolvedItems, hasErrors };
        });

        return { mappedRows, inventoryItems };
    }

    // ================================================================
    // BOM SIMULATION (DRY RUN)
    // ================================================================

    static async simulateEventImport(
        mappedRows: EventImportMappedRow[],
        allItemsMap: Map<string, InventoryItem & { id: string }>
    ): Promise<EventSimulatedDeduction[]> {
        const deductions: EventSimulatedDeduction[] = [];
        const runningStock = new Map<string, number>();

        for (const row of mappedRows) {
            const eventName = row.eventName;
            const demandMap = new Map<string, number>();

            for (const item of row.resolvedItems) {
                if (item.matchedItemId) {
                    demandMap.set(item.matchedItemId, (demandMap.get(item.matchedItemId) ?? 0) + item.qty);
                }
            }

            for (const [fgId, totalQty] of demandMap) {
                const fgItem = allItemsMap.get(fgId);
                if (!fgItem) continue;

                if (fgItem.recipe && fgItem.recipe.length > 0) {
                    deductions.push({
                        itemId: fgId, itemName: fgItem.name, type: 'FG',
                        currentTheoreticalStock: 0, deductionAmount: totalQty,
                        newTheoreticalStock: 0, eventName,
                    });
                    this.simulateRecursiveBOM(fgItem, totalQty, fgId, fgItem.name, eventName, allItemsMap, runningStock, deductions);
                } else {
                    const currentStock = runningStock.get(fgId) ?? (safeNum(fgItem.theoreticalStock) || safeNum(fgItem.currentStock));
                    const newStock = currentStock - totalQty;
                    runningStock.set(fgId, newStock);
                    deductions.push({
                        itemId: fgId, itemName: fgItem.name, type: 'FG_DIRECT',
                        currentTheoreticalStock: currentStock, deductionAmount: totalQty,
                        newTheoreticalStock: newStock, eventName,
                    });
                }
            }
        }

        return deductions;
    }

    private static simulateRecursiveBOM(
        item: InventoryItem & { id: string }, multiplier: number,
        parentItemId: string, parentItemName: string, eventName: string,
        allItemsMap: Map<string, InventoryItem & { id: string }>,
        runningStock: Map<string, number>, deductions: EventSimulatedDeduction[]
    ) {
        if (!item.recipe || item.recipe.length === 0) return;
        for (const ingredient of item.recipe) {
            const iItem = allItemsMap.get(ingredient.ingredientId);
            if (!iItem) continue;
            const totalDed = ingredient.quantityUsed * multiplier;
            const currentStock = runningStock.get(iItem.id) ?? (safeNum(iItem.theoreticalStock) || safeNum(iItem.currentStock));

            if (iItem.type === 'RAW_MATERIAL' || iItem.type === 'FINISHED_GOOD') {
                const newStock = currentStock - totalDed;
                runningStock.set(iItem.id, newStock);
                deductions.push({
                    itemId: iItem.id, itemName: iItem.name, type: iItem.type === 'FINISHED_GOOD' ? 'FG_DIRECT' : 'RM',
                    currentTheoreticalStock: currentStock, deductionAmount: totalDed,
                    newTheoreticalStock: newStock, parentItemId, parentItemName, eventName,
                });
            } else if (iItem.type === 'PRODUCTION') {
                // ── AUTO-EXPLODE FALLBACK ──
                const availablePrep = Math.max(0, currentStock);
                const deductedFromPrep = Math.min(availablePrep, totalDed);
                const shortfall = totalDed - deductedFromPrep;

                if (deductedFromPrep > 0) {
                    const newPrepStock = currentStock - deductedFromPrep;
                    runningStock.set(iItem.id, newPrepStock);
                    deductions.push({
                        itemId: iItem.id, itemName: iItem.name, type: 'PRODUCTION',
                        currentTheoreticalStock: currentStock, deductionAmount: deductedFromPrep,
                        newTheoreticalStock: newPrepStock, parentItemId, parentItemName, eventName,
                    });
                }

                if (shortfall > 0) {
                    if (deductedFromPrep === 0) {
                        deductions.push({
                            itemId: iItem.id, itemName: iItem.name, type: 'PRODUCTION',
                            currentTheoreticalStock: currentStock, deductionAmount: 0,
                            newTheoreticalStock: currentStock, parentItemId, parentItemName, eventName,
                            alert: `⚠️ No production stock available. ${shortfall} units auto-exploded to raw materials below.`,
                        });
                    } else {
                        const lastDed = deductions[deductions.length - 1];
                        lastDed.alert = `⚠️ Only ${deductedFromPrep} of ${totalDed} available. ${shortfall} units auto-exploded to raw materials below.`;
                    }

                    // Recurse into the production item's recipe for the shortfall
                    if (iItem.recipe && iItem.recipe.length > 0) {
                        for (const subIng of iItem.recipe) {
                            const subItem = allItemsMap.get(subIng.ingredientId);
                            if (!subItem) continue;

                            const explodedQty = subIng.quantityUsed * shortfall;
                            const subCurrentStock = runningStock.get(subItem.id) ?? (safeNum(subItem.theoreticalStock) || safeNum(subItem.currentStock));
                            const subNewStock = subCurrentStock - explodedQty;
                            runningStock.set(subItem.id, subNewStock);

                            deductions.push({
                                itemId: subItem.id, itemName: subItem.name, type: 'RM',
                                currentTheoreticalStock: subCurrentStock, deductionAmount: explodedQty,
                                newTheoreticalStock: subNewStock, parentItemId, parentItemName, eventName,
                                alert: `Auto-produced from ${iItem.name} — no production record found`,
                            });
                        }
                    }
                }
            }
        }
    }

    // ================================================================
    // COMMIT IMPORT (ATOMIC BATCH WRITES)
    // ================================================================

    static async commitImport(params: {
        mappedRows: EventImportMappedRow[];
        businessUnitId: string;
        userId: string;
        userName: string;
        fileHash: string;
        fileName: string;
    }): Promise<string> {
        const { mappedRows, businessUnitId, userId, userName, fileHash, fileName } = params;
        const rowsToCommit = mappedRows.filter(r => !r.hasErrors);
        if (rowsToCommit.length === 0) throw new Error('No matched events to import.');

        const allItemsQuery = query(
            collection(db, COL.INVENTORY_ITEMS),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const allItemsSnap = await getDocs(allItemsQuery);
        const allItemsMap = new Map<string, InventoryItem & { id: string }>();
        allItemsSnap.docs.forEach(d => allItemsMap.set(d.id, { id: d.id, ...d.data() } as InventoryItem & { id: string }));

        // BOM Explosion: aggregate RM and direct FG deductions
        const rmDeductionMap = new Map<string, { totalQty: number; note: string }>();
        const fgDirectDeductionMap = new Map<string, { totalQty: number; note: string }>();

        // Running stock tracker for PRODUCTION items to support auto-explode fallback
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

        const recursiveExplosion = (item: InventoryItem & { id: string }, multiplier: number, rootNote: string) => {
            if (!item.recipe || item.recipe.length === 0) return;
            for (const ingredient of item.recipe) {
                const iItem = allItemsMap.get(ingredient.ingredientId);
                if (!iItem) continue;
                const ded = ingredient.quantityUsed * multiplier;

                if (iItem.type === 'RAW_MATERIAL' || iItem.type === 'FINISHED_GOOD') {
                    const prev = rmDeductionMap.get(ingredient.ingredientId);
                    rmDeductionMap.set(ingredient.ingredientId, { totalQty: (prev?.totalQty ?? 0) + ded, note: prev?.note ?? rootNote });
                } else if (iItem.type === 'PRODUCTION') {
                    // ── AUTO-EXPLODE FALLBACK ──
                    const currentPrepStock = prodRunningStock.get(iItem.id) ?? 0;
                    const availablePrep = Math.max(0, currentPrepStock);
                    const deductedFromPrep = Math.min(availablePrep, ded);
                    const shortfall = ded - deductedFromPrep;

                    if (deductedFromPrep > 0) {
                        prodRunningStock.set(iItem.id, currentPrepStock - deductedFromPrep);
                        const prev = rmDeductionMap.get(ingredient.ingredientId);
                        rmDeductionMap.set(ingredient.ingredientId, { totalQty: (prev?.totalQty ?? 0) + deductedFromPrep, note: prev?.note ?? rootNote });
                    }

                    if (shortfall > 0) {
                        if (deductedFromPrep === 0) {
                            prodRunningStock.set(iItem.id, currentPrepStock);
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
                                    note: prev?.note ?? `${rootNote} (auto-produced ${iItem.name})`,
                                });
                                explodedRMs.push({
                                    itemId: subItem.id, itemName: subItem.name,
                                    qty: explodedQty, unit: subIng.unit || subItem.units?.recipeUnit || '',
                                });
                            }
                        }

                        autoProductionLogs.push({
                            productionItemId: iItem.id, productionItemName: iItem.name,
                            shortageQty: shortfall, finishedGoodName: rootNote,
                            rawMaterialsExploded: explodedRMs,
                        });
                    }
                }
            }
        };

        let totalPax = 0;

        for (const row of rowsToCommit) {
            totalPax += row.paxCount;
            const eventNote = `Event: ${row.eventName}`;
            const demandMap = new Map<string, number>();

            for (const item of row.resolvedItems) {
                if (item.matchedItemId) {
                    demandMap.set(item.matchedItemId, (demandMap.get(item.matchedItemId) ?? 0) + item.qty);
                }
            }

            for (const [fgId, totalQty] of demandMap) {
                const fgItem = allItemsMap.get(fgId);
                if (!fgItem) continue;
                if (fgItem.recipe && fgItem.recipe.length > 0) {
                    recursiveExplosion(fgItem, totalQty, eventNote);
                } else {
                    const prev = fgDirectDeductionMap.get(fgId);
                    fgDirectDeductionMap.set(fgId, { totalQty: (prev?.totalQty ?? 0) + totalQty, note: prev?.note ?? eventNote });
                }
            }
        }

        // Pre-load RM stock
        const rmStockMap = new Map<string, number>();
        for (const [rmId] of rmDeductionMap) {
            const rmItem = allItemsMap.get(rmId);
            if (rmItem) rmStockMap.set(rmId, safeNum(rmItem.theoreticalStock) || safeNum(rmItem.currentStock));
        }

        const batchDocRef = doc(collection(db, COL.EVENT_IMPORT_BATCHES));
        const batchImportId = batchDocRef.id;

        const MAX_OPS = 490;
        const batches: ReturnType<typeof writeBatch>[] = [];
        let currentBatch = writeBatch(db);
        let opCount = 0;
        const ensureBatch = () => { if (opCount >= MAX_OPS) { batches.push(currentBatch); currentBatch = writeBatch(db); opCount = 0; } };

        const now = Timestamp.now();

        // Write event_sales documents
        for (const row of rowsToCommit) {
            const eventTs = importDateToTimestamp(row.eventDate);

            const items: EventSaleItem[] = row.resolvedItems
                .filter(i => i.matchedItemId)
                .map(i => ({
                    inventoryItemId: i.matchedItemId!,
                    inventoryItemName: i.matchedItemName!,
                    qty: i.qty,
                }));

            const saleRef = doc(collection(db, COL.EVENT_SALES));
            ensureBatch();
            currentBatch.set(saleRef, {
                batchImportId, businessUnitId,
                eventName: row.eventName,
                packageName: row.packageName,
                eventDate: row.eventDate,
                paxCount: row.paxCount,
                items,
                totalRevenue: 0, totalIngredientCost: 0, totalProfit: 0,
                performedBy: userId, performedByName: userName,
                createdAt: eventTs,
            } satisfies Omit<EventSalesRecord, 'id'>);
            opCount++;
        }

        // RM deductions
        const runningRmStock = new Map(rmStockMap);
        for (const [rmId, { totalQty, note }] of rmDeductionMap) {
            const rmItem = allItemsMap.get(rmId);
            if (!rmItem) continue;
            const theoStock = runningRmStock.get(rmId) ?? 0;
            const newTheoStock = theoStock - totalQty;
            runningRmStock.set(rmId, newTheoStock);

            ensureBatch();
            currentBatch.set(doc(collection(db, COL.STOCK_TRANSACTIONS)), {
                itemId: rmId, itemName: rmItem.name, businessUnitId,
                type: 'THEORETICAL_USAGE', quantity: totalQty,
                unitCost: rmItem.costPerUnit ?? 0, totalValue: totalQty * (rmItem.costPerUnit ?? 0),
                balanceAfter: newTheoStock, referenceId: batchImportId,
                notes: `Deducted ${totalQty} ${rmItem.units?.recipeUnit ?? ''} ${rmItem.name} for ${note} (${fileName})`,
                performedBy: userId, performedByName: userName,
                timestamp: now, createdAt: now,
            });
            opCount++;

            ensureBatch();
            const rmCurrentStock = safeNum(rmItem.currentStock);
            currentBatch.update(doc(db, COL.INVENTORY_ITEMS, rmId), {
                currentStock: rmCurrentStock - totalQty,
                theoreticalStock: newTheoStock,
                updatedAt: now,
            });
            opCount++;
        }

        // Direct FG deductions (no-recipe items)
        for (const [fgId, { totalQty, note }] of fgDirectDeductionMap) {
            const fgItem = allItemsMap.get(fgId);
            if (!fgItem) continue;
            const theoStock = safeNum(fgItem.theoreticalStock) || safeNum(fgItem.currentStock);
            const newTheoStock = theoStock - totalQty;

            ensureBatch();
            currentBatch.set(doc(collection(db, COL.STOCK_TRANSACTIONS)), {
                itemId: fgId, itemName: fgItem.name, businessUnitId,
                type: 'EVENT_CONSUMPTION', quantity: totalQty,
                unitCost: fgItem.costPerUnit ?? 0, totalValue: totalQty * (fgItem.costPerUnit ?? 0),
                balanceAfter: newTheoStock, referenceId: batchImportId,
                notes: `Deducted ${totalQty} ${fgItem.units?.recipeUnit ?? ''} ${fgItem.name} for ${note} (${fileName})`,
                performedBy: userId, performedByName: userName,
                timestamp: now, createdAt: now,
            });
            opCount++;

            ensureBatch();
            const curStock = safeNum(fgItem.currentStock);
            currentBatch.update(doc(db, COL.INVENTORY_ITEMS, fgId), {
                currentStock: curStock - totalQty,
                theoreticalStock: newTheoStock,
                updatedAt: now,
            });
            opCount++;
        }

        // Batch metadata
        ensureBatch();
        currentBatch.set(batchDocRef, {
            businessUnitId, fileHash, fileName,
            totalEvents: rowsToCommit.length, totalPax, totalRevenue: 0,
            importedBy: userId, importedByName: userName, importedAt: now,
        } satisfies Omit<EventImportBatch, 'id'>);
        opCount++;

        // ================================================================
        // Write UNRECORDED_AUTO_PRODUCTION alerts for Event Import
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
                referenceType: 'EVENT_IMPORT',
                fileName,
                notes: `⚠️ Auto-produced ${log.shortageQty} units of "${log.productionItemName}" from raw materials — no production batch was recorded before event: "${log.finishedGoodName}"`,
                performedBy: userId,
                performedByName: userName,
                timestamp: now,
                createdAt: now,
            });
            opCount++;
        }

        batches.push(currentBatch);
        for (const batch of batches) await batch.commit();

        return batchImportId;
    }

    // ================================================================
    // QUERY HELPERS
    // ================================================================

    static async checkDuplicateImport(fileHash: string, businessUnitId: string): Promise<EventImportBatch | null> {
        const q = query(
            collection(db, COL.EVENT_IMPORT_BATCHES),
            where('fileHash', '==', fileHash),
            where('businessUnitId', '==', businessUnitId)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as EventImportBatch;
    }

    static async getImportHistory(businessUnitId: string): Promise<EventImportBatch[]> {
        const q = query(
            collection(db, COL.EVENT_IMPORT_BATCHES),
            where('businessUnitId', '==', businessUnitId)
        );
        const snap = await getDocs(q);
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() } as EventImportBatch))
            .sort((a, b) => (b.importedAt?.toMillis?.() ?? 0) - (a.importedAt?.toMillis?.() ?? 0));
    }

    static async getEventSalesByBatchId(batchImportId: string): Promise<EventSalesRecord[]> {
        const q = query(collection(db, COL.EVENT_SALES), where('batchImportId', '==', batchImportId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as EventSalesRecord));
    }

    // ================================================================
    // TEMPLATE EXPORT
    // ================================================================

    static downloadTemplate(): void {
        const wb = XLSX.utils.book_new();

        const wsData = [
            ['EVENT DATE', 'EVENT NAME', 'PACKAGE NAME', 'GUEST COUNT (PAX)', 'ITEM', 'QTY'],
            ['2026-01-15', 'Acme Corp Annual Dinner', 'Gold Wedding Package', 120, 'GRILLED SALMON', 120],
            ['', '', '', '', 'DRAFT BEER', 80],
            ['', '', '', '', 'SAN MIG', 40],
            ['', '', '', '', 'TFR FRIES', 120],
            ['', '', '', '', 'SOUP', 120],
            [],
            ['2026-01-20', 'Johnson Birthday', 'Silver Party Package', 80, 'BEEF TENDERLOIN', 80],
            ['', '', '', '', 'ICED TEA', 80],
            ['', '', '', '', 'CHOCOLATE CAKE', 40],
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [
            { wch: 14 }, { wch: 30 }, { wch: 26 }, { wch: 18 }, { wch: 24 }, { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Event Sales');

        const instructions = [
            ['EVENT SALES UPLOAD TEMPLATE — INSTRUCTIONS'],
            [],
            ['COLUMN', 'DESCRIPTION', 'FORMAT'],
            ['EVENT DATE', 'Date the event took place', 'YYYY-MM-DD'],
            ['EVENT NAME', 'Name/title of the event', 'Free text'],
            ['PACKAGE NAME', 'Package label (optional)', 'Free text'],
            ['GUEST COUNT (PAX)', 'Number of guests', 'Whole number'],
            ['ITEM', 'Item served at the event', 'Must match inventory name'],
            ['QTY', 'Quantity served', 'Number'],
            [],
            ['HOW IT WORKS'],
            ['• Each event starts with a row that has EVENT DATE and EVENT NAME filled in.'],
            ['• Subsequent rows with only ITEM and QTY belong to the same event.'],
            ['• A new row with EVENT NAME starts a new event.'],
            ['• Items are fuzzy-matched against inventory. Exact names work best.'],
            ['• Delete sample data before uploading your actual data.'],
        ];

        const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
        wsInstr['!cols'] = [{ wch: 28 }, { wch: 50 }, { wch: 40 }];
        wsInstr['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
        XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

        XLSX.writeFile(wb, 'Event_Sales_Upload_Template.xlsx');
    }
}
