import React, { useState } from 'react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus, UserRole } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import Card from '../../../shared/components/Card';
import ReleaseFundModal from '../components/ReleaseFundModal';
import { hasGlobalAccess } from '../../procurement/types';
import { ExternalLink } from 'lucide-react';

interface FinanceViewProps {
    currentUser: User;
    requisitions: Requisition[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    handleReleaseFunds: (id: string, chequeNumber: string, chequeImageUrl?: string) => void;
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
    const [activeTab, setActiveTab] = useState<'pending' | 'released'>('pending');

    // Allow Super Admin AND Finance role (or anyone with finance:release_funds implicitly via role check)
    // In types.ts, hasGlobalAccess is strict to Super Admin.
    const canView = hasGlobalAccess(currentUser.role) || currentUser.role === UserRole.FINANCE;

    if (!canView) {
        return (
            <div className="text-center text-slate-400">You do not have permission to view this page.</div>
        );
    }

    const handleRelease = (req: Requisition) => {
        setSelectedReq(req);
        setReleaseModalOpen(true);
    };

    const confirmRelease = (chequeNumber: string, chequeImageUrl: string) => {
        if (selectedReq) {
            handleReleaseFunds(selectedReq.id, chequeNumber, chequeImageUrl);
            setReleaseModalOpen(false);
            setSelectedReq(null);
        }
    };

    // Filter for approved requisitions awaiting fund release
    const pendingReleaseReqs = requisitions.filter(
        req => req.status === RequisitionStatus.APPROVED_FOR_PAYMENT
    );

    // Filter for released requisitions
    const releasedReqs = requisitions.filter(
        req => [
            RequisitionStatus.FUNDS_RELEASED,
            RequisitionStatus.LIQUIDATION_FILED,
            RequisitionStatus.LIQUIDATION_REJECTED,
            RequisitionStatus.AUDITED_CLEARED
        ].includes(req.status)
    ).sort((a, b) => new Date(b.fundReleaseDate || b.timestamp).getTime() - new Date(a.fundReleaseDate || a.timestamp).getTime());

    const displayedReqs = activeTab === 'pending' ? pendingReleaseReqs : releasedReqs;

    return (
        <>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Finance - Fund Release</h1>
                    <p className="text-slate-400 text-sm">Release funds for approved PRF requisitions.</p>
                </div>

                <div className="flex border-b border-slate-700 mb-4">
                    <button
                        className={`py-2 px-4 text-sm font-medium ${activeTab === 'pending'
                            ? 'border-b-2 border-purple-500 text-purple-400'
                            : 'text-slate-400 hover:text-slate-300'
                            }`}
                        onClick={() => setActiveTab('pending')}
                    >
                        Pending Release ({pendingReleaseReqs.length})
                    </button>
                    <button
                        className={`py-2 px-4 text-sm font-medium ${activeTab === 'released'
                            ? 'border-b-2 border-purple-500 text-purple-400'
                            : 'text-slate-400 hover:text-slate-300'
                            }`}
                        onClick={() => setActiveTab('released')}
                    >
                        Released History
                    </button>
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
                                <th className="px-6 py-4">{activeTab === 'pending' ? 'Date Approved' : 'Date Released'}</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {displayedReqs.map(req => (
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
                                        ₱{req.totalAmount?.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">
                                        {activeTab === 'pending'
                                            ? new Date(req.dateCreated).toLocaleDateString() // Ideally this should be approval date, but dateCreated is close enough for pending
                                            : (req.fundReleaseDate ? new Date(req.fundReleaseDate).toLocaleDateString() : '-')
                                        }
                                    </td>
                                    <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                                    <td className="px-6 py-4 text-right">
                                        {activeTab === 'pending' ? (
                                            <button
                                                onClick={() => handleRelease(req)}
                                                className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 font-medium"
                                            >
                                                Release Fund
                                            </button>
                                        ) : (
                                           <div className="flex flex-col items-end gap-1">
                                                <span className="text-xs text-slate-400">Cheque: <span className="text-white font-mono">{req.chequeNumber || '-'}</span></span>
                                                {req.chequeImageUrl && (
                                                    <a
                                                        href={req.chequeImageUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 underline"
                                                    >
                                                        <ExternalLink size={10} /> View Cheque
                                                    </a>
                                                )}
                                           </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {displayedReqs.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">
                                        {activeTab === 'pending' ? 'No requisitions pending fund release.' : 'No released funds history found.'}
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
