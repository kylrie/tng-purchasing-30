import React, { useState, useMemo } from 'react';
import { Receipt, Link as LinkIcon, FileText, AlertTriangle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type { Requisition, Supplier, LiquidationExpense } from '../types';
import type { Business } from '../../../shared/types';

// New liquidation line item structure matching the screenshot
export interface LiquidationItemRow {
    id: string;          // Unique row ID
    date: string;        // Date of expense
    vendorId: string;    // Supplier/Payee ID
    vendorName: string;  // Supplier/Payee Name
    tin: string;         // TIN (auto-filled from vendor)
    orNo: string;        // Official Receipt Number
    address: string;     // Address (auto-filled from vendor)
    coa: string;         // Chart of Accounts / Account
    description: string; // Description
    vat: number;         // VAT amount
    ewt: number;         // EWT amount
    amount: number;      // Total amount
    buId?: string;       // Tagged Business Unit ID
    buName?: string;     // Tagged Business Unit Name
    isAdditionalExpense?: boolean; // Whether this is an additional expense (not PRF-linked)
}

interface LiquidationFormProps {
    requisition: Requisition;
    suppliers?: Supplier[];  // For vendor dropdown
    businesses?: Business[]; // For BU dropdown
    coaOptions?: string[];   // Configurable COA options from settings
    onSubmit: (payload: {
        items: LiquidationItemRow[];
        totalBudget: number;
        totalActual: number;
        variance: number;
        receiptsLink: string;
        remarks: string;
    }) => void;
    isLoading?: boolean;
    readOnly?: boolean;
}

// Default COA Options (fallback if not configured in settings)
const DEFAULT_COA_OPTIONS = [
    'Food Supplies',
    'Beverages',
    'Office Supplies',
    'Transportation',
    'Utilities',
    'Repairs & Maintenance',
    'Professional Fees',
    'Rent',
    'Miscellaneous',
    'Other',
];

// Helper: Format currency
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
    }).format(amount);
};

// Generate unique ID
const generateId = () => `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const LiquidationForm: React.FC<LiquidationFormProps> = ({
    requisition,
    suppliers = [],
    businesses = [],
    coaOptions = DEFAULT_COA_OPTIONS,
    onSubmit,
    isLoading = false,
    readOnly = false,
}) => {
    // Initialize items - either from saved data or create empty rows
    const [items, setItems] = useState<LiquidationItemRow[]>(() => {
        // First check expenses array (new format from LiquidationPage)
        if (requisition.liquidationDetails?.expenses && requisition.liquidationDetails.expenses.length > 0) {
            // FIX: Use LiquidationExpense type instead of any
            return requisition.liquidationDetails.expenses.map((exp: LiquidationExpense, idx: number) => ({
                id: exp.id || `exp-${idx}`,
                date: exp.date || new Date().toISOString().split('T')[0],
                vendorId: exp.vendorId || '',
                vendorName: exp.vendorName || '',
                tin: exp.tin || '',
                orNo: exp.orNo || '',
                address: exp.address || '',
                coa: exp.coaCode || exp.coaName || '',
                description: exp.description || '',
                vat: exp.vat || 0,
                ewt: exp.ewt || 0,
                amount: exp.amount || 0,
                buId: exp.buId || requisition.businessId,
                buName: exp.buName || '',
                isAdditionalExpense: exp.isAdditionalExpense || false,
            }));
        }
        // Fallback to items array (legacy format)
        if (requisition.liquidationDetails?.items) {
            // Handle both new format and legacy format
            const savedItems = requisition.liquidationDetails.items;
            if (savedItems.length > 0 && 'vendorId' in savedItems[0]) {
                // New format
                return savedItems as unknown as LiquidationItemRow[];
            } else {
                // Legacy format - convert to new format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (savedItems as any[]).map((item: any, idx: number) => ({
                    id: `legacy-${idx}`,
                    date: new Date().toISOString().split('T')[0],
                    vendorId: '',
                    vendorName: '',
                    tin: '',
                    orNo: item.receiptRef || '',
                    address: '',
                    coa: '',
                    description: item.name || '',
                    vat: 0,
                    ewt: 0,
                    amount: (item.quantity || 1) * (item.actualCost || 0),
                    buId: item.buId || requisition.businessId,
                    buName: item.buName || '',
                }));
            }
        }
        // Start with one empty row
        return [{
            id: generateId(),
            date: new Date().toISOString().split('T')[0],
            vendorId: '',
            vendorName: '',
            tin: '',
            orNo: '',
            address: '',
            coa: '',
            description: '',
            vat: 0,
            ewt: 0,
            amount: 0,
            buId: requisition.businessId,
            buName: businesses.find(b => b.id === requisition.businessId)?.name || '',
        }];
    });

    const [receiptsLink, setReceiptsLink] = useState(requisition.liquidationDetails?.receiptsLink || '');
    const [remarks, setRemarks] = useState(requisition.liquidationDetails?.remarks || '');

    // Calculate totals
    const { totalBudget, totalActual, totalVat, totalEwt, totalAdditionalExpenses, variance } = useMemo(() => {
        const budget = requisition.totalAmount || (requisition.items || []).reduce((sum, item) => sum + (item.quantity * item.price), 0);
        // In read-only mode, use actualCost from requisition.items; otherwise use expense amounts
        const actual = readOnly
            ? (requisition.items || []).reduce((sum, item) => sum + (item.actualCost || 0), 0)
            : items.reduce((sum, item) => sum + (item?.amount || 0), 0);
        const vat = items.reduce((sum, item) => sum + (item?.vat || 0), 0);
        const ewt = items.reduce((sum, item) => sum + (item?.ewt || 0), 0);
        // Calculate additional expenses (rows marked as isAdditionalExpense)
        const additionalExpenses = items
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((item: any) => item.isAdditionalExpense === true)
            .reduce((sum, item) => sum + (item?.amount || 0), 0);
        return {
            totalBudget: budget,
            totalActual: actual,
            totalVat: vat,
            totalEwt: ewt,
            totalAdditionalExpenses: additionalExpenses,
            variance: budget - actual - additionalExpenses,
        };
    }, [items, requisition, readOnly]);

    // Update a specific field in a row
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateItem = (index: number, field: keyof LiquidationItemRow, value: any) => {
        const updated = [...items];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        (updated[index] as any)[field] = value;
        setItems(updated);
    };

    // Handle vendor selection with autofill
    const handleVendorChange = (index: number, vendorId: string) => {
        const vendor = suppliers.find(s => s.id === vendorId);
        const updated = [...items];
        updated[index].vendorId = vendorId;
        updated[index].vendorName = vendor?.name || '';
        updated[index].tin = vendor?.tin || '';
        updated[index].address = vendor?.address || '';
        setItems(updated);
    };

    // Handle BU selection
    const handleBuChange = (index: number, buId: string) => {
        const bu = businesses.find(b => b.id === buId);
        const updated = [...items];
        updated[index].buId = buId;
        updated[index].buName = bu?.name || '';
        setItems(updated);
    };

    // Check if a BU is corporate (for expense sharing indicator)
    const isCorpBu = (buName: string) => {
        return buName.toUpperCase().includes('ATHOUSANDCONCEPTS') && buName.toUpperCase().includes('CORP');
    };

    // Add new row
    const addRow = () => {
        setItems([...items, {
            id: generateId(),
            date: new Date().toISOString().split('T')[0],
            vendorId: '',
            vendorName: '',
            tin: '',
            orNo: '',
            address: '',
            coa: '',
            description: '',
            vat: 0,
            ewt: 0,
            amount: 0,
            buId: requisition.businessId,
            buName: businesses.find(b => b.id === requisition.businessId)?.name || '',
        }]);
    };

    // Delete row
    const deleteRow = (index: number) => {
        if (items.length > 1) {
            const updated = items.filter((_, i) => i !== index);
            setItems(updated);
        }
    };

    const handleSubmit = () => {
        onSubmit({
            items,
            totalBudget,
            totalActual,
            variance,
            receiptsLink,
            remarks,
        });
    };

    return (
        <div className="space-y-6">
            {/* Header: Budget Released */}
            <div className="bg-emerald-900/30 rounded-lg p-4 border border-emerald-700/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-900/50 flex items-center justify-center">
                            <PesoSign size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs text-emerald-400 uppercase tracking-wider">Budget Released</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(totalBudget)}</p>
                        </div>
                    </div>
                    {requisition.chequeNumber && (
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Cheque No.</p>
                            <p className="text-sm font-medium text-purple-400">{requisition.chequeNumber}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Expense Breakdown Table - Named "Itemized Costs" in read-only mode */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Receipt size={16} /> {readOnly ? 'Itemized Costs' : 'Expense Breakdown'}
                    </h3>
                    {!readOnly && (
                        <button
                            onClick={addRow}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition-colors"
                        >
                            <Plus size={14} /> Add Row
                        </button>
                    )}
                </div>
                {/* Desktop Table - Hidden on mobile */}
                <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-x-auto hidden md:block">
                    <table className="w-full text-xs min-w-[900px]">
                        <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                            {readOnly ? (
                                <tr>
                                    <th className="px-2 py-2 text-left">Item</th>
                                    <th className="px-1 py-2 text-right">Qty</th>
                                    <th className="px-1 py-2 text-left">Supplier</th>
                                    <th className="px-1 py-2 text-left">TIN</th>
                                    <th className="px-1 py-2 text-left">OR No.</th>
                                    <th className="px-1 py-2 text-left">Description</th>
                                    <th className="px-1 py-2 text-right">Actual Cost</th>
                                    <th className="px-1 py-2 text-right">VAT</th>
                                    <th className="px-1 py-2 text-right">EWT</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="px-2 py-2 text-left w-[100px]">Date</th>
                                    <th className="px-1 py-2 text-left w-[140px]">Payee/Vendor</th>
                                    <th className="px-1 py-2 text-left w-[90px]">TIN</th>
                                    <th className="px-1 py-2 text-left w-[70px]">OR No.*</th>
                                    <th className="px-1 py-2 text-left w-[120px]">Address</th>
                                    <th className="px-1 py-2 text-left w-[100px]">COA/Account</th>
                                    <th className="px-1 py-2 text-left w-[120px]">Description</th>
                                    <th className="px-1 py-2 text-right w-[70px]">VAT</th>
                                    <th className="px-1 py-2 text-right w-[70px]">EWT</th>
                                    <th className="px-1 py-2 text-right w-[90px]">Amount*</th>
                                    <th className="px-1 py-2 text-left w-[120px]">Business Unit</th>
                                    <th className="px-1 py-2 w-[30px]"></th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {readOnly ? (
                                /* Read-only mode: Show PRF items with expense data */
                                <>
                                    {(requisition.items || []).map((prfItem, index) => {
                                        // Get corresponding expense entry (non-additional expenses at the same index)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        const regularExpenses = items.filter((exp: any) => !exp.isAdditionalExpense);
                                        const expense = regularExpenses[index];
                                        const qty = prfItem.quantity || 0;

                                        return (
                                            <tr key={prfItem.itemId || index} className="hover:bg-slate-800/30">
                                                <td className="px-2 py-2 text-slate-200">{prfItem.name}</td>
                                                <td className="px-1 py-2 text-right text-slate-400">{qty} {prfItem.uom}</td>
                                                <td className="px-1 py-2 text-slate-200">{expense?.vendorName || '-'}</td>
                                                <td className="px-1 py-2 text-slate-400 text-[10px]">{expense?.tin || '-'}</td>
                                                <td className="px-1 py-2 text-slate-300">{expense?.orNo || '-'}</td>
                                                <td className="px-1 py-2 text-slate-300">{expense?.description || expense?.coa || '-'}</td>
                                                <td className="px-1 py-2 text-right text-white font-medium">{formatCurrency(prfItem.actualCost || 0)}</td>
                                                <td className="px-1 py-2 text-right text-emerald-400">{expense?.vat ? formatCurrency(expense.vat) : '-'}</td>
                                                <td className="px-1 py-2 text-right text-amber-400">{expense?.ewt ? formatCurrency(expense.ewt) : '-'}</td>
                                            </tr>
                                        );
                                    })}
                                    {/* Totals Row */}
                                    <tr className="bg-slate-900/60 font-medium">
                                        <td colSpan={6} className="px-2 py-2 text-right text-slate-400">Totals:</td>
                                        <td className="px-1 py-2 text-right text-white font-bold">
                                            {formatCurrency((requisition.items || []).reduce((sum, item) => sum + (item.actualCost || 0), 0))}
                                        </td>
                                        <td className="px-1 py-2 text-right text-emerald-400">{formatCurrency(totalVat)}</td>
                                        <td className="px-1 py-2 text-right text-amber-400">{formatCurrency(totalEwt)}</td>
                                    </tr>
                                    {/* Additional Expenses Section in read-only mode */}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    {items.filter((exp: any) => exp.isAdditionalExpense === true && (exp.amount > 0 || exp.vendorName)).length > 0 && (
                                        <>
                                            <tr className="bg-slate-800/50">
                                                <td colSpan={9} className="px-2 py-2 text-sm font-semibold text-yellow-400 uppercase tracking-wider">
                                                    Additional Expenses
                                                </td>
                                            </tr>
                                            {items
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                .filter((exp: any) => exp.isAdditionalExpense === true && (exp.amount > 0 || exp.vendorName))
                                                .map((expense, index) => (
                                                    <tr key={expense.id || `add-${index}`} className="hover:bg-slate-800/30">
                                                        <td className="px-2 py-2 text-slate-300" colSpan={2}>{expense.date || '-'}</td>
                                                        <td className="px-1 py-2 text-slate-200">{expense.vendorName || '-'}</td>
                                                        <td className="px-1 py-2 text-slate-400 text-[10px]">{expense.tin || '-'}</td>
                                                        <td className="px-1 py-2 text-slate-300">{expense.orNo || '-'}</td>
                                                        <td className="px-1 py-2 text-slate-300">{expense.description || expense.coa || '-'}</td>
                                                        <td className="px-1 py-2 text-right text-yellow-400 font-medium">{formatCurrency(expense.amount || 0)}</td>
                                                        <td className="px-1 py-2 text-right text-emerald-400">{expense.vat ? formatCurrency(expense.vat) : '-'}</td>
                                                        <td className="px-1 py-2 text-right text-amber-400">{expense.ewt ? formatCurrency(expense.ewt) : '-'}</td>
                                                    </tr>
                                                ))}
                                            <tr className="bg-slate-900/60 font-medium">
                                                <td colSpan={6} className="px-2 py-2 text-right text-slate-400">Additional Expenses Total:</td>
                                                <td className="px-1 py-2 text-right text-yellow-400 font-bold">{formatCurrency(totalAdditionalExpenses)}</td>
                                                <td colSpan={2}></td>
                                            </tr>
                                        </>
                                    )}
                                </>
                            ) : (
                                /* Edit mode */
                                <>
                                    {items
                                        .filter(item => item.amount > 0 || item.vendorName || !readOnly)
                                        .map((item, index) => (
                                            <tr key={item.id} className="hover:bg-slate-800/30">
                                                {/* Date */}
                                                <td className="px-2 py-2">
                                                    {readOnly ? (
                                                        <span className="text-slate-200">{item.date}</span>
                                                    ) : (
                                                        <input
                                                            type="date"
                                                            value={item.date}
                                                            onChange={(e) => updateItem(index, 'date', e.target.value)}
                                                            className="w-full px-1 py-1 bg-slate-900 border border-slate-600 rounded text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs"
                                                        />
                                                    )}
                                                </td>
                                                {/* Payee/Vendor */}
                                                <td className="px-1 py-2">
                                                    {readOnly ? (
                                                        <span className="text-slate-200 whitespace-normal break-words">{item.vendorName || '-'}</span>
                                                    ) : (
                                                        <select
                                                            value={item.vendorId}
                                                            onChange={(e) => handleVendorChange(index, e.target.value)}
                                                            className="w-full px-1 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-[10px]"
                                                        >
                                                            <option value="">Select...</option>
                                                            {suppliers.map(s => (
                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                {/* TIN (auto-filled) */}
                                                <td className="px-1 py-2">
                                                    <span className="text-slate-400 text-[10px] whitespace-normal break-words">{item.tin || '-'}</span>
                                                </td>
                                                {/* OR No. */}
                                                <td className="px-1 py-2">
                                                    {readOnly ? (
                                                        <span className="text-slate-200 whitespace-normal break-words">{item.orNo || '-'}</span>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            placeholder="OR#"
                                                            value={item.orNo}
                                                            onChange={(e) => updateItem(index, 'orNo', e.target.value)}
                                                            className="w-full px-1 py-1 bg-slate-900 border border-red-500/50 rounded text-slate-200 focus:ring-1 focus:ring-red-500 focus:outline-none text-xs"
                                                        />
                                                    )}
                                                </td>
                                                {/* Address (auto-filled) */}
                                                <td className="px-1 py-2">
                                                    <span className="text-slate-400 text-[10px] whitespace-normal break-words block max-w-[100px]" title={item.address}>
                                                        {item.address || '-'}
                                                    </span>
                                                </td>
                                                {/* COA/Account */}
                                                <td className="px-1 py-2">
                                                    {readOnly ? (
                                                        <span className="text-slate-200 whitespace-normal break-words">{item.coa || '-'}</span>
                                                    ) : (
                                                        <select
                                                            value={item.coa}
                                                            onChange={(e) => updateItem(index, 'coa', e.target.value)}
                                                            className="w-full px-1 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-[10px]"
                                                        >
                                                            <option value="">Select COA...</option>
                                                            {coaOptions.map((coa: string) => (
                                                                <option key={coa} value={coa}>{coa}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                {/* Description */}
                                                <td className="px-1 py-2">
                                                    {readOnly ? (
                                                        <span className="text-slate-200 whitespace-normal break-words">{item.description || '-'}</span>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            placeholder="Description"
                                                            value={item.description}
                                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                            className="w-full px-1 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs"
                                                        />
                                                    )}
                                                </td>
                                                {/* VAT */}
                                                <td className="px-1 py-2">
                                                    {readOnly ? (
                                                        <span className="text-slate-200 text-right block">{formatCurrency(item.vat)}</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.vat}
                                                            onChange={(e) => updateItem(index, 'vat', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-1 py-1 bg-slate-900 border border-slate-600 rounded text-right text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs"
                                                        />
                                                    )}
                                                </td>
                                                {/* EWT */}
                                                <td className="px-1 py-2">
                                                    {readOnly ? (
                                                        <span className="text-slate-200 text-right block">{formatCurrency(item.ewt)}</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.ewt}
                                                            onChange={(e) => updateItem(index, 'ewt', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-1 py-1 bg-slate-900 border border-slate-600 rounded text-right text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none text-xs"
                                                        />
                                                    )}
                                                </td>
                                                {/* Amount */}
                                                <td className="px-1 py-2">
                                                    {readOnly ? (
                                                        <span className="text-white font-medium text-right block">{formatCurrency(item.amount)}</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.amount}
                                                            onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-1 py-1 bg-slate-900 border border-red-500/50 rounded text-right text-white font-medium focus:ring-1 focus:ring-red-500 focus:outline-none text-xs"
                                                        />
                                                    )}
                                                </td>
                                                {/* Business Unit */}
                                                <td className="px-1 py-2">
                                                    {readOnly ? (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-slate-200 text-xs whitespace-normal break-words">{item.buName || '-'}</span>
                                                            {item.buName && isCorpBu(item.buName) && (
                                                                <span className="px-1 py-0.5 bg-purple-600/30 text-purple-300 rounded text-[8px] font-medium">SHARE</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1">
                                                            <select
                                                                value={item.buId || ''}
                                                                onChange={(e) => handleBuChange(index, e.target.value)}
                                                                className="flex-1 px-1 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200 focus:ring-1 focus:ring-emerald-500 focus:outline-none text-[10px]"
                                                            >
                                                                <option value="">Select BU...</option>
                                                                {businesses.map(b => (
                                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                                ))}
                                                            </select>
                                                            {item.buName && isCorpBu(item.buName) && (
                                                                <span className="px-1 py-0.5 bg-purple-600/30 text-purple-300 rounded text-[8px] font-medium shrink-0">SHARE</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                {/* Delete */}
                                                {!readOnly && (
                                                    <td className="px-1 py-2 text-center">
                                                        <button
                                                            onClick={() => deleteRow(index)}
                                                            disabled={items.length <= 1}
                                                            className="text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    {/* Totals Row */}
                                    <tr className="bg-slate-900/60 font-medium">
                                        <td colSpan={7} className="px-2 py-2 text-right text-slate-400">Totals:</td>
                                        <td className="px-1 py-2 text-right text-emerald-400">{formatCurrency(totalVat)}</td>
                                        <td className="px-1 py-2 text-right text-amber-400">{formatCurrency(totalEwt)}</td>
                                        <td className="px-1 py-2 text-right text-white font-bold">{formatCurrency(totalActual)}</td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View - Visible only on mobile */}
                <div className="md:hidden space-y-3">
                    {items
                        .filter(item => !readOnly || item.amount > 0 || item.vendorName)
                        .map((item, index) => (
                            <div key={item.id} className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="text-xs text-slate-400">Date</p>
                                        <p className="text-sm text-white">{item.date || '-'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400">Amount</p>
                                        <p className="text-lg font-bold text-white">{formatCurrency(item.amount)}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs text-slate-400">Payee/Vendor</p>
                                        <p className="text-sm text-slate-200 whitespace-normal break-words">{item.vendorName || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">OR No.</p>
                                        <p className="text-sm text-slate-200">{item.orNo || '-'}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Description</p>
                                    <p className="text-sm text-slate-200 whitespace-normal break-words">{item.description || '-'}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/50 rounded p-2">
                                    <div>
                                        <p className="text-[10px] text-slate-500">VAT</p>
                                        <p className="text-xs text-emerald-400">{formatCurrency(item.vat)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500">EWT</p>
                                        <p className="text-xs text-amber-400">{formatCurrency(item.ewt)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500">BU</p>
                                        <p className="text-xs text-purple-400 whitespace-normal break-words">{item.buName || '-'}</p>
                                    </div>
                                </div>
                                {!readOnly && (
                                    <button
                                        onClick={() => deleteRow(index)}
                                        disabled={items.length <= 1}
                                        className="w-full py-2 text-red-400 hover:text-red-300 disabled:opacity-30 flex items-center justify-center gap-1 border border-red-900/30 rounded"
                                    >
                                        <Trash2 size={14} /> Remove
                                    </button>
                                )}
                            </div>
                        ))}
                    {/* Mobile Totals */}
                    <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-600">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-medium">Total</span>
                            <span className="text-xl font-bold text-white">{formatCurrency(totalActual)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                            <span className="text-emerald-400">VAT: {formatCurrency(totalVat)}</span>
                            <span className="text-amber-400">EWT: {formatCurrency(totalEwt)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Inputs */}
            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                        <LinkIcon size={12} /> Google Drive Link (Receipts)
                    </label>
                    {readOnly ? (
                        receiptsLink ? (
                            <a
                                href={receiptsLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline text-sm"
                            >
                                {receiptsLink}
                            </a>
                        ) : (
                            <span className="text-slate-500">No link provided</span>
                        )
                    ) : (
                        <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={receiptsLink}
                            onChange={(e) => setReceiptsLink(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                        />
                    )}
                </div>
                <div>
                    <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                        <FileText size={12} /> Remarks
                    </label>
                    {readOnly ? (
                        <p className="text-slate-300 text-sm">{remarks || 'No remarks'}</p>
                    ) : (
                        <textarea
                            placeholder="Additional notes..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm resize-none"
                        />
                    )}
                </div>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-800/80 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Summary</h4>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total Budget (Advance)</span>
                        <span className="text-white font-medium">{formatCurrency(totalBudget)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total Actual Expenses</span>
                        <span className="text-white font-medium">{formatCurrency(totalActual)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total VAT</span>
                        <span className="text-emerald-400">{formatCurrency(totalVat)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total EWT</span>
                        <span className="text-amber-400">{formatCurrency(totalEwt)}</span>
                    </div>
                    {totalAdditionalExpenses > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-yellow-400">Additional Expenses</span>
                            <span className="text-yellow-400 font-medium">{formatCurrency(totalAdditionalExpenses)}</span>
                        </div>
                    )}
                    <div className="border-t border-slate-600 my-2" />
                    <div className="flex justify-between items-center">
                        {variance >= 0 ? (
                            <>
                                <span className="text-emerald-400 flex items-center gap-1 text-sm">
                                    <CheckCircle size={14} /> Amount to Return
                                </span>
                                <span className="text-emerald-400 font-bold text-lg">{formatCurrency(variance)}</span>
                            </>
                        ) : (
                            <>
                                <span className="text-orange-400 flex items-center gap-1 text-sm">
                                    <AlertTriangle size={14} /> Amount to Reimburse
                                </span>
                                <span className="text-orange-400 font-bold text-lg">{formatCurrency(Math.abs(variance))}</span>
                            </>
                        )}
                    </div>

                    {/* Liquidation Submitted Date */}
                    {requisition.liquidationDetails?.submittedAt && (
                        <>
                            <div className="border-t border-slate-600 my-2" />
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400 flex items-center gap-1">
                                    <Receipt size={14} /> Liquidation Submitted
                                </span>
                                <span className="text-blue-400 font-medium">
                                    {new Date(requisition.liquidationDetails.submittedAt).toLocaleString('en-US', {
                                        month: 'short', day: '2-digit', year: 'numeric',
                                        hour: 'numeric', minute: '2-digit', hour12: true
                                    })}
                                </span>
                            </div>
                        </>
                    )}

                    {/* Audit Cleared Remarks */}
                    {requisition.liquidationDetails?.auditRemarks && (
                        <>
                            <div className="border-t border-slate-600 my-2" />
                            <div className="bg-green-900/20 rounded-lg p-3 border border-green-700/30">
                                <h5 className="text-xs font-semibold text-green-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle size={12} /> Audit Cleared Remarks
                                </h5>
                                <p className="text-sm text-slate-200 whitespace-pre-wrap">
                                    {requisition.liquidationDetails.auditRemarks}
                                </p>
                                {requisition.liquidationDetails?.auditClearedAt && (
                                    <p className="text-xs text-green-500 mt-2">
                                        Cleared on: {new Date(requisition.liquidationDetails.auditClearedAt).toLocaleString('en-US', {
                                            month: 'short', day: '2-digit', year: 'numeric',
                                            hour: 'numeric', minute: '2-digit', hour12: true
                                        })}
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {/* Audit Notes History */}
                    {requisition.liquidationDetails?.auditNotesHistory && requisition.liquidationDetails.auditNotesHistory.length > 0 && (
                        <>
                            <div className="border-t border-slate-600 my-2" />
                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-600">
                                <h5 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-1">
                                    <FileText size={12} /> Audit Notes History
                                </h5>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {requisition.liquidationDetails.auditNotesHistory
                                        .slice()
                                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                        .map((entry, index) => (
                                            <div
                                                key={entry.id || index}
                                                className={`p-2 rounded border ${entry.action === 'REJECTED'
                                                        ? 'bg-red-900/20 border-red-700/30'
                                                        : entry.action === 'CLEARED'
                                                            ? 'bg-green-900/20 border-green-700/30'
                                                            : entry.action === 'REFILE'
                                                                ? 'bg-blue-900/20 border-blue-700/30'
                                                                : 'bg-slate-700/50 border-slate-600'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs font-medium uppercase ${entry.action === 'REJECTED'
                                                            ? 'text-red-400'
                                                            : entry.action === 'CLEARED'
                                                                ? 'text-green-400'
                                                                : entry.action === 'REFILE'
                                                                    ? 'text-blue-400'
                                                                    : 'text-slate-400'
                                                        }`}>
                                                        {entry.action === 'REJECTED' && '❌ '}
                                                        {entry.action === 'CLEARED' && '✅ '}
                                                        {entry.action === 'REFILE' && '🔄 '}
                                                        {entry.action === 'COMMENT' && '💬 '}
                                                        {entry.action}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(entry.timestamp).toLocaleDateString('en-US', {
                                                            month: 'short', day: '2-digit', year: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-200 whitespace-pre-wrap">{entry.note}</p>
                                                <p className="text-xs text-slate-500 mt-1">by {entry.actorName}</p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Submit Button */}
            {!readOnly && (
                <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <span className="animate-spin">⏳</span> Submitting...
                        </>
                    ) : (
                        <>
                            <CheckCircle size={18} /> Submit Liquidation
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

export default LiquidationForm;
