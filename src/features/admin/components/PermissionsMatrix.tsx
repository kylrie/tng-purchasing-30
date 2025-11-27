import React, { useState, useEffect } from 'react';
import { ALL_PERMISSIONS } from '../../../config/permissions';
import type { Permission } from '../../../config/permissions';
import { UserRole } from '../../procurement/types';
import Card from '../../../shared/components/Card';
import { usePermissionsContext } from '../../../contexts/PermissionsContext';

interface PermissionsMatrixProps {
  onSave: (newPermissions: Record<UserRole, Permission[]>) => void;
}

const PermissionsMatrix: React.FC<PermissionsMatrixProps> = ({ onSave }) => {
  const { permissions: contextPermissions } = usePermissionsContext();
  const [permissions, setPermissions] = useState(contextPermissions);

  // Sync with context when it changes (e.g. initial load)
  useEffect(() => {
    setPermissions(contextPermissions);
  }, [contextPermissions]);

  const handleCheckboxChange = (role: UserRole, permission: Permission) => {
    const currentPermissions = permissions[role] || [];
    const isEnabled = currentPermissions.includes(permission);

    let newPermissions: Permission[];
    if (isEnabled) {
      newPermissions = currentPermissions.filter(p => p !== permission);
    } else {
      newPermissions = [...currentPermissions, permission];
    }

    setPermissions(prev => ({
      ...prev,
      [role]: newPermissions,
    }));
  };

  const handleSaveChanges = () => {
    onSave(permissions);
    alert('Permissions have been updated!');
  };

  return (
    <Card className="!p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900/50 text-xs uppercase font-semibold text-slate-400">
            <tr>
              <th className="px-6 py-4">Permission</th>
              {Object.values(UserRole).map(role => (
                <th key={role} className="px-6 py-4 text-center">{role.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {ALL_PERMISSIONS.map(permission => (
              <tr key={permission} className="hover:bg-slate-800/60">
                <td className="px-6 py-4 font-medium text-slate-200">{permission}</td>
                {Object.values(UserRole).map(role => (
                  <td key={`${role}-${permission}`} className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded bg-slate-700 border-slate-600 text-purple-600 focus:ring-purple-500"
                      checked={permissions[role]?.includes(permission) || false}
                      onChange={() => handleCheckboxChange(role, permission)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end">
        <button
          onClick={handleSaveChanges}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
        >
          Save Permissions
        </button>
      </div>
    </Card>
  );
};

export default PermissionsMatrix;
