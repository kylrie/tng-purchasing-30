import React, { useMemo, useState } from 'react';
import { Activity, Clock, User, Filter, Search, RefreshCw } from 'lucide-react';
import type { Requisition, RequisitionHistory, User as UserType, Business } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import Card from '../../../shared/components/Card';
import { useBusinessUnit } from '../../../contexts/BusinessUnitContext';

interface ActivityLogViewProps {
    requisitions: Requisition[];
    allUsers: UserType[];
    businesses: Business[];
}

// Activity entry combining requisition info with history entry
interface ActivityEntry {
    requisitionId: string;
    requisitionDescription: string;
    businessId: string;
    timestamp: string;
    date: string;
    actorId: string;
    actorName: string;
    action: string;
    stage: RequisitionStatus;
    comments?: string;
}

// Format timestamp with date and time
const formatDateTime = (timestamp: string | undefined, legacyDate: string): string => {
    if (timestamp) {
        const parsed = new Date(timestamp);
        if (!isNaN(parsed.getTime())) {
            return parsed.toLocaleString('en-US', {
                month: 'short', day: '2-digit', year: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true
            });
        }
    }

    if (legacyDate) {
        const parsed = new Date(legacyDate);
        if (!isNaN(parsed.getTime())) {
            if (legacyDate.includes('T')) {
                return parsed.toLocaleString('en-US', {
                    month: 'short', day: '2-digit', year: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true
                });
            }
            return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + ' (Time not available)';
        }
    }

    return '-';
};

// Get action color based on action type
const getActionColor = (action: string): string => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('approve')) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    if (lowerAction.includes('reject')) return 'text-red-400 bg-red-500/20 border-red-500/30';
    if (lowerAction.includes('cancel')) return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    if (lowerAction.includes('created') || lowerAction.includes('submit')) return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    if (lowerAction.includes('release') || lowerAction.includes('fund')) return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
    if (lowerAction.includes('liquidation')) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    if (lowerAction.includes('prf') || lowerAction.includes('convert')) return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
    return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
};

const ActivityLogView: React.FC<ActivityLogViewProps> = ({ requisitions, allUsers, businesses }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const { selectedBusinessUnit } = useBusinessUnit();
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('week');

    // Extract all activity entries from all requisitions
    const allActivities: ActivityEntry[] = useMemo(() => {
        const activities: ActivityEntry[] = [];

        requisitions.forEach(req => {
            if (req.history && Array.isArray(req.history)) {
                req.history.forEach((entry: RequisitionHistory) => {
                    activities.push({
                        requisitionId: req.id,
                        requisitionDescription: req.description || 'No description',
                        businessId: req.businessId,
                        timestamp: entry.timestamp || '',
                        date: entry.date,
                        actorId: entry.actorId,
                        actorName: entry.actorName || 'System',
                        action: entry.action,
                        stage: entry.stage,
                        comments: entry.comments,
                    });
                });
            }
        });

        // Sort by timestamp (newest first)
        return activities.sort((a, b) => {
            const dateA = new Date(a.timestamp || a.date).getTime();
            const dateB = new Date(b.timestamp || b.date).getTime();
            return dateB - dateA;
        });
    }, [requisitions]);

    // Get unique actions for filter dropdown
    const uniqueActions = useMemo(() => {
        const actions = new Set(allActivities.map(a => a.action));
        return Array.from(actions).sort();
    }, [allActivities]);

    // Filter activities
    const filteredActivities = useMemo(() => {
        return allActivities.filter(activity => {
            // Date range filter
            if (dateRange !== 'all') {
                const activityDate = new Date(activity.timestamp || activity.date);
                const now = new Date();

                if (dateRange === 'today') {
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    if (activityDate < today) return false;
                } else if (dateRange === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    if (activityDate < weekAgo) return false;
                } else if (dateRange === 'month') {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    if (activityDate < monthAgo) return false;
                }
            }

            // Business unit filter
            if (selectedBusinessUnit !== 'all' && activity.businessId !== selectedBusinessUnit) {
                return false;
            }

            // Action filter
            if (actionFilter !== 'all' && activity.action !== actionFilter) {
                return false;
            }

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    activity.requisitionId.toLowerCase().includes(term) ||
                    activity.requisitionDescription.toLowerCase().includes(term) ||
                    activity.actorName.toLowerCase().includes(term) ||
                    activity.action.toLowerCase().includes(term)
                );
            }

            return true;
        });
    }, [allActivities, dateRange, selectedBusinessUnit, actionFilter, searchTerm]);

    return (
        <div className="space-y-6 text-white animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <Activity className="text-purple-400" size={28} />
                        Activity Log
                    </h1>
                    <p className="text-slate-400 text-sm">
                        System-wide audit trail of all requisition actions. <span className="text-purple-400 font-medium">SuperAdmin Only</span>
                    </p>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <RefreshCw size={14} />
                    <span>{filteredActivities.length.toLocaleString()} entries</span>
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* Date Range Filter */}
                <div className="relative">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as any)}
                        className="appearance-none pl-4 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                        <option value="today">Today</option>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="all">All Time</option>
                    </select>
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>

                {/* Action Filter */}
                <div className="relative">
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="appearance-none pl-4 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                        <option value="all">All Actions</option>
                        {uniqueActions.map(action => (
                            <option key={action} value={action}>{action}</option>
                        ))}
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by ID, description, or user..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm w-full focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                    />
                </div>
            </div>

            {/* Activity Table */}
            <Card className="overflow-hidden !p-0">
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-20 backdrop-blur-sm">
                            <tr>
                                <th className="px-6 py-4">Timestamp</th>
                                <th className="px-6 py-4">Requisition</th>
                                <th className="px-6 py-4">Business Unit</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredActivities.map((activity, index) => {
                                const business = businesses.find(b => b.id === activity.businessId);
                                const user = allUsers.find(u => u.id === activity.actorId);

                                return (
                                    <tr key={`${activity.requisitionId}-${index}`} className="hover:bg-slate-800/60 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-slate-500" />
                                                <span className="text-slate-300 text-xs">
                                                    {formatDateTime(activity.timestamp, activity.date)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <span className="font-medium text-white">{activity.requisitionId}</span>
                                                <p className="text-xs text-slate-500 truncate max-w-[150px]">{activity.requisitionDescription}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-slate-400">{business?.name || 'N/A'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getActionColor(activity.action)}`}>
                                                {activity.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {user?.avatar ? (
                                                    <img src={user.avatar} alt={activity.actorName} className="w-6 h-6 rounded-full" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                                                        <User size={12} className="text-slate-400" />
                                                    </div>
                                                )}
                                                <span className="text-slate-300">{activity.actorName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {activity.comments ? (
                                                <span className="text-xs text-slate-500 italic truncate max-w-[150px] block">
                                                    "{activity.comments}"
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-600">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredActivities.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                                        <Activity size={48} className="mx-auto mb-3 text-slate-600" />
                                        No activity entries found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default ActivityLogView;
