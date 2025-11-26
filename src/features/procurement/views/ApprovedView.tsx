import React, { useState, useMemo } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import type { Requisition, Business, User } from '../../../shared/types';
import { RequisitionStatus, hasGlobalAccess } from '../types';
import Card from '../../../shared/components/Card';

interface ApprovedViewProps {
    currentUser: User;
    requisitions: Requisition[];
    allUsers: User[];
    businesses: Business[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
}

export const ApprovedView: React.FC<ApprovedViewProps> = ({
    currentUser,
    requisitions,
    allUsers,
    businesses,
    getStatusBadge
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all'); // all, burf, prf

    // Approved statuses to show
    const approvedStatuses = [
        RequisitionStatus.READY_FOR_PRF,
        RequisitionStatus.APPROVED_FOR_PAYMENT,
        RequisitionStatus.FUNDS_RELEASED,
        RequisitionStatus.LIQUIDATION_FILED,
        RequisitionStatus.AUDITED_CLEARED
    ];

    const filteredRequisitions = useMemo(() => {
        return requisitions.filter(req => {
            // 1. Filter by Approved Statuses
            if (!approvedStatuses.includes(req.status)) return false;

            // 2. Filter by Type (BURF or PRF)
            if (typeFilter === 'burf' && (req.id.startsWith('PRF') || req.status === RequisitionStatus.PRF_PENDING_MANAGER)) return false;
            if (typeFilter === 'prf' && !req.id.startsWith('PRF') && req.status !== RequisitionStatus.PRF_PENDING_MANAGER) return false;

            // 3. Filter by Business Unit
            const hasGlobal = hasGlobalAccess(currentUser.role);
            if (hasGlobal) {
                if (selectedBusinessUnit !== 'all' && req.businessId !== selectedBusinessUnit) return false;
            } else {
                if (req.businessId !== currentUser.businessId) return false;
            }

            // 4. Search Filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const requester = allUsers.find(u => u.id === req.requesterId)?.name.toLowerCase() || '';
                const business = businesses.find(b => b.id === req.businessId)?.name.toLowerCase() || '';

                return (
                    req.id.toLowerCase().includes(term) ||
                    req.description.toLowerCase().includes(term) ||
                    requester.includes(term) ||
                    business.includes(term)
                );
            }

            return true;
        }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
    }, [requisitions, approvedStatuses, typeFilter, selectedBusinessUnit, searchTerm, currentUser, allUsers, businesses]);

    return (
        <div className="space-y-6 text-white animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Approved Requisitions</h1>
                    <p className="text-slate-400 text-sm">View all approved PRF and BURF requisitions.</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    {/* Business Unit Filter (Global Roles Only) */}
                    {hasGlobalAccess(currentUser.role) && (
                        <div className="relative">
                            <select
                                value={selectedBusinessUnit}
                                onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                                className="appearance-none pl-4 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            >
                                <option value="all">All Business Units</option>
                                {businesses.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    )}

                    {/* Type Filter */}
                    <div className="relative">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="appearance-none pl-4 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        >
                            <option value="all">All Types</option>
                            <option value="burf">BURF Only</option>
                            <option value="prf">PRF Only</option>
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search ID, Desc, User..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm w-64 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder-slate-500"
                        />
                    </div>
                </div>
            </div>

            <Card className="overflow-hidden !p-0">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Business Unit</th>
                            <th className="px-6 py-4">Requester</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {filteredRequisitions.map(req => {
                            const requester = allUsers.find(u => u.id === req.requesterId);
                            const business = businesses.find(b => b.id === req.businessId);
                            const isPrf = req.id.startsWith('PRF') || req.status === RequisitionStatus.PRF_PENDING_MANAGER;

                            return (
                                <tr key={req.id} className="hover:bg-slate-800/60 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{req.id}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${isPrf ? 'bg-purple-500/20 text-purple-300' : 'bg-orange-500/20 text-orange-300'}`}>
                                            {isPrf ? 'PRF' : 'BURF'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        <div className="truncate max-w-[200px]" title={req.description}>{req.description}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">{business?.name || 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                                {(requester?.name || '?').charAt(0)}
                                            </div>
                                            <span className="text-slate-300">{requester?.name || 'Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-emerald-400 font-semibold">
                                        ₱{req.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">
                                        {new Date(req.dateCreated).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(req.status)}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredRequisitions.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">
                                    No approved requisitions found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};

export default ApprovedView;
