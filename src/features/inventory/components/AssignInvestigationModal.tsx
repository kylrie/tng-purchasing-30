import React, { useState } from 'react';
import {
    X,
    AlertTriangle,
    Mail,
    Send,
    ChevronDown,
    Loader2,
} from 'lucide-react';
import { useAuth } from '../../../contexts/useAuth';
import { InvestigationsService } from '../services/investigations.service';
import { UsersService } from '../../../shared/services/users.service';

// ============================================================
// TYPES
// ============================================================

export interface AssignModalData {
    itemId: string;
    itemName: string;
    category: string;
    estimatedLoss: number;
    currentStatus: 'Investigate' | 'Watch';
}

interface AssignInvestigationModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: AssignModalData | null;
}

// ============================================================
// COMPONENT
// ============================================================

const AssignInvestigationModal: React.FC<AssignInvestigationModalProps> = ({ isOpen, onClose, data }) => {
    const { currentUser } = useAuth();
    const [priority, setPriority] = useState<'urgent' | 'watch'>('urgent');
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch live staff options
    const [staffOptions, setStaffOptions] = React.useState<{ id: string; name: string; role: string; }[]>([]);
    const [isLoadingStaff, setIsLoadingStaff] = React.useState(false);

    React.useEffect(() => {
        const fetchStaff = async () => {
            if (!currentUser?.businessId) return;
            setIsLoadingStaff(true);
            try {
                const users = await UsersService.getUsersByBusiness(currentUser.businessId);
                setStaffOptions(users.map(u => ({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    id: (u as any).id || u.email, // fallback to email if uid is missing
                    name: u.name || 'Unknown User',
                    role: u.role || 'Staff'
                })));
            } catch (err) {
                console.error('[AssignModal] Failed to load staff', err);
            } finally {
                setIsLoadingStaff(false);
            }
        };

        if (isOpen) {
            fetchStaff();
        }
    }, [currentUser?.businessId, isOpen]);

    if (!isOpen || !data) return null;

    const selectedStaff = staffOptions.find(s => s.id === assigneeId);

    const handleSubmit = async () => {
        if (!currentUser?.businessId || !selectedStaff) return;
        setIsSubmitting(true);
        try {
            await InvestigationsService.assignInvestigation({
                businessId: currentUser.businessId,
                itemId: data.itemId,
                itemName: data.itemName,
                category: data.category,
                totalLoss: data.estimatedLoss,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                assignee: selectedStaff.name,
                assigneeRole: selectedStaff.role,
                initialNote: notes,
                priority,
            }, currentUser.name);
            onClose();
        } catch (error) {
            console.error('Error assigning investigation:', error);
            alert('Failed to assign investigation. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="relative bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl border border-white dark:border-slate-700/50 rounded-3xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/20 to-white/10 dark:from-slate-800/40 dark:via-slate-800/20 dark:to-transparent pointer-events-none rounded-3xl" />

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 relative z-10 bg-white/40 dark:bg-slate-800/40 rounded-t-3xl">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-900/20 dark:to-rose-900/10 border border-red-200/50 dark:border-red-500/20 flex items-center justify-center shadow-sm">
                                <AlertTriangle size={24} className="text-red-500 dark:text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Assign Investigation</h2>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Route this incident to a team member</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-600/50 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-sm"
                        >
                            <X size={16} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-6 space-y-6 relative z-10 overflow-y-auto">
                        {/* Read-only item info */}
                        <div className="bg-gradient-to-br from-slate-50/80 to-white/50 dark:from-slate-800/60 dark:to-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 dark:from-red-500/10 to-transparent object-cover pointer-events-none" />
                            <div className="flex items-center justify-between relative z-10">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Item / Incident</p>
                                    <p className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">{data.itemName}</p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{data.category}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-500/80 dark:text-red-400/80 mb-1">Estimated Loss</p>
                                    <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-0.5 drop-shadow-sm tracking-tight">
                                        ₱{Math.abs(data.estimatedLoss).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                                Priority
                            </label>
                            <div className="relative group">
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as 'urgent' | 'watch')}
                                    className="w-full appearance-none bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-red-500/10 dark:focus:ring-red-500/20 focus:border-red-300 dark:focus:border-red-500/50 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600 pr-10 cursor-pointer"
                                >
                                    <option className="dark:bg-slate-800" value="urgent">🔴 Urgent — Investigate Now</option>
                                    <option className="dark:bg-slate-800" value="watch">🟡 Watch — Monitor Closely</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
                            </div>
                        </div>

                        {/* Assign To */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                                Assign To
                            </label>
                            <div className="relative group">
                                <select
                                    value={assigneeId}
                                    onChange={(e) => setAssigneeId(e.target.value)}
                                    className="w-full appearance-none bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/50 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600 pr-10 cursor-pointer"
                                    disabled={isLoadingStaff}
                                >
                                    <option className="dark:bg-slate-800" value="">
                                        {isLoadingStaff ? '— Loading staff... —' : '— Select a staff member —'}
                                    </option>
                                    {staffOptions.map((s) => (
                                        <option className="dark:bg-slate-800" key={s.id} value={s.id}>
                                            {s.name} — {s.role}
                                        </option>
                                    ))}
                                </select>
                                {isLoadingStaff ? (
                                    <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 animate-spin pointer-events-none" />
                                ) : (
                                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
                                )}                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                                Notes / Instructions
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder="E.g., Check CCTV footage from 6PM–9PM, verify bar pour count logs..."
                                className="w-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400/80 dark:placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/50 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600 resize-none"
                            />
                        </div>

                        {/* Email Preview */}
                        <div>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Mail size={14} className="text-blue-500 dark:text-blue-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Email Preview</span>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/40 dark:from-blue-900/10 dark:to-indigo-900/5 border border-blue-100/60 dark:border-blue-800/30 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-400 to-indigo-500 dark:from-blue-500 dark:to-indigo-600" />
                                <div className="flex items-center gap-2 relative z-10 pl-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500/80 dark:text-blue-400/80 w-12">To:</span>
                                    <span className="text-xs text-slate-800 dark:text-slate-200 font-bold">
                                        {selectedStaff ? `${selectedStaff.name} <${selectedStaff.name.toLowerCase().replace(' ', '.')}@procureflow.com>` : '(select an assignee)'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 relative z-10 pl-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500/80 dark:text-blue-400/80 w-12">Subject:</span>
                                    <span className="text-xs text-slate-800 dark:text-slate-200 font-bold bg-white/60 dark:bg-slate-800/60 px-2 py-1 rounded-md border border-white dark:border-slate-700 shadow-sm inline-flex items-center">
                                        <span className="mr-1">{priority === 'urgent' ? '🔴' : '🟡'}</span>
                                        [{priority === 'urgent' ? 'URGENT' : 'WATCH'}] Variance Alert — {data.itemName}
                                    </span>
                                </div>
                                <div className="border-t border-blue-200/50 dark:border-blue-800/30 pt-4 mt-4 relative z-10 pl-2">
                                    <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                        Hi {selectedStaff?.name.split(' ')[0] || '___'},
                                        <br /><br />
                                        A variance of <span className="font-bold text-slate-900 dark:text-slate-100 bg-white/60 dark:bg-slate-800/60 px-1.5 py-0.5 rounded shadow-sm border border-white/50 dark:border-slate-700/50">₱{Math.abs(data.estimatedLoss).toLocaleString()}</span> has been detected
                                        for <span className="font-bold text-slate-900 dark:text-slate-100">{data.itemName}</span> ({data.category}) during the current shift.
                                        This has been flagged as <span className="font-bold text-slate-900 dark:text-slate-100 px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-800/60 shadow-sm border border-white/50 dark:border-slate-700/50">{priority === 'urgent' ? 'Urgent' : 'Watch'}</span> priority.
                                        {notes && (
                                            <>
                                                <br /><br />
                                                <span className="font-bold text-slate-900 dark:text-slate-100 px-3 py-2 bg-white/60 dark:bg-slate-800/60 rounded-xl inline-block w-full border border-white dark:border-slate-700 shadow-sm mt-1">
                                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1 font-bold">Instructions:</span>
                                                    {notes}
                                                </span>
                                            </>
                                        )}
                                        <br /><br />
                                        Please investigate and update the case within 4 hours.
                                        <br /><br />
                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">— ProcureFlow Integrity Monitor</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-5 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-end gap-3 relative z-10 rounded-b-3xl">
                        <button
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-200 hover:shadow-sm active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!assigneeId || isSubmitting}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white text-sm font-bold rounded-xl hover:from-black hover:to-slate-900 disabled:opacity-50 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.15)] active:scale-95"
                        >
                            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            {isSubmitting ? 'Assigning...' : 'Assign & Send Notification'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AssignInvestigationModal;
