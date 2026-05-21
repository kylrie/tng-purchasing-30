import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, History, Calendar, Package, Users, Eye } from 'lucide-react';
import { EventImportService } from '../services/event-import.service';
import { useAuth } from '../../../contexts/useAuth';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import type { EventImportMappedRow, EventImportBatch, EventPackageTemplate, EventSimulatedDeduction } from '../types/event-sales.types';
import type { InventoryItem } from '../../inventory/types/InventoryItem';

interface Props { businesses: { id: string; name: string }[]; }
type ViewState = 'UPLOAD' | 'PREVIEW' | 'SIMULATION' | 'COMMITTING' | 'SUCCESS';
type Tab = 'import' | 'history';

const EventImportDashboard: React.FC<Props> = () => {
    const { currentUser } = useAuth();
    const { selectedBusinessUnit } = useBusinessUnit();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectedBU = selectedBusinessUnit === 'all' ? (currentUser?.businessUnitIds?.[0] || '') : selectedBusinessUnit;

    const [activeTab, setActiveTab] = useState<Tab>('import');
    const [viewState, setViewState] = useState<ViewState>('UPLOAD');
    const [file, setFile] = useState<File | null>(null);
    const [fileHash, setFileHash] = useState('');
    const [mappedRows, setMappedRows] = useState<EventImportMappedRow[]>([]);
    const [inventoryItems, setInventoryItems] = useState<(InventoryItem & { id: string })[]>([]);
    const [, setTemplates] = useState<EventPackageTemplate[]>([]);
    const [importHistory, setImportHistory] = useState<EventImportBatch[]>([]);
    const [simDeductions, setSimDeductions] = useState<EventSimulatedDeduction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);

    // Load history on tab switch
    useEffect(() => {
        if (activeTab === 'history' && selectedBU) {
            EventImportService.getImportHistory(selectedBU).then(setImportHistory).catch(console.error);
        }
    }, [activeTab, selectedBU]);

    const processFile = useCallback(async (f: File) => {
        setFile(f);
        setError(null);
        setLoading(true);
        try {
            const hash = await EventImportService.generateFileHash(f);
            setFileHash(hash);
            const dup = await EventImportService.checkDuplicateImport(hash, selectedBU);
            if (dup) { setError(`This file was already imported on ${dup.importedAt?.toDate?.()?.toLocaleDateString() ?? 'unknown date'}.`); setLoading(false); return; }
            const rows = await EventImportService.parseFile(f);
            const { mappedRows: mapped, templates: tpls, inventoryItems: inv } = await EventImportService.matchRowsToInventory(rows, selectedBU);
            setMappedRows(mapped);
            setTemplates(tpls);
            setInventoryItems(inv);
            setViewState('PREVIEW');
        } catch (err: any) { setError(err.message || 'Failed to parse file'); }
        setLoading(false);
    }, [selectedBU]);

    const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }, [processFile]);
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); }, [processFile]);

    const handleSimulate = async () => {
        setLoading(true);
        try {
            const itemsMap = new Map(inventoryItems.map(i => [i.id, i]));
            const deds = await EventImportService.simulateEventImport(mappedRows.filter(r => !r.hasErrors), itemsMap);
            setSimDeductions(deds);
            setViewState('SIMULATION');
        } catch (err: any) { setError(err.message); }
        setLoading(false);
    };

    const handleCommit = async () => {
        if (!currentUser || !file) return;
        setViewState('COMMITTING');
        try {
            const batchId = await EventImportService.commitImport({
                mappedRows: mappedRows.filter(r => !r.hasErrors),
                businessUnitId: selectedBU, userId: currentUser.id, userName: currentUser.name,
                fileHash, fileName: file.name,
            });
            setSuccessId(batchId);
            setViewState('SUCCESS');
        } catch (err: any) { setError(err.message); setViewState('SIMULATION'); }
    };

    const resetState = () => { setViewState('UPLOAD'); setFile(null); setMappedRows([]); setSimDeductions([]); setError(null); setSuccessId(null); };

    const matchedCount = mappedRows.filter(r => !r.hasErrors).length;
    const errorCount = mappedRows.filter(r => r.hasErrors).length;
    const totalPax = mappedRows.reduce((s, r) => s + r.paxCount, 0);

    // ── Render Helpers ──
    const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
        const cls = status === 'MATCHED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30';
        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{status}</span>;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Calendar className="w-5 h-5 text-white" />
                        </div>
                        Event Sales Import
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Upload event sales data with automatic BOM explosion</p>
                </div>
                <div className="flex gap-2">
                    {(['import', 'history'] as Tab[]).map(tab => (
                        <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'import') resetState(); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                            {tab === 'import' ? <><Upload size={16} className="inline mr-1.5" />Import</> : <><History size={16} className="inline mr-1.5" />History</>}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3"><AlertTriangle className="text-red-400 flex-shrink-0" size={20} /><p className="text-red-300 text-sm">{error}</p><button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button></div>}

            {/* ── IMPORT TAB ── */}
            {activeTab === 'import' && (
                <>
                    {/* Upload Zone */}
                    {viewState === 'UPLOAD' && (
                        <div onDragOver={e => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer backdrop-blur-sm
                                ${dragActive ? 'border-violet-400 bg-violet-500/10 scale-[1.01]' : 'border-slate-600 bg-slate-800/40 hover:border-violet-500/50 hover:bg-slate-800/60'}`}
                            onClick={() => fileInputRef.current?.click()}>
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                            {loading ? <Loader2 className="w-12 h-12 text-violet-400 mx-auto animate-spin" /> : (
                                <>
                                    <FileSpreadsheet className={`w-16 h-16 mx-auto mb-4 ${dragActive ? 'text-violet-400' : 'text-slate-500'}`} />
                                    <p className="text-lg font-semibold text-slate-200 mb-2">{dragActive ? 'Drop your event file here' : 'Upload Event Sales Sheet'}</p>
                                    <p className="text-sm text-slate-400">Drag & drop an .xlsx or .csv file, or click to browse</p>
                                    <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-slate-500">
                                        <span className="px-3 py-1 bg-slate-700/50 rounded-full">Event Date</span>
                                        <span className="px-3 py-1 bg-slate-700/50 rounded-full">Event Name</span>
                                        <span className="px-3 py-1 bg-slate-700/50 rounded-full">Package Name</span>
                                        <span className="px-3 py-1 bg-slate-700/50 rounded-full">Guest Count (Pax)</span>
                                        <span className="px-3 py-1 bg-slate-700/50 rounded-full">Selection: *</span>
                                        <span className="px-3 py-1 bg-slate-700/50 rounded-full">Consumables Logged</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Preview */}
                    {viewState === 'PREVIEW' && (
                        <div className="space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Events', value: mappedRows.length, icon: Calendar, color: 'violet' },
                                    { label: 'Total Pax', value: totalPax, icon: Users, color: 'cyan' },
                                    { label: 'Matched', value: matchedCount, icon: CheckCircle2, color: 'emerald' },
                                    { label: 'Errors', value: errorCount, icon: XCircle, color: 'red' },
                                ].map(s => (
                                    <div key={s.label} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-1"><s.icon size={16} className={`text-${s.color}-400`} /><span className="text-xs text-slate-400">{s.label}</span></div>
                                        <p className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Event Rows Table */}
                            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                                    <h3 className="font-semibold text-white">Parsed Events</h3>
                                    <span className="text-xs text-slate-400">{file?.name}</span>
                                </div>
                                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-900/50 sticky top-0"><tr>
                                            {['#', 'Date', 'Event Name', 'Package', 'Pax', 'Selections', 'Consumables', 'Status'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody className="divide-y divide-slate-700/30">
                                            {mappedRows.map((row, i) => (
                                                <tr key={i} className={`hover:bg-slate-700/20 ${row.hasErrors ? 'bg-red-500/5' : ''}`}>
                                                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                                                    <td className="px-4 py-3 text-slate-200">{row.eventDate}</td>
                                                    <td className="px-4 py-3 text-white font-medium">{row.eventName}</td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={row.packageMatchStatus} />
                                                        <span className="ml-2 text-slate-300">{row.matchedPackageName || row.packageName}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-cyan-400 font-semibold">{row.paxCount}</td>
                                                    <td className="px-4 py-3">
                                                        {row.resolvedSelections.map((s, j) => (
                                                            <div key={j} className="flex items-center gap-1 mb-0.5">
                                                                <StatusBadge status={s.matchStatus} />
                                                                <span className="text-slate-300 text-xs">{s.groupName}: {s.matchedItemName || s.inputText}</span>
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {row.resolvedConsumables.map((c, j) => (
                                                            <div key={j} className="flex items-center gap-1 mb-0.5">
                                                                <StatusBadge status={c.matchStatus} />
                                                                <span className="text-slate-300 text-xs">{c.matchedItemName || c.inputText} ×{c.qty}</span>
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td className="px-4 py-3">{row.hasErrors ? <XCircle size={18} className="text-red-400" /> : <CheckCircle2 size={18} className="text-emerald-400" />}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-between items-center">
                                <button onClick={resetState} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">← Start Over</button>
                                <button onClick={handleSimulate} disabled={matchedCount === 0 || loading}
                                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50 flex items-center gap-2">
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
                                    Simulate BOM Explosion ({matchedCount} events)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* BOM Simulation */}
                    {viewState === 'SIMULATION' && (
                        <div className="space-y-4">
                            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-slate-700/50">
                                    <h3 className="font-semibold text-white flex items-center gap-2"><Package size={18} className="text-fuchsia-400" /> BOM Explosion Preview</h3>
                                    <p className="text-xs text-slate-400 mt-1">{simDeductions.length} total deductions across {matchedCount} events</p>
                                </div>
                                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-900/50 sticky top-0"><tr>
                                            {['Item', 'Type', 'Event', 'Current Stock', 'Deduction', 'New Stock'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody className="divide-y divide-slate-700/30">
                                            {simDeductions.filter(d => d.type !== 'FG').map((d, i) => (
                                                <tr key={i} className={`hover:bg-slate-700/20 ${d.newTheoreticalStock < 0 ? 'bg-red-500/5' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <span className="text-white font-medium">{d.itemName}</span>
                                                        {d.parentItemName && <span className="block text-xs text-slate-500">← {d.parentItemName}</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.type === 'RM' ? 'bg-amber-500/20 text-amber-400' : d.type === 'FG_DIRECT' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                            {d.type === 'RM' ? 'Raw Material' : d.type === 'FG_DIRECT' ? 'Direct FG' : 'Production'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-300 text-xs">{d.eventName}</td>
                                                    <td className="px-4 py-3 text-slate-300">{d.currentTheoreticalStock.toFixed(2)}</td>
                                                    <td className="px-4 py-3 text-red-400 font-semibold">-{d.deductionAmount.toFixed(2)}</td>
                                                    <td className={`px-4 py-3 font-semibold ${d.newTheoreticalStock < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {d.newTheoreticalStock.toFixed(2)}
                                                        {d.newTheoreticalStock < 0 && <AlertTriangle size={14} className="inline ml-1 text-red-400" />}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <button onClick={() => setViewState('PREVIEW')} className="px-4 py-2 text-sm text-slate-400 hover:text-white">← Back to Preview</button>
                                <button onClick={handleCommit}
                                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                                    <CheckCircle2 size={18} /> Approve & Commit
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Committing */}
                    {viewState === 'COMMITTING' && (
                        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12 text-center">
                            <Loader2 className="w-16 h-16 text-violet-400 mx-auto animate-spin mb-4" />
                            <p className="text-lg font-semibold text-white">Committing Event Sales & Exploding BOM...</p>
                            <p className="text-sm text-slate-400 mt-2">Writing stock transactions and deducting inventory</p>
                        </div>
                    )}

                    {/* Success */}
                    {viewState === 'SUCCESS' && (
                        <div className="bg-slate-800/50 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-12 text-center">
                            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                            <p className="text-xl font-bold text-white mb-2">Import Successful!</p>
                            <p className="text-sm text-slate-400 mb-1">{matchedCount} events committed with BOM explosion</p>
                            <p className="text-xs text-slate-500">Batch ID: {successId}</p>
                            <button onClick={resetState} className="mt-6 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all">
                                Import Another File
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === 'history' && (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-700/50"><h3 className="font-semibold text-white">Import History</h3></div>
                    {importHistory.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">No event imports found.</div>
                    ) : (
                        <div className="divide-y divide-slate-700/30">
                            {importHistory.map(batch => (
                                <div key={batch.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium">{batch.fileName}</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {batch.totalEvents} events · {batch.totalPax} pax · ₱{batch.totalRevenue?.toLocaleString() ?? '0'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400">{batch.importedByName}</p>
                                            <p className="text-xs text-slate-500">{batch.importedAt?.toDate?.()?.toLocaleString() ?? ''}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EventImportDashboard;
