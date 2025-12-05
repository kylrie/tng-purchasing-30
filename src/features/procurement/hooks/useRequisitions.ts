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
            setLoading(false);
            return;
        }

        setLoading(true);

        // Subscribe using the service which handles RBAC (Role Based Access Control)
        // and Multi-BU logic.
        const unsubscribe = RequisitionService.subscribeToRequisitions(
            currentUser.role,
            currentUser.businessId,
            currentUser.businessUnitIds || [], // Pass the new multi-BU array
            (data) => {
                // Sort by ID descending (newest first)
                const sorted = [...data].sort((a, b) => {
                    // Sort by timestamp if available, else by ID
                    if (a.dateCreated && b.dateCreated) {
                        return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
                    }
                    return a.id.localeCompare(b.id) * -1; // Descending ID
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
