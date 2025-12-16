import React, { useState, useRef, useCallback } from 'react';
import {
    X,
    Upload,
    FileSpreadsheet,
    CheckCircle,
    AlertCircle,
    Download,
    Loader2,
    FileText
} from 'lucide-react';
import type { InventoryItem } from '../types/InventoryItem';
import {
    processStockImport,
    readFileAsText,
    generateCSVTemplate,
    type StockImportResult,
    type StockImportMatch
} from '../utils/stock-import.utils';

// ============================================================
// PROPS
// ============================================================

interface StockImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyCounts: (counts: StockImportMatch[]) => void;
    inventoryItems: InventoryItem[];
}

// ============================================================
// COMPONENT
// ============================================================

const StockImportModal: React.FC<StockImportModalProps> = ({
    isOpen,
    onClose,
    onApplyCounts,
    inventoryItems
}) => {
    // State
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<StockImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle file drop
    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            await processFile(file);
        }
    }, [inventoryItems]);

    // Handle file select
    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await processFile(file);
        }
    }, [inventoryItems]);

    // Process uploaded file
    const processFile = async (file: File) => {
        // Validate file type
        if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
            setError('Please upload a CSV file');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setFileName(file.name);

        try {
            const csvText = await readFileAsText(file);
            const importResult = processStockImport(csvText, inventoryItems);
            setResult(importResult);
        } catch (err) {
            console.error('Error processing file:', err);
            setError(err instanceof Error ? err.message : 'Failed to process file');
            setResult(null);
        } finally {
            setIsProcessing(false);
        }
    };

    // Download template
    const handleDownloadTemplate = () => {
        const template = generateCSVTemplate();
        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stock-count-template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Apply counts
    const handleApply = () => {
        if (result && result.matched.length > 0) {
            onApplyCounts(result.matched);
            handleReset();
            onClose();
        }
    };

    // Reset state
    const handleReset = () => {
        setResult(null);
        setError(null);
        setFileName(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl">
                            <FileSpreadsheet size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Import Stock Counts</h2>
                            <p className="text-sm text-slate-400">Upload a CSV file to auto-fill counts</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Template Download */}
                    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-600">
                        <div className="flex items-center gap-3">
                            <FileText size={20} className="text-cyan-400" />
                            <span className="text-sm text-slate-300">Need a template?</span>
                        </div>
                        <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <Download size={16} />
                            Download Template
                        </button>
                    </div>

                    {/* File Drop Zone */}
                    {!result && (
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragging
                                    ? 'border-purple-500 bg-purple-500/10'
                                    : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
                                }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {isProcessing ? (
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 size={48} className="text-purple-400 animate-spin" />
                                    <p className="text-slate-400">Processing {fileName}...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <Upload size={48} className="text-slate-500" />
                                    <div>
                                        <p className="text-white font-medium">Drop your CSV file here</p>
                                        <p className="text-sm text-slate-500 mt-1">or click to browse</p>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-2">
                                        Supported columns: SKU, Name, Quantity, Unit
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                            <AlertCircle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-red-300 font-medium">Error processing file</p>
                                <p className="text-sm text-red-400/80 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Results Preview */}
                    {result && (
                        <div className="space-y-4">
                            {/* File Info */}
                            <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                                <FileSpreadsheet size={20} className="text-slate-400" />
                                <span className="text-slate-300 text-sm">{fileName}</span>
                                <button
                                    onClick={handleReset}
                                    className="ml-auto text-xs text-slate-500 hover:text-white transition-colors"
                                >
                                    Upload different file
                                </button>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-white">{result.totalRows}</p>
                                    <p className="text-sm text-slate-400">Total Rows</p>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <CheckCircle size={18} className="text-green-400" />
                                        <p className="text-2xl font-bold text-green-400">{result.matched.length}</p>
                                    </div>
                                    <p className="text-sm text-green-300">Matched</p>
                                </div>
                                <div className={`rounded-xl p-4 text-center ${result.errors.length > 0
                                        ? 'bg-red-500/10 border border-red-500/30'
                                        : 'bg-slate-700/50'
                                    }`}>
                                    <div className="flex items-center justify-center gap-2">
                                        <AlertCircle size={18} className={result.errors.length > 0 ? 'text-red-400' : 'text-slate-500'} />
                                        <p className={`text-2xl font-bold ${result.errors.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                            {result.errors.length}
                                        </p>
                                    </div>
                                    <p className={`text-sm ${result.errors.length > 0 ? 'text-red-300' : 'text-slate-400'}`}>
                                        Unmatched
                                    </p>
                                </div>
                            </div>

                            {/* Matched Items Table */}
                            {result.matched.length > 0 && (
                                <div className="bg-slate-700/30 rounded-xl border border-slate-600 overflow-hidden">
                                    <div className="p-3 border-b border-slate-600 flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                            <CheckCircle size={16} className="text-green-400" />
                                            Matched Items ({result.matched.length})
                                        </h4>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-800/50 sticky top-0">
                                                <tr>
                                                    <th className="text-left p-2 text-slate-400 font-medium">Item</th>
                                                    <th className="text-right p-2 text-slate-400 font-medium">Quantity</th>
                                                    <th className="text-center p-2 text-slate-400 font-medium">Match</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.matched.slice(0, 50).map((item, idx) => (
                                                    <tr key={idx} className="border-t border-slate-700/50">
                                                        <td className="p-2 text-white">{item.itemName}</td>
                                                        <td className="p-2 text-right text-cyan-400">{item.quantity} {item.unit}</td>
                                                        <td className="p-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-xs ${item.matchedBy === 'sku'
                                                                    ? 'bg-purple-500/20 text-purple-300'
                                                                    : 'bg-cyan-500/20 text-cyan-300'
                                                                }`}>
                                                                {item.matchedBy === 'sku' ? 'SKU' : 'Name'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {result.matched.length > 50 && (
                                            <div className="p-2 text-center text-xs text-slate-500">
                                                ... and {result.matched.length - 50} more items
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Error Items Table */}
                            {result.errors.length > 0 && (
                                <div className="bg-red-500/5 rounded-xl border border-red-500/30 overflow-hidden">
                                    <div className="p-3 border-b border-red-500/30 flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-red-300 flex items-center gap-2">
                                            <AlertCircle size={16} className="text-red-400" />
                                            Unmatched Items ({result.errors.length})
                                        </h4>
                                    </div>
                                    <div className="max-h-32 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-800/50 sticky top-0">
                                                <tr>
                                                    <th className="text-left p-2 text-slate-400 font-medium">Row</th>
                                                    <th className="text-left p-2 text-slate-400 font-medium">Name/SKU</th>
                                                    <th className="text-left p-2 text-slate-400 font-medium">Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.errors.map((err, idx) => (
                                                    <tr key={idx} className="border-t border-red-500/20">
                                                        <td className="p-2 text-slate-400">#{err.row}</td>
                                                        <td className="p-2 text-red-300">
                                                            {err.name || err.sku}
                                                        </td>
                                                        <td className="p-2 text-red-400/70 text-xs">
                                                            Not found in inventory
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    {result && result.matched.length > 0 && (
                        <button
                            onClick={handleApply}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
                        >
                            <CheckCircle size={18} />
                            Apply {result.matched.length} Counts
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockImportModal;
