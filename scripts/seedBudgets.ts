/**
 * Seed Budgets Script
 * 
 * Populates the Firestore database with mock budget data for testing.
 * Creates two Business Units (IT, Sales) with budgets for "Software Subscription" COA.
 * 
 * Usage: npx ts-node scripts/seedBudgets.ts
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as serviceAccount from '../firebase-adminsdk.json';

// Initialize Firebase Admin
initializeApp({
    credential: cert(serviceAccount as ServiceAccount)
});

const db = getFirestore();

// Configuration
const FISCAL_YEAR = 2026;
const COA_ID = 'software-subscription';
const COA_NAME = 'Software Subscription';

// Mock Business Units
const businessUnits = [
    { id: 'IT', name: 'Information Technology' },
    { id: 'Sales', name: 'Sales Department' },
];

// Budget configurations
const budgets = [
    {
        businessUnitId: 'IT',
        coaId: COA_ID,
        fiscalYear: FISCAL_YEAR,
        totalLimit: 5000,
        currentSpent: 0,
        currency: 'USD',
    },
    {
        businessUnitId: 'Sales',
        coaId: COA_ID,
        fiscalYear: FISCAL_YEAR,
        totalLimit: 10000,
        currentSpent: 0,
        currency: 'USD',
    },
];

// COA entry for "Software Subscription"
const coaEntry = {
    code: COA_ID,
    name: COA_NAME,
    parentId: '',
    classification: 'Operating Expense',
    financialStatement: 'Income Statement',
    accountType: 'Expenses',
    cashFlowClassification: 'Operating',
    isActive: true,
};

async function seedBusinessUnits() {
    console.log('\n📦 Seeding Business Units...');

    for (const bu of businessUnits) {
        try {
            await db.collection('businesses').doc(bu.id).set({
                name: bu.name,
                currency: 'USD',
                address: '',
                tin: '',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`   ✓ ${bu.id}: ${bu.name}`);
        } catch (error) {
            console.error(`   ✗ Failed to create ${bu.id}:`, error);
        }
    }
}

async function seedCOA() {
    console.log('\n📊 Seeding Chart of Account...');

    try {
        await db.collection('chart_of_accounts').doc(coaEntry.code).set(coaEntry, { merge: true });
        console.log(`   ✓ ${coaEntry.code}: ${coaEntry.name}`);
    } catch (error) {
        console.error(`   ✗ Failed to create COA:`, error);
    }
}

async function seedBudgets() {
    console.log('\n💰 Seeding Budgets...');

    for (const budget of budgets) {
        const budgetId = `${budget.businessUnitId}_${budget.coaId}_${budget.fiscalYear}`;

        try {
            await db.collection('budgets').doc(budgetId).set({
                ...budget,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: 'seed-script',
                updatedBy: 'seed-script',
            });
            console.log(`   ✓ ${budgetId}: $${budget.totalLimit.toLocaleString()} ${budget.currency}`);
        } catch (error) {
            console.error(`   ✗ Failed to create budget ${budgetId}:`, error);
        }
    }
}

async function main() {
    console.log('🚀 Budget Seed Script Started');
    console.log('================================');
    console.log(`Fiscal Year: ${FISCAL_YEAR}`);
    console.log(`COA: ${COA_NAME} (${COA_ID})`);

    await seedBusinessUnits();
    await seedCOA();
    await seedBudgets();

    console.log('\n================================');
    console.log('✅ Seed script completed!');
    console.log('\nSummary:');
    console.log(`- IT Department: $5,000 budget for ${COA_NAME}`);
    console.log(`- Sales Department: $10,000 budget for ${COA_NAME}`);
    console.log('\nYou can now test the Budget Control System.');
}

main().catch((error) => {
    console.error('❌ Seed script failed:', error);
    process.exit(1);
});
