import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthProvider';
import { useAuth } from './contexts/useAuth';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { BusinessUnitProvider } from './contexts/BusinessUnitContext';
import { DataProvider } from './shared/context/DataContext';
import Layout from './shared/components/Layout';
import ProtectedRoute from './shared/components/ProtectedRoute';
// Static imports removed for code splitting
// import LoginView from './features/auth/views/LoginView';
// import DashboardView from './features/dashboard/views/DashboardView';

import { Suspense } from 'react';
import type { NotificationItem } from './shared/types';
import { UserRole, UserStatus, COLLECTIONS } from './shared/types/firebase.types';
import { RequisitionStatus } from './features/procurement/types';
import { useRequisitions } from './features/procurement/hooks/useRequisitions';
import { RequisitionService } from './features/procurement/services/requisitions.service';
import { useUsers } from './features/admin/hooks/useUsers';
import { useBusinesses } from './features/admin/hooks/useBusinesses';
import { useSuppliers } from './features/inventory/hooks/useSuppliers';
import { doc, updateDoc } from 'firebase/firestore';
import { db, isConfigValid } from './config/firebase';
import { useUOM } from './shared/hooks/useUOM';

// Lazy load views for code splitting
const BurfView = React.lazy(() => import('./features/procurement/views/BURFView'));
const PrfView = React.lazy(() => import('./features/procurement/views/PRFView'));
const PRFTrackerView = React.lazy(() => import('./features/procurement/views/PRFTrackerView'));
const ProcurementApprovalsView = React.lazy(() => import('./features/procurement/views/ProcurementApprovalsView'));
const ApprovedView = React.lazy(() => import('./features/procurement/views/ApprovedView'));
const FinanceView = React.lazy(() => import('./features/finance/views/FinanceView'));
const FinanceOverview = React.lazy(() => import('./features/finance/views/FinanceOverview'));
const LiquidationView = React.lazy(() => import('./features/finance/views/LiquidationView'));
const LiquidationPage = React.lazy(() => import('./features/finance/views/LiquidationPage'));
const BURFPage = React.lazy(() => import('./pages/BURFPage'));
const PCFView = React.lazy(() => import('./features/finance/views/PCFView'));
const PCFApprovalView = React.lazy(() => import('./features/finance/views/PCFApprovalView'));
const PCFAuditReviewView = React.lazy(() => import('./features/finance/views/PCFAuditReviewView'));
const TransactionHistoryView = React.lazy(() => import('./features/finance/views/TransactionHistoryView'));
const BankReconView = React.lazy(() => import('./features/finance/views/BankReconView'));
const SuppliersView = React.lazy(() => import('./features/inventory/views/SuppliersView'));
const InventoryReports = React.lazy(() => import('./features/inventory/views/InventoryReports'));
const InventoryItemsView = React.lazy(() => import('./features/inventory/views/InventoryItemsView'));
const FixedAssetsView = React.lazy(() => import('./features/inventory/views/FixedAssetsView'));
const VarianceReportView = React.lazy(() => import('./features/inventory/views/VarianceReportView'));
const VarianceReconReport = React.lazy(() => import('./features/inventory/views/VarianceReconReport'));
const GoodsReceivingView = React.lazy(() => import('./features/inventory/views/GoodsReceivingView'));
const StockTakeView = React.lazy(() => import('./features/inventory/views/StockTakeView'));
const InventoryIntegrityMonitor = React.lazy(() => import('./features/inventory/views/InventoryIntegrityMonitor'));
const MenuDashboard = React.lazy(() => import('./features/menu/views/MenuDashboard'));
const DigitalBlackBookView = React.lazy(() => import('./features/menu/views/DigitalBlackBookView'));
const DigitalBlackBookDetailsView = React.lazy(() => import('./features/menu/views/DigitalBlackBookDetailsView'));
const ChartOfAccountsView = React.lazy(() => import('./features/admin/views/ChartOfAccountsView'));
const BudgetConfigPanel = React.lazy(() => import('./features/finance/components/BudgetConfigPanel').then(module => ({ default: module.BudgetConfigPanel })));
const SettingsView = React.lazy(() => import('./features/admin/views/SettingsView').then(module => ({ default: module.SettingsView })));
const ActivityLogView = React.lazy(() => import('./features/admin/views/ActivityLogView'));
const LoginView = React.lazy(() => import('./features/auth/views/LoginView'));
const MainDashboardRouter = React.lazy(() => import('./features/dashboard/views/MainDashboardRouter'));
const NotificationsView = React.lazy(() => import('./features/notifications/views/NotificationsView'));
const POSView = React.lazy(() => import('./features/pos/views/POSView'));
const PosImportDashboard = React.lazy(() => import('./features/pos/views/PosImportDashboard'));
const EventImportDashboard = React.lazy(() => import('./features/pos/views/EventImportDashboard'));
const WastageView = React.lazy(() => import('./features/inventory/views/WastageView'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
  </div>
);

function ProtectedApp() {
  const { currentUser, logout, loading } = useAuth();
  const { requisitions, createRequisition, updateRequisition } = useRequisitions();
  const { users, setUsers, updateUser } = useUsers();
  const { businesses, addBusiness, updateBusiness, deleteBusiness } = useBusinesses();
  const { suppliers, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();

  const [notifications] = useState<NotificationItem[]>([]);
  const [approvalLoadingId, setApprovalLoadingId] = useState<string | null>(null);
  const { uomOptions } = useUOM();

  const handleApproveUser = async (userId: string) => {
    setApprovalLoadingId(userId);
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      await updateDoc(userRef, { status: UserStatus.ACTIVE });
      setUsers(users.map(u => u.id === userId ? { ...u, status: UserStatus.ACTIVE } : u));
    } catch (error) {
      console.error("Error approving user: ", error);
    } finally {
      setApprovalLoadingId(null);
    }
  };

  // FIX BUG 10: Soft Delete - Update status instead of deleting
  // Preserves audit trail of rejected registration attempts
  const handleRejectUser = async (userId: string) => {
    setApprovalLoadingId(userId);
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      await updateDoc(userRef, {
        status: UserStatus.REJECTED,
        rejectedAt: new Date().toISOString()
      });
      // Update local state to reflect rejection (filter from pending view)
      setUsers(users.map(u => u.id === userId ? { ...u, status: UserStatus.REJECTED } : u));
    } catch (error) {
      console.error("Error rejecting user: ", error);
    } finally {
      setApprovalLoadingId(null);
    }
  };



  const getStatusBadge = (status: RequisitionStatus) => {
    // Modern pill styling with distinct colors - Complete status coverage
    const styles: Record<RequisitionStatus, string> = {
      [RequisitionStatus.DRAFT]: 'bg-slate-600/50 text-slate-300',
      // BURF statuses
      [RequisitionStatus.BURF_PENDING_MANAGER]: 'bg-orange-500/20 text-orange-400',
      [RequisitionStatus.BURF_PENDING_CIC]: 'bg-amber-500/20 text-amber-400',
      [RequisitionStatus.READY_FOR_PRF]: 'bg-blue-500/20 text-blue-400',
      [RequisitionStatus.BURF_PARTIALLY_PROCESSED]: 'bg-lime-500/20 text-lime-400',
      [RequisitionStatus.BURF_COMPLETED]: 'bg-sky-500/20 text-sky-400',
      // PRF 8-Stage Workflow
      [RequisitionStatus.PRF_PENDING_MANAGER]: 'bg-orange-500/20 text-orange-400',
      [RequisitionStatus.PENDING_GM_PRF_APPROVAL]: 'bg-yellow-500/20 text-yellow-400',
      [RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL]: 'bg-indigo-500/20 text-indigo-400',
      [RequisitionStatus.PENDING_GM_BR_APPROVAL]: 'bg-violet-500/20 text-violet-400',
      [RequisitionStatus.PENDING_BOD_APPROVAL]: 'bg-fuchsia-500/20 text-fuchsia-400',
      [RequisitionStatus.FOR_CHECK_PREPARATION]: 'bg-cyan-500/20 text-cyan-400',
      [RequisitionStatus.PENDING_CHECK_AUTH_BOD]: 'bg-amber-500/20 text-amber-400',
      [RequisitionStatus.FOR_FUND_RELEASE]: 'bg-teal-500/20 text-teal-400',
      // Legacy
      [RequisitionStatus.PENDING_CFO_APPROVAL]: 'bg-purple-500/20 text-purple-400',
      [RequisitionStatus.APPROVED_FOR_PAYMENT]: 'bg-teal-500/20 text-teal-400',
      // Post-Approval
      [RequisitionStatus.FUNDS_RELEASED]: 'bg-emerald-500/20 text-emerald-400',
      [RequisitionStatus.LIQUIDATION_FILED]: 'bg-teal-500/20 text-teal-400',
      [RequisitionStatus.LIQUIDATION_REJECTED]: 'bg-red-500/20 text-red-400',
      [RequisitionStatus.AUDITED_CLEARED]: 'bg-green-500/20 text-green-400',
      // Terminal
      [RequisitionStatus.REJECTED]: 'bg-red-500/20 text-red-400',
      [RequisitionStatus.CANCELLED]: 'bg-gray-600/50 text-gray-400',
    };
    const labels: Record<RequisitionStatus, string> = {
      [RequisitionStatus.DRAFT]: 'Draft',
      // BURF statuses
      [RequisitionStatus.BURF_PENDING_MANAGER]: 'Pending Manager',
      [RequisitionStatus.BURF_PENDING_CIC]: 'Pending CIC',
      [RequisitionStatus.READY_FOR_PRF]: 'Ready for PRF',
      [RequisitionStatus.BURF_PARTIALLY_PROCESSED]: 'Partial PRF',
      [RequisitionStatus.BURF_COMPLETED]: 'Converted to PRF',
      // PRF 8-Stage Workflow
      [RequisitionStatus.PRF_PENDING_MANAGER]: 'Pending Approval',
      [RequisitionStatus.PENDING_GM_PRF_APPROVAL]: 'Pending GM PRF',
      [RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL]: 'Pending Finance Head',
      [RequisitionStatus.PENDING_GM_BR_APPROVAL]: 'Pending GM Budget',
      [RequisitionStatus.PENDING_BOD_APPROVAL]: 'Pending BOD',
      [RequisitionStatus.FOR_CHECK_PREPARATION]: 'Bank Ref Entry',
      [RequisitionStatus.PENDING_CHECK_AUTH_BOD]: 'Check Auth',
      [RequisitionStatus.FOR_FUND_RELEASE]: 'For Release',
      // Legacy
      [RequisitionStatus.PENDING_CFO_APPROVAL]: 'Pending CFO',
      [RequisitionStatus.APPROVED_FOR_PAYMENT]: 'For Release',
      // Post-Approval
      [RequisitionStatus.FUNDS_RELEASED]: 'Released',
      [RequisitionStatus.LIQUIDATION_FILED]: 'Liquidated',
      [RequisitionStatus.LIQUIDATION_REJECTED]: 'Liq. Rejected',
      [RequisitionStatus.AUDITED_CLEARED]: 'Cleared',
      // Terminal
      [RequisitionStatus.REJECTED]: 'Rejected',
      [RequisitionStatus.CANCELLED]: 'Cancelled',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-600/50 text-slate-300'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const handleReleaseFunds = async (id: string, checkVoucherNumber: string, checkVoucherLink?: string, coaCode?: string) => {
    // Use the new service method that automatically updates linked PCF liquidations
    await RequisitionService.releaseFundsWithPcfUpdate(
      id,
      checkVoucherNumber,
      checkVoucherLink,
      currentUser?.id,
      currentUser?.name,
      coaCode
    );
  };

  const accessibleBusinesses = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === UserRole.SUPER_ADMIN) return businesses;
    return businesses.filter(b => 
      b.id === currentUser.businessId || 
      currentUser.businessUnitIds?.includes(b.id)
    );
  }, [businesses, currentUser]);
  if (loading) {
    return <div>Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const pendingUsers = users.filter(user => user.status === UserStatus.PENDING_APPROVAL);
  const userNotifications = notifications.filter(n => n.targetRoles?.includes(currentUser.role) || currentUser.role === UserRole.SUPER_ADMIN);



  const layoutProps = {
    currentUser,
    notifications: userNotifications,
    onNotificationClick: () => { },
    onLogout: logout,
    pendingApprovalsCount: pendingUsers.length,
    businesses: accessibleBusinesses
  };

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* External Routes (No Layout) */}
          <Route path="/pos" element={
            <ProtectedRoute permission="ui:module_access:view:pos">
              <POSView businesses={accessibleBusinesses} allUsers={users} />
            </ProtectedRoute>
          } />

          {/* Internal Routes (With Layout) */}
          <Route path="/*" element={
            <Layout {...layoutProps}>
              <Routes>
                <Route path="/" element={<MainDashboardRouter requisitions={requisitions} currentUser={currentUser} allUsers={users} suppliers={suppliers} businesses={accessibleBusinesses} onCreateRequisition={createRequisition} onUpdateRequisition={updateRequisition} />} />
                <Route path="/dashboard" element={<MainDashboardRouter requisitions={requisitions} currentUser={currentUser} allUsers={users} suppliers={suppliers} businesses={accessibleBusinesses} onCreateRequisition={createRequisition} onUpdateRequisition={updateRequisition} />} />

                <Route path="/burf" element={
                  <ProtectedRoute permission="ui:module_access:view:burf">
                    <BurfView
                      currentUser={currentUser}
                      visibleRequisitions={requisitions}
                      allUsers={users}
                      businesses={accessibleBusinesses}
                      getStatusBadge={getStatusBadge}
                      onCreateRequisition={createRequisition}
                      onUpdateRequisition={updateRequisition}
                      uomOptions={uomOptions}
                    />
                  </ProtectedRoute>
                } />

                {/* Full-screen BURF Page Routes (modal-to-page refactor) */}
                <Route path="/burf/new" element={
                  <ProtectedRoute permission="procurement:burf:create">
                    <BURFPage />
                  </ProtectedRoute>
                } />
                <Route path="/burf/edit/:burfId" element={
                  <ProtectedRoute permission="procurement:burf:edit:draft">
                    <BURFPage />
                  </ProtectedRoute>
                } />

                <Route path="/prf" element={
                  <ProtectedRoute permission="ui:module_access:view:prf">
                    <PrfView
                      currentUser={currentUser}
                      visibleRequisitions={requisitions}
                      getStatusBadge={getStatusBadge}
                      businesses={accessibleBusinesses}
                      allUsers={users}
                      onCreateRequisition={createRequisition}
                      onUpdateRequisition={updateRequisition}
                      suppliers={suppliers}
                      uomOptions={uomOptions}
                    />
                  </ProtectedRoute>
                } />

                <Route path="/prf-tracker" element={
                  <ProtectedRoute permission="ui:module_access:view:prf_tracker">
                    <PRFTrackerView
                      currentUser={currentUser}
                      requisitions={requisitions}
                      getStatusBadge={getStatusBadge}
                      businesses={accessibleBusinesses}
                      allUsers={users}
                    />
                  </ProtectedRoute>
                } />

                <Route path="/procurement-approvals" element={
                  <ProtectedRoute permission="ui:module_access:view:approvals">
                    <ProcurementApprovalsView
                      currentUser={currentUser}
                      requisitions={requisitions}
                      allUsers={users}
                      businesses={accessibleBusinesses}
                      onUpdateRequisition={updateRequisition}
                      getStatusBadge={getStatusBadge}
                    />
                  </ProtectedRoute>
                } />

                <Route path="/approved" element={
                  <ProtectedRoute permission="ui:module_access:view:approved">
                    <ApprovedView
                      currentUser={currentUser}
                      requisitions={requisitions}
                      allUsers={users}
                      businesses={accessibleBusinesses}
                      getStatusBadge={getStatusBadge}
                    />
                  </ProtectedRoute>
                } />

                {/* Finance Module - Restructured Routes */}
                {/* Overview - Strategic Finance Dashboard */}
                <Route path="/finance/overview" element={
                  <ProtectedRoute permission="ui:module_access:view:finance">
                    <FinanceOverview businesses={accessibleBusinesses} />
                  </ProtectedRoute>
                } />

                {/* BR Flow - Existing FinanceView with Fund Release/Check Prep */}
                <Route path="/finance/expenses/br-flow" element={
                  <ProtectedRoute permission="ui:module_access:view:br">
                    <FinanceView
                      currentUser={currentUser}
                      requisitions={requisitions}
                      getStatusBadge={getStatusBadge}
                      handleReleaseFunds={handleReleaseFunds}
                      businesses={accessibleBusinesses}
                      allUsers={users}
                    />
                  </ProtectedRoute>
                } />

                {/* Legacy /finance redirect to new BR Flow path */}
                <Route path="/finance" element={<Navigate to="/finance/expenses/br-flow" replace />} />

                {/* Income placeholders */}
                <Route path="/finance/income/sales" element={
                  <ProtectedRoute permission="ui:module_access:view:finance">
                    <PosImportDashboard businesses={accessibleBusinesses} />
                  </ProtectedRoute>
                } />
                <Route path="/finance/income/event-sales" element={
                  <ProtectedRoute permission="ui:module_access:view:finance">
                    <EventImportDashboard businesses={accessibleBusinesses} />
                  </ProtectedRoute>
                } />
                <Route path="/finance/income/invoices" element={
                  <ProtectedRoute permission="ui:module_access:view:finance">
                    <div className="p-8">
                      <h1 className="text-2xl font-bold text-white mb-4">Invoices</h1>
                      <p className="text-slate-400">Coming soon - Invoice management.</p>
                    </div>
                  </ProtectedRoute>
                } />

                <Route path="/procurement/liquidation" element={
                  <ProtectedRoute permission="finance:liquidation:create:own">
                    <LiquidationView
                      currentUser={currentUser}
                      requisitions={requisitions}
                      getStatusBadge={getStatusBadge}
                      handleReleaseFunds={handleReleaseFunds}
                      businesses={accessibleBusinesses}
                      onUpdateRequisition={updateRequisition}
                      allUsers={users}
                      suppliers={suppliers}
                      variant="USER"
                    />
                  </ProtectedRoute>
                } />

                <Route path="/liquidation" element={
                  <ProtectedRoute permission={[
                    'finance:liquidation:audit',
                    'audit:liquidation:view:all',
                    'audit:liquidation:view:bu',
                    'audit:liquidation:view:own'
                  ]}>
                    <LiquidationView
                      currentUser={currentUser}
                      requisitions={requisitions}
                      getStatusBadge={getStatusBadge}
                      handleReleaseFunds={handleReleaseFunds}
                      businesses={accessibleBusinesses}
                      onUpdateRequisition={updateRequisition}
                      allUsers={users}
                      suppliers={suppliers}
                      variant="AUDIT"
                    />
                  </ProtectedRoute>
                } />

                {/* Liquidation Page - Full page for filing liquidation (opens in new window) */}
                <Route path="/liquidation/:prfId" element={
                  <ProtectedRoute permission={['finance:liquidation:create:own', 'finance:liquidation:create:all']}>
                    <LiquidationPage />
                  </ProtectedRoute>
                } />

                <Route path="/pcf" element={
                  <ProtectedRoute permission="ui:module_access:view:pcf">
                    <PCFView
                      currentUser={currentUser}
                      businesses={businesses}
                      allUsers={users}
                    />
                  </ProtectedRoute>
                } />

                <Route path="/pcf-approvals" element={
                  <ProtectedRoute permission="finance:pcf:approve">
                    <PCFApprovalView
                      currentUser={currentUser}
                      businesses={accessibleBusinesses}
                      allUsers={users}
                    />
                  </ProtectedRoute>
                } />

                <Route path="/pcf-audit-review" element={
                  <ProtectedRoute permission={[
                    'finance:pcf:audit',
                    'audit:pcf:view:all',
                    'audit:pcf:view:bu',
                    'audit:pcf:view:own'
                  ]}>
                    <PCFAuditReviewView
                      currentUser={currentUser}
                      businesses={accessibleBusinesses}
                      allUsers={users}
                    />
                  </ProtectedRoute>
                } />

                <Route path="/suppliers" element={
                  <ProtectedRoute permission="ui:module_access:view:suppliers">
                    <SuppliersView
                      suppliers={suppliers}
                      onCreateSupplier={createSupplier}
                      onUpdateSupplier={updateSupplier}
                      onDeleteSupplier={deleteSupplier}
                      currentUser={currentUser}
                      businesses={accessibleBusinesses}
                    />
                  </ProtectedRoute>
                } />

                <Route path="/chart-of-accounts" element={
                  <ProtectedRoute permission="ui:module_access:view:coa">
                    <ChartOfAccountsView />
                  </ProtectedRoute>
                } />

                {/* Budget Configuration - FINANCE_HEAD or SUPER_ADMIN */}
                <Route path="/budgets" element={
                  <ProtectedRoute permission="master_data:budget:edit">
                    <div className="p-8">
                      <BudgetConfigPanel businesses={accessibleBusinesses} />
                    </div>
                  </ProtectedRoute>
                } />

                {/* Transaction History - View all budget transactions */}
                <Route path="/finance/transactions" element={
                  <ProtectedRoute permission="ui:module_access:view:finance">
                    <TransactionHistoryView businesses={accessibleBusinesses} />
                  </ProtectedRoute>
                } />

                {/* Bank Reconciliation */}
                <Route path="/finance/bank-recon" element={
                  <ProtectedRoute permission="ui:module_access:view:bank_recon">
                    <BankReconView />
                  </ProtectedRoute>
                } />

                {/* Inventory Module */}
                <Route path="/inventory" element={
                  <InventoryIntegrityMonitor />
                } />
                <Route path="/inventory/stock-take" element={
                  <StockTakeView currentUser={currentUser} businesses={accessibleBusinesses} />
                } />
                <Route path="/inventory/reports" element={
                  <InventoryReports currentUser={currentUser} />
                } />
                <Route path="/inventory/items" element={
                  <InventoryItemsView businesses={accessibleBusinesses} uomOptions={uomOptions} />
                } />
                <Route path="/inventory/variance" element={
                  <VarianceReportView businesses={accessibleBusinesses} />
                } />
                <Route path="/inventory/recon" element={
                  <VarianceReconReport businesses={accessibleBusinesses} currentUser={currentUser} />
                } />
                <Route path="/inventory/fixed-assets" element={
                  <FixedAssetsView businesses={accessibleBusinesses} currentUser={currentUser} allUsers={users} />
                } />
                <Route path="/inventory/receiving" element={
                  <GoodsReceivingView businesses={accessibleBusinesses} currentUser={currentUser} />
                } />
                <Route path="/inventory/wastage" element={
                  <WastageView businesses={accessibleBusinesses} currentUser={currentUser} />
                } />

                {/* Menu Engineering Module */}
                <Route path="/menu" element={
                  <Navigate to="/menu/dashboard" replace />
                } />
                <Route path="/menu/dashboard" element={
                  <MenuDashboard businesses={accessibleBusinesses} currentUser={currentUser} />
                } />
                <Route path="/menu/digital-black-book" element={
                  <ProtectedRoute permission={['ui:module_access:view:black_book', 'menu:black_book:view:all']}>
                    <DigitalBlackBookView businesses={accessibleBusinesses} currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/menu/digital-black-book/:id" element={
                  <ProtectedRoute permission={['ui:module_access:view:black_book', 'menu:black_book:view:all']}>
                    <DigitalBlackBookDetailsView businesses={accessibleBusinesses} currentUser={currentUser} />
                  </ProtectedRoute>
                } />



                <Route path="/settings" element={
                  <ProtectedRoute permission="ui:module_access:view:settings">
                    <SettingsView
                      currentUser={currentUser}
                      businesses={businesses}
                      handleAddBusiness={addBusiness}
                      onUpdateBusiness={updateBusiness}
                      onDeleteBusiness={deleteBusiness}
                      allUsers={users}
                      setAllUsers={updateUser}
                      pendingUsers={pendingUsers}
                      onApproveUser={handleApproveUser}
                      onRejectUser={handleRejectUser}
                      loadingUserId={approvalLoadingId}
                      uomOptions={uomOptions}
                    />
                  </ProtectedRoute>
                } />

                {/* Activity Log - SuperAdmin Only (hardcoded) */}
                {currentUser.role === UserRole.SUPER_ADMIN && (
                  <Route path="/activity-log" element={
                    <ActivityLogView
                      requisitions={requisitions}
                      allUsers={users}
                      businesses={businesses}
                    />
                  } />
                )}

                <Route path="/notifications" element={
                  <ProtectedRoute>
                    <NotificationsView />
                  </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </Suspense>
    </>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-slate-800 p-8 rounded-xl border border-red-500/50">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <pre className="bg-slate-950 p-4 rounded overflow-auto text-sm text-red-200">
              {this.state.error?.toString()}
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}



function App() {
  if (!isConfigValid) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-sans">
        <div className="max-w-2xl w-full bg-slate-800 p-8 rounded-xl border border-amber-500/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">⚠️</span>
            <h1 className="text-2xl font-bold text-amber-400">Missing Configuration</h1>
          </div>
          <p className="text-slate-300 mb-4 text-lg">
            Firebase environment variables are missing. Create a <code className="bg-slate-700 px-1 py-0.5 rounded">.env</code> file in the project root.
          </p>
          <div className="bg-slate-950 p-6 rounded-lg mb-6 border border-slate-700">
            <pre className="text-sm text-green-400 font-mono">{`VITE_FIREBASE_API_KEY="your_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_auth_domain"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_storage_bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
VITE_FIREBASE_MEASUREMENT_ID="your_measurement_id"`}</pre>
          </div>
          <p className="text-sm text-slate-400">After adding the file, restart your dev server.</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <PermissionsProvider>
              <BusinessUnitProvider>
                <DataProvider>
                  <Routes>
                    <Route path="/login" element={
                      <Suspense fallback={<PageLoader />}>
                        <LoginView />
                      </Suspense>
                    } />
                    <Route path="/*" element={<ProtectedApp />} />
                  </Routes>
                </DataProvider>
              </BusinessUnitProvider>
            </PermissionsProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
