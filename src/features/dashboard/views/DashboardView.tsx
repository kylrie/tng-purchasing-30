import React from 'react';
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

const DashboardView = () => {
    const stats = [
        {
            label: 'Pending Approvals',
            value: '12',
            change: '+2.5%',
            trend: 'up',
            icon: Clock,
            color: 'text-orange-600',
            bg: 'bg-orange-50'
        },
        {
            label: 'Active PRFs',
            value: '24',
            change: '+12%',
            trend: 'up',
            icon: FileText,
            color: 'text-blue-600',
            bg: 'bg-blue-50'
        },
        {
            label: 'Total Spend (MTD)',
            value: '₱1.2M',
            change: '-4.1%',
            trend: 'down',
            icon: DollarSign,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50'
        },
        {
            label: 'Critical Stock',
            value: '3',
            change: '0%',
            trend: 'neutral',
            icon: AlertCircle,
            color: 'text-red-600',
            bg: 'bg-red-50'
        }
    ];

    const recentActivity = [
        {
            id: 1,
            user: 'Sarah Johnson',
            action: 'submitted a new BURF request',
            target: 'IT Equipment Upgrade',
            time: '2 hours ago',
            avatar: 'SJ'
        },
        {
            id: 2,
            user: 'Mike Chen',
            action: 'approved PRF #1023',
            target: 'Office Supplies Q4',
            time: '4 hours ago',
            avatar: 'MC'
        },
        {
            id: 3,
            user: 'System',
            action: 'alert: Low stock warning',
            target: 'Printer Paper A4',
            time: '5 hours ago',
            avatar: 'SYS'
        },
        {
            id: 4,
            user: 'Anna Smith',
            action: 'completed liquidation',
            target: 'Travel Expenses - Cebu',
            time: '1 day ago',
            avatar: 'AS'
        }
    ];

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
                <p className="text-slate-500">Welcome back! Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div className={`flex items-center text-xs font-medium ${stat.trend === 'up' ? 'text-emerald-600' :
                                    stat.trend === 'down' ? 'text-red-600' : 'text-slate-500'
                                }`}>
                                {stat.trend === 'up' && <ArrowUpRight className="w-3 h-3 mr-1" />}
                                {stat.trend === 'down' && <ArrowDownRight className="w-3 h-3 mr-1" />}
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
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</button>
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
                                        <p className="text-xs text-slate-400 mt-1">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-fit">
                    <div className="p-6 border-b border-gray-50">
                        <h2 className="text-lg font-bold text-slate-800">Quick Actions</h2>
                    </div>
                    <div className="p-6 space-y-3">
                        <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">Create New PRF</span>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                        </button>
                        <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition-all group">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-orange-700">Submit Liquidation</span>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-orange-500" />
                        </button>
                        <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700">Add Supplier</span>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
