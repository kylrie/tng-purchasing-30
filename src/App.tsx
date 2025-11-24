import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './shared/components/Layout';
import ProtectedRoute from './shared/components/ProtectedRoute';
import LoginView from './features/auth/views/LoginView';
import DashboardView from './features/dashboard/views/DashboardView';
import { AnalyticsView } from './features/dashboard/views/AnalyticsView';
import BURFView from './features/procurement/views/BURFView';
import PRFView from './features/procurement/views/PRFView';
import { PRFFormView } from './features/procurement/views/PRFFormView';
import LiquidationView from './features/finance/views/LiquidationView';
import SuppliersView from './features/inventory/views/SuppliersView';
import MaintenanceView from './features/admin/views/MaintenanceView';
import { SettingsView } from './features/admin/views/SettingsView';
import type { Requisition, Business, User, NotificationItem } from './shared/types';
import { RequisitionStatus, type Supplier } from './features/procurement/types';
import { UserRole } from './features/auth/types';

function AppContent() {
  // Mock user for Layout prop (will be replaced by real auth context later)
  const [currentUser, setCurrentUser] = useState<User>(() => {
      const userJson = localStorage.getItem('currentUser');
      try {
          const parsed = userJson ? JSON.parse(userJson) : null;
          if (parsed && parsed.role) return parsed;
      } catch (e) {
          console.error("Error parsing user", e);
      }
      return {
        id: 'user-1',
        name: 'Guest User',
        role: UserRole.SUPER_ADMIN,
        avatar: '',
        email: 'guest@example.com',
        businessId: 'biz-1'
      };
  });

  // Mock businesses
  const [businesses] = useState<Business[]>([
    { id: 'biz-1', name: 'Main Office', currency: 'PHP', address: '123 Main St', tin: '123-456-789' },
    { id: 'biz-2', name: 'Branch Office', currency: 'PHP', address: '456 Branch Ave', tin: '987-654-321' }
  ]);

  // Mock users
  const [allUsers] = useState<User[]>([
    currentUser,
    { id: 'user-2', name: 'John Manager', role: UserRole.MANAGER, avatar: '', email: 'manager@example.com', businessId: 'biz-1' },
    { id: 'user-3', name: 'Jane CIC', role: UserRole.CIC, avatar: '', email: 'cic@example.com', businessId: 'biz-1' }
  ]);

  // Mock suppliers for PRF
  const [suppliers, setSuppliers] = useState<Supplier[]>([
    { id: 'sup-1', name: 'ABC Office Supplies', category: 'Office Supplies', rating: 4.5, contractEnd: '2025-12-31', tin: '000-111-222', address: '123 Business Rd', paymentMode: 'Check', terms: '30 Days' },
    { id: 'sup-2', name: 'Tech Solutions Inc.', category: 'IT Equipment', rating: 4.8, contractEnd: '2025-06-30', tin: '111-222-333', address: '456 Tech Ave', paymentMode: 'Bank Transfer', terms: '15 Days' },
    { id: 'sup-3', name: 'Furniture World', category: 'Furniture', rating: 4.3, contractEnd: '2025-09-15', tin: '222-333-444', address: '789 Furnish Blvd', paymentMode: 'Check', terms: 'COD' },
    { id: 'sup-4', name: 'Print Masters', category: 'Printing Services', rating: 4.6, contractEnd: '2025-11-30', tin: '333-444-555', address: '101 Print St', paymentMode: 'Cash', terms: 'COD' },
    { id: 'sup-5', name: 'Clean Pro Services', category: 'Cleaning Supplies', rating: 4.4, contractEnd: '2025-08-20', tin: '444-555-666', address: '202 Clean Ln', paymentMode: 'Check', terms: '30 Days' }
  ]);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Helper to add notifications
  const addNotification = (message: string, targetRoles: UserRole[], reqId?: string, type: 'BURF' | 'PRF' | 'LIQUIDATION' | 'INFO' = 'INFO') => {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      type,
      message,
      requisitionId: reqId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      targetRoles
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Requisitions state with mock data for all workflow stages
  const [requisitions, setRequisitions] = useState<Requisition[]>([
    // DRAFT - Employee created but not submitted
    {
      id: 'REQ-1001',
      requesterId: 'user-1',
      businessId: 'biz-1',
      description: 'Office Supplies for Q1',
      projectName: 'General Operations',
      items: [
        { itemId: 'item-1', name: 'A4 Paper (Ream)', quantity: 50, uom: 'ream', stockOnHand: 10, price: 0, remarks: 'White, 80gsm' },
        { itemId: 'item-2', name: 'Ballpoint Pens', quantity: 100, uom: 'pcs', stockOnHand: 20, price: 0, remarks: 'Blue ink' }
      ],
      totalAmount: 0,
      status: RequisitionStatus.DRAFT,
      dateCreated: '2025-01-15',
      remarks: 'Urgent - stock running low',
      attachments: []
    },
    {
      id: 'REQ-1002',
      requesterId: 'user-1',
      businessId: 'biz-1',
      description: 'IT Equipment Upgrade',
      projectName: 'Digital Transformation',
      items: [
        { itemId: 'item-3', name: 'Laptop - Dell Latitude', quantity: 5, uom: 'unit', stockOnHand: 0, price: 0, remarks: 'i7, 16GB RAM' },
        { itemId: 'item-4', name: 'External Monitor 24"', quantity: 5, uom: 'unit', stockOnHand: 0, price: 0, remarks: 'Full HD' }
      ],
      totalAmount: 0,
      status: RequisitionStatus.BURF_PENDING_MANAGER,
      dateCreated: '2025-01-16',
      remarks: 'For new hires',
      attachments: ['https://drive.google.com/file/d/sample123']
    },
    {
      id: 'REQ-1003',
      requesterId: 'user-1',
      businessId: 'biz-2',
      description: 'Marketing Materials',
      projectName: 'Q1 Campaign',
      items: [
        { itemId: 'item-5', name: 'Brochures', quantity: 1000, uom: 'pcs', stockOnHand: 0, price: 0, remarks: 'Full color, glossy' },
        { itemId: 'item-6', name: 'Business Cards', quantity: 500, uom: 'pcs', stockOnHand: 0, price: 0, remarks: 'Premium stock' }
      ],
      totalAmount: 0,
      status: RequisitionStatus.BURF_PENDING_CIC,
      dateCreated: '2025-01-17',
      remarks: 'Campaign launch Feb 1',
      attachments: []
    },
    {
      id: 'REQ-1004',
      requesterId: 'user-1',
      businessId: 'biz-1',
      description: 'Furniture for New Office',
      projectName: 'Office Expansion',
      items: [
        { itemId: 'item-7', name: 'Office Desk', quantity: 10, uom: 'unit', stockOnHand: 0, price: 0, remarks: 'L-shaped' },
        { itemId: 'item-8', name: 'Office Chair', quantity: 10, uom: 'unit', stockOnHand: 0, price: 0, remarks: 'Ergonomic' },
        { itemId: 'item-9', name: 'Filing Cabinet', quantity: 5, uom: 'unit', stockOnHand: 0, price: 0, remarks: '4-drawer' }
      ],
      totalAmount: 0,
      status: RequisitionStatus.READY_FOR_PRF,
      dateCreated: '2025-01-18',
      remarks: 'New office opening Feb 15',
      attachments: []
    },
    {
      id: 'REQ-1005',
      requesterId: 'user-1',
      businessId: 'biz-1',
      description: 'Cleaning Supplies',
      projectName: 'Facilities Maintenance',
      items: [
        { itemId: 'item-10', name: 'Floor Cleaner', quantity: 20, uom: 'liter', stockOnHand: 5, price: 250, remarks: 'Industrial grade' },
        { itemId: 'item-11', name: 'Trash Bags', quantity: 100, uom: 'pcs', stockOnHand: 10, price: 50, remarks: 'Large, heavy duty' }
      ],
      totalAmount: 10000,
      status: RequisitionStatus.PRF_PENDING_MANAGER,
      dateCreated: '2025-01-19',
      remarks: 'Monthly supply',
      attachments: [],
      prfDetails: {
        supplier: {
          name: 'CleanCo Supplies',
          tin: '123-456-789',
          address: '123 Clean St, Manila',
          paymentMode: 'Check',
          terms: '30 Days'
        },
        preparedBy: 'user-2',
        datePrepared: '2025-01-19T10:00:00'
      }
    },
    {
      id: 'REQ-1006',
      requesterId: 'user-1',
      businessId: 'biz-1',
      description: 'Software Licenses',
      projectName: 'IT Infrastructure',
      items: [
        { itemId: 'item-12', name: 'Microsoft Office 365', quantity: 25, uom: 'license', stockOnHand: 0, price: 5000, remarks: 'Annual subscription' },
        { itemId: 'item-13', name: 'Adobe Creative Cloud', quantity: 5, uom: 'license', stockOnHand: 0, price: 8000, remarks: 'Annual subscription' }
      ],
      totalAmount: 165000,
      status: RequisitionStatus.APPROVED_FOR_PAYMENT,
      dateCreated: '2025-01-20',
      remarks: 'Renewal due Feb 1',
      attachments: [],
      prfDetails: {
        supplier: {
          name: 'SoftWarez Inc.',
          tin: '987-654-321',
          address: '456 Tech Blvd, Makati',
          paymentMode: 'Bank Transfer',
          terms: '15 Days'
        },
        preparedBy: 'user-2',
        datePrepared: '2025-01-20T14:30:00'
      }
    },
    {
      id: 'REQ-1007',
      requesterId: 'user-1',
      businessId: 'biz-2',
      description: 'Training Materials',
      projectName: 'Employee Development',
      items: [
        { itemId: 'item-14', name: 'Training Manuals', quantity: 30, uom: 'pcs', stockOnHand: 0, price: 500, remarks: 'Printed and bound' },
        { itemId: 'item-15', name: 'USB Drives 16GB', quantity: 30, uom: 'pcs', stockOnHand: 0, price: 300, remarks: 'For training materials' }
      ],
      totalAmount: 24000,
      status: RequisitionStatus.FUNDS_RELEASED,
      dateCreated: '2025-01-21',
      remarks: 'Training session Feb 10',
      attachments: [],
      prfDetails: {
        supplier: {
          name: 'Print Masters',
          tin: '444-555-666',
          address: '789 Print Ave, Quezon City',
          paymentMode: 'Cash',
          terms: 'COD'
        },
        preparedBy: 'user-2',
        datePrepared: '2025-01-21T09:00:00'
      }
    },
    {
      id: 'REQ-1008',
      requesterId: 'user-1',
      businessId: 'biz-1',
      description: 'Team Building Event',
      projectName: 'Employee Engagement',
      items: [
        { itemId: 'item-16', name: 'Venue Rental', quantity: 1, uom: 'day', stockOnHand: 0, price: 15000, remarks: 'Resort package' },
        { itemId: 'item-17', name: 'Catering Services', quantity: 50, uom: 'pax', stockOnHand: 0, price: 500, remarks: 'Lunch and snacks' }
      ],
      totalAmount: 40000,
      status: RequisitionStatus.LIQUIDATION_FILED,
      dateCreated: '2025-01-10',
      remarks: 'Event completed Jan 25',
      attachments: ['https://drive.google.com/file/receipts']
    }
  ]);

  // Status badge helper
  const getStatusBadge = (status: RequisitionStatus) => {
    const badges: Record<RequisitionStatus, { bg: string; text: string; label: string }> = {
      [RequisitionStatus.DRAFT]: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
      [RequisitionStatus.BURF_PENDING_MANAGER]: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Manager' },
      [RequisitionStatus.BURF_PENDING_CIC]: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending CIC' },
      [RequisitionStatus.READY_FOR_PRF]: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Ready for PRF' },
      [RequisitionStatus.PRF_PENDING_MANAGER]: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'PRF Pending' },
      [RequisitionStatus.APPROVED_FOR_PAYMENT]: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
      [RequisitionStatus.FUNDS_RELEASED]: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Funds Released' },
      [RequisitionStatus.LIQUIDATION_FILED]: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Liquidation Filed' },
      [RequisitionStatus.AUDITED_CLEARED]: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Cleared' },
      [RequisitionStatus.REJECTED]: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' }
    };
    const badge = badges[status];
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>;
  };

  // Handlers
  const handleReject = (id: string, comment?: string) => {
    setRequisitions(prev => prev.map(r =>
      r.id === id ? { ...r, status: RequisitionStatus.REJECTED } : r
    ));
    addNotification(`Requisition ${id} rejected. Please review.`, [UserRole.EMPLOYEE, UserRole.PURCHASING_OFFICER], id, 'INFO');
    alert(`Requisition ${id} rejected${comment ? `: ${comment}` : ''}`);
  };

  const handleManagerApproveBURF = (id: string, _comment?: string) => {
    setRequisitions(prev => prev.map(r =>
      r.id === id ? { ...r, status: RequisitionStatus.BURF_PENDING_CIC } : r
    ));
    addNotification(`New BURF ${id} approved by Manager. Inventory Check Required.`, [UserRole.CIC, UserRole.SUPER_ADMIN], id, 'BURF');
    alert(`BURF ${id} approved by manager`);
  };

  const handleCICApproveBURF = (id: string, _comment?: string) => {
    setRequisitions(prev => prev.map(r =>
      r.id === id ? { ...r, status: RequisitionStatus.READY_FOR_PRF } : r
    ));
    addNotification(`BURF ${id} inventory checked. Ready for PRF.`, [UserRole.PURCHASING_OFFICER, UserRole.SUPER_ADMIN], id, 'BURF');
    alert(`BURF ${id} approved by CIC`);
  };

  const handleManagerApprovePRF = (id: string) => {
    setRequisitions(prev => prev.map(r =>
      r.id === id ? { ...r, status: RequisitionStatus.APPROVED_FOR_PAYMENT } : r
    ));
    addNotification(`PRF ${id} approved. Ready for Payment Processing.`, [UserRole.FINANCE, UserRole.SUPER_ADMIN], id, 'PRF');
    alert(`PRF ${id} approved for payment`);
  };

  const onCreateRequisition = (req: Requisition) => {
    setRequisitions(prev => [req, ...prev]);
    if (req.status === RequisitionStatus.BURF_PENDING_MANAGER) {
        addNotification(`New BURF Request ${req.id} pending approval.`, [UserRole.MANAGER, UserRole.SUPER_ADMIN], req.id, 'BURF');
    }
    alert(`Requisition ${req.id} created successfully`);
  };

  const onUpdateRequisition = (req: Requisition) => {
    setRequisitions(prev => prev.map(r => r.id === req.id ? req : r));
    if (req.status === RequisitionStatus.LIQUIDATION_FILED) {
        addNotification(`Liquidation filed for ${req.id}. Audit required.`, [UserRole.AUDITOR, UserRole.FINANCE, UserRole.SUPER_ADMIN], req.id, 'LIQUIDATION');
    } else if (req.status === RequisitionStatus.PRF_PENDING_MANAGER) {
        addNotification(`PRF Prepared for ${req.id}. Manager approval required.`, [UserRole.MANAGER, UserRole.SUPER_ADMIN], req.id, 'PRF');
    }
    alert(`Requisition ${req.id} updated successfully`);
  };

  const handleReleaseFunds = (id: string) => {
    setRequisitions(prev => prev.map(r =>
      r.id === id ? { ...r, status: RequisitionStatus.FUNDS_RELEASED } : r
    ));
    addNotification(`Funds released for ${id}. Please proceed with purchase.`, [UserRole.EMPLOYEE, UserRole.PURCHASING_OFFICER], id, 'LIQUIDATION');
    alert(`Funds released for requisition ${id}. Ready for liquidation filing.`);
  };

  // Filter notifications for current user
  const userNotifications = notifications.filter(n => 
    n.targetRoles?.includes(currentUser.role) || currentUser.role === UserRole.SUPER_ADMIN
  );

  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout
            currentUser={currentUser}
            notifications={userNotifications}
            onNotificationClick={() => { }}
            onLogout={() => {
              localStorage.removeItem('currentUser');
              window.location.href = '/login';
            }}
          >
            <DashboardView requisitions={requisitions} currentUser={currentUser} />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/burf" element={
        <ProtectedRoute>
          <Layout
            currentUser={currentUser}
            notifications={userNotifications}
            onNotificationClick={() => { }}
            onLogout={() => {
              localStorage.removeItem('currentUser');
              window.location.href = '/login';
            }}
          >
            <BURFView
              currentUser={currentUser}
              requisitions={requisitions}
              setRequisitions={setRequisitions}
              visibleRequisitions={requisitions}
              allUsers={allUsers}
              handleReject={handleReject}
              handleManagerApproveBURF={handleManagerApproveBURF}
              handleCICApproveBURF={handleCICApproveBURF}
              getStatusBadge={getStatusBadge}
              onCreateRequisition={onCreateRequisition}
              onUpdateRequisition={onUpdateRequisition}
              businesses={businesses}
            />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/prf" element={
        <ProtectedRoute>
          <Layout
            currentUser={currentUser}
            notifications={userNotifications}
            onNotificationClick={() => { }}
            onLogout={() => {
              localStorage.removeItem('currentUser');
              window.location.href = '/login';
            }}
          >
            <PRFView
              currentUser={currentUser}
              visibleRequisitions={requisitions}
              setRequisitions={setRequisitions}
              requisitions={requisitions}
              handleReject={handleReject}
              handleManagerApprovePRF={handleManagerApprovePRF}
              getStatusBadge={getStatusBadge}
              businesses={businesses}
              allUsers={allUsers}
              onCreateRequisition={onCreateRequisition}
              suppliers={suppliers}
            />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/liquidation" element={
        <ProtectedRoute>
          <Layout
            currentUser={currentUser}
            notifications={userNotifications}
            onNotificationClick={() => { }}
            onLogout={() => {
              localStorage.removeItem('currentUser');
              window.location.href = '/login';
            }}
          >
            <LiquidationView
              requisitions={requisitions}
              currentUser={currentUser}
              handleReleaseFunds={handleReleaseFunds}
              getStatusBadge={getStatusBadge}
              businesses={businesses}
              allUsers={allUsers}
              onUpdateRequisition={onUpdateRequisition}
            />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/suppliers" element={
        <ProtectedRoute>
          <Layout
            currentUser={currentUser}
            notifications={userNotifications}
            onNotificationClick={() => { }}
            onLogout={() => {
              localStorage.removeItem('currentUser');
              window.location.href = '/login';
            }}
          >
            <SuppliersView suppliers={suppliers} setSuppliers={setSuppliers} />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/analytics" element={
        <ProtectedRoute>
          <Layout
            currentUser={currentUser}
            notifications={userNotifications}
            onNotificationClick={() => { }}
            onLogout={() => {
              localStorage.removeItem('currentUser');
              window.location.href = '/login';
            }}
          >
            <AnalyticsView
              isAiLoading={false}
              handleGenerateInsight={() => alert('AI Insight generation not yet implemented')}
              aiInsight={null}
            />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout
            currentUser={currentUser}
            notifications={userNotifications}
            onNotificationClick={() => { }}
            onLogout={() => {
              localStorage.removeItem('currentUser');
              window.location.href = '/login';
            }}
          >
            <SettingsView
              currentUser={currentUser}
              businesses={[]}
              handleAddBusiness={() => alert('Add business not yet implemented')}
              allUsers={[]}
              setAllUsers={() => { }}
            />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/prf/form/:id" element={
        <ProtectedRoute>
          <Layout
            currentUser={currentUser}
            notifications={userNotifications}
            onNotificationClick={() => { }}
            onLogout={() => {
              localStorage.removeItem('currentUser');
              window.location.href = '/login';
            }}
          >
            <PRFFormView
              requisitionId={window.location.pathname.split('/').pop() || ''}
              onCancel={() => window.history.back()}
              requisitions={requisitions}
              handleSubmitPRF={() => alert('PRF submission not yet implemented')}
            />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/maintenance" element={<MaintenanceView />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
