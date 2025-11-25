import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './shared/components/Layout';
import LoginView from './features/auth/views/LoginView';
import DashboardView from './features/dashboard/views/DashboardView';
import PendingApprovalsView from './features/admin/views/PendingApprovalsView';
import BurfView from './features/procurement/views/BURFView';
import PrfView from './features/procurement/views/PRFView';
import LiquidationView from './features/finance/views/LiquidationView';
import SuppliersView from './features/inventory/views/SuppliersView';
import { SettingsView } from './features/admin/views/SettingsView';
import type { NotificationItem } from './shared/types';
import { UserRole, UserStatus } from './shared/types/firebase.types';
import { RequisitionStatus } from './features/procurement/types';
import { useRequisitions } from './features/procurement/hooks/useRequisitions';
import { useUsers } from './features/admin/hooks/useUsers';
import { useBusinesses } from './features/admin/hooks/useBusinesses';
import { useSuppliers } from './features/inventory/hooks/useSuppliers';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './config/firebase';
import { COLLECTIONS } from './shared/types/firebase.types';
import { updateRequisitionStatus } from './features/procurement/services/requisitionService';

function ProtectedApp() {
  const { currentUser, logout, loading } = useAuth();
  const { requisitions, createRequisition, updateRequisition } = useRequisitions();
  const { users, setUsers, updateUser } = useUsers();
  const { businesses, addBusiness } = useBusinesses();
  const { suppliers, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();

  const [notifications] = useState<NotificationItem[]>([]);
  const [approvalLoadingId, setApprovalLoadingId] = useState<string | null>(null);

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

  const handleRejectUser = async (userId: string) => {
    setApprovalLoadingId(userId);
    try {
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      await deleteDoc(userRef);
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      console.error("Error rejecting user: ", error);
    } finally {
      setApprovalLoadingId(null);
    }
  };

  const getStatusBadge = (status: RequisitionStatus) => {
    const styles = {
      [RequisitionStatus.DRAFT]: 'bg-slate-700 text-slate-300',
      [RequisitionStatus.BURF_PENDING_MANAGER]: 'bg-orange-900/50 text-orange-400 border border-orange-700/50',
      [RequisitionStatus.BURF_PENDING_CIC]: 'bg-blue-900/50 text-blue-400 border border-blue-700/50',
      [RequisitionStatus.READY_FOR_PRF]: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50',
      [RequisitionStatus.PRF_PENDING_MANAGER]: 'bg-purple-900/50 text-purple-400 border border-purple-700/50',
      [RequisitionStatus.APPROVED_FOR_PAYMENT]: 'bg-cyan-900/50 text-cyan-400 border border-cyan-700/50',
      [RequisitionStatus.FUNDS_RELEASED]: 'bg-green-900/50 text-green-400 border border-green-700/50',
      [RequisitionStatus.LIQUIDATION_FILED]: 'bg-indigo-900/50 text-indigo-400 border border-indigo-700/50',
      [RequisitionStatus.AUDITED_CLEARED]: 'bg-teal-900/50 text-teal-400 border border-teal-700/50',
      [RequisitionStatus.REJECTED]: 'bg-red-900/50 text-red-400 border border-red-700/50',
      [RequisitionStatus.CANCELLED]: 'bg-gray-800 text-gray-400 border border-gray-600',
    };
    const labels = {
      [RequisitionStatus.DRAFT]: 'Draft',
      [RequisitionStatus.BURF_PENDING_MANAGER]: 'Pending Mgr Approval',
      [RequisitionStatus.BURF_PENDING_CIC]: 'Pending CIC Review',
      [RequisitionStatus.READY_FOR_PRF]: 'Ready for PRF',
      [RequisitionStatus.PRF_PENDING_MANAGER]: 'Pending PRF Approval',
      [RequisitionStatus.APPROVED_FOR_PAYMENT]: 'Approved for Payment',
      [RequisitionStatus.FUNDS_RELEASED]: 'Funds Released',
      [RequisitionStatus.LIQUIDATION_FILED]: 'Liquidation Filed',
      [RequisitionStatus.AUDITED_CLEARED]: 'Audited & Cleared',
      [RequisitionStatus.REJECTED]: 'Rejected',
      [RequisitionStatus.CANCELLED]: 'Cancelled',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status] || 'bg-slate-700 text-slate-300'}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Requisition Action Handlers
  const handleManagerApprovePRF = async (id: string) => {
      await updateRequisitionStatus(id, RequisitionStatus.APPROVED_FOR_PAYMENT);
      window.location.reload(); 
  };

  const handleReject = async (id: string) => {
      await updateRequisitionStatus(id, RequisitionStatus.REJECTED);
      window.location.reload();
  };

  const handleReleaseFunds = async (id: string) => {
      await updateRequisitionStatus(id, RequisitionStatus.FUNDS_RELEASED);
      window.location.reload();
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
    onNotificationClick: () => {},
    onLogout: logout,
    pendingApprovalsCount: pendingUsers.length
  };

  return (
    <Layout {...layoutProps}>
      <Routes>
        <Route path="/" element={<DashboardView requisitions={requisitions} currentUser={currentUser} />} />
        
        <Route path="/burf" element={
            <BurfView 
                currentUser={currentUser}
                visibleRequisitions={requisitions} 
                allUsers={users}
                businesses={businesses}
                getStatusBadge={getStatusBadge}
                onCreateRequisition={createRequisition}
                onUpdateRequisition={updateRequisition}
            />
        } />

        <Route path="/prf" element={
            <PrfView 
                currentUser={currentUser}
                visibleRequisitions={requisitions}
                handleReject={handleReject}
                handleManagerApprovePRF={handleManagerApprovePRF}
                getStatusBadge={getStatusBadge}
                businesses={businesses}
                allUsers={users}
                onCreateRequisition={createRequisition}
                onUpdateRequisition={updateRequisition}
                suppliers={suppliers}
            />
        } />

        <Route path="/liquidation" element={
            <LiquidationView 
                currentUser={currentUser}
                requisitions={requisitions}
                onUpdateRequisition={updateRequisition}
                getStatusBadge={getStatusBadge}
                handleReleaseFunds={handleReleaseFunds}
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
            />
        } />

        <Route path="/settings" element={
            <SettingsView 
                currentUser={currentUser}
                businesses={businesses}
                handleAddBusiness={addBusiness}
                allUsers={users}
                setAllUsers={updateUser}
            />
        } />

        {currentUser.role === UserRole.SUPER_ADMIN && (
          <Route path="/approvals" element={
            <PendingApprovalsView 
              pendingUsers={pendingUsers} 
              onApproveUser={handleApproveUser} 
              onRejectUser={handleRejectUser}
              loadingUserId={approvalLoadingId}
            />
          } />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
