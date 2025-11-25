import { useAuth } from '../contexts/AuthContext';
import { ROLES_TO_PERMISSIONS } from '../config/permissions';
import type { Permission } from '../config/permissions';
import type { Requisition } from '../features/procurement/types';

export const usePermissions = () => {
  const { currentUser } = useAuth();

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) {
      return false;
    }

    const userPermissions = ROLES_TO_PERMISSIONS[currentUser.role];
    if (!userPermissions) {
      return false;
    }

    return userPermissions.includes(permission);
  };

  /**
   * Checks if a user can perform an action on a specific requisition.
   * This is useful for row-level security checks.
   */
  const canPerformAction = (permission: Permission, requisition: Requisition): boolean => {
    if (!currentUser) return false;
    if (!hasPermission(permission)) return false;

    // If the permission is global (e.g., SUPER_ADMIN), no further checks needed
    if (hasPermission('requisition:view:all')) return true;

    // Check for business unit scope
    if (hasPermission('requisition:view:business_unit') && currentUser.businessId === requisition.businessId) {
      return true;
    }

    // Check for ownership scope
    if (hasPermission('requisition:view:own') && currentUser.id === requisition.requesterId) {
      return true;
    }

    return false;
  };


  return { hasPermission, canPerformAction, currentUser };
};
