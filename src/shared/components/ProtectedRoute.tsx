import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import type { Permission } from '../../config/permissions';

interface ProtectedRouteProps {
    children: React.ReactNode;
    /**
     * Optional permission required to access this route.
     * Can be a single permission or an array (user must have at least one).
     * If not provided, only authentication is checked.
     */
    permission?: Permission | Permission[];
    /**
     * Optional redirect path if user lacks permission. Defaults to '/'.
     */
    redirectTo?: string;
}

/**
 * ProtectedRoute - Route-level guard component.
 * 
 * Checks:
 * 1. User is authenticated
 * 2. User has the required permission(s) (if specified)
 * 
 * Usage:
 * <ProtectedRoute permission="module:view:finance">
 *   <FinanceView />
 * </ProtectedRoute>
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    permission,
    redirectTo = '/'
}) => {
    const { currentUser, loading } = useAuth();
    const { hasPermission } = usePermissions();
    const location = useLocation();

    if (loading) {
        return <div>Loading...</div>;
    }

    // Check authentication first
    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check permission if specified
    if (permission) {
        const hasAccess = Array.isArray(permission)
            ? permission.some(p => hasPermission(p))
            : hasPermission(permission);

        if (!hasAccess) {
            return <Navigate to={redirectTo} replace />;
        }
    }

    return <>{children}</>;
};

export default ProtectedRoute;
