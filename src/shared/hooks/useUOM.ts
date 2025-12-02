import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { UOMService } from '../services/uom.service';

const UOM_COLLECTION = 'uom';
const UOM_DOC_ID = 'units';
const DEFAULT_UOMS = ['pcs', 'box', 'pack', 'kg', 'g', 'l', 'm', 'set', 'roll', 'pad', 'ream'];

/**
 * Hook for managing UOM data with Firestore real-time sync
 */
export const useUOM = () => {
    const [uomOptions, setUomOptions] = useState<string[]>(DEFAULT_UOMS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Set up real-time listener on mount
    useEffect(() => {
        setLoading(true);
        setError(null);

        const uomRef = doc(db, UOM_COLLECTION, UOM_DOC_ID);

        // Subscribe to real-time updates
        const unsubscribe = onSnapshot(
            uomRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setUomOptions(data.units || DEFAULT_UOMS);
                } else {
                    // Document doesn't exist, initialize with defaults
                    UOMService.updateUOMs(DEFAULT_UOMS).catch(err => {
                        console.error('Error initializing UOMs:', err);
                    });
                    setUomOptions(DEFAULT_UOMS);
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error listening to UOMs:', err);
                setError('Failed to sync UOMs');
                setUomOptions(DEFAULT_UOMS); // Fallback to defaults
                setLoading(false);
            }
        );

        // Cleanup listener on unmount
        return () => unsubscribe();
    }, []);

    /**
     * Update UOMs in Firestore (real-time listener will update local state automatically)
     * @param units - Array of UOM strings
     */
    const updateUOMs = async (units: string[]) => {
        try {
            setError(null);
            await UOMService.updateUOMs(units);
            // No need to update local state - the listener will handle it
        } catch (err) {
            console.error('Error updating UOMs:', err);
            setError('Failed to update UOMs');
            throw err;
        }
    };

    return {
        uomOptions,
        updateUOMs,
        loading,
        error,
    };
};
