// src/features/dashboard/views/DashboardView.tsx
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
import { UserRole } from '../../auth/types';

interface DashboardViewProps {
    requisitions: Requisition[];
    currentUser: User;
    allUsers: User[];
}

const DashboardView: React.FC<DashboardViewProps> = ({ requisitions, currentUser, allUsers }) => {
    const navigate = useNavigate();

    // Calculate Stats
    const pendingCount = requisitions.filter(r => {
        if (currentUser.role === UserRole.SUPER_ADMIN) {
            return [
                RequisitionStatus.BURF_PENDING_MANAGER,
                RequisitionStatus.BURF_PENDING_CIC,
                RequisitionStatus.PRF_PENDING_MANAGER,
                RequisitionStatus.APPROVED_FOR_PAYMENT
            ].includes(r.status);
        }
        if (currentUser.role === UserRole.MANAGER) {
            return r.status === RequisitionStatus.BURF_PENDING_MANAGER || r.status === RequisitionStatus.PRF_PENDING_MANAGER;
        }
        if (currentUser.role === UserRole.CIC) {
            return r.status === RequisitionStatus.BURF_PENDING_CIC;
        }
        if (currentUser.role === UserRole.PURCHASING_OFFICER) {
            return r.status === RequisitionStatus.READY_FOR_PRF;
        }
        if (currentUser.role === UserRole.FINANCE) {
            return r.status === RequisitionStatus.APPROVED_FOR_PAYMENT;
        }
        if (currentUser.role === UserRole.EMPLOYEE) {
            return r.requesterId === currentUser.id && r.status !== RequisitionStatus.DRAFT && r.status !== RequisitionStatus.FUNDS_RELEASED;
        }
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
            if (currentUser.role === UserRole.MANAGER) {
                return r.status === RequisitionStatus.BURF_PENDING_MANAGER || r.status === RequisitionStatus.PRF_PENDING_MANAGER;
            }
            if (currentUser.role === UserRole.CIC) {
                return r.status === RequisitionStatus.BURF_PENDING_CIC;
            }
            if (currentUser.role === UserRole.FINANCE) {
                return r.status === RequisitionStatus.APPROVED_FOR_PAYMENT;
            }
            if (currentUser.role === UserRole.SUPER_ADMIN) {
                return [
                    RequisitionStatus.BURF_PENDING_MANAGER,
                    RequisitionStatus.BURF_PENDING_CIC,
                    RequisitionStatus.PRF_PENDING_MANAGER,
                    RequisitionStatus.APPROVED_FOR_PAYMENT
                ].includes(r.status);
            }
            return false;
        })
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
        .slice(0, 5)
        .map(r => {
            let action = 'needs approval';
            if (r.status === RequisitionStatus.BURF_PENDING_MANAGER) action = 'approved PRF';
            if (r.status === RequisitionStatus.BURF_PENDING_CIC) action = 'approved PRF';
            if (r.status === RequisitionStatus.PRF_PENDING_MANAGER) action = 'approved PRF';
            if (r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) action = 'approved PRF';

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

    const stats = [
        {
            label: 'Pending Approvals',
            value: pendingCount.toString(),
            change: 'Active',
            trend: 'neutral',
            icon: Clock,
            color: 'text-orange-400',
            bg: 'bg-orange-900/50',
            route: '/procurement-approvals' // Navigate to Procurement Approvals module
        },
        {
            label: 'Active PRFs',
            value: activePRFs.toString(),
            change: 'In Progress',
            trend: 'up',
            icon: FileText,
            color: 'text-blue-400',
            bg: 'bg-blue-900/50',
            route: '/prf' // Navigate to PRF view
        },
        {
            label: 'Total Spend (Est)',
            value: `₱${(totalSpend / 1000).toFixed(1)}k`,
            change: 'MTD',
            trend: 'down',
            icon: DollarSign,
            color: 'text-emerald-400',
            bg: 'bg-emerald-900/50',
            route: '/liquidation' // Navigate to liquidation view for spend tracking
        },
        {
            label: 'Critical Stock',
            value: '0',
            change: 'Stable',
            trend: 'neutral',
            icon: AlertCircle,
            color: 'text-red-400',
            bg: 'bg-red-900/50',
            route: '/suppliers' // Navigate to suppliers view
        }
    ];

    return (
        <div className="space-y-8 text-white min-h-screen">
            {/* Welcome Section */}
            <div>
                <h1 className="text-2xl font-bold">Dashboard Overview</h1>
                <p className="text-slate-300">Welcome back, {currentUser.name}! Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <button
                        key={index}
                        onClick={() => navigate(stat.route)}
                        className={`bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 shadow-lg hover:border-purple-500/50 hover:shadow-purple-500/20 transition-all cursor-pointer group text-left w-full`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-lg ${stat.bg} group-hover:scale-110 transition-transform`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div className="flex items-center text-xs font-medium text-slate-400">
                                {stat.change}
                            </div>
                        </div>
                        <h3 className="text-slate-300 text-sm font-medium mb-1 group-hover:text-white transition-colors">{stat.label}</h3>
                        <p className="text-3xl font-bold text-white">{stat.value}</p>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Pending Approvals */}
                <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg">
                    <div className="p-6 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-white">Pending Approvals</h2>
                        <button onClick={() => navigate('/procurement-approvals')} className="text-sm text-purple-400 hover:text-purple-300 font-medium">View All</button>
                    </div>
                    <div className="p-6">
                        <div className="space-y-6">
                            {pendingApprovals.map(activity => (
                                <div key={activity.id} className="flex gap-4 items-center">
                                    <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300 font-bold text-sm flex-shrink-0">
                                        {activity.avatar}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-200">
                                            <span className="font-semibold text-white">{activity.user}</span> {activity.action} <span className="font-medium text-purple-300">"{activity.target}"</span>
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1"><span className="uppercase">{activity.time}</span> • <span className={`font-semibold ${activity.status.includes('PENDING') ? 'text-orange-400' : 'text-cyan-400'}`}>{activity.status.replace(/_/g, ' ')}</span></p>
                                    </div>
                                </div>
                            ))}
                            {pendingApprovals.length === 0 && (
                                <p className="text-slate-400 text-center text-sm py-4">No pending approvals.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg h-fit">
                    <div className="p-6">
                        <h2 className="text-lg font-bold text-white">Quick Actions</h2>
                    </div>
                    <div className="p-6 pt-0 space-y-3">
                        <button
                            onClick={() => navigate('/burf')}
                            className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-700/30 hover:bg-purple-600/30 border border-slate-600/50 hover:border-purple-500 transition-all group"
                        >
                            <span className="text-sm font-medium text-slate-200 group-hover:text-white">Create New BURF</span>
                            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-purple-300 transition-transform group-hover:rotate-45" />
                        </button>
                        <button
                            onClick={() => navigate('/liquidation')}
                            className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-700/30 hover:bg-cyan-600/30 border border-slate-600/50 hover:border-cyan-500 transition-all group"
                        >
                            <span className="text-sm font-medium text-slate-200 group-hover:text-white">View Liquidations</span>
                            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-300 transition-transform group-hover:rotate-45" />
                        </button>
                        <button
                            onClick={() => navigate('/suppliers')}
                            className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-700/30 hover:bg-emerald-600/30 border border-slate-600/50 hover:border-emerald-500 transition-all group"
                        >
                            <span className="text-sm font-medium text-slate-200 group-hover:text-white">Manage Suppliers</span>
                            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-300 transition-transform group-hover:rotate-45" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
