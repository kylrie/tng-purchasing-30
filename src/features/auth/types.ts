export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN', // Legacy
    MANAGER = 'MANAGER',
    EMPLOYEE = 'EMPLOYEE',
    CIC = 'CIC',
    PURCHASING_OFFICER = 'PURCHASING_OFFICER',
    FINANCE = 'FINANCE',
    AUDITOR = 'AUDITOR'
}

export interface User {
    id: string;
    name: string;
    role: UserRole;
    permissionLevel?: number;
    avatar: string;
    email: string;
    department?: string;
    businessId: string;
    isPasswordSet?: boolean;
}
