import React from 'react';
import {
    Clock,
    User,
    ShieldAlert,
    Eye,
    Shield,
    Sun,
    Utensils,
    Moon,
    AlertTriangle,
    TrendingUp,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface StaffOnDuty {
    id: string;
    name: string;
    role: string;
    status: 'Normal' | 'Watch' | 'Investigate';
}

interface Shift {
    id: string;
    label: string;
    time: string;
    icon: React.ElementType;
    staff: StaffOnDuty[];
}

import type { StaffVarianceRecord } from '../services/staff-variance.service';

export interface ShiftOverlayTabProps {
    staffVariances: StaffVarianceRecord[];
}

// ============================================================
// DYNAMIC SHIFT GENERATION
// ============================================================

const generateShifts = (staffVariances: StaffVarianceRecord[]): Shift[] => {
    const opening: StaffOnDuty[] = [];
    const lunch: StaffOnDuty[] = [];
    const dinner: StaffOnDuty[] = [];

    staffVariances.forEach((sv, idx) => {
        const staffObj: StaffOnDuty = {
            id: sv.staffId,
            name: sv.staffName || 'Unknown User',
            role: sv.role || 'Staff',
            status: sv.pattern === 'Recurring — Investigate' ? 'Investigate' :
                sv.pattern === 'Watch' ? 'Watch' : 'Normal',
        };
        const bucket = idx % 3;
        if (bucket === 0) opening.push(staffObj);
        else if (bucket === 1) lunch.push(staffObj);
        else dinner.push(staffObj);
    });

    return [
        {
            id: 'opening',
            label: 'Opening',
            time: '6:00 AM – 2:00 PM',
            icon: Sun,
            staff: opening,
        },
        {
            id: 'lunch',
            label: 'Lunch',
            time: '11:00 AM – 3:00 PM',
            icon: Utensils,
            staff: lunch,
        },
        {
            id: 'dinner',
            label: 'Dinner',
            time: '5:00 PM – 12:00 AM',
            icon: Moon,
            staff: dinner,
        },
    ];
};

// ============================================================
// SHIFT CARD
// ============================================================

const ShiftCard: React.FC<{ shift: Shift }> = ({ shift }) => {
    const Icon = shift.icon;
    const hasIssues = shift.staff.some(s => s.status !== 'Normal');

    return (
        <div className={`relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-slate-700/50 overflow-hidden transition-all duration-300 hover:-translate-y-1 group ${hasIssues
            ? 'shadow-lg shadow-amber-500/10 dark:shadow-amber-900/20 border-amber-500/30 ring-1 ring-amber-500/50'
            : 'shadow-lg shadow-slate-200/20 dark:shadow-black/20 hover:shadow-xl'
            }`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-slate-800/40 dark:to-slate-900/0 pointer-events-none" />

            {/* Header */}
            <div className="px-6 py-5 flex items-center gap-4 border-b border-slate-200/50 dark:border-slate-700/50 relative z-10 bg-white/30 dark:bg-slate-800/30">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border backdrop-blur-md shadow-inner ${shift.id === 'opening' ? 'bg-amber-500/10 border-amber-500/30' :
                    shift.id === 'lunch' ? 'bg-blue-500/10 border-blue-500/30' :
                        'bg-indigo-500/10 border-indigo-500/30'
                    }`}>
                    <Icon size={22} className={
                        shift.id === 'opening' ? 'text-amber-500 dark:text-amber-400' :
                            shift.id === 'lunch' ? 'text-blue-500 dark:text-blue-400' :
                                'text-indigo-500 dark:text-indigo-400'
                    } />
                </div>
                <div>
                    <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">{shift.label}</h3>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">{shift.time}</p>
                </div>
            </div>

            {/* Staff list */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/50 relative z-10">
                {shift.staff.map((person) => {
                    const statusConfig = {
                        Normal: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', icon: Shield },
                        Watch: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-600 dark:text-amber-400', icon: Eye },
                        Investigate: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-600 dark:text-red-400', icon: ShieldAlert },
                    }[person.status];
                    const StatusIcon = statusConfig.icon;

                    return (
                        <div key={person.id} className="px-6 py-4 flex items-center justify-between transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-slate-100/80 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 shadow-inner flex items-center justify-center flex-shrink-0">
                                    <User size={14} className="text-slate-500 dark:text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{person.name}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate mt-0.5">{person.role}</p>
                                </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border backdrop-blur-md shadow-inner text-[9px] font-black uppercase tracking-widest flex-shrink-0 ${statusConfig.bg} ${statusConfig.text}`}>
                                <StatusIcon size={10} />
                                {person.status}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const ShiftOverlayTab: React.FC<ShiftOverlayTabProps> = ({ staffVariances }) => {
    return (
        <div className="space-y-10">
            {/* Shift Cards Header */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center backdrop-blur-md shadow-inner">
                        <Clock size={22} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Shift Overlay</h2>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Staff on duty and per-shift variance status — Today</p>
                    </div>
                </div>

                {/* 3-column shift grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
                    {generateShifts(staffVariances).map((shift) => (
                        <ShiftCard key={shift.id} shift={shift} />
                    ))}
                </div>
            </div>

            {/* Variance by Staff Table */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-slate-800/40 dark:to-slate-900/0 pointer-events-none" />
                {/* Table header */}
                <div className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 dark:bg-slate-800/40 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center backdrop-blur-md shadow-inner">
                            <TrendingUp size={22} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Variance by Staff</h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Rolling 7-day analysis — highest variance first</p>
                        </div>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 shadow-inner">
                        <AlertTriangle size={14} />
                        {staffVariances.filter(s => s.pattern === 'Recurring — Investigate').length} recurring patterns
                    </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto relative z-10">
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-700/50">
                                {['STAFF', 'ROLE', 'SHIFTS', 'AVG VAR %', 'TOTAL LOSS (₱)', 'PATTERN'].map((col) => (
                                    <th
                                        key={col}
                                        className={`px-6 py-4 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ${['STAFF', 'ROLE'].includes(col) ? 'text-left' :
                                            col === 'PATTERN' ? 'text-center' :
                                                'text-right'
                                            }`}
                                    >
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {staffVariances.map((sv) => (
                                <tr
                                    key={sv.staffId}
                                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80 ${sv.pattern === 'Recurring — Investigate' ? 'bg-red-50/30 dark:bg-red-900/10' : ''
                                        }`}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100/80 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center flex-shrink-0 shadow-inner">
                                                <User size={14} className="text-slate-500 dark:text-slate-400" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{sv.staffName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{sv.role}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{sv.shiftsWorked}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`text-sm font-black ${sv.avgVariancePercent > 5 ? 'text-red-500 hover:text-red-600' :
                                            sv.avgVariancePercent >= 2 ? 'text-amber-500' :
                                                'text-emerald-500'
                                            }`}>
                                            {sv.avgVariancePercent.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`text-sm font-black ${sv.totalLossPeso > 5000 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                            ₱{sv.totalLossPeso.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border backdrop-blur-md shadow-inner text-[10px] font-black uppercase tracking-widest ${sv.pattern === 'Recurring — Investigate'
                                            ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                                            : sv.pattern === 'Watch'
                                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                            }`}>
                                            {sv.pattern === 'Recurring — Investigate' ? (
                                                <><ShieldAlert size={12} /> Recurring — Investigate</>
                                            ) : sv.pattern === 'Watch' ? (
                                                <><Eye size={12} /> Watch</>
                                            ) : (
                                                <><Shield size={12} /> Normal</>
                                            )}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ShiftOverlayTab;
