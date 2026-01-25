import React, { useState } from 'react';
import { X, CheckCircle, XCircle, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import type { Requisition, LiquidationExpense } from '../../procurement/types';
import { usePermissions } from '../../../hooks/usePermissions';

interface LiquidationAuditModalProps {
    requisition: Requisition;
    onClose: () => void;
    onApprove: (auditNotes: string) => Promise<void>;
    onReject: (rejectionReason: string) => Promise<void>;
}

const LiquidationAuditModal: React.FC<LiquidationAuditModalProps> = ({
    requisition,
    onClose,
    onApprove,
    onReject
}) => {
    // Hooks
    const { hasPermission } = usePermissions();

    // State
    const [notes, setNotes] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [action, setAction] = useState<'approve' | 'reject' | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Permission Check
    const canAudit = hasPermission('liquidation:audit');

    // Data Validation
    const liquidation = requisition.liquidationDetails;
    if (!liquidation) {
        return null; // Or render an error state indicating missing data
    }

    // Safe Math - Calculate actual total from items' actualCost values
    const prfTotal = Number(requisition.totalAmount) || 0;
    // Calculate actual from items (each item.actualCost is already the total for that item)
    const actualFromItems = (requisition.items || []).reduce((sum, item) => sum + (item.actualCost || 0), 0);
    // Fallback to liquidation.totalActualAmount if items don't have actualCost
    const actualTotal = actualFromItems > 0 ? actualFromItems : (Number(liquidation.totalActualAmount) || 0);
    const difference = prfTotal - actualTotal;
    const isRefund = difference >= 0;

    // Determine the attachment link
    const attachmentLink = liquidation.attachmentLink ||
        (requisition.attachments && requisition.attachments.length > 0 ? requisition.attachments[0] : null);

    // Handlers
    const handleSubmit = async () => {
        if (!action) return;

        setError(null);
        setLoading(true);

        try {
            if (action === 'approve') {
                await onApprove(notes);
            } else {
                const trimmedReason = rejectionReason.trim();
                if (!trimmedReason) {
                    throw new Error('Please provide a reason for rejection.');
                }
                await onReject(trimmedReason);
            }
            onClose();
        } catch (err: unknown) {
            // FIX: Replace err: any with unknown and type-safe access
            const errorMessage = err instanceof Error ? err.message : 'Failed to submit audit. Please try again.';
            console.error('Audit submission error:', err);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setAction(null);
        setError(null);
        setNotes('');
        setRejectionReason('');
    };

    // FIX: Define typed props for FinancialCard sub-component
    interface FinancialCardProps {
        label: string;
        amount: number;
        colorClass: string;
        borderClass: string;
        textClass: string;
    }

    const FinancialCard: React.FC<FinancialCardProps> = ({ label, amount, colorClass, borderClass, textClass }) => (
        <div className={`rounded-lg p-4 border ${borderClass} ${colorClass}`}>
            <div className={`text-sm mb-1 ${textClass} opacity-80`}>{label}</div>
            <div className={`text-2xl font-bold ${textClass}`}>₱{amount.toLocaleString()}</div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shrink-0 z-10">
                    <h2 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CheckCircle className="text-blue-600 dark:text-blue-400" size={24} />
                        Audit Liquidation
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded-full"
                        aria-label="Close modal"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Error Banner */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-lg p-4 flex items-start gap-3 text-red-600 dark:text-red-200">
                            <AlertCircle className="shrink-0 mt-0.5" size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Requisition Info */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Requisition Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <span className="text-slate-500 block">Transaction ID</span>
                                <span className="text-slate-900 dark:text-white font-mono bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 inline-block select-all">
                                    {requisition.id}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-slate-500 block">Filed By</span>
                                <span className="text-slate-900 dark:text-white font-medium">{liquidation.submittedByName || requisition.requesterName || liquidation.filedBy}</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-slate-500 block">Date Filed</span>
                                <span className="text-slate-900 dark:text-white font-medium">
                                    {liquidation.dateFiled ? new Date(liquidation.dateFiled).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}
                                </span>
                            </div>

                            {/* Supporting Documents */}
                            {attachmentLink && (
                                <div className="md:col-span-2 mt-2">
                                    <a
                                        href={attachmentLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg transition-colors group"
                                    >
                                        <ExternalLink size={16} className="group-hover:scale-110 transition-transform" />
                                        <span className="font-medium">Open Receipt Folder (Google Drive)</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Financial Summary */}
                    {(() => {
                        // Calculate additional expenses (reimbursable to employee)
                        const additionalExpenses = (liquidation.expenses || [])
                            .filter((exp: LiquidationExpense) => exp.isAdditionalExpense)
                            .reduce((sum: number, exp: LiquidationExpense) => sum + (exp.amount || 0), 0);

                        return (
                            <div className={`grid grid-cols-1 gap-4 ${additionalExpenses > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                                <FinancialCard
                                    label="PRF Budget"
                                    amount={prfTotal}
                                    colorClass="bg-blue-50 dark:bg-blue-900/20"
                                    borderClass="border-blue-200 dark:border-blue-700/30"
                                    textClass="text-blue-600 dark:text-blue-300"
                                />
                                <FinancialCard
                                    label="Actual Expenses"
                                    amount={actualTotal}
                                    colorClass="bg-purple-50 dark:bg-purple-900/20"
                                    borderClass="border-purple-200 dark:border-purple-700/30"
                                    textClass="text-purple-600 dark:text-purple-300"
                                />
                                <FinancialCard
                                    label={isRefund ? 'To Refund (Company)' : 'To Reimburse (Employee)'}
                                    amount={Math.abs(difference)}
                                    colorClass={isRefund ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}
                                    borderClass={isRefund ? 'border-green-200 dark:border-green-700/30' : 'border-red-200 dark:border-red-700/30'}
                                    textClass={isRefund ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}
                                />
                                {additionalExpenses > 0 && (
                                    <FinancialCard
                                        label="Additional Expenses"
                                        amount={additionalExpenses}
                                        colorClass="bg-amber-50 dark:bg-amber-900/20"
                                        borderClass="border-amber-200 dark:border-amber-700/30"
                                        textClass="text-amber-600 dark:text-amber-300"
                                    />
                                )}
                            </div>
                        );
                    })()}

                    {/* Itemized Costs - Shows PRF items with budget vs actual + expense details */}
                    {requisition.items && requisition.items.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Itemized Costs</h3>
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900/30">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 backdrop-blur-sm">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Item</th>
                                                <th className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Qty</th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Supplier</th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">TIN</th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">OR No.</th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Description</th>
                                                <th className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Actual Cost</th>
                                                <th className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">VAT</th>
                                                <th className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">EWT</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {requisition.items.map((item, index) => {
                                                const qty = item.quantity || 0;
                                                // Get corresponding expense entry (non-additional expenses at the same index)
                                                const regularExpenses = (liquidation.expenses || [])
                                                    .filter((exp: LiquidationExpense) => exp.isAdditionalExpense !== true);
                                                const expense = regularExpenses[index] as LiquidationExpense | undefined;

                                                return (
                                                    <tr key={item.itemId || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{item.name}</td>
                                                        <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400">{qty} {item.uom}</td>
                                                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{expense?.vendorName || '-'}</td>
                                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 font-mono text-xs">{expense?.tin || '-'}</td>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{expense?.orNo || '-'}</td>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{expense?.description || expense?.coaName || '-'}</td>
                                                        <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200 font-medium">₱{(item.actualCost || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400">{expense?.vat ? `₱${expense.vat.toLocaleString()}` : '-'}</td>
                                                        <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400">{expense?.ewt ? `₱${expense.ewt.toLocaleString()}` : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-600">
                                            <tr>
                                                <td colSpan={6} className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Totals</td>
                                                <td className="px-3 py-2 text-right text-slate-900 dark:text-white font-bold">
                                                    ₱{(requisition.items || [])
                                                        .reduce((sum, item) => sum + (item.actualCost || 0), 0).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                                                    ₱{(liquidation.expenses || [])
                                                        .filter((exp: LiquidationExpense) => exp.isAdditionalExpense !== true)
                                                        .reduce((sum: number, e: LiquidationExpense) => sum + (e.vat || 0), 0).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                                                    ₱{(liquidation.expenses || [])
                                                        .filter((exp: LiquidationExpense) => exp.isAdditionalExpense !== true)
                                                        .reduce((sum: number, e: LiquidationExpense) => sum + (e.ewt || 0), 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Additional Expenses - Only show if there are BOTH regular expenses AND additional expenses */}
                    {(() => {
                        const allExpenses = (liquidation.expenses || [])
                            .filter((exp: LiquidationExpense) => exp.amount > 0 || exp.vendorName);

                        // Check if there are regular expenses (not additional)
                        const regularExpenses = allExpenses.filter((exp: LiquidationExpense) => exp.isAdditionalExpense !== true);

                        // Only show Additional Expenses section if there ARE regular expenses
                        // This prevents duplicate display when using backwards compat fallback
                        if (regularExpenses.length === 0) return null;

                        const additionalExpenseRows = allExpenses
                            .filter((exp: LiquidationExpense) => exp.isAdditionalExpense === true);

                        if (additionalExpenseRows.length === 0) return null;

                        return (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Additional Expenses</h3>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900/30">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Date</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Supplier</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">TIN</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">OR No.</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Description</th>
                                                    <th className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Amount</th>
                                                    <th className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">VAT</th>
                                                    <th className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">EWT</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                {additionalExpenseRows.map((exp: LiquidationExpense, index: number) => (
                                                    <tr key={exp.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                                            {exp.date ? new Date(exp.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{exp.vendorName || '-'}</td>
                                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 font-mono text-xs">{exp.tin || '-'}</td>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{exp.orNo || '-'}</td>
                                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{exp.description || exp.coaName || '-'}</td>
                                                        <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200 font-medium">₱{(exp.amount || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400">{exp.vat ? `₱${exp.vat.toLocaleString()}` : '-'}</td>
                                                        <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400">{exp.ewt ? `₱${exp.ewt.toLocaleString()}` : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-600">
                                                <tr>
                                                    <td colSpan={5} className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400">Totals</td>
                                                    <td className="px-3 py-2 text-right text-slate-900 dark:text-white font-bold">
                                                        ₱{additionalExpenseRows.reduce((sum: number, e: LiquidationExpense) => sum + (e.amount || 0), 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                                                        ₱{additionalExpenseRows.reduce((sum: number, e: LiquidationExpense) => sum + (e.vat || 0), 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                                                        ₱{additionalExpenseRows.reduce((sum: number, e: LiquidationExpense) => sum + (e.ewt || 0), 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Action Area */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
                        {!canAudit ? (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 rounded-lg p-4 flex items-center gap-3 text-yellow-700 dark:text-yellow-200">
                                <AlertCircle size={20} />
                                <span>You do not have permission to audit liquidations.</span>
                            </div>
                        ) : !action ? (
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => setAction('approve')}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20 hover:scale-[1.02]"
                                >
                                    <CheckCircle size={20} />
                                    Approve Liquidation
                                </button>
                                <button
                                    onClick={() => setAction('reject')}
                                    className="flex-1 bg-slate-700 hover:bg-red-600 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                                >
                                    <XCircle size={20} />
                                    Reject Liquidation
                                </button>
                            </div>
                        ) : (
                            <div className={`rounded-xl p-6 border animate-in slide-in-from-bottom-2 ${action === 'approve'
                                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-500/30'
                                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-500/30'
                                }`}>
                                <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${action === 'approve' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                    }`}>
                                    {action === 'approve' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                    {action === 'approve' ? 'Confirm Approval' : 'Reject Liquidation'}
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            {action === 'approve' ? 'Audit Notes (Optional)' : 'Reason for Rejection *'}
                                        </label>
                                        <textarea
                                            value={action === 'approve' ? notes : rejectionReason}
                                            onChange={(e) => action === 'approve' ? setNotes(e.target.value) : setRejectionReason(e.target.value)}
                                            placeholder={action === 'approve' ? "Add any notes about this audit..." : "Explain clearly why this liquidation is being rejected..."}
                                            rows={3}
                                            className="w-full px-4 py-3 bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400 resize-none transition-shadow"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={loading || (action === 'reject' && !rejectionReason.trim())}
                                            className={`flex-1 px-6 py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all ${action === 'approve'
                                                ? 'bg-green-600 hover:bg-green-500 disabled:bg-green-900'
                                                : 'bg-red-600 hover:bg-red-500 disabled:bg-red-900'
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 size={18} className="animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <span>Confirm {action === 'approve' ? 'Approval' : 'Rejection'}</span>
                                            )}
                                        </button>
                                        <button
                                            onClick={resetForm}
                                            disabled={loading}
                                            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiquidationAuditModal;
