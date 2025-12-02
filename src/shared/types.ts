import { UserRole } from '../features/procurement/types';
export type { User } from '../features/procurement/types';
export type { Requisition } from '../features/procurement/types';

export interface Business {
    id: string;
    name: string;
    currency: string;
    address?: string;
    tin?: string;
}

export interface NotificationItem {
    read: any;
    id: string;
    type: 'BURF' | 'PRF' | 'LIQUIDATION' | 'INFO';
    message: string;
    requisitionId?: string;
    timestamp: string;
    targetRoles?: UserRole[];
}
