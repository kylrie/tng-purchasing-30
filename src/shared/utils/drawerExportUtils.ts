/**
 * Drawer Export Utilities - Multi-Sheet XLSX Export
 * Exports RequisitionDrawer tab data into separate Excel sheets.
 */
import * as XLSX from 'xlsx';
import type { Requisition, RequisitionItem } from '../../features/procurement/types';
import type { Business, User } from '../types';

/** Format date for export */
const fmtDate = (d: string | undefined | null): string => {
    if (!d) return '';
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return '';
    return parsed.toISOString().split('T')[0];
};

/** Format currency number */
const fmtCur = (n: number | null | undefined): number => Number((n ?? 0).toFixed(2));

/**
 * Build the "Requisition Info" sheet data as an array of key-value rows.
 */
function buildInfoSheet(req: Requisition, buName: string, requesterName: string): (string | number)[][] {
    const rows: (string | number)[][] = [
        ['Field', 'Value'],
        ['PRF ID', req.id],
        ['Business Unit', buName],
        ['Requester', requesterName],
        ['Status', req.status],
        ['Date Created', fmtDate(req.dateCreated)],
        ['Date Needed', fmtDate(req.dateNeeded)],
        ['Priority', req.priority || 'NORMAL'],
        ['Description', req.description || ''],
        ['Total Amount', fmtCur(req.totalAmount)],
    ];
    if (req.chequeNumber) rows.push(['Cheque No', req.chequeNumber]);
    if (req.checkVoucherNumber) rows.push(['Check Voucher', req.checkVoucherNumber]);
    if (req.bankRefNumber) rows.push(['Bank Reference', req.bankRefNumber]);
    if (req.prfDetails?.supplier) {
        rows.push(['Supplier', req.prfDetails.supplier.name]);
        if (req.prfDetails.supplier.tin) rows.push(['Supplier TIN', req.prfDetails.supplier.tin]);
        if (req.prfDetails.supplier.paymentMode) rows.push(['Payment Mode', req.prfDetails.supplier.paymentMode]);
        if (req.prfDetails.supplier.terms) rows.push(['Terms', req.prfDetails.supplier.terms]);
    }
    return rows;
}

/**
 * Build the "Items" sheet data.
 */
function buildItemsSheet(items: RequisitionItem[]): (string | number)[][] {
    const rows: (string | number)[][] = [
        ['#', 'Item Description', 'Qty', 'UOM', 'Unit Price', 'Amount', 'Remarks'],
    ];
    let total = 0;
    (items || []).forEach((item, idx) => {
        const amount = (item.quantity || 0) * (item.price || 0);
        total += amount;
        rows.push([
            idx + 1,
            item.name,
            item.quantity || 0,
            item.uom || '',
            fmtCur(item.price),
            fmtCur(amount),
            item.remarks || '',
        ]);
    });
    rows.push(['', '', '', '', 'TOTAL', fmtCur(total), '']);
    return rows;
}

/**
 * Build the "Liquidation" sheet data.
 */
function buildLiquidationSheet(req: Requisition): (string | number)[][] {
    const rows: (string | number)[][] = [];

    rows.push(['Budget Released', fmtCur(req.totalAmount)]);
    if (req.chequeNumber) rows.push(['Cheque No', req.chequeNumber]);
    if (req.liquidationDetails?.dateFiled) rows.push(['Date Filed', fmtDate(req.liquidationDetails.dateFiled)]);
    rows.push([]); // blank row

    const expenses = req.liquidationDetails?.expenses;
    if (expenses && expenses.length > 0) {
        rows.push(['#', 'Date', 'Vendor/Payee', 'TIN', 'OR No.', 'Address', 'COA/Account', 'Description', 'VAT', 'EWT', 'Amount', 'Business Unit', 'Additional Expense']);
        let totalActual = 0, totalVat = 0, totalEwt = 0, totalAdditional = 0;
        expenses.forEach((exp, idx) => {
            const isAdditional = exp.isAdditionalExpense || false;
            totalActual += (exp.amount || 0);
            totalVat += (exp.vat || 0);
            totalEwt += (exp.ewt || 0);
            if (isAdditional) totalAdditional += (exp.amount || 0);
            rows.push([
                idx + 1,
                exp.date || '',
                exp.vendorName || '',
                exp.tin || '',
                exp.orNo || '',
                exp.address || '',
                exp.coaCode || exp.coaName || '',
                exp.description || '',
                fmtCur(exp.vat),
                fmtCur(exp.ewt),
                fmtCur(exp.amount),
                exp.buName || '',
                isAdditional ? 'Yes' : 'No',
            ]);
        });

        // Summary
        rows.push([]);
        rows.push(['SUMMARY']);
        rows.push(['Total Budget (Advance)', fmtCur(req.totalAmount)]);
        rows.push(['Total Actual Expenses', fmtCur(totalActual)]);
        rows.push(['Total VAT', fmtCur(totalVat)]);
        rows.push(['Total EWT', fmtCur(totalEwt)]);
        if (totalAdditional > 0) rows.push(['Additional Expenses', fmtCur(totalAdditional)]);
        const variance = (req.totalAmount || 0) - totalActual - totalAdditional;
        rows.push([variance >= 0 ? 'Amount to Return' : 'Amount to Reimburse', fmtCur(Math.abs(variance))]);
    } else {
        rows.push(['No liquidation expenses filed yet.']);
    }

    if (req.liquidationDetails?.receiptsLink) rows.push([], ['Receipts Link', req.liquidationDetails.receiptsLink]);
    if (req.liquidationDetails?.remarks || req.remarks) rows.push(['Remarks', req.liquidationDetails?.remarks || req.remarks || '']);

    return rows;
}

/**
 * Build the "History" sheet data.
 */
function buildHistorySheet(req: Requisition): (string | number)[][] | null {
    if (!req.history || req.history.length === 0) return null;
    const rows: (string | number)[][] = [
        ['Date', 'Action', 'By', 'Stage', 'Comments'],
    ];
    req.history.forEach(h => {
        rows.push([
            h.timestamp || h.date || '',
            h.action,
            h.actorName || '',
            h.stage,
            h.comments || '',
        ]);
    });
    return rows;
}

/**
 * Build the "Attachments" sheet data.
 */
function buildAttachmentsSheet(req: Requisition): (string | number)[][] | null {
    const hasAttachments = req.externalLink || (req.attachments && req.attachments.length > 0) || req.chequeImageUrl;
    if (!hasAttachments) return null;
    const rows: (string | number)[][] = [['Type', 'URL']];
    if (req.chequeImageUrl) rows.push(['Check Image', req.chequeImageUrl]);
    if (req.externalLink) rows.push(['External Reference', req.externalLink]);
    (req.attachments || []).forEach((url, idx) => {
        rows.push([`Attachment ${idx + 1}`, url]);
    });
    return rows;
}

/**
 * Export a single requisition's drawer data to a multi-sheet XLSX file.
 * Each tab (Items, Liquidation, History, Attachments) becomes its own sheet.
 */
export function exportDrawerToXLSX(
    req: Requisition,
    businesses: Business[],
    allUsers: User[],
    filename?: string
): void {
    const buName = businesses.find(b => b.id === req.businessId)?.name || 'N/A';
    const requesterName = allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Requisition Info
    const infoData = buildInfoSheet(req, buName, requesterName);
    const infoWs = XLSX.utils.aoa_to_sheet(infoData);
    infoWs['!cols'] = [{ wch: 20 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, infoWs, 'Requisition Info');

    // Sheet 2: Items
    const itemsData = buildItemsSheet(req.items);
    const itemsWs = XLSX.utils.aoa_to_sheet(itemsData);
    itemsWs['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, itemsWs, 'Items');

    // Sheet 3: Liquidation (only if status warrants it or liquidation data exists)
    if (req.liquidationDetails || req.status === 'FUNDS_RELEASED') {
        const liqData = buildLiquidationSheet(req);
        const liqWs = XLSX.utils.aoa_to_sheet(liqData);
        liqWs['!cols'] = [
            { wch: 5 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
            { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
            { wch: 12 }, { wch: 18 }, { wch: 15 },
        ];
        XLSX.utils.book_append_sheet(wb, liqWs, 'Liquidation');
    }

    // Sheet 4: History
    const historyData = buildHistorySheet(req);
    if (historyData) {
        const histWs = XLSX.utils.aoa_to_sheet(historyData);
        histWs['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, histWs, 'History');
    }

    // Sheet 5: Attachments
    const attachData = buildAttachmentsSheet(req);
    if (attachData) {
        const attachWs = XLSX.utils.aoa_to_sheet(attachData);
        attachWs['!cols'] = [{ wch: 20 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, attachWs, 'Attachments');
    }

    const outFilename = filename || `${req.id}_details.xlsx`;
    XLSX.writeFile(wb, outFilename);
}

/**
 * Export multiple requisitions to a single XLSX file with sheets per tab.
 * Sheet names are prefixed with the requisition ID for uniqueness.
 * If only 1 requisition, uses simple sheet names.
 */
export function exportMultipleDrawersToXLSX(
    requisitions: Requisition[],
    businesses: Business[],
    allUsers: User[],
    filename: string
): void {
    if (requisitions.length === 0) {
        alert('No data to export');
        return;
    }

    // For a single requisition, use the simple export
    if (requisitions.length === 1) {
        exportDrawerToXLSX(requisitions[0], businesses, allUsers, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
        return;
    }

    const wb = XLSX.utils.book_new();

    // XLSX sheet names max 31 chars, no special chars: \ / * ? : [ ]
// eslint-disable-next-line no-useless-escape
    const sanitize = (name: string): string => name.replace(/[\\/*?:\[\]]/g, '_').substring(0, 31);

    requisitions.forEach((req) => {
        const buName = businesses.find(b => b.id === req.businessId)?.name || 'N/A';
        const requesterName = allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId;
        const prefix = req.id.substring(0, 14); // Keep prefix short to fit 31 char limit

        // Info sheet
        const infoData = buildInfoSheet(req, buName, requesterName);
        const infoWs = XLSX.utils.aoa_to_sheet(infoData);
        infoWs['!cols'] = [{ wch: 20 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, infoWs, sanitize(`${prefix}-Info`));

        // Items sheet
        const itemsData = buildItemsSheet(req.items);
        const itemsWs = XLSX.utils.aoa_to_sheet(itemsData);
        XLSX.utils.book_append_sheet(wb, itemsWs, sanitize(`${prefix}-Items`));

        // Liquidation sheet
        if (req.liquidationDetails || req.status === 'FUNDS_RELEASED') {
            const liqData = buildLiquidationSheet(req);
            const liqWs = XLSX.utils.aoa_to_sheet(liqData);
            XLSX.utils.book_append_sheet(wb, liqWs, sanitize(`${prefix}-Liquidation`));
        }

        // History sheet
        const historyData = buildHistorySheet(req);
        if (historyData) {
            const histWs = XLSX.utils.aoa_to_sheet(historyData);
            XLSX.utils.book_append_sheet(wb, histWs, sanitize(`${prefix}-History`));
        }

        // Attachments sheet
        const attachData = buildAttachmentsSheet(req);
        if (attachData) {
            const attachWs = XLSX.utils.aoa_to_sheet(attachData);
            XLSX.utils.book_append_sheet(wb, attachWs, sanitize(`${prefix}-Attach`));
        }
    });

    const outFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, outFilename);
}
