import React, { useState } from 'react';
import { Search, DollarSign } from 'lucide-react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import { UserRole } from '../../auth/types';

interface LiquidationViewProps {
    requisitions: Requisition[];
    currentUser: User;
    handleReleaseFunds: (id: string) => void;
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    businesses: Business[];
    allUsers: User[];
}

const LiquidationView: React.FC<LiquidationViewProps> = ({
    requisitions,
    currentUser,
    handleReleaseFunds,
    getStatusBadge,
    businesses,
    allUsers
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Filter requisitions for Finance dashboard (Approved for Payment and Funds Released)
    const financeRequisitions = requisitions
        .filter(r => [RequisitionStatus.APPROVED_FOR_PAYMENT, RequisitionStatus.FUNDS_RELEASED, RequisitionStatus.LIQUIDATION_FILED].includes(r.status))
        .filter(r =>
            r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.projectName || r.description).toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Liquidation & Audit</h1>
                    <p className="text-slate-500">Track and audit expenses, release funds for approved PRFs</p>
                </div>
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        className="pl-10 p-2 border border-slate-300 rounded-lg text-sm w-64"
                        placeholder="Search requisitions..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Business Unit</th>
                            <th className="px-6 py-4">Project</th>
                            <th className="px-6 py-4">Requester</th>
                            <th className="px-6 py-4">Total Amount</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {financeRequisitions.map(req => {
                            const requester = allUsers.find(u => u.id === req.requesterId);
                            const business = businesses.find(b => b.id === req.businessId);

                            return (
                                <tr key={req.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-900">{req.id}</td>
                                    <td className="px-6 py-4 text-slate-700 font-medium text-xs">
                                        {business?.name || requester?.department || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">{req.projectName || req.description}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {requester?.name.charAt(0)}
                                            </div>
                                            <span>{requester?.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-slate-900">
                                        ₱{req.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 text-xs">
                                        {new Date(req.dateCreated).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(req.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {req.status === RequisitionStatus.APPROVED_FOR_PAYMENT &&
                                            (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.FINANCE || currentUser.role === UserRole.MANAGER) && (
                                                <button
                                                    onClick={() => handleReleaseFunds(req.id)}
                                                    className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 font-medium flex items-center gap-1 ml-auto"
                                                >
                                                    <DollarSign size={14} /> Release Funds
                                                </button>
                                            )}
                                        {req.status === RequisitionStatus.FUNDS_RELEASED && (
                                            <span className="text-xs text-slate-500 italic">Funds Released</span>
                                        )}
                                        {req.status === RequisitionStatus.LIQUIDATION_FILED && (
                                            <span className="text-xs text-blue-600 font-medium">Pending Audit</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {financeRequisitions.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-slate-500 italic">
                                    No requisitions found for liquidation.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LiquidationView;
