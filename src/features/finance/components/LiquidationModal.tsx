import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Calendar, Receipt, FileText, Link as LinkIcon, CheckCircle } from 'lucide-react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import AccountSelector, { type SelectedAccount } from '../../../shared/components/AccountSelector';

interface LiquidationModalProps {
    requisition: Requisition;
    onClose: () => void;
    onSubmit: (updatedRequisition: Requisition) => void;
    currentUserId: string;
}

// Dynamic expense row structure
interface LiquidationExpenseRow {
    id: string;
    date: string;
    supplier: string;
    invoiceNo: string;
    coaCode: string;
    coaName: string;
    amount: number;
    description: string;
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
const createEmptyExpense = (): LiquidationExpenseRow => ({
    id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: getTodayDate(),
    supplier: '',
    invoiceNo: '',
    coaCode: '',
    coaName: '',
    amount: 0,
    description: '',
});

const LiquidationModal: React.FC<LiquidationModalProps> = ({
    requisition,
    onClose,
    onSubmit,
    currentUserId
}) => {
    // Initialize with one empty expense row
    const [expenses, setExpenses] = useState<LiquidationExpenseRow[]>([createEmptyExpense()]);

    // Use the stored attachment link from liquidationDetails if available
    const [attachmentLink, setAttachmentLink] = useState(
        requisition.liquidationDetails?.attachmentLink || requisition.attachments?.[0] || ''
    );
    const [remarks, setRemarks] = useState(requisition.remarks || '');
    const [submitting, setSubmitting] = useState(false);

    // Calculate totals
    const totals = useMemo(() => {
        const totalActual = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        return { totalActual };
    }, [expenses]);

    const cashAdvance = requisition.totalAmount; // Amount released
    const difference = cashAdvance - totals.totalActual;
    const isRefund = difference > 0;
    const isReimbursement = difference < 0;

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
    const updateExpense = <K extends keyof LiquidationExpenseRow>(
        index: number,
        field: K,
        value: LiquidationExpenseRow[K]
    ) => {
        const updated = [...expenses];
        updated[index] = { ...updated[index], [field]: value };
        setExpenses(updated);
    };

    // Handle COA selection
    const handleCoaChange = (index: number, account: SelectedAccount | null) => {
        const updated = [...expenses];
        updated[index] = {
            ...updated[index],
            coaCode: account?.code || '',
            coaName: account?.name || '',
        };
        setExpenses(updated);
    };

    // Set today's date for a row
    const setTodayDate = (index: number) => {
        updateExpense(index, 'date', getTodayDate());
    };

    // Validate form
    const isValid = useMemo(() => {
        if (expenses.length === 0) return false;
        if (totals.totalActual <= 0) return false;

        // Check required fields
        for (const exp of expenses) {
            if (!exp.date || !exp.amount) {
                return false;
            }
        }
        return true;
    }, [expenses, totals.totalActual]);

    const handleSubmit = () => {
        if (!isValid) return;

        setSubmitting(true);

        // Build the updated requisition with liquidation details
        const updatedRequisition: Requisition = {
            ...requisition,
            remarks,
            status: RequisitionStatus.LIQUIDATION_FILED,
            attachments: attachmentLink ? [attachmentLink] : [],
            liquidationDetails: {
                ...requisition.liquidationDetails,
                dateFiled: new Date().toISOString(),
                filedBy: currentUserId,
                totalActualAmount: totals.totalActual,
                refundAmount: isRefund ? difference : 0,
                reimbursementAmount: isReimbursement ? Math.abs(difference) : 0,
                attachmentLink: attachmentLink,
                // Save the expense rows with COA info
                expenses: expenses.map(exp => ({
                    id: exp.id,
                    date: exp.date,
                    supplier: exp.supplier,
                    invoiceNo: exp.invoiceNo,
                    coaCode: exp.coaCode,
                    coaName: exp.coaName,
                    amount: exp.amount,
                    description: exp.description,
                })),
            }
        };

        onSubmit(updatedRequisition);
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
            <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 w-full max-w-6xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Receipt size={24} className="text-purple-400" />
                            File Liquidation
                        </h2>
                        <p className="text-sm text-slate-400">Enter actual expenses and attach receipts for {requisition.id}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg">
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Cash Advance Info */}
                    <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30 flex justify-between items-center">
                        <div>
                            <p className="text-sm text-blue-300 font-medium">Cash Advance Released</p>
                            <p className="text-2xl font-bold text-blue-100">{formatCurrency(cashAdvance)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-blue-300 font-medium">Requester</p>
                            <p className="text-blue-100 font-semibold">{requisition.requesterName || requisition.requesterId}</p>
                        </div>
                    </div>

                    {/* Expense Table */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={16} className="text-purple-400" />
                                Expense Details
                            </h3>
                            <button
                                onClick={addExpenseRow}
                                className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1 px-3 py-1 border border-purple-600/50 rounded-lg hover:bg-purple-900/20"
                            >
                                <Plus size={14} /> Add Expense
                            </button>
                        </div>

                        <div className="overflow-x-auto border border-slate-700 rounded-lg">
                            <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                                <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
                                    <tr>
                                        <th className="px-3 py-3 text-left" style={{ width: '120px' }}>Date</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '150px' }}>Supplier</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '100px' }}>Invoice No.</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '200px' }}>Account (COA)</th>
                                        <th className="px-3 py-3 text-right" style={{ width: '120px' }}>Amount*</th>
                                        <th className="px-3 py-3 text-left" style={{ width: '180px' }}>Description</th>
                                        <th className="px-2 py-3" style={{ width: '40px' }}></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {expenses.map((expense, index) => (
                                        <tr key={expense.id} className="hover:bg-slate-800/30">
                                            {/* Date */}
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="date"
                                                        value={expense.date}
                                                        onChange={(e) => updateExpense(index, 'date', e.target.value)}
                                                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                    />
                                                    <button
                                                        onClick={() => setTodayDate(index)}
                                                        className="p-1 text-slate-500 hover:text-purple-400"
                                                        title="Set Today"
                                                    >
                                                        <Calendar size={12} />
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Supplier */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="Vendor/Supplier"
                                                    value={expense.supplier}
                                                    onChange={(e) => updateExpense(index, 'supplier', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                />
                                            </td>

                                            {/* Invoice No */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="OR#/INV#"
                                                    value={expense.invoiceNo}
                                                    onChange={(e) => updateExpense(index, 'invoiceNo', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                />
                                            </td>

                                            {/* COA Account Selector */}
                                            <td className="px-3 py-2">
                                                <AccountSelector
                                                    value={expense.coaCode ? { code: expense.coaCode, name: expense.coaName } : null}
                                                    onChange={(account) => handleCoaChange(index, account)}
                                                    placeholder="Select account..."
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
                                                    className={`w-full px-2 py-1.5 bg-slate-800 border rounded text-white text-xs text-right focus:ring-1 focus:ring-purple-500 focus:outline-none ${!expense.amount ? 'border-red-600/50' : 'border-slate-600'}`}
                                                />
                                            </td>

                                            {/* Description */}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    placeholder="Description"
                                                    value={expense.description}
                                                    onChange={(e) => updateExpense(index, 'description', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                                />
                                            </td>

                                            {/* Delete */}
                                            <td className="px-2 py-2">
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
                                <tfoot className="bg-slate-800/70 border-t border-slate-600">
                                    <tr className="text-slate-300 font-medium">
                                        <td colSpan={4} className="px-3 py-3 text-right text-sm">
                                            Total Actual Expenses:
                                        </td>
                                        <td className="px-3 py-3 text-right text-sm font-bold text-white">
                                            {formatCurrency(totals.totalActual)}
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Summary & Attachments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                                    <LinkIcon size={12} /> Google Drive Link (Receipts)
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://drive.google.com/..."
                                    value={attachmentLink}
                                    onChange={(e) => setAttachmentLink(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                                    <FileText size={12} /> Remarks / Justification
                                </label>
                                <textarea
                                    placeholder="Additional notes about expenses..."
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                                />
                            </div>
                        </div>

                        {/* Summary Box */}
                        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-3">
                            <h4 className="font-semibold text-white">Summary</h4>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Total Cash Advance:</span>
                                <span className="font-medium text-slate-200">{formatCurrency(cashAdvance)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Total Actual Expenses:</span>
                                <span className="font-bold text-white">{formatCurrency(totals.totalActual)}</span>
                            </div>
                            <div className="border-t border-slate-600 my-2"></div>
                            {isRefund ? (
                                <div className="flex justify-between text-sm text-green-400 bg-green-900/30 p-2 rounded border border-green-500/30">
                                    <span className="font-medium">Amount to Return (Refund):</span>
                                    <span className="font-bold">{formatCurrency(Math.abs(difference))}</span>
                                </div>
                            ) : isReimbursement ? (
                                <div className="flex justify-between text-sm text-orange-400 bg-orange-900/30 p-2 rounded border border-orange-500/30">
                                    <span className="font-medium">Amount to Reimburse:</span>
                                    <span className="font-bold">{formatCurrency(Math.abs(difference))}</span>
                                </div>
                            ) : (
                                <div className="flex justify-between text-sm text-slate-400 bg-slate-700/30 p-2 rounded border border-slate-600/30">
                                    <span className="font-medium">Difference:</span>
                                    <span className="font-bold">{formatCurrency(0)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 flex items-center justify-between bg-slate-800/50 rounded-b-2xl">
                    <div className="text-sm text-slate-400">
                        {expenses.length} expense{expenses.length !== 1 ? 's' : ''} | Total:
                        <span className="font-bold text-white ml-1">{formatCurrency(totals.totalActual)}</span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!isValid || submitting}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            <CheckCircle size={18} />
                            {submitting ? 'Submitting...' : 'Submit Liquidation'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiquidationModal;
