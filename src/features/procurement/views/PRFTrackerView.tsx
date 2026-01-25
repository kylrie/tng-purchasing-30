import React, { useState, useMemo } from 'react';
import { Search, RefreshCw, AlertTriangle, Building2 } from 'lucide-react';
import type { Requisition, User, Business } from '../types';
import { RequisitionStatus } from '../types';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import PRFPrintModal from '../components/PRFPrintModal';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { usePermissions } from '../../../hooks/usePermissions';

interface PRFTrackerViewProps {
    currentUser: User;
    requisitions: Requisition[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    businesses: Business[];
    allUsers: User[];
}

// Define workflow columns
const WORKFLOW_COLUMNS = [
    { id: 'step1', label: 'Pending Manager', statuses: [RequisitionStatus.PRF_PENDING_MANAGER], color: 'orange' },
    { id: 'step2', label: 'Pending GM PRF', statuses: [RequisitionStatus.PENDING_GM_PRF_APPROVAL], color: 'yellow' },
    { id: 'step3', label: 'Finance Head BR', statuses: [RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL], color: 'indigo' },
    { id: 'step4', label: 'GM Budget', statuses: [RequisitionStatus.PENDING_GM_BR_APPROVAL], color: 'violet' },
    { id: 'step5', label: 'BOD Approval', statuses: [RequisitionStatus.PENDING_BOD_APPROVAL], color: 'fuchsia' },
    { id: 'step6', label: 'Check Prep', statuses: [RequisitionStatus.FOR_CHECK_PREPARATION], color: 'cyan' },
    { id: 'step7', label: 'Check Auth', statuses: [RequisitionStatus.PENDING_CHECK_AUTH_BOD], color: 'amber' },
    { id: 'step8', label: 'For Release', statuses: [RequisitionStatus.FOR_FUND_RELEASE, RequisitionStatus.APPROVED_FOR_PAYMENT], color: 'teal' },
    { id: 'completed', label: 'Completed', statuses: [RequisitionStatus.FUNDS_RELEASED, RequisitionStatus.LIQUIDATION_FILED, RequisitionStatus.AUDITED_CLEARED], color: 'emerald' },
];

// All trackable statuses (PRF workflow + Legacy + Completed)
const TRACKABLE_STATUSES = WORKFLOW_COLUMNS.flatMap(col => col.statuses);

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

const PRFTrackerView: React.FC<PRFTrackerViewProps> = ({
    currentUser,
    requisitions,
    getStatusBadge,
    businesses,
    allUsers,
}) => {
    const { hasPermission } = usePermissions();
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [businessFilter, setBusinessFilter] = useState<string>('all');
    const [drawerReq, setDrawerReq] = useState<Requisition | null>(null);
    const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine');
    const [printReq, setPrintReq] = useState<Requisition | null>(null);

    // Check if user is admin
    const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';

    // Compute user's accessible business units
    const userBusinessUnitIds = useMemo(() => {
        const buIds = new Set<string>();
        if (currentUser.businessId) buIds.add(currentUser.businessId);
        if (Array.isArray(currentUser.businessUnitIds)) {
            currentUser.businessUnitIds.forEach(id => buIds.add(id));
        }
        return buIds;
    }, [currentUser.businessId, currentUser.businessUnitIds]);

    // Filter requisitions based on view mode and permissions
    const myRequisitions = useMemo(() => {
        return requisitions.filter(req => {
            // Must be in a trackable status
            if (!TRACKABLE_STATUSES.includes(req.status)) return false;

            // Admins see all
            if (isAdmin) return true;

            // "View All" mode - show all within user's assigned BUs
            if (viewMode === 'all' && hasPermission('prf_tracker:view:all')) {
                return userBusinessUnitIds.has(req.businessId);
            }

            // "My Requests" mode - user is requester or preparer
            if (req.requesterId === currentUser.id) return true;
            if (req.prfDetails?.preparedBy === currentUser.id) return true;

            return false;
        });
    }, [requisitions, currentUser.id, isAdmin, viewMode, hasPermission, userBusinessUnitIds]);

    // Apply search and business filter
    const filteredReqs = useMemo(() => {
        let result = myRequisitions;

        // Apply business filter
        if (businessFilter !== 'all') {
            result = result.filter(req => req.businessId === businessFilter);
        }

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(req =>
                req.id.toLowerCase().includes(term) ||
                req.description?.toLowerCase().includes(term) ||
                businesses.find(b => b.id === req.businessId)?.name.toLowerCase().includes(term)
            );
        }

        // Apply date filter
        if (dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);

            result = result.filter(req => {
                const reqDate = new Date(req.dateCreated);
                return reqDate >= start && reqDate <= end;
            });
        }

        return result;
    }, [myRequisitions, searchTerm, businessFilter, businesses, dateRange]);

    // Get businesses that have requisitions (for filter dropdown)
    const availableBusinesses = useMemo(() => {
        const businessIds = new Set(myRequisitions.map(r => r.businessId));
        return businesses.filter(b => businessIds.has(b.id));
    }, [myRequisitions, businesses]);

    // Group by column
    const columnData = useMemo(() => {
        return WORKFLOW_COLUMNS.map(col => ({
            ...col,
            items: filteredReqs.filter(req => col.statuses.includes(req.status))
        }));
    }, [filteredReqs]);

    const getColumnHeaderStyles = (color: string) => {
        const styles: Record<string, string> = {
            orange: 'bg-orange-50 dark:bg-orange-900/20',
            amber: 'bg-amber-50 dark:bg-amber-900/20',
            indigo: 'bg-indigo-50 dark:bg-indigo-900/20',
            violet: 'bg-violet-50 dark:bg-violet-900/20',
            rose: 'bg-rose-50 dark:bg-rose-900/20',
            cyan: 'bg-cyan-50 dark:bg-cyan-900/20',
            emerald: 'bg-emerald-50 dark:bg-emerald-900/20',
            purple: 'bg-purple-50 dark:bg-purple-900/20',
            blue: 'bg-blue-50 dark:bg-blue-900/20',
        };
        return styles[color] || 'bg-slate-50 dark:bg-slate-800/30';
    };

    const getColumnTitleStyles = (color: string) => {
        const styles: Record<string, string> = {
            orange: 'text-orange-700 dark:text-orange-400',
            amber: 'text-amber-700 dark:text-amber-400',
            indigo: 'text-indigo-700 dark:text-indigo-400',
            violet: 'text-violet-700 dark:text-violet-400',
            rose: 'text-rose-700 dark:text-rose-400',
            cyan: 'text-cyan-700 dark:text-cyan-400',
            emerald: 'text-emerald-700 dark:text-emerald-400',
            purple: 'text-purple-700 dark:text-purple-400',
            blue: 'text-blue-700 dark:text-blue-400',
        };
        return styles[color] || 'text-slate-700 dark:text-slate-400';
    };

    const getColumnBadgeStyles = (color: string) => {
        const styles: Record<string, string> = {
            orange: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300',
            amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
            indigo: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
            violet: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300',
            rose: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300',
            cyan: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
            emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
            purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300',
            blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
        };
        return styles[color] || 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300';
    };

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">PRF Tracker</h1>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            Track your requisitions through the 8-stage approval workflow
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Business Unit Filter */}
                        <div className="relative">
                            <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                value={businessFilter}
                                onChange={(e) => setBusinessFilter(e.target.value)}
                                className="pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer min-w-[160px]"
                            >
                                <option value="all">All Business Units</option>
                                {availableBusinesses.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* Date Filter */}
                        <DateRangeFilter
                            onFilterChange={(start: string | null, end: string | null) => setDateRange({ start, end })}
                        />
                        {/* View Mode Toggle */}
                        {hasPermission('prf_tracker:view:all') && (
                            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setViewMode('mine')}
                                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'mine'
                                        ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    My Requests
                                </button>
                                <button
                                    onClick={() => setViewMode('all')}
                                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'all'
                                        ? 'bg-white dark:bg-purple-600 text-purple-600 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    View All
                                </button>
                            </div>
                        )}
                        {/* Search */}
                        <div className="relative w-full md:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by ID, description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            />
                        </div>
                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <RefreshCw size={14} className="text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                <span className="font-semibold text-slate-900 dark:text-white">{filteredReqs.length}</span> items
                            </span>
                        </div>
                    </div>
                </div>

                {/* Kanban Board */}
                <div className="overflow-x-auto pb-4">
                    <div className="flex gap-4 min-w-max">
                        {columnData.map(column => (
                            <div
                                key={column.id}
                                className="flex-shrink-0 w-72 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[calc(100vh-220px)]"
                            >
                                {/* Column Header */}
                                <div className={`p-4 border-b border-slate-200 dark:border-slate-700/50 rounded-t-xl ${getColumnHeaderStyles(column.color)}`}>
                                    <div className="flex items-center justify-between">
                                        <h3 className={`text-sm font-semibold ${getColumnTitleStyles(column.color)}`}>
                                            {column.label}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getColumnBadgeStyles(column.color)}`}>
                                            {column.items.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Column Content */}
                                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                    {column.items.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                                            No items
                                        </div>
                                    ) : (
                                        column.items.map(req => (
                                            <div
                                                key={req.id}
                                                onClick={() => setDrawerReq(req)}
                                                className="bg-white dark:bg-slate-900/60 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50 hover:border-purple-500/50 hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-all group shadow-sm"
                                            >
                                                {/* Card Header */}
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <span className="text-sm font-mono font-medium text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300">
                                                        {req.id}
                                                    </span>
                                                    {(req.isUrgent || req.priority === 'URGENT') && (
                                                        <AlertTriangle size={14} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                                                    )}
                                                </div>

                                                {/* Description */}
                                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                                                    {req.description || 'No description'}
                                                </p>

                                                {/* Amount */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-500">
                                                        {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                                    </span>
                                                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(req.totalAmount || 0)}
                                                    </span>
                                                </div>

                                                {/* Status Badge */}
                                                <div className="mt-2">
                                                    {getStatusBadge(req.status)}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Empty State */}
                {filteredReqs.length === 0 && (
                    <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                        <Search size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">No requisitions found</h3>
                        <p className="text-sm text-slate-400 dark:text-slate-500">
                            {searchTerm ? 'Try adjusting your search terms' : 'Your submitted requisitions will appear here'}
                        </p>
                    </div>
                )}
            </div>

            {/* Requisition Drawer */}
            <RequisitionDrawer
                requisition={drawerReq}
                isOpen={!!drawerReq}
                onClose={() => setDrawerReq(null)}
                variant="PRF"
                businesses={businesses}
                allUsers={allUsers}
                getStatusBadge={getStatusBadge}
                onPrint={() => drawerReq && setPrintReq(drawerReq)}
            />

            {/* PRF Print Modal */}
            {printReq && (
                <PRFPrintModal
                    req={printReq}
                    onClose={() => setPrintReq(null)}
                    business={businesses.find(b => b.id === printReq.businessId)}
                />
            )}
        </>
    );
};

export default PRFTrackerView;
