/**
 * ============================================================
 * Event Sales Import Service (Remediated)
 * ============================================================
 *
 * CHANGELOG (Audit Remediation):
 * ──────────────────────────────────────────────────────────────
 * [CRITICAL] Performance: matchRowsToInventory now uses O(1)
 *   Map lookup for exact matching instead of O(N×M) fuzzyMatch().
 *
 * [CRITICAL] Concurrency: commitImport stock updates now use
 *   Firestore increment() instead of in-memory absolute writes.
 *
 * [HIGH] DRY: Extracted recursiveExplosion and simulateRecursiveBOM
 *   into shared bom-explosion.service.ts. This service now delegates
 *   to the shared logic.
 * ──────────────────────────────────────────────────────────────
 */

import * as XLSX from 'xlsx';
import {
    collection, doc, getDocs, query, where, writeBatch, Timestamp,
    increment,
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { InventoryItem } from '../../inventory/types/InventoryItem';
import type {
    EventImportRow, EventImportMappedRow, EventImportBatch,
    EventSalesRecord, EventSimulatedDeduction, EventSaleItem,
} from '../types/event-sales.types';
import { EVENT_COL } from '../types/event-sales.types';
import {
    recursiveExplosion,
    simulateRecursiveBOMForEvent,
    safeNum,
    type AutoProductionLog,
} from './bom-explosion.service';

const COL = {
    STOCK_TRANSACTIONS: 'stock_transactions',
    INVENTORY_ITEMS: 'inventory_items',
    ...EVENT_COL,
} as const;

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
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawRows.length === 0) throw new Error('The uploaded file contains no data rows.');

        const headers = Object.keys(rawRows[0]).map(h => h.trim());
        const normalize = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

        let availableHeaders = [...headers];
        const consumeCol = (keywords: string[]): string | null => {
            // First pass: exact match (case-insensitive, normalized)
            let found = availableHeaders.find(h => keywords.some(kw => normalize(h) === normalize(kw)));
            if (!found) {
                // Second pass: includes match
                found = availableHeaders.find(h => keywords.some(kw => normalize(h).includes(normalize(kw))));
            }
            if (found) {
                availableHeaders = availableHeaders.filter(h => h !== found);
                return found;
            }
            return null;
        };

        const dateCol = consumeCol(['eventdate', 'date']);
        const nameCol = consumeCol(['eventname', 'event']);
        const pkgCol = consumeCol(['packagename', 'package']);
        const paxCol = consumeCol(['guestcount', 'pax', 'guests']);
        const itemCol = consumeCol(['item', 'itemname', 'product']);
        const qtyCol = consumeCol(['qty', 'quantity']);

        if (!itemCol) throw new Error('Missing required ITEM column.');

        const formatDate = (val: unknown): string => {
            if (val instanceof Date) {
                const year = val.getUTCFullYear();
                const month = String(val.getUTCMonth() + 1).padStart(2, '0');
                const day = String(val.getUTCDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            if (typeof val === 'number') {
                if (val > 25000 && val < 70000) {
                    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                    const year = date.getUTCFullYear();
                    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(date.getUTCDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }
            
            const str = String(val ?? '').trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
            
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
                const parts = str.split('/');
                const first = parseInt(parts[0], 10);
                const second = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                
                let month = first;
                let day = second;
                
                if (first > 12) {
                    day = first;
                    month = second;
                }
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }

            return str;
        };

        const raw = (row: Record<string, unknown>, key: string | null, isDate: boolean = false): string => {
            if (!key) return '';
            const val = row[key];
            if (isDate) {
                return formatDate(val);
            }
            return String(val ?? '').trim();
        };

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
                    eventDate: raw(row, dateCol, true),
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

    /**
     * Match event items to inventory.
     *
     * [CRITICAL] AUDIT FIX: Pre-computes a Map<normalizedName, item>
     * for O(1) exact-match lookups. Falls back to substring/contains
     * matching only when exact match fails. This replaces the previous
     * O(N×M) fuzzyMatch() pattern.
     */
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

        /**
         * [CRITICAL] AUDIT FIX: O(1) exact-match lookup map.
         * Pre-compute a Map keyed by normalized (lowercased, trimmed) name.
         * This eliminates the previous O(N×M) pattern where every event item
         * called .find() against the entire matchableItems array.
         */
        const exactMatchMap = new Map<string, { id: string; name: string }>();
        for (const item of matchableItems) {
            const key = item.name.toLowerCase().trim();
            if (!exactMatchMap.has(key)) {
                exactMatchMap.set(key, { id: item.id, name: item.name });
            }
        }

        const matchItem = (text: string): { id: string; name: string } | null => {
            const normalizedInput = text.toLowerCase().trim();

            // O(1) exact match via Map
            const exactMatch = exactMatchMap.get(normalizedInput);
            if (exactMatch) return exactMatch;

            // Fallback: O(M) contains match — only fires when exact match fails
            const fuzzy = matchableItems.find(i => {
                const a = normalizedInput;
                const b = i.name.toLowerCase().trim();
                return b.includes(a) || a.includes(b);
            });
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

    /**
     * Simulate event import BOM explosion.
     *
     * [HIGH] AUDIT FIX: Delegates to shared simulateRecursiveBOMForEvent
     * from bom-explosion.service.ts.
     */
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
                    // [HIGH] AUDIT FIX: Delegates to shared BOM explosion service
                    simulateRecursiveBOMForEvent(
                        fgItem, totalQty, fgId, fgItem.name, eventName,
                        allItemsMap, runningStock, deductions
                    );
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

    // ================================================================
    // COMMIT IMPORT (ATOMIC BATCH WRITES)
    // ================================================================

    /**
     * Commit all matched event rows to Firestore.
     *
     * [CRITICAL] AUDIT FIX: Stock updates use increment() instead of
     * absolute in-memory values. Prevents race conditions during concurrent imports.
     *
     * [HIGH] AUDIT FIX: BOM explosion delegates to shared recursiveExplosion().
     */
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

        // BOM Explosion: group RM and direct FG deductions by eventDate (YYYY-MM-DD string)
        const rmDeductionByDate = new Map<string, Map<string, { totalQty: number; fgName: string }>>();
        const fgDirectDeductionByDate = new Map<string, Map<string, { totalQty: number; fgName: string }>>();

        // Running stock tracker for PRODUCTION items to support auto-explode fallback
        const prodRunningStock = new Map<string, number>();
        for (const [, item] of allItemsMap) {
            if (item.type === 'PRODUCTION') {
                prodRunningStock.set(item.id, safeNum(item.theoreticalStock) || safeNum(item.currentStock));
            }
        }

        // Track unrecorded production logs for database alert
        const autoProductionLogs: AutoProductionLog[] = [];

        let totalPax = 0;

        for (const row of rowsToCommit) {
            totalPax += row.paxCount;
            const eventNote = `Event: ${row.eventName}`;
            const dateStr = row.eventDate;

            if (!rmDeductionByDate.has(dateStr)) {
                rmDeductionByDate.set(dateStr, new Map());
            }
            if (!fgDirectDeductionByDate.has(dateStr)) {
                fgDirectDeductionByDate.set(dateStr, new Map());
            }

            const dateRmMap = rmDeductionByDate.get(dateStr)!;
            const dateFgMap = fgDirectDeductionByDate.get(dateStr)!;

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
                    // Create a temporary bridge to collect explosive deductions for this specific event row
                    const tempBridge = new Map<string, { totalQty: number; fgName: string }>();
                    recursiveExplosion(
                        fgItem, totalQty, eventNote,
                        allItemsMap, prodRunningStock,
                        tempBridge, autoProductionLogs
                    );
                    // Accumulate tempBridge into dateRmMap
                    for (const [rmId, val] of tempBridge) {
                        const prev = dateRmMap.get(rmId);
                        dateRmMap.set(rmId, {
                            totalQty: (prev?.totalQty ?? 0) + val.totalQty,
                            fgName: prev?.fgName ?? val.fgName,
                        });
                    }
                } else {
                    const prev = dateFgMap.get(fgId);
                    dateFgMap.set(fgId, {
                        totalQty: (prev?.totalQty ?? 0) + totalQty,
                        fgName: prev?.fgName ?? eventNote,
                    });
                }
            }
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

        // RM deductions (grouped by eventDate to allow backtracking/variance)
        for (const [dateStr, dateRmMap] of rmDeductionByDate) {
            const eventTs = importDateToTimestamp(dateStr);

            for (const [rmId, { totalQty, fgName }] of dateRmMap) {
                const rmItem = allItemsMap.get(rmId);
                if (!rmItem) continue;

                ensureBatch();
                currentBatch.set(doc(collection(db, COL.STOCK_TRANSACTIONS)), {
                    itemId: rmId, itemName: rmItem.name, businessUnitId,
                    type: 'THEORETICAL_USAGE', quantity: totalQty,
                    unitCost: rmItem.costPerUnit ?? 0, totalValue: totalQty * (rmItem.costPerUnit ?? 0),
                    referenceId: batchImportId,
                    notes: `Deducted ${totalQty} ${rmItem.units?.recipeUnit ?? ''} ${rmItem.name} for ${fgName} (${fileName})`,
                    performedBy: userId, performedByName: userName,
                    timestamp: eventTs, createdAt: eventTs,
                });
                opCount++;

                ensureBatch();
                currentBatch.update(doc(db, COL.INVENTORY_ITEMS, rmId), {
                    currentStock: increment(-totalQty),
                    theoreticalStock: increment(-totalQty),
                    updatedAt: eventTs,
                });
                opCount++;
            }
        }

        // Direct FG deductions (grouped by eventDate)
        for (const [dateStr, dateFgMap] of fgDirectDeductionByDate) {
            const eventTs = importDateToTimestamp(dateStr);

            for (const [fgId, { totalQty, fgName }] of dateFgMap) {
                const fgItem = allItemsMap.get(fgId);
                if (!fgItem) continue;

                ensureBatch();
                currentBatch.set(doc(collection(db, COL.STOCK_TRANSACTIONS)), {
                    itemId: fgId, itemName: fgItem.name, businessUnitId,
                    type: 'EVENT_CONSUMPTION', quantity: totalQty,
                    unitCost: fgItem.costPerUnit ?? 0, totalValue: totalQty * (fgItem.costPerUnit ?? 0),
                    referenceId: batchImportId,
                    notes: `Deducted ${totalQty} ${fgItem.units?.recipeUnit ?? ''} ${fgItem.name} for ${fgName} (${fileName})`,
                    performedBy: userId, performedByName: userName,
                    timestamp: eventTs, createdAt: eventTs,
                });
                opCount++;

                ensureBatch();
                currentBatch.update(doc(db, COL.INVENTORY_ITEMS, fgId), {
                    currentStock: increment(-totalQty),
                    theoreticalStock: increment(-totalQty),
                    updatedAt: eventTs,
                });
                opCount++;
            }
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
