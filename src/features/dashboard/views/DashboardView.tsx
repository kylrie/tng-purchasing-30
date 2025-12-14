import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Clock,
    FileText,
    DollarSign,
    Receipt,
    AlertTriangle,
    Timer,
    CheckCircle2,
    Users,
    Wallet,
    Coins,
    ShieldCheck
} from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import type { Requisition, Supplier } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import { usePermissions } from '../../../hooks/usePermissions';
import PreparePRFModal from '../../procurement/components/PreparePRFModal';
import ReleaseFundModal from '../../finance/components/ReleaseFundModal';
import LiquidationAuditModal from '../../finance/components/LiquidationAuditModal';
import { RequisitionService } from '../../procurement/services/requisitions.service';
import RejectionModal from '../../../shared/components/RejectionModal';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import { CheckCircle, XCircle } from 'lucide-react';
import { SettingsService, type ApproverAssignments } from '../../../shared/services/settings.service';

interface DashboardViewProps {
    requisitions: Requisition[];
    currentUser: User;
    allUsers: User[];
    suppliers: Supplier[];
    businesses: Business[];
    onCreateRequisition: (req: any) => void;
    onUpdateRequisition: (req: Requisition) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ requisitions, currentUser, allUsers, suppliers, businesses, onCreateRequisition, onUpdateRequisition }) => {
    const navigate = useNavigate();
    const { hasPermission } = usePermissions();
    const [preparePRFReq, setPreparePRFReq] = React.useState<Requisition | null>(null);
    const [releaseFundReq, setReleaseFundReq] = React.useState<Requisition | null>(null);
    const [auditReq, setAuditReq] = React.useState<Requisition | null>(null);
    const [rejectingReq, setRejectingReq] = React.useState<Requisition | null>(null);
    const [drawerReq, setDrawerReq] = React.useState<Requisition | null>(null);
    const [selectedBU, setSelectedBU] = React.useState<string>('all');
    const [pendingApprovalTab, setPendingApprovalTab] = React.useState<'burf' | 'cic' | 'prf' | 'gmprf'>('burf');

    // Workflow Approver Assignments for filtering
    const [approverAssignments, setApproverAssignments] = React.useState<ApproverAssignments>({});

    // Load approver assignments on mount
    React.useEffect(() => {
        SettingsService.getApproverAssignments().then(setApproverAssignments);
    }, []);

    // Determine if the user is an approver
    const isApprover = hasPermission('approval:manager:burf') ||
        hasPermission('approval:manager:prf') ||
        hasPermission('approval:cic:burf') ||
        hasPermission('finance:release_funds') ||
        (hasPermission('requisition:view:all') && hasPermission('admin:manage:users'));

    // Helper to check if user is assigned to a workflow role
    const isAssignedApprover = (r: Requisition): boolean => {
        switch (r.status) {
            // BU-specific Finance Head - check if user handles this BU
            case RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL:
                if (approverAssignments.financeHeads) {
                    return approverAssignments.financeHeads.some(fh =>
                        fh.userId === currentUser.id &&
                        fh.businessUnitIds.includes(r.businessId)
                    );
                }
                return false;

            case RequisitionStatus.PENDING_GM_PRF_APPROVAL:
            case RequisitionStatus.PENDING_GM_BR_APPROVAL:
                return currentUser.id === approverAssignments.gmUid;

            case RequisitionStatus.PENDING_CFO_APPROVAL:
                return currentUser.id === approverAssignments.cfoUid;

            // Multiple BOD approvers - any of them can approve
            case RequisitionStatus.PENDING_BOD_APPROVAL:
                if (approverAssignments.bodApprovers) {
                    return approverAssignments.bodApprovers.some(bod =>
                        bod.userId === currentUser.id
                    );
                }
                return false;

            case RequisitionStatus.FOR_FUND_RELEASE:
                return hasPermission('finance:release_funds');
            default:
                return false;
        }
    };

    // Note: pendingCount removed - now using individual counts per approval type
    const totalSpend = requisitions
        .filter(r => [RequisitionStatus.APPROVED_FOR_PAYMENT, RequisitionStatus.FUNDS_RELEASED, RequisitionStatus.LIQUIDATION_FILED, RequisitionStatus.AUDITED_CLEARED].includes(r.status))
        .filter(r => selectedBU === 'all' || r.businessId === selectedBU)
        .reduce((sum, r) => sum + r.totalAmount, 0);

    // Business filter options for Total Spend widget
    const businessFilterOptions = [
        { value: 'all', label: 'All BUs' },
        ...businesses.map(b => ({ value: b.id, label: b.name }))
    ];

    // For PRF Count
    const forPrfCount = requisitions.filter(r =>
        r.status === RequisitionStatus.READY_FOR_PRF
    ).length;

    // === NEW METRICS FOR MANAGERS ===

    // Overdue Items - past dateNeeded and not completed
    const now = new Date();
    const overdueItems = requisitions.filter(r => {
        if (!r.dateNeeded) return false;
        const needed = new Date(r.dateNeeded);
        const isOverdue = needed < now;
        const isNotCompleted = ![
            RequisitionStatus.FUNDS_RELEASED,
            RequisitionStatus.AUDITED_CLEARED,
            RequisitionStatus.CANCELLED,
            RequisitionStatus.REJECTED
        ].includes(r.status);
        return isOverdue && isNotCompleted;
    });
    const overdueCount = overdueItems.length;

    // Average Processing Time (days from BURF creation to fund release)
    const completedReqs = requisitions.filter(r =>
        r.status === RequisitionStatus.FUNDS_RELEASED && r.fundReleaseDate
    );
    const avgProcessingDays = completedReqs.length > 0
        ? Math.round(completedReqs.reduce((sum, r) => {
            const created = new Date(r.dateCreated).getTime();
            const released = new Date(r.fundReleaseDate!).getTime();
            return sum + (released - created) / (1000 * 60 * 60 * 24);
        }, 0) / completedReqs.length)
        : 0;

    // Completed This Month vs Last Month
    const thisMonth = new Date();
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
    const thisMonthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);

    const completedThisMonth = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.FUNDS_RELEASED || !r.fundReleaseDate) return false;
        const released = new Date(r.fundReleaseDate);
        return released >= thisMonthStart;
    }).length;

    const completedLastMonth = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.FUNDS_RELEASED || !r.fundReleaseDate) return false;
        const released = new Date(r.fundReleaseDate);
        return released >= lastMonth && released < thisMonthStart;
    }).length;

    const monthlyTrendPercent = completedLastMonth > 0
        ? Math.round(((completedThisMonth - completedLastMonth) / completedLastMonth) * 100)
        : completedThisMonth > 0 ? 100 : 0;

    // Top 5 Requesters
    const requesterCounts: Record<string, { name: string; count: number }> = {};
    requisitions.forEach(r => {
        const requester = allUsers.find(u => u.id === r.requesterId);
        const name = requester?.name || 'Unknown';
        if (!requesterCounts[r.requesterId]) {
            requesterCounts[r.requesterId] = { name, count: 0 };
        }
        requesterCounts[r.requesterId].count++;
    });
    const top5Requesters = Object.entries(requesterCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([id, data]) => ({ id, ...data }));

    const pendingApprovals = [...requisitions]
        .filter(r => {
            // Super Admin / Global View - see all pending
            if (hasPermission('requisition:view:all') && hasPermission('admin:manage:users')) {
                return [
                    RequisitionStatus.BURF_PENDING_MANAGER,
                    RequisitionStatus.BURF_PENDING_CIC,
                    RequisitionStatus.PRF_PENDING_MANAGER,
                    RequisitionStatus.PENDING_GM_PRF_APPROVAL,
                    RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL,
                    RequisitionStatus.PENDING_GM_BR_APPROVAL,
                    RequisitionStatus.PENDING_CFO_APPROVAL,
                    RequisitionStatus.PENDING_BOD_APPROVAL,
                    RequisitionStatus.FOR_FUND_RELEASE,
                    RequisitionStatus.APPROVED_FOR_PAYMENT // Legacy
                ].includes(r.status);
            }

            // Permission-based checks
            if (hasPermission('approval:manager:burf') && r.status === RequisitionStatus.BURF_PENDING_MANAGER) return true;
            if (hasPermission('approval:cic:burf') && r.status === RequisitionStatus.BURF_PENDING_CIC) return true;
            if (hasPermission('finance:release_funds') && r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) return true;

            // PRF_PENDING_MANAGER: Check based on source type
            if (r.status === RequisitionStatus.PRF_PENDING_MANAGER) {
                // BURF→PRF conversions: Use BUM role-based approval
                if (r.parentBurfId) {
                    return hasPermission('approval:manager:prf');
                } else {
                    // Direct PRF: Use designated approver
                    return r.prfDetails?.designatedApproverId === currentUser.id;
                }
            }

            // New workflow - check assigned approver
            if (isAssignedApprover(r)) return true;

            return false;
        })
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
        .slice(0, 5)
        .map(r => {
            let action = 'needs approval';
            if (r.status === RequisitionStatus.BURF_PENDING_MANAGER) action = 'submitted BURF';
            if (r.status === RequisitionStatus.BURF_PENDING_CIC) action = 'approved BURF';
            if (r.status === RequisitionStatus.PRF_PENDING_MANAGER) action = 'PRF for Approval';
            if (r.status === RequisitionStatus.PENDING_GM_PRF_APPROVAL) action = 'PRF for GM (≥50k)';
            if (r.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL) action = 'PRF for Finance Head';
            if (r.status === RequisitionStatus.PENDING_GM_BR_APPROVAL) action = 'PRF for GM Budget';
            if (r.status === RequisitionStatus.PENDING_CFO_APPROVAL) action = 'PRF for CFO';
            if (r.status === RequisitionStatus.PENDING_BOD_APPROVAL) action = 'PRF for BOD';
            if (r.status === RequisitionStatus.FOR_FUND_RELEASE) action = 'Ready for Fund Release';
            if (r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) action = 'Ready for Payment';

            const requester = allUsers.find(u => u.id === r.requesterId);
            const requesterName = requester?.name || 'Unknown User';

            return {
                id: r.id,
                user: requesterName,
                action,
                target: r.projectName || r.description,
                time: new Date(r.dateCreated).toLocaleDateString(),
                avatar: requesterName.charAt(0).toUpperCase(),
                status: r.status,
                rawRequisition: r // Pass the full object for actions
            };
        });

    // === SECONDARY TABS: Split pending approvals into categories ===
    // Tab 1: BURF Approvals (BURF_PENDING_MANAGER only)
    const burfApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.BURF_PENDING_MANAGER
    );

    // Tab 2: CIC Reviews (Check Prep tasks)
    const cicReviews = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.BURF_PENDING_CIC
    );

    // Tab 3: PRF Approvals (PRF Step 1 - Manager/Designated Approver ONLY)
    const prfApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.PRF_PENDING_MANAGER
    );

    // Tab 4: GM PRF Approvals (Step 2 - General Manager for items >= 50k)
    const gmPrfApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.PENDING_GM_PRF_APPROVAL
    );

    // BR (Budget Request) - Steps 3-5: Finance Head, GM Budget, CFO
    const brApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL ||
        item.status === RequisitionStatus.PENDING_GM_BR_APPROVAL ||
        item.status === RequisitionStatus.PENDING_CFO_APPROVAL
    );

    // Check Authorization (BOD Approval - Step 6)
    const checkAuthApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.PENDING_BOD_APPROVAL
    );

    // Get current tab's data
    const getActiveTabItems = () => {
        switch (pendingApprovalTab) {
            case 'burf': return burfApprovals;
            case 'cic': return cicReviews;
            case 'prf': return prfApprovals;
            case 'gmprf': return gmPrfApprovals;
            default: return burfApprovals;
        }
    };






    // Ready for PRF Items (Purchasing Officer View)
    const readyForPrfItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.READY_FOR_PRF) return false;
        if (!hasPermission('requisition:create:prf')) return false;

        // Filter by Business Unit
        if (hasPermission('requisition:view:all')) return true;

        const userBUs = currentUser.businessUnitIds || [currentUser.businessId];
        return userBUs.includes(r.businessId);
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    // Pending Fund Release (Finance)
    const pendingFundReleaseItems = requisitions.filter(r =>
        r.status === RequisitionStatus.APPROVED_FOR_PAYMENT &&
        hasPermission('finance:release_funds')
    );

    // Finance Head BR Items - BU-specific filtering
    const financeHeadBRItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL) return false;

        // Check if current user is a Finance Head for this requisition's BU
        if (approverAssignments.financeHeads) {
            return approverAssignments.financeHeads.some(fh =>
                fh.userId === currentUser.id &&
                fh.businessUnitIds.includes(r.businessId)
            );
        }
        return false;
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    // GM BR Items - GM Budget Review approval
    const gmBRItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.PENDING_GM_BR_APPROVAL) return false;

        // Only the assigned GM can see these
        return currentUser.id === approverAssignments.gmUid;
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    // Check Authorization Items - Filter by BOD role assignment
    const checkAuthItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.PENDING_CHECK_AUTH_BOD) return false;

        // BOD approvers can approve check authorization
        if (approverAssignments.bodApprovers) {
            return approverAssignments.bodApprovers.some(bod =>
                bod.userId === currentUser.id
            );
        }
        // Also allow users with explicit BOD approval permission
        return hasPermission('approval:bod');
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());


    // Pending Audit (Auditor)
    const pendingAuditItems = requisitions.filter(r =>
        r.status === RequisitionStatus.LIQUIDATION_FILED &&
        hasPermission('liquidation:audit')
    );

    const handlePreparePRFSubmit = (prfReq: Requisition, updatedOrigin?: Requisition) => {
        if (updatedOrigin) {
            onUpdateRequisition(updatedOrigin);
        }

        const exists = requisitions.some(r => r.id === prfReq.id);

        if (exists) {
            onUpdateRequisition({ ...prfReq, status: RequisitionStatus.PRF_PENDING_MANAGER });
        } else {
            onCreateRequisition(prfReq);
        }

        setPreparePRFReq(null);
    };

    const handleApprove = async (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();

        if (confirm(`Are you sure you want to approve ${req.id}?`)) {
            try {
                await RequisitionService.approveRequisition(
                    req.id,
                    currentUser.id,
                    currentUser.name
                );
                // Optimistic update or refresh logic would go here, 
                // but since we rely on parent props, we might need a refresh callback or wait for real-time update.
                // Assuming onUpdateRequisition handles local state update if passed the updated object, 
                // but RequisitionService.approveRequisition returns void/promise.
                // Ideally, we should fetch the updated req or construct it.
                // For now, let's assume the parent or a listener will update the list.
                // To be safe, we can manually trigger an update if we knew the next status.
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



    return (
        <div className="space-y-8 text-white min-h-screen">
            {/* Welcome Section */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard Overview</h1>
                    <p className="text-slate-300">Welcome back, {currentUser.name}! Here's what's happening today.</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{currentUser.role.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex flex-col-reverse lg:flex-row lg:items-start gap-6 lg:gap-8">
                {/* Main Content Area */}
                <div className="flex-1 space-y-8 w-full">
                    {/* Stats Grid - Role-Specific Approval Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        {/* BURF Manager Approval Card */}
                        {hasPermission('approval:manager:burf') && (
                            <DashboardCard
                                id="burf-manager"
                                label="BURF Mgr"
                                value={burfApprovals.length.toString()}
                                route="/procurement-approvals?tab=burf"
                                icon={Clock}
                                progress={Math.min(burfApprovals.length * 15, 100)}
                                sparklineData={[2, 4, 3, 5, 4, burfApprovals.length]}
                                gradientColors={['#f97316', '#eab308']}
                                iconColor="text-orange-400"
                                sparklineColor="#f97316"
                                urgency={burfApprovals.length > 3 ? 'critical' : burfApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* CIC Review Card */}
                        {hasPermission('approval:cic:burf') && (
                            <DashboardCard
                                id="cic-review"
                                label="CIC Review"
                                value={cicReviews.length.toString()}
                                route="/procurement-approvals?tab=cic"
                                icon={ShieldCheck}
                                progress={Math.min(cicReviews.length * 15, 100)}
                                sparklineData={[1, 2, 1, 3, 2, cicReviews.length]}
                                gradientColors={['#06b6d4', '#0891b2']}
                                iconColor="text-cyan-400"
                                sparklineColor="#06b6d4"
                                urgency={cicReviews.length > 2 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* PRF Manager Approval Card */}
                        {hasPermission('approval:manager:prf') && (
                            <DashboardCard
                                id="prf-manager"
                                label="PRF Mgr"
                                value={prfApprovals.length.toString()}
                                route="/procurement-approvals?tab=prf"
                                icon={FileText}
                                progress={Math.min(prfApprovals.length * 15, 100)}
                                sparklineData={[2, 3, 2, 4, 3, prfApprovals.length]}
                                gradientColors={['#a855f7', '#8b5cf6']}
                                iconColor="text-purple-400"
                                sparklineColor="#a855f7"
                                urgency={prfApprovals.length > 3 ? 'critical' : prfApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* GM PRF Approval Card - Only for assigned GM */}
                        {currentUser.id === approverAssignments.gmUid && gmPrfApprovals.length > 0 && (
                            <DashboardCard
                                id="gm-prf"
                                label="GM PRF"
                                value={gmPrfApprovals.length.toString()}
                                route="/procurement-approvals?tab=gmprf"
                                icon={Users}
                                progress={Math.min(gmPrfApprovals.length * 20, 100)}
                                sparklineData={[1, 2, 1, 2, 1, gmPrfApprovals.length]}
                                gradientColors={['#6366f1', '#4f46e5']}
                                iconColor="text-indigo-400"
                                sparklineColor="#6366f1"
                                urgency={gmPrfApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* Finance Head BR Card - Only for assigned Finance Heads */}
                        {approverAssignments.financeHeads?.some(fh => fh.userId === currentUser.id) && brApprovals.length > 0 && (
                            <DashboardCard
                                id="finance-br"
                                label="Finance BR"
                                value={brApprovals.length.toString()}
                                route="/finance?tab=br_pending"
                                icon={Receipt}
                                progress={Math.min(brApprovals.length * 20, 100)}
                                sparklineData={[1, 1, 2, 1, 2, brApprovals.length]}
                                gradientColors={['#22c55e', '#16a34a']}
                                iconColor="text-emerald-400"
                                sparklineColor="#22c55e"
                                urgency={brApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* BOD Approval Card */}
                        {(hasPermission('approval:bod') || approverAssignments.bodApprovers?.some(b => b.userId === currentUser.id)) && checkAuthApprovals.length > 0 && (
                            <DashboardCard
                                id="bod-approval"
                                label="BOD Auth"
                                value={checkAuthApprovals.length.toString()}
                                route="/finance?tab=check_pending"
                                icon={ShieldCheck}
                                progress={Math.min(checkAuthApprovals.length * 20, 100)}
                                sparklineData={[0, 1, 0, 1, 1, checkAuthApprovals.length]}
                                gradientColors={['#f59e0b', '#d97706']}
                                iconColor="text-amber-400"
                                sparklineColor="#f59e0b"
                                urgency={checkAuthApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* Fund Release Card */}
                        {hasPermission('finance:release_funds') && pendingFundReleaseItems.length > 0 && (
                            <DashboardCard
                                id="fund-release"
                                label="Fund Release"
                                value={pendingFundReleaseItems.length.toString()}
                                route="/finance?tab=prf_pending"
                                icon={DollarSign}
                                progress={Math.min(pendingFundReleaseItems.length * 15, 100)}
                                sparklineData={[2, 3, 2, 4, 3, pendingFundReleaseItems.length]}
                                gradientColors={['#10b981', '#059669']}
                                iconColor="text-emerald-400"
                                sparklineColor="#10b981"
                                urgency={pendingFundReleaseItems.length > 3 ? 'critical' : pendingFundReleaseItems.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* Overdue Items Card */}
                        {hasPermission('dashboard:widget:overdue_items') && (
                            <DashboardCard
                                id="overdue-items"
                                label="Overdue"
                                value={overdueCount.toString()}
                                route="/procurement-approvals"
                                icon={AlertTriangle}
                                progress={Math.min(overdueCount * 15, 100)}
                                sparklineData={[2, 4, 3, 5, 4, overdueCount]}
                                gradientColors={overdueCount > 0 ? ['#ef4444', '#f97316'] : ['#64748b', '#475569']}
                                iconColor={overdueCount > 0 ? 'text-red-400' : 'text-slate-400'}
                                sparklineColor={overdueCount > 0 ? '#ef4444' : '#64748b'}
                                urgency={overdueCount > 3 ? 'critical' : overdueCount > 0 ? 'warning' : 'normal'}
                                previewItems={overdueItems.slice(0, 3).map(r => ({
                                    id: r.id,
                                    title: r.id,
                                    subtitle: `Due: ${new Date(r.dateNeeded!).toLocaleDateString()}`
                                }))}
                            />
                        )}

                        {/* PCF Approval Card */}
                        {hasPermission('dashboard:widget:pcf_approvals') && (
                            <DashboardCard
                                id="pcf-approval"
                                label="PCF Approval"
                                value="0"
                                route="/pcf-approvals"
                                icon={Wallet}
                                progress={0}
                                sparklineData={[0, 0, 0, 0, 0, 0]}
                                gradientColors={['#64748b', '#475569']}
                                iconColor="text-slate-400"
                                sparklineColor="#64748b"
                            />
                        )}

                        {/* Ready for PRF Card */}
                        {hasPermission('dashboard:widget:ready_for_prf') && (
                            <DashboardCard
                                id="ready-for-prf"
                                label="Ready for PRF"
                                value={forPrfCount.toString()}
                                route="/prf"
                                icon={FileText}
                                progress={Math.min(forPrfCount * 20, 100)}
                                sparklineData={[2, 4, 6, 3, 5, forPrfCount]}
                                gradientColors={['#eab308', '#22c55e']}
                                iconColor="text-yellow-400"
                                sparklineColor="#eab308"
                                trendPercent={forPrfCount > 0 ? 8 : 0}
                                trend={forPrfCount > 2 ? 'up' : 'neutral'}
                            />
                        )}

                        {/* Avg Processing Time Card */}
                        {hasPermission('dashboard:widget:avg_processing') && (
                            <DashboardCard
                                id="avg-processing"
                                label="Avg Days"
                                value={avgProcessingDays.toString()}
                                route="/finance"
                                icon={Timer}
                                progress={Math.min(100 - avgProcessingDays * 5, 100)}
                                sparklineData={[12, 10, 8, 9, 7, avgProcessingDays]}
                                gradientColors={avgProcessingDays < 7 ? ['#22c55e', '#10b981'] : ['#eab308', '#f97316']}
                                iconColor={avgProcessingDays < 7 ? 'text-emerald-400' : 'text-yellow-400'}
                                sparklineColor={avgProcessingDays < 7 ? '#22c55e' : '#eab308'}
                                trendPercent={avgProcessingDays > 0 ? -5 : 0}
                                trend={avgProcessingDays < 7 ? 'down' : 'up'}
                            />
                        )}

                        {/* Completed This Month Card */}
                        {hasPermission('dashboard:widget:completed_month') && (
                            <DashboardCard
                                id="completed-month"
                                label="Completed"
                                value={completedThisMonth.toString()}
                                route="/finance"
                                icon={CheckCircle2}
                                progress={Math.min(completedThisMonth * 10, 100)}
                                sparklineData={[3, 5, 4, 6, completedLastMonth, completedThisMonth]}
                                gradientColors={['#22c55e', '#10b981']}
                                iconColor="text-emerald-400"
                                sparklineColor="#22c55e"
                                trendPercent={Math.abs(monthlyTrendPercent)}
                                trend={monthlyTrendPercent > 0 ? 'up' : monthlyTrendPercent < 0 ? 'down' : 'neutral'}
                            />
                        )}

                        {/* Total Spend Card with Business Filter */}
                        {hasPermission('dashboard:widget:total_spend') && (
                            <DashboardCard
                                id="total-spend"
                                label="Spend"
                                value={`₱${(totalSpend / 1000).toFixed(0)}k`}
                                route="/finance"
                                icon={Coins}
                                progress={85}
                                sparklineData={[20, 35, 45, 60, 75, 85]}
                                gradientColors={['#22c55e', '#10b981']}
                                iconColor="text-emerald-400"
                                sparklineColor="#22c55e"
                                trendPercent={12}
                                trend="up"
                                filterOptions={businessFilterOptions}
                                selectedFilter={selectedBU}
                                onFilterChange={setSelectedBU}
                            />
                        )}

                        {/* Top Requesters Card */}
                        {hasPermission('dashboard:widget:top_requesters') && (
                            <DashboardCard
                                id="top-requesters"
                                label="Top Requester"
                                value={top5Requesters[0]?.count.toString() || '0'}
                                route="/settings"
                                icon={Users}
                                progress={top5Requesters.length > 0 ? 100 : 0}
                                sparklineData={top5Requesters.slice(0, 6).map(r => r.count)}
                                gradientColors={['#8b5cf6', '#a855f7']}
                                iconColor="text-purple-400"
                                sparklineColor="#8b5cf6"
                                breakdown={top5Requesters.map(r => ({
                                    label: r.name.split(' ')[0],
                                    count: r.count,
                                    color: 'text-purple-400'
                                }))}
                                previewItems={top5Requesters.slice(0, 3).map(r => ({
                                    id: r.id,
                                    title: r.name,
                                    subtitle: `${r.count} requests`
                                }))}
                            />
                        )}
                    </div>

                    <div className={`grid grid-cols-1 ${isApprover ? 'lg:grid-cols-3' : 'lg:grid-cols-1 max-w-4xl mx-auto'} gap-8`}>
                        {/* Pending Approvals - Only visible with permission */}
                        {hasPermission('dashboard:section:pending_list') && (
                            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg flex flex-col">
                                {/* Header with View All */}
                                <div className="p-6 flex justify-between items-center border-b border-slate-700/50">
                                    <h2 className="text-lg font-bold text-white">Pending Approvals</h2>
                                    <button onClick={() => navigate('/procurement-approvals')} className="text-xs font-medium bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-full text-white transition-colors">View All</button>
                                </div>

                                {/* Secondary Tab Bar - Filtered by Permission */}
                                <div className="px-6 pt-4 pb-2 flex gap-2 border-b border-slate-700/30 flex-wrap">
                                    {hasPermission('approval:manager:burf') && (
                                        <button
                                            onClick={() => setPendingApprovalTab('burf')}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingApprovalTab === 'burf'
                                                ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                                }`}
                                        >
                                            BURF
                                            {burfApprovals.length > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingApprovalTab === 'burf' ? 'bg-orange-500 text-white' : 'bg-slate-600 text-slate-300'
                                                    }`}>
                                                    {burfApprovals.length}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                    {hasPermission('approval:cic:burf') && (
                                        <button
                                            onClick={() => setPendingApprovalTab('cic')}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingApprovalTab === 'cic'
                                                ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                                }`}
                                        >
                                            CIC
                                            {cicReviews.length > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingApprovalTab === 'cic' ? 'bg-cyan-500 text-white' : 'bg-slate-600 text-slate-300'
                                                    }`}>
                                                    {cicReviews.length}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                    {hasPermission('approval:manager:prf') && (
                                        <button
                                            onClick={() => setPendingApprovalTab('prf')}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingApprovalTab === 'prf'
                                                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                                }`}
                                        >
                                            PRF
                                            {prfApprovals.length > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingApprovalTab === 'prf' ? 'bg-purple-500 text-white' : 'bg-slate-600 text-slate-300'
                                                    }`}>
                                                    {prfApprovals.length}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                    {currentUser.id === approverAssignments.gmUid && (
                                        <button
                                            onClick={() => setPendingApprovalTab('gmprf')}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingApprovalTab === 'gmprf'
                                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                                }`}
                                        >
                                            GM PRF
                                            {gmPrfApprovals.length > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingApprovalTab === 'gmprf' ? 'bg-indigo-500 text-white' : 'bg-slate-600 text-slate-300'
                                                    }`}>
                                                    {gmPrfApprovals.length}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Tab Content */}
                                <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
                                    <div className="space-y-4">
                                        {getActiveTabItems().map(activity => (
                                            <div
                                                key={activity.id}
                                                onClick={() => setDrawerReq(activity.rawRequisition)}
                                                className="flex gap-4 items-center p-3 rounded-xl hover:bg-slate-700/30 transition-colors border border-transparent hover:border-slate-700 cursor-pointer group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm flex-shrink-0 group-hover:bg-slate-600 transition-colors">
                                                    {activity.avatar}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-slate-200 truncate group-hover:text-white transition-colors">
                                                        <span className="font-semibold text-white">{activity.user}</span> {activity.action} <span className="font-medium text-purple-300">"{activity.target}"</span>
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-slate-500 uppercase font-semibold">{activity.time}</span>
                                                        <span className="text-xs text-slate-600">•</span>
                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${activity.status.includes('PENDING') ? 'bg-orange-900/30 text-orange-400 border border-orange-500/20' : 'bg-cyan-900/30 text-cyan-400 border border-cyan-500/20'}`}>
                                                            {activity.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Action Buttons */}
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={(e) => handleApprove(activity.rawRequisition, e)}
                                                        className="p-2 hover:bg-green-900/30 text-slate-400 hover:text-green-400 rounded-lg transition-colors"
                                                        title="Approve"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleRejectClick(activity.rawRequisition, e)}
                                                        className="p-2 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                                        title="Reject"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {/* Tab-specific empty states */}
                                        {getActiveTabItems().length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                                <Clock size={48} className="mb-4 opacity-20" />
                                                <p className="text-sm">
                                                    {pendingApprovalTab === 'burf' && 'No pending BURF approvals found.'}
                                                    {pendingApprovalTab === 'cic' && 'No pending CIC reviews found.'}
                                                    {pendingApprovalTab === 'prf' && 'No pending PRF approvals found.'}
                                                    {pendingApprovalTab === 'gmprf' && 'No pending GM PRF approvals (≥₱50k) found.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Ready for PRF - Visible to Purchasing Officers */}
                        {hasPermission('dashboard:section:ready_for_prf_list') && readyForPrfItems.length > 0 && (
                            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg flex flex-col">
                                <div className="p-6 flex justify-between items-center border-b border-slate-700/50">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <FileText className="text-blue-400" size={20} />
                                        Ready for PRF
                                    </h2>
                                    <span className="text-xs font-medium bg-blue-900/30 text-blue-400 px-2 py-1 rounded-full border border-blue-500/20">
                                        {readyForPrfItems.length} Pending
                                    </span>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
                                    <div className="space-y-3">
                                        {readyForPrfItems.map(req => (
                                            <button
                                                key={req.id}
                                                onClick={() => setPreparePRFReq(req)}
                                                className="w-full text-left p-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/50 hover:border-blue-500/30 transition-all group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="text-xs font-mono text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-500/10">{req.id}</span>
                                                        <h4 className="font-medium text-slate-200 mt-1 group-hover:text-white transition-colors">{req.description}</h4>
                                                    </div>
                                                    <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">{req.items.length} items</span>
                                                    <span className="text-slate-300 font-medium">₱{req.totalAmount.toLocaleString()}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pending Fund Release - Visible to Finance */}
                        {hasPermission('dashboard:section:pending_fund_release') && pendingFundReleaseItems.length > 0 && (
                            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg flex flex-col">
                                <div className="p-6 flex justify-between items-center border-b border-slate-700/50">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <DollarSign className="text-emerald-400" size={20} />
                                        Pending Fund Release
                                    </h2>
                                    <span className="text-xs font-medium bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/20">
                                        {pendingFundReleaseItems.length} Pending
                                    </span>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
                                    <div className="space-y-3">
                                        {pendingFundReleaseItems.map(req => (
                                            <button
                                                key={req.id}
                                                onClick={() => setReleaseFundReq(req)}
                                                className="w-full text-left p-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/50 hover:border-emerald-500/30 transition-all group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="text-xs font-mono text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-500/10">{req.id}</span>
                                                        <h4 className="font-medium text-slate-200 mt-1 group-hover:text-white transition-colors">{req.description}</h4>
                                                    </div>
                                                    <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">{req.items.length} items</span>
                                                    <span className="text-slate-300 font-medium">₱{req.totalAmount.toLocaleString()}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* REMOVED: Combined BR Approvals widget - users now see role-specific widgets only */}

                        {/* Finance Head BR Approvals Widget - BU-specific */}
                        {financeHeadBRItems.length > 0 && (
                            <div className="lg:col-span-1 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg flex flex-col">
                                <div className="p-6 flex justify-between items-center border-b border-slate-700/50">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <FileText className="text-indigo-400" size={20} />
                                        Finance Head BR
                                    </h2>
                                    <span className="text-xs font-medium bg-indigo-900/30 text-indigo-400 px-2 py-1 rounded-full border border-indigo-500/20">
                                        {financeHeadBRItems.length} Pending
                                    </span>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto max-h-[350px]">
                                    <div className="space-y-3">
                                        {financeHeadBRItems.map(req => {
                                            const requester = allUsers.find(u => u.id === req.requesterId);
                                            const business = businesses.find(b => b.id === req.businessId);
                                            return (
                                                <div
                                                    key={req.id}
                                                    onClick={() => setDrawerReq(req)}
                                                    className="p-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/50 hover:border-indigo-500/30 transition-all cursor-pointer group"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="text-xs font-mono text-indigo-400 bg-indigo-900/20 px-1.5 py-0.5 rounded border border-indigo-500/10">{req.id}</span>
                                                            <h4 className="font-medium text-slate-200 mt-1 group-hover:text-white transition-colors truncate max-w-[200px]">{req.description}</h4>
                                                        </div>
                                                        <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-2">
                                                        <span className="text-slate-400">{requester?.name || 'Unknown'}</span>
                                                        <span className="text-slate-300 font-medium">₱{req.totalAmount?.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-semibold px-2 py-0.5 rounded bg-indigo-900/30 text-indigo-400 border border-indigo-500/20">
                                                            {business?.name || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/50">
                                                        <button
                                                            onClick={(e) => handleApprove(req, e)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <CheckCircle size={14} /> Approve
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRejectClick(req, e)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <XCircle size={14} /> Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* GM Budget Review Widget */}
                        {gmBRItems.length > 0 && (
                            <div className="lg:col-span-1 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg flex flex-col">
                                <div className="p-6 flex justify-between items-center border-b border-slate-700/50">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <FileText className="text-violet-400" size={20} />
                                        GM Budget Review
                                    </h2>
                                    <span className="text-xs font-medium bg-violet-900/30 text-violet-400 px-2 py-1 rounded-full border border-violet-500/20">
                                        {gmBRItems.length} Pending
                                    </span>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto max-h-[350px]">
                                    <div className="space-y-3">
                                        {gmBRItems.map(req => {
                                            const requester = allUsers.find(u => u.id === req.requesterId);
                                            const business = businesses.find(b => b.id === req.businessId);
                                            return (
                                                <div
                                                    key={req.id}
                                                    onClick={() => setDrawerReq(req)}
                                                    className="p-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/50 hover:border-violet-500/30 transition-all cursor-pointer group"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="text-xs font-mono text-violet-400 bg-violet-900/20 px-1.5 py-0.5 rounded border border-violet-500/10">{req.id}</span>
                                                            <h4 className="font-medium text-slate-200 mt-1 group-hover:text-white transition-colors truncate max-w-[200px]">{req.description}</h4>
                                                        </div>
                                                        <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-2">
                                                        <span className="text-slate-400">{requester?.name || 'Unknown'}</span>
                                                        <span className="text-slate-300 font-medium">₱{req.totalAmount?.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-semibold px-2 py-0.5 rounded bg-violet-900/30 text-violet-400 border border-violet-500/20">
                                                            {business?.name || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/50">
                                                        <button
                                                            onClick={(e) => handleApprove(req, e)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <CheckCircle size={14} /> Approve
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRejectClick(req, e)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <XCircle size={14} /> Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Check Authorization Widget - BOD Step 6 (Role + BU filtered) */}
                        {hasPermission('dashboard:section:check_auth') && checkAuthItems.length > 0 && (
                            <div className="lg:col-span-1 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg flex flex-col">
                                <div className="p-6 flex justify-between items-center border-b border-slate-700/50">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <ShieldCheck className="text-amber-400" size={20} />
                                        Check Authorization
                                    </h2>
                                    <span className="text-xs font-medium bg-amber-900/30 text-amber-400 px-2 py-1 rounded-full border border-amber-500/20">
                                        {checkAuthItems.length} Pending
                                    </span>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto max-h-[350px]">
                                    <div className="space-y-3">
                                        {checkAuthItems.map(req => {
                                            const requester = allUsers.find(u => u.id === req.requesterId);
                                            return (
                                                <div
                                                    key={req.id}
                                                    onClick={() => setDrawerReq(req)}
                                                    className="p-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/50 hover:border-amber-500/30 transition-all cursor-pointer group"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="text-xs font-mono text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-500/10">{req.id}</span>
                                                            <h4 className="font-medium text-slate-200 mt-1 group-hover:text-white transition-colors truncate max-w-[200px]">{req.description}</h4>
                                                        </div>
                                                        <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-2">
                                                        <span className="text-slate-400">{requester?.name || 'Unknown'}</span>
                                                        <span className="text-slate-300 font-medium">₱{req.totalAmount?.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-semibold px-2 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-500/20">
                                                            CHECK AUTH
                                                        </span>
                                                        {req.chequeNumber && (
                                                            <span className="text-slate-400">Check #{req.chequeNumber}</span>
                                                        )}
                                                    </div>
                                                    {/* Quick Actions */}
                                                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/50">
                                                        <button
                                                            onClick={(e) => handleApprove(req, e)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <CheckCircle size={14} /> Authorize
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRejectClick(req, e)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <XCircle size={14} /> Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pending Audit - Visible to Auditors */}
                        {hasPermission('dashboard:section:pending_audit_list') && pendingAuditItems.length > 0 && (
                            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg flex flex-col">
                                <div className="p-6 flex justify-between items-center border-b border-slate-700/50">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Receipt className="text-amber-400" size={20} />
                                        Pending Audit
                                    </h2>
                                    <span className="text-xs font-medium bg-amber-900/30 text-amber-400 px-2 py-1 rounded-full border border-amber-500/20">
                                        {pendingAuditItems.length} Pending
                                    </span>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
                                    <div className="space-y-3">
                                        {pendingAuditItems.map(req => (
                                            <button
                                                key={req.id}
                                                onClick={() => setAuditReq(req)}
                                                className="w-full text-left p-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 border border-slate-700/50 hover:border-amber-500/30 transition-all group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="text-xs font-mono text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-500/10">{req.id}</span>
                                                        <h4 className="font-medium text-slate-200 mt-1 group-hover:text-white transition-colors">{req.description}</h4>
                                                    </div>
                                                    <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">{req.items.length} items</span>
                                                    <span className="text-slate-300 font-medium">₱{req.totalAmount.toLocaleString()}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>


            </div>

            {
                preparePRFReq && (
                    <PreparePRFModal
                        requisition={preparePRFReq}
                        suppliers={suppliers}
                        onClose={() => setPreparePRFReq(null)}
                        onSubmit={handlePreparePRFSubmit}
                        currentUserId={currentUser.id}
                        users={allUsers}
                    />
                )
            }

            {
                releaseFundReq && (
                    <ReleaseFundModal
                        requisition={releaseFundReq}
                        isOpen={!!releaseFundReq}
                        onClose={() => setReleaseFundReq(null)}
                        onConfirm={() => {
                            // Use existing cheque data from check prep step
                            const updatedReq = {
                                ...releaseFundReq,
                                status: RequisitionStatus.FUNDS_RELEASED,
                                fundReleaseDate: new Date().toISOString()
                            };
                            onUpdateRequisition(updatedReq);
                            setReleaseFundReq(null);
                        }}
                    />
                )
            }

            {
                auditReq && (
                    <LiquidationAuditModal
                        requisition={auditReq}
                        onClose={() => setAuditReq(null)}
                        onApprove={async (auditNotes) => {
                            const updatedReq = {
                                ...auditReq,
                                status: RequisitionStatus.AUDITED_CLEARED,
                                liquidationDetails: {
                                    ...auditReq.liquidationDetails!,
                                    auditedBy: currentUser.id,
                                    auditDate: new Date().toISOString(),
                                    auditNotes: auditNotes,
                                    status: 'APPROVED' as const
                                }
                            };
                            onUpdateRequisition(updatedReq);
                            setAuditReq(null);
                        }}
                        onReject={async (reason) => {
                            const updatedReq = {
                                ...auditReq,
                                status: RequisitionStatus.LIQUIDATION_REJECTED,
                                liquidationDetails: {
                                    ...auditReq.liquidationDetails!,
                                    auditedBy: currentUser.id,
                                    auditDate: new Date().toISOString(),
                                    auditNotes: reason,
                                    rejectionReason: reason,
                                    status: 'REJECTED' as const
                                }
                            };
                            onUpdateRequisition(updatedReq);
                            setAuditReq(null);
                        }}
                    />
                )
            }

            {/* Quick Peek Drawer for Dashboard Lists */}
            <RequisitionDrawer
                requisition={drawerReq}
                isOpen={!!drawerReq}
                onClose={() => setDrawerReq(null)}
                variant="BURF"
                onApprove={async () => {
                    if (drawerReq && confirm(`Are you sure you want to approve ${drawerReq.id}?`)) {
                        try {
                            await RequisitionService.approveRequisition(
                                drawerReq.id,
                                currentUser.id,
                                currentUser.name
                            );
                            setDrawerReq(null);
                        } catch (error: any) {
                            console.error('Error approving:', error);
                            alert(`Failed to approve: ${error.message || 'Unknown error'}`);
                        }
                    }
                }}
                onReject={() => {
                    if (drawerReq) {
                        setRejectingReq(drawerReq);
                        setDrawerReq(null);
                    }
                }}
                canApprove={!!drawerReq}
                canReject={!!drawerReq}
            />

            <RejectionModal
                isOpen={!!rejectingReq}
                onClose={() => setRejectingReq(null)}
                onConfirm={handleRejectConfirm}
                title={`Reject Requisition ${rejectingReq?.id}`}
            />
        </div >
    );
};

export default DashboardView;
