import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Clock,
    AlertCircle,
    ArrowUpRight,
    FileText,
    DollarSign
} from 'lucide-react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import type { User } from '../../../shared/types';
import { usePermissions } from '../../../hooks/usePermissions';

interface DashboardViewProps {
    requisitions: Requisition[];
    currentUser: User;
    allUsers: User[];
}

const DashboardView: React.FC<DashboardViewProps> = ({ requisitions, currentUser, allUsers }) => {
    const navigate = useNavigate();
    const { hasPermission } = usePermissions();

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

    const activePRFs = requisitions.filter(r =>
        [RequisitionStatus.READY_FOR_PRF, RequisitionStatus.PRF_PENDING_MANAGER, RequisitionStatus.APPROVED_FOR_PAYMENT].includes(r.status)
    ).length;

    const totalSpend = requisitions
        .filter(r => [RequisitionStatus.APPROVED_FOR_PAYMENT, RequisitionStatus.FUNDS_RELEASED, RequisitionStatus.LIQUIDATION_FILED, RequisitionStatus.AUDITED_CLEARED].includes(r.status))
        .reduce((sum, r) => sum + r.totalAmount, 0);

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
                status: r.status
            };
        });

    // Calculate Liquidation Stat based on role
    let liquidationStat = {
        label: 'Liquidations',
        value: '0',
        change: 'Total',
        trend: 'neutral',
        icon: AlertCircle,
        color: 'text-slate-400',
        bg: 'bg-slate-900/50',
        route: '/liquidation'
    };

    if (hasPermission('liquidation:audit')) {
        const pendingAuditCount = requisitions.filter(r => r.status === RequisitionStatus.LIQUIDATION_FILED).length;
        liquidationStat = {
            label: 'Pending Audit',
            value: pendingAuditCount.toString(),
            change: 'Needs Review',
            trend: pendingAuditCount > 0 ? 'up' : 'neutral',
            icon: AlertCircle,
            color: 'text-orange-400',
            bg: 'bg-orange-900/50',
            route: '/liquidation'
        };
    } else if (hasPermission('liquidation:file:own') || hasPermission('liquidation:file:all')) {
        const toFileCount = requisitions.filter(r =>
            (r.status === RequisitionStatus.FUNDS_RELEASED || r.status === RequisitionStatus.LIQUIDATION_REJECTED) &&
            (hasPermission('liquidation:file:all') || r.requesterId === currentUser.id)
        ).length;

        liquidationStat = {
            label: 'To Liquidate',
            value: toFileCount.toString(),
            change: 'Action Required',
            trend: toFileCount > 0 ? 'up' : 'neutral',
            icon: AlertCircle,
            color: 'text-cyan-400',
            bg: 'bg-cyan-900/50',
            route: '/liquidation'
        };
    }

    // New Card for Liquidation Filing (Purchaser)
    // Assuming 'liquidation:file:all' or specific role check if needed, but 'liquidationStat' covers general liquidation.
    // The user asked for "another card that is link for Liquidation filing of the purchaser".
    // "To Liquidate" card above effectively does this for users who need to file.
    // If we need a specific "Purchaser Liquidation" link, we can add it or modify the logic.
    // Let's assume the user wants an explicit quick link if they have the right permission.
    
    // Actually, looking at the code, `liquidationStat` is already dynamically creating a card for Liquidation.
    // If the user wants a *separate* Quick Action link, I'll add it there.
    // If they want a separate Stat Card, I can add one.
    // Given the phrasing "in dashboard add another card that is link for Liquidation filing", I'll add a Quick Action button.
    
    // Wait, the previous instruction was about the stat card.
    // "in dashboard add another card that is link for Liquidation filing of the purchaser"
    // I will add a Quick Action button for this specific purpose if it's not already covered clearly.
    // The existing "View Liquidations" button goes to `/liquidation`.
    // I will add a specific "File Liquidation" button if there are items to liquidate.

    const itemsToLiquidateCount = requisitions.filter(r =>
        (r.status === RequisitionStatus.FUNDS_RELEASED || r.status === RequisitionStatus.LIQUIDATION_REJECTED) &&
        (hasPermission('liquidation:file:all') || r.requesterId === currentUser.id)
    ).length;

    const stats = [
        {
            label: 'Pending Approvals',
            value: pendingCount.toString(),
            change: 'Active',
            trend: 'neutral',
            icon: Clock,
            color: 'text-orange-400',
            bg: 'bg-orange-900/50',
            route: '/procurement-approvals'
        },
        {
            label: 'Active PRFs',
            value: activePRFs.toString(),
            change: 'In Progress',
            trend: 'up',
            icon: FileText,
            color: 'text-blue-400',
            bg: 'bg-blue-900/50',
            route: '/prf'
        },
        {
            label: 'Total Spend (Est)',
            value: `₱${(totalSpend / 1000).toFixed(1)}k`,
            change: 'MTD',
            trend: 'down',
            icon: DollarSign,
            color: 'text-emerald-400',
            bg: 'bg-emerald-900/50',
            route: '/liquidation'
        },
        liquidationStat
    ];

    // Filter stats for non-approvers
    const visibleStats = isApprover ? stats : stats.filter(s => s.label !== 'Pending Approvals');

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

            {/* Stats Grid */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${isApprover ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
                {visibleStats.map((stat, index) => (
                    <button
                        key={index}
                        onClick={() => navigate(stat.route)}
                        className={`bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 shadow-lg hover:border-purple-500/50 hover:shadow-purple-500/20 transition-all cursor-pointer group text-left w-full`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-lg ${stat.bg} group-hover:scale-110 transition-transform`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div className={`flex items-center text-xs font-medium ${stat.trend === 'up' ? 'text-green-400' : stat.trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
                                {stat.change}
                            </div>
                        </div>
                        <h3 className="text-slate-300 text-sm font-medium mb-1 group-hover:text-white transition-colors">{stat.label}</h3>
                        <p className="text-3xl font-bold text-white">{stat.value}</p>
                    </button>
                ))}
            </div>

            <div className={`grid grid-cols-1 ${isApprover ? 'lg:grid-cols-3' : 'lg:grid-cols-1 max-w-4xl mx-auto'} gap-8`}>
                {/* Pending Approvals - Only visible to approvers */}
                {isApprover && (
                    <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg flex flex-col">
                        <div className="p-6 flex justify-between items-center border-b border-slate-700/50">
                            <h2 className="text-lg font-bold text-white">Pending Approvals</h2>
                            <button onClick={() => navigate('/procurement-approvals')} className="text-xs font-medium bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-full text-white transition-colors">View All</button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
                            <div className="space-y-4">
                                {pendingApprovals.map(activity => (
                                    <div key={activity.id} className="flex gap-4 items-center p-3 rounded-xl hover:bg-slate-700/30 transition-colors border border-transparent hover:border-slate-700">
                                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm flex-shrink-0">
                                            {activity.avatar}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-200 truncate">
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

                {/* Quick Actions */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg h-fit">
                    <div className="p-6 border-b border-slate-700/50">
                        <h2 className="text-lg font-bold text-white">Quick Actions</h2>
                    </div>
                    <div className="p-6 space-y-3">
                        <button
                            onClick={() => navigate('/burf')}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700/50 hover:from-purple-900/40 hover:to-purple-800/40 border border-slate-600/50 hover:border-purple-500/50 transition-all group"
                        >
                            <span className="text-sm font-medium text-slate-200 group-hover:text-white">Create New BURF</span>
                            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-purple-300 transition-transform group-hover:rotate-45" />
                        </button>
                        
                        {/* Modified Liquidation Action */}
                        <button
                            onClick={() => navigate('/liquidation')}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700/50 hover:from-cyan-900/40 hover:to-cyan-800/40 border border-slate-600/50 hover:border-cyan-500/50 transition-all group"
                        >
                            <span className="text-sm font-medium text-slate-200 group-hover:text-white">View Liquidations</span>
                            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-300 transition-transform group-hover:rotate-45" />
                        </button>

                        {/* Explicit File Liquidation Action if Pending Items Exist */}
                        {itemsToLiquidateCount > 0 && (
                             <button
                                onClick={() => navigate('/liquidation')}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-900/20 to-cyan-800/20 hover:from-cyan-800/40 hover:to-cyan-700/40 border border-cyan-500/50 hover:border-cyan-400 transition-all group"
                            >
                                <div>
                                    <span className="text-sm font-bold text-cyan-400 group-hover:text-cyan-300">File Liquidation</span>
                                    <span className="block text-xs text-slate-400">{itemsToLiquidateCount} item(s) pending</span>
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-cyan-500 group-hover:text-cyan-300 transition-transform group-hover:rotate-45" />
                            </button>
                        )}

                        {hasPermission('supplier:view') && (
                            <button
                                onClick={() => navigate('/suppliers')}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700/50 hover:from-emerald-900/40 hover:to-emerald-800/40 border border-slate-600/50 hover:border-emerald-500/50 transition-all group"
                            >
                                <span className="text-sm font-medium text-slate-200 group-hover:text-white">Manage Suppliers</span>
                                <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-300 transition-transform group-hover:rotate-45" />
                            </button>
                        )}
                         {hasPermission('admin:manage:users') && (
                            <button
                                onClick={() => navigate('/settings')}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700/50 hover:from-blue-900/40 hover:to-blue-800/40 border border-slate-600/50 hover:border-blue-500/50 transition-all group"
                            >
                                <span className="text-sm font-medium text-slate-200 group-hover:text-white">System Settings</span>
                                <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-blue-300 transition-transform group-hover:rotate-45" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
