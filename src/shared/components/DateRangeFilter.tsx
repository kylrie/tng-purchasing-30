import React, { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

interface DateRangeFilterProps {
    onFilterChange: (startDate: string | null, endDate: string | null) => void;
    className?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ onFilterChange, className = '' }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        // Debounce notify parent
        const timer = setTimeout(() => {
            onFilterChange(startDate || null, endDate || null);
        }, 300);
        return () => clearTimeout(timer);
    }, [startDate, endDate]);

    const handleQuickSelect = (type: 'today' | 'this_month' | 'last_month' | 'this_year') => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (type) {
            case 'today':
                start = now;
                end = now;
                break;
            case 'this_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'this_year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                break;
        }

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    const clearFilter = () => {
        setStartDate('');
        setEndDate('');
        onFilterChange(null, null);
    };

    const hasFilter = startDate || endDate;

    return (
        <div className={`relative ${className}`}>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${hasFilter
                            ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
                        }`}
                >
                    <Calendar size={16} />
                    <span>
                        {hasFilter ? `${startDate} - ${endDate}` : 'Filter by Date'}
                    </span>
                    {hasFilter && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                clearFilter();
                            }}
                            className="ml-1 p-0.5 hover:bg-slate-700 rounded-full"
                        >
                            <X size={14} />
                        </div>
                    )}
                </button>
            </div>

            {isExpanded && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsExpanded(false)}
                    ></div>
                    <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-medium uppercase">Date Range</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                                        placeholder="Start"
                                    />
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                                        placeholder="End"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-medium uppercase">Quick Select</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleQuickSelect('today')}
                                        className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={() => handleQuickSelect('this_month')}
                                        className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                                    >
                                        This Month
                                    </button>
                                    <button
                                        onClick={() => handleQuickSelect('last_month')}
                                        className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                                    >
                                        Last Month
                                    </button>
                                    <button
                                        onClick={() => handleQuickSelect('this_year')}
                                        className="px-2 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                                    >
                                        This Year
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
