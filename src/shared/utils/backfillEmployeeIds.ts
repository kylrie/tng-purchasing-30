/**
 * Backfill Employee IDs for Existing Users
 * 
 * Run this utility once to add human-readable employee IDs to existing users
 * who don't have one assigned.
 * 
 * Usage: Import and call backfillEmployeeIds() from a component or script
 */

import { FirestoreService, Timestamp } from '../services/firestore.service';
import { COLLECTIONS } from '../types/firebase.types';
import { generateEmployeeId } from './employeeId';

interface UserWithEmployeeId {
    id?: string;
    name: string;
    employeeId?: string;
}

/**
 * Backfill employee IDs for all users who don't have one
 * @returns Promise with results of the backfill operation
 */
export async function backfillEmployeeIds(): Promise<{
    processed: number;
    updated: number;
    skipped: number;
    errors: string[];
}> {
    const results = {
        processed: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[]
    };

    try {
        // Get all users
        const users = await FirestoreService.getDocuments<UserWithEmployeeId>(
            COLLECTIONS.USERS
        );

        console.log(`📋 Found ${users.length} users to process`);

        for (const user of users) {
            results.processed++;

            // Skip users who already have an employee ID
            if (user.employeeId) {
                console.log(`⏭️ Skipping ${user.name} - already has ID: ${user.employeeId}`);
                results.skipped++;
                continue;
            }

            try {
                // Generate new employee ID
                const employeeId = await generateEmployeeId(user.name);

                // Update user document
                if (user.id) {
                    await FirestoreService.updateDocument(
                        COLLECTIONS.USERS,
                        user.id,
                        {
                            employeeId,
                            updatedAt: Timestamp.now()
                        }
                    );
                    console.log(`✅ Updated ${user.name} -> ${employeeId}`);
                    results.updated++;
                }
            } catch (error) {
                const errorMsg = `Failed to update ${user.name}: ${error}`;
                console.error(`❌ ${errorMsg}`);
                results.errors.push(errorMsg);
            }
        }

        console.log(`\n📊 Backfill Complete:`);
        console.log(`   Processed: ${results.processed}`);
        console.log(`   Updated: ${results.updated}`);
        console.log(`   Skipped: ${results.skipped}`);
        console.log(`   Errors: ${results.errors.length}`);

    } catch (error) {
        console.error('❌ Backfill failed:', error);
        results.errors.push(`Backfill failed: ${error}`);
    }

    return results;
}
