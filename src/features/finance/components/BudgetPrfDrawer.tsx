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
import './BudgetPrfDrawer.css';

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
            <div className="budget-drawer-backdrop" onClick={onClose} />

            {/* Drawer */}
            <div className={`budget-drawer ${isOpen ? 'open' : ''}`}>
                <div className="budget-drawer-header">
                    <div className="drawer-title-section">
                        <h3>PRFs Using Budget</h3>
                        <span className="drawer-coa-name">{coaName || coaId}</span>
                    </div>
                    <button className="drawer-close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="budget-drawer-summary">
                    <div className="summary-item">
                        <span className="summary-label">Total PRFs</span>
                        <span className="summary-value">{prfs.length}</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-label">Total Amount</span>
                        <span className="summary-value amount">{formatCurrency(totalAmount)}</span>
                    </div>
                </div>

                <div className="budget-drawer-content">
                    {loading && (
                        <div className="drawer-loading">
                            <div className="loading-spinner" />
                            <span>Loading PRFs...</span>
                        </div>
                    )}

                    {error && (
                        <div className="drawer-error">
                            <span>⚠️ {error}</span>
                        </div>
                    )}

                    {!loading && !error && prfs.length === 0 && (
                        <div className="drawer-empty">
                            <span>No PRFs found using this budget</span>
                        </div>
                    )}

                    {!loading && !error && prfs.length > 0 && (
                        <div className="prf-list">
                            {prfs.map(prf => {
                                const statusDisplay = getStatusDisplay(prf.status);
                                return (
                                    <div key={prf.id} className="prf-item">
                                        <div className="prf-item-header">
                                            <span className="prf-id">{prf.id}</span>
                                            <span
                                                className="prf-status"
                                                style={{ backgroundColor: `${statusDisplay.color}20`, color: statusDisplay.color }}
                                            >
                                                {statusDisplay.label}
                                            </span>
                                        </div>
                                        <div className="prf-item-body">
                                            <div className="prf-description">{prf.description}</div>
                                            <div className="prf-meta">
                                                <span className="prf-requester">{prf.requesterName}</span>
                                                <span className="prf-date">{formatDate(prf.dateCreated)}</span>
                                            </div>
                                        </div>
                                        <div className="prf-item-footer">
                                            <span className="prf-amount">{formatCurrency(prf.totalAmount)}</span>
                                            {prf.budgetStatus && (
                                                <span className={`prf-budget-status ${prf.budgetStatus.toLowerCase()}`}>
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
