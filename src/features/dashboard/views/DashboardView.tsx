import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight,
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
}

const DashboardView: React.FC<DashboardViewProps> = ({ requisitions, currentUser }) => {
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
        // Employee sees their own pending requests? Or maybe count of their requests in progress?
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

    // Recent Activity - Derived from latest requisitions
    const recentActivity = [...requisitions]
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
        .slice(0, 5)
        .map(r => {
            let action = 'created request';
            if (r.status === RequisitionStatus.BURF_PENDING_MANAGER) action = 'submitted BURF';
            if (r.status === RequisitionStatus.PRF_PENDING_MANAGER) action = 'submitted PRF';
            if (r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) action = 'approved PRF';

            return {
                id: r.id,
                user: r.requesterId, // In a real app, we would map ID to Name
                action: action,
                target: r.projectName || r.description,
                time: new Date(r.dateCreated).toLocaleDateString(),
                avatar: (r.requesterId || '?').charAt(0).toUpperCase(),
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
            color: 'text-orange-600',
            bg: 'bg-orange-50'
        },
        {
            label: 'Active PRFs',
            value: activePRFs.toString(),
            change: 'In Progress',
            trend: 'up',
            icon: FileText,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            label: 'Total Spend (Est)',
            value: `₱${(totalSpend / 1000).toFixed(1)}k`,
            change: 'MTD',
            trend: 'down',
            icon: DollarSign,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50'
        },
        {
            label: 'Critical Stock',
            value: '0', // Mock for now as we don't track inventory levels deeply yet
            change: 'Stable',
            trend: 'neutral',
            icon: AlertCircle,
            color: 'text-red-600',
            bg: 'bg-red-50'
        }
    ];

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
                <p className="text-slate-500">Welcome back, {currentUser.name}! Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div className={`flex items-center text-xs font-medium text-slate-500`}>
                                {stat.change}
                            </div>
                        </div>
                        <h3 className="text-slate-500 text-sm font-medium mb-1">{stat.label}</h3>
                        <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800">Recent Activity</h2>
                        <button onClick={() => navigate('/burf')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</button>
                    </div>
                    <div className="p-6">
                        <div className="space-y-6">
                            {recentActivity.map((activity) => (
                                <div key={activity.id} className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs flex-shrink-0">
                                        {activity.avatar}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-800">
                                            <span className="font-semibold">{activity.user}</span> {activity.action} <span className="font-medium text-slate-900">"{activity.target}"</span>
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">{activity.time} • <span className="uppercase">{activity.status.replace(/_/g, ' ')}</span></p>
                                    </div>
                                </div>
                            ))}
                            {recentActivity.length === 0 && (
                                <p className="text-slate-500 text-center text-sm">No recent activity.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-fit">
                    <div className="p-6 border-b border-gray-50">
                        <h2 className="text-lg font-bold text-slate-800">Quick Actions</h2>
                    </div>
                    <div className="p-6 space-y-3">
                        <button
                            onClick={() => navigate('/burf')}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                        >
                            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">Create New BURF</span>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                        </button>
                        <button
                            onClick={() => navigate('/liquidation')}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-all group"
                        >
                            <span className="text-sm font-medium text-slate-700 group-hover:text-orange-700">View Liquidations</span>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-orange-500" />
                        </button>
                        <button
                            onClick={() => navigate('/suppliers')}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                        >
                            <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700">Manage Suppliers</span>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
