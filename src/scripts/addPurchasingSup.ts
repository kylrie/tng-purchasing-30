/**
 * One-time script to add PURCHASING_SUP role to Firestore config/permissions document
 * Run with: npx ts-node src/scripts/addPurchasingSup.ts
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize with default credentials (when running locally with GOOGLE_APPLICATION_CREDENTIALS)
initializeApp({
    projectId: 'tng-systems'
});

const db = getFirestore();

// PURCHASING_SUP permissions (same as PURCHASING_OFFICER)
const PURCHASING_SUP_PERMISSIONS = [
    'requisition:prepare:prf',  // Prepare PRF from approved BURF
    'requisition:create:prf',   // Create Direct PRF
    'requisition:view:all',
    'requisition:print',
    'supplier:view',
    'supplier:create',
    'supplier:edit',
    'supplier:delete',
    'liquidation:view',
    'liquidation:file:own',
    'liquidation:print',
    'module:view:dashboard',
    'module:view:burf',
    'module:view:prf',
    'module:view:approved',
    'module:view:liquidation',
    'module:view:suppliers',
    'module:view:prf_tracker',
    'inventory:manage:uom',
    'dashboard:widget:active_prfs',
    'dashboard:widget:ready_for_prf',
    'dashboard:widget:total_spend',
    'dashboard:widget:pending_audit',
    'dashboard:section:ready_for_prf_list',
    'prf_tracker:view:all',
];

async function addPurchasingSup() {
    const docRef = db.doc('config/permissions');

    try {
        // Update the document to add PURCHASING_SUP
        await docRef.update({
            'roles': FieldValue.arrayUnion('PURCHASING_SUP'),
            'permissions.PURCHASING_SUP': PURCHASING_SUP_PERMISSIONS
        });

        console.log('✅ Successfully added PURCHASING_SUP role with permissions!');
        console.log('Permissions:', PURCHASING_SUP_PERMISSIONS);
    } catch (error) {
        console.error('❌ Error adding role:', error);
    }

    process.exit(0);
}

addPurchasingSup();
