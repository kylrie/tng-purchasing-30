import React, { useState, useMemo, useEffect } from 'react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import Card from '../../../shared/components/Card';
import ReleaseFundModal from '../components/ReleaseFundModal';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import { ExternalLink, Search, Wallet } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import { PCFService, PCFStatus, type PCFLiquidation } from '../services/pcf.service';

interface FinanceViewProps {
    currentUser: User;
    requisitions: Requisition[];
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    handleReleaseFunds: (id: string, chequeNumber: string, chequeImageUrl?: string) => void;
    businesses: Business[];
    allUsers: User[];
}

export const FinanceView: React.FC<FinanceViewProps> = ({
    requisitions,
    getStatusBadge,
    handleReleaseFunds,
    businesses,
    allUsers
}) => {
    const [isReleaseModalOpen, setReleaseModalOpen] = useState(false);
    const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);
    const [activeTab, setActiveTab] = useState<'prf_pending' | 'prf_released' | 'pcf_pending' | 'pcf_released'>('prf_pending');
    const [drawerReq, setDrawerReq] = useState<Requisition | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [pcfLiquidations, setPcfLiquidations] = useState<PCFLiquidation[]>([]);
    const { hasPermission } = usePermissions();

    // Allow Super Admin AND Finance role (or anyone with finance:release_funds implicitly via role check)
    // In types.ts, hasGlobalAccess is strict to Super Admin.
    const canView = hasPermission('module:view:finance');

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
            setDrawerReq(null); // Close drawer after release
        }
    };

    // Load PCF liquidations for PCF tabs
    useEffect(() => {
        if ((activeTab === 'pcf_pending' || activeTab === 'pcf_released') && hasPermission('module:view:pcf')) {
            const loadPcfData = async () => {
                const data = await PCFService.getAllLiquidations();
                // Filter to show approved/replenished PCF liquidations
                const pcfData = data.filter(liq =>
                    [PCFStatus.APPROVED, PCFStatus.APPROVED_WAITING_RELEASE, PCFStatus.REPLENISHED].includes(liq.status)
                );
                setPcfLiquidations(pcfData);
            };
            loadPcfData();
        }
    }, [activeTab, hasPermission]);

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

    const displayedReqs = activeTab === 'prf_pending' ? pendingReleaseReqs : releasedReqs;

    // PCF pending vs released
    const pcfPending = pcfLiquidations.filter(liq => liq.status === PCFStatus.APPROVED_WAITING_RELEASE);
    const pcfReleased = pcfLiquidations.filter(liq =>
        [PCFStatus.APPROVED, PCFStatus.REPLENISHED].includes(liq.status)
    );

    // Filter requisitions based on search term
    const filteredReqs = useMemo(() => {
        if (!searchTerm.trim()) return displayedReqs;
        const term = searchTerm.toLowerCase();
        return displayedReqs.filter(req =>
            req.id.toLowerCase().includes(term) ||
            req.description?.toLowerCase().includes(term) ||
            businesses.find(b => b.id === req.businessId)?.name.toLowerCase().includes(term) ||
            allUsers.find(u => u.id === req.requesterId)?.name.toLowerCase().includes(term)
        );
    }, [displayedReqs, searchTerm, businesses, allUsers]);

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Finance - Fund Release</h1>
                        <p className="text-slate-400 text-sm">Release funds for approved PRF requisitions.</p>
                    </div>
                    {/* Search Bar */}
                    <div className="relative w-full md:w-72">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by ID, description, BU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        />
                    </div>
                </div>

                <div className="flex border-b border-slate-700 mb-4 overflow-x-auto">
                    {/* PRF Section */}
                    <div className="flex items-center gap-1 border-r border-slate-600 pr-2 mr-2">
                        <span className="text-xs text-slate-500 px-2">PRF</span>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'prf_pending'
                                ? 'border-b-2 border-purple-500 text-purple-400'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('prf_pending')}
                        >
                            Pending ({pendingReleaseReqs.length})
                        </button>
                        <button
                            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'prf_released'
                                ? 'border-b-2 border-purple-500 text-purple-400'
                                : 'text-slate-400 hover:text-slate-300'
                                }`}
                            onClick={() => setActiveTab('prf_released')}
                        >
                            Released
                        </button>
                    </div>
                    {/* PCF Section */}
                    {hasPermission('module:view:pcf') && (
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500 px-2"><Wallet size={12} className="inline mr-1" />PCF</span>
                            <button
                                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'pcf_pending'
                                    ? 'border-b-2 border-orange-500 text-orange-400'
                                    : 'text-slate-400 hover:text-slate-300'
                                    }`}
                                onClick={() => setActiveTab('pcf_pending')}
                            >
                                Pending ({pcfPending.length})
                            </button>
                            <button
                                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'pcf_released'
                                    ? 'border-b-2 border-emerald-500 text-emerald-400'
                                    : 'text-slate-400 hover:text-slate-300'
                                    }`}
                                onClick={() => setActiveTab('pcf_released')}
                            >
                                Released ({pcfReleased.length})
                            </button>
                        </div>
                    )}
                </div>

                {/* PRF Content */}
                {(activeTab === 'prf_pending' || activeTab === 'prf_released') && (
                    <Card className="!p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">PRF ID</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Requester</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">{activeTab === 'prf_pending' ? 'Date Approved' : 'Date Released'}</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredReqs.map(req => (
                                        <tr
                                            key={req.id}
                                            className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('button, a')) return;
                                                setDrawerReq(req);
                                            }}
                                        >
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
                                                {activeTab === 'prf_pending'
                                                    ? new Date(req.dateCreated).toLocaleDateString()
                                                    : (req.fundReleaseDate ? new Date(req.fundReleaseDate).toLocaleDateString() : '-')
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {getStatusBadge(req.status)}
                                                    {(req.isUrgent || req.priority === 'URGENT') && (
                                                        <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded-full uppercase">Urgent</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {activeTab === 'prf_pending' ? (
                                                    hasPermission('finance:release_funds') ? (
                                                        <button
                                                            onClick={() => handleRelease(req)}
                                                            className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 font-medium"
                                                        >
                                                            Release Fund
                                                        </button>
                                                    ) : null
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
                                    {filteredReqs.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500 italic">
                                                {activeTab === 'prf_pending' ? 'No requisitions pending fund release.' : 'No released funds history found.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
                {/* PCF Pending Content */}
                {activeTab === 'pcf_pending' && (
                    <Card className="!p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">PRF Reference</th>
                                        <th className="px-6 py-4">Custodian</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Date Approved</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {pcfPending.map(liq => {
                                        // Find the linked PRF for this PCF to enable release action
                                        const linkedPrf = requisitions.find(r => r.id === liq.replenishmentPrfId);
                                        return (
                                            <tr
                                                key={liq.id}
                                                className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).closest('button')) return;
                                                    if (linkedPrf) setDrawerReq(linkedPrf);
                                                }}
                                            >
                                                <td className="px-6 py-4 font-medium font-mono text-cyan-400">
                                                    {liq.replenishmentPrfId || liq.id?.substring(0, 8)}
                                                </td>
                                                <td className="px-6 py-4 text-white">{liq.userName}</td>
                                                <td className="px-6 py-4 text-slate-300">
                                                    {businesses.find(b => b.id === liq.businessId)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-400 font-semibold">
                                                    ₱{liq.totalAmount?.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-600/20 text-orange-400">
                                                        PENDING RELEASE
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {liq.dateApproved ? new Date(liq.dateApproved).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {hasPermission('finance:release_funds') && linkedPrf ? (
                                                        <button
                                                            onClick={() => handleRelease(linkedPrf)}
                                                            className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 font-medium"
                                                        >
                                                            Release Fund
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-500 text-xs">
                                                            {linkedPrf ? 'No permission' : 'No PRF linked'}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {pcfPending.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                                                No PCF pending release.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {/* PCF Released Content */}
                {activeTab === 'pcf_released' && (
                    <Card className="!p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">PRF Reference</th>
                                        <th className="px-6 py-4">Custodian</th>
                                        <th className="px-6 py-4">Business Unit</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Created</th>
                                        <th className="px-6 py-4">Approved</th>
                                        <th className="px-6 py-4">Released</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {pcfReleased.map(liq => {
                                        const linkedPrf = requisitions.find(r => r.id === liq.replenishmentPrfId);
                                        return (
                                            <tr
                                                key={liq.id}
                                                className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    if (linkedPrf) setDrawerReq(linkedPrf);
                                                }}
                                            >
                                                <td className="px-6 py-4 font-medium font-mono text-cyan-400">
                                                    {liq.replenishmentPrfId || liq.id?.substring(0, 8)}
                                                </td>
                                                <td className="px-6 py-4 text-white">{liq.userName}</td>
                                                <td className="px-6 py-4 text-slate-300">
                                                    {businesses.find(b => b.id === liq.businessId)?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-400 font-semibold">
                                                    ₱{liq.totalAmount?.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${liq.status === PCFStatus.REPLENISHED
                                                            ? 'bg-emerald-600/20 text-emerald-400'
                                                            : 'bg-green-600/20 text-green-400'
                                                        }`}>
                                                        {liq.status.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {liq.dateCreated ? new Date(liq.dateCreated).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-xs">
                                                    {liq.dateApproved ? new Date(liq.dateApproved).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-emerald-400 text-xs">
                                                    {linkedPrf?.fundReleaseDate ? new Date(linkedPrf.fundReleaseDate).toLocaleDateString() : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {pcfReleased.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                                                No PCF releases found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
            {selectedReq && (
                <ReleaseFundModal
                    isOpen={isReleaseModalOpen}
                    onClose={() => setReleaseModalOpen(false)}
                    onConfirm={confirmRelease}
                    requisition={selectedReq}
                />
            )}

            {/* Quick Peek Drawer */}
            <RequisitionDrawer
                requisition={drawerReq}
                isOpen={!!drawerReq}
                onClose={() => setDrawerReq(null)}
                variant="FINANCE"
                getStatusBadge={getStatusBadge}
                onReleaseFund={() => {
                    if (drawerReq) {
                        handleRelease(drawerReq);
                    }
                }}
                canReleaseFund={activeTab === 'prf_pending' && hasPermission('finance:release_funds')}
            />
        </>
    );
};

export default FinanceView;
