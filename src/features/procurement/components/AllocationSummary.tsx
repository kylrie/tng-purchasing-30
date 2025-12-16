import React from 'react';
import { Users, Building2 } from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import type { CostAllocation } from '../types';

interface AllocationSummaryProps {
    allocation: CostAllocation[];
    totalAmount: number;
}

/**
 * AllocationSummary - Displays the expense sharing breakdown for a PRF
 * Shows which branches are sharing the cost and their respective amounts
 */
const AllocationSummary: React.FC<AllocationSummaryProps> = ({ allocation, totalAmount }) => {
    if (!allocation || allocation.length === 0) {
        return null;
    }

    const branchCount = allocation.length;

    return (
        <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-xl border border-purple-500/30 p-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Users size={20} className="text-purple-400" />
                </div>
                <div>
                    <h4 className="font-semibold text-purple-200">Shared Expense</h4>
                    <p className="text-xs text-purple-400">
                        This expense is allocated across {branchCount} {branchCount === 1 ? 'branch' : 'branches'}
                    </p>
                </div>
            </div>

            {/* Allocation Table */}
            <div className="space-y-2">
                {allocation.map((alloc, index) => (
                    <div
                        key={alloc.buId}
                        className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                {index + 1}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <Building2 size={14} className="text-slate-400" />
                                    <span className="font-medium text-slate-200">{alloc.buName}</span>
                                </div>
                                <span className="text-xs text-slate-500">
                                    {alloc.percentage}% share
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                                <PesoSign size={14} />
                                ₱{alloc.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Total */}
            <div className="mt-4 pt-3 border-t border-purple-500/30 flex items-center justify-between">
                <span className="text-sm text-purple-300">Total Amount</span>
                <span className="text-lg font-bold text-white">
                    ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
            </div>

            {/* Info Note */}
            <div className="mt-3 text-xs text-purple-400/70 text-center">
                Each branch will be charged their allocated share
            </div>
        </div>
    );
};

export default AllocationSummary;
