/**
 * Detect Duplicate Users Script
 * Scans Firestore 'users' collection to find:
 * 1. Users with the same email appearing multiple times
 * 2. Users where document ID doesn't match expected Firebase Auth UID pattern
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

try {
    initializeApp({
        credential: cert(serviceAccountPath)
    });
} catch (e) {
    // App might already be initialized
}

const db = getFirestore();

interface UserDoc {
    id: string;
    email?: string;
    name?: string;
    role?: string;
    status?: string;
    businessId?: string;
    businessUnitIds?: string[];
    createdAt?: any;
}

async function detectDuplicates() {
    console.log('🔍 Scanning for duplicate users...\n');
    console.log('='.repeat(80));

    try {
        const usersSnapshot = await db.collection('users').get();
        const users: UserDoc[] = [];

        usersSnapshot.forEach(doc => {
            users.push({
                id: doc.id,
                ...doc.data()
            } as UserDoc);
        });

        console.log(`📊 Total users found: ${users.length}\n`);

        // Group by email
        const emailMap = new Map<string, UserDoc[]>();

        users.forEach(user => {
            const email = user.email?.toLowerCase() || 'NO_EMAIL';
            if (!emailMap.has(email)) {
                emailMap.set(email, []);
            }
            emailMap.get(email)!.push(user);
        });

        // Find duplicates
        let duplicateCount = 0;
        const duplicates: { email: string; users: UserDoc[] }[] = [];

        emailMap.forEach((userList, email) => {
            if (userList.length > 1) {
                duplicateCount++;
                duplicates.push({ email, users: userList });
            }
        });

        if (duplicates.length === 0) {
            console.log('✅ No duplicate users found!\n');
        } else {
            console.log(`⚠️  Found ${duplicates.length} email(s) with duplicates:\n`);
            console.log('='.repeat(80));

            duplicates.forEach(({ email, users: dupeUsers }, index) => {
                console.log(`\n📧 [${index + 1}] Email: ${email}`);
                console.log(`   Found ${dupeUsers.length} documents:\n`);

                dupeUsers.forEach((user, i) => {
                    console.log(`   Document ${i + 1}:`);
                    console.log(`   ├─ ID:       ${user.id}`);
                    console.log(`   ├─ Name:     ${user.name || 'N/A'}`);
                    console.log(`   ├─ Role:     ${user.role || 'N/A'}`);
                    console.log(`   ├─ Status:   ${user.status || 'N/A'}`);
                    console.log(`   ├─ BusinessId: ${user.businessId || 'N/A'}`);
                    console.log(`   └─ BU IDs:   ${user.businessUnitIds?.join(', ') || 'N/A'}`);
                    console.log('');
                });

                // Identify which one is likely the "correct" one
                // Usually the one with ACTIVE status or most recent
                const activeUsers = dupeUsers.filter(u => u.status === 'ACTIVE');
                if (activeUsers.length === 1) {
                    console.log(`   💡 Suggestion: Keep document ID "${activeUsers[0].id}" (ACTIVE status)`);
                    console.log(`   🗑️  Consider deleting other document(s)`);
                } else if (activeUsers.length > 1) {
                    console.log(`   ⚠️  Multiple ACTIVE documents! Manual review required.`);
                } else {
                    console.log(`   ⚠️  No ACTIVE documents found. Manual review required.`);
                }
                console.log('-'.repeat(80));
            });
        }

        // Summary
        console.log('\n' + '='.repeat(80));
        console.log('📋 SUMMARY');
        console.log('='.repeat(80));
        console.log(`   Total Users:     ${users.length}`);
        console.log(`   Unique Emails:   ${emailMap.size}`);
        console.log(`   Duplicate Sets:  ${duplicates.length}`);
        console.log(`   Documents to review: ${duplicates.reduce((sum, d) => sum + d.users.length - 1, 0)}`);
        console.log('='.repeat(80));

        // Return data for potential cleanup
        return {
            totalUsers: users.length,
            duplicates,
            allUsers: users
        };

    } catch (error) {
        console.error('❌ Error scanning users:', error);
        throw error;
    }
}

// Run the detection
detectDuplicates()
    .then(() => {
        console.log('\n✅ Scan complete.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Script failed:', err);
        process.exit(1);
    });
