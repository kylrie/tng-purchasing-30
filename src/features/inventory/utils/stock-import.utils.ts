import type { InventoryItem } from '../types/InventoryItem';

// ============================================================
// TYPES
// ============================================================

export interface StockImportRow {
    sku?: string;
    name: string;
    quantity: number;
    unit?: string;
    rawRow: number; // Original row number in CSV
}

export interface StockImportMatch {
    itemId: string;
    itemName: string;
    sku?: string;
    quantity: number;
    unit: string;
    matchedBy: 'sku' | 'name';
}

export interface StockImportError {
    row: number;
    name: string;
    sku?: string;
    quantity: number;
    reason: string;
}

export interface StockImportResult {
    matched: StockImportMatch[];
    errors: StockImportError[];
    totalRows: number;
}

// ============================================================
// CSV PARSING (Native JS - no external dependencies)
// ============================================================

/**
 * Parse CSV text into rows
 * Handles quoted values and commas within quotes
 */
function parseCSVText(csvText: string): string[][] {
    const rows: string[][] = [];
    const lines = csvText.split(/\r?\n/);

    for (const line of lines) {
        if (line.trim() === '') continue;

        const row: string[] = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                row.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }

        // Push the last value
        row.push(currentValue.trim());
        rows.push(row);
    }

    return rows;
}

/**
 * Normalize column headers to standard keys
 */
function normalizeHeader(header: string): string {
    const normalized = header.toLowerCase().trim();

    // SKU variations
    if (['sku', 'item_code', 'itemcode', 'code', 'product_code'].includes(normalized)) {
        return 'sku';
    }

    // Name variations
    if (['name', 'item_name', 'itemname', 'product_name', 'description', 'item'].includes(normalized)) {
        return 'name';
    }

    // Quantity variations - include "current stock" and variations
    if ([
        'quantity', 'qty', 'count', 'stock', 'amount', 'on_hand', 'onhand',
        'current stock', 'current_stock', 'currentstock'
    ].includes(normalized)) {
        return 'quantity';
    }

    // Unit variations - include "count unit" variations
    if ([
        'unit', 'uom', 'unit_of_measure', 'measure',
        'count unit', 'count_unit', 'countunit'
    ].includes(normalized)) {
        return 'unit';
    }

    return normalized;
}

/**
 * Parse CSV file content into structured rows
 */
export function parseCSV(csvText: string): StockImportRow[] {
    // Strip BOM (Byte Order Mark) if present - common in Excel/Google Sheets exports
    const cleanedText = csvText.replace(/^\uFEFF/, '');

    const rawRows = parseCSVText(cleanedText);

    if (rawRows.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
    }

    // Get headers from first row
    const headers = rawRows[0].map(normalizeHeader);

    // Debug: Log headers for troubleshooting
    console.log('CSV Headers (normalized):', headers);
    console.log('Raw Headers:', rawRows[0]);

    // Find column indices
    const skuIndex = headers.indexOf('sku');
    const nameIndex = headers.indexOf('name');
    const quantityIndex = headers.indexOf('quantity');
    const unitIndex = headers.indexOf('unit');

    console.log('Column indices:', { skuIndex, nameIndex, quantityIndex, unitIndex });

    if (nameIndex === -1 && skuIndex === -1) {
        throw new Error('CSV must have either a "Name" or "SKU" column');
    }

    if (quantityIndex === -1) {
        throw new Error('CSV must have a "Quantity" column');
    }

    // Parse data rows
    const importRows: StockImportRow[] = [];

    for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];

        // Skip empty rows
        if (row.every(cell => cell.trim() === '')) continue;

        const sku = skuIndex >= 0 ? row[skuIndex]?.trim() : undefined;
        const name = nameIndex >= 0 ? row[nameIndex]?.trim() : (sku || '');
        const quantityStr = row[quantityIndex]?.trim() || '0';
        const unit = unitIndex >= 0 ? row[unitIndex]?.trim() : undefined;

        // Debug: Log raw row data
        console.log(`Row ${i + 1}:`, {
            rawRow: row,
            sku,
            name,
            quantityStr,
            unit
        });

        // Parse quantity (handle decimals)
        const quantity = parseFloat(quantityStr.replace(/,/g, ''));

        if (isNaN(quantity)) {
            console.warn(`Row ${i + 1}: Invalid quantity "${quantityStr}"`);
            continue;
        }

        console.log(`Row ${i + 1} parsed quantity:`, quantity);

        importRows.push({
            sku: sku || undefined,
            name,
            quantity,
            unit: unit || undefined,
            rawRow: i + 1
        });
    }

    console.log('Total parsed rows:', importRows.length);
    console.log('Parsed import rows:', importRows);

    return importRows;
}

// ============================================================
// MATCHING LOGIC
// ============================================================

/**
 * Process stock import: match CSV rows to inventory items
 * 
 * Matching Priority:
 * 1. Match by SKU (exact match, case-insensitive)
 * 2. Match by Item Name (exact match, case-insensitive)
 */
export function processStockImport(
    csvText: string,
    inventoryItems: InventoryItem[]
): StockImportResult {
    const importRows = parseCSV(csvText);

    const matched: StockImportMatch[] = [];
    const errors: StockImportError[] = [];

    // Build lookup maps for efficient matching
    const skuMap = new Map<string, InventoryItem>();
    const nameMap = new Map<string, InventoryItem>();

    for (const item of inventoryItems) {
        if (item.sku) {
            skuMap.set(item.sku.toLowerCase().trim(), item);
        }
        nameMap.set(item.name.toLowerCase().trim(), item);
    }

    // Process each import row
    for (const row of importRows) {
        let matchedItem: InventoryItem | undefined;
        let matchedBy: 'sku' | 'name' = 'name';

        // Try SKU match first
        if (row.sku) {
            matchedItem = skuMap.get(row.sku.toLowerCase().trim());
            if (matchedItem) {
                matchedBy = 'sku';
            }
        }

        // Fall back to name match
        if (!matchedItem && row.name) {
            matchedItem = nameMap.get(row.name.toLowerCase().trim());
            if (matchedItem) {
                matchedBy = 'name';
            }
        }

        if (matchedItem) {
            matched.push({
                itemId: matchedItem.id,
                itemName: matchedItem.name,
                sku: matchedItem.sku,
                quantity: row.quantity,
                unit: row.unit || matchedItem.units.recipeUnit,
                matchedBy
            });
        } else {
            errors.push({
                row: row.rawRow,
                name: row.name,
                sku: row.sku,
                quantity: row.quantity,
                reason: row.sku
                    ? `No item found with SKU "${row.sku}" or name "${row.name}"`
                    : `No item found with name "${row.name}"`
            });
        }
    }

    return {
        matched,
        errors,
        totalRows: importRows.length
    };
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            resolve(text);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Generate sample CSV template
 */
export function generateCSVTemplate(): string {
    return `Name,Quantity,Unit
Item Name Here,10,kg
Another Item,5.5,bottle
Third Item,3,liter`;
}
