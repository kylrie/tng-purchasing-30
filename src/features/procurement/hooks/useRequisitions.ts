import { useState, useEffect } from 'react';
import { RequisitionService } from '../services/requisitions.service';
import { useAuth } from '../../../contexts/AuthContext';
import type { Requisition } from "../types";
import { removeUndefinedFields } from '../../../shared/utils/firestore.utils';

export const useRequisitions = () => {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!currentUser) {
            setLoading(prev => prev ? false : prev);
            return;
        }

        setLoading(prev => !prev ? true : prev);

        // Subscribe using the service which handles RBAC (Role Based Access Control)
        // and Multi-BU logic.
        const unsubscribe = RequisitionService.subscribeToRequisitions(
            currentUser.role,
            currentUser.businessId,
            currentUser.businessUnitIds || [], // Pass the new multi-BU array
            (data) => {
                // FIX BUG 7: Robust sorting with date validation
                // Prevents NaN from invalid dates causing unpredictable sort order
                const sorted = [...data].sort((a, b) => {
                    // Parse dates with validation
                    const dateA = a.dateCreated ? new Date(a.dateCreated) : null;
                    const dateB = b.dateCreated ? new Date(b.dateCreated) : null;

                    const timeA = dateA ? dateA.getTime() : NaN;
                    const timeB = dateB ? dateB.getTime() : NaN;

                    const validA = !isNaN(timeA);
                    const validB = !isNaN(timeB);

                    // Both valid: sort by date descending
                    if (validA && validB) {
                        return timeB - timeA;
                    }
                    // Only A valid: A comes first
                    if (validA && !validB) return -1;
                    // Only B valid: B comes first
                    if (!validA && validB) return 1;
                    // Neither valid: fallback to ID comparison
                    return (b.id || '').localeCompare(a.id || '');
                });

                setRequisitions(sorted);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentUser]);

    const createRequisition = async (requisitionData: Omit<Requisition, 'id'> | Requisition) => {
        try {
            // Remove undefined fields to prevent Firestore errors
            const sanitized = removeUndefinedFields(requisitionData);
            await RequisitionService.createRequisition(sanitized);
        } catch (err: any) {
            console.error("Error creating requisition: ", err);
            setError(err.message);
            throw err;
        }
    };

    const updateRequisition = async (requisitionData: Requisition) => {
        try {
            // Remove undefined fields to prevent Firestore errors
            const sanitized = removeUndefinedFields(requisitionData);
            await RequisitionService.updateRequisition(requisitionData.id, sanitized);
        } catch (err: any) {
            console.error("Error updating requisition: ", err);
            setError(err.message);
            throw err;
        }
    };

    return { requisitions, loading, error, createRequisition, updateRequisition };
};
