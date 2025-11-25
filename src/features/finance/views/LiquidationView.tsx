import React, { useState } from 'react';
import { Search, Edit, FileText, RefreshCw, CheckCircle, XCircle, Printer } from 'lucide-react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import { UserRole } from '../../auth/types';
import LiquidationModal from '../components/LiquidationModal';
import LiquidationPrintModal from '../components/LiquidationPrintModal';
import Card from '../../../shared/components/Card';

interface LiquidationViewProps {
    requisitions: Requisition[];
    currentUser: User;
    handleReleaseFunds: (id: string) => void;
    getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
    businesses: Business[];
    allUsers: User[];
    onUpdateRequisition?: (req: Requisition) => void;
}

interface RejectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

const RejectionModal: React.FC<RejectionModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-md !p-0 animate-in zoom-in-95 duration-200 bg-slate-800/90 border-slate-700">
                <div className="p-6 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <XCircle className="text-red-500" size={20} />
                        Reject Liquidation
                    </h3>
                </div>
                <div className="p-6">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Reason for Rejection</label>
                    <textarea
                        className="w-full p-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:outline-none placeholder-slate-500 resize-none"
                        rows={4}
                        placeholder="e.g. Missing receipts, incorrect calculation, prohibited items..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={!reason.trim()}
                        className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-900/20"
                    >
                        Reject Liquidation
                    </button>
                </div>
            </Card>
        </div>
    );
};

const LiquidationView: React.FC<LiquidationViewProps> = ({
    requisitions,
    currentUser,
    handleReleaseFunds,
    getStatusBadge,
    businesses,
    allUsers,
    onUpdateRequisition
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingLiquidationReq, setEditingLiquidationReq] = useState<Requisition | null>(null);
    const [rejectingReq, setRejectingReq] = useState<Requisition | null>(null);
    const [printReq, setPrintReq] = useState<Requisition | null>(null);

    // Filter requisitions for Finance dashboard (Approved for Payment, Funds Released, Liquidation Filed, and Rejected Liquidations)
    const financeRequisitions = (requisitions || [])
        .filter(r => [RequisitionStatus.APPROVED_FOR_PAYMENT, RequisitionStatus.FUNDS_RELEASED, RequisitionStatus.LIQUIDATION_FILED, RequisitionStatus.AUDITED_CLEARED, RequisitionStatus.REJECTED].includes(r.status))
        .filter(r => 
            // Include rejected items only if they have Liquidation details (meaning they were rejected at Liquidation stage)
            r.status !== RequisitionStatus.REJECTED || r.liquidationDetails
        )
        .filter(r =>
            (r.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.projectName || r.description || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    const handleLiquidationSubmit = (updatedReq: Requisition) => {
        if (onUpdateRequisition) {
            onUpdateRequisition(updatedReq);
        }
        setEditingLiquidationReq(null);
    };

    const handleAuditClear = (req: Requisition) => {
        if (onUpdateRequisition) {
            const updatedReq = {
                ...req,
                status: RequisitionStatus.AUDITED_CLEARED,
                liquidationDetails: {
                    ...req.liquidationDetails!,
                    auditedBy: currentUser.id,
                    auditDate: new Date().toISOString(),
                    auditNotes: 'Cleared by Auditor'
                }
            };
            onUpdateRequisition(updatedReq);
        }
    };

    const handleAuditRejectClick = (req: Requisition) => {
        setRejectingReq(req);
    };

    const handleRejectConfirm = (reason: string) => {
        if (rejectingReq && onUpdateRequisition) {
            const updatedReq = {
                ...rejectingReq,
                status: RequisitionStatus.REJECTED,
                liquidationDetails: {
                    ...rejectingReq.liquidationDetails!,
                    auditedBy: currentUser.id,
                    auditDate: new Date().toISOString(),
                    auditNotes: reason
                }
            };
            onUpdateRequisition(updatedReq);
            setRejectingReq(null);
        }
    };

    return (
        <div className="space-y-6 text-white">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Liquidation & Audit</h1>
                    <p className="text-slate-300">Track and audit expenses, release funds for approved PRFs</p>
                </div>
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        className="pl-10 p-2 border border-slate-700 rounded-lg text-sm w-64 bg-slate-800 text-white focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Search requisitions..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card className="overflow-hidden !p-0">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Business Unit</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Requester</th>
                            <th className="px-6 py-4">Total Amount</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {financeRequisitions.map(req => {
                            const requester = allUsers.find(u => u.id === req.requesterId);
                            const business = businesses.find(b => b.id === req.businessId);
                            const requesterName = requester?.name || 'Unknown User';

                            return (
                                <tr key={req.id} className="hover:bg-slate-700/50">
                                    <td className="px-6 py-4 font-medium text-slate-100">{req.id}</td>
                                    <td className="px-6 py-4 text-slate-300 font-medium text-xs">
                                        {business?.name || requester?.department || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-200">{req.projectName || req.description}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                                {requesterName.charAt(0)}
                                            </div>
                                            <span className="text-slate-200">{requesterName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-emerald-400">
                                        ₱{(req.totalAmount || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">
                                        {req.dateCreated ? new Date(req.dateCreated).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(req.status)}
                                        {req.status === RequisitionStatus.REJECTED && req.liquidationDetails?.auditNotes && (
                                            <div className="text-[10px] text-red-400 mt-1 italic">Note: {req.liquidationDetails.auditNotes}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2 items-center">
                                        {/* Print Button (visible for all with liquidation details) */}
                                        {req.liquidationDetails && (
                                            <button onClick={() => setPrintReq(req)} className="text-slate-400 hover:text-white p-1" title="Print Liquidation">
                                                <Printer size={16} />
                                            </button>
                                        )}

                                        {/* Release Funds (Finance/SuperAdmin) */}
                                        {req.status === RequisitionStatus.APPROVED_FOR_PAYMENT &&
                                            (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.FINANCE || currentUser.role === UserRole.MANAGER) && (
                                                <button
                                                    onClick={() => handleReleaseFunds(req.id)}
                                                    className="bg-emerald-600 text-white px-3 py-1 rounded text-xs hover:bg-emerald-700 font-medium flex items-center gap-1 ml-auto"
                                                >
                                                    <span className="mr-1 font-bold text-sm">₱</span> Release Funds
                                                </button>
                                            )}
                                        
                                        {/* File/Edit Liquidation (Requester or Admin/Finance if needed) */}
                                        {(req.status === RequisitionStatus.FUNDS_RELEASED || req.status === RequisitionStatus.LIQUIDATION_FILED) && (
                                            <button
                                                onClick={() => setEditingLiquidationReq(req)}
                                                className="text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 border border-cyan-700 bg-cyan-900/50 hover:bg-cyan-800/50"
                                            >
                                                {req.status === RequisitionStatus.FUNDS_RELEASED ? (
                                                    <><FileText size={14} /> File Liquidation</>
                                                ) : (
                                                    <><Edit size={14} /> Edit Liquidation</>
                                                )}
                                            </button>
                                        )}

                                        {/* Audit (Auditor/SuperAdmin) */}
                                        {req.status === RequisitionStatus.LIQUIDATION_FILED && 
                                            (currentUser.role === UserRole.AUDITOR || currentUser.role === UserRole.SUPER_ADMIN) && (
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleAuditRejectClick(req)} 
                                                    className="text-red-400 hover:text-red-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 border border-red-500/50 bg-red-900/20 hover:bg-red-900/40"
                                                >
                                                    <XCircle size={14} /> Reject
                                                </button>
                                                <button 
                                                    onClick={() => handleAuditClear(req)} 
                                                    className="bg-teal-600 text-white px-3 py-1 rounded text-xs hover:bg-teal-700 font-medium flex items-center gap-1 border border-teal-500/50 shadow-sm"
                                                >
                                                    <CheckCircle size={14} /> Clear
                                                </button>
                                            </div>
                                        )}

                                        {/* Re-file (Rejected) */}
                                        {req.status === RequisitionStatus.REJECTED && req.liquidationDetails && (
                                             <button
                                             onClick={() => setEditingLiquidationReq(req)}
                                             className="text-orange-400 hover:text-orange-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 border border-orange-700 bg-orange-900/50 hover:bg-orange-800/50"
                                         >
                                             <RefreshCw size={14} /> Re-file Liquidation
                                         </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {financeRequisitions.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-slate-400 italic">
                                    No requisitions found for liquidation.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {editingLiquidationReq && (
                <LiquidationModal
                    requisition={editingLiquidationReq}
                    onClose={() => setEditingLiquidationReq(null)}
                    onSubmit={handleLiquidationSubmit}
                    currentUserId={currentUser.id}
                />
            )}

            <RejectionModal
                isOpen={!!rejectingReq}
                onClose={() => setRejectingReq(null)}
                onConfirm={handleRejectConfirm}
            />

            {printReq && <LiquidationPrintModal req={printReq} onClose={() => setPrintReq(null)} business={businesses.find(b => b.id === printReq.businessId)} requester={allUsers.find(u => u.id === printReq.requesterId)} />}
        </div>
    );
};

export default LiquidationView;