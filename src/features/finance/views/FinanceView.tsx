import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus, isSuperAdmin } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import Card from '../../../shared/components/Card';
import ReleaseFundModal from '../components/ReleaseFundModal';
import CheckPrepModal from '../components/CheckPrepModal';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import RejectionModal from '../../../shared/components/RejectionModal';
import { ExternalLink, Search, Wallet, CheckCircle, XCircle, FileText, Printer, Download } from 'lucide-react';
import { exportToCSV, formatDateForExport, formatCurrencyForExport, type ExportColumn } from '../../../shared/utils/exportUtils';
import { usePermissions } from '../../../hooks/usePermissions';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';
import { PCFService, PCFStatus, type PCFLiquidation } from '../services/pcf.service';
import { RequisitionService } from '../../procurement/services/requisitions.service';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { executeWorkflowAction } from '../../procurement/services/workflowService';
import { SettingsService } from '../../../shared/services/settings.service';
import type { ApproverAssignments } from '../../../shared/services/settings.service';
import PRFPrintModal from '../../procurement/components/PRFPrintModal';
import SignatureModal from '../../../shared/components/SignatureModal';
import { SignatureService } from '../../../shared/services/signature.service';

interface FinanceViewProps {
    currentUser: User;
    requisitions: Requisition[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    handleReleaseFunds: (id: string, checkVoucherNumber: string, checkVoucherLink?: string, coaCode?: string) => void;
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
    const [searchParams] = useSearchParams();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initialTab = (searchParams.get('tab') as any) || 'br_pending';

    const [isReleaseModalOpen, setReleaseModalOpen] = useState(false);
    const [isCheckPrepModalOpen, setCheckPrepModalOpen] = useState(false);
    const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);
    const [activeTab, setActiveTab] = useState<'prf_pending' | 'prf_released' | 'pcf_pending' | 'pcf_released' | 'br_pending' | 'check_prep' | 'check_pending'>(initialTab);
    const [drawerReq, setDrawerReq] = useState<Requisition | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [pcfLiquidations, setPcfLiquidations] = useState<PCFLiquidation[]>([]);
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [rejectingReq, setRejectingReq] = useState<Requisition | null>(null);
    const [printReq, setPrintReq] = useState<Requisition | null>(null);
    const { selectedBusinessUnit } = useBusinessUnit(); // Global BU context
    const { hasPermission } = usePermissions();
    const [approverAssignments, setApproverAssignments] = useState<ApproverAssignments>({});
    const [signingReq, setSigningReq] = useState<Requisition | null>(null);
    const [signatureLoading, setSignatureLoading] = useState(false);

    // Fetch approver assignments for BU-specific checks
    useEffect(() => {
        SettingsService.getApproverAssignments().then(setApproverAssignments);
    }, []);

    // Helper function to filter requisitions by search term and BU
    const applyFilters = useCallback((reqs: Requisition[]) => {
        let filtered = reqs;

        // Apply BU filter using global context
        if (selectedBusinessUnit !== 'all') {
            filtered = filtered.filter(req => req.businessId === selectedBusinessUnit);
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

        // Date Filter
        if (dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);

            filtered = filtered.filter(req => {
                const reqDate = new Date(req.dateCreated);
                return reqDate >= start && reqDate <= end;
            });
        }

        return filtered;
    }, [selectedBusinessUnit, searchTerm, dateRange, businesses, allUsers]);

    // Approve handler for BR and Check Auth items
    const handleApprove = async (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();
        // BOD users skip signature modal — approve directly
        if (hasPermission('procurement:approval:approve:skip_signature')) {
            try {
                await RequisitionService.approveRequisition(
                    req.id, currentUser.id, currentUser.name, undefined, undefined
                );
                if (drawerReq?.id === req.id) setDrawerReq(null);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error approving:', error);
                alert(`Failed to approve: ${message}`);
            }
            return;
        }
        setSigningReq(req);
    };

    const handleSignatureConfirm = async (signatureBlob: Blob) => {
        if (signatureLoading || !signingReq) return;
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
            if (drawerReq?.id === signingReq.id) setDrawerReq(null);
        } catch (error: unknown) {
            console.error('Error approving:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to approve: ${message}`);
        } finally {
            setSignatureLoading(false);
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


    const handleRelease = (req: Requisition) => {
        setSelectedReq(req);
        setReleaseModalOpen(true);
    };

    const confirmRelease = (checkVoucherNumber: string, checkVoucherLink: string, coaCode: string) => {
        if (selectedReq) {
            handleReleaseFunds(selectedReq.id, checkVoucherNumber, checkVoucherLink, coaCode);
            setReleaseModalOpen(false);
            setSelectedReq(null);
            setDrawerReq(null); // Close drawer after release
        }
    };

    // Load PCF liquidations for PCF tabs
    useEffect(() => {
        if ((activeTab === 'pcf_pending' || activeTab === 'pcf_released') && hasPermission('ui:module_access:view:pcf')) {
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
    const filteredBrPendingReqs = useMemo(() => applyFilters(brPendingReqs), [brPendingReqs, applyFilters]);
    const filteredCheckPrepReqs = useMemo(() => applyFilters(checkPrepReqs), [checkPrepReqs, applyFilters]);
    const filteredCheckAuthReqs = useMemo(() => applyFilters(checkAuthReqs), [checkAuthReqs, applyFilters]);
    const filteredPcfPending = useMemo(() => {
        let filtered = pcfPending;
        if (selectedBusinessUnit !== 'all') filtered = filtered.filter(liq => liq.businessId === selectedBusinessUnit);
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(liq =>
                liq.replenishmentPrfId?.toLowerCase().includes(term) ||
                liq.userName?.toLowerCase().includes(term) ||
                businesses.find(b => b.id === liq.businessId)?.name.toLowerCase().includes(term)
            );
        }
        if (dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(liq => {
                const liqDate = new Date(liq.dateCreated || new Date());
                return liqDate >= start && liqDate <= end;
            });
        }
        return filtered;
    }, [pcfPending, searchTerm, selectedBusinessUnit, businesses, dateRange]);
    const filteredPcfReleased = useMemo(() => {
        let filtered = pcfReleased;
        if (selectedBusinessUnit !== 'all') filtered = filtered.filter(liq => liq.businessId === selectedBusinessUnit);
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(liq =>
                liq.replenishmentPrfId?.toLowerCase().includes(term) ||
                liq.userName?.toLowerCase().includes(term) ||
                businesses.find(b => b.id === liq.businessId)?.name.toLowerCase().includes(term)
            );
        }
        if (dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(liq => {
                const liqDate = new Date(liq.dateCreated || new Date());
                return liqDate >= start && liqDate <= end;
            });
        }
        return filtered;
    }, [pcfReleased, searchTerm, selectedBusinessUnit, businesses, dateRange]);

    // Filter requisitions for PRF tabs (Fund Release)
    const filteredReqs = useMemo(() => {
        return applyFilters(displayedReqs);
    }, [displayedReqs, applyFilters]);

    // Export handler for current tab's filtered data
    const handleExport = () => {
        const tabFilenames: Record<string, string> = {
            br_pending: 'br_pending_export',
            check_prep: 'check_prep_export',
            check_pending: 'check_auth_export',
            pcf_pending: 'pcf_pending_export',
            pcf_released: 'pcf_released_export',
            prf_pending: 'prf_pending_export',
            prf_released: 'prf_released_export',
        };

        // PRF/BR requisition columns
        const reqColumns: ExportColumn<Requisition>[] = [
            { header: 'PRF ID', accessor: (req) => req.id },
            { header: 'Business Unit', accessor: (req) => businesses.find(b => b.id === req.businessId)?.name || 'N/A' },
            { header: 'Requester', accessor: (req) => allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId },
            { header: 'Description', accessor: (req) => req.description || '' },
            { header: 'Supplier', accessor: (req) => req.prfDetails?.supplier?.name || '' },
            { header: 'Amount', accessor: (req) => formatCurrencyForExport(req.totalAmount) },
            { header: 'Date Created', accessor: (req) => formatDateForExport(req.dateCreated) },
            { header: 'Status', accessor: (req) => req.status },
        ];

        // PCF liquidation columns
        const pcfColumns: ExportColumn<PCFLiquidation>[] = [
            { header: 'PRF Reference', accessor: (liq) => liq.replenishmentPrfId || liq.id?.substring(0, 8) || '' },
            { header: 'Custodian', accessor: (liq) => liq.userName || '' },
            { header: 'Business Unit', accessor: (liq) => businesses.find(b => b.id === liq.businessId)?.name || 'N/A' },
            { header: 'Amount', accessor: (liq) => formatCurrencyForExport(liq.totalAmount) },
            { header: 'Status', accessor: (liq) => liq.status },
            { header: 'Date Created', accessor: (liq) => formatDateForExport(liq.dateCreated) },
            { header: 'Date Approved', accessor: (liq) => formatDateForExport(liq.dateApproved) },
        ];

        const filename = tabFilenames[activeTab] || 'export';

        if (activeTab === 'pcf_pending') {
            exportToCSV(filteredPcfPending, pcfColumns, filename);
        } else if (activeTab === 'pcf_released') {
            exportToCSV(filteredPcfReleased, pcfColumns, filename);
        } else if (activeTab === 'br_pending') {
            exportToCSV(filteredBrPendingReqs, reqColumns, filename);
        } else if (activeTab === 'check_prep') {
            exportToCSV(filteredCheckPrepReqs, reqColumns, filename);
        } else if (activeTab === 'check_pending') {
            exportToCSV(filteredCheckAuthReqs, reqColumns, filename);
        } else {
            // PRF pending/released
            exportToCSV(filteredReqs, reqColumns, filename);
        }
    };

    const canView = hasPermission('ui:module_access:view:br');

    if (!canView) {
        return (
            <div className="text-center text-slate-500 dark:text-slate-400">You do not have permission to view this page.</div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finance - Fund Release</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Release funds for approved PRF requisitions.</p>
                    </div>
                    {/* Filters: Search Bar + Date (BU handled by global header) */}
                    <div className="flex items-center gap-3">
                        <DateRangeFilter
                            onFilterChange={(start, end) => setDateRange({ start, end })}
                        />
                        {/* Search Bar */}
                        <div className="relative w-full md:w-72">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by ID, description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            />
                        </div>
                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
                            title="Export to CSV"
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4 overflow-x-auto">
                    {/* 1. BR (Budget Request) Section - Steps 3-5 */}
                    <div className="flex items-center gap-1 border-r border-slate-300 dark:border-slate-600 pr-2 mr-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400 px-2">BR</span>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'br_pending'
                                ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('br_pending')}
                        >
                            Pending ({filteredBrPendingReqs.length})
                        </button>
                    </div>
                    {/* 2. Check Preparation Section - Step 6 (Finance uploads check) */}
                    {hasPermission('finance:cheque:upload') && (
                        <div className="flex items-center gap-1 border-r border-slate-300 dark:border-slate-600 pr-2 mr-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 px-2"><FileText size={12} className="inline mr-1" />Check Prep</span>
                            <button
                                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'check_prep'
                                    ? 'border-b-2 border-cyan-500 text-cyan-600 dark:text-cyan-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                                    }`}
                                onClick={() => setActiveTab('check_prep')}
                            >
                                Pending ({filteredCheckPrepReqs.length})
                            </button>
                        </div>
                    )}
                    {/* 3. Check Authorization Section - Step 7 (BOD authorizes check) */}
                    <div className="flex items-center gap-1 border-r border-slate-300 dark:border-slate-600 pr-2 mr-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400 px-2">Check Auth</span>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'check_pending'
                                ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('check_pending')}
                        >
                            Pending ({filteredCheckAuthReqs.length})
                        </button>
                    </div>
                    {/* 3. PCF Section */}
                    {hasPermission('ui:module_access:view:pcf') && (
                        <div className="flex items-center gap-1 border-r border-slate-300 dark:border-slate-600 pr-2 mr-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 px-2"><Wallet size={12} className="inline mr-1" />PCF</span>
                            <button
                                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'pcf_pending'
                                    ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                                    }`}
                                onClick={() => setActiveTab('pcf_pending')}
                            >
                                Pending ({filteredPcfPending.length})
                            </button>
                            <button
                                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'pcf_released'
                                    ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                                    }`}
                                onClick={() => setActiveTab('pcf_released')}
                            >
                                Released ({filteredPcfReleased.length})
                            </button>
                        </div>
                    )}
                    {/* 4. PRF Fund Release Section */}
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 px-2">Fund Release</span>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'prf_pending'
                                ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('prf_pending')}
                        >
                            Pending ({filteredReqs.length})
                        </button>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'prf_released'
                                ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
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
                            <table className="w-full text-left text-sm text-slate-900 dark:text-white">
                                <thead className="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
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
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredReqs.map(req => (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('button, a')) return;
                                                setDrawerReq(req);
                                            }}
                                        >
                                            <td className="px-6 py-4 font-medium">{req.id}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                <div className="truncate max-w-[200px]" title={req.description}>
                                                    {req.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                                                ₱{req.totalAmount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
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
                                                    {activeTab === 'prf_pending' && hasPermission('finance:cheque:release') && (
                                                        <button
                                                            onClick={() => handleRelease(req)}
                                                            className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 font-medium"
                                                        >
                                                            Release Fund
                                                        </button>
                                                    )}
                                                    {activeTab === 'prf_released' && (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-xs text-slate-500 dark:text-slate-400">Cheque: <span className="text-slate-900 dark:text-white font-mono">{req.chequeNumber || '-'}</span></span>
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
                            <table className="w-full text-left text-sm text-slate-900 dark:text-white">
                                <thead className="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
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
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredPcfPending.map(liq => {
                                        // Find the linked PRF for this PCF to enable release action
                                        const linkedPrf = requisitions.find(r => r.id === liq.replenishmentPrfId);
                                        return (
                                            <tr
                                                key={liq.id}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).closest('button')) return;
                                                    if (linkedPrf) setDrawerReq(linkedPrf);
                                                }}
                                            >
                                                <td className="px-6 py-4 font-medium font-mono text-cyan-600 dark:text-cyan-400">
                                                    {liq.replenishmentPrfId || liq.id?.substring(0, 8)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-900 dark:text-white">{liq.userName}</td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                    {businesses.find(b => b.id === liq.businessId)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                                                    ₱{liq.totalAmount?.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-600/20 text-orange-400">
                                                        PENDING RELEASE
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                                                    {liq.dateApproved ? new Date(liq.dateApproved).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {(() => {
                                                        const isReadyForRelease = linkedPrf &&
                                                            (linkedPrf.status === RequisitionStatus.FOR_FUND_RELEASE ||
                                                                linkedPrf.status === RequisitionStatus.APPROVED_FOR_PAYMENT);

                                                        if (hasPermission('finance:cheque:release') && isReadyForRelease) {
                                                            return (
                                                                <button
                                                                    onClick={() => handleRelease(linkedPrf!)}
                                                                    className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 font-medium"
                                                                >
                                                                    Release Fund
                                                                </button>
                                                            );
                                                        } else if (linkedPrf) {
                                                            return (
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Waiting PRF Approval</span>
                                                                    {getStatusBadge(linkedPrf.status)}
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <span className="text-slate-500 text-xs text-right block">
                                                                    No PRF linked
                                                                </span>
                                                            );
                                                        }
                                                    })()}
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
                            <table className="w-full text-left text-sm text-slate-900 dark:text-white">
                                <thead className="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
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
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredPcfReleased.map(liq => {
                                        const linkedPrf = requisitions.find(r => r.id === liq.replenishmentPrfId);
                                        return (
                                            <tr
                                                key={liq.id}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    if (linkedPrf) setDrawerReq(linkedPrf);
                                                }}
                                            >
                                                <td className="px-6 py-4 font-medium font-mono text-cyan-600 dark:text-cyan-400">
                                                    {liq.replenishmentPrfId || liq.id?.substring(0, 8)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-900 dark:text-white">{liq.userName}</td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                    {businesses.find(b => b.id === liq.businessId)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">
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
                                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                                                    {liq.dateCreated ? new Date(liq.dateCreated).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                                                    {liq.dateApproved ? new Date(liq.dateApproved).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 text-xs">
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
                            <table className="w-full text-left text-sm text-slate-900 dark:text-white">
                                <thead className="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4">PRF ID</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Requester</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Supplier</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Date Created</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredBrPendingReqs.map(req => (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            onClick={() => setDrawerReq(req)}
                                        >
                                            <td className="px-6 py-4 font-medium">{req.id}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                <div className="truncate max-w-[200px]" title={req.description}>
                                                    {req.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                <div className="truncate max-w-[150px]" title={req.prfDetails?.supplier?.name || 'N/A'}>
                                                    {req.prfDetails?.supplier?.name || <span className="text-slate-500 italic">N/A</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                                                ₱{req.totalAmount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
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
                                                            hasPermission('finance:budget_request:approve:finance_head') &&
                                                            approverAssignments.financeHeads?.some(fh =>
                                                                fh.userId === currentUser.id &&
                                                                fh.businessUnitIds.includes(req.businessId)
                                                            )
                                                        ) ||
                                                        // GM: Check if assigned as GM
                                                        (req.status === RequisitionStatus.PENDING_GM_BR_APPROVAL &&
                                                            hasPermission('finance:budget_request:approve:gm') &&
                                                            currentUser.id === approverAssignments.gmUid
                                                        ) ||
                                                        // BOD: Check if assigned as BOD approver
                                                        (req.status === RequisitionStatus.PENDING_BOD_APPROVAL &&
                                                            hasPermission('finance:budget_request:approve:bod') &&
                                                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                                                        ) ||
                                                        // CFO: Check if assigned as CFO
                                                        (req.status === RequisitionStatus.PENDING_CFO_APPROVAL &&
                                                            hasPermission('finance:budget_request:approve:cfo') &&
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
                            <table className="w-full text-left text-sm text-slate-900 dark:text-white">
                                <thead className="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4">PRF ID</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Requester</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Supplier</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Date Created</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredCheckPrepReqs.map(req => (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('button')) return;
                                                setDrawerReq(req);
                                            }}
                                        >
                                            <td className="px-6 py-4 font-medium">{req.id}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                <div className="truncate max-w-[200px]" title={req.description}>
                                                    {req.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                <div className="truncate max-w-[150px]" title={req.prfDetails?.supplier?.name || 'N/A'}>
                                                    {req.prfDetails?.supplier?.name || <span className="text-slate-500 italic">N/A</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                                                ₱{req.totalAmount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                                                {new Date(req.dateCreated).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(req.status)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {hasPermission('finance:cheque:upload') ? (
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
                            <table className="w-full text-left text-sm text-slate-900 dark:text-white">
                                <thead className="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                                    <tr>
                                        <th className="px-6 py-4">PRF ID</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Requester</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Supplier</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Ref #</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredCheckAuthReqs.map(req => (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            onClick={() => setDrawerReq(req)}
                                        >
                                            <td className="px-6 py-4 font-medium">{req.id}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                <div className="truncate max-w-[200px]" title={req.description}>
                                                    {req.description}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                <div className="truncate max-w-[150px]" title={req.prfDetails?.supplier?.name || 'N/A'}>
                                                    {req.prfDetails?.supplier?.name || <span className="text-slate-500 italic">N/A</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                                                ₱{req.totalAmount?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-slate-900 dark:text-white font-mono">{req.chequeNumber || '-'}</span>
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
                                                {(hasPermission('finance:budget_request:approve:bod') || hasPermission('finance:cheque:authorize') || approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id) || isSuperAdmin(currentUser.role)) ? (
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
                canReleaseFund={
                    hasPermission('finance:cheque:release') &&
                    (activeTab === 'prf_pending' || activeTab === 'pcf_pending')
                }
                onApprove={async () => {
                    if (drawerReq) {
                        // BOD users skip signature modal — approve directly
                        if (hasPermission('procurement:approval:approve:skip_signature')) {
                            try {
                                await RequisitionService.approveRequisition(
                                    drawerReq.id, currentUser.id, currentUser.name, undefined, undefined
                                );
                                setDrawerReq(null);
                            } catch (error: unknown) {
                                const message = error instanceof Error ? error.message : 'Unknown error';
                                console.error('Error approving:', error);
                                alert(`Failed to approve: ${message}`);
                            }
                            return;
                        }
                        setSigningReq(drawerReq);
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
                            hasPermission('finance:budget_request:approve:finance_head') &&
                            approverAssignments.financeHeads?.some(fh =>
                                fh.userId === currentUser.id &&
                                fh.businessUnitIds.includes(drawerReq.businessId)
                            )
                        ) ||
                        // GM: Check if assigned as GM
                        (drawerReq.status === RequisitionStatus.PENDING_GM_BR_APPROVAL &&
                            hasPermission('finance:budget_request:approve:gm') &&
                            currentUser.id === approverAssignments.gmUid
                        ) ||
                        // CFO: Check if assigned as CFO
                        (drawerReq.status === RequisitionStatus.PENDING_CFO_APPROVAL &&
                            hasPermission('finance:budget_request:approve:cfo') &&
                            currentUser.id === approverAssignments.cfoUid
                        ) ||
                        // BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_BOD_APPROVAL &&
                            hasPermission('finance:budget_request:approve:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // Check Auth BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_CHECK_AUTH_BOD &&
                            (hasPermission('finance:budget_request:approve:bod') || hasPermission('finance:cheque:authorize')) &&
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
                            hasPermission('finance:budget_request:approve:finance_head') &&
                            approverAssignments.financeHeads?.some(fh =>
                                fh.userId === currentUser.id &&
                                fh.businessUnitIds.includes(drawerReq.businessId)
                            )
                        ) ||
                        // GM: Check if assigned as GM
                        (drawerReq.status === RequisitionStatus.PENDING_GM_BR_APPROVAL &&
                            hasPermission('finance:budget_request:approve:gm') &&
                            currentUser.id === approverAssignments.gmUid
                        ) ||
                        // CFO: Check if assigned as CFO
                        (drawerReq.status === RequisitionStatus.PENDING_CFO_APPROVAL &&
                            hasPermission('finance:budget_request:approve:cfo') &&
                            currentUser.id === approverAssignments.cfoUid
                        ) ||
                        // BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_BOD_APPROVAL &&
                            hasPermission('finance:budget_request:approve:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // Check Auth BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_CHECK_AUTH_BOD &&
                            (hasPermission('finance:budget_request:approve:bod') || hasPermission('finance:cheque:authorize')) &&
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

            {/* Signature Modal */}
            <SignatureModal
                isOpen={!!signingReq}
                onClose={() => setSigningReq(null)}
                onConfirm={handleSignatureConfirm}
                title={`Sign to Approve ${signingReq?.id || ''}`}
                isLoading={signatureLoading}
            />
        </>
    );
};

export default FinanceView;
