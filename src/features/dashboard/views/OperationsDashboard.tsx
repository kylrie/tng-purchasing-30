import React from 'react';
import DashboardView from './DashboardView';
import type { Requisition, Supplier } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';

export interface OperationsDashboardProps {
    requisitions: Requisition[];
    currentUser: User;
    allUsers: User[];
    suppliers: Supplier[];
    businesses: Business[];
    onCreateRequisition: (req: Omit<Requisition, 'id'> | Requisition) => void;
    onUpdateRequisition: (req: Requisition) => void;
}

export const OperationsDashboard: React.FC<OperationsDashboardProps> = (props) => {
    return (
        <div className="operations-dashboard-wrapper">
            <DashboardView {...props} />
        </div>
    );
};

export default OperationsDashboard;
