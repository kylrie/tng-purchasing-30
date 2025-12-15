import React, { useState } from 'react';
import type { Requisition } from '../../procurement/types';
import { RequisitionStatus, isSuperAdmin } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import { usePermissions } from '../../../hooks/usePermissions';
import Card from '../../../shared/components/Card';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import LiquidationPrintModal from '../components/LiquidationPrintModal';
import LiquidationModal from '../components/LiquidationModal';
import LiquidationAuditModal from '../components/LiquidationAuditModal';
import { executeWorkflowAction } from '../../procurement/services/workflowService';
import { Printer, Edit, FileText, RefreshCw, CheckCircle } from 'lucide-react';

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
  businesses,
  onUpdateRequisition,
  allUsers
}) => {
  const [printReq, setPrintReq] = useState<Requisition | null>(null);
  const [editingLiquidationReq, setEditingLiquidationReq] = useState<Requisition | null>(null);
  const [auditReq, setAuditReq] = useState<Requisition | null>(null);
  const [drawerReq, setDrawerReq] = useState<Requisition | null>(null); // Quick Peek drawer
  const [activeTab, setActiveTab] = useState<'liquidations' | 'for_audit' | 'my_history'>('liquidations');
  const { hasPermission } = usePermissions();

  const canView = hasPermission('liquidation:view');

  if (!canView) {
    return (
      <div className="text-center text-slate-400">You do not have permission to view this page.</div>
    );
  }

  const handleLiquidationSubmit = (updatedReq: Requisition) => {
    onUpdateRequisition(updatedReq);
    setEditingLiquidationReq(null);
  };

  const handleAuditSubmit = (updatedReq: Requisition) => {
    onUpdateRequisition(updatedReq);
    setAuditReq(null);
  };

  const handleAuditApprove = async (auditNotes: string) => {
    if (auditReq) {
      const updatedReq = {
        ...auditReq,
        status: RequisitionStatus.AUDITED_CLEARED,
        liquidationDetails: {
          ...auditReq.liquidationDetails!,
          auditedBy: currentUser.id,
          auditDate: new Date().toISOString(),
          auditNotes: auditNotes,
          status: 'APPROVED' as const
        }
      };
      handleAuditSubmit(updatedReq);
    }
  };

  const handleAuditReject = async (reason: string) => {
    if (auditReq) {
      const updatedReq = {
        ...auditReq,
        status: RequisitionStatus.LIQUIDATION_REJECTED,
        liquidationDetails: {
          ...auditReq.liquidationDetails!,
          auditedBy: currentUser.id,
          auditDate: new Date().toISOString(),
          auditNotes: reason,
          rejectionReason: reason,
          status: 'REJECTED' as const
        }
      };
      handleAuditSubmit(updatedReq);
    }
  };

  // Filter for requisitions with funds released or liquidation filed
  const liquidationReqs = requisitions.filter(
    req => [
      RequisitionStatus.FUNDS_RELEASED,
      RequisitionStatus.AUDITED_CLEARED,
      RequisitionStatus.LIQUIDATION_REJECTED
    ].includes(req.status) || (req.status === RequisitionStatus.REJECTED && req.liquidationDetails)
  );

  const auditingReqs = requisitions.filter(
    req => req.status === RequisitionStatus.LIQUIDATION_FILED
  );

  // My History: All liquidations filed by current user (pending, approved, or rejected)
  const myHistoryReqs = requisitions.filter(
    req => {
      // Must be filed by current user OR user is the preparer (for BURF-converted PRFs)
      const isMyLiquidation =
        req.liquidationDetails?.submittedBy === currentUser.id ||
        (req.prfDetails?.preparedBy === currentUser.id && req.liquidationDetails);

      if (!isMyLiquidation) return false;

      // Include pending audit, approved, or rejected
      return [
        RequisitionStatus.LIQUIDATION_FILED,
        RequisitionStatus.AUDITED_CLEARED,
        RequisitionStatus.LIQUIDATION_REJECTED
      ].includes(req.status);
    }
  ).sort((a, b) => {
    // Sort by date filed, most recent first
    const dateA = a.liquidationDetails?.dateFiled || a.dateCreated;
    const dateB = b.liquidationDetails?.dateFiled || b.dateCreated;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  // Custom liquidation status badge function
  const getLiquidationStatusBadge = (req: Requisition) => {
    if (req.status === RequisitionStatus.LIQUIDATION_FILED) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Pending Audit
        </span>
      );
    }
    if (req.status === RequisitionStatus.AUDITED_CLEARED) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Approved
        </span>
      );
    }
    if (req.status === RequisitionStatus.LIQUIDATION_REJECTED) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
          Rejected
        </span>
      );
    }
    return getStatusBadge(req.status);
  };

  const displayedReqs = activeTab === 'liquidations' ? liquidationReqs :
    activeTab === 'for_audit' ? auditingReqs : myHistoryReqs;

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Liquidations</h1>
          <p className="text-slate-400 text-sm">File and audit liquidation reports for released funds.</p>
        </div>

        <div className="flex border-b border-slate-700 mb-4 overflow-x-auto">
          <button
            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'liquidations'
              ? 'border-b-2 border-cyan-500 text-cyan-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
            onClick={() => setActiveTab('liquidations')}
          >
            My Liquidations
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'my_history'
              ? 'border-b-2 border-cyan-500 text-cyan-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
            onClick={() => setActiveTab('my_history')}
          >
            My History ({myHistoryReqs.length})
          </button>
          {/* Show For Audit tab to users with liquidation:view - the Audit button itself requires liquidation:audit */}
          <button
            className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'for_audit'
              ? 'border-b-2 border-cyan-500 text-cyan-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
            onClick={() => setActiveTab('for_audit')}
          >
            For Audit ({auditingReqs.length})
          </button>
        </div>

        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white">
              <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
                <tr>
                  <th className="px-6 py-4">PRF ID</th>
                  <th className="px-6 py-4">Business Unit</th>
                  <th className="px-6 py-4">Requester</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Cheque No.</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Rejection Reason</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {displayedReqs.map(req => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                    onClick={(e) => {
                      // Don't open drawer if clicking action buttons
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
                    <td className="px-6 py-4">₱{req.totalAmount?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-purple-400 font-medium">{req.chequeNumber || '-'}</td>
                    <td className="px-6 py-4">
                      {activeTab === 'my_history' ? getLiquidationStatusBadge(req) : getStatusBadge(req.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-400">
                      {(req.status === RequisitionStatus.LIQUIDATION_REJECTED || (req.status === RequisitionStatus.REJECTED && req.liquidationDetails)) ? (
                        <span className="flex items-center gap-1">
                          {/* Import AlertTriangle if not already imported, or use existing icon */}
                          {req.liquidationDetails?.rejectionReason || req.liquidationDetails?.auditNotes || 'No reason provided'}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {/* File/Edit Liquidation - Only for OWN liquidations OR if has file:all permission */}
                        {(req.status === RequisitionStatus.FUNDS_RELEASED || req.status === RequisitionStatus.LIQUIDATION_FILED) &&
                          activeTab === 'liquidations' &&
                          (req.requesterId === currentUser.id || hasPermission('liquidation:file:all')) && (
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
                          hasPermission('liquidation:audit') && activeTab === 'for_audit' && (
                            <button
                              onClick={() => setAuditReq(req)}
                              className="bg-teal-600 text-white px-3 py-1 rounded text-xs hover:bg-teal-700 font-medium flex items-center gap-1 border border-teal-500/50 shadow-sm"
                            >
                              <CheckCircle size={14} /> Audit
                            </button>
                          )}

                        {/* Re-file (Rejected) */}
                        {(req.status === RequisitionStatus.LIQUIDATION_REJECTED || (req.status === RequisitionStatus.REJECTED && req.liquidationDetails)) && (
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
                      </div>
                    </td>
                  </tr>
                ))}
                {displayedReqs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                      No liquidations to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {printReq && (
        <LiquidationPrintModal
          req={printReq}
          onClose={() => setPrintReq(null)}
          business={businesses.find(b => b.id === printReq.businessId)}
          requester={allUsers.find(u => u.id === printReq.requesterId)}
        />
      )}
      {editingLiquidationReq && (
        <LiquidationModal
          requisition={editingLiquidationReq}
          onClose={() => setEditingLiquidationReq(null)}
          onSubmit={handleLiquidationSubmit}
          currentUserId={currentUser.id}
        />
      )}
      {auditReq && (
        <LiquidationAuditModal
          requisition={auditReq}
          onClose={() => setAuditReq(null)}
          onApprove={handleAuditApprove}
          onReject={handleAuditReject}
        />
      )}

      {/* Quick Peek Drawer */}
      <RequisitionDrawer
        requisition={drawerReq}
        isOpen={!!drawerReq}
        onClose={() => setDrawerReq(null)}
        variant="FINANCE"
        getStatusBadge={getStatusBadge}
        onCancel={async () => {
          if (drawerReq && confirm(`Are you sure you want to CANCEL ${drawerReq.id}? This action cannot be undone.`)) {
            try {
              await executeWorkflowAction({
                requisitionId: drawerReq.id,
                action: 'CANCEL',
                user: {
                  uid: currentUser.id,
                  displayName: currentUser.name,
                  email: currentUser.email
                },
                reason: 'Cancelled by SuperAdmin'
              });
              setDrawerReq(null);
            } catch (error: any) {
              console.error('Error cancelling:', error);
              alert(`Failed to cancel: ${error.message || 'Unknown error'}`);
            }
          }
        }}
        canCancel={!!drawerReq && isSuperAdmin(currentUser.role) && drawerReq.status !== RequisitionStatus.CANCELLED}
      />
    </>
  );
};

export default LiquidationView;
