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
    Coins
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
import { CheckCircle, XCircle } from 'lucide-react';

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
    const [selectedBU, setSelectedBU] = React.useState<string>('all');

    // Determine if the user is an approver
    const isApprover = hasPermission('approval:manager:burf') ||
        hasPermission('approval:manager:prf') ||
        hasPermission('approval:cic:burf') ||
        hasPermission('finance:release_funds') ||
        (hasPermission('requisition:view:all') && hasPermission('admin:manage:users'));

    // Calculate Stats
    // Pending Count: Only count items that SPECIFICALLY need THIS user's approval
    const pendingCount = requisitions.filter(r => {
        // Super Admin / Global View
        if (hasPermission('requisition:view:all') && hasPermission('admin:manage:users')) {
            return [
                RequisitionStatus.BURF_PENDING_MANAGER,
                RequisitionStatus.BURF_PENDING_CIC,
                RequisitionStatus.PRF_PENDING_MANAGER,
                RequisitionStatus.APPROVED_FOR_PAYMENT
            ].includes(r.status);
        }

        // Specific Approver Checks - Only count if user has permission AND status matches
        if (hasPermission('approval:manager:burf') && r.status === RequisitionStatus.BURF_PENDING_MANAGER) return true;
        if (hasPermission('approval:manager:prf') && r.status === RequisitionStatus.PRF_PENDING_MANAGER) return true;
        if (hasPermission('approval:cic:burf') && r.status === RequisitionStatus.BURF_PENDING_CIC) return true;
        if (hasPermission('finance:release_funds') && r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) return true;

        return false;
    }).length;


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

    // Pending Approvals - Show items that need the current user's approval
    const pendingApprovals = [...requisitions]
        .filter(r => {
            // Super Admin / Global View - see all pending
            if (hasPermission('requisition:view:all') && hasPermission('admin:manage:users')) {
                return [
                    RequisitionStatus.BURF_PENDING_MANAGER,
                    RequisitionStatus.BURF_PENDING_CIC,
                    RequisitionStatus.PRF_PENDING_MANAGER,
                    RequisitionStatus.APPROVED_FOR_PAYMENT
                ].includes(r.status);
            }

            if (hasPermission('approval:manager:burf') && r.status === RequisitionStatus.BURF_PENDING_MANAGER) return true;
            if (hasPermission('approval:manager:prf') && r.status === RequisitionStatus.PRF_PENDING_MANAGER) return true;
            if (hasPermission('approval:cic:burf') && r.status === RequisitionStatus.BURF_PENDING_CIC) return true;
            if (hasPermission('finance:release_funds') && r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) return true;

            return false;
        })
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
        .slice(0, 5)
        .map(r => {
            let action = 'needs approval';
            if (r.status === RequisitionStatus.BURF_PENDING_MANAGER) action = 'submitted BURF';
            if (r.status === RequisitionStatus.BURF_PENDING_CIC) action = 'approved BURF';
            if (r.status === RequisitionStatus.PRF_PENDING_MANAGER) action = 'submitted PRF';
            if (r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) action = 'approved Payment';

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
                    {/* Stats Grid - Enhanced DashboardCard Components */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        {/* For Approvals Card */}
                        {hasPermission('dashboard:widget:pending_approvals') && (
                            <DashboardCard
                                id="for-approvals"
                                label="For Approvals"
                                value={pendingCount.toString()}
                                route="/procurement-approvals"
                                icon={Clock}
                                progress={Math.min(pendingCount * 10, 100)}
                                sparklineData={[5, 12, 8, 15, 10, pendingCount]}
                                gradientColors={['#f97316', '#eab308']}
                                iconColor="text-orange-400"
                                sparklineColor="#f97316"
                                urgency={pendingCount > 5 ? 'critical' : pendingCount > 2 ? 'warning' : 'normal'}
                                trendPercent={pendingCount > 0 ? 15 : 0}
                                trend={pendingCount > 3 ? 'up' : 'neutral'}
                                previewItems={pendingApprovals.slice(0, 3).map(r => ({
                                    id: r.id,
                                    title: r.id,
                                    subtitle: `₱${r.rawRequisition.totalAmount.toLocaleString()}`
                                }))}
                                breakdown={[
                                    { label: 'Mgr BURF', count: requisitions.filter(r => r.status === RequisitionStatus.BURF_PENDING_MANAGER).length, color: 'text-orange-400' },
                                    { label: 'CIC BURF', count: requisitions.filter(r => r.status === RequisitionStatus.BURF_PENDING_CIC).length, color: 'text-amber-400' },
                                    { label: 'Mgr PRF', count: requisitions.filter(r => r.status === RequisitionStatus.PRF_PENDING_MANAGER).length, color: 'text-blue-400' },
                                    ...(hasPermission('finance:release_funds') ? [{ label: 'Fund Rel', count: requisitions.filter(r => r.status === RequisitionStatus.APPROVED_FOR_PAYMENT).length, color: 'text-emerald-400' }] : [])
                                ]}
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
                                <div className="p-6 flex justify-between items-center border-b border-slate-700/50">
                                    <h2 className="text-lg font-bold text-white">Pending Approvals</h2>
                                    <button onClick={() => navigate('/procurement-approvals')} className="text-xs font-medium bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-full text-white transition-colors">View All</button>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
                                    <div className="space-y-4">
                                        {pendingApprovals.map(activity => (
                                            <div
                                                key={activity.id}
                                                onClick={() => navigate('/procurement-approvals')}
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
                                        {pendingApprovals.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                                <Clock size={48} className="mb-4 opacity-20" />
                                                <p className="text-sm">You're all caught up! No pending approvals.</p>
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
                        onConfirm={(chequeNumber, chequeImageUrl) => {
                            const updatedReq = {
                                ...releaseFundReq,
                                status: RequisitionStatus.FUNDS_RELEASED,
                                fundReleaseDate: new Date().toISOString(),
                                chequeNumber,
                                chequeImageUrl
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
