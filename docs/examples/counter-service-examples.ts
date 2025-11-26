/**
 * Example usage of CounterService
 * This file demonstrates how to use the counter service in your components
 * 
 * NOTE: This is an example file for reference only.
 * Do not import or use this file in production code.
 */

import { CounterService, CounterType } from '../shared/services/counter.service';

/**
 * Example 1: Generate a PRF ID
 */
export async function exampleGeneratePRFId() {
    try {
        const prfId = await CounterService.generatePRFId();
        console.log('Generated PRF ID:', prfId); // Output: "PRF-0001"
        return prfId;
    } catch (error) {
        console.error('Failed to generate PRF ID:', error);
        throw error;
    }
}

/**
 * Example 2: Generate a BURF ID
 */
export async function exampleGenerateBURFId() {
    try {
        const burfId = await CounterService.generateBURFId();
        console.log('Generated BURF ID:', burfId); // Output: "BURF-0001"
        return burfId;
    } catch (error) {
        console.error('Failed to generate BURF ID:', error);
        throw error;
    }
}

/**
 * Example 3: Generate a Liquidation ID
 */
export async function exampleGenerateLiquidationId() {
    try {
        const liqId = await CounterService.generateLiquidationId();
        console.log('Generated Liquidation ID:', liqId); // Output: "LIQ-0001"
        return liqId;
    } catch (error) {
        console.error('Failed to generate Liquidation ID:', error);
        throw error;
    }
}

/**
 * Example 4: Check current counter value
 */
export async function exampleGetCurrentValue() {
    try {
        const currentValue = await CounterService.getCurrentValue(CounterType.PRF);
        console.log('Current PRF counter value:', currentValue);
        console.log('Next PRF ID will be:', `PRF-${(currentValue + 1).toString().padStart(4, '0')}`);
        return currentValue;
    } catch (error) {
        console.error('Failed to get current value:', error);
        throw error;
    }
}

/**
 * Example 5: Reset counter (admin only - use with caution!)
 */
export async function exampleResetCounter() {
    try {
        // Reset PRF counter to 0
        await CounterService.resetCounter(CounterType.PRF, 0);
        console.log('PRF counter reset to 0');

        // Or reset to a specific value
        await CounterService.resetCounter(CounterType.PRF, 100);
        console.log('PRF counter reset to 100 - next ID will be PRF-0101');
    } catch (error) {
        console.error('Failed to reset counter:', error);
        throw error;
    }
}

/**
 * Example 6: How to integrate in PreparePRFModal
 * This shows the actual integration pattern
 */
export async function examplePreparePRFModalIntegration() {
    // Simulated requisition data
    const requisition = {
        id: 'temp-id',
        items: [{ name: 'Item 1', quantity: 1, price: 100 }],
        // ... other properties
    };

    try {
        // Generate PRF ID using counter service
        const prfId = await CounterService.generatePRFId();

        // Create new PRF with the generated ID
        const newPrf = {
            ...requisition,
            id: prfId, // Use the generated ID instead of random
            // ... rest of the properties
        };

        console.log('Created PRF with ID:', newPrf.id);
        return newPrf;
    } catch (error) {
        console.error('Failed to create PRF:', error);
        // Fallback to timestamp-based ID if counter service fails
        const fallbackId = `PRF-${Date.now()}`;
        console.warn('Using fallback ID:', fallbackId);
        return {
            ...requisition,
            id: fallbackId,
        };
    }
}

/**
 * Example 7: Batch ID generation
 */
export async function exampleBatchGeneration() {
    try {
        // Generate multiple IDs in sequence
        const ids = [];
        for (let i = 0; i < 5; i++) {
            const id = await CounterService.generatePRFId();
            ids.push(id);
        }

        console.log('Generated IDs:', ids);
        // Output: ["PRF-0001", "PRF-0002", "PRF-0003", "PRF-0004", "PRF-0005"]

        return ids;
    } catch (error) {
        console.error('Failed to generate batch IDs:', error);
        throw error;
    }
}

/**
 * Example 8: Error handling pattern
 */
export async function exampleErrorHandling() {
    try {
        const prfId = await CounterService.generatePRFId();
        return { success: true, id: prfId };
    } catch (error) {
        // Log the error
        console.error('Counter service error:', error);

        // Return error state
        return {
            success: false,
            error: 'Failed to generate PRF ID. Please try again.',
            fallbackId: `PRF-TEMP-${Date.now()}`
        };
    }
}

// Export all examples for reference
export const counterServiceExamples = {
    exampleGeneratePRFId,
    exampleGenerateBURFId,
    exampleGenerateLiquidationId,
    exampleGetCurrentValue,
    exampleResetCounter,
    examplePreparePRFModalIntegration,
    exampleBatchGeneration,
    exampleErrorHandling,
};
