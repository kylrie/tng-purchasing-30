/**
 * Backfill Stocktake Audit Logs
 * 
 * Reads all COMPLETED stock_counts sessions from Firestore and generates
 * stocktake_audit_logs entries for each item in each session.
 * 
 * NOTE: Since historical sessions were submitted before audit logging existed,
 * we do NOT have "stockBefore" values. We set stockBefore = 0 and stockAfter
 * to the counted value so the log shows what was counted. These entries are
 * marked with source: 'backfill' to distinguish from live audit logs.
 *
 * Usage: node scripts/backfill-stocktake-logs.mjs
 * 
 * Prerequisites:
 * - Firebase Admin SDK credentials (GOOGLE_APPLICATION_CREDENTIALS env var)
 * - Or run after: firebase login
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const PROJECT_ID = 'tng-systems';
const DATABASE_ID = 'tng-systems';

async function main() {
    console.log('🔄 Backfill Stocktake Audit Logs');
    console.log('=================================');

    // Initialize Firebase Admin
    if (getApps().length === 0) {
        initializeApp({ projectId: PROJECT_ID });
    }

    const db = getFirestore(undefined, DATABASE_ID);

    // 1. Load all inventory items into a lookup map (for type + unit info)
    console.log('\n📦 Loading inventory items...');
    const itemsSnap = await db.collection('inventory_items').get();
    const itemsMap = new Map();
    itemsSnap.docs.forEach(doc => {
        const data = doc.data();
        itemsMap.set(doc.id, {
            name: data.name,
            type: data.type,
            recipeUnit: data.units?.recipeUnit ?? data.unit ?? 'unit',
            conversion: data.units?.conversion > 0 ? data.units.conversion : 1
        });
    });
    console.log(`   ✅ Loaded ${itemsMap.size} inventory items`);

    // 2. Check what audit logs already exist (to avoid duplicates)
    console.log('\n🔍 Checking existing audit logs...');
    const existingLogsSnap = await db.collection('stocktake_audit_logs').get();
    const existingSessionIds = new Set();
    existingLogsSnap.docs.forEach(doc => {
        const data = doc.data();
        existingSessionIds.add(data.sessionId);
    });
    console.log(`   ℹ️  Found ${existingLogsSnap.size} existing audit log entries`);
    console.log(`   ℹ️  Spanning ${existingSessionIds.size} unique sessions`);

    // 3. Load all COMPLETED stock_counts sessions
    console.log('\n📋 Loading completed stock count sessions...');
    const sessionsSnap = await db.collection('stock_counts')
        .where('status', '==', 'COMPLETED')
        .get();

    console.log(`   ✅ Found ${sessionsSnap.size} completed sessions`);

    // 4. Generate audit logs per session
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const sessionDoc of sessionsSnap.docs) {
        const session = sessionDoc.data();
        const sessionId = sessionDoc.id;

        // Skip if this session already has audit logs
        if (existingSessionIds.has(sessionId)) {
            console.log(`   ⏭️  Skipping session ${sessionId} (already has logs)`);
            totalSkipped++;
            continue;
        }

        const items = session.items || [];
        if (items.length === 0) {
            console.log(`   ⏭️  Skipping session ${sessionId} (no items)`);
            totalSkipped++;
            continue;
        }

        console.log(`\n   📝 Processing session ${sessionId} (${items.length} items)...`);

        const batch = db.batch();
        let batchCount = 0;

        for (const countItem of items) {
            const itemMeta = itemsMap.get(countItem.itemId);
            const conversion = itemMeta?.conversion ?? 1;
            const countedStock = (countItem.count + (countItem.partialCount || 0)) * conversion;

            const logEntry = {
                sessionId,
                businessUnitId: session.businessUnitId,
                itemId: countItem.itemId,
                itemName: countItem.itemName || itemMeta?.name || 'Unknown',
                itemType: itemMeta?.type || 'RAW_MATERIAL',
                stockBefore: 0,          // Not available for historical data
                stockAfter: countedStock,
                variance: countedStock,   // Since stockBefore = 0
                unit: itemMeta?.recipeUnit || countItem.unit || 'unit',
                countedBy: session.performedBy || 'unknown',
                countedByName: session.performedByName || 'Unknown',
                submittedAt: session.completedAt || session.updatedAt || Timestamp.now(),
                source: 'backfill',       // Marks this as retroactively generated
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            const newDocRef = db.collection('stocktake_audit_logs').doc();
            batch.set(newDocRef, logEntry);
            batchCount++;

            // Firestore batch limit is 500
            if (batchCount >= 450) {
                await batch.commit();
                console.log(`      ✓ Committed ${batchCount} log entries...`);
                totalCreated += batchCount;
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
            totalCreated += batchCount;
            console.log(`      ✅ Created ${batchCount} log entries for session ${sessionId}`);
        }
    }

    console.log('\n=================================');
    console.log(`✅ Backfill complete!`);
    console.log(`   Created: ${totalCreated} audit log entries`);
    console.log(`   Skipped: ${totalSkipped} sessions (already had logs or empty)`);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
