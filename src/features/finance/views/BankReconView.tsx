/**
 * BankReconView
 * 
 * Bank Reconciliation page under Finance module.
 * Upload multi-sheet Excel bank statements, smart-parse them,
 * view parsed data in tabbed tables, save to Firestore.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, Trash2, Eye, Save, X, Download, Clock, Layers, Hash, Calendar, ArrowDownRight, ArrowUpRight, Settings } from 'lucide-react';
import { BankReconService, type ParsedWorkbook, type ParsedSheet, type BankReconStatement } from '../services/bankRecon.service';
import { useAuth } from '../../../contexts/AuthContext';
import { exportToCSV, type ExportColumn } from '../../../shared/utils/exportUtils';
import Card from '../../../shared/components/Card';
import './BankReconView.css';

const BankReconView: React.FC = () => {
    const { currentUser } = useAuth();

    // Upload states
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Parsed data
    const [parsedWorkbook, setParsedWorkbook] = useState<ParsedWorkbook | null>(null);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);

    // Saved statements
    const [savedStatements, setSavedStatements] = useState<BankReconStatement[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [saving, setSaving] = useState(false);

    // Viewing a saved statement
    const [viewingStatement, setViewingStatement] = useState<BankReconStatement | null>(null);
    const [viewingSheets, setViewingSheets] = useState<ParsedSheet[]>([]);
    const [viewingSheetIndex, setViewingSheetIndex] = useState(0);
    const [loadingView, setLoadingView] = useState(false);

    // Load saved statements on mount
    useEffect(() => {
        loadSavedStatements();
    }, []);

    const loadSavedStatements = async () => {
        setLoadingHistory(true);
        try {
            const statements = await BankReconService.getBankStatements();
            setSavedStatements(statements);
        } catch (err) {
            console.error('Failed to load bank statements:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    // File handling
    const handleFileSelect = useCallback(async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
            setParseError('Please upload an Excel file (.xlsx or .xls)');
            return;
        }

        setUploadedFile(file);
        setParsing(true);
        setParseError(null);
        setParsedWorkbook(null);
        setActiveSheetIndex(0);

        // Clear any viewed statement
        setViewingStatement(null);
        setViewingSheets([]);

        try {
            const workbook = await BankReconService.parseExcelFile(file);
            setParsedWorkbook(workbook);
            if (workbook.sheets.length === 0) {
                setParseError('No data found in the uploaded file.');
            }
        } catch (err: any) {
            setParseError(err.message || 'Failed to parse the file.');
            console.error(err);
        } finally {
            setParsing(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleClickUpload = () => {
        fileInputRef.current?.click();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
        // Reset so the same file can be re-uploaded
        e.target.value = '';
    };

    const clearUpload = () => {
        setUploadedFile(null);
        setParsedWorkbook(null);
        setParseError(null);
        setActiveSheetIndex(0);
    };

    // Save to Firestore
    const handleSave = async () => {
        if (!parsedWorkbook || !currentUser) return;
        setSaving(true);
        try {
            await BankReconService.saveBankStatement(
                parsedWorkbook,
                currentUser.id,
                currentUser.name
            );
            await loadSavedStatements();
            clearUpload();
        } catch (err: any) {
            console.error('Failed to save:', err);
            alert(`Failed to save bank statement: ${err?.message || err}`);
        } finally {
            setSaving(false);
        }
    };

    // View saved statement
    const handleViewStatement = async (statement: BankReconStatement) => {
        setLoadingView(true);
        setViewingStatement(statement);
        setViewingSheetIndex(0);
        // Clear upload view
        clearUpload();
        try {
            const sheets = await BankReconService.getStatementSheetData(statement.id!);
            setViewingSheets(sheets);
        } catch (err) {
            console.error('Failed to load sheet data:', err);
            setViewingSheets([]);
        } finally {
            setLoadingView(false);
        }
    };

    const closeViewStatement = () => {
        setViewingStatement(null);
        setViewingSheets([]);
        setViewingSheetIndex(0);
    };

    // Delete statement
    const handleDelete = async (statementId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this bank statement? This cannot be undone.')) return;
        try {
            await BankReconService.deleteBankStatement(statementId);
            if (viewingStatement?.id === statementId) closeViewStatement();
            setSavedStatements(prev => prev.filter(s => s.id !== statementId));
        } catch (err) {
            console.error('Failed to delete:', err);
            alert('Failed to delete. Please try again.');
        }
    };

    // Export current sheet as CSV
    const handleExportCSV = (sheets: ParsedSheet[], sheetIdx: number) => {
        const sheet = sheets[sheetIdx];
        if (!sheet || sheet.rows.length === 0) return;

        const columns: ExportColumn<Record<string, any>>[] = sheet.headers.map(h => ({
            header: h,
            accessor: (row) => {
                const val = row[h];
                return val !== null && val !== undefined ? String(val) : '';
            }
        }));

        exportToCSV(sheet.rows, columns, `bank_recon_${sheet.sheetName}`);
    };

    // Generate Reconciliation Engine Match
    const handleGenerateReport = async () => {
        const activeSheets = viewingStatement ? viewingSheets : (parsedWorkbook?.sheets || []);
        const activeIdx = viewingStatement ? viewingSheetIndex : activeSheetIndex;
        const currentSheet = activeSheets[activeIdx];

        if (!currentSheet || currentSheet.rows.length === 0) return;

        setGenerating(true);
        try {
            const enrichedRows = await BankReconService.generateReconciliationReport(currentSheet);

            // Build updated sheet
            // We ensure that newly added columns (Remarks, Linked Chart of Accounts)
            // are added to the headers list if they aren't there yet
            const updatedHeaders = [...currentSheet.headers];
            if (!updatedHeaders.includes('Remarks')) updatedHeaders.push('Remarks');
            if (!updatedHeaders.includes('Linked Chart of Accounts')) updatedHeaders.push('Linked Chart of Accounts');

            const updatedSheet = {
                ...currentSheet,
                headers: updatedHeaders,
                rows: enrichedRows
            };

            // Update state depending on whether we're viewing a saved statement or an unsaved one
            if (viewingStatement) {
                const newViewingSheets = [...viewingSheets];
                newViewingSheets[viewingSheetIndex] = updatedSheet;
                setViewingSheets(newViewingSheets);
            } else if (parsedWorkbook) {
                const newSheets = [...parsedWorkbook.sheets];
                newSheets[activeSheetIndex] = updatedSheet;
                setParsedWorkbook({
                    ...parsedWorkbook,
                    sheets: newSheets
                });
            }
        } catch (err: any) {
            console.error('Failed to generate matching report:', err);
            alert(`Failed to generate matched report: ${err.message}`);
        } finally {
            setGenerating(false);
        }
    };

    // Get summary stats for a sheet
    const getSheetStats = (sheet: ParsedSheet) => {
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
        const dates: string[] = [];

        sheet.rows.forEach(row => {
            if (debitCol && typeof row[debitCol] === 'number') totalDebit += row[debitCol] as number;
            if (creditCol && typeof row[creditCol] === 'number') totalCredit += row[creditCol] as number;
            if (dateCol && row[dateCol]) dates.push(String(row[dateCol]));
        });

        const sortedDates = dates.filter(Boolean).sort();
        return {
            totalRows: sheet.rows.length,
            totalDebit,
            totalCredit,
            debitCol,
            creditCol,
            dateRange: sortedDates.length > 0
                ? { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] }
                : null,
        };
    };

    // Determine which sheets to render
    const activeSheets = viewingStatement ? viewingSheets : (parsedWorkbook?.sheets || []);
    const activeIdx = viewingStatement ? viewingSheetIndex : activeSheetIndex;
    const setActiveIdx = viewingStatement ? setViewingSheetIndex : setActiveSheetIndex;
    const currentSheet = activeSheets[activeIdx];

    // Check if a column represents currency
    const isCurrencyColumn = (header: string): boolean => {
        const h = header.toLowerCase();
        return ['debit', 'credit', 'amount', 'balance', 'withdrawal', 'deposit', 'dr', 'cr'].some(term => h.includes(term));
    };

    // Check if a value is numeric for right-alignment
    const isNumericColumn = (sheet: ParsedSheet, header: string): boolean => {
        const sample = sheet.rows.slice(0, 10);
        const numericCount = sample.filter(row => typeof row[header] === 'number').length;
        return numericCount > sample.length * 0.5;
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2,
        }).format(val);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bank Reconciliation</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Upload and parse multi-sheet bank statements for reconciliation.</p>
                </div>
                {parsedWorkbook && !viewingStatement && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGenerateReport}
                            disabled={generating}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                        >
                            {generating ? <div className="bank-recon-spinner w-4 h-4" /> : <Settings size={16} />}
                            {generating ? 'Generating...' : 'Generate Match'}
                        </button>
                        <button
                            onClick={() => handleExportCSV(parsedWorkbook.sheets, activeSheetIndex)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                        >
                            <Download size={16} />
                            Export Sheet
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                        >
                            {saving ? <div className="bank-recon-spinner" /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Save Statement'}
                        </button>
                        <button
                            onClick={clearUpload}
                            className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                        >
                            <X size={16} />
                            Clear
                        </button>
                    </div>
                )}
                {viewingStatement && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGenerateReport}
                            disabled={generating}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                        >
                            {generating ? <div className="bank-recon-spinner w-4 h-4" /> : <Settings size={16} />}
                            {generating ? 'Generating...' : 'Generate Match'}
                        </button>
                        <button
                            onClick={() => handleExportCSV(viewingSheets, viewingSheetIndex)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                        >
                            <Download size={16} />
                            Export Sheet
                        </button>
                        <button
                            onClick={closeViewStatement}
                            className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                        >
                            <X size={16} />
                            Close
                        </button>
                    </div>
                )}
            </div>

            {/* Upload Zone (show when no data is being viewed) */}
            {!parsedWorkbook && !viewingStatement && (
                <Card>
                    <div
                        className={`bank-recon-upload-zone ${isDragging ? 'dragging' : ''} ${uploadedFile ? 'has-file' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={handleClickUpload}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleInputChange}
                            className="hidden"
                        />
                        {parsing ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="bank-recon-spinner" style={{ width: 32, height: 32 }} />
                                <p className="text-slate-500 dark:text-slate-400">Parsing <span className="font-semibold text-slate-900 dark:text-white">{uploadedFile?.name}</span>...</p>
                            </div>
                        ) : uploadedFile ? (
                            <div className="flex flex-col items-center gap-2">
                                <FileSpreadsheet className="bank-recon-upload-icon" />
                                <p className="text-emerald-600 dark:text-emerald-400 font-semibold">{uploadedFile.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Click to upload a different file</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="bank-recon-upload-icon" />
                                <p className="text-slate-900 dark:text-white font-semibold text-lg">Drop your bank statement here</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">or click to browse — supports <span className="font-medium">.xlsx</span>, <span className="font-medium">.xls</span></p>
                            </div>
                        )}
                    </div>
                    {parseError && (
                        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                            ⚠️ {parseError}
                        </div>
                    )}
                </Card>
            )}

            {/* Viewing banner for saved statements */}
            {viewingStatement && (
                <Card className="!p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <FileSpreadsheet size={20} className="text-purple-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{viewingStatement.fileName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Uploaded by {viewingStatement.uploadedByName} on {new Date(viewingStatement.uploadedAt).toLocaleDateString()}
                                    {' · '}{viewingStatement.totalRows} rows across {viewingStatement.sheetCount} sheet{viewingStatement.sheetCount > 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Sheet Tabs + Data Table */}
            {activeSheets.length > 0 && !loadingView && (
                <>
                    {/* Summary Stats */}
                    {currentSheet && currentSheet.rows.length > 0 && (() => {
                        const stats = getSheetStats(currentSheet);
                        return (
                            <div className="bank-recon-summary">
                                <div className="bank-recon-stat">
                                    <div className="bank-recon-stat-label"><Hash size={12} className="inline mr-1" />Total Rows</div>
                                    <div className="bank-recon-stat-value">{stats.totalRows.toLocaleString()}</div>
                                </div>
                                {stats.dateRange && (
                                    <div className="bank-recon-stat">
                                        <div className="bank-recon-stat-label"><Calendar size={12} className="inline mr-1" />Date Range</div>
                                        <div className="bank-recon-stat-value text-base">{stats.dateRange.start} — {stats.dateRange.end}</div>
                                    </div>
                                )}
                                {stats.debitCol && stats.totalDebit > 0 && (
                                    <div className="bank-recon-stat">
                                        <div className="bank-recon-stat-label"><ArrowDownRight size={12} className="inline mr-1" />Total Debit</div>
                                        <div className="bank-recon-stat-value debit">{formatCurrency(stats.totalDebit)}</div>
                                    </div>
                                )}
                                {stats.creditCol && stats.totalCredit > 0 && (
                                    <div className="bank-recon-stat">
                                        <div className="bank-recon-stat-label"><ArrowUpRight size={12} className="inline mr-1" />Total Credit</div>
                                        <div className="bank-recon-stat-value credit">{formatCurrency(stats.totalCredit)}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Sheet Tabs */}
                    {activeSheets.length > 1 && (
                        <div className="bank-recon-sheet-tabs">
                            {activeSheets.map((sheet, idx) => (
                                <button
                                    key={sheet.sheetName}
                                    className={`bank-recon-sheet-tab ${idx === activeIdx ? 'active' : ''}`}
                                    onClick={() => setActiveIdx(idx)}
                                >
                                    <Layers size={14} className="inline mr-1.5 -mt-0.5" />
                                    {sheet.sheetName}
                                    <span className="ml-1.5 text-xs opacity-60">({sheet.rows.length})</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Data Table */}
                    {currentSheet && currentSheet.rows.length > 0 ? (
                        <Card className="!p-0">
                            <div className="bank-recon-table-container">
                                <table className="bank-recon-table">
                                    <thead>
                                        <tr>
                                            <th className="!text-center" style={{ width: 50 }}>#</th>
                                            {currentSheet.headers.map(header => (
                                                <th key={header}>{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentSheet.rows.map((row, rowIdx) => (
                                            <tr key={rowIdx}>
                                                <td className="!text-center text-slate-400 dark:text-slate-600 text-xs">{rowIdx + 1}</td>
                                                {currentSheet.headers.map(header => {
                                                    const value = row[header];
                                                    const isNum = isNumericColumn(currentSheet, header);
                                                    const isCurrency = isCurrencyColumn(header);

                                                    let displayValue: React.ReactNode = <span className="text-slate-300 dark:text-slate-700">—</span>;

                                                    if (value !== null && value !== undefined) {
                                                        if (isCurrency && typeof value === 'number') {
                                                            displayValue = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                        } else {
                                                            displayValue = String(value);
                                                        }
                                                    }

                                                    return (
                                                        <td
                                                            key={header}
                                                            className={isNum ? 'numeric' : ''}
                                                            title={value !== null ? String(value) : ''}
                                                        >
                                                            {displayValue}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    ) : currentSheet ? (
                        <Card>
                            <div className="text-center py-12 text-slate-500 dark:text-slate-400 italic">
                                No data rows found in sheet "{currentSheet.sheetName}"
                            </div>
                        </Card>
                    ) : null}
                </>
            )}

            {loadingView && (
                <Card>
                    <div className="flex items-center justify-center gap-3 py-12">
                        <div className="bank-recon-spinner" />
                        <span className="text-slate-500 dark:text-slate-400">Loading sheet data...</span>
                    </div>
                </Card>
            )}

            {/* History Section */}
            <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Clock size={18} className="text-slate-400" />
                    Upload History
                </h2>
                {loadingHistory ? (
                    <Card>
                        <div className="flex items-center justify-center gap-3 py-8">
                            <div className="bank-recon-spinner" />
                            <span className="text-slate-500 dark:text-slate-400">Loading history...</span>
                        </div>
                    </Card>
                ) : savedStatements.length === 0 ? (
                    <Card>
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400 italic">
                            No bank statements uploaded yet.
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {savedStatements.map(stmt => (
                            <div
                                key={stmt.id}
                                className={`bank-recon-history-item ${viewingStatement?.id === stmt.id ? '!border-purple-500 !bg-purple-50 dark:!bg-purple-900/20' : ''}`}
                                onClick={() => handleViewStatement(stmt)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                        <FileSpreadsheet size={18} className="text-slate-500 dark:text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{stmt.fileName}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {stmt.sheetCount} sheet{stmt.sheetCount > 1 ? 's' : ''} · {stmt.totalRows} rows · Uploaded by {stmt.uploadedByName}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                        {new Date(stmt.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <button
                                        onClick={() => handleViewStatement(stmt)}
                                        className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        title="View"
                                    >
                                        <Eye size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(stmt.id!, e)}
                                        className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BankReconView;
