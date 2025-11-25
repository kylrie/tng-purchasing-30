import React, { useState } from 'react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus, UserRole } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import Card from '../../../shared/components/Card';
import ReleaseFundModal from '../components/ReleaseFundModal';
import LiquidationPrintModal from '../components/LiquidationPrintModal';
import { hasGlobalAccess } from '../../procurement/types';
import { Printer, Edit, FileText, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface LiquidationViewProps {
  currentUser: User;
  requisitions: Requisition[];
  getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
  handleReleaseFunds: (id: string, chequeNumber: string) => void;
  businesses: Business[];
  onUpdateRequisition: (req: Requisition) => void;
  allUsers: User[];
}

export const LiquidationView: React.FC<LiquidationViewProps> = ({
  currentUser,
  requisitions,
  getStatusBadge,
  handleReleaseFunds,
  businesses,
  onUpdateRequisition,
  allUsers
}) => {
  const [isReleaseModalOpen, setReleaseModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);
  const [printReq, setPrintReq] = useState<Requisition | null>(null);
  const [editingLiquidationReq, setEditingLiquidationReq] = useState<Requisition | null>(null);
  const [rejectingReq, setRejectingReq] = useState<Requisition | null>(null);

  const canView = hasGlobalAccess(currentUser.role);

  if (!canView) {
    return (
      <div className="text-center text-slate-400">You do not have permission to view this page.</div>
    );
  }
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
                auditDate: new Date().toISOString()
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

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Finance & Liquidation</h1>
        <Card className="!p-0">
          <table className="w-full text-left text-sm text-white">
            <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
              <tr>
                <th className="px-6 py-4">PRF ID</th>
                <th className="px-6 py-4">Business Unit</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Cheque No.</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {requisitions.map(req => (
                <tr key={req.id} className="hover:bg-slate-800/60">
                  <td className="px-6 py-4 font-medium">{req.id}</td>
                  <td className="px-6 py-4 text-slate-300">
                    {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4">₱{req.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-purple-400 font-medium">{req.chequeNumber || '-'}</td>
                  <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                  <td className="px-6 py-4 text-right">
                    {req.status === RequisitionStatus.APPROVED_FOR_PAYMENT && (
                      <button onClick={() => handleRelease(req)} className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 font-medium">
                        Release Fund
                      </button>
                    )}
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

                                        {/* Print Button */}
                                        {req.liquidationDetails && (
                                            <button onClick={() => setPrintReq(req)} className="text-slate-400 hover:text-white p-1" title="Print Liquidation">
                                                <Printer size={16} />
                                            </button>
                                        )}
                  </td>
                </tr>
              ))}
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
      {printReq && (
          <LiquidationPrintModal 
              req={printReq} 
              onClose={() => setPrintReq(null)} 
              business={businesses.find(b => b.id === printReq.businessId)}
              requester={allUsers.find(u => u.id === printReq.requesterId)}
          />
      )}
    </>
  );
};

export default LiquidationView;
