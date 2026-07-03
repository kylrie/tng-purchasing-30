/**
 * Firestore RULES tests — QR collections (Sprint 1 · items 3-rules & 4).
 *
 * ⚠️ REQUIRES THE FIRESTORE EMULATOR (Java). This does NOT run in a plain
 * Node/tsx process and is NOT part of the default `npm test`. Enable in CI:
 *
 *   cd functions
 *   npm i -D @firebase/rules-unit-testing firebase
 *   npm run test:emulator      # firebase emulators:exec wraps this file
 *
 * It validates the rules in firestore.rules (shared across the (default) and
 * tng-systems databases) against the emulator's default database:
 *   - M4: qr_orders reads are business-unit scoped.
 *   - M3: qr_tables direct reads are admin-only (so qrToken is not broadly
 *         exposed to general/PENDING staff).
 *
 * NOTE: `@firebase/rules-unit-testing` and `firebase` are intentionally NOT
 * installed in this repo's default dev deps (they are heavy and only needed for
 * emulator runs). Install them in the CI job that runs the emulator.
 */

// @ts-nocheck — deps are installed only in the emulator CI job; skip local typecheck.
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

before(async () => {
    env = await initializeTestEnvironment({
        projectId: 'demo-tng-qr',
        firestore: {
            rules: readFileSync(new URL('../../../../firestore.rules', import.meta.url), 'utf8'),
            host: '127.0.0.1',
            port: 8080,
        },
    });

    // Seed users + data with rules disabled (admin-like context).
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'users', 'emp-bu1'), { role: 'EMPLOYEE', businessId: 'bu1' });
        await setDoc(doc(db, 'users', 'emp-bu2'), { role: 'EMPLOYEE', businessId: 'bu2' });
        await setDoc(doc(db, 'users', 'admin'), { role: 'ADMIN' });
        await setDoc(doc(db, 'qr_orders', 'o-bu1'), { businessUnitId: 'bu1', orderNumber: 'QR-00001', customerName: 'Ana' });
        await setDoc(doc(db, 'qr_orders', 'o-bu2'), { businessUnitId: 'bu2', orderNumber: 'QR-00002' });
        await setDoc(doc(db, 'qr_tables', 't1'), { businessUnitId: 'bu1', tableNumber: '12', qrToken: 'SECRET', isActive: true });
    });
});

after(async () => { await env.cleanup(); });

// ── item 4: qr_orders BU-scoped reads ────────────────────────────────────
test('qr_orders: a user can read an order in their OWN business unit', async () => {
    const db = env.authenticatedContext('emp-bu1').firestore();
    await assertSucceeds(getDoc(doc(db, 'qr_orders', 'o-bu1')));
});

test('qr_orders: a user CANNOT read an order from ANOTHER business unit', async () => {
    const db = env.authenticatedContext('emp-bu1').firestore();
    await assertFails(getDoc(doc(db, 'qr_orders', 'o-bu2')));
});

test('qr_orders: ADMIN can read across business units', async () => {
    const db = env.authenticatedContext('admin').firestore();
    await assertSucceeds(getDoc(doc(db, 'qr_orders', 'o-bu2')));
});

test('qr_orders: no client can WRITE directly (write: if false)', async () => {
    const db = env.authenticatedContext('admin').firestore();
    await assertFails(setDoc(doc(db, 'qr_orders', 'hack'), { businessUnitId: 'bu1' }));
});

// ── item 3 (rules half): qr_tables direct reads are admin-only ───────────
test('qr_tables: a normal employee CANNOT directly read a table (qrToken hidden)', async () => {
    const db = env.authenticatedContext('emp-bu1').firestore();
    await assertFails(getDoc(doc(db, 'qr_tables', 't1')));
});

test('qr_tables: ADMIN can directly read a table', async () => {
    const db = env.authenticatedContext('admin').firestore();
    await assertSucceeds(getDoc(doc(db, 'qr_tables', 't1')));
});

test('qr_tables: no client can WRITE directly (write: if false)', async () => {
    const db = env.authenticatedContext('admin').firestore();
    await assertFails(setDoc(doc(db, 'qr_tables', 'hack'), { qrToken: 'x' }));
});
