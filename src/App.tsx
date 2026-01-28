import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
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
import { db } from './config/firebase';
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
const SuppliersView = React.lazy(() => import('./features/inventory/views/SuppliersView'));
const InventoryReports = React.lazy(() => import('./features/inventory/views/InventoryReports'));
const InventoryDashboard = React.lazy(() => import('./features/inventory/views/InventoryDashboard'));
const InventoryItemsView = React.lazy(() => import('./features/inventory/views/InventoryItemsView'));
const FixedAssetsView = React.lazy(() => import('./features/inventory/views/FixedAssetsView'));
const VarianceReportView = React.lazy(() => import('./features/inventory/views/VarianceReportView'));
const MenuDashboard = React.lazy(() => import('./features/menu/views/MenuDashboard'));
const ProductionRecipeView = React.lazy(() => import('./features/menu/views/ProductionRecipeView'));
const ChartOfAccountsView = React.lazy(() => import('./features/admin/views/ChartOfAccountsView'));
const BudgetConfigPanel = React.lazy(() => import('./features/finance/components/BudgetConfigPanel').then(module => ({ default: module.BudgetConfigPanel })));
const SettingsView = React.lazy(() => import('./features/admin/views/SettingsView').then(module => ({ default: module.SettingsView })));
const ActivityLogView = React.lazy(() => import('./features/admin/views/ActivityLogView'));
const LoginView = React.lazy(() => import('./features/auth/views/LoginView'));
const DashboardView = React.lazy(() => import('./features/dashboard/views/DashboardView'));

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
  const { uomOptions, updateUOMs } = useUOM();

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

  const handleReleaseFunds = async (id: string, checkVoucherNumber: string, checkVoucherLink?: string) => {
    // Use the new service method that automatically updates linked PCF liquidations
    await RequisitionService.releaseFundsWithPcfUpdate(
      id,
      checkVoucherNumber,
      checkVoucherLink,
      currentUser?.id,
      currentUser?.name
    );
  };

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
    pendingApprovalsCount: pendingUsers.length
  };

  return (
    <Layout {...layoutProps}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<DashboardView requisitions={requisitions} currentUser={currentUser} allUsers={users} suppliers={suppliers} businesses={businesses} onCreateRequisition={createRequisition} onUpdateRequisition={updateRequisition} />} />

          <Route path="/burf" element={
            <ProtectedRoute permission="module:view:burf">
              <BurfView
                currentUser={currentUser}
                visibleRequisitions={requisitions}
                allUsers={users}
                businesses={businesses}
                getStatusBadge={getStatusBadge}
                onCreateRequisition={createRequisition}
                onUpdateRequisition={updateRequisition}
                uomOptions={uomOptions}
              />
            </ProtectedRoute>
          } />

          {/* Full-screen BURF Page Routes (modal-to-page refactor) */}
          <Route path="/burf/new" element={
            <ProtectedRoute permission="requisition:create:burf">
              <BURFPage />
            </ProtectedRoute>
          } />
          <Route path="/burf/edit/:burfId" element={
            <ProtectedRoute permission="requisition:edit:draft">
              <BURFPage />
            </ProtectedRoute>
          } />

          <Route path="/prf" element={
            <ProtectedRoute permission="module:view:prf">
              <PrfView
                currentUser={currentUser}
                visibleRequisitions={requisitions}
                getStatusBadge={getStatusBadge}
                businesses={businesses}
                allUsers={users}
                onCreateRequisition={createRequisition}
                onUpdateRequisition={updateRequisition}
                suppliers={suppliers}
                uomOptions={uomOptions}
              />
            </ProtectedRoute>
          } />

          <Route path="/prf-tracker" element={
            <ProtectedRoute permission="module:view:prf_tracker">
              <PRFTrackerView
                currentUser={currentUser}
                requisitions={requisitions}
                getStatusBadge={getStatusBadge}
                businesses={businesses}
                allUsers={users}
              />
            </ProtectedRoute>
          } />

          <Route path="/procurement-approvals" element={
            <ProtectedRoute permission="module:view:approvals">
              <ProcurementApprovalsView
                currentUser={currentUser}
                requisitions={requisitions}
                allUsers={users}
                businesses={businesses}
                onUpdateRequisition={updateRequisition}
                getStatusBadge={getStatusBadge}
              />
            </ProtectedRoute>
          } />

          <Route path="/approved" element={
            <ProtectedRoute permission="module:view:approved">
              <ApprovedView
                currentUser={currentUser}
                requisitions={requisitions}
                allUsers={users}
                businesses={businesses}
                getStatusBadge={getStatusBadge}
              />
            </ProtectedRoute>
          } />

          {/* Finance Module - Restructured Routes */}
          {/* Overview - Strategic Finance Dashboard */}
          <Route path="/finance/overview" element={
            <ProtectedRoute permission="module:view:finance">
              <FinanceOverview businesses={businesses} />
            </ProtectedRoute>
          } />

          {/* BR Flow - Existing FinanceView with Fund Release/Check Prep */}
          <Route path="/finance/expenses/br-flow" element={
            <ProtectedRoute permission="module:view:finance">
              <FinanceView
                currentUser={currentUser}
                requisitions={requisitions}
                getStatusBadge={getStatusBadge}
                handleReleaseFunds={handleReleaseFunds}
                businesses={businesses}
                allUsers={users}
              />
            </ProtectedRoute>
          } />

          {/* Legacy /finance redirect to new BR Flow path */}
          <Route path="/finance" element={<Navigate to="/finance/expenses/br-flow" replace />} />

          {/* Income placeholders */}
          <Route path="/finance/income/sales" element={
            <ProtectedRoute permission="module:view:finance">
              <div className="p-8">
                <h1 className="text-2xl font-bold text-white mb-4">Sales</h1>
                <p className="text-slate-400">Coming soon - Sales revenue tracking.</p>
              </div>
            </ProtectedRoute>
          } />
          <Route path="/finance/income/invoices" element={
            <ProtectedRoute permission="module:view:finance">
              <div className="p-8">
                <h1 className="text-2xl font-bold text-white mb-4">Invoices</h1>
                <p className="text-slate-400">Coming soon - Invoice management.</p>
              </div>
            </ProtectedRoute>
          } />

          <Route path="/procurement/liquidation" element={
            <ProtectedRoute permission="liquidation:file:own">
              <LiquidationView
                currentUser={currentUser}
                requisitions={requisitions}
                getStatusBadge={getStatusBadge}
                handleReleaseFunds={handleReleaseFunds}
                businesses={businesses}
                onUpdateRequisition={updateRequisition}
                allUsers={users}
                suppliers={suppliers}
                variant="USER"
              />
            </ProtectedRoute>
          } />

          <Route path="/liquidation" element={
            <ProtectedRoute permission="liquidation:audit">
              <LiquidationView
                currentUser={currentUser}
                requisitions={requisitions}
                getStatusBadge={getStatusBadge}
                handleReleaseFunds={handleReleaseFunds}
                businesses={businesses}
                onUpdateRequisition={updateRequisition}
                allUsers={users}
                suppliers={suppliers}
                variant="AUDIT"
              />
            </ProtectedRoute>
          } />

          {/* Liquidation Page - Full page for filing liquidation (opens in new window) */}
          <Route path="/liquidation/:prfId" element={
            <ProtectedRoute permission={['liquidation:file:own', 'liquidation:file:all']}>
              <LiquidationPage />
            </ProtectedRoute>
          } />

          <Route path="/pcf" element={
            <ProtectedRoute permission="module:view:pcf">
              <PCFView
                currentUser={currentUser}
                businesses={businesses}
                allUsers={users}
              />
            </ProtectedRoute>
          } />

          <Route path="/pcf-approvals" element={
            <ProtectedRoute permission="pcf:approve">
              <PCFApprovalView
                currentUser={currentUser}
                businesses={businesses}
                allUsers={users}
              />
            </ProtectedRoute>
          } />

          <Route path="/pcf-audit-review" element={
            <ProtectedRoute permission="pcf:audit_review">
              <PCFAuditReviewView
                currentUser={currentUser}
                businesses={businesses}
                allUsers={users}
              />
            </ProtectedRoute>
          } />

          <Route path="/suppliers" element={
            <ProtectedRoute permission="module:view:suppliers">
              <SuppliersView
                suppliers={suppliers}
                onCreateSupplier={createSupplier}
                onUpdateSupplier={updateSupplier}
                onDeleteSupplier={deleteSupplier}
                currentUser={currentUser}
                businesses={businesses}
              />
            </ProtectedRoute>
          } />

          <Route path="/chart-of-accounts" element={
            <ProtectedRoute permission="module:view:coa">
              <ChartOfAccountsView />
            </ProtectedRoute>
          } />

          {/* Budget Configuration - FINANCE_HEAD or SUPER_ADMIN */}
          <Route path="/budgets" element={
            <ProtectedRoute permission="budget:manage">
              <div className="p-8">
                <BudgetConfigPanel businesses={businesses} />
              </div>
            </ProtectedRoute>
          } />

          {/* Transaction History - View all budget transactions */}
          <Route path="/finance/transactions" element={
            <ProtectedRoute permission="module:view:finance">
              <TransactionHistoryView businesses={businesses} />
            </ProtectedRoute>
          } />

          {/* Inventory Module */}
          <Route path="/inventory" element={
            <InventoryDashboard currentUser={currentUser} businesses={businesses} uomOptions={uomOptions} />
          } />
          <Route path="/inventory/stock-take" element={
            <Navigate to="/inventory" replace />
          } />
          <Route path="/inventory/reports" element={
            <InventoryReports currentUser={currentUser} />
          } />
          <Route path="/inventory/items" element={
            <InventoryItemsView businesses={businesses} uomOptions={uomOptions} />
          } />
          <Route path="/inventory/variance" element={
            <VarianceReportView businesses={businesses} />
          } />
          <Route path="/inventory/fixed-assets" element={
            <FixedAssetsView businesses={businesses} currentUser={currentUser} allUsers={users} />
          } />
          <Route path="/inventory/receiving" element={
            <div className="text-center py-16">
              <h2 className="text-2xl font-bold text-white mb-4">Goods Receiving</h2>
              <p className="text-slate-400">Coming soon - Record incoming inventory from suppliers</p>
            </div>
          } />

          {/* Menu Engineering Module */}
          <Route path="/menu" element={
            <Navigate to="/menu/finished-goods" replace />
          } />
          <Route path="/menu/finished-goods" element={
            <MenuDashboard businesses={businesses} currentUser={currentUser} />
          } />
          <Route path="/menu/production-recipes" element={
            <ProductionRecipeView businesses={businesses} currentUser={currentUser} />
          } />


          <Route path="/settings" element={
            <ProtectedRoute permission="module:view:settings">
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
                setUomOptions={updateUOMs}
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
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
  return (
    <Router>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <PermissionsProvider>
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
            </PermissionsProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
