/**
 * BankReconView
 * 
 * Bank Reconciliation page under Finance module.
 * Upload multi-sheet Excel bank statements, smart-parse them,
 * view parsed data in tabbed tables, save to Firestore.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, Trash2, Save, X, Download, Clock, Layers, Hash, Calendar, ArrowDownRight, ArrowUpRight, Settings, CheckCircle2, AlertTriangle, AlertCircle, Edit2, Send, CheckCircle } from 'lucide-react';
import { BankReconService, type ParsedWorkbook, type ParsedSheet, type BankReconStatement } from '../services/bankRecon.service';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { exportToCSV, type ExportColumn } from '../../../shared/utils/exportUtils';
import './BankReconView.css';

const BankReconView: React.FC = () => {
    const { currentUser } = useAuth();
    const { hasPermission } = usePermissions();
    const canAudit = hasPermission('bank_recon:audit');

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

    // List tabs
    const [listTab, setListTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

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
    // Save to Firestore with specific status
    const handleSaveStatus = async (status: 'PENDING_MATCH' | 'PENDING_AUDIT' | 'COMPLETED') => {
        if (!parsedWorkbook || !currentUser) return;
        setSaving(true);
        try {
            await BankReconService.saveBankStatement(
                parsedWorkbook,
                currentUser.id,
                currentUser.name,
                status
            );
            await loadSavedStatements();
            clearUpload();
        } catch (err: any) {
            console.error(`Failed to save as ${status}:`, err);
            alert(`Failed to save bank statement: ${err?.message || err}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = () => handleSaveStatus('PENDING_MATCH');

    const handleSubmitAudit = async () => {
        if (viewingStatement) {
            setSaving(true);
            try {
                await BankReconService.updateStatementStatus(viewingStatement.id!, 'PENDING_AUDIT');
                setViewingStatement({ ...viewingStatement, status: 'PENDING_AUDIT' });
                await loadSavedStatements();
            } catch (err: any) {
                console.error('Failed to submit for audit:', err);
                alert(`Failed to submit: ${err?.message || err}`);
            } finally {
                setSaving(false);
            }
        } else {
            handleSaveStatus('PENDING_AUDIT');
        }
    };

    const handleMarkAudited = async () => {
        if (!viewingStatement || viewingStatement.status !== 'PENDING_AUDIT' || !canAudit) return;
        if (!confirm('Are you sure you want to mark this statement as completely audited?')) return;

        setSaving(true);
        try {
            await BankReconService.updateStatementStatus(viewingStatement.id!, 'COMPLETED');
            // Update local state and history
            setViewingStatement({ ...viewingStatement, status: 'COMPLETED' });
            await loadSavedStatements();
        } catch (err: any) {
            console.error('Failed to mark as audited:', err);
            alert(`Failed to update status: ${err?.message || err}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAuditProgress = async () => {
        if (!viewingStatement || viewingStatement.status !== 'PENDING_AUDIT' || !canAudit) return;

        setSaving(true);
        try {
            await BankReconService.updateStatementStatus(viewingStatement.id!, 'PENDING_AUDIT');
            await loadSavedStatements();
            closeViewStatement();
        } catch (err: any) {
            console.error('Failed to save audit progress:', err);
            alert(`Failed to save progress: ${err?.message || err}`);
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

    // Toggle Audit Status (Cleared/Uncleared)
    const handleToggleAudit = async (rowIdx: number, currentState: boolean) => {
        if (!canAudit) return;
        if (viewingStatement && viewingStatement.status !== 'PENDING_AUDIT') return; // Enforce state machine rules

        const activeSheets = viewingStatement ? viewingSheets : (parsedWorkbook?.sheets || []);
        const activeIdx = viewingStatement ? viewingSheetIndex : activeSheetIndex;
        const currentSheet = activeSheets[activeIdx];
        if (!currentSheet) return;

        const newRows = [...currentSheet.rows];
        newRows[rowIdx] = {
            ...newRows[rowIdx],
            Cleared: !currentState
        };

        const newSheet = {
            ...currentSheet,
            rows: newRows
        };

        if (viewingStatement) {
            const newViewingSheets = [...viewingSheets];
            newViewingSheets[activeIdx] = newSheet;
            setViewingSheets(newViewingSheets);

            // Persist to Firestore
            try {
                if (!newSheet.id) throw new Error("Sheet ID is missing.");
                await BankReconService.updateSheetData(viewingStatement.id!, newSheet.id, newRows);
            } catch (err) {
                console.error('Failed to update audit status:', err);
                alert('Failed to save audit status to database.');
                // Revert locally on error
                newRows[rowIdx].Cleared = currentState;
                newViewingSheets[activeIdx] = { ...currentSheet, rows: newRows };
                setViewingSheets([...newViewingSheets]);
            }
        } else if (parsedWorkbook) {
            const newSheets = [...parsedWorkbook.sheets];
            newSheets[activeIdx] = newSheet;
            setParsedWorkbook({
                ...parsedWorkbook,
                sheets: newSheets
            });
        }
    };

    // Edit Remark
    const handleEditRemark = async (rowIdx: number, currentRemark: string) => {
        if (viewingStatement && viewingStatement.status === 'COMPLETED') return; // Cannot edit if completed
        if (viewingStatement && viewingStatement.status === 'PENDING_AUDIT' && !canAudit) return; // Usually only finance edits before audit, but auditor could edit too

        const newRemark = prompt('Edit Remark:', currentRemark);
        if (newRemark === null || newRemark === currentRemark) return; // Cancelled or no change

        const activeSheets = viewingStatement ? viewingSheets : (parsedWorkbook?.sheets || []);
        const activeIdx = viewingStatement ? viewingSheetIndex : activeSheetIndex;
        const currentSheet = activeSheets[activeIdx];
        if (!currentSheet) return;

        const newRows = [...currentSheet.rows];
        newRows[rowIdx] = {
            ...newRows[rowIdx],
            Remarks: newRemark
        };

        const newSheet = {
            ...currentSheet,
            rows: newRows
        };

        if (viewingStatement) {
            const newViewingSheets = [...viewingSheets];
            newViewingSheets[activeIdx] = newSheet;
            setViewingSheets(newViewingSheets);

            // Persist to Firestore
            try {
                if (!newSheet.id) throw new Error("Sheet ID is missing.");
                await BankReconService.updateSheetData(viewingStatement.id!, newSheet.id, newRows);
            } catch (err) {
                console.error('Failed to update remark:', err);
                alert('Failed to save remark to database.');
                // Revert locally on error
                newRows[rowIdx].Remarks = currentRemark;
                newViewingSheets[activeIdx] = { ...currentSheet, rows: newRows };
                setViewingSheets([...newViewingSheets]);
            }
        } else if (parsedWorkbook) {
            const newSheets = [...parsedWorkbook.sheets];
            newSheets[activeIdx] = newSheet;
            setParsedWorkbook({
                ...parsedWorkbook,
                sheets: newSheets
            });
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
                            onClick={handleSaveDraft}
                            disabled={saving}
                            className="bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                        >
                            {saving ? <div className="bank-recon-spinner w-4 h-4" /> : <Save size={16} />}
                            Save Draft
                        </button>
                        <button
                            onClick={handleSubmitAudit}
                            disabled={saving}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                        >
                            {saving ? <div className="bank-recon-spinner w-4 h-4" /> : <Send size={16} />}
                            Submit for Audit
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
                        {(viewingStatement.status === 'PENDING_MATCH' || !viewingStatement.status) && (
                            <button
                                onClick={handleSubmitAudit}
                                disabled={saving}
                                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                            >
                                {saving ? <div className="bank-recon-spinner w-4 h-4" /> : <Send size={16} />}
                                Submit for Audit
                            </button>
                        )}
                        {viewingStatement.status === 'PENDING_AUDIT' && canAudit && (
                            <>
                                <button
                                    onClick={handleSaveAuditProgress}
                                    disabled={saving}
                                    className="bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                                >
                                    {saving ? <div className="bank-recon-spinner w-4 h-4" /> : <Save size={16} />}
                                    Save Progress
                                </button>
                                <button
                                    onClick={handleMarkAudited}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                                >
                                    {saving ? <div className="bank-recon-spinner w-4 h-4" /> : <CheckCircle size={16} />}
                                    Mark Audited
                                </button>
                            </>
                        )}
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

            {/* Main View Layout */}
            {!parsedWorkbook && !viewingStatement ? (
                /* Bento Grid Layout for Empty State */
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Col: Upload Zone */}
                    <div className="xl:col-span-2">
                        <div className="recon-glass-panel p-2">
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
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="bank-recon-spinner w-10 h-10 border-4 border-purple-500/30 border-t-purple-500" />
                                        <p className="text-slate-600 dark:text-slate-300 font-medium text-lg">
                                            Parsing <span className="text-gradient-primary font-bold">{uploadedFile?.name}</span>...
                                        </p>
                                    </div>
                                ) : uploadedFile ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl mb-2">
                                            <FileSpreadsheet className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <p className="text-xl font-bold text-slate-900 dark:text-white">{uploadedFile.name}</p>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">Ready to process</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-5 bg-white shadow-xl dark:bg-slate-800 rounded-2xl mb-2 bank-recon-upload-icon-container">
                                            <Upload className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Upload Bank Statement</h3>
                                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                            Drag and drop your Excel file here, or click to browse. Supports <span className="font-semibold text-slate-700 dark:text-slate-300">.xlsx</span> and <span className="font-semibold text-slate-700 dark:text-slate-300">.xls</span>.
                                        </p>
                                    </div>
                                )}
                            </div>
                            {parseError && (
                                <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 flex items-start gap-3">
                                    <AlertTriangle className="text-red-500 mt-0.5 flex-shrink-0" size={18} />
                                    <div>
                                        <h4 className="text-red-800 dark:text-red-300 font-semibold mb-1">Parse Error</h4>
                                        <p className="text-red-600 dark:text-red-400 text-sm">{parseError}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Col: History */}
                    <div className="xl:col-span-1">
                        <div className="recon-glass-panel flex flex-col h-full max-h-[600px]">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Clock size={18} className="text-purple-500" />
                                        Statements
                                    </h2>
                                </div>
                                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                                    <button
                                        onClick={() => setListTab('ACTIVE')}
                                        className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${listTab === 'ACTIVE'
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        Active
                                    </button>
                                    <button
                                        onClick={() => setListTab('HISTORY')}
                                        className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${listTab === 'HISTORY'
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        History
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 space-y-3">
                                {loadingHistory ? (
                                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                                        <div className="bank-recon-spinner border-slate-300 border-t-purple-500" />
                                        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading history...</span>
                                    </div>
                                ) : (() => {
                                    const filteredStatements = savedStatements.filter(stmt => {
                                        if (listTab === 'HISTORY') return stmt.status === 'COMPLETED';
                                        return stmt.status !== 'COMPLETED';
                                    });

                                    if (filteredStatements.length === 0) {
                                        return (
                                            <div className="flex flex-col items-center justify-center text-center h-40 px-4">
                                                <Layers size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
                                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                                    {listTab === 'HISTORY' ? 'No completed statements yet.' : 'No active statements.'}
                                                </p>
                                            </div>
                                        );
                                    }

                                    return filteredStatements.map(stmt => (
                                        <div
                                            key={stmt.id}
                                            className="bank-recon-history-item group"
                                            onClick={() => handleViewStatement(stmt)}
                                        >
                                            <div className="flex items-start gap-3 w-full">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0 border border-indigo-100 dark:border-indigo-800/50">
                                                    <FileSpreadsheet size={18} className="text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate pr-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                        {stmt.fileName}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider ${stmt.status === 'COMPLETED' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                                            stmt.status === 'PENDING_AUDIT' ? 'bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                                                                'bg-slate-100/50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                            }`}>
                                                            {stmt.status?.replace('_', ' ') || 'PENDING MATCH'}
                                                        </span>
                                                        <span>{stmt.totalRows} rows</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                                        <span>{new Date(stmt.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => handleDelete(stmt.id!, e)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Detail View Layout (When viewing statement or parsed workbook) */
                <div className="space-y-6">
                    {/* Viewing banner for saved statements */}
                    {viewingStatement && (
                        <div className="recon-glass-panel p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                        <FileSpreadsheet size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-3">
                                            {viewingStatement.fileName}
                                            <span className={`px-2 py-0.5 rounded border text-xs font-bold tracking-wider ${viewingStatement.status === 'COMPLETED' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                                viewingStatement.status === 'PENDING_AUDIT' ? 'bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                                                    'bg-slate-100/50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                }`}>
                                                {viewingStatement.status?.replace('_', ' ') || 'PENDING MATCH'}
                                            </span>
                                        </h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                            Uploaded by <span className="font-medium text-slate-700 dark:text-slate-300">{viewingStatement.uploadedByName}</span> on {new Date(viewingStatement.uploadedAt).toLocaleDateString()}
                                            <span className="mx-2 opacity-50">•</span>
                                            {viewingStatement.totalRows} rows across {viewingStatement.sheetCount} sheet{viewingStatement.sheetCount > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sheet Tabs + Data Table */}
                    {activeSheets.length > 0 && !loadingView && (
                        <div className="space-y-6">
                            {/* Summary Stats */}
                            {currentSheet && currentSheet.rows.length > 0 && (() => {
                                const stats = getSheetStats(currentSheet);
                                return (
                                    <div className="bank-recon-summary">
                                        <div className="bank-recon-stat">
                                            <div className="bank-recon-stat-label"><Hash size={14} className="inline mr-1.5 text-slate-400" />Total Rows</div>
                                            <div className="bank-recon-stat-value">{stats.totalRows.toLocaleString()}</div>
                                        </div>
                                        {stats.dateRange && (
                                            <div className="bank-recon-stat">
                                                <div className="bank-recon-stat-label"><Calendar size={14} className="inline mr-1.5 text-slate-400" />Date Range</div>
                                                <div className="bank-recon-stat-value text-xl mt-1">{stats.dateRange.start} <span className="text-slate-300 mx-1">—</span> {stats.dateRange.end}</div>
                                            </div>
                                        )}
                                        {stats.debitCol && stats.totalDebit > 0 && (
                                            <div className="bank-recon-stat">
                                                <div className="bank-recon-stat-label"><ArrowDownRight size={14} className="inline mr-1.5 text-red-400" />Total Debit</div>
                                                <div className="bank-recon-stat-value debit">{formatCurrency(stats.totalDebit)}</div>
                                            </div>
                                        )}
                                        {stats.creditCol && stats.totalCredit > 0 && (
                                            <div className="bank-recon-stat">
                                                <div className="bank-recon-stat-label"><ArrowUpRight size={14} className="inline mr-1.5 text-emerald-400" />Total Credit</div>
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
                                            <span className="ml-1.5 text-xs opacity-60 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                                                {sheet.rows.length}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Data Table */}
                            {currentSheet && currentSheet.rows.length > 0 ? (
                                <div className="bank-recon-table-container">
                                    <table className="bank-recon-table">
                                        <thead>
                                            <tr>
                                                <th className="!text-center" style={{ width: 50 }}>#</th>
                                                {canAudit && (!viewingStatement || viewingStatement.status === 'PENDING_AUDIT') && (
                                                    <th className="!text-center" style={{ width: 80 }}>Audit</th>
                                                )}
                                                {currentSheet.headers.map(header => (
                                                    <th key={header}>{header}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentSheet.rows.map((row, rowIdx) => (
                                                <tr key={rowIdx}>
                                                    <td className="!text-center text-slate-400 dark:text-slate-600 text-xs font-mono">{rowIdx + 1}</td>
                                                    {canAudit && (!viewingStatement || viewingStatement.status === 'PENDING_AUDIT') && (
                                                        <td className="!text-center">
                                                            <button
                                                                onClick={() => handleToggleAudit(rowIdx, !!row['Cleared'])}
                                                                className={`p-1.5 rounded-md transition-colors ${row['Cleared'] ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                                                title={row['Cleared'] ? 'Mark as Uncleared' : 'Mark as Cleared'}
                                                            >
                                                                <CheckCircle2 size={16} />
                                                            </button>
                                                        </td>
                                                    )}
                                                    {currentSheet.headers.map(header => {
                                                        const value = row[header];
                                                        const isNum = isNumericColumn(currentSheet, header);
                                                        const isCurrency = isCurrencyColumn(header);
                                                        const isCheck = header.toLowerCase().includes('check') || header.toLowerCase().includes('chk');

                                                        let displayValue: React.ReactNode = <span className="text-slate-300 dark:text-slate-700">—</span>;

                                                        if (header === 'Remarks') {
                                                            const remarks = (value !== null && value !== undefined) ? String(value) : '';
                                                            const isEditable = !viewingStatement || viewingStatement.status !== 'COMPLETED';

                                                            let badge = <span className="text-slate-300 dark:text-slate-600 italic">No remark</span>;
                                                            if (remarks) {
                                                                if (remarks.includes('Partial Match')) {
                                                                    badge = <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-yellow-100/80 text-yellow-800 border border-yellow-200 dark:border-yellow-900/50 dark:bg-yellow-900/30 dark:text-yellow-400"><AlertTriangle size={12} className="mr-1.5 flex-shrink-0" /> {remarks}</span>;
                                                                } else if (remarks === 'Unidentified Transaction') {
                                                                    badge = <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-slate-100/80 text-slate-700 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"><AlertCircle size={12} className="mr-1.5 flex-shrink-0" /> {remarks}</span>;
                                                                } else {
                                                                    badge = <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-emerald-100/80 text-emerald-800 border border-emerald-200 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle2 size={12} className="mr-1.5 flex-shrink-0" /> {remarks}</span>;
                                                                }
                                                            }

                                                            displayValue = (
                                                                <div className="flex items-center gap-2">
                                                                    {badge}
                                                                    {isEditable && (
                                                                        <button
                                                                            onClick={() => handleEditRemark(rowIdx, remarks)}
                                                                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                                                                            title="Edit Remark"
                                                                        >
                                                                            <Edit2 size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else if (value !== null && value !== undefined && value !== '') {
                                                            if (isCurrency && typeof value === 'number') {
                                                                displayValue = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                            } else if (isCheck) {
                                                                // Strip commas explicitly from check numbers per user request
                                                                displayValue = String(value).replace(/,/g, '');
                                                            } else if (header === 'Linked Chart of Accounts') {
                                                                displayValue = <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-sm"><Layers size={12} className="mr-1.5 text-indigo-400 flex-shrink-0" /> {String(value)}</span>;
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
                            ) : currentSheet ? (
                                <div className="recon-glass-panel flex flex-col items-center justify-center py-16 px-4">
                                    <AlertCircle size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No Data Found</h3>
                                    <p className="text-slate-500 mt-1">Sheet "{currentSheet.sheetName}" is empty.</p>
                                </div>
                            ) : null}
                        </div>
                    )}

                    {loadingView && (
                        <div className="recon-glass-panel py-20 flex flex-col items-center justify-center">
                            <div className="bank-recon-spinner border-slate-300 border-t-purple-500 w-12 h-12 mb-4" />
                            <span className="text-slate-600 dark:text-slate-400 font-medium">Loading statement data...</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BankReconView;
