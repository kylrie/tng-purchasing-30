import React, { useState, useMemo } from 'react';
import { Search, Filter, CheckCircle, XCircle, Printer, ChevronDown } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';
import { RequisitionStatus } from '../types';
import { usePermissions } from '../../../hooks/usePermissions';
import Card from '../../../shared/components/Card';
import RejectionModal from '../../../shared/components/RejectionModal';
import BURFPrintModal from '../components/BURFPrintModal';
import PRFPrintModal from '../components/PRFPrintModal';

interface ProcurementApprovalsViewProps {
    currentUser: User;
    requisitions: Requisition[];
    allUsers: User[];
    businesses: Business[];
    onUpdateRequisition: (req: Requisition) => void;
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
}

export const ProcurementApprovalsView: React.FC<ProcurementApprovalsViewProps> = ({
    currentUser,
    requisitions,
    allUsers,
    businesses,
    onUpdateRequisition,
    getStatusBadge
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [rejectingReq, setRejectingReq] = useState<Requisition | null>(null);
    const [printingReq, setPrintingReq] = useState<Requisition | null>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const { hasPermission } = usePermissions();

    // Determine which statuses the current user is allowed to approve
    const userApprovalStatuses = useMemo(() => {
        const statuses: RequisitionStatus[] = [];

        if (hasPermission('approval:manager:burf')) {
            statuses.push(RequisitionStatus.BURF_PENDING_MANAGER);
        }
        if (hasPermission('approval:cic:burf')) {
            statuses.push(RequisitionStatus.BURF_PENDING_CIC);
        }
        if (hasPermission('approval:manager:prf')) {
            statuses.push(RequisitionStatus.PRF_PENDING_MANAGER);
        }

        return statuses;
    }, [hasPermission]);

    // Determine approved/history statuses
    const approvedStatuses = [
        RequisitionStatus.READY_FOR_PRF,
        RequisitionStatus.APPROVED_FOR_PAYMENT,
        RequisitionStatus.FUNDS_RELEASED,
        RequisitionStatus.LIQUIDATION_FILED,
        RequisitionStatus.AUDITED_CLEARED
    ];

    const filteredRequisitions = useMemo(() => {
        return requisitions.filter(req => {
            // Filter based on active tab
            if (activeTab === 'pending') {
                // Pending tab: show only pending statuses relevant to user
                if (!userApprovalStatuses.includes(req.status)) return false;

                // Filter by Selected Status Dropdown (only for pending tab)
                if (statusFilter !== 'all' && req.status !== statusFilter) return false;
            } else {
                // History tab: show only approved statuses
                if (!approvedStatuses.includes(req.status)) return false;
            }

            // Filter by Business Unit
            const hasGlobal = hasPermission('requisition:view:all');
            if (hasGlobal) {
                if (selectedBusinessUnit !== 'all' && req.businessId !== selectedBusinessUnit) return false;
            } else {
                if (req.businessId !== currentUser.businessId) return false;
            }

            // Search Filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const requester = allUsers.find(u => u.id === req.requesterId)?.name.toLowerCase() || '';
                const business = businesses.find(b => b.id === req.businessId)?.name.toLowerCase() || '';

                return (
                    req.id.toLowerCase().includes(term) ||
                    req.description.toLowerCase().includes(term) ||
                    requester.includes(term) ||
                    business.includes(term)
                );
            }

            return true;
        }).sort((a, b) => {
            // Sort history by date descending
            if (activeTab === 'history') {
                return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
            }
            return 0;
        });
    }, [requisitions, activeTab, userApprovalStatuses, approvedStatuses, statusFilter, selectedBusinessUnit, searchTerm, currentUser, allUsers, businesses, hasPermission]);

    const handleApprove = (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();
        let nextStatus: RequisitionStatus | null = null;

        if (req.status === RequisitionStatus.BURF_PENDING_MANAGER) {
            nextStatus = RequisitionStatus.BURF_PENDING_CIC;
        } else if (req.status === RequisitionStatus.BURF_PENDING_CIC) {
            nextStatus = RequisitionStatus.READY_FOR_PRF;
        } else if (req.status === RequisitionStatus.PRF_PENDING_MANAGER) {
            nextStatus = RequisitionStatus.APPROVED_FOR_PAYMENT;
        }

        if (nextStatus) {
            if (confirm(`Are you sure you want to approve ${req.id}?`)) {
                onUpdateRequisition({ ...req, status: nextStatus });
            }
        }
    };

    const handleRejectClick = (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();
        setRejectingReq(req);
    };

    const handleRejectConfirm = (reason: string) => {
        if (rejectingReq) {
            const newRemarks = rejectingReq.remarks
                ? `${rejectingReq.remarks}\n\n[REJECTED]: ${reason}`
                : `[REJECTED]: ${reason}`;

            onUpdateRequisition({ ...rejectingReq, status: RequisitionStatus.REJECTED, remarks: newRemarks });
            setRejectingReq(null);
        }
    };

    const handlePrintClick = (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();
        setPrintingReq(req);
    };

    return (
        <div className="space-y-6 text-white animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Action Center</h1>
                        <p className="text-slate-400 text-sm">Review pending requests and approval history.</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'pending'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                        >
                            Pending Approvals
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                        >
                            Approval History
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    {/* Business Unit Filter (Global Roles Only) */}
                    {hasPermission('requisition:view:all') && (
                        <div className="relative">
                            <select
                                value={selectedBusinessUnit}
                                onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                                className="appearance-none pl-4 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            >
                                <option value="all">All Business Units</option>
                                {businesses.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    )}

                    {/* Status Filter - Only show for Pending tab */}
                    {activeTab === 'pending' && (
                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="appearance-none pl-4 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            >
                                <option value="all">All Pending Types</option>
                                <option value={RequisitionStatus.BURF_PENDING_MANAGER}>Pending Manager (BURF)</option>
                                <option value={RequisitionStatus.BURF_PENDING_CIC}>Pending CIC (BURF)</option>
                                <option value={RequisitionStatus.PRF_PENDING_MANAGER}>Pending Manager (PRF)</option>
                            </select>
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    )}

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search ID, Desc, User..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm w-64 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                        />
                    </div>
                </div>
            </div>

            <Card className="overflow-hidden !p-0">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Business Unit</th>
                            <th className="px-6 py-4">Requester</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {filteredRequisitions.map(req => {
                            const requester = allUsers.find(u => u.id === req.requesterId);
                            const business = businesses.find(b => b.id === req.businessId);
                            const isPrf = req.id.startsWith('PRF') || req.status === RequisitionStatus.PRF_PENDING_MANAGER;

                            return (
                                <tr key={req.id} className="hover:bg-slate-800/60 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{req.id}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${isPrf ? 'bg-purple-500/20 text-purple-300' : 'bg-orange-500/20 text-orange-300'}`}>
                                            {isPrf ? 'PRF' : 'BURF'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        <div className="truncate max-w-[200px]" title={req.description}>{req.description}</div>
                                        {req.priority === 'URGENT' && <span className="text-[10px] text-orange-400 font-bold block mt-1">URGENT</span>}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-emerald-400">
                                        {business?.currency} {req.totalAmount?.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">{business?.name || 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                                {(requester?.name || '?').charAt(0)}
                                            </div>
                                            <span className="text-slate-300 text-xs">{requester?.name || 'Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">
                                        {new Date(req.dateCreated).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(req.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={(e) => handlePrintClick(req, e)}
                                                className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="View Details / Print"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            {activeTab === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={(e) => handleRejectClick(req, e)}
                                                        className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Reject"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleApprove(req, e)}
                                                        className="p-2 text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
                                                        title="Approve"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredRequisitions.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-slate-500 italic">
                                    {activeTab === 'pending'
                                        ? 'No pending approvals found matching your filters.'
                                        : 'No approved requisitions found matching your filters.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>

            <RejectionModal
                isOpen={!!rejectingReq}
                onClose={() => setRejectingReq(null)}
                onConfirm={handleRejectConfirm}
                title={`Reject ${rejectingReq?.id}`}
            />

            {
                printingReq && (
                    printingReq.id.startsWith('PRF') || printingReq.status.includes('PRF') ? (
                        <PRFPrintModal
                            onClose={() => setPrintingReq(null)}
                            req={printingReq}
                            business={businesses.find(b => b.id === printingReq.businessId)}
                        />
                    ) : (
                        <BURFPrintModal
                            onClose={() => setPrintingReq(null)}
                            req={printingReq}
                            business={businesses.find(b => b.id === printingReq.businessId)}
                            requester={allUsers.find(u => u.id === printingReq.requesterId)}
                        />
                    )
                )
            }
        </div >
    );
};

export default ProcurementApprovalsView;
