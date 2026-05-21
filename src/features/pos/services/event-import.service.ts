import * as XLSX from 'xlsx';
import {
    collection, doc, getDocs, query, where, writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import type {
    EventImportRow, EventImportMappedRow, EventImportBatch,
    EventSalesRecord, EventPackageTemplate, EventSimulatedDeduction,
    EventActualConsumable, EventFlexibleSelection, EventStandardItem,
} from '../types/event-sales.types';
import { EVENT_COL } from '../types/event-sales.types';

const COL = {
    STOCK_TRANSACTIONS: 'stock_transactions',
    INVENTORY_ITEMS: 'inventory_items',
    ...EVENT_COL,
} as const;

// ================================================================
// HELPERS
// ================================================================

const safeNum = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** Case-insensitive fuzzy match: returns true if `input` is a substring of `target` or vice versa */
const fuzzyMatch = (input: string, target: string): boolean => {
    const a = input.toLowerCase().trim();
    const b = target.toLowerCase().trim();
    return a === b || b.includes(a) || a.includes(b);
};

/** Convert "YYYY-MM-DD" to a Firestore Timestamp at local midnight */
const importDateToTimestamp = (dateStr: string): Timestamp => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return Timestamp.fromDate(new Date(year, month - 1, day, 0, 0, 0, 0));
};

/** Generate SHA-256 hash for file deduplication */
const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// ================================================================
// EVENT IMPORT SERVICE
// ================================================================

export class EventImportService {

    // ================================================================
    // FILE PARSING
    // ================================================================

    static async generateFileHash(file: File): Promise<string> {
        return generateFileHash(file);
    }

    /**
     * Parse an Excel file into EventImportRow[].
     * Expected columns:
     *   Event Date | Event Name | Package Name | Guest Count (Pax)
     *   Selection: <GroupName> (dynamic) | Consumables Logged
     */
    static async parseFile(file: File): Promise<EventImportRow[]> {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawRows.length === 0) throw new Error('The uploaded file contains no data rows.');

        // Normalize headers
        const headers = Object.keys(rawRows[0]).map(h => h.trim());
        const normalize = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

        const findCol = (keywords: string[]): string | null => {
            return headers.find(h => keywords.some(kw => normalize(h).includes(normalize(kw)))) || null;
        };

        const dateCol = findCol(['eventdate', 'date']);
        const nameCol = findCol(['eventname', 'event']);
        const pkgCol = findCol(['packagename', 'package']);
        const paxCol = findCol(['guestcount', 'pax', 'guests']);
        const consumCol = findCol(['consumables', 'consumableslogged', 'drinks']);

        if (!dateCol || !nameCol || !pkgCol || !paxCol) {
            throw new Error('Missing required columns. Expected: Event Date, Event Name, Package Name, Guest Count (Pax)');
        }

        // Find dynamic "Selection: *" columns
        const selectionCols = headers
            .filter(h => h.toLowerCase().startsWith('selection:'))
            .map(h => ({ header: h, groupName: h.replace(/^selection:\s*/i, '').trim() }));

        return rawRows.map((row) => {
            const raw = (key: string | null): string => key ? String(row[key] ?? '').trim() : '';
            const selections: Record<string, string> = {};
            for (const sc of selectionCols) {
                const val = raw(sc.header);
                if (val) selections[sc.groupName] = val;
            }

            return {
                eventDate: raw(dateCol),
                eventName: raw(nameCol),
                packageName: raw(pkgCol),
                paxCount: parseInt(String(row[paxCol!]), 10) || 0,
                selections,
                consumablesRaw: raw(consumCol),
            };
        }).filter(r => r.eventName && r.paxCount > 0);
    }

    // ================================================================
    // SMART MATCHING
    // ================================================================

    /**
     * Match parsed rows against event_package_templates and inventory items.
     */
    static async matchRowsToInventory(
        rows: EventImportRow[],
        businessUnitId: string
    ): Promise<{
        mappedRows: EventImportMappedRow[];
        templates: EventPackageTemplate[];
        inventoryItems: (InventoryItem & { id: string })[];
    }> {
        // Fetch templates
        const tplQuery = query(
            collection(db, COL.EVENT_PACKAGE_TEMPLATES),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const tplSnap = await getDocs(tplQuery);
        const templates = tplSnap.docs.map(d => ({ id: d.id, ...d.data() } as EventPackageTemplate));

        // Fetch active inventory items (FG + RM for BOM later)
        const invQuery = query(
            collection(db, COL.INVENTORY_ITEMS),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const invSnap = await getDocs(invQuery);
        const inventoryItems = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem & { id: string }));

        const fgItems = inventoryItems.filter(i => i.type === 'FINISHED_GOOD' || i.type === 'PRODUCTION');

        const matchFG = (text: string): { id: string; name: string } | null => {
            const exact = fgItems.find(i => i.name.toLowerCase() === text.toLowerCase().trim());
            if (exact) return { id: exact.id, name: exact.name };
            const fuzzy = fgItems.find(i => fuzzyMatch(text, i.name));
            if (fuzzy) return { id: fuzzy.id, name: fuzzy.name };
            return null;
        };

        const mappedRows: EventImportMappedRow[] = rows.map((row, idx) => {
            // 1. Match package template
            const matchedTpl = templates.find(t => fuzzyMatch(row.packageName, t.name));

            // 2. Resolve flexible selections
            const resolvedSelections = matchedTpl
                ? matchedTpl.flexibleChoices.map(group => {
                    const inputText = row.selections[group.groupName] || '';
                    const matched = inputText ? matchFG(inputText) : null;
                    return {
                        choiceGroupId: group.choiceGroupId,
                        groupName: group.groupName,
                        inputText,
                        matchedItemId: matched?.id ?? null,
                        matchedItemName: matched?.name ?? null,
                        matchStatus: !inputText ? 'UNMATCHED' as const : matched ? 'MATCHED' as const : 'UNMATCHED' as const,
                        qtyServed: row.paxCount * group.allowedQty,
                    };
                })
                : Object.entries(row.selections).map(([groupName, inputText]) => {
                    const matched = inputText ? matchFG(inputText) : null;
                    return {
                        choiceGroupId: groupName.toLowerCase().replace(/\s+/g, '_'),
                        groupName,
                        inputText,
                        matchedItemId: matched?.id ?? null,
                        matchedItemName: matched?.name ?? null,
                        matchStatus: matched ? 'MATCHED' as const : 'UNMATCHED' as const,
                        qtyServed: row.paxCount,
                    };
                });

            // 3. Parse consumables (format: "Item:Qty; Item:Qty")
            const resolvedConsumables = row.consumablesRaw
                ? row.consumablesRaw.split(';').map(entry => {
                    const parts = entry.trim().split(':');
                    const inputText = parts[0]?.trim() || '';
                    const qty = parseInt(parts[1]?.trim() || '0', 10) || 0;
                    const matched = inputText ? matchFG(inputText) : null;
                    return {
                        inputText,
                        qty,
                        matchedItemId: matched?.id ?? null,
                        matchedItemName: matched?.name ?? null,
                        matchStatus: matched ? 'MATCHED' as const : 'UNMATCHED' as const,
                    };
                }).filter(c => c.inputText)
                : [];

            // 4. Standard items from template
            const resolvedStandardItems = matchedTpl
                ? matchedTpl.standardItemsIncluded.map(si => ({
                    inventoryItemId: si.inventoryItemId,
                    inventoryItemName: si.inventoryItemName,
                    totalQty: si.qtyPerPax * row.paxCount,
                }))
                : [];

            const hasErrors =
                !matchedTpl ||
                resolvedSelections.some(s => s.matchStatus === 'UNMATCHED' && s.inputText) ||
                resolvedConsumables.some(c => c.matchStatus === 'UNMATCHED');

            return {
                ...row,
                rowIndex: idx,
                matchedPackageId: matchedTpl?.id ?? null,
                matchedPackageName: matchedTpl?.name ?? null,
                packageMatchStatus: matchedTpl ? 'MATCHED' : 'UNMATCHED',
                resolvedSelections,
                resolvedConsumables,
                resolvedStandardItems,
                hasErrors,
            };
        });

        return { mappedRows, templates, inventoryItems };
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
            if (!row.matchedPackageId) continue;
            const eventName = row.eventName;

            // Collect all FG demands: { itemId -> totalQty }
            const demandMap = new Map<string, number>();

            // Standard items
            for (const si of row.resolvedStandardItems) {
                demandMap.set(si.inventoryItemId, (demandMap.get(si.inventoryItemId) ?? 0) + si.totalQty);
            }

            // Flexible selections
            for (const sel of row.resolvedSelections) {
                if (sel.matchedItemId) {
                    demandMap.set(sel.matchedItemId, (demandMap.get(sel.matchedItemId) ?? 0) + sel.qtyServed);
                }
            }

            // Consumables
            for (const con of row.resolvedConsumables) {
                if (con.matchedItemId) {
                    demandMap.set(con.matchedItemId, (demandMap.get(con.matchedItemId) ?? 0) + con.qty);
                }
            }

            // Now explode each FG in the demand map
            for (const [fgId, totalQty] of demandMap) {
                const fgItem = allItemsMap.get(fgId);
                if (!fgItem) continue;

                if (fgItem.recipe && fgItem.recipe.length > 0) {
                    // Has recipe — show FG as routing node, then recurse into ingredients
                    deductions.push({
                        itemId: fgId, itemName: fgItem.name, type: 'FG',
                        currentTheoreticalStock: 0, deductionAmount: totalQty,
                        newTheoreticalStock: 0, eventName,
                    });
                    this.simulateRecursiveBOM(fgItem, totalQty, fgId, fgItem.name, eventName, allItemsMap, runningStock, deductions);
                } else {
                    // No recipe — direct FG deduction
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
        item: InventoryItem & { id: string },
        multiplier: number,
        parentItemId: string,
        parentItemName: string,
        eventName: string,
        allItemsMap: Map<string, InventoryItem & { id: string }>,
        runningStock: Map<string, number>,
        deductions: EventSimulatedDeduction[]
    ) {
        if (!item.recipe || item.recipe.length === 0) return;
        for (const ingredient of item.recipe) {
            const iItem = allItemsMap.get(ingredient.ingredientId);
            if (!iItem) continue;
            const totalDed = ingredient.quantityUsed * multiplier;
            const currentStock = runningStock.get(iItem.id) ?? (safeNum(iItem.theoreticalStock) || safeNum(iItem.currentStock));

            if (iItem.type === 'RAW_MATERIAL') {
                const newStock = currentStock - totalDed;
                runningStock.set(iItem.id, newStock);
                deductions.push({
                    itemId: iItem.id, itemName: iItem.name, type: 'RM',
                    currentTheoreticalStock: currentStock, deductionAmount: totalDed,
                    newTheoreticalStock: newStock, parentItemId, parentItemName, eventName,
                });
            } else if (iItem.type === 'PRODUCTION') {
                deductions.push({
                    itemId: iItem.id, itemName: iItem.name, type: 'PRODUCTION',
                    currentTheoreticalStock: currentStock, deductionAmount: totalDed,
                    newTheoreticalStock: currentStock, parentItemId, parentItemName, eventName,
                });
                this.simulateRecursiveBOM(iItem, totalDed, iItem.id, iItem.name, eventName, allItemsMap, runningStock, deductions);
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

        const rowsToCommit = mappedRows.filter(r => r.matchedPackageId !== null);
        if (rowsToCommit.length === 0) throw new Error('No matched events to import.');

        // Pre-fetch all inventory items for BOM
        const allItemsQuery = query(
            collection(db, COL.INVENTORY_ITEMS),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const allItemsSnap = await getDocs(allItemsQuery);
        const allItemsMap = new Map<string, InventoryItem & { id: string }>();
        allItemsSnap.docs.forEach(d => allItemsMap.set(d.id, { id: d.id, ...d.data() } as InventoryItem & { id: string }));

        // ── BOM Explosion: aggregate all RM and direct FG deductions ──
        const rmDeductionMap = new Map<string, { totalQty: number; note: string }>();
        const fgDirectDeductionMap = new Map<string, { totalQty: number; note: string }>();

        const recursiveExplosion = (item: InventoryItem & { id: string }, multiplier: number, rootNote: string) => {
            if (!item.recipe || item.recipe.length === 0) return;
            for (const ingredient of item.recipe) {
                const iItem = allItemsMap.get(ingredient.ingredientId);
                if (!iItem) continue;
                const ded = ingredient.quantityUsed * multiplier;
                if (iItem.type === 'RAW_MATERIAL') {
                    const prev = rmDeductionMap.get(ingredient.ingredientId);
                    rmDeductionMap.set(ingredient.ingredientId, { totalQty: (prev?.totalQty ?? 0) + ded, note: prev?.note ?? rootNote });
                } else if (iItem.type === 'PRODUCTION') {
                    recursiveExplosion(iItem, ded, rootNote);
                }
            }
        };

        let totalPax = 0;
        let totalRevenue = 0;

        for (const row of rowsToCommit) {
            totalPax += row.paxCount;
            const eventNote = `Event: ${row.eventName} (${row.matchedPackageName})`;

            // Build demand map for this event
            const demandMap = new Map<string, number>();
            for (const si of row.resolvedStandardItems) {
                demandMap.set(si.inventoryItemId, (demandMap.get(si.inventoryItemId) ?? 0) + si.totalQty);
            }
            for (const sel of row.resolvedSelections) {
                if (sel.matchedItemId) demandMap.set(sel.matchedItemId, (demandMap.get(sel.matchedItemId) ?? 0) + sel.qtyServed);
            }
            for (const con of row.resolvedConsumables) {
                if (con.matchedItemId) demandMap.set(con.matchedItemId, (demandMap.get(con.matchedItemId) ?? 0) + con.qty);
            }

            // Explode each FG
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

        // Generate batch import ID
        const batchDocRef = doc(collection(db, COL.EVENT_IMPORT_BATCHES));
        const batchImportId = batchDocRef.id;

        // ── Build batch writes (Firestore 500-op limit) ──
        const MAX_OPS = 490;
        const batches: ReturnType<typeof writeBatch>[] = [];
        let currentBatch = writeBatch(db);
        let opCount = 0;
        const ensureBatch = () => { if (opCount >= MAX_OPS) { batches.push(currentBatch); currentBatch = writeBatch(db); opCount = 0; } };

        const now = Timestamp.now();

        // ── Write event_sales documents ──
        for (const row of rowsToCommit) {
            const eventTs = importDateToTimestamp(row.eventDate);

            const flexibleSelections: EventFlexibleSelection[] = row.resolvedSelections
                .filter(s => s.matchedItemId)
                .map(s => ({
                    choiceGroupId: s.choiceGroupId, groupName: s.groupName,
                    selectedItemId: s.matchedItemId!, selectedItemName: s.matchedItemName!,
                    qtyServed: s.qtyServed,
                }));

            const actualConsumables: EventActualConsumable[] = row.resolvedConsumables
                .filter(c => c.matchedItemId)
                .map(c => {
                    const item = allItemsMap.get(c.matchedItemId!);
                    return {
                        inventoryItemId: c.matchedItemId!, inventoryItemName: c.matchedItemName!,
                        qtyConsumed: c.qty, unitPrice: item?.sellingPrice ?? 0, isOverAllowance: false,
                    };
                });

            const standardItems: EventStandardItem[] = row.resolvedStandardItems;

            // Calculate revenue
            const tpl = allItemsMap.get(row.matchedPackageId!) as unknown as EventPackageTemplate | undefined;
            const pkgRevenue = tpl ? (tpl.isPerPaxPricing ? tpl.basePrice * row.paxCount : tpl.basePrice) : 0;
            totalRevenue += pkgRevenue;

            const saleRef = doc(collection(db, COL.EVENT_SALES));
            ensureBatch();
            currentBatch.set(saleRef, {
                batchImportId, businessUnitId,
                eventName: row.eventName,
                packageTemplateId: row.matchedPackageId!,
                packageTemplateName: row.matchedPackageName!,
                eventDate: row.eventDate,
                paxCount: row.paxCount,
                flexibleSelections, actualConsumables, standardItems,
                totalRevenue: pkgRevenue, totalIngredientCost: 0, totalProfit: 0,
                performedBy: userId, performedByName: userName,
                createdAt: eventTs,
            } satisfies Omit<EventSalesRecord, 'id'>);
            opCount++;
        }

        // ── BOM Explosion writes: raw material deductions ──
        const runningRmStock = new Map(rmStockMap);
        for (const [rmId, { totalQty, note }] of rmDeductionMap) {
            const rmItem = allItemsMap.get(rmId);
            if (!rmItem) continue;
            const theoStock = runningRmStock.get(rmId) ?? 0;
            const newTheoStock = theoStock - totalQty;
            runningRmStock.set(rmId, newTheoStock);

            // Stock transaction
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

            // Update inventory
            ensureBatch();
            const rmCurrentStock = safeNum(rmItem.currentStock);
            currentBatch.update(doc(db, COL.INVENTORY_ITEMS, rmId), {
                currentStock: rmCurrentStock - totalQty,
                theoreticalStock: newTheoStock,
                updatedAt: now,
            });
            opCount++;
        }

        // ── Direct FG deductions (no-recipe items) ──
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

        // ── Write batch metadata ──
        ensureBatch();
        currentBatch.set(batchDocRef, {
            businessUnitId, fileHash, fileName,
            totalEvents: rowsToCommit.length, totalPax, totalRevenue,
            importedBy: userId, importedByName: userName, importedAt: now,
        } satisfies Omit<EventImportBatch, 'id'>);
        opCount++;

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

    static async getPackageTemplates(businessUnitId: string): Promise<EventPackageTemplate[]> {
        const q = query(
            collection(db, COL.EVENT_PACKAGE_TEMPLATES),
            where('businessUnitId', '==', businessUnitId),
            where('isActive', '==', true)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as EventPackageTemplate));
    }

    static async createPackageTemplate(
        template: Omit<EventPackageTemplate, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        const now = Timestamp.now();
        const ref = doc(collection(db, COL.EVENT_PACKAGE_TEMPLATES));
        const batch = writeBatch(db);
        batch.set(ref, { ...template, createdAt: now, updatedAt: now });
        await batch.commit();
        return ref.id;
    }

    // ================================================================
    // TEMPLATE EXPORT
    // ================================================================

    /**
     * Generate and download an Excel template with the correct headers,
     * sample data, and an instructions sheet for staff to fill in.
     */
    static downloadTemplate(): void {
        const wb = XLSX.utils.book_new();

        // ── Sheet 1: Event Sales Data ──
        const headers = [
            'Event Date',
            'Event Name',
            'Package Name',
            'Guest Count (Pax)',
            'Selection: Main Course',
            'Selection: Dessert',
            'Selection: Beverage',
            'Consumables Logged',
        ];

        const sampleRows = [
            [
                '2026-01-15',
                'Acme Corp Annual Dinner',
                'Gold Wedding Package',
                150,
                'Grilled Salmon',
                'Tiramisu',
                'House Red Wine',
                'Craft Beer:80; Mojito:45',
            ],
            [
                '2026-01-20',
                'Johnson Birthday Celebration',
                'Silver Party Package',
                80,
                'Beef Tenderloin',
                'Chocolate Cake',
                'Iced Tea',
                'San Miguel Light:50; Margarita:20',
            ],
            [
                '2026-02-01',
                'TechCo Product Launch',
                'Corporate Gala Tier 1',
                200,
                'Roasted Chicken',
                'Panna Cotta',
                'Sparkling Water',
                'Heineken:100; Red Horse:60; House Wine:30',
            ],
        ];

        const wsData = [headers, ...sampleRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Column widths for readability
        ws['!cols'] = [
            { wch: 14 },  // Event Date
            { wch: 32 },  // Event Name
            { wch: 28 },  // Package Name
            { wch: 18 },  // Guest Count
            { wch: 24 },  // Selection: Main Course
            { wch: 24 },  // Selection: Dessert
            { wch: 24 },  // Selection: Beverage
            { wch: 40 },  // Consumables Logged
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Event Sales');

        // ── Sheet 2: Instructions ──
        const instructions = [
            ['EVENT SALES UPLOAD TEMPLATE — INSTRUCTIONS'],
            [],
            ['REQUIRED COLUMNS'],
            ['Column', 'Description', 'Format / Example'],
            ['Event Date', 'The date the event took place', 'YYYY-MM-DD  (e.g. 2026-01-15)'],
            ['Event Name', 'Name or title of the event', 'Free text  (e.g. Acme Corp Annual Dinner)'],
            ['Package Name', 'Must match an active package template', 'Exact or close match  (e.g. Gold Wedding Package)'],
            ['Guest Count (Pax)', 'Number of guests (used as BOM multiplier)', 'Whole number  (e.g. 150)'],
            [],
            ['OPTIONAL COLUMNS'],
            ['Column', 'Description', 'Format / Example'],
            ['Selection: <GroupName>', 'Guest\'s chosen item for a flexible choice group. Add one column per group.', 'Item name  (e.g. Grilled Salmon)'],
            ['Consumables Logged', 'Actual consumables used at the event', 'Item:Qty; Item:Qty  (e.g. Craft Beer:80; Mojito:45)'],
            [],
            ['NOTES'],
            ['• You can add as many "Selection: *" columns as needed. The group name after "Selection:" will be used to match flexible choice groups in the package template.'],
            ['• Consumables are separated by semicolons (;). Each entry is "ItemName:Quantity".'],
            ['• Item names are fuzzy-matched against the inventory. Exact names produce the best results.'],
            ['• Rows with a Guest Count of 0 or missing Event Name will be skipped automatically.'],
            ['• Duplicate file uploads are detected by file hash and will be rejected.'],
            ['• Delete the sample data rows before uploading your actual data.'],
        ];

        const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
        wsInstructions['!cols'] = [
            { wch: 30 },
            { wch: 55 },
            { wch: 50 },
        ];
        // Merge the title row across 3 columns
        wsInstructions['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

        XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

        // ── Download ──
        XLSX.writeFile(wb, 'Event_Sales_Upload_Template.xlsx');
    }
}
