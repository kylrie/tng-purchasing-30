import { Timestamp, serverTimestamp } from 'firebase/firestore';

/**
 * Convert Firestore Timestamp to JavaScript Date
 */
export const convertTimestamp = (timestamp: Timestamp): Date => {
    return timestamp.toDate();
};

/**
 * Get current Firestore server timestamp
 */
export const firestoreTimestamp = () => {
    return serverTimestamp();
};

/**
 * Generate custom requisition ID in format REQ-1001
 * This should be called when creating a new requisition
 */
export const generateRequisitionId = (lastId?: string): string => {
    if (!lastId) {
        return 'REQ-1001';
    }

    const numericPart = parseInt(lastId.split('-')[1]);
    const nextNumber = numericPart + 1;
    return `REQ-${nextNumber.toString().padStart(4, '0')}`;
};

/**
 * Convert Firestore document data to application format
 * Converts Timestamps to Date strings for compatibility with existing components
 */
export const convertFirestoreDoc = <T>(data: any): T => {
    const converted: any = { ...data };

    // Convert Timestamp fields to Date objects
    if (data.createdAt && data.createdAt instanceof Timestamp) {
        converted.createdAt = convertTimestamp(data.createdAt);
    }

    if (data.updatedAt && data.updatedAt instanceof Timestamp) {
        converted.updatedAt = convertTimestamp(data.updatedAt);
    }

    return converted as T;
};

/**
 * Format date in YYYY-MM-DD format
 */
export const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get current date in YYYY-MM-DD format
 */
export const getCurrentDateString = (): string => {
    return formatDate(new Date());
};
