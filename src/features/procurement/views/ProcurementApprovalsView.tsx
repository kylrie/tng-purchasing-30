import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, CheckCircle, XCircle, Printer } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';
import { RequisitionStatus, isSuperAdmin } from '../types';
import { RequisitionService } from '../services/requisitions.service';
import { executeWorkflowAction } from '../services/workflowService';
import { usePermissions } from '../../../hooks/usePermissions';
import { SettingsService, type ApproverAssignments } from '../../../shared/services/settings.service';
import Card from '../../../shared/components/Card';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import RejectionModal from '../../../shared/components/RejectionModal';
import BURFPrintModal from '../components/BURFPrintModal';
import PRFPrintModal from '../components/PRFPrintModal';
import SignatureModal from '../../../shared/components/SignatureModal';
import { SignatureService } from '../../../shared/services/signature.service';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';

interface ProcurementApprovalsViewProps {
    currentUser: User;
    requisitions: Requisition[];
    allUsers: User[];
    businesses: Business[];
    onUpdateRequisition: (req: Requisition) => void;
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
}

// Valid sub-tab values
type PendingSubTab = 'burf' | 'cic' | 'prf' | 'gmprf';

export const ProcurementApprovalsView: React.FC<ProcurementApprovalsViewProps> = ({
    currentUser,
    requisitions,
    allUsers,
    businesses,
    getStatusBadge
}) => {
    const [searchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') as PendingSubTab) || 'burf';

    const [searchTerm, setSearchTerm] = useState('');
    const { selectedBusinessUnit } = useBusinessUnit();
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [rejectingReq, setRejectingReq] = useState<Requisition | null>(null);
    const [printingReq, setPrintingReq] = useState<Requisition | null>(null);
    const [drawerReq, setDrawerReq] = useState<Requisition | null>(null); // Quick Peek drawer
    const [drawerLoading, setDrawerLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [pendingSubTab, setPendingSubTab] = useState<PendingSubTab>(initialTab);
    const [signingReq, setSigningReq] = useState<Requisition | null>(null);
    const [signatureLoading, setSignatureLoading] = useState(false);
    const { hasPermission } = usePermissions();

    // Workflow Approver Assignments for GM PRF filtering
    const [approverAssignments, setApproverAssignments] = useState<ApproverAssignments>({});

    // Load approver assignments on mount
    useEffect(() => {
        SettingsService.getApproverAssignments().then(setApproverAssignments);
    }, []);

    // Sync active tab with URL parameters & Deep Linking
    useEffect(() => {
        const tabParam = searchParams.get('tab') as PendingSubTab;
        if (tabParam && ['burf', 'cic', 'prf', 'gmprf'].includes(tabParam)) {
            setPendingSubTab(tabParam);
        }

        // Deep Linking: Check for 'id' parameter
        const idParam = searchParams.get('id');
        if (idParam && !drawerReq) {
            const foundReq = requisitions.find(r => r.id === idParam);
            if (foundReq) {
                setDrawerReq(foundReq);
            }
        }
    }, [searchParams, requisitions, drawerReq]);

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

                // PRF_PENDING_MANAGER: Must be the designated approver or have global access
                if (req.status === RequisitionStatus.PRF_PENDING_MANAGER) {
                    const isDesignated = req.prfDetails?.designatedApproverId === currentUser.id;
                    const hasGlobalAccess = hasPermission('requisition:view:all');
                    const isSuperAdminUser = isSuperAdmin(currentUser.role);
                    if (!isDesignated && !hasGlobalAccess && !isSuperAdminUser) {
                        return false;
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
                // Multi-BU support: check all BUs the user belongs to
                const userBuIds = currentUser.businessUnitIds?.length
                    ? currentUser.businessUnitIds
                    : [currentUser.businessId];
                if (!userBuIds.includes(req.businessId)) return false;
            }

            // Search Filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const requester = allUsers.find(u => u.id === req.requesterId)?.name.toLowerCase() || '';
                const business = businesses.find(b => b.id === req.businessId)?.name.toLowerCase() || '';

                const matchesSearch = (
                    req.id.toLowerCase().includes(term) ||
                    req.description.toLowerCase().includes(term) ||
                    requester.includes(term) ||
                    business.includes(term)
                );

                if (!matchesSearch) return false;
            }

            // Date Filter
            if (dateRange.start && dateRange.end) {
                const reqDate = new Date(req.dateCreated);
                const start = new Date(dateRange.start);
                const end = new Date(dateRange.end);
                // Set end date to end of day
                end.setHours(23, 59, 59, 999);

                if (reqDate < start || reqDate > end) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            // Sort history by date descending
            if (activeTab === 'history') {
                return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
            }
            return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
        });
    }, [requisitions, activeTab, userApprovalStatuses, approvedStatuses, selectedBusinessUnit, searchTerm, currentUser, allUsers, businesses, hasPermission, dateRange]);

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
        // BOD users skip signature modal — approve directly
        if (hasPermission('approval:skip_signature')) {
            try {
                await RequisitionService.approveRequisition(
                    req.id, currentUser.id, currentUser.name, undefined, undefined
                );
            } catch (error: any) {
                console.error('Error approving:', error);
                alert(`Failed to approve: ${error.message}`);
            }
            return;
        }
        setSigningReq(req);
    };

    const handleSignatureConfirm = async (signatureBlob: Blob) => {
        if (!signingReq) return;
        setSignatureLoading(true);
        try {
            const signatureUrl = await SignatureService.uploadSignature(
                signingReq.id,
                currentUser.id,
                signatureBlob
            );
            await RequisitionService.approveRequisition(
                signingReq.id,
                currentUser.id,
                currentUser.name,
                undefined,
                signatureUrl
            );
            setSigningReq(null);
            if (drawerReq?.id === signingReq.id) {
                setDrawerReq(null);
            }
        } catch (error: any) {
            console.error('Error approving requisition:', error);
            alert(`Failed to approve requisition: ${error.message || 'Unknown error'}`);
        } finally {
            setSignatureLoading(false);
        }
    };

    const handleRejectClick = (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();
        setRejectingReq(req);
    };

    const handleRejectConfirm = async (reason: string) => {
        if (rejectingReq) {
            try {
                await RequisitionService.rejectRequisition(
                    rejectingReq.id,
                    currentUser.id,
                    currentUser.name,
                    reason
                );
                setRejectingReq(null);
            } catch (error: any) {
                console.error('Error rejecting requisition:', error);
                alert(`Failed to reject requisition: ${error.message || 'Unknown error'}`);
            }
        }
    };

    const handlePrintClick = (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();
        setPrintingReq(req);
    };

    // Drawer approve/reject handlers
    const handleDrawerApprove = async () => {
        if (!drawerReq) return;
        // BOD users skip signature modal — approve directly
        if (hasPermission('approval:skip_signature')) {
            setDrawerLoading(true);
            try {
                await RequisitionService.approveRequisition(
                    drawerReq.id, currentUser.id, currentUser.name, undefined, undefined
                );
                setDrawerReq(null);
            } catch (error: any) {
                console.error('Error approving:', error);
                alert(`Failed to approve: ${error.message}`);
            } finally {
                setDrawerLoading(false);
            }
            return;
        }
        setSigningReq(drawerReq);
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

    // SuperAdmin Cancel Handler
    const handleDrawerCancel = async () => {
        if (!drawerReq) return;
        if (!confirm(`Are you sure you want to CANCEL ${drawerReq.id}? This action cannot be undone.`)) return;

        setDrawerLoading(true);
        try {
            await executeWorkflowAction({
                requisitionId: drawerReq.id,
                action: 'CANCEL',
                user: {
                    uid: currentUser.id,
                    displayName: currentUser.name,
                    email: currentUser.email
                },
                reason: 'Cancelled by SuperAdmin'
            });
            setDrawerReq(null);
        } catch (error: any) {
            console.error("Error cancelling requisition:", error);
            alert(`Failed to cancel: ${error.message || 'Unknown error'}`);
        } finally {
            setDrawerLoading(false);
        }
    };

    return (
        <div className="space-y-6 text-white animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Action Center</h1>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">Review pending requests and approval history.</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'pending'
                                ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700'
                                }`}
                        >
                            Pending Approvals
                        </button>
                        {hasPermission('approval:view:history') && (
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history'
                                    ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                History
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    {/* Secondary Tabs - Only show for Pending tab, filtered by permission */}
                    {activeTab === 'pending' && (
                        <div className="flex gap-2 flex-wrap">
                            {hasPermission('approval:manager:burf') && (
                                <button
                                    onClick={() => setPendingSubTab('burf')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingSubTab === 'burf'
                                        ? 'bg-orange-100 dark:bg-orange-600/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent'
                                        }`}
                                >
                                    BURF
                                    {burfApprovals.length > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingSubTab === 'burf' ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                            }`}>
                                            {burfApprovals.length}
                                        </span>
                                    )}
                                </button>
                            )}
                            {hasPermission('approval:cic:burf') && (
                                <button
                                    onClick={() => setPendingSubTab('cic')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingSubTab === 'cic'
                                        ? 'bg-cyan-100 dark:bg-cyan-600/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent'
                                        }`}
                                >
                                    CIC
                                    {cicReviews.length > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingSubTab === 'cic' ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                            }`}>
                                            {cicReviews.length}
                                        </span>
                                    )}
                                </button>
                            )}
                            {hasPermission('approval:manager:prf') && (
                                <button
                                    onClick={() => setPendingSubTab('prf')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingSubTab === 'prf'
                                        ? 'bg-purple-100 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent'
                                        }`}
                                >
                                    PRF
                                    {prfApprovals.length > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingSubTab === 'prf' ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                            }`}>
                                            {prfApprovals.length}
                                        </span>
                                    )}
                                </button>
                            )}
                            {isAssignedGM && (
                                <button
                                    onClick={() => setPendingSubTab('gmprf')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingSubTab === 'gmprf'
                                        ? 'bg-indigo-100 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent'
                                        }`}
                                >
                                    GM PRF
                                    {gmPrfApprovals.length > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingSubTab === 'gmprf' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                            }`}>
                                            {gmPrfApprovals.length}
                                        </span>
                                    )}
                                </button>
                            )}
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
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm w-64 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
                        />
                    </div>

                    {/* Date Filter */}
                    <DateRangeFilter
                        onFilterChange={(start, end) => setDateRange({ start, end })}
                    />
                </div>


            </div>

            <Card className="overflow-hidden !p-0 bg-white/80 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-800 dark:text-slate-200">
                        <thead className="bg-slate-50/90 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 backdrop-blur-sm">
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
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {displayRequisitions.map(req => {
                                const requester = allUsers.find(u => u.id === req.requesterId);
                                const business = businesses.find(b => b.id === req.businessId);
                                const isPrf = req.id.startsWith('PRF') || req.status === RequisitionStatus.PRF_PENDING_MANAGER;

                                return (
                                    <tr
                                        key={req.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                                        onClick={(e) => {
                                            // Don't open drawer if clicking action buttons
                                            if ((e.target as HTMLElement).closest('button, a')) return;
                                            setDrawerReq(req);
                                        }}
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{req.id}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${isPrf ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-transparent' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-transparent'}`}>
                                                {isPrf ? 'PRF' : 'BURF'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            <div className="truncate max-w-[200px]" title={req.description}>{req.description}</div>
                                            {req.priority === 'URGENT' && <span className="text-[10px] text-orange-500 dark:text-orange-400 font-bold block mt-1">URGENT</span>}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-emerald-600 dark:text-emerald-400">
                                            {business?.currency} {req.totalAmount?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">{business?.name || 'N/A'}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    {(requester?.name || '?').charAt(0)}
                                                </div>
                                                <span className="text-slate-600 dark:text-slate-300 text-xs">{requester?.name || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                                            {new Date(req.dateCreated).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={(e) => handlePrintClick(req, e)}
                                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                    title="View Details / Print"
                                                >
                                                    <Printer size={18} />
                                                </button>
                                                {activeTab === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={(e) => handleRejectClick(req, e)}
                                                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="Reject"
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleApprove(req, e)}
                                                            className="p-2 text-emerald-600 dark:text-green-400 hover:bg-emerald-100 dark:hover:bg-green-900/20 rounded-lg transition-colors"
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
                            {displayRequisitions.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 italic">
                                        {activeTab === 'pending'
                                            ? 'No pending approvals found matching your filters.'
                                            : 'No approved requisitions found matching your filters.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
                businesses={businesses}
                allUsers={allUsers}
                getStatusBadge={getStatusBadge}
                onApprove={handleDrawerApprove}
                onReject={handleDrawerReject}
                onCancel={handleDrawerCancel}
                canApprove={activeTab === 'pending' && !!drawerReq && (
                    // For PRF_PENDING_MANAGER: Must be the designated approver
                    drawerReq.status === RequisitionStatus.PRF_PENDING_MANAGER
                        ? (
                            drawerReq.prfDetails?.designatedApproverId === currentUser.id ||
                            isSuperAdmin(currentUser.role)
                        )
                        : userApprovalStatuses.includes(drawerReq.status)
                )}
                canReject={activeTab === 'pending' && !!drawerReq && (
                    // For PRF_PENDING_MANAGER: Must be the designated approver
                    drawerReq.status === RequisitionStatus.PRF_PENDING_MANAGER
                        ? (
                            drawerReq.prfDetails?.designatedApproverId === currentUser.id ||
                            isSuperAdmin(currentUser.role)
                        )
                        : userApprovalStatuses.includes(drawerReq.status)
                )}
                canCancel={!!drawerReq && isSuperAdmin(currentUser.role) && drawerReq.status !== RequisitionStatus.CANCELLED}
                isLoading={drawerLoading}
            />

            {/* Signature Modal */}
            <SignatureModal
                isOpen={!!signingReq}
                onClose={() => setSigningReq(null)}
                onConfirm={handleSignatureConfirm}
                title={`Sign to Approve ${signingReq?.id || ''}`}
                isLoading={signatureLoading}
            />
        </div >
    );
};

export default ProcurementApprovalsView;
