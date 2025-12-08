import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import Layout from './shared/components/Layout';
import LoginView from './features/auth/views/LoginView';
import DashboardView from './features/dashboard/views/DashboardView';

import BurfView from './features/procurement/views/BURFView';
import PrfView from './features/procurement/views/PRFView';
import ProcurementApprovalsView from './features/procurement/views/ProcurementApprovalsView';
import ApprovedView from './features/procurement/views/ApprovedView';
import FinanceView from './features/finance/views/FinanceView';
import LiquidationView from './features/finance/views/LiquidationView';
import PCFView from './features/finance/views/PCFView';
import PCFApprovalView from './features/finance/views/PCFApprovalView';
import SuppliersView from './features/inventory/views/SuppliersView';
import { SettingsView } from './features/admin/views/SettingsView';
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
    // Modern pill styling with distinct colors
    const styles = {
      [RequisitionStatus.DRAFT]: 'bg-slate-600/50 text-slate-300',
      // PENDING statuses - Orange tones
      [RequisitionStatus.BURF_PENDING_MANAGER]: 'bg-orange-500/20 text-orange-400',
      [RequisitionStatus.BURF_PENDING_CIC]: 'bg-amber-500/20 text-amber-400',
      [RequisitionStatus.PRF_PENDING_MANAGER]: 'bg-orange-500/20 text-orange-400',
      // APPROVED/READY statuses - Blue tones
      [RequisitionStatus.READY_FOR_PRF]: 'bg-blue-500/20 text-blue-400',
      [RequisitionStatus.BURF_COMPLETED]: 'bg-sky-500/20 text-sky-400',
      [RequisitionStatus.APPROVED_FOR_PAYMENT]: 'bg-cyan-500/20 text-cyan-400',
      // RELEASED/SUCCESS statuses - Green tones  
      [RequisitionStatus.FUNDS_RELEASED]: 'bg-emerald-500/20 text-emerald-400',
      [RequisitionStatus.LIQUIDATION_FILED]: 'bg-teal-500/20 text-teal-400',
      [RequisitionStatus.AUDITED_CLEARED]: 'bg-green-500/20 text-green-400',
      // REJECTED statuses - Red tones
      [RequisitionStatus.LIQUIDATION_REJECTED]: 'bg-red-500/20 text-red-400',
      [RequisitionStatus.REJECTED]: 'bg-red-500/20 text-red-400',
      [RequisitionStatus.CANCELLED]: 'bg-gray-600/50 text-gray-400',
    };
    const labels = {
      [RequisitionStatus.DRAFT]: 'Draft',
      [RequisitionStatus.BURF_PENDING_MANAGER]: 'Pending BUM',
      [RequisitionStatus.BURF_PENDING_CIC]: 'Pending CIC',
      [RequisitionStatus.READY_FOR_PRF]: 'Ready for PRF',
      [RequisitionStatus.BURF_COMPLETED]: 'BURF Complete',
      [RequisitionStatus.PRF_PENDING_MANAGER]: 'Pending Review',
      [RequisitionStatus.APPROVED_FOR_PAYMENT]: 'For Release',
      [RequisitionStatus.FUNDS_RELEASED]: 'Released',
      [RequisitionStatus.LIQUIDATION_FILED]: 'Liquidated',
      [RequisitionStatus.LIQUIDATION_REJECTED]: 'Liq. Rejected',
      [RequisitionStatus.AUDITED_CLEARED]: 'Cleared',
      [RequisitionStatus.REJECTED]: 'Rejected',
      [RequisitionStatus.CANCELLED]: 'Cancelled',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-600/50 text-slate-300'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const handleReleaseFunds = async (id: string, chequeNumber: string, chequeImageUrl?: string) => {
    // Use the new service method that automatically updates linked PCF liquidations
    await RequisitionService.releaseFundsWithPcfUpdate(
      id,
      chequeNumber,
      chequeImageUrl,
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
      <Routes>
        <Route path="/" element={<DashboardView requisitions={requisitions} currentUser={currentUser} allUsers={users} suppliers={suppliers} businesses={businesses} onCreateRequisition={createRequisition} onUpdateRequisition={updateRequisition} />} />

        <Route path="/burf" element={
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
        } />

        <Route path="/prf" element={
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
        } />

        <Route path="/procurement-approvals" element={
          <ProcurementApprovalsView
            currentUser={currentUser}
            requisitions={requisitions}
            allUsers={users}
            businesses={businesses}
            onUpdateRequisition={updateRequisition}
            getStatusBadge={getStatusBadge}
          />
        } />

        <Route path="/approved" element={
          <ApprovedView
            currentUser={currentUser}
            requisitions={requisitions}
            allUsers={users}
            businesses={businesses}
            getStatusBadge={getStatusBadge}
          />
        } />

        <Route path="/finance" element={
          <FinanceView
            currentUser={currentUser}
            requisitions={requisitions}
            getStatusBadge={getStatusBadge}
            handleReleaseFunds={handleReleaseFunds}
            businesses={businesses}
            allUsers={users}
          />
        } />

        <Route path="/liquidation" element={
          <LiquidationView
            currentUser={currentUser}
            requisitions={requisitions}
            getStatusBadge={getStatusBadge}
            handleReleaseFunds={handleReleaseFunds}
            businesses={businesses}
            onUpdateRequisition={updateRequisition}
            allUsers={users}
          />
        } />

        <Route path="/pcf" element={
          <PCFView
            currentUser={currentUser}
            businesses={businesses}
            allUsers={users}
          />
        } />

        <Route path="/pcf-approvals" element={
          <PCFApprovalView
            currentUser={currentUser}
            businesses={businesses}
            allUsers={users}
          />
        } />

        <Route path="/suppliers" element={
          <SuppliersView
            suppliers={suppliers}
            onCreateSupplier={createSupplier}
            onUpdateSupplier={updateSupplier}
            onDeleteSupplier={deleteSupplier}
            currentUser={currentUser}
            businesses={businesses}
          />
        } />

        <Route path="/settings" element={
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
        } />



        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
        <AuthProvider>
          <PermissionsProvider>
            <Routes>
              <Route path="/login" element={<LoginView />} />
              <Route path="/*" element={<ProtectedApp />} />
            </Routes>
          </PermissionsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
