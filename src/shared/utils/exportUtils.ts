/**
 * Export Utilities
 * Provides functions for exporting data to CSV format
 */

export interface ExportColumn<T> {
  header: string;
  accessor: (item: T) => string | number | null | undefined;
}

/**
 * Formats a date to YYYY-MM-DD format for spreadsheet compatibility
 */
export const formatDateForExport = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

/**
 * Formats currency as a plain number for spreadsheet compatibility
 */
export const formatCurrencyForExport = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '';
  return amount.toFixed(2);
};

/**
 * Escapes a CSV field value to handle special characters
 */
const escapeCSVField = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If the value contains comma, newline, or double quote, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Converts an array of objects to CSV format and triggers download
 */
export const exportToCSV = <T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Build CSV header row
  const headerRow = columns.map(col => escapeCSVField(col.header)).join(',');

  // Build CSV data rows
  const dataRows = data.map(item =>
    columns.map(col => escapeCSVField(col.accessor(item))).join(',')
  );

  // Combine header and data
  const csvContent = [headerRow, ...dataRows].join('\n');

  // Add BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link and trigger
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
