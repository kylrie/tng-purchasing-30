import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Upload, FileSpreadsheet, Search, RefreshCw, Check, AlertTriangle, Loader2,
    ChevronRight, ChevronDown, Filter, Plus, Edit2, Trash2, X, Save, ToggleLeft, ToggleRight
} from 'lucide-react';
import Papa from 'papaparse';
import { CoaService } from '../../../shared/services/coa.service';
import type { ChartOfAccount } from '../../../shared/types/firebase.types';

import { usePermissions } from '../../../hooks/usePermissions';

interface ChartOfAccountsViewProps {
    // Can add props for permissions if needed
}

// Account Edit/Add Modal
interface AccountModalProps {
    account: Partial<ChartOfAccount> | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (account: ChartOfAccount) => Promise<void>;
    existingAccounts: ChartOfAccount[];
}

const AccountModal: React.FC<AccountModalProps> = ({ account, isOpen, onClose, onSave, existingAccounts }) => {
    const [formData, setFormData] = useState<Partial<ChartOfAccount>>({
        code: '',
        name: '',
        parentId: '',
        classification: '',
        financialStatement: '',
        accountType: '',
        cashFlowClassification: '',
        isActive: true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = !!account?.code;

    useEffect(() => {
        if (account) {
            setFormData(account);
        } else {
            setFormData({
                code: '',
                name: '',
                parentId: '',
                classification: '',
                financialStatement: '',
                accountType: '',
                cashFlowClassification: '',
                isActive: true,
            });
        }
        setError(null);
    }, [account, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.code?.trim()) {
            setError('Account code is required');
            return;
        }
        if (!formData.name?.trim()) {
            setError('Account name is required');
            return;
        }

        // Check for duplicate code when adding new
        if (!isEditing && existingAccounts.some(a => a.code === formData.code?.trim())) {
            setError('An account with this code already exists');
            return;
        }

        setSaving(true);
        try {
            await onSave({
                code: formData.code.trim(),
                name: formData.name?.trim() || '',
                parentId: formData.parentId?.trim() || '',
                classification: formData.classification?.trim() || '',
                financialStatement: formData.financialStatement?.trim() || '',
                accountType: formData.accountType?.trim() || '',
                cashFlowClassification: formData.cashFlowClassification?.trim() || '',
                isActive: formData.isActive !== false,
            });
            onClose();
        } catch (err) {
            setError(`Failed to save: ${err}`);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full p-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

    // Get unique values for dropdowns
    const accountTypes = [...new Set(existingAccounts.map(a => a.accountType).filter(Boolean))].sort();
    const classifications = [...new Set(existingAccounts.map(a => a.classification).filter(Boolean))].sort();
    const statements = [...new Set(existingAccounts.map(a => a.financialStatement).filter(Boolean))].sort();
    const parentOptions = existingAccounts.filter(a => a.code !== formData.code).map(a => a.name).filter(Boolean);

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {isEditing ? <Edit2 size={20} className="text-yellow-500 dark:text-yellow-400" /> : <Plus size={20} className="text-green-600 dark:text-green-400" />}
                            {isEditing ? 'Edit Account' : 'Add New Account'}
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-lg text-red-600 dark:text-red-300 text-sm flex items-center gap-2">
                                <AlertTriangle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {/* Code */}
                            <div>
                                <label className={labelClass}>Account Code *</label>
                                <input
                                    type="text"
                                    value={formData.code || ''}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g., 1111001"
                                    disabled={isEditing}
                                />
                                {isEditing && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Code cannot be changed</p>}
                            </div>

                            {/* Name */}
                            <div>
                                <label className={labelClass}>Account Name *</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g., Cash on Hand"
                                />
                            </div>

                            {/* Parent ID */}
                            <div>
                                <label className={labelClass}>Parent Account</label>
                                <input
                                    type="text"
                                    list="parent-options"
                                    value={formData.parentId || ''}
                                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g., CASH IN BANK"
                                />
                                <datalist id="parent-options">
                                    {parentOptions.map(p => <option key={p} value={p} />)}
                                </datalist>
                            </div>

                            {/* Account Type */}
                            <div>
                                <label className={labelClass}>Account Type</label>
                                <input
                                    type="text"
                                    list="type-options"
                                    value={formData.accountType || ''}
                                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g., Assets"
                                />
                                <datalist id="type-options">
                                    {accountTypes.map(t => <option key={t} value={t} />)}
                                </datalist>
                            </div>

                            {/* Classification */}
                            <div>
                                <label className={labelClass}>Classification</label>
                                <input
                                    type="text"
                                    list="class-options"
                                    value={formData.classification || ''}
                                    onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g., Current Asset & Financing"
                                />
                                <datalist id="class-options">
                                    {classifications.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>

                            {/* Financial Statement */}
                            <div>
                                <label className={labelClass}>Financial Statement</label>
                                <input
                                    type="text"
                                    list="statement-options"
                                    value={formData.financialStatement || ''}
                                    onChange={(e) => setFormData({ ...formData, financialStatement: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g., Statement of Financial"
                                />
                                <datalist id="statement-options">
                                    {statements.map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>

                            {/* Cash Flow Classification */}
                            <div className="col-span-2">
                                <label className={labelClass}>Cash Flow Classification</label>
                                <input
                                    type="text"
                                    value={formData.cashFlowClassification || ''}
                                    onChange={(e) => setFormData({ ...formData, cashFlowClassification: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g., Current A Financing"
                                />
                            </div>

                            {/* Active Toggle */}
                            <div className="col-span-2">
                                <label className={labelClass}>Status</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${formData.isActive
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700/50'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                                        }`}
                                >
                                    {formData.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                    {formData.isActive ? 'Active' : 'Inactive'}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {saving ? 'Saving...' : 'Save Account'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

// Main Component
const ChartOfAccountsView: React.FC<ChartOfAccountsViewProps> = () => {
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('');
    const [showTreeView, setShowTreeView] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [importResult, setImportResult] = useState<{
        success: boolean;
        message: string;
        imported?: number;
        failed?: number;
    } | null>(null);

    // Modal states
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Partial<ChartOfAccount> | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { hasPermission } = usePermissions();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load accounts on mount
    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const data = await CoaService.getAccounts();
            setAccounts(data);
        } catch (error) {
            console.error('Error loading accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    // Get unique account types for filter dropdown
    const accountTypes = useMemo(() => {
        const types = new Set(accounts.map(a => a.accountType).filter(Boolean));
        return Array.from(types).sort();
    }, [accounts]);

    // Build tree structure
    const treeData = useMemo(() => {
        if (!showTreeView) return { roots: [], parentMap: new Map() };

        const parentMap = new Map<string, ChartOfAccount[]>();
        const roots: ChartOfAccount[] = [];

        accounts.forEach(acc => {
            if (!acc.parentId || acc.parentId.trim() === '') {
                roots.push(acc);
            } else {
                const children = parentMap.get(acc.parentId) || [];
                children.push(acc);
                parentMap.set(acc.parentId, children);
            }
        });

        return { roots, parentMap };
    }, [accounts, showTreeView]);

    // Toggle node expansion
    const toggleNode = (parentId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(parentId)) {
                next.delete(parentId);
            } else {
                next.add(parentId);
            }
            return next;
        });
    };

    // Expand all nodes
    const expandAll = () => {
        const allParentIds = new Set(accounts.map(a => a.parentId).filter(Boolean));
        setExpandedNodes(allParentIds as Set<string>);
    };

    // Handle add new account
    const handleAddNew = () => {
        setEditingAccount(null);
        setModalOpen(true);
    };

    // Handle edit account
    const handleEdit = (account: ChartOfAccount) => {
        setEditingAccount(account);
        setModalOpen(true);
    };

    // Handle save account
    const handleSaveAccount = async (account: ChartOfAccount) => {
        await CoaService.upsertAccount(account);
        await loadAccounts();
    };

    // Handle delete account
    const handleDelete = async (code: string) => {
        try {
            await CoaService.deleteAccount(code);
            await loadAccounts();
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete account');
        }
    };

    // Handle toggle active
    const handleToggleActive = async (account: ChartOfAccount) => {
        try {
            await CoaService.toggleAccountStatus(account.code, !account.isActive);
            await loadAccounts();
        } catch (error) {
            console.error('Toggle error:', error);
        }
    };

    // Handle CSV file import
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportResult(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let csvText = e.target?.result as string;

                const lines = csvText.split(/\r?\n/);
                let startIndex = 0;
                for (let i = 0; i < lines.length; i++) {
                    const trimmed = lines[i].trim();
                    if (trimmed === '' || /^,+$/.test(trimmed)) {
                        startIndex = i + 1;
                    } else {
                        break;
                    }
                }

                if (startIndex > 0) {
                    csvText = lines.slice(startIndex).join('\n');
                }

                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (header: string) => header.trim(),
                    complete: async (results) => {
                        await processParseResults(results);
                    },
                    error: (err: Error) => {
                        setImportResult({ success: false, message: `Failed to parse CSV: ${err.message}` });
                        setImporting(false);
                    },
                });
            } catch (err) {
                setImportResult({ success: false, message: `Failed to read file: ${err}` });
                setImporting(false);
            }
        };

        reader.onerror = () => {
            setImportResult({ success: false, message: 'Failed to read file' });
            setImporting(false);
        };

        reader.readAsText(file);
    };

    const processParseResults = async (results: Papa.ParseResult<unknown>) => {
        try {
            const headers = results.meta.fields || [];

            const findColumn = (row: Record<string, unknown>, variations: string[]): string | undefined => {
                for (const variation of variations) {
                    if (row[variation] !== undefined) return String(row[variation]);
                    const key = Object.keys(row).find(k => k.toLowerCase().trim() === variation.toLowerCase().trim());
                    if (key && row[key] !== undefined) return String(row[key]);
                }
                return undefined;
            };

            const mappedAccounts: ChartOfAccount[] = (results.data as Record<string, unknown>[]).map((row) => ({
                code: findColumn(row, ['Account No', 'Account No.', 'AccountNo', 'Code', 'account no', 'ACCOUNT NO']) || '',
                name: findColumn(row, ['NAME', 'Name', 'Account Name', 'AccountName', 'name']) || '',
                parentId: findColumn(row, ['Parent ID', 'ParentID', 'Parent Id', 'parent id', 'PARENT ID']) || '',
                classification: findColumn(row, ['Account Classification', 'Classification', 'classification', 'ACCOUNT CLASSIFICATION']) || '',
                financialStatement: findColumn(row, ['Financial Statement', 'FinancialStatement', 'financial statement', 'FINANCIAL STATEMENT']) || '',
                accountType: findColumn(row, ['Account Type', 'AccountType', 'Type', 'account type', 'ACCOUNT TYPE']) || '',
                cashFlowClassification: findColumn(row, ['General C Cash Flow Classification', 'Cash Flow Classification', 'CashFlowClassification', 'Cash Flow']) || '',
                isActive: true,
            } as ChartOfAccount));

            const validAccounts = mappedAccounts.filter(a => a.code && a.code.toString().trim() !== '');

            if (validAccounts.length === 0) {
                setImportResult({ success: false, message: `No valid accounts found. Headers: [${headers.join(', ')}]` });
                setImporting(false);
                return;
            }

            const result = await CoaService.importAccountsBatch(validAccounts);
            setImportResult({
                success: result.failed === 0,
                message: result.failed === 0 ? `Successfully imported ${result.imported} accounts!` : `Imported ${result.imported}, ${result.failed} failed.`,
            });
            await loadAccounts();
        } catch (err) {
            setImportResult({ success: false, message: `Import failed: ${err}` });
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Filter accounts
    const filteredAccounts = useMemo(() => {
        return accounts.filter(account => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = !query ||
                account.code?.toLowerCase().includes(query) ||
                account.name?.toLowerCase().includes(query) ||
                account.accountType?.toLowerCase().includes(query) ||
                account.classification?.toLowerCase().includes(query);
            const matchesType = !filterType || account.accountType === filterType;
            return matchesSearch && matchesType;
        });
    }, [accounts, searchQuery, filterType]);

    // Render tree node
    const renderTreeNode = (account: ChartOfAccount, depth: number = 0) => {
        const children = treeData.parentMap.get(account.name) || treeData.parentMap.get(account.code) || [];
        const hasChildren = children.length > 0;
        const isExpanded = expandedNodes.has(account.name) || expandedNodes.has(account.code);

        return (
            <React.Fragment key={account.code}>
                <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!account.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2 font-mono font-medium text-purple-600 dark:text-purple-300" style={{ paddingLeft: `${16 + depth * 24}px` }}>
                        <div className="flex items-center gap-2">
                            {hasChildren ? (
                                <button onClick={() => toggleNode(account.name || account.code)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            ) : <span className="w-5" />}
                            {account.code}
                        </div>
                    </td>
                    <td className="px-4 py-2 text-slate-900 dark:text-white font-medium">{account.name}</td>
                    <td className="px-4 py-2">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{account.accountType}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 text-sm">{account.classification}</td>
                    <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                            {hasPermission('admin:coa:edit') && (
                                <>
                                    <button onClick={() => handleEdit(account)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-yellow-500 dark:hover:text-yellow-400" title="Edit">
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => handleToggleActive(account)} className={`p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded ${account.isActive ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`} title={account.isActive ? 'Deactivate' : 'Activate'}>
                                        {account.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                    </button>
                                </>
                            )}
                            {hasPermission('admin:coa:delete') && (
                                <button onClick={() => setDeleteConfirm(account.code)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400" title="Delete">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
                {hasChildren && isExpanded && children.map((child: ChartOfAccount) => renderTreeNode(child, depth + 1))}
            </React.Fragment >
        );
    };

    const cardClass = "bg-white dark:bg-slate-800/50 backdrop-blur-xl p-6 rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-slate-700";
    const inputClass = "w-full p-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                        <FileSpreadsheet size={20} className="text-purple-600 dark:text-purple-400" />
                        Chart of Accounts
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {accounts.length} accounts • {accounts.filter(a => a.isActive).length} active
                    </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {hasPermission('admin:coa:create') && (
                        <button onClick={handleAddNew} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                            <Plus size={16} />
                            Add Account
                        </button>
                    )}
                    <button onClick={loadAccounts} disabled={loading} className="px-3 py-2 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white border border-slate-300 dark:border-transparent rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
                        <RefreshCw size={16} className={`text-slate-500 dark:text-slate-300 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    {hasPermission('admin:coa:create') && (
                        <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors">
                            <Upload size={16} />
                            {importing ? 'Importing...' : 'Import CSV'}
                            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} disabled={importing} className="hidden" />
                        </label>
                    )}
                </div>
            </div>

            {/* Import Result */}
            {importResult && (
                <div className={`p-4 rounded-lg border flex items-start gap-3 ${importResult.success ? 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-700/50' : 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-700/50'}`}>
                    {importResult.success ? <Check size={20} className="text-green-600 dark:text-green-400 mt-0.5" /> : <AlertTriangle size={20} className="text-red-600 dark:text-red-400 mt-0.5" />}
                    <p className={importResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}>{importResult.message}</p>
                    <button onClick={() => setImportResult(null)} className="ml-auto text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white">×</button>
                </div>
            )}

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input type="text" className={`${inputClass} pl-10`} placeholder="Search by code, name, type..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className="relative">
                    <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="pl-9 pr-8 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none appearance-none cursor-pointer min-w-[180px]">
                        <option value="">All Types</option>
                        {accountTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <button onClick={() => setShowTreeView(!showTreeView)} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${showTreeView ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                    <ChevronRight size={16} className={showTreeView ? 'rotate-90' : ''} />
                    Tree View
                </button>
                {showTreeView && (
                    <button onClick={expandAll} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg text-sm font-medium transition-colors">
                        Expand All
                    </button>
                )}
            </div>

            {/* Table */}
            <div className={cardClass}>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={32} className="text-purple-600 dark:text-purple-400 animate-spin" />
                    </div>
                ) : filteredAccounts.length === 0 ? (
                    <div className="text-center py-12">
                        <FileSpreadsheet size={48} className="mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">{searchQuery || filterType ? 'No accounts match your filters.' : 'No accounts found.'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 uppercase text-xs sticky top-0 z-20 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-3">Code</th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Classification</th>
                                    <th className="px-4 py-3 w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {showTreeView ? (
                                    treeData.roots.filter(r => !filterType || r.accountType === filterType).map(account => renderTreeNode(account))
                                ) : (
                                    filteredAccounts.map((account) => (
                                        <tr key={account.code} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!account.isActive ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-2 font-mono font-medium text-purple-600 dark:text-purple-300">{account.code}</td>
                                            <td className="px-4 py-2 text-slate-900 dark:text-white font-medium">{account.name}</td>
                                            <td className="px-4 py-2">
                                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{account.accountType}</span>
                                            </td>
                                            <td className="px-4 py-2 text-slate-500 dark:text-slate-400 text-sm">{account.classification}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-1">
                                                    {hasPermission('admin:coa:edit') && (
                                                        <>
                                                            <button onClick={() => handleEdit(account)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-yellow-500 dark:hover:text-yellow-400" title="Edit">
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button onClick={() => handleToggleActive(account)} className={`p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded ${account.isActive ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`} title={account.isActive ? 'Deactivate' : 'Activate'}>
                                                                {account.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                                            </button>
                                                        </>
                                                    )}
                                                    {hasPermission('admin:coa:delete') && (
                                                        <button onClick={() => setDeleteConfirm(account.code)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400" title="Delete">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && filteredAccounts.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                        Showing {filteredAccounts.length} of {accounts.length} accounts
                    </div>
                )}
            </div>

            {/* Account Modal */}
            <AccountModal
                account={editingAccount}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSaveAccount}
                existingAccounts={accounts}
            />

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setDeleteConfirm(null)} />
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-w-md">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                                <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                                Delete Account?
                            </h3>
                            <p className="text-slate-500 dark:text-slate-300 mb-6">
                                Are you sure you want to delete account <span className="font-mono text-purple-600 dark:text-purple-400">{deleteConfirm}</span>? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors">
                                    Cancel
                                </button>
                                <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors">
                                    <Trash2 size={16} />
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ChartOfAccountsView;
