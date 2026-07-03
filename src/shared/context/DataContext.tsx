import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import { useAuth } from '../../contexts/useAuth';
import { RequisitionService } from '../../features/procurement/services/requisitions.service';
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
import { UserRole } from '../types/firebase.types';
import { getUserVisibleBuIds } from '../utils/tenantFilters';

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
    createRequisition: (data: Omit<Requisition, 'id' | 'dateCreated' | 'timestamp'>) => Promise<string>;
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
    const [userNotifications, setUserNotifications] = useState<NotificationItem[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    const [loadingRequisitions, setLoadingRequisitions] = useState(true);
    const [loadingBusinesses, setLoadingBusinesses] = useState(true);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [loadingNotifications, setLoadingNotifications] = useState(true);

    const [error, setError] = useState<string | null>(null);

    // Convert Firestore data to app format
    const convertRequisition = (firestoreReq: FirestoreRequisition & { id: string }): Requisition => ({
        ...firestoreReq,
        id: firestoreReq.id,
        timestamp: firestoreReq.createdAt && typeof firestoreReq.createdAt.toDate === 'function'
            ? firestoreReq.createdAt.toDate().toISOString()
            : new Date().toISOString(),
    });

    const convertBusiness = (firestoreBiz: FirestoreBusiness & { id: string }): Business => ({
        ...firestoreBiz,
        id: firestoreBiz.id,
    });

    const convertSupplier = (firestoreSup: FirestoreSupplier & { id: string }): Supplier => ({
        ...firestoreSup,
        id: firestoreSup.id,
    });

    const convertNotification = (firestoreNotif: FirestoreNotification & { id: string }): NotificationItem => ({
        ...firestoreNotif,
        id: firestoreNotif.id,
        timestamp: firestoreNotif.createdAt && typeof firestoreNotif.createdAt.toDate === 'function'
            ? firestoreNotif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: firestoreNotif.createdAt,
        targetRoles: firestoreNotif.targetRoles as UserRole[],
    });

    const convertUser = (firestoreUser: FirestoreUser & { id: string }): User => ({
        ...firestoreUser,
        id: firestoreUser.id,
        avatar: firestoreUser.avatar || '',
    });

    // Subscribe to requisitions
    useEffect(() => {
        if (!currentUser) {
// eslint-disable-next-line react-hooks/set-state-in-effect
            setRequisitions(prev => prev.length === 0 ? prev : []);
            setLoadingRequisitions(false);
            return;
        }

        // REMOVED: setLoadingRequisitions(true); - Fix for revert issue

        let unsubscribe: Unsubscribe;

        try {
            const processReqs = (firestoreReqs: (FirestoreRequisition & { id: string })[]) => {
                setRequisitions(firestoreReqs.map(convertRequisition));
                setLoadingRequisitions(false);
            };

            // Pass the additional multi-BU list
            unsubscribe = RequisitionService.subscribeToRequisitions(
                currentUser.role,
                currentUser.businessId,
                currentUser.businessUnitIds || [],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                processReqs as any
            );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            setLoadingRequisitions(false);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [currentUser]);

    // Subscribe to businesses — filtered by user's assigned BUs
    useEffect(() => {
        // REMOVED: setLoadingBusinesses(true);

        // Determine which BUs the current user is allowed to see
        const visibleBuIds = getUserVisibleBuIds(currentUser ?? null);

        const handleBizData = (firestoreBizs: (FirestoreBusiness & { id: string })[]) => {
            let filtered = firestoreBizs;
            // visibleBuIds === null means global role → show all
            // visibleBuIds is an array → client-side filter by doc.id
            if (visibleBuIds !== null) {
                filtered = firestoreBizs.filter(b => visibleBuIds.includes(b.id));
            }
            setBusinesses(filtered.map(convertBusiness));
            setLoadingBusinesses(false);
        };

        // We still fetch all businesses and filter client-side because
        // Firestore 'documentId()' in queries are complex. The businesses
        // collection is small (typically < 50 docs), so this is efficient.
        const unsubscribe = FirestoreService.subscribeToCollection<FirestoreBusiness>(
            COLLECTIONS.BUSINESSES,
            handleBizData,
            [],
            (err) => {
                setError(err.message);
                setLoadingBusinesses(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser]);

    // Subscribe to suppliers
    useEffect(() => {
        // REMOVED: setLoadingSuppliers(true);

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
// eslint-disable-next-line react-hooks/set-state-in-effect
            setNotifications(prev => prev.length === 0 ? prev : []);
            setLoadingNotifications(false);
            return;
        }

        // REMOVED: setLoadingNotifications(true);

        const handleUserNotifs = (firestoreNotifs: (FirestoreNotification & { id: string })[]) => {
            setUserNotifications(firestoreNotifs.map(convertNotification));
            setLoadingNotifications(false);
        };

        const handleError = (err: Error) => {
            setError(err.message);
            setLoadingNotifications(false);
        };

        // Subscribe to user-specific notifications only (Backend must resolve Roles to UIDs)
        const unsubUser = NotificationsService.subscribeToNotifications(currentUser.id, handleUserNotifs, handleError);

        return () => {
            unsubUser();
        };
    }, [currentUser]);

    // Merge and sort notifications
    useEffect(() => {
        // Just use userNotifications directly since we removed roleNotifications
        const sortedList = [...userNotifications].sort((a, b) => {
            // Sort by createdAt desc safely
            if (a.createdAt && b.createdAt) {
                return b.createdAt.toMillis() - a.createdAt.toMillis();
            }
            return 0;
        });

// eslint-disable-next-line react-hooks/set-state-in-effect
        setNotifications(sortedList);
    }, [userNotifications]);

    // Load all users
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const firestoreUsers = await FirestoreService.getDocuments<FirestoreUser>(
                    COLLECTIONS.USERS
                );
                setAllUsers(firestoreUsers.map(convertUser));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.error('Error loading users:', err);
            }
        };

        loadUsers();
    }, []);

    // Requisition operations
    const createRequisition = React.useCallback(async (data: Omit<Requisition, 'id' | 'dateCreated' | 'timestamp'>): Promise<string> => {
        try {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id = await RequisitionService.createRequisition(data as any);
            return id;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    const updateRequisition = React.useCallback(async (id: string, data: Partial<Requisition>): Promise<void> => {
        try {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            await RequisitionService.updateRequisition(id, data as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    const updateRequisitionStatus = React.useCallback(async (
        id: string,
        status: RequisitionStatus,
        comment?: string
    ): Promise<void> => {
        try {
            await RequisitionService.updateRequisition(id, { status, remarks: comment });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    const deleteRequisition = React.useCallback(async (id: string): Promise<void> => {
        try {
            await RequisitionService.deleteRequisition(id);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    // Supplier operations
    const createSupplier = React.useCallback(async (data: Omit<Supplier, 'id'>): Promise<void> => {
        try {
            await FirestoreService.createDocument<FirestoreSupplier>(
                COLLECTIONS.SUPPLIERS,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                data as any
            );
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    const updateSupplier = React.useCallback(async (id: string, data: Partial<Supplier>): Promise<void> => {
        try {
            await FirestoreService.updateDocument<FirestoreSupplier>(
                COLLECTIONS.SUPPLIERS,
                id,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                data as any
            );
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    const deleteSupplier = React.useCallback(async (id: string): Promise<void> => {
        try {
            await FirestoreService.deleteDocument(COLLECTIONS.SUPPLIERS, id);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    // Business operations
    const getUsersByBusiness = React.useCallback(async (businessId: string): Promise<User[]> => {
        try {
            const firestoreUsers = await FirestoreService.getDocuments<FirestoreUser>(
                COLLECTIONS.USERS,
                [where('businessId', '==', businessId)]
            );
            return firestoreUsers.map(convertUser);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }, []);

    const value: DataContextType = React.useMemo(() => ({
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
    }), [
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
        getUsersByBusiness
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
