import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ALL_PERMISSIONS, PERMISSION_REGISTRY, PERMISSION_GROUPS } from '../../../config/permissions';
import type { Permission, CrudCell, ResourceGroup } from '../../../config/permissions';
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

// Build PERMISSION_CONFIG directly from the canonical PERMISSION_REGISTRY
// This ensures the PermissionsMatrix always stays in sync with ALL_PERMISSIONS
const PERMISSION_CONFIG: Record<string, Omit<PermissionConfig, 'id'>> = Object.fromEntries(
  ALL_PERMISSIONS.map(p => [
    p,
    {
      label: PERMISSION_REGISTRY[p].label,
      category: PERMISSION_REGISTRY[p].category,
      description: PERMISSION_REGISTRY[p].description,
    },
  ])
);


// Default roles that cannot be deleted (system + original business roles)
const DEFAULT_ROLES: string[] = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  ...DEFAULT_BUSINESS_ROLES
];

const PermissionsMatrix: React.FC<PermissionsMatrixProps> = ({ onSave }) => {
  const { permissions: contextPermissions, roles: contextRoles, loading } = usePermissionsContext();
  // Start with empty state — wait for Firestore data before rendering
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({});
  const [roles, setRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [hoveredCell, setHoveredCell] = useState<{ role: string | null; permission: string | null }>({ role: null, permission: null });
  const [viewMode, setViewMode] = useState<'matrix' | 'role'>('role');
  const [selectedRoleForPivot, setSelectedRoleForPivot] = useState<string>('EMPLOYEE');
  const [isDirty, setIsDirty] = useState(false);
  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({});
  // Only sync from context once — after Firestore has finished loading
  const isInitialized = useRef(false);

  useEffect(() => {
    // Wait until Firestore is done loading before locking in the initial state.
    // This prevents the hardcoded defaults (set before the snapshot arrives)
    // from being treated as the "real" data on fresh page load.
    if (!isInitialized.current && !loading && Object.keys(contextPermissions).length > 0) {
      setPermissions(contextPermissions);
      setRoles(contextRoles);
      isInitialized.current = true;
    }
  }, [contextPermissions, contextRoles, loading]);

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

  // Flat-toggle permissions: only Module Access, Widgets & Dashboard Sections (ui: prefix)
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionConfig[]> = {};
    const flatPrefixes = ['ui:module_access:', 'ui:widget:', 'ui:section:'];
    ALL_PERMISSIONS.forEach(p => {
      if (!flatPrefixes.some(prefix => p.startsWith(prefix))) return;
      const config = PERMISSION_CONFIG[p] || { label: p, category: 'Uncategorized' };
      if (searchTerm && !config.label.toLowerCase().includes(searchTerm.toLowerCase())) return;
      if (!groups[config.category]) groups[config.category] = [];
      if (!groups[config.category].find(x => x.id === p)) {
        groups[config.category].push({ id: p, ...config });
      }
    });
    return groups;
  }, [searchTerm]);

  // CRUD resource groups grouped by category — drives the Role View CRUD grid
  const groupedResourceGroups = useMemo(() => {
    const groups: Record<string, ResourceGroup[]> = {};
    PERMISSION_GROUPS.forEach(group => {
      if (searchTerm) {
        const resourceMatches = group.resource.toLowerCase().includes(searchTerm.toLowerCase());
        const allPerms: Permission[] = [
          ...(group.read?.variants?.map(v => v.permission) ?? []),
          ...(group.read?.permission ? [group.read.permission] : []),
          ...(group.create?.variants?.map(v => v.permission) ?? []),
          ...(group.create?.permission ? [group.create.permission] : []),
          ...(group.edit?.permission ? [group.edit.permission] : []),
          ...(group.delete?.permission ? [group.delete.permission] : []),
          ...(group.actions ?? []),
        ];
        const permMatches = allPerms.some(p =>
          PERMISSION_REGISTRY[p]?.label?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (!resourceMatches && !permMatches) return;
      }
      if (!groups[group.category]) groups[group.category] = [];
      groups[group.category].push(group);
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

  // ─── CRUD cell renderer ─────────────────────────────────────────────────
  const renderCrudCell = (cell: CrudCell | undefined, role: string) => {
    const isSuperAdmin = role === UserRole.SUPER_ADMIN;
    const rolePerms = permissions[role] || [];

    if (!cell) {
      return <span className="text-slate-700 select-none text-lg">—</span>;
    }

    if (cell.variants) {
      return (
        <div className="flex flex-col gap-1.5 items-start mx-auto w-fit">
          {cell.variants.map(v => {
            const isChecked = isSuperAdmin || rolePerms.includes(v.permission as Permission);
            return (
              <label
                key={v.permission}
                onClick={() => !isSuperAdmin && handlePermissionChange(role as UserRole, v.permission)}
                className={`flex items-center gap-2 ${isSuperAdmin ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                  isSuperAdmin
                    ? 'bg-slate-700/50 border-slate-600'
                    : isChecked
                      ? 'bg-purple-600 border-purple-500'
                      : 'border-slate-600 hover:border-purple-400 bg-slate-800'
                }`}>
                  {isChecked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className={`text-xs ${isChecked ? 'text-slate-300' : 'text-slate-500'}`}>{v.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (cell.permission) {
      const isChecked = isSuperAdmin || rolePerms.includes(cell.permission as Permission);
      return (
        <div
          onClick={() => !isSuperAdmin && handlePermissionChange(role as UserRole, cell.permission!)}
          className={`w-5 h-5 rounded border mx-auto flex items-center justify-center transition-all ${
            isSuperAdmin
              ? 'bg-slate-700/50 border-slate-600 cursor-not-allowed'
              : isChecked
                ? 'bg-purple-600 border-purple-500 cursor-pointer'
                : 'border-slate-600 hover:border-purple-400 bg-slate-800 cursor-pointer'
          }`}
        >
          {isChecked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      );
    }

    return <span className="text-slate-700 select-none text-lg">—</span>;
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

  // Show a loading state while waiting for Firestore data
  if (loading || !isInitialized.current) {
    return (
      <Card className="!p-0 border-0 overflow-hidden flex flex-col">
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
          <div className="w-10 h-10 border-4 border-slate-600 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm font-medium">Loading permissions from Firestore...</p>
        </div>
      </Card>
    );
  }

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
                {/* ── CRUD Resource Grid ─────────────────────────────── */}
                <div className="space-y-6 mb-8">
                  {Object.entries(groupedResourceGroups).map(([category, groups]) => {
                    const rolePerms = permissions[selectedRoleForPivot] || [];
                    const isSuperAdmin = selectedRoleForPivot === UserRole.SUPER_ADMIN;
                    return (
                      <div key={category} className="bg-slate-800/20 border border-slate-700/50 rounded-xl overflow-hidden">
                        {/* Category header */}
                        <div className="px-6 py-3 bg-slate-800/60 border-b border-slate-700/50">
                          <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">{category}</h3>
                        </div>
                        {/* CRUD table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-700/30">
                                <th className="px-5 py-2.5 text-left text-xs text-slate-500 font-medium min-w-[180px]">Resource</th>
                                {(['Read', 'Create', 'Edit', 'Delete'] as const).map(action => (
                                  <th key={action} className="px-4 py-2.5 text-center text-xs font-semibold w-36">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                                      action === 'Read'   ? 'bg-blue-900/40 text-blue-400' :
                                      action === 'Create' ? 'bg-green-900/40 text-green-400' :
                                      action === 'Edit'   ? 'bg-amber-900/40 text-amber-400' :
                                                            'bg-red-900/40 text-red-400'
                                    }`}>{action}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                              {groups.map(group => (
                                <React.Fragment key={group.id}>
                                  {/* CRUD row */}
                                  <tr className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-5 py-3.5 font-medium text-slate-300 text-sm">{group.resource}</td>
                                    <td className="px-4 py-3.5 text-center">{renderCrudCell(group.read, selectedRoleForPivot)}</td>
                                    <td className="px-4 py-3.5 text-center">{renderCrudCell(group.create, selectedRoleForPivot)}</td>
                                    <td className="px-4 py-3.5 text-center">{renderCrudCell(group.edit, selectedRoleForPivot)}</td>
                                    <td className="px-4 py-3.5 text-center">{renderCrudCell(group.delete, selectedRoleForPivot)}</td>
                                  </tr>
                                  {/* Extended actions — collapsible sub-row */}
                                  {group.actions && group.actions.length > 0 && (
                                    <>
                                      <tr>
                                        <td colSpan={5} className="px-5 py-1.5 bg-slate-900/40">
                                          <button
                                            onClick={() => setExpandedActions(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-400 transition-colors"
                                          >
                                            {expandedActions[group.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            <span>Extended Actions</span>
                                            <span className="bg-slate-700 text-slate-400 rounded-full px-1.5 py-0.5 text-[10px] leading-none ml-0.5">{group.actions.length}</span>
                                          </button>
                                        </td>
                                      </tr>
                                      {expandedActions[group.id] && (
                                        <tr>
                                          <td colSpan={5} className="px-5 pb-3 pt-1.5 bg-slate-900/40">
                                            <div className="flex flex-wrap gap-2">
                                              {group.actions.map(action => {
                                                const isChecked = isSuperAdmin || rolePerms.includes(action as Permission);
                                                const meta = PERMISSION_REGISTRY[action as Permission];
                                                return (
                                                  <button
                                                    key={action}
                                                    onClick={() => !isSuperAdmin && handlePermissionChange(selectedRoleForPivot as UserRole, action)}
                                                    disabled={isSuperAdmin}
                                                    title={meta?.description}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                                      isSuperAdmin
                                                        ? 'bg-slate-700/30 border-slate-600 text-slate-500 cursor-not-allowed'
                                                        : isChecked
                                                          ? 'bg-purple-600/30 border-purple-500 text-purple-300 hover:bg-purple-600/40'
                                                          : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-purple-500/50 hover:text-slate-300'
                                                    }`}
                                                  >
                                                    {isChecked && !isSuperAdmin && (
                                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                        <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                      </svg>
                                                    )}
                                                    {meta?.label ?? action}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Module Access & Dashboard — flat toggles ─────────── */}
                <div className="space-y-6">
                  {Object.entries(groupedPermissions).map(([category, items]) => {
                    const rolePerms = permissions[selectedRoleForPivot] || [];
                    const isSuperAdmin = selectedRoleForPivot === UserRole.SUPER_ADMIN;
                    const areAllChecked = isSuperAdmin || items.every(perm => rolePerms.includes(perm.id as Permission));
                    return (
                      <div key={category} className="bg-slate-800/20 border border-slate-700/50 rounded-xl overflow-hidden">
                        <div className="px-6 py-3 bg-slate-800/60 border-b border-slate-700/50 flex items-center justify-between">
                          <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">{category}</h3>
                          {!isSuperAdmin && (
                            <button
                              onClick={() => toggleRoleColumn(selectedRoleForPivot as UserRole, items)}
                              className="text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
                            >
                              {areAllChecked ? 'Uncheck All' : 'Select All'}
                            </button>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                            {items.map(perm => {
                              const isChecked = isSuperAdmin || rolePerms.includes(perm.id as Permission);
                              return (
                                <div
                                  key={perm.id}
                                  onClick={() => !isSuperAdmin && handlePermissionChange(selectedRoleForPivot as UserRole, perm.id)}
                                  className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 px-2 -mx-2 rounded cursor-pointer transition-colors group"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium transition-colors ${isChecked ? 'text-purple-200' : 'text-slate-400 group-hover:text-slate-300'}`}>{perm.label}</span>
                                    {perm.description && (
                                      <div title={perm.description} className="cursor-help" onClick={e => e.stopPropagation()}>
                                        <AlertCircle size={14} className="text-slate-500 hover:text-purple-400" />
                                      </div>
                                    )}
                                  </div>
                                  {isSuperAdmin ? <Lock size={14} className="text-slate-600" /> : (
                                    <div className={`w-9 h-5 rounded-full relative transition-colors duration-200 ease-in-out ${isChecked ? 'bg-purple-600' : 'bg-slate-700'}`}>
                                      <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full shadow-sm transition-transform duration-200 ${isChecked ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                  )}
                                </div>
                              );
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
