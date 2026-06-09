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
    'procurement:prf:create:from_burf',  // Prepare PRF from approved BURF
    'procurement:prf:create:direct',   // Create Direct PRF
    'procurement:burf:view:all',
    'procurement:burf:print',
    'master_data:supplier:view:all',
    'master_data:supplier:create',
    'master_data:supplier:edit',
    'master_data:supplier:delete',
    'finance:liquidation:view:all',
    'finance:liquidation:create:own',
    'finance:liquidation:print',
    'ui:module_access:view:dashboard',
    'ui:module_access:view:burf',
    'ui:module_access:view:prf',
    'ui:module_access:view:approved',
    'ui:module_access:view:liquidation',
    'ui:module_access:view:suppliers',
    'ui:module_access:view:prf_tracker',
    'inventory:uom:edit',
    'ui:widget:view:active_prfs',
    'ui:widget:view:ready_for_prf',
    'ui:widget:view:total_spend',
    'ui:widget:view:pending_audit',
    'ui:section:view:ready_for_prf_list',
    'ui:module_access:view:prf_tracker',
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
