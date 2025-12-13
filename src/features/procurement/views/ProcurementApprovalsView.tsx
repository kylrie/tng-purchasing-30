import React, { useState, useMemo, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Printer, ChevronDown } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';
import { RequisitionStatus } from '../types';
import { RequisitionService } from '../services/requisitions.service';
import { usePermissions } from '../../../hooks/usePermissions';
import { SettingsService, type ApproverAssignments } from '../../../shared/services/settings.service';
import Card from '../../../shared/components/Card';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
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
    const [rejectingReq, setRejectingReq] = useState<Requisition | null>(null);
    const [printingReq, setPrintingReq] = useState<Requisition | null>(null);
    const [drawerReq, setDrawerReq] = useState<Requisition | null>(null); // Quick Peek drawer
    const [drawerLoading, setDrawerLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [pendingSubTab, setPendingSubTab] = useState<'burf' | 'cic' | 'prf' | 'gmprf'>('burf');
    const { hasPermission } = usePermissions();

    // Workflow Approver Assignments for GM PRF filtering
    const [approverAssignments, setApproverAssignments] = useState<ApproverAssignments>({});

    // Load approver assignments on mount
    useEffect(() => {
        SettingsService.getApproverAssignments().then(setApproverAssignments);
    }, []);

    // Check if current user is the assigned GM
    const isAssignedGM = currentUser.id === approverAssignments.gmUid;

    // Determine which statuses the current user is allowed to approve
    const userApprovalStatuses = useMemo(() => {
        const statuses: RequisitionStatus[] = [];

        if (hasPermission('approval:manager:burf')) {
            statuses.push(RequisitionStatus.BURF_PENDING_MANAGER);
        }
        if (hasPermission('approval:cic:burf')) {
            statuses.push(RequisitionStatus.BURF_PENDING_CIC);
        }
        // PRF_PENDING_MANAGER now uses designatedApproverId - include for all users who might be designated
        statuses.push(RequisitionStatus.PRF_PENDING_MANAGER);

        // GM PRF Approval (Step 2 for items >= 50k) - only include if user is the assigned GM
        if (isAssignedGM || hasPermission('requisition:view:all')) {
            statuses.push(RequisitionStatus.PENDING_GM_PRF_APPROVAL);
        }

        return statuses;
    }, [hasPermission, isAssignedGM]);

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

                // Note: Sub-tab filtering (BURF/CIC/PRF) is applied after this via displayRequisitions

                // PRF_PENDING_MANAGER: Check based on source type
                if (req.status === RequisitionStatus.PRF_PENDING_MANAGER) {
                    // BURF→PRF conversions: Use BUM role-based approval
                    if (req.parentBurfId) {
                        if (!hasPermission('approval:manager:prf')) return false;
                    } else {
                        // Direct PRF: Use designated approver
                        const isDesignated = req.prfDetails?.designatedApproverId === currentUser.id;
                        const hasGlobalAccess = hasPermission('requisition:view:all');
                        if (!isDesignated && !hasGlobalAccess) {
                            return false;
                        }
                    }
                }
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
            return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
        });
    }, [requisitions, activeTab, userApprovalStatuses, approvedStatuses, selectedBusinessUnit, searchTerm, currentUser, allUsers, businesses, hasPermission]);

    // === SECONDARY TABS: Split pending requisitions into categories ===
    // Tab 1: BURF Approvals (BURF_PENDING_MANAGER only)
    const burfApprovals = useMemo(() =>
        filteredRequisitions.filter(req =>
            req.status === RequisitionStatus.BURF_PENDING_MANAGER &&
            activeTab === 'pending'
        ), [filteredRequisitions, activeTab]);

    // Tab 2: CIC Reviews (Check Prep tasks)
    const cicReviews = useMemo(() =>
        filteredRequisitions.filter(req =>
            req.status === RequisitionStatus.BURF_PENDING_CIC &&
            activeTab === 'pending'
        ), [filteredRequisitions, activeTab]);

    // Tab 3: PRF Approvals (PRF Step 1 - Manager/Designated Approver ONLY)
    const prfApprovals = useMemo(() =>
        filteredRequisitions.filter(req =>
            req.status === RequisitionStatus.PRF_PENDING_MANAGER &&
            activeTab === 'pending'
        ), [filteredRequisitions, activeTab]);

    // Tab 4: GM PRF Approvals (Step 2 - General Manager for items >= 50k)
    const gmPrfApprovals = useMemo(() =>
        filteredRequisitions.filter(req =>
            req.status === RequisitionStatus.PENDING_GM_PRF_APPROVAL &&
            activeTab === 'pending'
        ), [filteredRequisitions, activeTab]);

    // Get current sub-tab's data
    const getActiveSubTabItems = () => {
        switch (pendingSubTab) {
            case 'burf': return burfApprovals;
            case 'cic': return cicReviews;
            case 'prf': return prfApprovals;
            case 'gmprf': return gmPrfApprovals;
            default: return burfApprovals;
        }
    };

    // For display: use filtered items based on sub-tab when in pending mode
    const displayRequisitions = activeTab === 'pending'
        ? getActiveSubTabItems()
        : filteredRequisitions;

    const handleApprove = async (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();

        if (confirm(`Are you sure you want to approve ${req.id}?`)) {
            try {
                await RequisitionService.approveRequisition(
                    req.id,
                    currentUser.id,
                    currentUser.name
                );
            } catch (error: any) {
                console.error("Error approving requisition:", error);
                alert(`Failed to approve requisition: ${error.message || 'Unknown error'}`);
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

    // Drawer approve/reject handlers
    const handleDrawerApprove = async () => {
        if (!drawerReq) return;
        setDrawerLoading(true);
        try {
            await RequisitionService.approveRequisition(
                drawerReq.id,
                currentUser.id,
                currentUser.name
            );
            setDrawerReq(null);
        } catch (error: any) {
            console.error("Error approving requisition:", error);
            alert(`Failed to approve requisition: ${error.message || 'Unknown error'}`);
        } finally {
            setDrawerLoading(false);
        }
    };

    const handleDrawerReject = async () => {
        if (!drawerReq) return;
        const reason = prompt('Please enter a reason for rejection:');
        if (!reason) return;

        setDrawerLoading(true);
        try {
            await RequisitionService.rejectRequisition(
                drawerReq.id,
                currentUser.id,
                currentUser.name,
                reason
            );
            setDrawerReq(null);
        } catch (error: any) {
            console.error("Error rejecting requisition:", error);
            alert(`Failed to reject requisition: ${error.message || 'Unknown error'}`);
        } finally {
            setDrawerLoading(false);
        }
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
                        {hasPermission('approval:view:history') && (
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history'
                                    ? 'bg-purple-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                            >
                                History
                            </button>
                        )}
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

                    {/* Secondary Tabs - Only show for Pending tab */}
                    {activeTab === 'pending' && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPendingSubTab('burf')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingSubTab === 'burf'
                                    ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
                                    }`}
                            >
                                BURF
                                {burfApprovals.length > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingSubTab === 'burf' ? 'bg-orange-500 text-white' : 'bg-slate-600 text-slate-300'
                                        }`}>
                                        {burfApprovals.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setPendingSubTab('cic')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingSubTab === 'cic'
                                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
                                    }`}
                            >
                                CIC
                                {cicReviews.length > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingSubTab === 'cic' ? 'bg-cyan-500 text-white' : 'bg-slate-600 text-slate-300'
                                        }`}>
                                        {cicReviews.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setPendingSubTab('prf')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingSubTab === 'prf'
                                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
                                    }`}
                            >
                                PRF
                                {prfApprovals.length > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingSubTab === 'prf' ? 'bg-purple-500 text-white' : 'bg-slate-600 text-slate-300'
                                        }`}>
                                        {prfApprovals.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setPendingSubTab('gmprf')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingSubTab === 'gmprf'
                                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
                                    }`}
                            >
                                GM PRF
                                {gmPrfApprovals.length > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingSubTab === 'gmprf' ? 'bg-indigo-500 text-white' : 'bg-slate-600 text-slate-300'
                                        }`}>
                                        {gmPrfApprovals.length}
                                    </span>
                                )}
                            </button>
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
                        {displayRequisitions.map(req => {
                            const requester = allUsers.find(u => u.id === req.requesterId);
                            const business = businesses.find(b => b.id === req.businessId);
                            const isPrf = req.id.startsWith('PRF') || req.status === RequisitionStatus.PRF_PENDING_MANAGER;

                            return (
                                <tr
                                    key={req.id}
                                    className="hover:bg-slate-800/60 transition-colors cursor-pointer"
                                    onClick={(e) => {
                                        // Don't open drawer if clicking action buttons
                                        if ((e.target as HTMLElement).closest('button, a')) return;
                                        setDrawerReq(req);
                                    }}
                                >
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

            {/* Quick Peek Drawer */}
            <RequisitionDrawer
                requisition={drawerReq}
                isOpen={!!drawerReq}
                onClose={() => setDrawerReq(null)}
                variant={drawerReq?.id.startsWith('PRF') || drawerReq?.status?.includes('PRF') ? 'PRF' : 'BURF'}
                getStatusBadge={getStatusBadge}
                onApprove={handleDrawerApprove}
                onReject={handleDrawerReject}
                canApprove={activeTab === 'pending' && !!drawerReq && userApprovalStatuses.includes(drawerReq.status)}
                canReject={activeTab === 'pending' && !!drawerReq && userApprovalStatuses.includes(drawerReq.status)}
                isLoading={drawerLoading}
            />
        </div >
    );
};

export default ProcurementApprovalsView;
