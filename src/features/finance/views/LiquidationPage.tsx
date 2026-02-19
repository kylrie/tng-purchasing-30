import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Receipt, FileText, Link as LinkIcon, CheckCircle, Printer, Save, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermissions } from '../../../hooks/usePermissions';
import { useRequisitions } from '../../procurement/hooks/useRequisitions';
import { useSuppliers } from '../../inventory/hooks/useSuppliers';
import { useBusinesses } from '../../admin/hooks/useBusinesses';
import { useUsers } from '../../admin/hooks/useUsers';
import { RequisitionStatus } from '../../procurement/types';
import LiquidationPrintModal from '../components/LiquidationPrintModal';

import AccountSelector, { type SelectedAccount } from '../../../shared/components/AccountSelector';
import SearchableDropdown from '../../../shared/components/SearchableDropdown';

// Dynamic expense row structure
interface LiquidationExpenseRow {
    id: string;
    date: string;
    supplierId: string;
    supplierName: string;
    tin: string;
    address: string;
    orNo: string;
    coaCode: string;
    coaName: string;
    description: string;
    vat: number;
    ewt: number;
    amount: number;
    buId: string;
    buName: string;
    isAdditionalExpense?: boolean; // True if row was added (not from original PRF items)
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
const createEmptyExpense = (defaultBuId: string = '', defaultBuName: string = '', isAdditional: boolean = false): LiquidationExpenseRow => ({
    id: crypto.randomUUID(),
    date: getTodayDate(),
    supplierId: '',
    supplierName: '',
    tin: '',
    address: '',
    orNo: '',
    coaCode: '',
    coaName: '',
    description: '',
    vat: 0,
    ewt: 0,
    amount: 0,
    buId: defaultBuId,
    buName: defaultBuName,
    isAdditionalExpense: isAdditional,
});

const LiquidationPage: React.FC = () => {
    const { prfId } = useParams<{ prfId: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { requisitions, updateRequisition } = useRequisitions();
    const { suppliers } = useSuppliers();
    const { businesses } = useBusinesses();
    const { users } = useUsers();
    const [showPrintModal, setShowPrintModal] = useState(false);
    const { hasPermission } = usePermissions();

    // Find the requisition
    const requisition = useMemo(() => {
        return requisitions.find(r => r.id === prfId);
    }, [requisitions, prfId]);

    // Get default BU info
    const defaultBu = useMemo(() => {
        if (!requisition || !businesses) return { id: '', name: '' };
        const bu = businesses.find(b => b.id === requisition.businessId);
        return { id: bu?.id || '', name: bu?.name || '' };
    }, [requisition, businesses]);

    // Initialize expenses from existing liquidationDetails or create one expense per item
    const initialExpenses = useMemo((): LiquidationExpenseRow[] => {
        // If we have existing expenses saved, use those
        if (requisition?.liquidationDetails?.expenses?.length) {
            return requisition.liquidationDetails.expenses.map(exp => ({
                id: exp.id || crypto.randomUUID(),
                date: exp.date || getTodayDate(),
                supplierId: exp.vendorId || '',
                supplierName: exp.vendorName || exp.supplier || '',
                tin: exp.tin || '',
                address: exp.address || '',
                orNo: exp.orNo || exp.invoiceNo || '',
                coaCode: exp.coaCode || '',
                coaName: exp.coaName || '',
                description: exp.description || '',
                vat: exp.vat || 0,
                ewt: exp.ewt || 0,
                amount: exp.amount || 0,
                buId: exp.buId || defaultBu.id,
                buName: exp.buName || defaultBu.name,
                isAdditionalExpense: exp.isAdditionalExpense || false,
            }));
        }
        // FIX: Create one expense entry per requisition item (not just one empty row)
        // This ensures each item row has its own expense object for independent supplier selection
        if (requisition?.items?.length) {
            return requisition.items.map(() => createEmptyExpense(defaultBu.id, defaultBu.name));
        }
        // Fallback: single empty row
        return [createEmptyExpense(defaultBu.id, defaultBu.name)];
    }, [requisition, defaultBu]);

    const [expenses, setExpenses] = useState<LiquidationExpenseRow[]>(initialExpenses);
    const [receiptsLink, setReceiptsLink] = useState(requisition?.liquidationDetails?.receiptsLink || '');
    const [remarks, setRemarks] = useState(requisition?.liquidationDetails?.remarks || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // VAT mode: 'none' = manual entry, 'inclusive' = price includes 12% VAT, 'exclusive' = VAT added on top at 12%
    const [vatMode, setVatMode] = useState<'none' | 'inclusive' | 'exclusive'>(
        requisition?.liquidationDetails?.vatMode || 'none'
    );

    // Calculate VAT based on mode (PH Tax Law - 12% VAT)
    const calcVat = (amount: number, mode: 'none' | 'inclusive' | 'exclusive'): number => {
        if (mode === 'none' || !amount) return 0;
        if (mode === 'inclusive') {
            // VAT Inclusive: Price already includes 12% VAT
            // VAT = Amount - (Amount / 1.12)
            return Math.round((amount - (amount / 1.12)) * 100) / 100;
        }
        // VAT Exclusive: VAT is added on top
        // VAT = Amount * 0.12
        return Math.round((amount * 0.12) * 100) / 100;
    };

    // Recalculate all VAT when mode changes
    const handleVatModeChange = (mode: 'none' | 'inclusive' | 'exclusive') => {
        setVatMode(mode);
        if (mode === 'none') return; // Keep existing VAT values when switching to manual
        const items = requisition?.items || [];
        setExpenses(prev => prev.map((exp, idx) => {
            // For item-linked expense rows, use the actual cost from itemActualCosts
            const amount = idx < items.length
                ? (itemActualCosts[items[idx].itemId] || exp.amount || 0)
                : (exp.amount || 0);
            return {
                ...exp,
                amount,
                vat: calcVat(amount, mode),
            };
        }));
    };

    // Initialize item actual costs from existing data or zeros
    const [itemActualCosts, setItemActualCosts] = useState<Record<string, number>>(() => {
        const costs: Record<string, number> = {};
        requisition?.items?.forEach(item => {
            costs[item.itemId] = item.actualCost ?? 0;
        });
        return costs;
    });

    // Update expenses when requisition loads
    useEffect(() => {
        if (requisition && expenses.length === 1 && !expenses[0].supplierId && !expenses[0].amount) {
            setExpenses(initialExpenses);
            setReceiptsLink(requisition?.liquidationDetails?.receiptsLink || '');
            setRemarks(requisition?.liquidationDetails?.remarks || '');
        }
    }, [requisition]); // Removed initialExpenses dependency to avoid infinite loop since it is a new object on every render

    // Calculate totals
    const totalActualAmount = useMemo(() => {
        return expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    }, [expenses]);

    const totalVat = useMemo(() => {
        return expenses.reduce((sum, exp) => sum + (exp.vat || 0), 0);
    }, [expenses]);

    const totalEwt = useMemo(() => {
        return expenses.reduce((sum, exp) => sum + (exp.ewt || 0), 0);
    }, [expenses]);

    // Calculate item totals
    const itemTotals = useMemo(() => {
        const totalEstimated = requisition?.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
        const totalActual = Object.values(itemActualCosts).reduce((sum, cost) => sum + cost, 0);
        return { totalEstimated, totalActual, variance: totalEstimated - totalActual };
    }, [requisition?.items, itemActualCosts]);

    const variance = useMemo(() => {
        const budget = requisition?.totalAmount || 0;
        return budget - itemTotals.totalActual;
    }, [requisition?.totalAmount, itemTotals.totalActual]);

    // Update item actual cost — also sync to expense row amount + auto-calc VAT
    const updateItemActualCost = (itemId: string, cost: number) => {
        setItemActualCosts(prev => ({ ...prev, [itemId]: cost }));
        // Find the expense index that corresponds to this item
        const itemIndex = requisition?.items?.findIndex(i => i.itemId === itemId) ?? -1;
        if (itemIndex >= 0 && itemIndex < expenses.length) {
            const updated = [...expenses];
            updated[itemIndex] = { ...updated[itemIndex], amount: cost };
            if (vatMode !== 'none') {
                updated[itemIndex].vat = calcVat(cost, vatMode);
            }
            setExpenses(updated);
        }
    };

    // Expense row handlers
    const updateExpense = <K extends keyof LiquidationExpenseRow>(
        index: number,
        field: K,
        value: LiquidationExpenseRow[K]
    ) => {
        const updated = [...expenses];
        updated[index] = { ...updated[index], [field]: value };
        // Auto-calc VAT when amount changes and vatMode is active
        if (field === 'amount' && vatMode !== 'none') {
            updated[index].vat = calcVat(updated[index].amount, vatMode);
        }
        setExpenses(updated);
    };

    const handleSupplierChange = (index: number, supplierId: string) => {
        const selectedSupplier = suppliers.find(s => s.id === supplierId);
        const updated = [...expenses];
        updated[index] = {
            ...updated[index],
            supplierId,
            supplierName: selectedSupplier?.name || '',
            tin: selectedSupplier?.tin || '',
            address: selectedSupplier?.address || '',
        };
        setExpenses(updated);
    };

    const handleCoaChange = (index: number, account: SelectedAccount | null) => {
        const updated = [...expenses];
        updated[index] = {
            ...updated[index],
            coaCode: account?.code || '',
            coaName: account?.name || '',
        };
        setExpenses(updated);
    };

    // Add expense row (marked as additional expense for reimbursement tracking)
    const addExpenseRow = () => {
        setExpenses([...expenses, createEmptyExpense(defaultBu.id, defaultBu.name, true)]);
    };

    // Delete expense row (only for additional rows beyond item count)
    const deleteExpenseRow = (index: number) => {
        const itemCount = requisition?.items?.length || 0;
        // Only allow deleting rows beyond the item-linked expenses
        if (index >= itemCount) {
            setExpenses(prev => prev.filter((_, i) => i !== index));
        }
    };


    // Save as Draft handler (saves without changing status)
    const handleSaveDraft = async () => {
        if (!requisition || !currentUser) return;

        setIsSubmitting(true);
        try {
            const updatedItems = (requisition.items || []).map(item => ({
                ...item,
                actualCost: itemActualCosts[item.itemId] || 0,
            }));

            const updatedRequisition = {
                ...requisition,
                // Keep the same status - don't change to LIQUIDATION_FILED
                remarks,
                items: updatedItems,
                attachments: receiptsLink ? [receiptsLink] : [],
                liquidationDetails: {
                    ...requisition.liquidationDetails,
                    // Mark as draft
                    dateFiled: requisition.liquidationDetails?.dateFiled || new Date().toISOString(),
                    filedBy: requisition.liquidationDetails?.filedBy || currentUser.id,
                    isDraft: true,
                    lastSavedAt: new Date().toISOString(),
                    lastSavedBy: currentUser.id,
                    totalActualAmount,
                    totalItemActualCost: itemTotals.totalActual,
                    itemVariance: itemTotals.variance,
                    refundAmount: variance > 0 ? variance : 0,
                    reimbursementAmount: variance < 0 ? Math.abs(variance) : 0,
                    attachmentLink: receiptsLink,
                    receiptsLink,
                    remarks,
                    vatMode,
                    expenses: expenses.map(exp => ({
                        id: exp.id,
                        date: exp.date,
                        vendorId: exp.supplierId,
                        vendorName: exp.supplierName,
                        tin: exp.tin,
                        address: exp.address,
                        orNo: exp.orNo,
                        coaCode: exp.coaCode,
                        coaName: exp.coaName,
                        description: exp.description,
                        vat: exp.vat,
                        ewt: exp.ewt,
                        amount: exp.amount,
                        buId: exp.buId,
                        buName: exp.buName,
                        isAdditionalExpense: exp.isAdditionalExpense || false,
                    })),
                }
            };

            await updateRequisition(updatedRequisition);
            alert('Draft saved successfully!');
        } catch (error: unknown) {
            console.error('Error saving draft:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error saving draft: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Submit handler
    const handleSubmit = async () => {
        if (!requisition || !currentUser) return;

        // Validation removed - allow zero actual costs for cases where no spending occurred
        // Previously required at least one actual cost > 0, but this prevents valid full-refund scenarios

        setIsSubmitting(true);
        try {
            // Build updated requisition with liquidation details
            // Update items with actual costs
            const updatedItems = (requisition.items || []).map(item => ({
                ...item,
                actualCost: itemActualCosts[item.itemId] || 0,
            }));

            const updatedRequisition = {
                ...requisition,
                status: RequisitionStatus.LIQUIDATION_FILED,
                remarks,
                items: updatedItems,
                attachments: receiptsLink ? [receiptsLink] : [],
                liquidationDetails: {
                    ...requisition.liquidationDetails,
                    dateFiled: new Date().toISOString(),
                    filedBy: currentUser.id,
                    submittedBy: currentUser.id,
                    totalActualAmount,
                    totalItemActualCost: itemTotals.totalActual,
                    itemVariance: itemTotals.variance,
                    refundAmount: variance > 0 ? variance : 0,
                    reimbursementAmount: variance < 0 ? Math.abs(variance) : 0,
                    attachmentLink: receiptsLink,
                    receiptsLink,
                    remarks,
                    vatMode,
                    expenses: expenses.map(exp => ({
                        id: exp.id,
                        date: exp.date,
                        vendorId: exp.supplierId,
                        vendorName: exp.supplierName,
                        tin: exp.tin,
                        address: exp.address,
                        orNo: exp.orNo,
                        coaCode: exp.coaCode,
                        coaName: exp.coaName,
                        description: exp.description,
                        vat: exp.vat,
                        ewt: exp.ewt,
                        amount: exp.amount,
                        buId: exp.buId,
                        buName: exp.buName,
                        isAdditionalExpense: exp.isAdditionalExpense || false,
                    })),
                }
            };

            await updateRequisition(updatedRequisition);

            alert('Liquidation submitted successfully!');
            // Stay on page - no navigation - page will detect new status and show read-only
        } catch (error: unknown) {
            console.error('Error submitting liquidation:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error submitting liquidation: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading state
    if (!requisition) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 dark:border-purple-500 mx-auto mb-4"></div>
                    <p className="text-slate-500 dark:text-slate-400">Loading requisition {prfId}...</p>
                </div>
            </div>
        );
    }

    // Security Check: Ensure user has permission to view this specific liquidation
    // If user only has "file own" permission, they must be the requester
    if (currentUser && requisition.requesterId !== currentUser.id) {
        if (!hasPermission('liquidation:view') && !hasPermission('liquidation:file:all')) {
            return (
                <div className="max-w-4xl mx-auto py-12 text-center">
                    <div className="bg-white dark:bg-slate-800/50 rounded-xl p-8 border border-slate-200 dark:border-slate-700">
                        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Unauthorized Access</h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">You do not have permission to view or file liquidation for this requisition.</p>
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-white"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            );
        }
    }

    // Check if liquidation can be filed (or is already filed for viewing)
    const canFileLiquidation = [
        RequisitionStatus.FUNDS_RELEASED,
        RequisitionStatus.LIQUIDATION_REJECTED,
    ].includes(requisition.status);

    // Check if already filed (read-only mode)
    const isReadOnly = requisition.status === RequisitionStatus.LIQUIDATION_FILED ||
        requisition.status === RequisitionStatus.AUDITED_CLEARED;

    // Only show error for truly invalid statuses
    if (!canFileLiquidation && !isReadOnly) {
        return (
            <div className="max-w-4xl mx-auto py-12">
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-700">
                    <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Cannot File Liquidation</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        Liquidation can only be filed for requisitions with status "Funds Released" or "Liquidation Rejected".
                    </p>
                    <p className="text-slate-500 mb-6">
                        Current status: <span className="text-slate-900 dark:text-white font-medium">{requisition.status}</span>
                    </p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-white"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const business = businesses.find(b => b.id === requisition.businessId);

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-300"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {isReadOnly ? 'View Liquidation' : 'File Liquidation'}
                                </h1>
                                {isReadOnly && (
                                    <span className="px-3 py-1 bg-emerald-600/30 text-emerald-400 rounded-full text-sm font-medium">
                                        ✓ Filed
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {requisition.id} • {business?.name} • {formatCurrency(requisition.totalAmount || 0)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowPrintModal(true)}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <Printer size={18} />
                            Print Preview
                        </button>
                        {!isReadOnly && (
                            <>
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    <Save size={18} />
                                    Save Draft
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={18} />
                                            Submit Liquidation
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
                {/* PRF Summary */}
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                            <FileText size={20} className="text-purple-600 dark:text-purple-400" />
                            PRF Summary
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">PRF ID</p>
                            <p className="font-medium text-slate-900 dark:text-white">{requisition.id}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">Business Unit</p>
                            <p className="font-medium text-slate-900 dark:text-white">{business?.name || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">Description</p>
                            <p className="font-medium text-slate-900 dark:text-white">{requisition.description}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 dark:text-slate-400">Budget (Advance)</p>
                            <p className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(requisition.totalAmount || 0)}</p>
                        </div>
                    </div>
                </div>

                {/* Expense Details - Unified Table */}
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                            <Receipt size={20} className="text-cyan-600 dark:text-cyan-400" />
                            Expense Details
                        </h2>
                        <div className="flex items-center gap-3">
                            {!isReadOnly && (
                                <button
                                    onClick={addExpenseRow}
                                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg flex items-center gap-2 text-sm text-white"
                                >
                                    <Plus size={16} />
                                    Add Row
                                </button>
                            )}
                        </div>
                    </div>

                    {/* VAT Mode Toggle */}
                    {!isReadOnly && (
                        <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mr-2">VAT 12%:</span>
                            <button
                                onClick={() => handleVatModeChange('none')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${vatMode === 'none'
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                Manual
                            </button>
                            <button
                                onClick={() => handleVatModeChange('inclusive')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${vatMode === 'inclusive'
                                    ? 'bg-cyan-600 text-white shadow-sm'
                                    : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                VAT Inclusive
                            </button>
                            <button
                                onClick={() => handleVatModeChange('exclusive')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${vatMode === 'exclusive'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                VAT Exclusive
                            </button>
                            {vatMode !== 'none' && (
                                <span className="text-[10px] text-slate-400 ml-2">
                                    {vatMode === 'inclusive' ? 'VAT = Amount − (Amount ÷ 1.12)' : 'VAT = Amount × 12%'}
                                </span>
                            )}
                        </div>
                    )}
                    {isReadOnly && requisition?.liquidationDetails?.vatMode && requisition.liquidationDetails.vatMode !== 'none' && (
                        <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold uppercase">VAT Mode:</span>
                            <span className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${requisition.liquidationDetails.vatMode === 'inclusive' ? 'bg-cyan-600' : 'bg-purple-600'
                                }`}>
                                {requisition.liquidationDetails.vatMode === 'inclusive' ? 'VAT Inclusive (12%)' : 'VAT Exclusive (12%)'}
                            </span>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-2 py-3 text-left">Item Name</th>
                                    <th className="px-2 py-3 text-center w-12">Qty</th>
                                    <th className="px-2 py-3 text-center w-12">UOM</th>
                                    <th className="px-2 py-3 text-right w-24">Est. Cost</th>
                                    <th className="px-2 py-3 text-right w-24">Actual Cost</th>
                                    <th className="px-2 py-3 text-right w-20">Variance</th>
                                    <th className="px-2 py-3 text-left w-24">Date</th>
                                    <th className="px-2 py-3 text-left w-32">Supplier</th>
                                    <th className="px-2 py-3 text-left w-24">TIN</th>
                                    <th className="px-2 py-3 text-left w-20">OR No.</th>
                                    <th className="px-2 py-3 text-left w-28">COA</th>
                                    <th className="px-2 py-3 text-left w-32">Description</th>
                                    <th className="px-2 py-3 text-right w-28">VAT</th>
                                    <th className="px-2 py-3 text-right w-28">EWT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {requisition.items && requisition.items.map((item, index) => {
                                    const estimatedTotal = item.price * item.quantity;
                                    const actualCost = itemActualCosts[item.itemId] || 0;
                                    const itemVariance = estimatedTotal - actualCost;
                                    const exp = expenses[index] || expenses[0];
                                    return (
                                        <tr key={item.itemId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            {/* Item Name */}
                                            <td className="px-2 py-2">
                                                <p className="font-medium text-xs text-slate-900 dark:text-white">{item.name}</p>
                                            </td>
                                            {/* Qty */}
                                            <td className="px-2 py-2 text-center text-xs text-slate-700 dark:text-slate-300">{item.quantity}</td>
                                            {/* UOM */}
                                            <td className="px-2 py-2 text-center text-slate-500 dark:text-slate-400 text-xs">{item.uom}</td>
                                            {/* Estimated Cost */}
                                            <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-300 text-xs">
                                                {formatCurrency(estimatedTotal)}
                                            </td>
                                            {/* Actual Cost */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    value={actualCost || ''}
                                                    onChange={(e) => updateItemActualCost(item.itemId, parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-1 py-1 text-right text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                />
                                            </td>
                                            {/* Variance */}
                                            <td className={`px-2 py-2 text-right font-medium text-xs ${itemVariance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {itemVariance >= 0 ? '+' : ''}{formatCurrency(itemVariance)}
                                            </td>
                                            {/* Date */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="date"
                                                    value={exp?.date || ''}
                                                    onChange={(e) => updateExpense(index, 'date', e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-1 py-1 text-xs text-slate-900 dark:text-white"
                                                />
                                            </td>
                                            {/* Supplier */}
                                            <td className="px-2 py-2">
                                                <SearchableDropdown
                                                    options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                                                    value={exp?.supplierId || ''}
                                                    onChange={(value) => handleSupplierChange(index, value)}
                                                    placeholder="Select..."
                                                    className="text-xs"
                                                />
                                            </td>
                                            {/* TIN */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="text"
                                                    value={exp?.tin || ''}
                                                    onChange={(e) => updateExpense(index, 'tin', e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-1 py-1 text-xs text-slate-900 dark:text-white"
                                                    placeholder="TIN"
                                                />
                                            </td>
                                            {/* OR No */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="text"
                                                    value={exp?.orNo || ''}
                                                    onChange={(e) => updateExpense(index, 'orNo', e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-1 py-1 text-xs text-slate-900 dark:text-white"
                                                    placeholder="OR #"
                                                />
                                            </td>
                                            {/* COA */}
                                            <td className="px-2 py-2">
                                                <AccountSelector
                                                    value={exp?.coaCode ? { code: exp.coaCode, name: exp.coaName } : null}
                                                    onChange={(account) => handleCoaChange(index, account)}
                                                />
                                            </td>
                                            {/* Description */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="text"
                                                    value={exp?.description || ''}
                                                    onChange={(e) => updateExpense(index, 'description', e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-1 py-1 text-xs text-slate-900 dark:text-white"
                                                    placeholder="Description"
                                                />
                                            </td>
                                            {/* VAT */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    value={exp?.vat || ''}
                                                    onChange={(e) => updateExpense(index, 'vat', parseFloat(e.target.value) || 0)}
                                                    className={`w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-2 py-1 text-xs text-right text-slate-900 dark:text-white ${vatMode !== 'none' ? 'opacity-70' : ''}`}
                                                    placeholder="0.00"
                                                    step="0.01"
                                                    readOnly={vatMode !== 'none'}
                                                />
                                            </td>
                                            {/* EWT */}
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    value={exp?.ewt || ''}
                                                    onChange={(e) => updateExpense(index, 'ewt', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-2 py-1 text-xs text-right text-slate-900 dark:text-white"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-100 dark:bg-slate-900/50 font-medium">
                                <tr>
                                    <td colSpan={3} className="px-2 py-3 text-right text-slate-500 dark:text-slate-400 text-xs text-xs">Totals:</td>
                                    <td className="px-2 py-3 text-right text-slate-700 dark:text-slate-300 text-xs">{formatCurrency(itemTotals.totalEstimated)}</td>
                                    <td className="px-2 py-3 text-right text-slate-900 dark:text-white text-xs">{formatCurrency(itemTotals.totalActual)}</td>
                                    <td className={`px-2 py-3 text-right font-bold text-xs ${itemTotals.variance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {itemTotals.variance >= 0 ? '+' : ''}{formatCurrency(itemTotals.variance)}
                                    </td>
                                    <td colSpan={6}></td>
                                    <td className="px-2 py-3 text-right text-cyan-600 dark:text-cyan-400 text-xs">{formatCurrency(totalVat)}</td>
                                    <td className="px-2 py-3 text-right text-orange-600 dark:text-orange-400 text-xs">{formatCurrency(totalEwt)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {itemTotals.variance !== 0 && (
                        <div className={`mt-3 px-3 py-2 rounded text-xs ${itemTotals.variance > 0 ? 'bg-emerald-600/10 text-emerald-400' : 'bg-red-600/10 text-red-400'}`}>
                            {itemTotals.variance > 0
                                ? `Under budget by ${formatCurrency(itemTotals.variance)} - savings achieved`
                                : `Over budget by ${formatCurrency(Math.abs(itemTotals.variance))} - additional expense`
                            }
                        </div>
                    )}

                    {/* Additional Expense Rows - beyond PRF items */}
                    {expenses.length > (requisition.items?.length || 0) && (
                        <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                                <Plus size={16} className="text-cyan-600 dark:text-cyan-400" />
                                Additional Expenses ({expenses.length - (requisition.items?.length || 0)} rows)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-2 py-3 text-left w-24">Date</th>
                                            <th className="px-2 py-3 text-left w-32">Supplier</th>
                                            <th className="px-2 py-3 text-left w-24">TIN</th>
                                            <th className="px-2 py-3 text-left w-20">OR No.</th>
                                            <th className="px-2 py-3 text-left w-28">COA</th>
                                            <th className="px-2 py-3 text-left w-32">Description</th>
                                            <th className="px-2 py-3 text-right w-24">Amount</th>
                                            <th className="px-2 py-3 text-right w-28">VAT</th>
                                            <th className="px-2 py-3 text-right w-28">EWT</th>
                                            {!isReadOnly && <th className="px-2 py-3 text-center w-12">Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {expenses.slice(requisition.items?.length || 0).map((exp, idx) => {
                                            const actualIndex = (requisition.items?.length || 0) + idx;
                                            return (
                                                <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                    <td className="px-2 py-2">
                                                        {isReadOnly ? (
                                                            <span className="text-xs text-slate-300">{exp.date || '-'}</span>
                                                        ) : (
                                                            <input
                                                                type="date"
                                                                value={exp.date || ''}
                                                                onChange={(e) => updateExpense(actualIndex, 'date', e.target.value)}
                                                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-1 py-1 text-xs text-slate-900 dark:text-white"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {isReadOnly ? (
                                                            <span className="text-xs text-slate-300">{exp.supplierName || '-'}</span>
                                                        ) : (
                                                            <SearchableDropdown
                                                                options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                                                                value={exp.supplierId || ''}
                                                                onChange={(value) => handleSupplierChange(actualIndex, value)}
                                                                placeholder="Select..."
                                                                className="text-xs"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {isReadOnly ? (
                                                            <span className="text-xs text-slate-300">{exp.tin || '-'}</span>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={exp.tin || ''}
                                                                onChange={(e) => updateExpense(actualIndex, 'tin', e.target.value)}
                                                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-1 py-1 text-xs text-slate-900 dark:text-white"
                                                                placeholder="TIN"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {isReadOnly ? (
                                                            <span className="text-xs text-slate-300">{exp.orNo || '-'}</span>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={exp.orNo || ''}
                                                                onChange={(e) => updateExpense(actualIndex, 'orNo', e.target.value)}
                                                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-1 py-1 text-xs text-slate-900 dark:text-white"
                                                                placeholder="OR #"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {isReadOnly ? (
                                                            <span className="text-xs text-slate-300">{exp.coaCode ? `${exp.coaCode} - ${exp.coaName}` : '-'}</span>
                                                        ) : (
                                                            <AccountSelector
                                                                value={exp.coaCode ? { code: exp.coaCode, name: exp.coaName } : null}
                                                                onChange={(account) => handleCoaChange(actualIndex, account)}
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {isReadOnly ? (
                                                            <span className="text-xs text-slate-300">{exp.description || '-'}</span>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={exp.description || ''}
                                                                onChange={(e) => updateExpense(actualIndex, 'description', e.target.value)}
                                                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-transparent rounded px-1 py-1 text-xs text-slate-900 dark:text-white"
                                                                placeholder="Description"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {isReadOnly ? (
                                                            <span className="text-xs text-slate-300 text-right block">{formatCurrency(exp.amount || 0)}</span>
                                                        ) : (
                                                            <input
                                                                type="number"
                                                                value={exp.amount || ''}
                                                                onChange={(e) => updateExpense(actualIndex, 'amount', parseFloat(e.target.value) || 0)}
                                                                className="w-full bg-slate-700 border-0 rounded px-1 py-1 text-xs text-right"
                                                                placeholder="0.00"
                                                                step="0.01"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {isReadOnly ? (
                                                            <span className="text-xs text-cyan-400 text-right block">{formatCurrency(exp.vat || 0)}</span>
                                                        ) : (
                                                            <input
                                                                type="number"
                                                                value={exp.vat || ''}
                                                                onChange={(e) => updateExpense(actualIndex, 'vat', parseFloat(e.target.value) || 0)}
                                                                className={`w-full bg-slate-700 border-0 rounded px-2 py-1 text-xs text-right ${vatMode !== 'none' ? 'opacity-70' : ''}`}
                                                                placeholder="0.00"
                                                                step="0.01"
                                                                readOnly={vatMode !== 'none'}
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {isReadOnly ? (
                                                            <span className="text-xs text-orange-400 text-right block">{formatCurrency(exp.ewt || 0)}</span>
                                                        ) : (
                                                            <input
                                                                type="number"
                                                                value={exp.ewt || ''}
                                                                onChange={(e) => updateExpense(actualIndex, 'ewt', parseFloat(e.target.value) || 0)}
                                                                className="w-full bg-slate-700 border-0 rounded px-2 py-1 text-xs text-right"
                                                                placeholder="0.00"
                                                                step="0.01"
                                                            />
                                                        )}
                                                    </td>
                                                    {!isReadOnly && (
                                                        <td className="px-2 py-2 text-center">
                                                            <button
                                                                onClick={() => deleteExpenseRow(actualIndex)}
                                                                className="text-red-400 hover:text-red-300 p-1"
                                                                title="Delete row"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>


                {/* Summary Section */}
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                            <FileText size={20} className="text-emerald-600 dark:text-emerald-400" />
                            Liquidation Summary
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-700/30">
                                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Total Cash Advance</p>
                                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{formatCurrency(requisition.totalAmount || 0)}</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-700/30">
                                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Actual Expense</p>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{formatCurrency(totalActualAmount)}</p>
                            </div>
                            <div className={`p-4 rounded-lg border ${variance >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-700/30' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-700/30'} col-span-2`}>
                                <p className={`text-sm font-medium ${variance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {variance >= 0 ? 'Amount to Refund (Company)' : 'Amount to Reimburse (Employee)'}
                                </p>
                                <p className={`text-2xl font-bold mt-1 ${variance >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                    {formatCurrency(Math.abs(variance))}
                                </p>
                            </div>
                        </div>

                        {/* Link & Remarks */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Receipts Link (Google Drive)
                                </label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="url"
                                        value={receiptsLink}
                                        onChange={(e) => setReceiptsLink(e.target.value)}
                                        placeholder="https://drive.google.com/..."
                                        disabled={isReadOnly}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Remarks / Notes
                                </label>
                                <textarea
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Any additional notes about this liquidation..."
                                    rows={3}
                                    disabled={isReadOnly}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 disabled:opacity-50 resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Preview Modal */}
            {
                showPrintModal && requisition && (
                    <LiquidationPrintModal
                        req={{
                            ...requisition,
                            // Update items with current actual costs
                            items: (requisition.items || []).map((item) => ({
                                ...item,
                                actualCost: itemActualCosts[item.itemId] || 0
                            })),
                            // Build temporary liquidation details from current form state
                            liquidationDetails: {
                                dateFiled: new Date().toISOString(),
                                submittedBy: currentUser?.id || '',
                                filedBy: currentUser?.id || '',
                                status: 'PENDING' as const,
                                totalActualAmount: Object.values(itemActualCosts).reduce((sum, cost) => sum + cost, 0),
                                refundAmount: 0,
                                reimbursementAmount: 0,
                                attachmentLink: receiptsLink,
                                remarks: remarks,
                                items: expenses.map(exp => ({
                                    id: exp.id,
                                    date: exp.date,
                                    vendorId: exp.supplierId,
                                    vendorName: exp.supplierName,
                                    tin: exp.tin,
                                    orNo: exp.orNo,
                                    coa: exp.coaCode ? `${exp.coaCode} - ${exp.coaName}` : '',
                                    description: exp.description,
                                    buId: exp.buId,
                                    buName: exp.buName,
                                    vat: exp.vat,
                                    ewt: exp.ewt,
                                    amount: exp.amount
                                })) as any
                            } as any
                        }}
                        onClose={() => setShowPrintModal(false)}
                        business={business}
                        requester={users.find(u => u.id === requisition.requesterId)}
                    />
                )
            }
        </>
    );
};

export default LiquidationPage;
