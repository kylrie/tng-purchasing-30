import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ALL_PERMISSIONS } from '../../../config/permissions';
import type { Permission } from '../../../config/permissions';
import { UserRole, SystemRole, DEFAULT_BUSINESS_ROLES } from '../../procurement/types';
import Card from '../../../shared/components/Card';
import { usePermissionsContext } from '../../../contexts/PermissionsContext';
import { ScopedPermissionCell } from './ScopedPermissionCell';
import {
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  Grid,
  Users,
  Save,
  AlertCircle,
  CheckSquare,
  Lock,
  Plus
} from 'lucide-react';

interface PermissionsMatrixProps {
  onSave: (data: { permissions: Record<string, Permission[]>, roles: string[] }) => Promise<void>;
}

// 1. Data Transformation & Configuration
interface PermissionConfig {
  id: string; // Changed from Permission to string to allow virtual ids
  label: string;
  category: string;
  description?: string;
  isScoped?: boolean;
  scopes?: string[];
  basePermission?: string;
}

// Scoped permissions map - CLEARED to show individual permissions
// Previously grouped requisition:create:burf/prf together, now they show separately
const SCOPED_PERMISSIONS_MAP: Record<string, string[]> = {
  // Empty - all permissions now show individually with clear labels
};

// ═══════════════════════════════════════════════════════════════════════════
// PROCUREMENT MODULE
// ═══════════════════════════════════════════════════════════════════════════

const PERMISSION_CONFIG: Record<string, Omit<PermissionConfig, 'id'>> = {
  // Requisition Creation
  'requisition:create:burf': {
    label: 'Create BURF',
    category: 'Procurement: Creation',
    description: 'Allows users to create new Budget Use Request Forms (BURF).'
  },
  'requisition:prepare:prf': {
    label: 'Prepare PRF (from BURF)',
    category: 'Procurement: Creation',
    description: 'Allows converting approved BURFs into Purchase Requisition Forms.'
  },
  'requisition:create:prf': {
    label: 'Create Direct PRF',
    category: 'Procurement: Creation',
    description: 'Allows creating PRFs directly without a preceding BURF.'
  },

  // Requisition Actions
  'requisition:edit:draft': { label: 'Edit Drafts', category: 'Procurement: Actions', description: 'Edit requisitions that are still in Draft status.' },
  'requisition:refile:rejected': { label: 'Refile Rejected', category: 'Procurement: Actions', description: 'Edit and resubmit rejected requisitions.' },
  'requisition:cancel': { label: 'Cancel Requisition', category: 'Procurement: Actions', description: 'Cancel an active requisition.' },
  'requisition:print': { label: 'Print Requisition', category: 'Procurement: Actions', description: 'Generate PDF print view of requisitions.' },

  // Data Visibility
  'requisition:view:own': { label: 'View Own Requests', category: 'Procurement: Visibility', description: 'View only requisitions created by the user.' },
  'requisition:view:business_unit': { label: 'View Business Unit', category: 'Procurement: Visibility', description: 'View all requisitions within the user\'s assigned Business Unit.' },
  'requisition:view:all': { label: 'View All Requests', category: 'Procurement: Visibility', description: 'View all requisitions across all Business Units.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // APPROVAL WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════

  'approval:manager:burf': { label: 'Manager Approval (BURF)', category: 'Approval Chain', description: 'Approve BURFs at the Manager level.' },
  'approval:cic:burf': { label: 'CIC Approval', category: 'Approval Chain', description: 'Approve BURFs at the CIC (Control) level.' },
  'approval:manager:prf': { label: 'Manager Approval (PRF)', category: 'Approval Chain', description: 'Approve PRFs at the Manager level.' },
  'approval:finance_head:br': { label: 'Finance Head BR Approval', category: 'Approval Chain', description: 'Approve Budget Requests at Finance Head level.' },
  'approval:gm:br': { label: 'GM Budget Review', category: 'Approval Chain', description: 'Approve Budget Requests at General Manager level.' },
  'approval:cfo': { label: 'CFO Approval', category: 'Approval Chain', description: 'Final financial approval by CFO.' },
  'approval:bod': { label: 'BOD Approval', category: 'Approval Chain', description: 'Board of Directors approval for high-value items.' },
  'approval:view:history': { label: 'View Approval History', category: 'Approval Chain', description: 'View the audit trail of approvals.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCE & LIQUIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  'finance:release_funds': { label: 'Release Funds', category: 'Finance Operations', description: 'Mark requests as paid/released.' },
  'finance:view_cheque': { label: 'View Cheque Details', category: 'Finance Operations', description: 'View check numbers and vouchers.' },
  'finance:upload_check': { label: 'Check Preparation', category: 'Finance Operations', description: 'Upload check details for BOD authorization.' },

  'liquidation:view': { label: 'View Liquidations', category: 'Liquidation', description: 'View liquidation reports.' },
  'liquidation:file:own': { label: 'File Own Liquidation', category: 'Liquidation', description: 'File liquidation for own requests.' },
  'liquidation:file:all': { label: 'File All Liquidations', category: 'Liquidation', description: 'File liquidation for any request (Admin/Finance).' },
  'liquidation:audit': { label: 'Audit Liquidations', category: 'Liquidation', description: 'Audit and approve/reject liquidation reports.' },
  'liquidation:print': { label: 'Print Liquidation', category: 'Liquidation', description: 'Print liquidation reports.' },

  // Petty Cash Fund (PCF)
  'pcf:view:own': { label: 'View Own PCF', category: 'Petty Cash', description: 'View own PCF requests.' },
  'pcf:view:all': { label: 'View All PCF', category: 'Petty Cash', description: 'View all PCF requests.' },
  'pcf:view:history:all': { label: 'View All PCF History', category: 'Petty Cash', description: 'View history of all PCF transactions.' },
  'pcf:create': { label: 'Create PCF', category: 'Petty Cash', description: 'Create new Petty Cash requests.' },
  'pcf:approve': { label: 'Approve PCF', category: 'Petty Cash', description: 'Approve Petty Cash requests.' },
  'pcf:cancel': { label: 'Cancel PCF', category: 'Petty Cash', description: 'Cancel PCF requests.' },
  'pcf:audit_review': { label: 'PCF Audit Review', category: 'Petty Cash', description: 'Review PCF requests before approval.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MASTER DATA & ADMIN
  // ═══════════════════════════════════════════════════════════════════════════

  // Suppliers
  'supplier:view': { label: 'View Suppliers', category: 'Master Data: Suppliers' },
  'supplier:create': { label: 'Create Supplier', category: 'Master Data: Suppliers' },
  'supplier:edit': { label: 'Edit Supplier', category: 'Master Data: Suppliers' },
  'supplier:delete': { label: 'Delete Supplier', category: 'Master Data: Suppliers' },

  // Admin
  'admin:manage:users': { label: 'Manage Users', category: 'System Admin' },
  'admin:manage:businesses': { label: 'Manage Businesses', category: 'System Admin' },
  'admin:manage:permissions': { label: 'Manage Permissions', category: 'System Admin' },
  'admin:view:user_approvals': { label: 'View Pending Users', category: 'System Admin' },

  // Inventory
  'module:view:inventory': { label: 'Access Inventory', category: 'Inventory' },
  'inventory:view:items': { label: 'View Items', category: 'Inventory' },
  'inventory:manage:items': { label: 'Manage Items', category: 'Inventory' },
  'inventory:manage:assets': { label: 'Manage Assets', category: 'Inventory' },
  'inventory:manage:storage_areas': { label: 'Manage Storage', category: 'Inventory' },
  'inventory:view:reports': { label: 'View Reports', category: 'Inventory' },
  'inventory:manage:uom': { label: 'Manage UOM', category: 'Inventory' },

  // COA & Budget
  'coa:view': { label: 'View Chart of Accounts', category: 'Finance Config' },
  'coa:manage': { label: 'Manage COA', category: 'Finance Config' },
  'budget:view': { label: 'View Budgets', category: 'Finance Config' },
  'budget:manage': { label: 'Manage Budgets', category: 'Finance Config' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE ACCESS (SIDEBAR VISIBILITY)
  // ═══════════════════════════════════════════════════════════════════════════

  'module:view:dashboard': { label: 'Dashboard', category: 'Module Access' },
  'module:view:burf': { label: 'BURF Module', category: 'Module Access' },
  'module:view:prf': { label: 'PRF Module', category: 'Module Access' },
  'module:view:approvals': { label: 'Approvals', category: 'Module Access' },
  'module:view:approved': { label: 'Approved List', category: 'Module Access' },
  'module:view:finance': { label: 'Finance Module', category: 'Module Access' },
  'module:view:liquidation': { label: 'Liquidation Module', category: 'Module Access' },
  'module:view:pcf': { label: 'PCF Module', category: 'Module Access' },
  'module:view:pcf_approvals': { label: 'PCF Approvals', category: 'Module Access' },
  'module:view:suppliers': { label: 'Suppliers Module', category: 'Module Access' },
  'module:view:settings': { label: 'Settings Module', category: 'Module Access' },
  'module:view:finance:br': { label: 'Finance BR Tab', category: 'Module Access' },
  'module:view:finance:check_auth': { label: 'Check Auth Tab', category: 'Module Access' },
  'module:view:prf_tracker': { label: 'PRF Tracker', category: 'Module Access' },
  'module:view:coa': { label: 'COA Module', category: 'Module Access' },
  'module:view:budgets': { label: 'Budget Module', category: 'Module Access' },

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD WIDGETS
  // ═══════════════════════════════════════════════════════════════════════════

  'dashboard:widget:pending_approvals': { label: 'Pending Approvals Card', category: 'Dashboard Widgets' },
  'dashboard:widget:active_prfs': { label: 'Active PRFs Card', category: 'Dashboard Widgets' },
  'dashboard:widget:ready_for_prf': { label: 'Ready for PRF Card', category: 'Dashboard Widgets' },
  'dashboard:widget:total_spend': { label: 'Total Spend Card', category: 'Dashboard Widgets' },
  'dashboard:widget:pending_audit': { label: 'Pending Audit Card', category: 'Dashboard Widgets' },
  'dashboard:widget:pcf_approvals': { label: 'PCF Approvals Card', category: 'Dashboard Widgets' },
  'dashboard:widget:overdue_items': { label: 'Overdue Items Card', category: 'Dashboard Widgets' },
  'dashboard:widget:avg_processing': { label: 'Avg Processing Card', category: 'Dashboard Widgets' },
  'dashboard:widget:completed_month': { label: 'Completed Month Card', category: 'Dashboard Widgets' },
  'dashboard:widget:top_requesters': { label: 'Top Requesters Card', category: 'Dashboard Widgets' },

  'dashboard:section:pending_list': { label: 'Pending List', category: 'Dashboard Widgets' },
  'dashboard:section:ready_for_prf_list': { label: 'Ready for PRF List', category: 'Dashboard Widgets' },
  'dashboard:section:pending_fund_release': { label: 'Pending Release List', category: 'Dashboard Widgets' },
  'dashboard:section:pending_audit_list': { label: 'Pending Audit List', category: 'Dashboard Widgets' },
  'dashboard:section:br_list': { label: 'BR List', category: 'Dashboard Widgets' },
  'dashboard:section:finance_head_br': { label: 'Finance Head BR', category: 'Dashboard Widgets' },
  'dashboard:section:gm_br': { label: 'GM BR', category: 'Dashboard Widgets' },
  'dashboard:section:bod_br': { label: 'BOD BR', category: 'Dashboard Widgets' },
  'dashboard:section:check_auth': { label: 'Check Auth', category: 'Dashboard Widgets' },

  'prf_tracker:view:all': { label: 'View All (Tracker)', category: 'Other', description: 'See all requests in PRF Tracker.' },
};

// Default roles that cannot be deleted (system + original business roles)
const DEFAULT_ROLES: string[] = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  ...DEFAULT_BUSINESS_ROLES
];

const PermissionsMatrix: React.FC<PermissionsMatrixProps> = ({ onSave }) => {
  const { permissions: contextPermissions, roles: contextRoles } = usePermissionsContext();
  const [permissions, setPermissions] = useState(contextPermissions);
  const [roles, setRoles] = useState(contextRoles);
  const [newRole, setNewRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [hoveredCell, setHoveredCell] = useState<{ role: string | null; permission: string | null }>({ role: null, permission: null });
  const [viewMode, setViewMode] = useState<'matrix' | 'role'>('role');
  const [selectedRoleForPivot, setSelectedRoleForPivot] = useState<string>('EMPLOYEE');
  const [isDirty, setIsDirty] = useState(false);
  // Only sync from context on initial load
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current && Object.keys(contextPermissions).length > 0) {
      setPermissions(contextPermissions);
      setRoles(contextRoles);
      isInitialized.current = true;
    }
  }, [contextPermissions, contextRoles]);

  // Browser-level warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved permission changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionConfig[]> = {};

    Object.entries(PERMISSION_CONFIG).forEach(([key, config]) => {
      if (config.isScoped) {
        if (searchTerm && !config.label.toLowerCase().includes(searchTerm.toLowerCase())) return;
        if (!groups[config.category]) groups[config.category] = [];
        groups[config.category].push({ id: key, ...config });
      }
    });

    ALL_PERMISSIONS.forEach(p => {
      const isHandledByScope = Object.keys(SCOPED_PERMISSIONS_MAP).some(base => p.startsWith(base + ':'));
      if (isHandledByScope) return;
      const config = PERMISSION_CONFIG[p] || { label: p, category: 'Uncategorized' };
      if (searchTerm && !config.label.toLowerCase().includes(searchTerm.toLowerCase())) return;
      if (!groups[config.category]) groups[config.category] = [];
      if (!groups[config.category].find(x => x.id === p)) {
        groups[config.category].push({ id: p, ...config });
      }
    });
    return groups;
  }, [searchTerm]);

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handlePermissionChange = (role: UserRole, permission: string) => {
    if (role === UserRole.SUPER_ADMIN) return;
    const currentRolePermissions = permissions[role] || [];
    const hasPermission = currentRolePermissions.includes(permission as Permission);
    const newRolePermissions = hasPermission
      ? currentRolePermissions.filter(p => p !== permission)
      : [...currentRolePermissions, permission as Permission];
    setPermissions(prev => ({ ...prev, [role]: newRolePermissions }));
    setIsDirty(true);
  };

  const handleScopeChange = (role: UserRole, basePermission: string, newScopes: string[]) => {
    if (role === UserRole.SUPER_ADMIN) return;
    const currentRolePermissions = permissions[role] || [];
    const cleanPermissions = currentRolePermissions.filter(p => !p.startsWith(basePermission + ':'));
    const newScopedPermissions = newScopes.map(scope => `${basePermission}:${scope.toLowerCase()}` as Permission);
    setPermissions(prev => ({ ...prev, [role]: [...cleanPermissions, ...newScopedPermissions] }));
    setIsDirty(true);
  };

  const toggleRoleColumn = (role: UserRole, categoryPermissions: PermissionConfig[]) => {
    if (role === UserRole.SUPER_ADMIN) return;
    const currentRolePermissions = permissions[role] || [];
    const flatIdsToCheck: string[] = [];
    categoryPermissions.forEach(cp => {
      if (cp.isScoped && cp.scopes) {
        cp.scopes.forEach(s => flatIdsToCheck.push(`${cp.basePermission}:${s.toLowerCase()}`));
      } else {
        flatIdsToCheck.push(cp.id);
      }
    });
    const allChecked = flatIdsToCheck.every(id => currentRolePermissions.includes(id as Permission));
    let newRolePermissions = [...currentRolePermissions];
    if (allChecked) {
      newRolePermissions = newRolePermissions.filter(p => !flatIdsToCheck.includes(p));
    } else {
      const missing = flatIdsToCheck.filter(id => !currentRolePermissions.includes(id as Permission));
      newRolePermissions = [...newRolePermissions, ...missing.map(m => m as Permission)];
    }
    setPermissions(prev => ({ ...prev, [role]: newRolePermissions }));
    setIsDirty(true);
  };

  const toggleRow = (permissionConfig: PermissionConfig) => {
    const isScoped = permissionConfig.isScoped && permissionConfig.scopes;
    const targetPermissions = isScoped
      ? permissionConfig.scopes!.map(s => `${permissionConfig.basePermission}:${s.toLowerCase()}`)
      : [permissionConfig.id];
    const allRolesHas = (roles || []).every((r: UserRole) => {
      if (r === UserRole.SUPER_ADMIN) return true;
      const rolePerms = permissions[r] || [];
      return targetPermissions.every(tp => rolePerms.includes(tp as Permission));
    });
    const newPermissions = { ...permissions };
    (roles || []).forEach((role: UserRole) => {
      if (role === UserRole.SUPER_ADMIN) return;
      const current = newPermissions[role] || [];
      if (allRolesHas) {
        newPermissions[role] = current.filter(p => !targetPermissions.includes(p));
      } else {
        const missing = targetPermissions.filter(tp => !current.includes(tp as Permission));
        newPermissions[role] = [...current, ...missing.map(m => m as Permission)];
      }
    });
    setPermissions(newPermissions);
    setIsDirty(true);
  };

  const handleSave = async () => {
    // Check for roles with empty permissions and warn user
    const emptyRoles = roles.filter(role => {
      if (role === UserRole.SUPER_ADMIN) return false; // Super Admin is always full access
      const rolePerms = permissions[role] || [];
      return rolePerms.length === 0;
    });

    if (emptyRoles.length > 0) {
      const roleNames = emptyRoles.join(', ');
      const proceed = confirm(
        `Warning: The following role(s) have NO permissions assigned:\n\n${roleNames}\n\nUsers with these roles will have limited access. Continue saving?`
      );
      if (!proceed) return;
    }

    try {
      await onSave({ permissions, roles });
      setIsDirty(false);
      alert('Permissions saved successfully.');
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Failed to save permissions. Please try again.');
    }
  };

  const handleAddRole = async () => {
    if (newRole && !(roles || []).includes(newRole as UserRole)) {
      const newRoleKey = newRole.toUpperCase().replace(/\s/g, '_') as UserRole;
      const newRoles = [...(roles || []), newRoleKey];
      const newPermissions = { ...permissions, [newRoleKey]: [] };
      setRoles(newRoles);
      setPermissions(newPermissions);
      try {
        await onSave({ permissions: newPermissions, roles: newRoles });
        setNewRole('');
        setIsDirty(false);
        alert('Role added and permissions saved.');
      } catch (error) {
        console.error('Error saving new role:', error);
        alert('Failed to save new role. Please try again.');
      }
    }
  };

  const handleDeleteRole = async (roleToDelete: UserRole) => {
    if (DEFAULT_ROLES.includes(roleToDelete)) {
      alert("Cannot delete default system roles.");
      return;
    }
    if (confirm(`Delete role "${roleToDelete}"?`)) {
      const newRoles = (roles || []).filter(r => r !== roleToDelete);
      const updated = { ...permissions };
      delete updated[roleToDelete];
      setRoles(newRoles);
      setPermissions(updated);
      try {
        await onSave({ permissions: updated, roles: newRoles });
        setIsDirty(false);
        alert('Role deleted and permissions saved.');
      } catch (error) {
        console.error('Error deleting role:', error);
        alert('Failed to delete role. Please try again.');
      }
    }
  };

  const getCellClass = (role: string, permission: string) => {
    const isHovered = hoveredCell.role === role || hoveredCell.permission === permission;
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    const baseClass = "px-4 py-3 text-center border-r border-slate-700/50 last:border-r-0 transition-colors cursor-pointer ";
    if (isSuperAdmin) return baseClass + "bg-slate-900/40 opacity-70 cursor-not-allowed";
    if (isHovered) return baseClass + "bg-slate-800/80";
    return baseClass;
  };

  return (
    <Card className="!p-0 border-0 overflow-hidden flex flex-col max-h-[85vh]">
      <div className="p-4 bg-slate-900 border-b border-slate-700 flex flex-wrap gap-4 justify-between items-center z-20">
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setViewMode('matrix')}
              className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'matrix' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Grid size={16} /> Matrix
            </button>
            <button
              onClick={() => setViewMode('role')}
              className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${viewMode === 'role' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Users size={16} /> Role View
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search permissions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && <span className="text-amber-400 text-sm flex items-center gap-1 animate-pulse"><AlertCircle size={14} /> Unsaved Changes</span>}
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {viewMode === 'matrix' && (
          <div className="overflow-auto custom-scrollbar flex-1 relative">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-900 text-xs uppercase font-semibold text-slate-400 sticky top-0 z-30 shadow-md">
                <tr>
                  <th className="px-6 py-4 bg-slate-900 border-b border-slate-700 min-w-[250px] sticky left-0 z-40 shadow-[1px_0_5px_rgba(0,0,0,0.5)]">Permission</th>
                  {(roles || []).map(role => (
                    <th key={role} className="px-2 py-4 text-center min-w-[120px] bg-slate-900 border-b border-slate-700 group relative">
                      <div className="flex flex-col items-center gap-1">
                        <span className={role === UserRole.SUPER_ADMIN ? 'text-purple-400' : 'text-slate-200'}>{role.replace(/_/g, ' ')}</span>
                        {!DEFAULT_ROLES.includes(role) && (
                          <button onClick={() => handleDeleteRole(role)} className="text-slate-600 hover:text-red-400 transition-colors p-1"><Trash2 size={12} /></button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-4 min-w-[150px] bg-slate-900 border-b border-slate-700 align-top">
                    <div className="flex gap-1">
                      <input
                        value={newRole}
                        onChange={e => setNewRole(e.target.value)}
                        placeholder="New Role"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                      />
                      <button onClick={handleAddRole} disabled={!newRole} className="bg-green-600 p-1 rounded hover:bg-green-700 text-white disabled:opacity-50">
                        <Plus size={14} />
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {Object.entries(groupedPermissions).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr className="bg-slate-800/50 sticky top-[60px] z-20">
                      <td colSpan={(roles || []).length + 2} className="px-4 py-2 text-xs font-bold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-800" onClick={() => toggleCategory(category)}>
                        <div className="flex items-center gap-2">
                          {collapsedCategories[category] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          {category}
                        </div>
                      </td>
                    </tr>
                    {!collapsedCategories[category] && items.map((perm) => (
                      <tr key={perm.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-3 font-medium text-slate-300 border-r border-slate-700/50 bg-slate-900/95 sticky left-0 z-10 shadow-[1px_0_5px_rgba(0,0,0,0.5)] group-hover:bg-slate-800 transition-colors">
                          <div className="flex items-center justify-between group/label">
                            <div className="flex items-center gap-2">
                              <span>{perm.label}</span>
                              {perm.description && (
                                <div className="relative group/tooltip">
                                  <div title={perm.description} className="cursor-help">
                                    <AlertCircle
                                      size={14}
                                      className="text-slate-500 hover:text-purple-400"
                                    />
                                  </div>
                                  <div
                                    className="hidden group-hover/tooltip:block absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-2 bg-slate-800 border border-slate-600 rounded shadow-xl text-xs text-slate-200 z-[100] pointer-events-none"
                                  >
                                    {perm.description}
                                  </div>
                                </div>
                              )}
                            </div>
                            <button onClick={() => toggleRow(perm)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-purple-400 transition-opacity" title="Toggle all for this permission">
                              <CheckSquare size={14} />
                            </button>
                          </div>
                        </td>
                        {(roles || []).map((role: UserRole) => {
                          const isSuper = role === UserRole.SUPER_ADMIN;
                          if (perm.isScoped && perm.scopes) {
                            const currentRolePermissions = permissions[role] || [];
                            const selectedScopes = isSuper
                              ? perm.scopes
                              : perm.scopes.filter(scope => currentRolePermissions.includes(`${perm.basePermission}:${scope.toLowerCase()}` as Permission));
                            return (
                              <td key={`${role}-${perm.id}`} className={getCellClass(role, perm.id)} onMouseEnter={() => setHoveredCell({ role, permission: perm.id })} onMouseLeave={() => setHoveredCell({ role: null, permission: null })}>
                                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                                  {isSuper ? <Lock size={14} className="text-slate-600" /> : (
                                    <ScopedPermissionCell
                                      label=""
                                      scopes={perm.scopes}
                                      selectedScopes={selectedScopes}
                                      onChange={(newScopes) => handleScopeChange(role, perm.basePermission!, newScopes)}
                                    />
                                  )}
                                </div>
                              </td>
                            )
                          }
                          const isChecked = isSuper || permissions[role]?.includes(perm.id as Permission);
                          return (
                            <td key={`${role}-${perm.id}`} className={getCellClass(role, perm.id)} onMouseEnter={() => setHoveredCell({ role, permission: perm.id })} onMouseLeave={() => setHoveredCell({ role: null, permission: null })} onClick={() => handlePermissionChange(role, perm.id)}>
                              <div className="flex justify-center">
                                {isSuper ? <Lock size={14} className="text-slate-600" /> : (
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-purple-600 border-purple-500' : 'bg-slate-800 border-slate-600 hover:border-purple-400'}`}>
                                    {isChecked && <CheckSquare size={14} className="text-white" />}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="bg-slate-900/20 border-l border-slate-800"></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {viewMode === 'role' && (
          <div className="flex h-full overflow-hidden">
            <div className="w-64 border-r border-slate-700 bg-slate-900/50 flex flex-col">
              <div className="p-4 font-bold text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">Select Role</div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {(roles || []).map((role: UserRole) => {
                  const rolePerms = permissions[role] || [];
                  const hasEmptyPerms = role !== UserRole.SUPER_ADMIN && rolePerms.length === 0;
                  return (
                    <button
                      key={role}
                      onClick={() => setSelectedRoleForPivot(role)}
                      className={`w-full text-left px-4 py-3 text-sm font-medium flex items-center justify-between border-l-2 transition-all ${selectedRoleForPivot === role ? 'bg-purple-900/20 border-purple-500 text-purple-300' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        {role.replace(/_/g, ' ')}
                        {hasEmptyPerms && (
                          <span title="No permissions assigned - users with this role will have limited access">
                            <AlertCircle size={14} className="text-amber-400" />
                          </span>
                        )}
                      </div>
                      {selectedRoleForPivot === role && <ChevronRight size={14} />}
                    </button>
                  );
                })}
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-900/30">
                <div className="text-xs text-slate-500 mb-2">Create New Role</div>
                <div className="flex gap-2">
                  <input
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    placeholder="Role Name"
                  />
                  <button onClick={handleAddRole} disabled={!newRole} className="bg-green-600 px-3 py-2 rounded hover:bg-green-700 text-white disabled:opacity-50 flex items-center justify-center transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/30 p-6">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      {selectedRoleForPivot.replace(/_/g, ' ')}
                      {selectedRoleForPivot === UserRole.SUPER_ADMIN && <Lock size={20} className="text-slate-500" />}
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Manage permissions for this role.</p>
                  </div>
                  {!DEFAULT_ROLES.includes(selectedRoleForPivot) && (
                    <button
                      onClick={() => handleDeleteRole(selectedRoleForPivot)}
                      className="text-red-400 hover:bg-red-900/20 px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors border border-red-900/50 hover:border-red-500/50"
                    >
                      <Trash2 size={16} /> Delete Role
                    </button>
                  )}
                </div>
                <div className="space-y-6">
                  {Object.entries(groupedPermissions).map(([category, items]) => {
                    const rolePerms = permissions[selectedRoleForPivot] || [];
                    const areAllChecked = items.every(perm => {
                      if (perm.isScoped && perm.scopes) {
                        return perm.scopes.every(scope =>
                          rolePerms.includes(`${perm.basePermission}:${scope.toLowerCase()}` as Permission)
                        );
                      }
                      return rolePerms.includes(perm.id as Permission);
                    });
                    return (
                      <div key={category} className="bg-slate-800/20 border border-slate-700/50 rounded-xl overflow-hidden">
                        <div className="px-6 py-3 bg-slate-800/60 border-b border-slate-700/50 flex items-center justify-between">
                          <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">{category}</h3>
                          {selectedRoleForPivot !== UserRole.SUPER_ADMIN && (
                            <button
                              onClick={() => toggleRoleColumn(selectedRoleForPivot, items)}
                              className="text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
                            >
                              {areAllChecked ? 'Uncheck All' : 'Select All'}
                            </button>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                            {items.map(perm => {
                              if (perm.isScoped && perm.scopes) {
                                const selectedScopes = rolePerms.filter(p => p.startsWith(`${perm.basePermission}:`)).map(p => p.split(':')[2].toUpperCase());
                                return (
                                  <div key={perm.id} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 px-2 -mx-2 rounded transition-colors">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-slate-300">{perm.label}</span>
                                      {perm.description && (
                                        <div className="relative group/tooltip">
                                          <div title={perm.description} className="cursor-help">
                                            <AlertCircle size={14} className="text-slate-500 hover:text-purple-400" />
                                          </div>
                                          <div className="hidden group-hover/tooltip:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-slate-800 border border-slate-600 rounded shadow-xl text-xs text-slate-200 z-[100] pointer-events-none">
                                            {perm.description}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    {selectedRoleForPivot === UserRole.SUPER_ADMIN ? (
                                      <div className="flex items-center gap-2 text-slate-500">
                                        <span className="text-xs">All Types</span>
                                        <Lock size={12} />
                                      </div>
                                    ) : (
                                      <ScopedPermissionCell
                                        label=""
                                        scopes={perm.scopes}
                                        selectedScopes={selectedScopes}
                                        onChange={(newScopes) => handleScopeChange(selectedRoleForPivot, perm.basePermission!, newScopes)}
                                      />
                                    )}
                                  </div>
                                )
                              }
                              const isChecked = selectedRoleForPivot === UserRole.SUPER_ADMIN || rolePerms.includes(perm.id as Permission);
                              return (
                                <div
                                  key={perm.id}
                                  onClick={() => handlePermissionChange(selectedRoleForPivot, perm.id)}
                                  className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 px-2 -mx-2 rounded cursor-pointer transition-colors group"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium transition-colors ${isChecked ? 'text-purple-200' : 'text-slate-400 group-hover:text-slate-300'}`}>{perm.label}</span>
                                    {perm.description && (
                                      <div className="relative group/tooltip" onClick={(e) => e.stopPropagation()}>
                                        <div title={perm.description} className="cursor-help">
                                          <AlertCircle size={14} className="text-slate-500 hover:text-purple-400" />
                                        </div>
                                        <div className="hidden group-hover/tooltip:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-slate-800 border border-slate-600 rounded shadow-xl text-xs text-slate-200 z-[100] pointer-events-none">
                                          {perm.description}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {selectedRoleForPivot === UserRole.SUPER_ADMIN ? <Lock size={14} className="text-slate-600" /> : (
                                    <div className={`w-9 h-5 rounded-full relative transition-colors duration-200 ease-in-out ${isChecked ? 'bg-purple-600' : 'bg-slate-700'}`}>
                                      <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full shadow-sm transition-transform duration-200 ${isChecked ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PermissionsMatrix;
