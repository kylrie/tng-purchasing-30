/**
 * Bank Reconciliation Service
 * 
 * Handles parsing multi-sheet Excel bank statements and storing them in Firestore.
 * Uses smart heuristics to auto-detect headers, skip summary rows, and normalize data.
 */

import * as XLSX from 'xlsx';
import {
    collection,
    doc,
    addDoc,
    getDocs,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CoaService } from '../../../shared/services/coa.service';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import type { Requisition } from '../../procurement/types';
// ============================================================
// TYPES
// ============================================================

export interface ParsedRow {
    [key: string]: string | number | null;
}

export interface ParsedSheet {
    sheetName: string;
    headers: string[];
    rows: ParsedRow[];
    headerRowIndex: number; // 0-based index of detected header row
}

export interface ParsedWorkbook {
    fileName: string;
    sheets: ParsedSheet[];
    totalSheets: number;
}

export interface BankReconTransaction {
    date?: string;
    description?: string;
    reference?: string;
    debit?: number;
    credit?: number;
    balance?: number;
    [key: string]: string | number | undefined;
}

export interface BankReconStatement {
    id?: string;
    fileName: string;
    uploadedBy: string;
    uploadedByName: string;
    uploadedAt: string;
    sheetCount: number;
    sheetNames: string[];
    totalRows: number;
    // Summary per sheet
    sheetSummaries: {
        sheetName: string;
        rowCount: number;
        headers: string[];
        dateRange?: { start: string; end: string };
        totalDebit?: number;
        totalCredit?: number;
    }[];
}

// Firestore collection name
const BANK_RECON_COLLECTION = 'bankReconStatements';
const BANK_RECON_DATA_SUBCOLLECTION = 'sheetData';

// ============================================================
// SMART EXCEL PARSER
// ============================================================

/**
 * Heuristic: find the first row where >= 3 cells are non-empty strings.
 * This skips bank logos, titles, and summary text that precede actual data.
 */
function detectHeaderRow(sheetData: any[][]): number {
    for (let i = 0; i < Math.min(sheetData.length, 20); i++) {
        const row = sheetData[i];
        if (!row) continue;
        const nonEmptyCells = row.filter(
            cell => cell !== null && cell !== undefined && String(cell).trim() !== ''
        );
        // A header row typically has at least 3 labeled columns
        if (nonEmptyCells.length >= 3) {
            // Extra check: headers should be strings (not all numbers)
            const stringCells = nonEmptyCells.filter(cell => typeof cell === 'string' || isNaN(Number(cell)));
            if (stringCells.length >= 2) {
                return i;
            }
        }
    }
    return 0; // fallback to first row
}

/**
 * Normalize header names: trim, lowercase, replace spaces with underscores
 */
function normalizeHeader(raw: any): string {
    if (raw === null || raw === undefined || String(raw).trim() === '') {
        return '';
    }
    return String(raw).trim();
}

/**
 * Try to detect if a column is a date and format it nicely
 */
function formatCellValue(value: any, header: string): string | number | null {
    if (value === null || value === undefined) return null;

    // XLSX stores dates as serial numbers — detect and convert
    if (typeof value === 'number' && header.toLowerCase().includes('date')) {
        try {
            const date = XLSX.SSF.parse_date_code(value);
            if (date) {
                const month = String(date.m).padStart(2, '0');
                const day = String(date.d).padStart(2, '0');
                return `${date.y}-${month}-${day}`;
            }
        } catch {
            // Not a date serial, return as-is
        }
    }

    if (typeof value === 'number') return value;
    return String(value).trim();
}

/**
 * Check if a row is mostly empty (likely a footer/summary separator)
 */
function isEmptyRow(row: any[], threshold = 0.7): boolean {
    if (!row || row.length === 0) return true;
    const emptyCells = row.filter(
        cell => cell === null || cell === undefined || String(cell).trim() === ''
    );
    return emptyCells.length / row.length >= threshold;
}

/**
 * Parse a single sheet from the workbook
 */
function parseSheet(worksheet: XLSX.WorkSheet, sheetName: string): ParsedSheet {
    // Convert to 2D array (raw data)
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false
    });

    if (rawData.length === 0) {
        return { sheetName, headers: [], rows: [], headerRowIndex: 0 };
    }

    // Detect header row
    const headerRowIndex = detectHeaderRow(rawData);
    const headerRow = rawData[headerRowIndex] || [];

    // Build headers (skip empty columns)
    const headers: string[] = [];
    const columnIndices: number[] = [];
    for (let i = 0; i < headerRow.length; i++) {
        const h = normalizeHeader(headerRow[i]);
        if (h) {
            headers.push(h);
            columnIndices.push(i);
        }
    }

    if (headers.length === 0) {
        return { sheetName, headers: [], rows: [], headerRowIndex };
    }

    // Parse data rows (everything after header, skip empty rows)
    const rows: ParsedRow[] = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const rawRow = rawData[i];
        if (!rawRow || isEmptyRow(rawRow)) continue;

        const row: ParsedRow = {};
        let hasData = false;
        for (let j = 0; j < headers.length; j++) {
            const colIdx = columnIndices[j];
            const value = formatCellValue(rawRow[colIdx], headers[j]);
            row[headers[j]] = value;
            if (value !== null) hasData = true;
        }

        if (hasData) {
            rows.push(row);
        }
    }

    return { sheetName, headers, rows, headerRowIndex };
}

function sanitizeForFirestore(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
}

// ============================================================
// PUBLIC API
// ============================================================

export const BankReconService = {
    /**
     * Parse an Excel file and return all sheets with their data
     */
    async parseExcelFile(file: File): Promise<ParsedWorkbook> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: false });

                    const sheets: ParsedSheet[] = workbook.SheetNames.map(name => {
                        const worksheet = workbook.Sheets[name];
                        return parseSheet(worksheet, name);
                    });

                    resolve({
                        fileName: file.name,
                        sheets,
                        totalSheets: sheets.length,
                    });
                } catch (err) {
                    reject(new Error(`Failed to parse Excel file: ${err}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Save a parsed bank statement to Firestore
     */
    async saveBankStatement(
        workbook: ParsedWorkbook,
        userId: string,
        userName: string
    ): Promise<string> {
        // Build summaries per sheet
        const sheetSummaries = workbook.sheets.map(sheet => {
            // Try to detect debit/credit columns
            const debitCol = sheet.headers.find(h =>
                h.toLowerCase().includes('debit') ||
                h.toLowerCase().includes('withdrawal') ||
                h.toLowerCase().includes('dr')
            );
            const creditCol = sheet.headers.find(h =>
                h.toLowerCase().includes('credit') ||
                h.toLowerCase().includes('deposit') ||
                h.toLowerCase().includes('cr')
            );
            const dateCol = sheet.headers.find(h =>
                h.toLowerCase().includes('date') ||
                h.toLowerCase().includes('posting') ||
                h.toLowerCase().includes('value')
            );

            let totalDebit = 0;
            let totalCredit = 0;
            let dates: string[] = [];

            sheet.rows.forEach(row => {
                if (debitCol && typeof row[debitCol] === 'number') {
                    totalDebit += row[debitCol] as number;
                }
                if (creditCol && typeof row[creditCol] === 'number') {
                    totalCredit += row[creditCol] as number;
                }
                if (dateCol && row[dateCol]) {
                    dates.push(String(row[dateCol]));
                }
            });

            // Sort dates to find range
            dates = dates.filter(Boolean).sort();

            const summary: any = {
                sheetName: sheet.sheetName,
                rowCount: sheet.rows.length,
                headers: sheet.headers,
            };

            if (dates.length > 0) {
                summary.dateRange = { start: dates[0], end: dates[dates.length - 1] };
            }
            if (totalDebit) {
                summary.totalDebit = totalDebit;
            }
            if (totalCredit) {
                summary.totalCredit = totalCredit;
            }

            return summary;
        });

        const statement: Omit<BankReconStatement, 'id'> = {
            fileName: workbook.fileName,
            uploadedBy: userId,
            uploadedByName: userName,
            uploadedAt: new Date().toISOString(),
            sheetCount: workbook.totalSheets,
            sheetNames: workbook.sheets.map(s => s.sheetName),
            totalRows: workbook.sheets.reduce((sum, s) => sum + s.rows.length, 0),
            sheetSummaries,
        };

        // Save main document
        const statementData = sanitizeForFirestore(statement);
        const docRef = await addDoc(collection(db, BANK_RECON_COLLECTION), {
            ...statementData,
            createdAt: serverTimestamp(),
        });

        for (const sheet of workbook.sheets) {
            await addDoc(
                collection(db, BANK_RECON_COLLECTION, docRef.id, BANK_RECON_DATA_SUBCOLLECTION),
                sanitizeForFirestore({
                    sheetName: sheet.sheetName,
                    headers: sheet.headers,
                    rows: sheet.rows,
                    rowCount: sheet.rows.length,
                    headerRowIndex: sheet.headerRowIndex,
                })
            );
        }

        return docRef.id;
    },

    /**
     * Fetch all saved bank statements (metadata only, not row data)
     */
    async getBankStatements(): Promise<BankReconStatement[]> {
        const q = query(
            collection(db, BANK_RECON_COLLECTION),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as BankReconStatement));
    },

    /**
     * Load the sheet data for a specific saved statement
     */
    async getStatementSheetData(statementId: string): Promise<ParsedSheet[]> {
        const q = query(
            collection(db, BANK_RECON_COLLECTION, statementId, BANK_RECON_DATA_SUBCOLLECTION)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                sheetName: data.sheetName,
                headers: data.headers,
                rows: data.rows,
                headerRowIndex: data.headerRowIndex,
            } as ParsedSheet;
        });
    },

    /**
     * Delete a saved bank statement and its sheet data
     */
    async deleteBankStatement(statementId: string): Promise<void> {
        // Delete sub-collection docs first
        const sheetDocs = await getDocs(
            collection(db, BANK_RECON_COLLECTION, statementId, BANK_RECON_DATA_SUBCOLLECTION)
        );
        for (const sheetDoc of sheetDocs.docs) {
            await deleteDoc(sheetDoc.ref);
        }
        // Delete main document
        await deleteDoc(doc(db, BANK_RECON_COLLECTION, statementId));
    },

    /**
     * Generate the Reconciliation Report (Part 1) by checking bank statement rows
     * against the Procurement database to find exact matches.
     * 
     * Logic:
     * - Smart Data Extraction: Parses check number and debit amounts.
     * - The Matching Engine: Cross-refs rows against Requisitions representing released funds.
     * - Adds "Remarks" column (Procurement ID if matched, "Unidentified Transaction" if not).
     * - Adds "Linked Chart of Accounts" column for matched transactions.
     * 
     * @param sheet The parsed sheet data from the bank statement
     * @returns Array of enriched objects (JSON) for the frontend report table
     */
    async generateReconciliationReport(sheet: ParsedSheet): Promise<ParsedRow[]> {
        console.log(`[BankRecon] Generating report for sheet: ${sheet.sheetName} (${sheet.rows.length} rows)`);

        // 1. Fetch requisitions from Procurement Database
        // We fetch requisitions that have likely been released or cleared
        const reqQuery = query(
            collection(db, COLLECTIONS.REQUISITIONS),
            // We use 'in' to fetch requisitions that have been released to the bank. 
            // In a real scenario you might need to index this or fetch all and filter in memory if the list is huge.
            // For now, fetching all requisitions gives us the most robust matching pool,
            // but we can query specific statuses to optimize:
            // where('status', 'in', ['FUNDS_RELEASED', 'LIQUIDATION_FILED', 'AUDITED_CLEARED'])
            // However, since Firestore requires indexes for 'in' queries on status, 
            // we will fetch all requisitions to ensure we don't break without an index.
            // A more optimized approach in production would be to maintain an index.
        );

        const reqSnapshot = await getDocs(reqQuery);
        const requisitions = reqSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Requisition));

        // 2. Fetch Chart of Accounts for linking
        const coas = await CoaService.getAccounts();
        const coaMap = new Map(coas.map(c => [c.code, c.name]));

        // 3. Smart Extraction: Identify relevant columns in the uploaded bank statement
        const debitCol = sheet.headers.find(h =>
            h.toLowerCase().includes('debit') ||
            h.toLowerCase().includes('withdrawal') ||
            h.toLowerCase().includes('dr') ||
            h.toLowerCase().includes('amount')
        );

        // Try to explicitly find 'check' or 'chk' before falling back to 'ref'
        // This prevents picking up 'Reference Number' if 'Check Number' exists
        let checkCol = sheet.headers.find(h =>
            h.toLowerCase().includes('check') ||
            h.toLowerCase().includes('chk')
        );

        if (!checkCol) {
            checkCol = sheet.headers.find(h => h.toLowerCase().includes('ref'));
        }

        // 4. The Matching Engine & Enrichment
        console.log(`[BankRecon] Preparing to match against ${requisitions.length} requisitions.`);

        const enrichedRows = sheet.rows.map((row, idx) => {
            const enriched: ParsedRow = { ...row };
            let matchedReq: Requisition | undefined = undefined;

            if (debitCol && checkCol) {
                let debitVal = row[debitCol];
                const rawCheckVal = row[checkCol];

                // Remove leading zeros and commas for cross-check (e.g. 000457 vs 457, or 45,678 vs 45678)
                const normalizeCheck = (val: any) => String(val || '').trim().replace(/,/g, '').replace(/^0+/, '');
                const checkVal = normalizeCheck(rawCheckVal);

                // If Excel imported the amount as a text string like "5,890.66", parse it:
                if (typeof debitVal === 'string') {
                    const parsedDebit = Number(debitVal.replace(/,/g, '').trim());
                    if (!isNaN(parsedDebit)) debitVal = parsedDebit;
                }

                // Only attempt match if we have a valid debit amount and a check number
                if (typeof debitVal === 'number' && checkVal && checkVal !== '0') {
                    // Try to find a match
                    let partialMatchReason = '';

                    matchedReq = requisitions.find(req => {
                        const reqCheck = normalizeCheck(req.checkVoucherNumber || req.chequeNumber);
                        const isCheckMatch = reqCheck === checkVal;

                        // Use a 0.05 tolerance for floating-point issues
                        // Check both totalAmount and netAmount (in case of EWT/VAT deductions)
                        const isTotalAmountMatch = Math.abs((req.totalAmount || 0) - debitVal) < 0.05;
                        const isNetAmountMatch = req.netAmount ? Math.abs(req.netAmount - debitVal) < 0.05 : false;
                        const isAmountMatch = isTotalAmountMatch || isNetAmountMatch;

                        // Identify partial matches for debugging
                        if (isCheckMatch && !isAmountMatch) {
                            const procId = req.businessId
                                ? `${req.businessId}-${req.prfIdentifier || req.id}`
                                : req.prfIdentifier || req.id;

                            partialMatchReason = `${procId} - Check Match! Amount Mismatch (Excel: ${debitVal} vs DB Total: ${req.totalAmount} / Net: ${req.netAmount || 'N/A'})`;
                            console.warn(`[BankRecon] Row ${idx + 1} Partial Match: ${partialMatchReason}`);
                        } else if (!isCheckMatch && isAmountMatch) {
                            // Too noisy usually, but helps debug
                            // console.log(`[BankRecon] Row ${idx + 1} Amount matches but Check doesn't (Excel: ${checkVal} vs DB: ${reqCheck})`);
                        }

                        return isCheckMatch && isAmountMatch;
                    });

                    if (!matchedReq) {
                        console.log(`[BankRecon] No match for Row ${idx + 1}: Check=${checkVal}, Debit=${debitVal}`);
                        if (partialMatchReason) {
                            enriched['Remarks'] = partialMatchReason;
                            enriched['Linked Chart of Accounts'] = '';
                            return enriched; // return early so it doesn't get overwritten below
                        }
                    }
                }
            }

            // 5. Add Remarks & Link CoA
            if (matchedReq) {
                // If a match is found in the database, add a "Remarks" column
                const procId = matchedReq.businessId
                    ? `${matchedReq.businessId}-${matchedReq.prfIdentifier || matchedReq.id}`
                    : matchedReq.prfIdentifier || matchedReq.id;

                enriched['Remarks'] = procId;

                if (matchedReq.coaCode) {
                    enriched['Linked Chart of Accounts'] = `${matchedReq.coaCode} - ${coaMap.get(matchedReq.coaCode) || 'Unknown Account'}`;
                } else {
                    enriched['Linked Chart of Accounts'] = '';
                }
            } else {
                enriched['Remarks'] = 'Unidentified Transaction';
                enriched['Linked Chart of Accounts'] = '';
            }

            return enriched;
        });

        return enrichedRows;
    },
};
