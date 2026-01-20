/**
 * BudgetProgressBar Component
 * 
 * Visual progress bar showing budget utilization with:
 * - Dynamic color based on status (safe/warning/critical)
 * - Pulse animation for critical budgets
 * - Tooltip showing exact amounts on hover
 */

import React, { useState } from 'react';
import type { BudgetStatus } from '../../../hooks/useBudgetMonitor';
import './BudgetProgressBar.css';

interface BudgetProgressBarProps {
    /** Display label for the budget */
    label: string;
    /** Amount currently spent */
    spent: number;
    /** Total budget limit */
    limit: number;
    /** Currency code for formatting */
    currency: string;
    /** Budget status for styling */
    status?: BudgetStatus;
    /** Optional: Show percentage text */
    showPercentage?: boolean;
    /** Optional: Compact mode for dashboard widgets */
    compact?: boolean;
}

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
    label,
    spent,
    limit,
    currency,
    status,
    showPercentage = true,
    compact = false,
}) => {
    const [showTooltip, setShowTooltip] = useState(false);

    // Calculate percentage (avoid division by zero)
    const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const clampedWidth = Math.min(percentage, 100); // Cap visual width at 100%

    // Derive status if not provided
    const derivedStatus: BudgetStatus = status || (
        percentage >= 100 ? 'critical' :
            percentage >= 80 ? 'warning' : 'safe'
    );

    // Format currency
    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const remaining = limit - spent;

    return (
        <div className={`budget-progress ${compact ? 'compact' : ''}`}>
            <div className="budget-progress-header">
                <span className="budget-progress-label">{label}</span>
                {showPercentage && (
                    <span className={`budget-progress-percentage ${derivedStatus}`}>
                        {percentage}%
                    </span>
                )}
            </div>

            <div
                className="budget-progress-container"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <div
                    className={`budget-progress-bar ${derivedStatus} ${derivedStatus === 'critical' ? 'animate-pulse' : ''}`}
                    style={{ width: `${clampedWidth}%` }}
                />

                {/* Tooltip */}
                {showTooltip && (
                    <div className="budget-progress-tooltip">
                        <div className="tooltip-row">
                            <span>Spent:</span>
                            <strong>{formatAmount(spent)}</strong>
                        </div>
                        <div className="tooltip-row">
                            <span>Budget:</span>
                            <strong>{formatAmount(limit)}</strong>
                        </div>
                        <div className="tooltip-divider" />
                        <div className={`tooltip-row ${remaining < 0 ? 'negative' : ''}`}>
                            <span>{remaining >= 0 ? 'Remaining:' : 'Over budget:'}</span>
                            <strong>{formatAmount(Math.abs(remaining))}</strong>
                        </div>
                    </div>
                )}
            </div>

            {!compact && (
                <div className="budget-progress-footer">
                    <span className="budget-spent">{formatAmount(spent)}</span>
                    <span className="budget-limit">/ {formatAmount(limit)}</span>
                </div>
            )}
        </div>
    );
};

export default BudgetProgressBar;
