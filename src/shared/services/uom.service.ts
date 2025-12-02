import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const UOM_COLLECTION = 'uom';
const UOM_DOC_ID = 'units';

/**
 * UOM document structure in Firestore
 */
export interface UOMDocument {
    units: string[];
    lastUpdated: string;
}

/**
 * Default UOM values
 */
const DEFAULT_UOMS = ['pcs', 'box', 'pack', 'kg', 'g', 'l', 'm', 'set', 'roll', 'pad', 'ream'];

/**
 * Service for managing Units of Measurement in Firestore
 */
export class UOMService {
    /**
     * Get all UOMs from Firestore
     * Returns default UOMs if document doesn't exist
     */
    static async getUOMs(): Promise<string[]> {
        try {
            const uomRef = doc(db, UOM_COLLECTION, UOM_DOC_ID);
            const uomDoc = await getDoc(uomRef);

            if (uomDoc.exists()) {
                const data = uomDoc.data() as UOMDocument;
                return data.units || DEFAULT_UOMS;
            }

            // If document doesn't exist, create it with defaults
            await this.updateUOMs(DEFAULT_UOMS);
            return DEFAULT_UOMS;
        } catch (error) {
            console.error('Error fetching UOMs:', error);
            return DEFAULT_UOMS;
        }
    }

    /**
     * Update UOMs in Firestore
     * @param units - Array of UOM strings
     */
    static async updateUOMs(units: string[]): Promise<void> {
        try {
            const uomRef = doc(db, UOM_COLLECTION, UOM_DOC_ID);
            const uomData: UOMDocument = {
                units,
                lastUpdated: new Date().toISOString(),
            };

            await setDoc(uomRef, uomData);
        } catch (error) {
            console.error('Error updating UOMs:', error);
            throw new Error('Failed to update UOMs');
        }
    }
}
