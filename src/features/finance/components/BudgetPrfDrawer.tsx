/**
 * BudgetPrfDrawer Component
 * 
 * Slide-out drawer showing PRFs that are using a specific budget (COA).
 * Triggered when user clicks on a budget row in the widget.
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS } from '../../../shared/types/firebase.types';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';

interface BudgetPrfDrawerProps {
    /** Whether the drawer is open */
    isOpen: boolean;
    /** Close handler */
    onClose: () => void;
    /** COA ID to filter PRFs */
    coaId: string;
    /** COA name for display */
    coaName?: string;
    /** Business Unit ID filter */
    businessUnitId?: string;
    /** Fiscal year filter */
    fiscalYear?: number;
    /** Month filter (optional) */
    month?: number;
}

interface PrfSummary {
    id: string;
    requesterName: string;
    description: string;
    totalAmount: number;
    status: RequisitionStatus;
    dateCreated: string;
    budgetStatus?: string;
}

// Status display mapping
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    [RequisitionStatus.PRF_PENDING_MANAGER]: { label: 'Pending Manager', color: '#facc15' },
    [RequisitionStatus.PENDING_GM_PRF_APPROVAL]: { label: 'Pending GM', color: '#facc15' },
    [RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL]: { label: 'Pending Finance', color: '#facc15' },
    [RequisitionStatus.PENDING_GM_BR_APPROVAL]: { label: 'Pending GM BR', color: '#facc15' },
    [RequisitionStatus.PENDING_BOD_APPROVAL]: { label: 'Pending BOD', color: '#facc15' },
    [RequisitionStatus.FOR_CHECK_PREPARATION]: { label: 'Check Prep', color: '#f59e0b' },
    [RequisitionStatus.PENDING_CHECK_AUTH_BOD]: { label: 'Check Auth', color: '#f59e0b' },
    [RequisitionStatus.FOR_FUND_RELEASE]: { label: 'Fund Release', color: '#22c55e' },
    [RequisitionStatus.FUNDS_RELEASED]: { label: 'Released', color: '#22c55e' },
    [RequisitionStatus.REJECTED]: { label: 'Rejected', color: '#ef4444' },
};

export const BudgetPrfDrawer: React.FC<BudgetPrfDrawerProps> = ({
    isOpen,
    onClose,
    coaId,
    coaName,
    businessUnitId,
    fiscalYear,
    month,
}) => {
    const [prfs, setPrfs] = useState<PrfSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalAmount, setTotalAmount] = useState(0);

    // Fetch PRFs when drawer opens
    useEffect(() => {
        if (!isOpen || !coaId) return;

        const fetchPrfs = async () => {
            setLoading(true);
            setError(null);

            try {
                // Query requisitions with matching COA code
                const constraints = [
                    where('coaCode', '==', coaId),
                ];

                if (businessUnitId) {
                    constraints.push(where('businessId', '==', businessUnitId));
                }

                const q = query(
                    collection(db, COLLECTIONS.REQUISITIONS),
                    ...constraints
                );

                const snapshot = await getDocs(q);
                const prfList: PrfSummary[] = [];
                let total = 0;

                snapshot.docs.forEach(doc => {
                    const data = doc.data() as Requisition;

                    // Filter by fiscal year if provided
                    if (fiscalYear) {
                        const prfYear = new Date(data.dateCreated).getFullYear();
                        if (prfYear !== fiscalYear) return;
                    }

                    // Filter by month if provided
                    if (month) {
                        const prfMonth = new Date(data.dateCreated).getMonth() + 1;
                        if (prfMonth !== month) return;
                    }

                    prfList.push({
                        id: data.id,
                        requesterName: data.requesterName || 'Unknown',
                        description: data.description || data.projectName || 'No description',
                        totalAmount: data.totalAmount || 0,
                        status: data.status,
                        dateCreated: data.dateCreated,
                        budgetStatus: data.budgetStatus,
                    });

                    total += data.totalAmount || 0;
                });

                // Sort by date (newest first)
                prfList.sort((a, b) =>
                    new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
                );

                setPrfs(prfList);
                setTotalAmount(total);
            } catch (err) {
                console.error('Error fetching PRFs for budget:', err);
                setError('Failed to load PRFs');
            } finally {
                setLoading(false);
            }
        };

        fetchPrfs();
    }, [isOpen, coaId, businessUnitId, fiscalYear, month]);

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Format date
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Get status display
    const getStatusDisplay = (status: RequisitionStatus) => {
        const display = STATUS_LABELS[status] || { label: status.replace(/_/g, ' '), color: '#64748b' };
        return display;
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 animate-in fade-in active:animate-out fade-out" onClick={onClose} />

            {/* Drawer */}
            <div className={`fixed inset-y-0 right-0 w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-50 flex flex-col transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">PRFs Using Budget</h3>
                        <span className="block text-sm text-purple-600 dark:text-purple-400 font-medium truncate mt-1">{coaName || coaId}</span>
                    </div>
                    <button
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                {/* Summary */}
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <div className="flex-1 p-4 text-center border-r border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Total PRFs</span>
                        <span className="block text-xl font-bold text-slate-800 dark:text-white">{prfs.length}</span>
                    </div>
                    <div className="flex-1 p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Total Amount</span>
                        <span className="block text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(totalAmount)}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-transparent">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500 gap-3">
                            <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-purple-500 animate-spin" />
                            <span className="text-sm">Loading PRFs...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-center text-rose-600 dark:text-rose-400 text-sm">
                            <span>⚠️ {error}</span>
                        </div>
                    )}

                    {!loading && !error && prfs.length === 0 && (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400 italic text-sm">
                            <span>No PRFs found using this budget</span>
                        </div>
                    )}

                    {!loading && !error && prfs.length > 0 && (
                        <div className="flex flex-col gap-3">
                            {prfs.map(prf => {
                                const statusDisplay = getStatusDisplay(prf.status);
                                return (
                                    <div key={prf.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{prf.id}</span>
                                            <span
                                                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border border-transparent"
                                                style={{
                                                    backgroundColor: `${statusDisplay.color}15`,
                                                    color: statusDisplay.color,
                                                    borderColor: `${statusDisplay.color}30`
                                                }}
                                            >
                                                {statusDisplay.label}
                                            </span>
                                        </div>
                                        <div className="mb-3">
                                            <div className="font-medium text-slate-800 dark:text-white text-sm line-clamp-2 mb-1">{prf.description}</div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                                    {prf.requesterName}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                                    {formatDate(prf.dateCreated)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                            <span className="font-bold text-slate-800 dark:text-white">{formatCurrency(prf.totalAmount)}</span>
                                            {prf.budgetStatus && (
                                                <span className={`text-[10px] uppercase font-bold tracking-wider ${prf.budgetStatus === 'RESERVED' ? 'text-amber-500' :
                                                    prf.budgetStatus === 'COMMITTED' ? 'text-emerald-500' : 'text-slate-400'
                                                    }`}>
                                                    {prf.budgetStatus}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default BudgetPrfDrawer;
