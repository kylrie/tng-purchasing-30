import React from 'react';
import { useAuth } from '../../../contexts/useAuth';
import { OperationsDashboard } from './OperationsDashboard';
import type { OperationsDashboardProps } from './OperationsDashboard';

export const MainDashboardRouter: React.FC<OperationsDashboardProps> = (props) => {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!currentUser) return null;

    return <OperationsDashboard {...props} />;
};

export default MainDashboardRouter;
