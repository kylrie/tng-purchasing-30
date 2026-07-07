/**
 * Shared helpers for the QR handler integration tests (Sprint 1).
 */

import assert from 'node:assert/strict';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { FakeFirestore } from './fakeFirestore';

/** Cast the in-memory fake to the Firestore type the handlers expect. */
export function asDb(fake: FakeFirestore): Firestore {
    return fake as unknown as Firestore;
}

/** Build a minimal CallableRequest; pass `uid` for an authenticated caller. */
export function req<T>(data: T, uid?: string): CallableRequest<T> {
    const auth = uid ? { uid, token: {} } : undefined;
    return { data, auth, rawRequest: {}, acceptsStreaming: false } as unknown as CallableRequest<T>;
}

/** Assert an async fn rejects with a specific HttpsError code. */
export async function expectReject(fn: () => Promise<unknown>, code: string): Promise<void> {
    let threw = false;
    let actualCode: unknown;
    let message = '';
    try {
        await fn();
    } catch (e) {
        threw = true;
        actualCode = (e as { code?: unknown }).code;
        message = (e as { message?: string }).message ?? '';
    }
    assert.equal(threw, true, 'expected the call to throw');
    assert.equal(actualCode, code, `expected error code "${code}", got "${String(actualCode)}" (${message})`);
}
