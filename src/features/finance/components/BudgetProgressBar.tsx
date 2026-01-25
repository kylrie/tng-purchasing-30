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

    // Color mapping
    const statusColors = {
        safe: 'bg-emerald-500',
        warning: 'bg-amber-400',
        critical: 'bg-rose-500',
    };

    const percentageColors = {
        safe: 'text-emerald-600 dark:text-emerald-400',
        warning: 'text-amber-600 dark:text-amber-400',
        critical: 'text-rose-600 dark:text-rose-400',
    };

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
            className={`relative p-3 rounded-xl bg-slate-100 dark:bg-slate-700/30 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all ${compact ? 'py-2 px-3' : ''} ${onClick ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50' : ''}`}
            onClick={onClick}
        >
            <div className="flex justify-between items-center mb-1.5">
                <span className={`font-medium text-slate-700 dark:text-slate-200 truncate pr-2 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
                <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                    {reserved > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                            Reserved: {formatAmount(reserved)}
                        </span>
                    )}
                    {showPercentage && (
                        <span className={`font-bold font-mono ${percentageColors[derivedStatus]}`}>
                            {totalUtilization}%
                        </span>
                    )}
                </div>
            </div>

            <div
                className="relative h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                {/* Spent segment */}
                <div
                    className={`absolute inset-y-0 left-0 ${statusColors[derivedStatus]} transition-all duration-500 rounded-l-full ${clampedReservedWidth === 0 && clampedSpentWidth < 100 ? 'rounded-r-full' : ''} ${derivedStatus === 'critical' ? 'animate-pulse' : ''}`}
                    style={{ width: `${clampedSpentWidth}%` }}
                />
                {/* Reserved segment (amber) */}
                {reserved > 0 && (
                    <div
                        className="absolute inset-y-0 bg-amber-500 transition-all duration-500"
                        style={{
                            width: `${clampedReservedWidth}%`,
                            left: `${clampedSpentWidth}%`,
                            borderTopRightRadius: (clampedSpentWidth + clampedReservedWidth) >= 99 ? '9999px' : '0',
                            borderBottomRightRadius: (clampedSpentWidth + clampedReservedWidth) >= 99 ? '9999px' : '0'
                        }}
                    />
                )}

                {/* Tooltip */}
                {showTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3 z-20 pointer-events-none">
                        <div className="flex justify-between mb-1">
                            <span>Spent:</span>
                            <strong className="text-white">{formatAmount(spent)}</strong>
                        </div>
                        {reserved > 0 && (
                            <div className="flex justify-between mb-1 text-amber-300">
                                <span>Reserved:</span>
                                <strong>{formatAmount(reserved)}</strong>
                            </div>
                        )}
                        <div className="flex justify-between mb-2">
                            <span>Budget:</span>
                            <strong className="text-white">{formatAmount(limit)}</strong>
                        </div>
                        <div className="border-t border-slate-600 my-1 pt-1" />
                        <div className={`flex justify-between ${remaining < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                            <span>{remaining >= 0 ? 'Available:' : 'Over budget:'}</span>
                            <strong>{formatAmount(Math.abs(remaining))}</strong>
                        </div>
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-slate-800 rotate-45" />
                    </div>
                )}
            </div>

            {!compact && (
                <div className="flex justify-between mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <div>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">{formatAmount(spent)}</span>
                        {reserved > 0 && (
                            <span className="text-amber-600 dark:text-amber-500 ml-1">+ {formatAmount(reserved)} reserved</span>
                        )}
                    </div>
                    <span className="text-slate-400 dark:text-slate-500">/ {formatAmount(limit)}</span>
                </div>
            )}
        </div>
    );
};

export default BudgetProgressBar;

