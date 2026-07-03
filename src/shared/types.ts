import { UserRole } from '../features/procurement/types';
export type { User } from '../features/procurement/types';
export type { Requisition } from '../features/procurement/types';

export interface Business {
    id: string;
    name: string;
    currency: string;
    address?: string;
    tin?: string;
    hasTableManagement?: boolean;
}

export interface NotificationItem {
    id: string;
    type: 'BURF' | 'PRF' | 'LIQUIDATION' | 'INFO' | 'ALERT' | 'REMINDER' | 'AUDIT' | 'PCF';
    message: string;
    requisitionId?: string;
    timestamp: string;
    read: boolean;
    targetRoles?: (UserRole | string)[];

    // Enhanced fields
    subType?: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'REFILE' | 'PENDING_ACTION' | 'REMINDER' | 'CLEARED';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    actionUrl?: string;
    metadata?: {
        requisitionNumber?: string;
        requesterName?: string;
        businessName?: string;
        amount?: number;
        stage?: string;
        actorName?: string;
    };
    dismissedBy?: string[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt?: any; // Firestore Timestamp or Date for sorting
}

