import { doc, runTransaction, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

/**
 * Counter types supported by the system
 */
export enum CounterType {
    PRF = 'prf',
    BURF = 'burf',
    LIQUIDATION = 'liquidation',
    PCF = 'pcf',
}

/**
 * Counter document structure in Firestore
 * Updated to match firestore.rules requirements (Issue #6)
 */
interface CounterDocument {
    value: number;
    prefix: string; // Required by firestore.rules
    lastUpdated: string;
}

/**
 * Service for managing auto-incrementing counters in Firestore
 * Uses transactions to ensure atomic increments and prevent race conditions
 */
export class CounterService {
    private static readonly COLLECTION_NAME = 'counters';

    // Prefix mappings for each counter type
    private static readonly PREFIXES: Record<CounterType, string> = {
        [CounterType.PRF]: 'PRF',
        [CounterType.BURF]: 'BURF',
        [CounterType.LIQUIDATION]: 'LIQ',
        [CounterType.PCF]: 'PCF',
    };

    /**
     * Get the next counter value and increment it atomically
     * @param counterType - Type of counter to increment
     * @returns The next counter value
     */
    static async getNextValue(counterType: CounterType): Promise<number> {
        const counterRef = doc(db, this.COLLECTION_NAME, counterType);
        const prefix = this.PREFIXES[counterType];

        try {
            const nextValue = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);

                let currentValue = 0;
                if (counterDoc.exists()) {
                    const data = counterDoc.data() as CounterDocument;
                    currentValue = data.value || 0;
                }

                const nextValue = currentValue + 1;

                // FIX: Use update() for existing docs, set() only for new docs
                // This matches Firestore rules which have separate create/update permissions
                if (counterDoc.exists()) {
                    transaction.update(counterRef, {
                        value: nextValue,
                        lastUpdated: new Date().toISOString(),
                    });
                } else {
                    transaction.set(counterRef, {
                        value: nextValue,
                        prefix: prefix,
                        lastUpdated: new Date().toISOString(),
                    });
                }

                return nextValue;
            });

            return nextValue;
        } catch (error) {
            console.error(`Error incrementing counter ${counterType}:`, error);
            throw new Error(`Failed to generate next ${counterType} ID`);
        }
    }

    /**
     * Get the next ID for any prefix (dynamic counter support)
     * Handles new/unknown prefixes by automatically creating the counter document starting at 1
     * @param prefix - The prefix string (e.g., 'PRF', 'BURF', 'PCF')
     * @returns Formatted ID string (e.g., 'PCF-00001')
     */
    static async getNextId(prefix: string): Promise<string> {
        // Normalize prefix to lowercase for document ID
        const counterDocId = prefix.toLowerCase();
        const counterRef = doc(db, this.COLLECTION_NAME, counterDocId);

        try {
            const nextValue = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);

                let currentValue = 0;
                if (counterDoc.exists()) {
                    const data = counterDoc.data() as CounterDocument;
                    currentValue = data.value || 0;
                }

                const nextVal = currentValue + 1;

                // Use update() for existing docs, set() for new docs (auto-initialize at 1)
                if (counterDoc.exists()) {
                    transaction.update(counterRef, {
                        value: nextVal,
                        lastUpdated: new Date().toISOString(),
                    });
                } else {
                    // Auto-create new counter document starting at 1
                    transaction.set(counterRef, {
                        value: nextVal,
                        prefix: prefix.toUpperCase(),
                        lastUpdated: new Date().toISOString(),
                    });
                }

                return nextVal;
            });

            // Format: PREFIX-00001 (5-digit padding for larger sequences)
            return `${prefix.toUpperCase()}-${nextValue.toString().padStart(5, '0')}`;
        } catch (error) {
            console.error(`Error generating next ID for ${prefix}:`, error);
            throw new Error(`Failed to generate next ${prefix} ID`);
        }
    }

    /**
     * Generate a formatted PRF ID (e.g., "PRF-0001")
     * @returns Formatted PRF ID string
     */
    static async generatePRFId(): Promise<string> {
        const nextValue = await this.getNextValue(CounterType.PRF);
        return this.formatPRFId(nextValue);
    }

    /**
     * Generate a formatted BURF ID (e.g., "BURF-0001")
     * @returns Formatted BURF ID string
     */
    static async generateBURFId(): Promise<string> {
        const nextValue = await this.getNextValue(CounterType.BURF);
        return this.formatBURFId(nextValue);
    }

    /**
     * Generate a formatted Liquidation ID (e.g., "LIQ-0001")
     * @returns Formatted Liquidation ID string
     */
    static async generateLiquidationId(): Promise<string> {
        const nextValue = await this.getNextValue(CounterType.LIQUIDATION);
        return this.formatLiquidationId(nextValue);
    }

    /**
     * Generate a batch-specific PRF ID for BURF-to-PRF conversions
     * Queries existing PRFs linked to this BURF and generates the next batch number
     * @param parentBurfId - The original BURF ID (e.g., "BURF-0033")
     * @returns Formatted batch ID (e.g., "BURF-0033-B1", "BURF-0033-B2")
     */
    static async generateBatchPrfId(parentBurfId: string): Promise<string> {
        try {
            // Query for existing PRFs that were created from this BURF
            // They will have prfDetails.requisitionId = parentBurfId OR id starts with parentBurfId-B
            const requisitionsRef = collection(db, 'requisitions');

            // Count existing batches by looking for IDs that start with parentBurfId-B
            const batchQuery = query(
                requisitionsRef,
                where('prfDetails.requisitionId', '==', parentBurfId)
            );

            const snapshot = await getDocs(batchQuery);
            const batchCount = snapshot.size;

            // Generate next batch number (B1, B2, B3, etc.)
            const nextBatchNumber = batchCount + 1;
            return `${parentBurfId}-B${nextBatchNumber}`;
        } catch (error) {
            console.error(`Error generating batch PRF ID for ${parentBurfId}:`, error);
            // Fallback: use timestamp-based suffix to avoid collisions
            const fallbackSuffix = Date.now().toString().slice(-4);
            return `${parentBurfId}-B${fallbackSuffix}`;
        }
    }

    /**
     * Format a number as a PRF ID
     * @param value - Counter value
     * @returns Formatted PRF ID (e.g., "PRF-0001")
     */
    private static formatPRFId(value: number): string {
        return `PRF-${value.toString().padStart(4, '0')}`;
    }

    /**
     * Format a number as a BURF ID
     * @param value - Counter value
     * @returns Formatted BURF ID (e.g., "BURF-0001")
     */
    private static formatBURFId(value: number): string {
        return `BURF-${value.toString().padStart(4, '0')}`;
    }

    /**
     * Format a number as a Liquidation ID
     * @param value - Counter value
     * @returns Formatted Liquidation ID (e.g., "LIQ-0001")
     */
    private static formatLiquidationId(value: number): string {
        return `LIQ-${value.toString().padStart(4, '0')}`;
    }

    /**
     * Get the current counter value without incrementing
     * @param counterType - Type of counter to check
     * @returns Current counter value, or 0 if not initialized
     */
    static async getCurrentValue(counterType: CounterType): Promise<number> {
        const counterRef = doc(db, this.COLLECTION_NAME, counterType);

        try {
            const counterDoc = await runTransaction(db, async (transaction) => {
                const doc = await transaction.get(counterRef);
                if (doc.exists()) {
                    const data = doc.data() as CounterDocument;
                    return data.value || 0;
                }
                return 0;
            });

            return counterDoc;
        } catch (error) {
            console.error(`Error reading counter ${counterType}:`, error);
            return 0;
        }
    }

    /**
     * Reset a counter to a specific value
     * @deprecated SECURITY FIX C3: This function is COMPLETELY DISABLED to prevent ID collisions.
     * Counter resets should ONLY be performed via Firebase Admin SDK by authorized personnel.
     * 
     * Rationale: Even in development, resetting counters can cause ID reuse which may
     * propagate to production through data exports/imports or shared staging environments.
     * 
     * @param _counterType - Type of counter to reset (unused - function disabled)
     * @param _value - New counter value (unused - function disabled)
     * @throws Always throws an error directing to Firebase Admin SDK
     */
    static async resetCounter(_counterType: CounterType, _value: number = 0): Promise<void> {
        // FIX C3: COMPLETELY DISABLED - was only checking PROD environment
        // Risk: Development data with reused IDs could leak to production
        // Solution: Always throw, directing users to proper admin procedures
        throw new Error(
            'Counter reset is permanently disabled in client code to prevent ID collisions. ' +
            'Use Firebase Admin SDK with proper authorization for counter management.'
        );
    }

}
