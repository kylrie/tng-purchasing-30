import Papa from 'papaparse';
import { InventoryService } from './inventory.service';
import type {
    InventoryItemType,
    InventoryCategory,
    CreateInventoryItemInput
} from '../types/InventoryItem';

// ============================================================
// TYPES
// ============================================================

export interface CSVRow {
    Name: string;
    Type: string;
    Category: string;
    'Storage Areas': string;
    'Count Unit': string;
    'Buy Unit': string;
    'Conversion Rate': string;
    'Par Level': string;
    Cost: string;
    SKU?: string;
    Supplier?: string;
    Notes?: string;
}

export interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
}

// ============================================================
// CSV HEADERS
// ============================================================

const CSV_HEADERS = [
    'Name',
    'Type',
    'Category',
    'Storage Areas',
    'Count Unit',
    'Buy Unit',
    'Conversion Rate',
    'Par Level',
    'Cost',
    'SKU',
    'Supplier',
    'Notes'
];

// Valid types and categories for validation
const VALID_TYPES: InventoryItemType[] = ['RAW_MATERIAL', 'FINISHED_GOOD', 'PRODUCTION', 'ASSET'];
const VALID_CATEGORIES: InventoryCategory[] = [
    'Spirits', 'Wine', 'Beer', 'Mixers', 'Beverage', 'Food', 'Frozen Good',
    'Dry Goods', 'Equipment', 'Furniture', 'Supplies', 'Glassware', 'Souvenir', 'Other'
];

// ============================================================
// EXPORT LOGIC
// ============================================================

/**
 * Export inventory items to CSV and trigger download
 */
export async function exportInventoryToCSV(
    businessUnitId: string,
    businessName?: string
): Promise<void> {
    try {
        // Fetch all items for the business unit
        const items = await InventoryService.getInventory(businessUnitId);

        if (items.length === 0) {
            throw new Error('No inventory items to export');
        }

        // Flatten items to CSV format
        const csvData = items.map(item => ({
            'Name': item.name,
            'Type': item.type,
            'Category': item.category,
            'Storage Areas': item.storageAreas.join(';'),
            'Count Unit': item.units.countUnit,
            'Buy Unit': item.units.buyUnit,
            'Conversion Rate': item.units.conversion.toString(),
            'Par Level': (item.units.conversion > 0 ? item.parLevel / item.units.conversion : item.parLevel).toString(),
            'Cost': item.costPerUnit.toString(),
            'SKU': item.sku || '',
            'Supplier': item.supplier || '',
            'Notes': item.notes || ''
        }));

        // Generate CSV content
        const csv = Papa.unparse(csvData, {
            columns: CSV_HEADERS,
            header: true
        });

        // Create and trigger download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const fileName = `inventory_${businessName || businessUnitId}_${new Date().toISOString().split('T')[0]}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export error:', error);
        throw error;
    }
}

// ============================================================
// IMPORT LOGIC
// ============================================================

/**
 * Parse CSV file and return parsed data
 */
export function parseCSVFile(file: File): Promise<CSVRow[]> {
    return new Promise((resolve, reject) => {
        Papa.parse<CSVRow>(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim(),
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.warn('CSV parse warnings:', results.errors);
                }
                resolve(results.data);
            },
            error: (error: Error) => {
                reject(new Error(`Failed to parse CSV: ${error.message}`));
            }
        });
    });
}

/**
 * Validate and transform a CSV row to inventory item input
 */
function transformRow(
    row: CSVRow,
    businessUnitId: string,
    rowIndex: number
): { item: CreateInventoryItemInput | null; error: string | null } {
    const errors: string[] = [];

    // Required field: Name
    const name = row.Name?.trim();
    if (!name) {
        return { item: null, error: `Row ${rowIndex + 1}: Name is required` };
    }

    // Validate Type
    let type: InventoryItemType = 'RAW_MATERIAL';
    if (row.Type) {
        const upperType = row.Type.trim().toUpperCase().replace(/\s+/g, '_');
        if (VALID_TYPES.includes(upperType as InventoryItemType)) {
            type = upperType as InventoryItemType;
        } else {
            errors.push(`Invalid type "${row.Type}", using RAW_MATERIAL`);
        }
    }

    // Validate Category
    let category: InventoryCategory = 'Other';
    if (row.Category) {
        const matchedCategory = VALID_CATEGORIES.find(
            c => c.toLowerCase() === row.Category.trim().toLowerCase()
        );
        if (matchedCategory) {
            category = matchedCategory;
        } else {
            errors.push(`Invalid category "${row.Category}", using Other`);
        }
    }

    // Parse Storage Areas (semicolon-separated)
    const storageAreas = row['Storage Areas']
        ? row['Storage Areas'].split(';').map(s => s.trim()).filter(Boolean)
        : [];

    // Parse numeric fields
    const conversion = parseFloat(row['Conversion Rate']) || 1;
    if (conversion <= 0) {
        return { item: null, error: `Row ${rowIndex + 1}: Conversion rate must be greater than 0` };
    }

    const parLevel = parseFloat(row['Par Level']) || 0;
    const cost = parseFloat(row.Cost) || 0;

    const item: CreateInventoryItemInput = {
        businessUnitId,
        name,
        type,
        category,
        storageAreas,
        units: {
            countUnit: row['Count Unit']?.trim() || 'piece',
            buyUnit: row['Buy Unit']?.trim() || 'piece',
            conversion
        },
        parLevel: Math.round(parLevel * conversion),
        currentStock: 0, // New imports start with 0 stock
        costPerUnit: cost,
        // Only include optional fields if they have values (Firestore rejects undefined)
        ...(row.SKU?.trim() ? { sku: row.SKU.trim() } : {}),
        ...(row.Supplier?.trim() ? { supplier: row.Supplier.trim() } : {}),
        ...(row.Notes?.trim() ? { notes: row.Notes.trim() } : {})
    };

    return { item, error: errors.length > 0 ? errors.join('; ') : null };
}

/**
 * Import inventory items from parsed CSV data
 */
export async function importInventoryBatch(
    data: CSVRow[],
    businessUnitId: string
): Promise<ImportResult> {
    const result: ImportResult = {
        success: true,
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: []
    };

    if (data.length === 0) {
        result.success = false;
        result.errors.push('No data to import');
        return result;
    }

    // Fetch existing items for duplicate check
    const existingItems = await InventoryService.getInventory(businessUnitId);
    const existingNames = new Set(existingItems.map(i => i.name.toLowerCase()));
    const existingSKUs = new Set(
        existingItems.filter(i => i.sku).map(i => i.sku!.toLowerCase())
    );

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        try {
            // Transform row to item
            const { item, error } = transformRow(row, businessUnitId, i);

            if (!item) {
                result.failed++;
                if (error) result.errors.push(error);
                continue;
            }

            // Duplicate check by name
            if (existingNames.has(item.name.toLowerCase())) {
                result.skipped++;
                result.errors.push(`Row ${i + 1}: "${item.name}" already exists (skipped)`);
                continue;
            }

            // Duplicate check by SKU
            if (item.sku && existingSKUs.has(item.sku.toLowerCase())) {
                result.skipped++;
                result.errors.push(`Row ${i + 1}: SKU "${item.sku}" already exists (skipped)`);
                continue;
            }

            // Create the item
            await InventoryService.createInventoryItem(item);
            result.imported++;

            // Add to existing sets to prevent duplicates within this import
            existingNames.add(item.name.toLowerCase());
            if (item.sku) existingSKUs.add(item.sku.toLowerCase());

            // Log transformation warnings
            if (error) {
                result.errors.push(`Row ${i + 1}: ${error}`);
            }

        } catch (err) {
            result.failed++;
            result.errors.push(`Row ${i + 1}: Failed to import - ${err}`);
        }
    }

    result.success = result.failed === 0 && result.imported > 0;

    return result;
}

/**
 * Generate a sample CSV content for user reference
 */
export function getSampleCSV(): string {
    const sampleData = [
        {
            'Name': 'Jameson Irish Whiskey',
            'Type': 'RAW_MATERIAL',
            'Category': 'Spirits',
            'Storage Areas': 'Bar;Storage Room',
            'Count Unit': 'bottle',
            'Buy Unit': 'case',
            'Conversion Rate': '12',
            'Par Level': '6',
            'Cost': '1200',
            'SKU': 'WHS-JAM-001',
            'Supplier': 'ABC Distributors',
            'Notes': ''
        },
        {
            'Name': 'All-Purpose Flour',
            'Type': 'RAW_MATERIAL',
            'Category': 'Dry Goods',
            'Storage Areas': 'Kitchen;Storage Room',
            'Count Unit': 'kg',
            'Buy Unit': 'sack',
            'Conversion Rate': '25',
            'Par Level': '50',
            'Cost': '45',
            'SKU': '',
            'Supplier': '',
            'Notes': ''
        }
    ];

    return Papa.unparse(sampleData, {
        columns: CSV_HEADERS,
        header: true
    });
}

/**
 * Download sample CSV template
 */
export function downloadSampleCSV(): void {
    const csv = getSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_import_template.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}
