// Re-export types from other features for convenience
import { UserRole } from '../features/auth/types';
export type { User } from '../features/auth/types';
export type { Requisition } from '../features/procurement/types';

export interface Business {
    id: string;
    name: string;
    currency: string;
    address?: string;
    tin?: string;
}

export interface NotificationItem {
    id: string;
    type: 'BURF' | 'PRF' | 'LIQUIDATION' | 'INFO';
    message: string;
    requisitionId?: string;
    timestamp: string;
    targetRoles?: UserRole[];
}
