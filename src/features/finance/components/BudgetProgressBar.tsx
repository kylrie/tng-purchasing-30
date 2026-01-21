/**
 * BudgetProgressBar Component
 * 
 * Visual progress bar showing budget utilization with:
 * - Dynamic color based on status (safe/warning/critical)
 * - Reserved amount segment in amber/orange
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
    /** Amount reserved (soft hold) */
    reserved?: number;
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
    /** Optional: Click handler for drill-down */
    onClick?: () => void;
}

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
    label,
    spent,
    reserved = 0,
    limit,
    currency,
    status,
    showPercentage = true,
    compact = false,
    onClick,
}) => {
    const [showTooltip, setShowTooltip] = useState(false);

    // Calculate percentages (avoid division by zero)
    const spentPercentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const reservedPercentage = limit > 0 ? Math.round((reserved / limit) * 100) : 0;
    const totalUtilization = spentPercentage + reservedPercentage;

    // Clamp visual widths
    const clampedSpentWidth = Math.min(spentPercentage, 100);
    const clampedReservedWidth = Math.min(reservedPercentage, 100 - clampedSpentWidth);

    // Derive status if not provided (based on total utilization including reserved)
    const derivedStatus: BudgetStatus = status || (
        totalUtilization >= 100 ? 'critical' :
            totalUtilization >= 80 ? 'warning' : 'safe'
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

    const remaining = limit - spent - reserved;

    return (
        <div
            className={`budget-progress ${compact ? 'compact' : ''} ${onClick ? 'clickable' : ''}`}
            onClick={onClick}
        >
            <div className="budget-progress-header">
                <span className="budget-progress-label">{label}</span>
                <div className="budget-progress-badges">
                    {reserved > 0 && (
                        <span className="budget-reserved-badge">
                            Reserved: {formatAmount(reserved)}
                        </span>
                    )}
                    {showPercentage && (
                        <span className={`budget-progress-percentage ${derivedStatus}`}>
                            {totalUtilization}%
                        </span>
                    )}
                </div>
            </div>

            <div
                className="budget-progress-container"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                {/* Spent segment */}
                <div
                    className={`budget-progress-bar spent ${derivedStatus} ${derivedStatus === 'critical' ? 'animate-pulse' : ''}`}
                    style={{ width: `${clampedSpentWidth}%` }}
                />
                {/* Reserved segment (amber) */}
                {reserved > 0 && (
                    <div
                        className="budget-progress-bar reserved"
                        style={{
                            width: `${clampedReservedWidth}%`,
                            left: `${clampedSpentWidth}%`
                        }}
                    />
                )}

                {/* Tooltip */}
                {showTooltip && (
                    <div className="budget-progress-tooltip">
                        <div className="tooltip-row">
                            <span>Spent:</span>
                            <strong>{formatAmount(spent)}</strong>
                        </div>
                        {reserved > 0 && (
                            <div className="tooltip-row reserved-row">
                                <span>Reserved:</span>
                                <strong>{formatAmount(reserved)}</strong>
                            </div>
                        )}
                        <div className="tooltip-row">
                            <span>Budget:</span>
                            <strong>{formatAmount(limit)}</strong>
                        </div>
                        <div className="tooltip-divider" />
                        <div className={`tooltip-row ${remaining < 0 ? 'negative' : ''}`}>
                            <span>{remaining >= 0 ? 'Available:' : 'Over budget:'}</span>
                            <strong>{formatAmount(Math.abs(remaining))}</strong>
                        </div>
                    </div>
                )}
            </div>

            {!compact && (
                <div className="budget-progress-footer">
                    <span className="budget-spent">{formatAmount(spent)}</span>
                    {reserved > 0 && (
                        <span className="budget-reserved-amount">+ {formatAmount(reserved)} reserved</span>
                    )}
                    <span className="budget-limit">/ {formatAmount(limit)}</span>
                </div>
            )}
        </div>
    );
};

export default BudgetProgressBar;

