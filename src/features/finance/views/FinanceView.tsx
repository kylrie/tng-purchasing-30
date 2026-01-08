import React, { useState, useMemo, useEffect } from 'react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus, isSuperAdmin } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import Card from '../../../shared/components/Card';
import ReleaseFundModal from '../components/ReleaseFundModal';
import CheckPrepModal from '../components/CheckPrepModal';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import RejectionModal from '../../../shared/components/RejectionModal';
import { ExternalLink, Search, Wallet, CheckCircle, XCircle, FileText, Printer } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { PCFService, PCFStatus, type PCFLiquidation } from '../services/pcf.service';
import { RequisitionService } from '../../procurement/services/requisitions.service';
import { executeWorkflowAction } from '../../procurement/services/workflowService';
import { SettingsService } from '../../../shared/services/settings.service';
import type { ApproverAssignments } from '../../../shared/services/settings.service';
import PRFPrintModal from '../../procurement/components/PRFPrintModal';

interface FinanceViewProps {
    currentUser: User;
    requisitions: Requisition[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    handleReleaseFunds: (id: string, checkVoucherNumber: string, checkVoucherLink?: string) => void;
    businesses: Business[];
    allUsers: User[];
}

export const FinanceView: React.FC<FinanceViewProps> = ({
    currentUser,
    requisitions,
    getStatusBadge,
    handleReleaseFunds,
    businesses,
    allUsers
}) => {
    const [isReleaseModalOpen, setReleaseModalOpen] = useState(false);
    const [isCheckPrepModalOpen, setCheckPrepModalOpen] = useState(false);
    const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);
    const [activeTab, setActiveTab] = useState<'prf_pending' | 'prf_released' | 'pcf_pending' | 'pcf_released' | 'br_pending' | 'check_prep' | 'check_pending'>('br_pending');
    const [drawerReq, setDrawerReq] = useState<Requisition | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [pcfLiquidations, setPcfLiquidations] = useState<PCFLiquidation[]>([]);
    const [rejectingReq, setRejectingReq] = useState<Requisition | null>(null);
    const [printReq, setPrintReq] = useState<Requisition | null>(null);
    const [selectedBu, setSelectedBu] = useState<string>('all');
    const { hasPermission } = usePermissions();
    const [approverAssignments, setApproverAssignments] = useState<ApproverAssignments>({});

    // Fetch approver assignments for BU-specific checks
    useEffect(() => {
        SettingsService.getApproverAssignments().then(setApproverAssignments);
    }, []);

    // Helper function to filter requisitions by search term and BU
    const applyFilters = (reqs: Requisition[]) => {
        let filtered = reqs;

        // Apply BU filter
        if (selectedBu !== 'all') {
            filtered = filtered.filter(req => req.businessId === selectedBu);
        }

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(req =>
                req.id.toLowerCase().includes(term) ||
                req.description?.toLowerCase().includes(term) ||
                businesses.find(b => b.id === req.businessId)?.name.toLowerCase().includes(term) ||
                allUsers.find(u => u.id === req.requesterId)?.name.toLowerCase().includes(term)
            );
        }

        return filtered;
    };

    // Approve handler for BR and Check Auth items
    const handleApprove = async (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to approve ${req.id}?`)) {
            try {
                await RequisitionService.approveRequisition(
                    req.id,
                    currentUser.id,
                    currentUser.name
                );
            } catch (error: unknown) {
                console.error('Error approving:', error);
                const message = error instanceof Error ? error.message : 'Unknown error';
                alert(`Failed to approve: ${message}`);
            }
        }
    };

    // Reject handler for BR and Check Auth items
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
            } catch (error: unknown) {
                console.error('Error rejecting:', error);
                const message = error instanceof Error ? error.message : 'Unknown error';
                alert(`Failed to reject: ${message}`);
            }
        }
    };

    // Allow Super Admin AND Finance role (or anyone with finance:release_funds implicitly via role check)
    // In types.ts, hasGlobalAccess is strict to Super Admin.
    const canView = hasPermission('module:view:finance');

    if (!canView) {
        return (
            <div className="text-center text-slate-400">You do not have permission to view this page.</div>
        );
    }

    const handleRelease = (req: Requisition) => {
        setSelectedReq(req);
        setReleaseModalOpen(true);
    };

    const confirmRelease = (checkVoucherNumber: string, checkVoucherLink: string) => {
        if (selectedReq) {
            handleReleaseFunds(selectedReq.id, checkVoucherNumber, checkVoucherLink);
            setReleaseModalOpen(false);
            setSelectedReq(null);
            setDrawerReq(null); // Close drawer after release
        }
    };

    // Load PCF liquidations for PCF tabs
    useEffect(() => {
        if ((activeTab === 'pcf_pending' || activeTab === 'pcf_released') && hasPermission('module:view:pcf')) {
            const loadPcfData = async () => {
                const data = await PCFService.getAllLiquidations();
                // Filter to show approved/replenished PCF liquidations
                const pcfData = data.filter(liq =>
                    [PCFStatus.APPROVED, PCFStatus.APPROVED_WAITING_RELEASE, PCFStatus.REPLENISHED].includes(liq.status)
                );
                setPcfLiquidations(pcfData);
            };
            loadPcfData();
        }
    }, [activeTab, hasPermission]);

    // Filter for approved requisitions awaiting fund release
    // Includes both new workflow (FOR_FUND_RELEASE) and legacy (APPROVED_FOR_PAYMENT)
    const pendingReleaseReqs = requisitions.filter(
        req => req.status === RequisitionStatus.FOR_FUND_RELEASE ||
            req.status === RequisitionStatus.APPROVED_FOR_PAYMENT
    );

    // Filter for released requisitions
    const releasedReqs = requisitions.filter(
        req => [
            RequisitionStatus.FUNDS_RELEASED,
            RequisitionStatus.LIQUIDATION_FILED,
            RequisitionStatus.LIQUIDATION_REJECTED,
            RequisitionStatus.AUDITED_CLEARED
        ].includes(req.status)
    ).sort((a, b) => new Date(b.fundReleaseDate || b.timestamp).getTime() - new Date(a.fundReleaseDate || a.timestamp).getTime());

    const displayedReqs = activeTab === 'prf_pending' ? pendingReleaseReqs : releasedReqs;

    // PCF pending vs released
    const pcfPending = pcfLiquidations.filter(liq => liq.status === PCFStatus.APPROVED_WAITING_RELEASE);
    const pcfReleased = pcfLiquidations.filter(liq =>
        [PCFStatus.APPROVED, PCFStatus.REPLENISHED].includes(liq.status)
    );

    // BR (Budget Request) - Finance Head, GM Budget (Steps 3-4)
    // Note: Step 5 (BOD) now feeds into Check Preparation, not directly to Fund Release
    const brPendingReqs = requisitions.filter(req =>
        req.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL ||
        req.status === RequisitionStatus.PENDING_GM_BR_APPROVAL ||
        req.status === RequisitionStatus.PENDING_BOD_APPROVAL || // Step 5: BOD Approval
        req.status === RequisitionStatus.PENDING_CFO_APPROVAL // Legacy support
    );

    // Check Preparation - Finance uploads check (Step 6)
    const checkPrepReqs = requisitions.filter(req =>
        req.status === RequisitionStatus.FOR_CHECK_PREPARATION
    );

    // Check Authorization - BOD Check Auth (Step 7)
    const checkAuthReqs = requisitions.filter(req =>
        req.status === RequisitionStatus.PENDING_CHECK_AUTH_BOD
    );

    // Apply filters to all requisition lists
    const filteredBrPendingReqs = useMemo(() => applyFilters(brPendingReqs), [brPendingReqs, searchTerm, selectedBu, businesses, allUsers]);
    const filteredCheckPrepReqs = useMemo(() => applyFilters(checkPrepReqs), [checkPrepReqs, searchTerm, selectedBu, businesses, allUsers]);
    const filteredCheckAuthReqs = useMemo(() => applyFilters(checkAuthReqs), [checkAuthReqs, searchTerm, selectedBu, businesses, allUsers]);
    const filteredPcfPending = useMemo(() => {
        let filtered = pcfPending;
        if (selectedBu !== 'all') filtered = filtered.filter(liq => liq.businessId === selectedBu);
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(liq =>
                liq.replenishmentPrfId?.toLowerCase().includes(term) ||
                liq.userName?.toLowerCase().includes(term) ||
                businesses.find(b => b.id === liq.businessId)?.name.toLowerCase().includes(term)
            );
        }
        return filtered;
    }, [pcfPending, searchTerm, selectedBu, businesses]);
    const filteredPcfReleased = useMemo(() => {
        let filtered = pcfReleased;
        if (selectedBu !== 'all') filtered = filtered.filter(liq => liq.businessId === selectedBu);
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(liq =>
                liq.replenishmentPrfId?.toLowerCase().includes(term) ||
                liq.userName?.toLowerCase().includes(term) ||
                businesses.find(b => b.id === liq.businessId)?.name.toLowerCase().includes(term)
            );
        }
        return filtered;
    }, [pcfReleased, searchTerm, selectedBu, businesses]);

    // Filter requisitions for PRF tabs (Fund Release)
    const filteredReqs = useMemo(() => {
        return applyFilters(displayedReqs);
    }, [displayedReqs, searchTerm, selectedBu, businesses, allUsers]);

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Finance - Fund Release</h1>
                        <p className="text-slate-400 text-sm">Release funds for approved PRF requisitions.</p>
                    </div>
                    {/* Filters: BU Dropdown + Search Bar */}
                    <div className="flex items-center gap-3">
                        {/* BU Filter Dropdown */}
                        <select
                            value={selectedBu}
                            onChange={(e) => setSelectedBu(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg text-white text-sm py-2 px-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="all">All Business Units</option>
                            {businesses.map(bu => (
                                <option key={bu.id} value={bu.id}>{bu.name}</option>
                            ))}
                        </select>
                        {/* Search Bar */}
                        <div className="relative w-full md:w-72">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by ID, description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex border-b border-slate-700 mb-4 overflow-x-auto">
                    {/* 1. BR (Budget Request) Section - Steps 3-5 */}
                    <div className="flex items-center gap-1 border-r border-slate-600 pr-2 mr-2">
                        <span className="text-xs text-slate-500 px-2">BR</span>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'br_pending'
                                ? 'border-b-2 border-emerald-500 text-emerald-400'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('br_pending')}
                        >
                            Pending ({brPendingReqs.length})
                        </button>
                    </div>
                    {/* 2. Check Preparation Section - Step 6 (Finance uploads check) */}
                    {hasPermission('finance:upload_check') && (
                        <div className="flex items-center gap-1 border-r border-slate-600 pr-2 mr-2">
                            <span className="text-xs text-slate-500 px-2"><FileText size={12} className="inline mr-1" />Check Prep</span>
                            <button
                                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'check_prep'
                                    ? 'border-b-2 border-cyan-500 text-cyan-400'
                                    : 'text-slate-400 hover:text-slate-300'
                                    }`}
                                onClick={() => setActiveTab('check_prep')}
                            >
                                Pending ({checkPrepReqs.length})
                            </button>
                        </div>
                    )}
                    {/* 3. Check Authorization Section - Step 7 (BOD authorizes check) */}
                    <div className="flex items-center gap-1 border-r border-slate-600 pr-2 mr-2">
                        <span className="text-xs text-slate-500 px-2">Check Auth</span>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'check_pending'
                                ? 'border-b-2 border-amber-500 text-amber-400'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('check_pending')}
                        >
                            Pending ({checkAuthReqs.length})
                        </button>
                    </div>
                    {/* 3. PCF Section */}
                    {hasPermission('module:view:pcf') && (
                        <div className="flex items-center gap-1 border-r border-slate-600 pr-2 mr-2">
                            <span className="text-xs text-slate-500 px-2"><Wallet size={12} className="inline mr-1" />PCF</span>
                            <button
                                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'pcf_pending'
                                    ? 'border-b-2 border-orange-500 text-orange-400'
                                    : 'text-slate-400 hover:text-slate-300'
                                    }`}
                                onClick={() => setActiveTab('pcf_pending')}
                            >
                                Pending ({pcfPending.length})
                            </button>
                            <button
                                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'pcf_released'
                                    ? 'border-b-2 border-emerald-500 text-emerald-400'
                                    : 'text-slate-400 hover:text-slate-300'
                                    }`}
                                onClick={() => setActiveTab('pcf_released')}
                            >
                                Released ({pcfReleased.length})
                            </button>
                        </div>
                    )}
                    {/* 4. PRF Fund Release Section */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500 px-2">Fund Release</span>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'prf_pending'
                                ? 'border-b-2 border-purple-500 text-purple-400'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('prf_pending')}
                        >
                            Pending ({pendingReleaseReqs.length})
                        </button>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'prf_released'
                                ? 'border-b-2 border-purple-500 text-purple-400'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('prf_released')}
                        >
                            Released
                        </button>
                    </div>
                </div>

                {/* PRF Content */}
                {(activeTab === 'prf_pending' || activeTab === 'prf_released') && (
                    <Card className="!p-0">
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4">PRF ID</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Requester</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">{activeTab === 'prf_pending' ? 'Date Approved' : 'Date Released'}</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredReqs.map(req => (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('button, a')) return;
                                                setDrawerReq(req);
                                            }}
                                        >
                                            <td className="px-6 py-4 font-medium">{req.id}</td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                <div className="truncate max-w-[200px]" title={req.description}>
                                                    {req.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-emerald-400 font-semibold">
                                                ₱{req.totalAmount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-xs">
                                                {activeTab === 'prf_pending'
                                                    ? new Date(req.dateCreated).toLocaleDateString()
                                                    : (req.fundReleaseDate ? new Date(req.fundReleaseDate).toLocaleDateString() : '-')
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {getStatusBadge(req.status)}
                                                    {(req.isUrgent || req.priority === 'URGENT') && (
                                                        <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded-full uppercase">Urgent</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 items-center">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setPrintReq(req); }}
                                                        className="p-1.5 text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                                                        title="Print Preview"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                    {activeTab === 'prf_pending' && hasPermission('finance:release_funds') && (
                                                        <button
                                                            onClick={() => handleRelease(req)}
                                                            className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 font-medium"
                                                        >
                                                            Release Fund
                                                        </button>
                                                    )}
                                                    {activeTab === 'prf_released' && (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-xs text-slate-400">Cheque: <span className="text-white font-mono">{req.chequeNumber || '-'}</span></span>
                                                            {req.chequeImageUrl && (
                                                                <a
                                                                    href={req.chequeImageUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 underline"
                                                                >
                                                                    <ExternalLink size={10} /> View Cheque
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredReqs.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">
                                                {activeTab === 'prf_pending' ? 'No requisitions pending fund release.' : 'No released funds history found.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
                {/* PCF Pending Content */}
                {activeTab === 'pcf_pending' && (
                    <Card className="!p-0">
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4">PRF Reference</th>
                                        <th className="px-6 py-4">Custodian</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Date Approved</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredPcfPending.map(liq => {
                                        // Find the linked PRF for this PCF to enable release action
                                        const linkedPrf = requisitions.find(r => r.id === liq.replenishmentPrfId);
                                        return (
                                            <tr
                                                key={liq.id}
                                                className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).closest('button')) return;
                                                    if (linkedPrf) setDrawerReq(linkedPrf);
                                                }}
                                            >
                                                <td className="px-6 py-4 font-medium font-mono text-cyan-400">
                                                    {liq.replenishmentPrfId || liq.id?.substring(0, 8)}
                                                </td>
                                                <td className="px-6 py-4 text-white">{liq.userName}</td>
                                                <td className="px-6 py-4 text-slate-300">
                                                    {businesses.find(b => b.id === liq.businessId)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-400 font-semibold">
                                                    ₱{liq.totalAmount?.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-600/20 text-orange-400">
                                                        PENDING RELEASE
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {liq.dateApproved ? new Date(liq.dateApproved).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {hasPermission('finance:release_funds') && linkedPrf ? (
                                                        <button
                                                            onClick={() => handleRelease(linkedPrf)}
                                                            className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 font-medium"
                                                        >
                                                            Release Fund
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-500 text-xs">
                                                            {linkedPrf ? 'No permission' : 'No PRF linked'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredPcfPending.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                                                No PCF pending release.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {/* PCF Released Content */}
                {activeTab === 'pcf_released' && (
                    <Card className="!p-0">
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4">PRF Reference</th>
                                        <th className="px-6 py-4">Custodian</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Created</th>
                                        <th className="px-6 py-4">Approved</th>
                                        <th className="px-6 py-4">Released</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredPcfReleased.map(liq => {
                                        const linkedPrf = requisitions.find(r => r.id === liq.replenishmentPrfId);
                                        return (
                                            <tr
                                                key={liq.id}
                                                className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    if (linkedPrf) setDrawerReq(linkedPrf);
                                                }}
                                            >
                                                <td className="px-6 py-4 font-medium font-mono text-cyan-400">
                                                    {liq.replenishmentPrfId || liq.id?.substring(0, 8)}
                                                </td>
                                                <td className="px-6 py-4 text-white">{liq.userName}</td>
                                                <td className="px-6 py-4 text-slate-300">
                                                    {businesses.find(b => b.id === liq.businessId)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-400 font-semibold">
                                                    ₱{liq.totalAmount?.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${liq.status === PCFStatus.REPLENISHED
                                                        ? 'bg-emerald-600/20 text-emerald-400'
                                                        : 'bg-green-600/20 text-green-400'
                                                        }`}>
                                                        {liq.status.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {liq.dateCreated ? new Date(liq.dateCreated).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {liq.dateApproved ? new Date(liq.dateApproved).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-400 text-xs">
                                                    {linkedPrf?.fundReleaseDate ? new Date(linkedPrf.fundReleaseDate).toLocaleDateString() : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredPcfReleased.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                                                No PCF releases found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {/* BR Content - Budget Request Approvals */}
                {activeTab === 'br_pending' && (
                    <Card className="!p-0">
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4">PRF ID</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Requester</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Date Created</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredBrPendingReqs.map(req => (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            onClick={() => setDrawerReq(req)}
                                        >
                                            <td className="px-6 py-4 font-medium">{req.id}</td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                <div className="truncate max-w-[200px]" title={req.description}>
                                                    {req.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-emerald-400 font-semibold">
                                                ₱{req.totalAmount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-xs">
                                                {new Date(req.dateCreated).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(req.status)}
                                            </td>
                                            <td className="px-6 py-4">
                                                {/* Role-based action visibility: Only show actions if user can approve this status */}
                                                {(() => {
                                                    // Determine if current user can approve based on the item's current status AND assignment
                                                    const canApproveThisStatus =
                                                        // Finance Head: Check if assigned for this BU
                                                        (req.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL &&
                                                            hasPermission('approval:finance_head:br') &&
                                                            approverAssignments.financeHeads?.some(fh =>
                                                                fh.userId === currentUser.id &&
                                                                fh.businessUnitIds.includes(req.businessId)
                                                            )
                                                        ) ||
                                                        // GM: Check if assigned as GM
                                                        (req.status === RequisitionStatus.PENDING_GM_BR_APPROVAL &&
                                                            hasPermission('approval:gm:br') &&
                                                            currentUser.id === approverAssignments.gmUid
                                                        ) ||
                                                        // BOD: Check if assigned as BOD approver
                                                        (req.status === RequisitionStatus.PENDING_BOD_APPROVAL &&
                                                            hasPermission('approval:bod') &&
                                                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                                                        ) ||
                                                        // CFO: Check if assigned as CFO
                                                        (req.status === RequisitionStatus.PENDING_CFO_APPROVAL &&
                                                            hasPermission('approval:cfo') &&
                                                            currentUser.id === approverAssignments.cfoUid
                                                        ) ||
                                                        // SuperAdmin can always approve
                                                        isSuperAdmin(currentUser.role);

                                                    if (canApproveThisStatus) {
                                                        return (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={(e) => handleApprove(req, e)}
                                                                    className="p-2 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                                                                    title="Approve"
                                                                >
                                                                    <CheckCircle size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleRejectClick(req, e)}
                                                                    className="p-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                                                                    title="Reject"
                                                                >
                                                                    <XCircle size={18} />
                                                                </button>
                                                            </div>
                                                        );
                                                    } else {
                                                        // Show the required approver role for transparency
                                                        const requiredRole =
                                                            req.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL ? 'Finance Head' :
                                                                req.status === RequisitionStatus.PENDING_GM_BR_APPROVAL ? 'GM' :
                                                                    req.status === RequisitionStatus.PENDING_BOD_APPROVAL ? 'BOD' :
                                                                        req.status === RequisitionStatus.PENDING_CFO_APPROVAL ? 'CFO' : 'Unknown';
                                                        return (
                                                            <span className="text-slate-500 text-xs italic">
                                                                Awaiting {requiredRole}
                                                            </span>
                                                        );
                                                    }
                                                })()}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredBrPendingReqs.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">
                                                No pending Budget Request approvals found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {/* Check Preparation Content - Finance uploads check */}
                {activeTab === 'check_prep' && (
                    <Card className="!p-0">
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4">PRF ID</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Requester</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Date Created</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredCheckPrepReqs.map(req => (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('button')) return;
                                                setDrawerReq(req);
                                            }}
                                        >
                                            <td className="px-6 py-4 font-medium">{req.id}</td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                <div className="truncate max-w-[200px]" title={req.description}>
                                                    {req.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-emerald-400 font-semibold">
                                                ₱{req.totalAmount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-xs">
                                                {new Date(req.dateCreated).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(req.status)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {hasPermission('finance:upload_check') ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedReq(req);
                                                            setCheckPrepModalOpen(true);
                                                        }}
                                                        className="bg-cyan-600 text-white px-3 py-1 rounded text-xs hover:bg-cyan-700 font-medium flex items-center gap-1 ml-auto"
                                                    >
                                                        <FileText size={14} />
                                                        Upload Check
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-500 text-xs italic">No permission</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredCheckPrepReqs.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">
                                                No requisitions pending check preparation.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {/* Check Authorization Content - BOD Approval */}
                {activeTab === 'check_pending' && (
                    <Card className="!p-0">
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4">PRF ID</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Requester</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Ref #</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredCheckAuthReqs.map(req => (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            onClick={() => setDrawerReq(req)}
                                        >
                                            <td className="px-6 py-4 font-medium">{req.id}</td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                <div className="truncate max-w-[200px]" title={req.description}>
                                                    {req.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-emerald-400 font-semibold">
                                                ₱{req.totalAmount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-white font-mono">{req.chequeNumber || '-'}</span>
                                                    {req.chequeImageUrl && (
                                                        <a
                                                            href={req.chequeImageUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <ExternalLink size={10} /> View
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(req.status)}
                                            </td>
                                            <td className="px-6 py-4">
                                                {/* BOD Check Authorization - must be assigned BOD approver */}
                                                {(approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id) || isSuperAdmin(currentUser.role)) ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={(e) => handleApprove(req, e)}
                                                            className="p-2 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                                                            title="Authorize Check"
                                                        >
                                                            <CheckCircle size={18} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRejectClick(req, e)}
                                                            className="p-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                                                            title="Reject"
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-xs italic">BOD Only</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredCheckAuthReqs.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">
                                                No pending Check Authorization items found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
            {selectedReq && (
                <ReleaseFundModal
                    isOpen={isReleaseModalOpen}
                    onClose={() => setReleaseModalOpen(false)}
                    onConfirm={confirmRelease}
                    requisition={selectedReq}
                />
            )}

            {/* Quick Peek Drawer */}
            <RequisitionDrawer
                requisition={drawerReq}
                isOpen={!!drawerReq}
                onClose={() => setDrawerReq(null)}
                variant="FINANCE"
                businesses={businesses}
                allUsers={allUsers}
                getStatusBadge={getStatusBadge}
                onReleaseFund={() => {
                    if (drawerReq) {
                        handleRelease(drawerReq);
                    }
                }}
                canReleaseFund={activeTab === 'prf_pending' && hasPermission('finance:release_funds')}
                onApprove={async () => {
                    if (drawerReq && confirm(`Are you sure you want to approve ${drawerReq.id}?`)) {
                        try {
                            await RequisitionService.approveRequisition(
                                drawerReq.id,
                                currentUser.id,
                                currentUser.name
                            );
                            setDrawerReq(null);
                        } catch (error: unknown) {
                            console.error('Error approving:', error);
                            const message = error instanceof Error ? error.message : 'Unknown error';
                            alert(`Failed to approve: ${message}`);
                        }
                    }
                }}
                onReject={() => {
                    if (drawerReq) {
                        setRejectingReq(drawerReq);
                        setDrawerReq(null);
                    }
                }}
                onCancel={async () => {
                    if (drawerReq && confirm(`Are you sure you want to CANCEL ${drawerReq.id}? This action cannot be undone.`)) {
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
                        } catch (error: unknown) {
                            console.error('Error cancelling:', error);
                            const message = error instanceof Error ? error.message : 'Unknown error';
                            alert(`Failed to cancel: ${message}`);
                        }
                    }
                }}
                canApprove={
                    !!drawerReq && (
                        // Finance Head: Check if assigned for this BU
                        (drawerReq.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL &&
                            hasPermission('approval:finance_head:br') &&
                            approverAssignments.financeHeads?.some(fh =>
                                fh.userId === currentUser.id &&
                                fh.businessUnitIds.includes(drawerReq.businessId)
                            )
                        ) ||
                        // GM: Check if assigned as GM
                        (drawerReq.status === RequisitionStatus.PENDING_GM_BR_APPROVAL &&
                            hasPermission('approval:gm:br') &&
                            currentUser.id === approverAssignments.gmUid
                        ) ||
                        // CFO: Check if assigned as CFO
                        (drawerReq.status === RequisitionStatus.PENDING_CFO_APPROVAL &&
                            hasPermission('approval:cfo') &&
                            currentUser.id === approverAssignments.cfoUid
                        ) ||
                        // BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_BOD_APPROVAL &&
                            hasPermission('approval:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // Check Auth BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_CHECK_AUTH_BOD &&
                            hasPermission('approval:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // SuperAdmin can always approve
                        isSuperAdmin(currentUser.role)
                    )
                }
                canReject={
                    !!drawerReq && (
                        // Finance Head: Check if assigned for this BU
                        (drawerReq.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL &&
                            hasPermission('approval:finance_head:br') &&
                            approverAssignments.financeHeads?.some(fh =>
                                fh.userId === currentUser.id &&
                                fh.businessUnitIds.includes(drawerReq.businessId)
                            )
                        ) ||
                        // GM: Check if assigned as GM
                        (drawerReq.status === RequisitionStatus.PENDING_GM_BR_APPROVAL &&
                            hasPermission('approval:gm:br') &&
                            currentUser.id === approverAssignments.gmUid
                        ) ||
                        // CFO: Check if assigned as CFO
                        (drawerReq.status === RequisitionStatus.PENDING_CFO_APPROVAL &&
                            hasPermission('approval:cfo') &&
                            currentUser.id === approverAssignments.cfoUid
                        ) ||
                        // BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_BOD_APPROVAL &&
                            hasPermission('approval:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // Check Auth BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_CHECK_AUTH_BOD &&
                            hasPermission('approval:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // SuperAdmin can always reject
                        isSuperAdmin(currentUser.role)
                    )
                }
                canCancel={!!drawerReq && isSuperAdmin(currentUser.role) && drawerReq.status !== RequisitionStatus.CANCELLED}
                onPrint={() => {
                    if (drawerReq) {
                        setPrintReq(drawerReq);
                        setDrawerReq(null); // Close drawer when opening print modal
                    }
                }}
            />

            {/* Rejection Modal for BR and Check Auth */}
            <RejectionModal
                isOpen={!!rejectingReq}
                onClose={() => setRejectingReq(null)}
                onConfirm={handleRejectConfirm}
                title={`Reject ${rejectingReq?.id || 'Request'}`}
            />

            {/* Check Preparation Modal (Bank Reference Entry) */}
            {selectedReq && (
                <CheckPrepModal
                    isOpen={isCheckPrepModalOpen}
                    onClose={() => {
                        setCheckPrepModalOpen(false);
                        setSelectedReq(null);
                    }}
                    onConfirm={async (bankRefNumber, bankRefLink) => {
                        try {
                            await RequisitionService.uploadCheckForPreparation(
                                selectedReq.id,
                                bankRefNumber,
                                bankRefLink,
                                currentUser.id,
                                currentUser.name
                            );
                            setCheckPrepModalOpen(false);
                            setSelectedReq(null);
                        } catch (error: unknown) {
                            console.error('Error saving bank reference:', error);
                            const message = error instanceof Error ? error.message : 'Unknown error';
                            alert(`Failed to save bank reference: ${message}`);
                        }
                    }}
                    requisition={selectedReq}
                />
            )}

            {/* Print Modal - Always use PRFPrintModal since Finance handles PRFs */}
            {printReq && (
                <PRFPrintModal
                    req={printReq}
                    onClose={() => setPrintReq(null)}
                    business={businesses.find(b => b.id === printReq.businessId)}
                    preparedBy={allUsers.find(u => u.id === printReq.prfDetails?.preparedBy)}
                />
            )}
        </>
    );
};

export default FinanceView;
