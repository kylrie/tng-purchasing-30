import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../config/firebase';

/**
 * Counter types supported by the system
 */
export enum CounterType {
    PRF = 'prf',
    BURF = 'burf',
    LIQUIDATION = 'liquidation',
}

/**
 * Counter document structure in Firestore
 */
interface CounterDocument {
    value: number;
    lastUpdated: string;
}

/**
 * Service for managing auto-incrementing counters in Firestore
 * Uses transactions to ensure atomic increments and prevent race conditions
 */
export class CounterService {
    private static readonly COLLECTION_NAME = 'counters';

    /**
     * Get the next counter value and increment it atomically
     * @param counterType - Type of counter to increment
     * @returns The next counter value
     */
    static async getNextValue(counterType: CounterType): Promise<number> {
        const counterRef = doc(db, this.COLLECTION_NAME, counterType);

        try {
            const nextValue = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);

                let currentValue = 0;
                if (counterDoc.exists()) {
                    const data = counterDoc.data() as CounterDocument;
                    currentValue = data.value || 0;
                }

                const nextValue = currentValue + 1;

                // Update or create the counter document
                transaction.set(counterRef, {
                    value: nextValue,
                    lastUpdated: new Date().toISOString(),
                });

                return nextValue;
            });

            return nextValue;
        } catch (error) {
            console.error(`Error incrementing counter ${counterType}:`, error);
            throw new Error(`Failed to generate next ${counterType} ID`);
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
     * Reset a counter to a specific value (use with caution!)
     * @param counterType - Type of counter to reset
     * @param value - New counter value
     */
    static async resetCounter(counterType: CounterType, value: number = 0): Promise<void> {
        const counterRef = doc(db, this.COLLECTION_NAME, counterType);

        try {
            await runTransaction(db, async (transaction) => {
                transaction.set(counterRef, {
                    value,
                    lastUpdated: new Date().toISOString(),
                });
            });
        } catch (error) {
            console.error(`Error resetting counter ${counterType}:`, error);
            throw new Error(`Failed to reset ${counterType} counter`);
        }
    }
}
