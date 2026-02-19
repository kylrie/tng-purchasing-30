import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Requisition, Supplier } from '../../procurement/types';
import { RequisitionStatus, isSuperAdmin } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import { usePermissions } from '../../../hooks/usePermissions';
import Card from '../../../shared/components/Card';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import LiquidationPrintModal from '../components/LiquidationPrintModal';
import LiquidationModal from '../components/LiquidationModal';
import LiquidationAuditModal from '../components/LiquidationAuditModal';
import { executeWorkflowAction } from '../../procurement/services/workflowService';
import { RequisitionService } from '../../procurement/services/requisitions.service';
import { DateRangeFilter } from '../../../shared/components/DateRangeFilter';
import { Printer, Edit, FileText, RefreshCw, CheckCircle, Search, Download } from 'lucide-react';
import { exportToCSV, formatDateForExport, formatCurrencyForExport, type ExportColumn } from '../../../shared/utils/exportUtils';

interface LiquidationViewProps {
  currentUser: User;
  requisitions: Requisition[];
  getStatusBadge: (status: RequisitionStatus) => React.ReactNode;
  handleReleaseFunds: (id: string, chequeNumber: string) => void;
  businesses: Business[];
  onUpdateRequisition: (req: Requisition) => void;
  allUsers: User[];
  suppliers: Supplier[];
  variant?: 'USER' | 'AUDIT';
}

export const LiquidationView: React.FC<LiquidationViewProps> = ({
  currentUser,
  requisitions,
  getStatusBadge,
  businesses,
  // onUpdateRequisition, - Unused now that we use RequisitionService directly
  allUsers,
  suppliers,
  variant = 'USER' // Default to USER view if not specified
}) => {
  const [printReq, setPrintReq] = useState<Requisition | null>(null);
  const [editingLiquidationReq, setEditingLiquidationReq] = useState<Requisition | null>(null);
  const [auditReq, setAuditReq] = useState<Requisition | null>(null);
  const [drawerReq, setDrawerReq] = useState<Requisition | null>(null); // Quick Peek drawer

  // Set initial active tab based on variant
  const [activeTab, setActiveTab] = useState<'liquidations' | 'all_liquidations' | 'for_audit' | 'my_history' | 'audit_history'>(
    variant === 'AUDIT' ? 'for_audit' : 'liquidations'
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [auditHistoryFilter, setAuditHistoryFilter] = useState<'all' | 'rejected' | 'cleared'>('all');
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  const canView = hasPermission('liquidation:view') || hasPermission('liquidation:file:own') || hasPermission('liquidation:audit');

  if (!canView) {
    return (
      <div className="text-center text-slate-400">You do not have permission to view this page.</div>
    );
  }

  const handleLiquidationSubmit = async (updatedRequisition: Requisition) => {
    try {
      const details = updatedRequisition.liquidationDetails;
      if (!details) throw new Error('Liquidation details missing');

      const variance = (updatedRequisition.totalAmount || 0) - (details.totalActualAmount || 0);

      await RequisitionService.submitLiquidation(
        updatedRequisition.id,
        currentUser.id,
        currentUser.name,
        {
          items: details.expenses || [],
          totalBudget: updatedRequisition.totalAmount || 0,
          totalActual: details.totalActualAmount || 0,
          variance: variance,
          receiptsLink: details.attachmentLink,
          remarks: updatedRequisition.remarks
        }
      );
      setEditingLiquidationReq(null);
    } catch (error) {
      console.error('Failed to submit liquidation:', error);
      alert('Failed to submit liquidation. Please try again.');
    }
  };



  const handleAuditApprove = async (auditNotes: string) => {
    if (auditReq) {
      try {
        await RequisitionService.auditLiquidation(
          auditReq.id,
          currentUser.id,
          currentUser.name,
          RequisitionStatus.AUDITED_CLEARED,
          auditNotes
        );
        setAuditReq(null);
      } catch (error) {
        console.error('Failed to approve liquidation:', error);
        alert('Failed to approve liquidation.');
      }
    }
  };

  const handleAuditReject = async (reason: string) => {
    if (auditReq) {
      try {
        await RequisitionService.auditLiquidation(
          auditReq.id,
          currentUser.id,
          currentUser.name,
          RequisitionStatus.LIQUIDATION_REJECTED,
          reason
        );
        setAuditReq(null);
      } catch (error) {
        console.error('Failed to reject liquidation:', error);
        alert('Failed to reject liquidation.');
      }
    }
  };

  // Base filter for requisitions with funds released or liquidation filed
  const baseLiquidationReqs = React.useMemo(() => requisitions.filter(
    req => [
      RequisitionStatus.FUNDS_RELEASED,
      RequisitionStatus.AUDITED_CLEARED,
      RequisitionStatus.LIQUIDATION_REJECTED
    ].includes(req.status) || (req.status === RequisitionStatus.REJECTED && req.liquidationDetails)
  ), [requisitions]);

  // My Liquidations: Strictly own liquidations (active for filing)
  const myLiquidationReqs = React.useMemo(() => baseLiquidationReqs.filter(req => req.requesterId === currentUser.id), [baseLiquidationReqs, currentUser.id]);

  // All Liquidations: All active liquidations (visible if has file:all)
  const allLiquidationReqs = baseLiquidationReqs;

  const auditingReqs = React.useMemo(() => requisitions.filter(
    req => req.status === RequisitionStatus.LIQUIDATION_FILED
  ), [requisitions]);

  // My History: All liquidations filed by current user (pending, approved, or rejected)
  const myHistoryReqs = React.useMemo(() => requisitions.filter(
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
  }), [requisitions, currentUser.id]);

  // Audit History: All audited liquidations (for auditors to review history)
  const auditHistoryReqs = React.useMemo(() => requisitions.filter(req => {
    if (auditHistoryFilter === 'rejected') {
      return req.status === RequisitionStatus.LIQUIDATION_REJECTED;
    }
    if (auditHistoryFilter === 'cleared') {
      return req.status === RequisitionStatus.AUDITED_CLEARED;
    }
    // 'all' - show both
    return [
      RequisitionStatus.AUDITED_CLEARED,
      RequisitionStatus.LIQUIDATION_REJECTED
    ].includes(req.status);
  }).sort((a, b) => {
    // Sort by audit date, most recent first
    const dateA = a.liquidationDetails?.auditDate || a.dateCreated;
    const dateB = b.liquidationDetails?.auditDate || b.dateCreated;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  }), [requisitions, auditHistoryFilter]);

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

  const displayedReqs = activeTab === 'liquidations' ? myLiquidationReqs :
    activeTab === 'all_liquidations' ? allLiquidationReqs :
      activeTab === 'for_audit' ? auditingReqs :
        activeTab === 'audit_history' ? auditHistoryReqs : myHistoryReqs;

  // Apply search filter
  const filteredReqs = React.useMemo(() => displayedReqs.filter(req => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    const businessName = businesses.find(b => b.id === req.businessId)?.name || '';
    const requesterName = allUsers.find(u => u.id === req.requesterId)?.name || '';
    return (
      req.id.toLowerCase().includes(search) ||
      businessName.toLowerCase().includes(search) ||
      requesterName.toLowerCase().includes(search) ||
      req.description?.toLowerCase().includes(search) ||
      req.chequeNumber?.toLowerCase().includes(search)
    );
  }).filter(req => {
    if (dateRange.start && dateRange.end) {
      const reqDate = new Date(req.dateCreated || req.liquidationDetails?.dateFiled || new Date());
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);

      return reqDate >= start && reqDate <= end;
    }
    return true;
  }), [displayedReqs, searchTerm, dateRange, businesses, allUsers]);

  // Export handler for liquidation data
  const handleExport = () => {
    const columns: ExportColumn<Requisition>[] = [
      { header: 'PRF ID', accessor: (req) => req.id },
      { header: 'Business Unit', accessor: (req) => businesses.find(b => b.id === req.businessId)?.name || 'N/A' },
      { header: 'Requester', accessor: (req) => allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId },
      { header: 'Amount', accessor: (req) => formatCurrencyForExport(req.totalAmount) },
      { header: 'Cheque No', accessor: (req) => req.chequeNumber || '' },
      { header: 'Status', accessor: (req) => req.status },
      { header: 'Date Filed', accessor: (req) => formatDateForExport(req.liquidationDetails?.dateFiled) },
      { header: 'Rejection Reason', accessor: (req) => req.liquidationDetails?.rejectionReason || '' },
    ];

    const tabFilenames: Record<string, string> = {
      liquidations: 'my_liquidations_export',
      all_liquidations: 'all_liquidations_export',
      for_audit: 'for_audit_export',
      my_history: 'my_history_export',
      audit_history: 'audit_history_export',
    };

    const filename = tabFilenames[activeTab] || 'liquidations_export';
    exportToCSV(filteredReqs, columns, filename);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {variant === 'AUDIT' ? 'Liquidation Analysis' : 'My Liquidations'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            {variant === 'AUDIT'
              ? 'Audit and review filed liquidation reports.'
              : 'File liquidation reports for released funds and track status.'}
          </p>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4 overflow-x-auto">
          {variant === 'USER' && (
            <>
              <button
                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'liquidations'
                  ? 'border-b-2 border-cyan-500 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-300'
                  }`}
                onClick={() => setActiveTab('liquidations')}
              >
                My Liquidations
              </button>
              {/* All Liquidations tab - only if has liquidation:file:all */}
              {hasPermission('liquidation:file:all') && (
                <button
                  className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'all_liquidations'
                    ? 'border-b-2 border-cyan-500 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-300'
                    }`}
                  onClick={() => setActiveTab('all_liquidations')}
                >
                  All Liquidations
                </button>
              )}
              <button
                className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'my_history'
                  ? 'border-b-2 border-cyan-500 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-300'
                  }`}
                onClick={() => setActiveTab('my_history')}
              >
                My History ({myHistoryReqs.length})
              </button>
            </>
          )}

          {variant === 'AUDIT' && (
            <>
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
              {/* Audit History tab - only visible to auditors */}
              {hasPermission('liquidation:audit') && (
                <button
                  className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'audit_history'
                    ? 'border-b-2 border-cyan-500 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-300'
                    }`}
                  onClick={() => setActiveTab('audit_history')}
                >
                  Audit History ({auditHistoryReqs.length})
                </button>
              )}
            </>
          )}
        </div>

        {/* Filter for Audit History tab */}
        {activeTab === 'audit_history' && (
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm text-slate-600 dark:text-slate-400">Filter by status:</label>
            <select
              value={auditHistoryFilter}
              onChange={(e) => setAuditHistoryFilter(e.target.value as 'all' | 'rejected' | 'cleared')}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All</option>
              <option value="rejected">Rejected</option>
              <option value="cleared">Audited Cleared</option>
            </select>
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <DateRangeFilter
            onFilterChange={(start, end) => setDateRange({ start, end })}
          />
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by PRF ID, requester, business unit..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          {/* Export Button */}
          <button
            onClick={handleExport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
            title="Export to CSV"
          >
            <Download size={16} />
            Export
          </button>
        </div>

        <Card className="!p-0 overflow-hidden bg-white/80 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm dark:shadow-none">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm text-slate-800 dark:text-slate-200">
              <thead className="bg-slate-50/90 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-600 dark:text-slate-400 sticky top-0 z-20 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50">
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
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredReqs.map(req => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    onClick={(e) => {
                      // Don't open drawer if clicking action buttons
                      if ((e.target as HTMLElement).closest('button, a')) return;
                      setDrawerReq(req);
                    }}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{req.id}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {businesses.find(b => b.id === req.businessId)?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {allUsers.find(u => u.id === req.requesterId)?.name || req.requesterId}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">₱{req.totalAmount?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-purple-600 dark:text-purple-400 font-medium">{req.chequeNumber || '-'}</td>
                    <td className="px-6 py-4">
                      {activeTab === 'my_history' ? getLiquidationStatusBadge(req) : getStatusBadge(req.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-500 dark:text-red-400">
                      {(req.status === RequisitionStatus.LIQUIDATION_REJECTED || (req.status === RequisitionStatus.REJECTED && req.liquidationDetails)) ? (
                        <span className="flex items-center gap-1">
                          {/* Import AlertTriangle if not already imported, or use existing icon */}
                          {req.liquidationDetails?.rejectionReason || req.liquidationDetails?.auditNotes || 'No reason provided'}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {/* File/Edit Liquidation - Opens in new window */}
                        {(req.status === RequisitionStatus.FUNDS_RELEASED || req.status === RequisitionStatus.LIQUIDATION_FILED) &&
                          (activeTab === 'liquidations' || activeTab === 'all_liquidations') &&
                          (req.requesterId === currentUser.id || hasPermission('liquidation:file:all')) && (
                            <button
                              onClick={() => navigate(`/liquidation/${req.id}`)}
                              className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 border border-cyan-200 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/50 hover:bg-cyan-100 dark:hover:bg-cyan-800/50"
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

                        {/* Re-file (Rejected) - Opens in new window */}
                        {(req.status === RequisitionStatus.LIQUIDATION_REJECTED || (req.status === RequisitionStatus.REJECTED && req.liquidationDetails)) && (
                          <button
                            onClick={() => navigate(`/liquidation/${req.id}`)}
                            className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-800/50"
                          >
                            <RefreshCw size={14} /> Re-file Liquidation
                          </button>
                        )}

                        {/* Print Button */}
                        {req.liquidationDetails && (
                          <button onClick={() => setPrintReq(req)} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white p-1" title="Print Liquidation">
                            <Printer size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredReqs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 italic">
                      {searchTerm ? 'No matching liquidations found.' : 'No liquidations to display.'}
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
          suppliers={suppliers}
          businesses={businesses}
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
        businesses={businesses}
        allUsers={allUsers}
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
            } catch (error: unknown) {
              console.error('Error cancelling:', error);
              const message = error instanceof Error ? error.message : 'Unknown error';
              alert(`Failed to cancel: ${message}`);
            }
          }
        }}
        canCancel={!!drawerReq && isSuperAdmin(currentUser.role) && drawerReq.status !== RequisitionStatus.CANCELLED}
      />
    </>
  );
};

export default LiquidationView;
