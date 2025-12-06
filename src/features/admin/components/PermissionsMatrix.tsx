import React, { useState, useEffect, useMemo } from 'react';
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
  onSave: (data: { permissions: Record<string, Permission[]>, roles: string[] }) => void;
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

// Define scoped permissions map for quick lookup
const SCOPED_PERMISSIONS_MAP: Record<string, string[]> = {
  'requisition:create': ['BURF', 'PRF']
};

const PERMISSION_CONFIG: Record<string, Omit<PermissionConfig, 'id'>> = {
  // Virtual Scoped Permission
  'requisition:create': {
    label: 'Create Requisition',
    category: 'Requisition Lifecycle',
    isScoped: true,
    scopes: ['BURF', 'PRF'],
    basePermission: 'requisition:create'
  },

  // Real permissions that are NOT covered by the virtual one above should be listed if any.
  // Note: 'requisition:create:burf' and 'requisition:create:prf' are now managed by 'requisition:create' row.

  // Requisition Lifecycle
  'requisition:edit:draft': { label: 'Edit Drafts', category: 'Requisition Lifecycle' },
  'requisition:refile:rejected': { label: 'Refile Rejected', category: 'Requisition Lifecycle' },
  'requisition:cancel': { label: 'Cancel Requisition', category: 'Requisition Lifecycle' },
  'requisition:print': { label: 'Print Requisition', category: 'Requisition Lifecycle' },

  // Approval Workflow
  'approval:manager:burf': { label: 'Manager Approval (BURF)', category: 'Approval Workflow' },
  'approval:cic:burf': { label: 'CIC Approval', category: 'Approval Workflow' },
  'approval:manager:prf': { label: 'Manager Approval (PRF)', category: 'Approval Workflow' },

  // Finance Workflow
  'finance:release_funds': { label: 'Release Funds', category: 'Finance Workflow' },
  'finance:view_cheque': { label: 'View Cheque Details', category: 'Finance Workflow' },
  'liquidation:view': { label: 'View Liquidations', category: 'Finance Workflow' },
  'liquidation:file:own': { label: 'File Own Liquidation', category: 'Finance Workflow' },
  'liquidation:file:all': { label: 'File All Liquidations', category: 'Finance Workflow' },
  'liquidation:audit': { label: 'Audit Liquidations', category: 'Finance Workflow' },
  'liquidation:print': { label: 'Print Liquidation', category: 'Finance Workflow' },

  // Data Visibility
  'requisition:view:own': { label: 'View Own Requests', category: 'Data Visibility' },
  'requisition:view:business_unit': { label: 'View Business Unit', category: 'Data Visibility' },
  'requisition:view:all': { label: 'View All Requests', category: 'Data Visibility' },

  // Supplier Management
  'supplier:view': { label: 'View Suppliers', category: 'Supplier Management' },
  'supplier:create': { label: 'Create Supplier', category: 'Supplier Management' },
  'supplier:edit': { label: 'Edit Supplier', category: 'Supplier Management' },
  'supplier:delete': { label: 'Delete Supplier', category: 'Supplier Management' },

  // Admin Functions
  'admin:manage:users': { label: 'Manage Users', category: 'Admin Functions' },
  'admin:manage:businesses': { label: 'Manage Businesses', category: 'Admin Functions' },
  'admin:manage:permissions': { label: 'Manage Permissions', category: 'Admin Functions' },
  'admin:view:user_approvals': { label: 'View Pending Users', category: 'Admin Functions' },

  // Module View Permissions
  'module:view:dashboard': { label: 'View Dashboard', category: 'Module Access' },
  'module:view:burf': { label: 'View BURF Module', category: 'Module Access' },
  'module:view:prf': { label: 'View PRF Module', category: 'Module Access' },
  'module:view:approvals': { label: 'View Approvals', category: 'Module Access' },
  'module:view:approved': { label: 'View Approved List', category: 'Module Access' },
  'module:view:finance': { label: 'View Finance Module', category: 'Module Access' },
  'module:view:liquidation': { label: 'View Liquidation', category: 'Module Access' },
  'module:view:suppliers': { label: 'View Suppliers', category: 'Module Access' },
  'module:view:settings': { label: 'View Settings', category: 'Module Access' },

  // Deprecated / UI
  'ui:view:approvals_page': { label: 'View Approvals Page (Legacy)', category: 'Legacy / UI' },
  'ui:view:settings_page': { label: 'View Settings Page (Legacy)', category: 'Legacy / UI' },
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

  useEffect(() => {
    setPermissions(contextPermissions);
    setRoles(contextRoles);
  }, [contextPermissions, contextRoles]);

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

  const handleSave = () => {
    onSave({ permissions, roles });
    setIsDirty(false);
    alert('Permissions saved successfully.');
  };

  const handleAddRole = () => {
    if (newRole && !(roles || []).includes(newRole as UserRole)) {
      const newRoleKey = newRole.toUpperCase().replace(/\s/g, '_') as UserRole;
      const newRoles = [...(roles || []), newRoleKey];
      const newPermissions = { ...permissions, [newRoleKey]: [] };
      setRoles(newRoles);
      setPermissions(newPermissions);
      onSave({ permissions: newPermissions, roles: newRoles });
      setNewRole('');
      setIsDirty(false);
      alert('Role added and permissions saved.');
    }
  };

  const handleDeleteRole = (roleToDelete: UserRole) => {
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
      onSave({ permissions: updated, roles: newRoles });
      setIsDirty(false);
      alert('Role deleted and permissions saved.');
    }
  };

  const getCellClass = (role: string, permission: string) => {
    const isHovered = hoveredCell.role === role || hoveredCell.permission === permission;
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    let baseClass = "px-4 py-3 text-center border-r border-slate-700/50 last:border-r-0 transition-colors cursor-pointer ";
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
                          <div className="flex items-center justify-between">
                            <span>{perm.label}</span>
                            <button onClick={() => toggleRow(perm)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-purple-400 transition-opacity" title="Toggle all for this permission">
                              <CheckSquare size={14} />
                            </button>
                          </div>
                          {perm.description && <div className="text-[10px] text-slate-500 mt-0.5 font-normal">{perm.description}</div>}
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
                {(roles || []).map((role: UserRole) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRoleForPivot(role)}
                    className={`w-full text-left px-4 py-3 text-sm font-medium flex items-center justify-between border-l-2 transition-all ${selectedRoleForPivot === role ? 'bg-purple-900/20 border-purple-500 text-purple-300' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                  >
                    {role.replace(/_/g, ' ')}
                    {selectedRoleForPivot === role && <ChevronRight size={14} />}
                  </button>
                ))}
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
                                    <div className="text-sm font-medium text-slate-300">{perm.label}</div>
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
                                  <div className={`text-sm font-medium transition-colors ${isChecked ? 'text-purple-200' : 'text-slate-400 group-hover:text-slate-300'}`}>{perm.label}</div>
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
