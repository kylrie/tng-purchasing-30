import React, { useState, useMemo, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Receipt, FileText, Link as LinkIcon, AlertTriangle, CheckCircle, Edit3, Clock } from 'lucide-react';
import type { PCFExpenseItem } from '../services/pcf.service';
import type { Business } from '../../../shared/types';
import { SettingsService } from '../../../shared/services/settings.service';
import AccountSelector, { type SelectedAccount } from '../../../shared/components/AccountSelector';
import { UI_CONSTANTS } from '../../../config/constants';

// Check if a BU is corporate (for expense sharing indicator)
const isCorpBu = (buName: string): boolean => {
    return buName.toUpperCase().includes('ATHOUSANDCONCEPTS') && buName.toUpperCase().includes('CORP');
};

interface PCFLiquidationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (expenses: PCFExpenseItem[], receiptsLink: string, remarks: string) => Promise<void>;
    onSaveDraft?: (expenses: PCFExpenseItem[], receiptsLink: string, remarks: string) => Promise<void>;
    cashOnHand: number;
    pcfCeiling: number;
    businesses: Business[];  // Added for BU dropdown
    // Edit mode props
    editingId?: string | null;
    initialData?: {
        expenses: PCFExpenseItem[];
        receiptsLink?: string;
        remarks?: string;
    } | null;
    title?: string;
}

// Helper: Format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(amount);
};

// Helper: Get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
    return new Date().toISOString().split('T')[0];
};

// Helper: Create empty expense row
const createEmptyExpense = (): PCFExpenseItem => ({
    id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: getTodayDate(),
    payeeVendor: '',
    tin: '',
    orNo: '',
    completeAddress: '',
    coaCode: '',
    coaName: '',
    itemDescription: '',
    vat: 0,
    ewt: 0,
    amount: 0,
});

const PCFLiquidationDrawer: React.FC<PCFLiquidationDrawerProps> = ({
    isOpen,
    onClose,
    onSubmit,
    onSaveDraft,
    cashOnHand,
    pcfCeiling,
    businesses = [],
    editingId,
    initialData,
    title,
}) => {
    const [expenses, setExpenses] = useState<PCFExpenseItem[]>([createEmptyExpense()]);
    const [receiptsLink, setReceiptsLink] = useState('');
    const [remarks, setRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [deadlineInfo, setDeadlineInfo] = useState<{ deadlineDay: number; isLate: boolean; daysLate: number; expenseMonthName?: string } | null>(null);
    // FIX Issue #2: Replace alert() with inline toast notification
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

    // Initialize form when editing existing liquidation
    useEffect(() => {
        if (isOpen && initialData) {
            setExpenses(initialData.expenses.length > 0 ? initialData.expenses : [createEmptyExpense()]);
            setReceiptsLink(initialData.receiptsLink || '');
            setRemarks(initialData.remarks || '');
        } else if (isOpen && !editingId) {
            // Reset form for new liquidation
            setExpenses([createEmptyExpense()]);
            setReceiptsLink('');
            setRemarks('');
        }
    }, [isOpen, initialData, editingId]);

    // Calculate totals
    const totals = useMemo(() => {
        const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const totalVat = expenses.reduce((sum, e) => sum + (e.vat || 0), 0);
        const totalEwt = expenses.reduce((sum, e) => sum + (e.ewt || 0), 0);
        const netAmount = totalAmount - totalEwt + totalVat;
        return { totalAmount, totalVat, totalEwt, netAmount };
    }, [expenses]);

    // Calculate deadline info based on expense dates
    useEffect(() => {
        let isMounted = true; // FIX Issue #3: Cleanup flag to prevent setState on unmounted component

        const calculateDeadline = async () => {
            try {
                const settings = await SettingsService.getPcfSettings();
                const now = new Date();

                // Get expense dates from current expenses
                const expenseDates = expenses.map(e => e.date).filter(Boolean);

                if (expenseDates.length > 0) {
                    // Use expense-based calculation
                    const { isLate, daysLate, expenseMonth } = SettingsService.calculateLatenessFromExpenses(
                        now,
                        expenseDates,
                        settings.deadlineDay
                    );
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
                    if (isMounted) {
                        setDeadlineInfo({
                            deadlineDay: settings.deadlineDay,
                            isLate,
                            daysLate,
                            expenseMonthName: monthNames[expenseMonth]
                        });
                    }
                } else {
                    // Fallback: use simple current-month check
                    const { isLate, daysLate } = SettingsService.calculateLateness(now, settings.deadlineDay);
                    if (isMounted) {
                        setDeadlineInfo({ deadlineDay: settings.deadlineDay, isLate, daysLate });
                    }
                }
            } catch (error) {
                console.error('Error calculating deadline:', error);
            }
        };
        if (isOpen) {
            calculateDeadline();
        }

        return () => {
            isMounted = false; // Cleanup on unmount
        };
    }, [isOpen, expenses]);

    // FIX High #6: When editing a draft, the original amount is already counted in cashOnHand
    // So we need to add it back for comparison (otherwise editing same amount fails)
    const originalDraftAmount = useMemo(() => {
        if (editingId && initialData && initialData.expenses) {
            return initialData.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        }
        return 0;
    }, [editingId, initialData]);

    // Effective available cash = cashOnHand + originalDraftAmount (since draft is already deducted)
    const effectiveCashOnHand = cashOnHand + originalDraftAmount;

    // Check if exceeds available cash (use effective cash for editing)
    const exceedsCashOnHand = totals.totalAmount > effectiveCashOnHand;

    // Add expense row
    const addExpenseRow = () => {
        setExpenses([...expenses, createEmptyExpense()]);
    };

    // Remove expense row
    const removeExpenseRow = (index: number) => {
        if (expenses.length > 1) {
            setExpenses(expenses.filter((_, i) => i !== index));
        }
    };

    // Update expense field
    const updateExpense = <K extends keyof PCFExpenseItem>(
        index: number,
        field: K,
        value: PCFExpenseItem[K]
    ) => {
        const updated = [...expenses];
        updated[index] = { ...updated[index], [field]: value };
        setExpenses(updated);
    };

    // Set today's date for a row
    const setTodayDate = (index: number) => {
        updateExpense(index, 'date', getTodayDate());
    };

    // FIX Medium #12: Helper to validate URL format
    const isValidUrl = (url: string): boolean => {
        if (!url) return true; // Empty is allowed
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    // Validate form
    const isValid = useMemo(() => {
        if (expenses.length === 0) return false;
        if (totals.totalAmount <= 0) return false;
        if (exceedsCashOnHand) return false;
        // FIX Medium #12: Validate receiptsLink URL format
        if (receiptsLink && !isValidUrl(receiptsLink)) return false;

        // Check required fields
        for (const exp of expenses) {
            if (!exp.date || !exp.orNo || !exp.amount || !exp.buId) {
                return false;
            }
        }
        return true;
    }, [expenses, totals.totalAmount, exceedsCashOnHand, receiptsLink]);

    // Handle submit
    const handleSubmit = async () => {
        if (submitting || savingDraft) return;
        if (!isValid) return;

        setSubmitting(true);
        try {
            await onSubmit(expenses, receiptsLink, remarks);
            // Reset form
            setExpenses([createEmptyExpense()]);
            setReceiptsLink('');
            setRemarks('');
        } catch (error) {
            console.error('Submit error:', error);
        } finally {
            setSubmitting(false);
        }
    };

    // Handle save draft
    const handleSaveDraft = async () => {
        if (savingDraft || submitting || !onSaveDraft) return;

        // Basic validation - at least one expense with some data
        const hasData = expenses.some(e => e.amount > 0 || e.payeeVendor || e.orNo);
        if (!hasData) {
            // FIX Issue #2: Replace alert() with toast notification
            setToast({ type: 'warning', message: 'Please add at least one expense item before saving.' });
            setTimeout(() => setToast(null), UI_CONSTANTS.TOAST_DURATION_SHORT);
            return;
        }

        setSavingDraft(true);
        try {
            await onSaveDraft(expenses, receiptsLink, remarks);
            // FIX Issue #2: Replace alert() with toast notification
            setToast({ type: 'success', message: 'Draft saved successfully!' });
            setTimeout(() => setToast(null), UI_CONSTANTS.TOAST_DURATION_SHORT);
        } catch (error) {
            console.error('Save draft error:', error);
            // FIX Issue #2: Replace alert() with toast notification
            setToast({ type: 'error', message: 'Failed to save draft. Please try again.' });
            setTimeout(() => setToast(null), UI_CONSTANTS.TOAST_DURATION_SHORT);
        } finally {
            setSavingDraft(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* FIX Issue #2: Toast Notification UI */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${toast.type === 'success' ? 'bg-emerald-600 text-white' :
                    toast.type === 'error' ? 'bg-red-600 text-white' :
                        'bg-yellow-600 text-white'
                    }`}>
                    {toast.type === 'success' && <CheckCircle size={18} />}
                    {toast.type === 'error' && <AlertTriangle size={18} />}
                    {toast.type === 'warning' && <AlertTriangle size={18} />}
                    <span className="text-sm font-medium">{toast.message}</span>
                    <button
                        onClick={() => setToast(null)}
                        className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Drawer - Expanded width for 10-column table */}
            <div className="fixed inset-y-0 right-0 w-[95vw] max-w-[1600px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {editingId ? <Edit3 size={24} className="text-amber-500 dark:text-yellow-400" /> : <Receipt size={24} className="text-purple-600 dark:text-purple-400" />}
                            {title || (editingId ? 'Edit PCF Liquidation' : 'New PCF Liquidation')}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Available: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(cashOnHand)}</span>
                            {' '}of {formatCurrency(pcfCeiling)}
                        </p>
                    </div>
                    <button
                        onClick={async () => {
                            // handleExportCSV
                            const lines: string[] = [];
                            const esc = (v: string | number | null | undefined) => {
                                if (v === null || v === undefined) return '';
                                const s = String(v);
                                return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
                            };

                            // Header section with Metadata
                            lines.push('PCF Liquidation Export');
                            lines.push(`Title,${esc(title || (editingId ? 'Edit PCF Liquidation' : 'New PCF Liquidation'))}`);
                            lines.push(`Export Date,${new Date().toLocaleString()}`);
                            lines.push(`Cash on Hand,${cashOnHand.toFixed(2)}`);
                            lines.push(`Total Amount,${totals.totalAmount.toFixed(2)}`);
                            lines.push(`Remarks,${esc(remarks)}`);
                            lines.push('');

                            // Expenses Table
                            lines.push('Date,Payee/Vendor,TIN,OR No.,Address,COA Code,COA Name,Description,VAT,EWT,Amount,Business Unit');

                            expenses.forEach(exp => {
                                lines.push([
                                    esc(exp.date),
                                    esc(exp.payeeVendor),
                                    esc(exp.tin),
                                    esc(exp.orNo),
                                    esc(exp.completeAddress),
                                    esc(exp.coaCode),
                                    esc(exp.coaName),
                                    esc(exp.itemDescription),
                                    (exp.vat || 0).toFixed(2),
                                    (exp.ewt || 0).toFixed(2),
                                    (exp.amount || 0).toFixed(2),
                                    esc(exp.buName)
                                ].join(','));
                            });

                            // Footer Totals
                            lines.push('');
                            lines.push(`,,,,,,,,${totals.totalVat.toFixed(2)},${totals.totalEwt.toFixed(2)},${totals.totalAmount.toFixed(2)},`);

                            const BOM = '\uFEFF';
                            const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `pcf_liquidation_${getTodayDate()}.csv`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors mr-2"
                        title="Export to CSV"
                    >
                        <Receipt size={24} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Expense Table */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={16} className="text-purple-600 dark:text-purple-400" />
                                Expense Details (10-Column Audit Format)
                            </h3>
                            <button
                                onClick={addExpenseRow}
                                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm flex items-center gap-1 px-3 py-1 border border-purple-600/50 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            >
                                <Plus size={14} /> Add Row
                            </button>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                            <table className="w-full text-sm" style={{ minWidth: '1350px' }}>
                                <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-3 py-3 text-left" style={{ width: '130px' }}>Date</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '160px' }}>Payee/Vendor</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '100px' }}>TIN</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '100px' }}>OR No.*</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '160px' }}>Address</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '140px' }}>COA/Account</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '160px' }}>Description</th>
                                        <th className="px-3 py-3 text-right" style={{ width: '150px' }}>VAT</th>
                                        <th className="px-3 py-3 text-right" style={{ width: '150px' }}>EWT</th>
                                        <th className="px-3 py-3 text-right" style={{ width: '130px' }}>Amount*</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '140px' }}>Business Unit</th>
                                        <th className="px-2 py-3" style={{ width: '40px' }}></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                    {expenses.map((expense, index) => (
                                        <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            {/* Date with Today button */}
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="date"
                                                        value={expense.date}
                                                        onChange={(e) => updateExpense(index, 'date', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                    />
                                                    <button
                                                        onClick={() => setTodayDate(index)}
                                                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400"
                                                        title="Set Today"
                                                    >
                                                        <Calendar size={12} />
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Payee/Vendor */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="Vendor name"
                                                    value={expense.payeeVendor}
                                                    onChange={(e) => updateExpense(index, 'payeeVendor', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                />
                                            </td>

                                            {/* TIN */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="TIN"
                                                    value={expense.tin}
                                                    onChange={(e) => updateExpense(index, 'tin', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                />
                                            </td>

                                            {/* OR No. */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="OR#"
                                                    value={expense.orNo}
                                                    onChange={(e) => updateExpense(index, 'orNo', e.target.value)}
                                                    className={`w-full px-2 py-1.5 bg-white dark:bg-slate-800 border rounded text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none ${!expense.orNo ? 'border-red-500/50' : 'border-slate-300 dark:border-slate-600'
                                                        }`}
                                                />
                                            </td>

                                            {/* Address */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="Address"
                                                    value={expense.completeAddress}
                                                    onChange={(e) => updateExpense(index, 'completeAddress', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                />
                                            </td>

                                            {/* COA Account Selector */}
                                            <td className="px-3 py-2">
                                                <AccountSelector
                                                    value={expense.coaCode ? { code: expense.coaCode, name: expense.coaName || '' } : null}
                                                    onChange={(account: SelectedAccount | null) => {
                                                        const updated = [...expenses];
                                                        updated[index] = {
                                                            ...updated[index],
                                                            coaCode: account?.code || '',
                                                            coaName: account?.name || '',
                                                        };
                                                        setExpenses(updated);
                                                    }}
                                                    placeholder="Select COA..."
                                                />
                                            </td>

                                            {/* Description */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="Description"
                                                    value={expense.itemDescription}
                                                    onChange={(e) => updateExpense(index, 'itemDescription', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                />
                                            </td>

                                            {/* VAT */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={expense.vat || ''}
                                                    onChange={(e) => updateExpense(index, 'vat', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm text-right focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                />
                                            </td>

                                            {/* EWT */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={expense.ewt || ''}
                                                    onChange={(e) => updateExpense(index, 'ewt', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm text-right focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                />
                                            </td>

                                            {/* Amount */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={expense.amount || ''}
                                                    onChange={(e) => updateExpense(index, 'amount', parseFloat(e.target.value) || 0)}
                                                    className={`w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded text-slate-900 dark:text-white text-sm text-right focus:ring-1 focus:ring-purple-500 focus:outline-none ${!expense.amount ? 'border-red-500/50' : 'border-slate-300 dark:border-slate-600'
                                                        }`}
                                                />
                                            </td>

                                            {/* Business Unit */}
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1">
                                                    <select
                                                        value={expense.buId || ''}
                                                        onChange={(e) => {
                                                            const bu = businesses.find(b => b.id === e.target.value);
                                                            const updated = [...expenses];
                                                            updated[index] = {
                                                                ...updated[index],
                                                                buId: e.target.value,
                                                                buName: bu?.name || '',
                                                            };
                                                            setExpenses(updated);
                                                        }}
                                                        className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                    >
                                                        <option value="">Select BU...</option>
                                                        {businesses.map(b => (
                                                            <option key={b.id} value={b.id}>{b.name}</option>
                                                        ))}
                                                    </select>
                                                    {expense.buName && isCorpBu(expense.buName) && (
                                                        <span className="px-1 py-0.5 bg-purple-600/30 text-purple-300 rounded text-[8px] font-medium shrink-0">SHARE</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Delete */}
                                            <td className="px-3 py-2">
                                                <button
                                                    onClick={() => removeExpenseRow(index)}
                                                    disabled={expenses.length === 1}
                                                    className="text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>

                                {/* Totals Footer */}
                                <tfoot className="bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-600">
                                    <tr className="text-slate-600 dark:text-slate-300 font-medium">
                                        <td colSpan={8} className="px-2 py-3 text-right text-sm">
                                            Totals:
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm">
                                            {formatCurrency(totals.totalVat)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm">
                                            {formatCurrency(totals.totalEwt)}
                                        </td>
                                        <td className="px-2 py-3 text-right text-sm font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(totals.totalAmount)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* VAT/EWT Calculation Note */}
                        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Net Amount = Total - EWT + VAT = {formatCurrency(totals.netAmount)}
                        </div>
                    </div>

                    {/* Exceeds Warning */}
                    {exceedsCashOnHand && (
                        <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg flex items-start gap-3">
                            <AlertTriangle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-red-300 font-medium">Exceeds Available Balance</p>
                                <p className="text-red-400 text-sm mt-1">
                                    Total ({formatCurrency(totals.totalAmount)}) exceeds your available cash on hand ({formatCurrency(cashOnHand)}).
                                    Please reduce expenses or wait for pending liquidations to be replenished.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Late Submission Warning */}
                    {deadlineInfo?.isLate && !editingId && (
                        <div className="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg flex items-start gap-3">
                            <Clock size={20} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-yellow-300 font-medium">Past Deadline Submission</p>
                                <p className="text-yellow-400/80 text-sm mt-1">
                                    {deadlineInfo.expenseMonthName ? (
                                        <>
                                            <strong>{deadlineInfo.expenseMonthName}</strong> expenses were due by <strong>Day {deadlineInfo.deadlineDay}</strong> of the following month.
                                        </>
                                    ) : (
                                        <>
                                            You are submitting past the deadline (Day {deadlineInfo.deadlineDay}).
                                        </>
                                    )}
                                    {' '}This liquidation will be permanently marked as <strong className="text-red-400">LATE (+{deadlineInfo.daysLate} days)</strong>.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Attachments Link */}
                    <div>
                        <label className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                            <LinkIcon size={12} /> Google Drive Link (Receipts/Attachments)
                        </label>
                        <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={receiptsLink}
                            onChange={(e) => setReceiptsLink(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                            <FileText size={12} /> Remarks
                        </label>
                        <textarea
                            placeholder="Additional notes or justifications..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {expenses.length} expense{expenses.length !== 1 ? 's' : ''} | Total:
                        <span className={`font-bold ml-1 ${exceedsCashOnHand ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                            {formatCurrency(totals.totalAmount)}
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        {onSaveDraft && (
                            <button
                                onClick={handleSaveDraft}
                                disabled={savingDraft || submitting}
                                className="px-5 py-2 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors border border-slate-300 dark:border-slate-600"
                            >
                                <FileText size={18} />
                                {savingDraft ? 'Saving...' : 'Save Draft'}
                            </button>
                        )}
                        <button
                            onClick={handleSubmit}
                            disabled={!isValid || submitting || savingDraft}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            <CheckCircle size={18} />
                            {submitting ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PCFLiquidationDrawer;
