/**
 * Employee ID Utilities
 * Generates human-readable employee IDs from user names
 */

import { FirestoreService } from '../services/firestore.service';
import { COLLECTIONS } from '../types/firebase.types';

/**
 * Generate a human-readable employee ID from a name
 * Format: Full Name-XXX (e.g., "John Doe-001", "Maria Santos-002")
 * 
 * @param name - Full name of the user
 * @returns Promise<string> - Generated employee ID
 */
export async function generateEmployeeId(name: string): Promise<string> {
    // Normalize and format the name (proper case, trim whitespace)
    const formattedName = name.trim()
        .split(/\s+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

    // Find next available sequence number for this name
    const sequence = await getNextSequenceNumber(formattedName);

    // Format as "Full Name-001"
    return `${formattedName}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Get the next available sequence number for a given name
 */
async function getNextSequenceNumber(baseName: string): Promise<number> {
    try {
        // Query users with matching name pattern
        const users = await FirestoreService.getDocuments<{ employeeId?: string }>(
            COLLECTIONS.USERS
        );

        // Find highest existing sequence for this name
        let maxSequence = 0;
        // Escape special regex characters in name and match pattern
        const escapedName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^${escapedName}-(\\d+)$`, 'i');

        for (const user of users) {
            if (user.employeeId) {
                const match = user.employeeId.match(pattern);
                if (match) {
                    const seq = parseInt(match[1], 10);
                    if (seq > maxSequence) {
                        maxSequence = seq;
                    }
                }
            }
        }

        return maxSequence + 1;
    } catch (error) {
        console.error('Error getting sequence number:', error);
        // Default to 1 if we can't query
        return 1;
    }
}

/**
 * Generate a simple employee ID without async (for display purposes)
 * This creates a consistent format but doesn't guarantee uniqueness
 * Use generateEmployeeId() for actual user creation
 */
export function formatEmployeeIdPreview(name: string): string {
    const formattedName = name.trim()
        .split(/\s+/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

    return `${formattedName}-XXX`;
}
