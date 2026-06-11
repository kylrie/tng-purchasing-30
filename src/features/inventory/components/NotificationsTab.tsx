import React, { useState } from 'react';
import {
    Mail,
    Bell,
    Plus,
    CheckCircle2,
    AlertTriangle,
    Clock,
    User,
    Shield,
    Trash2,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';
import { useAuth } from '../../../contexts/useAuth';
import { UsersService } from '../../../shared/services/users.service';

// ============================================================
// TYPES
// ============================================================

interface Recipient {
    id: string;
    name: string;
    email: string;
    role: string;
}

// ============================================================
// COMPONENT
// ============================================================

const NotificationsTab: React.FC = () => {
    const { currentUser } = useAuth();
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [unresolvedToggle, setUnresolvedToggle] = useState(true);

    React.useEffect(() => {
        const fetchRecipients = async () => {
            if (!currentUser?.businessId) return;
            try {
                const users = await UsersService.getUsersByBusiness(currentUser.businessId);
                // Filter users to only include those who have notification/inventory related permissions.
                // For now, allow anyone with INVENTORY or SUPER_ADMIN access to receive these.
                const eligible = users.filter(u => {
                    if (u.role === 'SUPER_ADMIN') return true;
                    // Since we don't have direct access to hasPermission here easily for arbitrary users,
                    // we'll fetch the roles that we know are relevant or just default to allowing selection
                    // of anyone who is not an EMPLOYEE.
                    return u.role !== 'EMPLOYEE';
                });

                setRecipients(eligible.map(u => ({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    id: (u as any).id || u.email,
                    name: u.name || 'Unknown User',
                    email: u.email,
                    role: u.role || 'Staff'
                })));
            } catch (err) {
                console.error('[NotificationsTab] Failed to load recipients', err);
            }
        };
        fetchRecipients();
    }, [currentUser?.businessId]);

    const handleRemoveRecipient = (id: string) => {
        setRecipients(prev => prev.filter(r => r.id !== id));
    };

    const handleAddRecipient = () => {
        console.log('[NotificationsTab] Add recipient triggered');
    };

    return (
        <div className="space-y-6">

            {/* Connection Status */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-emerald-50/20 dark:from-blue-900/20 dark:to-emerald-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="px-5 py-4 flex items-center justify-between relative z-10 border-b border-slate-100/50 dark:border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-100/50 dark:border-blue-800/30 flex items-center justify-center shadow-sm">
                            <Mail size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">Email Integration</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Gmail connected via SMTP relay</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-200/50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        <CheckCircle2 size={10} />
                        Active
                    </span>
                </div>
                <div className="px-5 pb-4 pt-4 relative z-10">
                    <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm px-4 py-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 transition-all duration-300 hover:shadow-md hover:border-slate-300/50 dark:hover:border-slate-600/50">
                        <Shield size={14} className="text-slate-400 dark:text-slate-500" />
                        <span>Sending from: <span className="font-semibold text-slate-800 dark:text-white">alerts@procureflow-tng.com</span></span>
                    </div>
                </div>
            </div>

            {/* Trigger 1: Immediate Red Variance */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 via-transparent to-rose-50/20 dark:from-red-900/20 dark:to-rose-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="px-5 py-4 border-b border-slate-100/50 dark:border-slate-700/50 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border border-red-100/50 dark:border-red-800/30 flex items-center justify-center shadow-sm">
                            <AlertTriangle size={20} className="text-red-500 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">Trigger 1: Red Variance Alert</h3>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/20 border border-red-200/50 dark:border-red-500/30 text-red-600 dark:text-red-400 text-[9px] font-bold uppercase tracking-wider shadow-sm">
                                    Enabled
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                                Send immediately when any item's variance exceeds the 5% red threshold
                            </p>
                        </div>
                    </div>
                </div>

                {/* Recipients list */}
                <div className="px-5 py-4 relative z-10">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                        Recipients ({recipients.length})
                    </p>

                    <div className="space-y-2">
                        {recipients.map((r) => (
                            <div
                                key={r.id}
                                className="flex items-center justify-between bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl px-4 py-3 group/item border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:shadow-md hover:border-slate-300/50 dark:hover:border-slate-600/50 transition-all duration-300 relative z-10"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-slate-50 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <User size={14} className="text-slate-400 dark:text-slate-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{r.name}</p>
                                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{r.email} <span className="text-slate-300 dark:text-slate-600 mx-1">•</span> {r.role}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveRecipient(r.id)}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 opacity-0 group-hover/item:opacity-100 hover:scale-110 active:scale-95"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleAddRecipient}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-white/50 dark:bg-slate-800/50 border border-blue-200/50 dark:border-blue-500/30 rounded-xl hover:bg-blue-50/80 dark:hover:bg-blue-500/10 hover:border-blue-300/50 dark:hover:border-blue-400/50 hover:shadow-md transition-all duration-300 shadow-sm"
                    >
                        <Plus size={14} />
                        Add Recipient
                    </button>
                </div>
            </div>

            {/* Trigger 2: Unresolved after 24h */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 via-transparent to-orange-50/20 dark:from-amber-900/20 dark:to-orange-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="px-5 py-4 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-100/50 dark:border-amber-800/30 flex items-center justify-center shadow-sm">
                            <Clock size={20} className="text-amber-500 dark:text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">Trigger 2: Unresolved Escalation</h3>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm border ${unresolvedToggle
                                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/30'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50'
                                    }`}>
                                    {unresolvedToggle ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                                Auto-escalate via email if a case remains unresolved after 24 hours
                            </p>
                        </div>
                    </div>

                    {/* Toggle */}
                    <button
                        onClick={() => setUnresolvedToggle(!unresolvedToggle)}
                        className={`flex-shrink-0 transition-all duration-300 hover:scale-110 active:scale-95 ${unresolvedToggle ? 'text-emerald-500 drop-shadow-sm' : 'text-slate-300 dark:text-slate-600'}`}
                    >
                        {unresolvedToggle ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>

                {unresolvedToggle && (
                    <div className="px-5 pb-4 pt-1 relative z-10">
                        <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md border border-amber-200/50 dark:border-amber-700/50 shadow-sm rounded-xl px-4 py-3 flex items-start gap-3 transition-all duration-300 hover:shadow-md hover:border-amber-300/50 dark:hover:border-amber-600/50">
                            <div className="w-1 absolute top-0 left-0 h-full bg-amber-400 dark:bg-amber-500 rounded-l-xl" />
                            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                <span className="font-bold text-slate-800 dark:text-slate-200">Escalation chain:</span> Notification will be sent to the assignee's direct manager.
                                If still unresolved after 48 hours, it escalates to the General Manager.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Email Preview */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-black/40 overflow-hidden relative group mt-8">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 via-transparent to-blue-50/20 dark:from-slate-800/50 dark:to-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="px-5 py-4 border-b border-slate-100/50 dark:border-slate-700/50 flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 border border-slate-200/50 dark:border-slate-600 flex items-center justify-center shadow-sm">
                        <Bell size={18} className="text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">Email Preview</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sample alert for red variance threshold</p>
                    </div>
                </div>

                <div className="px-5 py-5 relative z-10">
                    <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-red-100/60 dark:border-red-900/50 shadow-md rounded-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-red-500 to-rose-400 dark:from-red-600 dark:to-rose-500" />

                        {/* Email header */}
                        <div className="px-6 py-4 bg-gradient-to-br from-white/90 to-red-50/30 dark:from-slate-800/90 dark:to-red-900/20 border-b border-red-100/50 dark:border-red-900/30">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 w-12">From:</span>
                                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">ProcureFlow Integrity Monitor &lt;alerts@procureflow-tng.com&gt;</span>
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 w-12">To:</span>
                                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">{recipients.map(r => r.name).join(', ')}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-3 bg-red-50/50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100/50 dark:border-red-900/30">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-red-500 dark:text-red-400 w-12">Subject:</span>
                                <span className="text-xs text-red-700 dark:text-red-400 font-bold tracking-tight">🔴 [URGENT] Inventory Variance Alert — Whiskey 750ml (9.1% variance)</span>
                            </div>
                        </div>

                        {/* Email body */}
                        <div className="px-6 py-5 bg-white/40 dark:bg-slate-800/40">
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                <span className="font-bold text-red-600 dark:text-red-400 text-base drop-shadow-sm">⚠️ High Variance Detected</span>
                                <br /><br />
                                The Inventory Integrity Monitor has detected a variance exceeding the 5% threshold:
                            </p>

                            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl border border-red-100/60 dark:border-red-900/30 px-5 py-4 my-5 space-y-2.5 shadow-sm">
                                <div className="flex justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 last:pb-0">
                                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Item</span>
                                    <span className="text-slate-800 dark:text-slate-200 font-bold text-right">Whiskey 750ml<br /><span className="text-slate-400 dark:text-slate-500 font-medium text-[10px]">(Johnnie Walker Black)</span></span>
                                </div>
                                <div className="flex justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 last:pb-0 items-center">
                                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Category</span>
                                    <span className="text-slate-800 dark:text-slate-200 font-bold">Alcohol</span>
                                </div>
                                <div className="flex justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 last:pb-0 items-center">
                                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Variance</span>
                                    <span className="text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-md border border-red-100/50 dark:border-red-500/20">9.1% (₱3,200 loss)</span>
                                </div>
                                <div className="flex justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 last:pb-0 items-center">
                                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Shift</span>
                                    <span className="text-slate-800 dark:text-slate-200 font-medium">Dinner (5:00 PM – 12:00 AM)</span>
                                </div>
                                <div className="flex justify-between text-xs items-center">
                                    <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Detected</span>
                                    <span className="text-slate-800 dark:text-slate-200 font-medium">Mar 27, 2026 · 09:14 PM</span>
                                </div>
                            </div>

                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                Please investigate this variance within 4 hours and update the case in ProcureFlow.
                                <br /><br />
                                <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider font-semibold">— ProcureFlow Integrity Monitor · Automated Alert · Do not reply</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationsTab;
