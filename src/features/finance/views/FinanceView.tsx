import React, { useState } from 'react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import Card from '../../../shared/components/Card';
import ReleaseFundModal from '../components/ReleaseFundModal';
import { hasGlobalAccess } from '../../procurement/types';

interface FinanceViewProps {
    currentUser: User;
    requisitions: Requisition[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    handleReleaseFunds: (id: string, chequeNumber: string) => void;
    businesses: Business[];
    allUsers: User[];
}

export const FinanceView: React.FC<FinanceViewProps> = ({
    currentUser,
    requisitions,
    getStatusBadge,
    handleReleaseFunds,
    businesses,
    allUsers
}) => {
    const [isReleaseModalOpen, setReleaseModalOpen] = useState(false);
    const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);

    const canView = hasGlobalAccess(currentUser.role);

    if (!canView) {
        return (
            <div className="text-center text-slate-400">You do not have permission to view this page.</div>
        );
    }

    const handleRelease = (req: Requisition) => {
        setSelectedReq(req);
        setReleaseModalOpen(true);
    };

    const confirmRelease = (chequeNumber: string) => {
        if (selectedReq) {
            handleReleaseFunds(selectedReq.id, chequeNumber);
            setReleaseModalOpen(false);
            setSelectedReq(null);
        }
    };

    // Filter for approved requisitions awaiting fund release
    const pendingReleaseReqs = requisitions.filter(
        req => req.status === RequisitionStatus.APPROVED_FOR_PAYMENT
    );

    return (
        <>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Finance - Fund Release</h1>
                    <p className="text-slate-400 text-sm">Release funds for approved PRF requisitions.</p>
                </div>
                <Card className="!p-0">
                    <table className="w-full text-left text-sm text-white">
                        <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
                            <tr>
                                <th className="px-6 py-4">PRF ID</th>
                                <th className="px-6 py-4">Business Unit</th>
                                <th className="px-6 py-4">Requester</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Amount</th>
                                <th className="px-6 py-4">Date Approved</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {pendingReleaseReqs.map(req => (
                                <tr key={req.id} className="hover:bg-slate-800/60">
                                    <td className="px-6 py-4 font-medium">{req.id}</td>
                                    <td className="px-6 py-4 text-slate-300">
                                        {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        <div className="truncate max-w-[200px]" title={req.description}>
                                            {req.description}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-emerald-400 font-semibold">
                                        ₱{req.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">
                                        {new Date(req.dateCreated).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleRelease(req)}
                                            className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 font-medium"
                                        >
                                            Release Fund
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {pendingReleaseReqs.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">
                                        No requisitions pending fund release.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </Card>
            </div>
            {selectedReq && (
                <ReleaseFundModal
                    isOpen={isReleaseModalOpen}
                    onClose={() => setReleaseModalOpen(false)}
                    onConfirm={confirmRelease}
                    requisition={selectedReq}
                />
            )}
        </>
    );
};

export default FinanceView;
