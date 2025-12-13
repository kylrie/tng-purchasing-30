import { useAuth } from '../contexts/AuthContext';
import { usePermissionsContext } from '../contexts/PermissionsContext';
import type { Permission } from '../config/permissions';
import type { Requisition } from '../features/procurement/types';
import { RequisitionStatus } from '../features/procurement/types';

export const usePermissions = () => {
  const { currentUser } = useAuth();
  const { permissions } = usePermissionsContext();

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) {
      return false;
    }

    // SUPER_ADMIN always has all permissions (bypass Firestore sync issues)
    if (currentUser.role === 'SUPER_ADMIN') {
      return true;
    }

    const userPermissions = permissions[currentUser.role];
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

  /**
   * Checks if the current user can file liquidation for a specific requisition.
   * Option C: Either BURF creator OR PRF creator can file liquidation.
   */
  const canFileLiquidation = (requisition: Requisition): boolean => {
    if (!currentUser) return false;

    // Must be in a state where liquidation can be filed
    const validStatuses = [
      RequisitionStatus.FUNDS_RELEASED,
      RequisitionStatus.LIQUIDATION_REJECTED
    ];
    if (!validStatuses.includes(requisition.status)) {
      return false;
    }

    // Finance can file for anyone
    if (hasPermission('liquidation:file:all')) return true;

    // Check if user has permission to file for own
    if (hasPermission('liquidation:file:own')) {
      // Option C: Check if user is BURF creator OR PRF creator
      const isBurfCreator = requisition.requesterId === currentUser.id;
      const isPrfCreator = requisition.prfDetails?.createdBy === currentUser.id;

      return isBurfCreator || isPrfCreator;
    }

    return false;
  };


  return { hasPermission, canPerformAction, canFileLiquidation, currentUser };
};

