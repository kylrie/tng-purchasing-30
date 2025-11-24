import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { RequisitionsService } from '../../features/procurement/services/requisitions.service';
import { FirestoreService, where } from '../services/firestore.service';
import { NotificationsService } from '../services/notifications.service';
import { COLLECTIONS } from '../types/firebase.types';
import type {
    FirestoreRequisition,
    FirestoreBusiness,
    FirestoreSupplier,
    FirestoreNotification,
    FirestoreUser
} from '../types/firebase.types';
import type { Requisition, Business, NotificationItem, User } from '../types';
import type { Supplier, RequisitionStatus } from '../../features/procurement/types';
import { UserRole } from '../../features/auth/types';

interface DataContextType {
    // Data
    requisitions: Requisition[];
    businesses: Business[];
    suppliers: Supplier[];
    notifications: NotificationItem[];
    allUsers: User[];

    // Loading states
    loadingRequisitions: boolean;
    loadingBusinesses: boolean;
    loadingSuppliers: boolean;
    loadingNotifications: boolean;

    // Error states
    error: string | null;

    // Requisition operations
    createRequisition: (data: Omit<Requisition, 'id' | 'dateCreated'>) => Promise<string>;
    updateRequisition: (id: string, data: Partial<Requisition>) => Promise<void>;
    updateRequisitionStatus: (id: string, status: RequisitionStatus, comment?: string) => Promise<void>;
    deleteRequisition: (id: string) => Promise<void>;

    // Supplier operations
    createSupplier: (data: Omit<Supplier, 'id'>) => Promise<void>;
    updateSupplier: (id: string, data: Partial<Supplier>) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;

    // Business operations
    getUsersByBusiness: (businessId: string) => Promise<User[]>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

interface DataProviderProps {
    children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
    const { currentUser } = useAuth();

    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    const [loadingRequisitions, setLoadingRequisitions] = useState(true);
    const [loadingBusinesses, setLoadingBusinesses] = useState(true);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [loadingNotifications, setLoadingNotifications] = useState(true);

    const [error, setError] = useState<string | null>(null);

    // Convert Firestore data to app format
    const convertRequisition = (firestoreReq: FirestoreRequisition): Requisition => ({
        id: firestoreReq.id,
        requesterId: firestoreReq.requesterId,
        businessId: firestoreReq.businessId,
        description: firestoreReq.description,
        projectName: firestoreReq.projectName,
        items: firestoreReq.items,
        totalAmount: firestoreReq.totalAmount,
        status: firestoreReq.status,
        dateCreated: firestoreReq.dateCreated,
        remarks: firestoreReq.remarks,
        attachments: firestoreReq.attachments,
        prfDetails: firestoreReq.prfDetails,
    });

    const convertBusiness = (firestoreBiz: FirestoreBusiness): Business => ({
        id: firestoreBiz.id,
        name: firestoreBiz.name,
        currency: firestoreBiz.currency,
        address: firestoreBiz.address,
        tin: firestoreBiz.tin,
    });

    const convertSupplier = (firestoreSup: FirestoreSupplier): Supplier => ({
        id: firestoreSup.id,
        name: firestoreSup.name,
        category: firestoreSup.category,
        rating: firestoreSup.rating,
        contractEnd: firestoreSup.contractEnd,
        tin: firestoreSup.tin,
        address: firestoreSup.address,
        paymentMode: firestoreSup.paymentMode,
        terms: firestoreSup.terms,
    });

    const convertNotification = (firestoreNotif: FirestoreNotification): NotificationItem => ({
        id: firestoreNotif.id,
        type: firestoreNotif.type,
        message: firestoreNotif.message,
        requisitionId: firestoreNotif.requisitionId,
        timestamp: firestoreNotif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        targetRoles: firestoreNotif.targetRoles as UserRole[],
    });

    const convertUser = (firestoreUser: FirestoreUser): User => ({
        id: firestoreUser.id,
        email: firestoreUser.email,
        name: firestoreUser.name,
        role: firestoreUser.role,
        businessId: firestoreUser.businessId,
        avatar: firestoreUser.avatar || '',
    });

    // Subscribe to requisitions
    useEffect(() => {
        if (!currentUser) {
            setRequisitions([]);
            setLoadingRequisitions(false);
            return;
        }

        setLoadingRequisitions(true);
        let unsubscribe: Unsubscribe;

        try {
            if (currentUser.role === UserRole.SUPER_ADMIN) {
                // Super admin sees all requisitions
                unsubscribe = RequisitionsService.subscribeToAllRequisitions(
                    (firestoreReqs) => {
                        setRequisitions(firestoreReqs.map(convertRequisition));
                        setLoadingRequisitions(false);
                    },
                    (err) => {
                        setError(err.message);
                        setLoadingRequisitions(false);
                    }
                );
            } else {
                // Other users see requisitions from their business
                unsubscribe = RequisitionsService.subscribeToRequisitionsByBusiness(
                    currentUser.businessId,
                    (firestoreReqs) => {
                        setRequisitions(firestoreReqs.map(convertRequisition));
                        setLoadingRequisitions(false);
                    },
                    (err) => {
                        setError(err.message);
                        setLoadingRequisitions(false);
                    }
                );
            }
        } catch (err: any) {
            setError(err.message);
            setLoadingRequisitions(false);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [currentUser]);

    // Subscribe to businesses
    useEffect(() => {
        setLoadingBusinesses(true);

        const unsubscribe = FirestoreService.subscribeToCollection<FirestoreBusiness>(
            COLLECTIONS.BUSINESSES,
            (firestoreBizs) => {
                setBusinesses(firestoreBizs.map(convertBusiness));
                setLoadingBusinesses(false);
            },
            [],
            (err) => {
                setError(err.message);
                setLoadingBusinesses(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Subscribe to suppliers
    useEffect(() => {
        setLoadingSuppliers(true);

        const unsubscribe = FirestoreService.subscribeToCollection<FirestoreSupplier>(
            COLLECTIONS.SUPPLIERS,
            (firestoreSups) => {
                setSuppliers(firestoreSups.map(convertSupplier));
                setLoadingSuppliers(false);
            },
            [],
            (err) => {
                setError(err.message);
                setLoadingSuppliers(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Subscribe to notifications
    useEffect(() => {
        if (!currentUser) {
            setNotifications([]);
            setLoadingNotifications(false);
            return;
        }

        setLoadingNotifications(true);

        const unsubscribe = NotificationsService.subscribeToNotifications(
            currentUser.role,
            (firestoreNotifs) => {
                setNotifications(firestoreNotifs.map(convertNotification));
                setLoadingNotifications(false);
            },
            (err) => {
                setError(err.message);
                setLoadingNotifications(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser]);

    // Load all users
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const firestoreUsers = await FirestoreService.getDocuments<FirestoreUser>(
                    COLLECTIONS.USERS
                );
                setAllUsers(firestoreUsers.map(convertUser));
            } catch (err: any) {
                console.error('Error loading users:', err);
            }
        };

        loadUsers();
    }, []);

    // Requisition operations
    const createRequisition = async (data: Omit<Requisition, 'id' | 'dateCreated'>): Promise<string> => {
        try {
            const id = await RequisitionsService.createRequisition(data as any);
            return id;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const updateRequisition = async (id: string, data: Partial<Requisition>): Promise<void> => {
        try {
            await RequisitionsService.updateRequisition(id, data as any);
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const updateRequisitionStatus = async (
        id: string,
        status: RequisitionStatus,
        comment?: string
    ): Promise<void> => {
        try {
            await RequisitionsService.updateRequisitionStatus(id, status, comment);
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const deleteRequisition = async (id: string): Promise<void> => {
        try {
            await RequisitionsService.deleteRequisition(id);
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    // Supplier operations
    const createSupplier = async (data: Omit<Supplier, 'id'>): Promise<void> => {
        try {
            await FirestoreService.createDocument<FirestoreSupplier>(
                COLLECTIONS.SUPPLIERS,
                data as any
            );
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const updateSupplier = async (id: string, data: Partial<Supplier>): Promise<void> => {
        try {
            await FirestoreService.updateDocument<FirestoreSupplier>(
                COLLECTIONS.SUPPLIERS,
                id,
                data as any
            );
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const deleteSupplier = async (id: string): Promise<void> => {
        try {
            await FirestoreService.deleteDocument(COLLECTIONS.SUPPLIERS, id);
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    // Business operations
    const getUsersByBusiness = async (businessId: string): Promise<User[]> => {
        try {
            const firestoreUsers = await FirestoreService.getDocuments<FirestoreUser>(
                COLLECTIONS.USERS,
                [where('businessId', '==', businessId)]
            );
            return firestoreUsers.map(convertUser);
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const value: DataContextType = {
        requisitions,
        businesses,
        suppliers,
        notifications,
        allUsers,
        loadingRequisitions,
        loadingBusinesses,
        loadingSuppliers,
        loadingNotifications,
        error,
        createRequisition,
        updateRequisition,
        updateRequisitionStatus,
        deleteRequisition,
        createSupplier,
        updateSupplier,
        deleteSupplier,
        getUsersByBusiness,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
