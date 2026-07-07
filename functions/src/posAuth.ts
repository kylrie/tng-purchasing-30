import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';
import * as crypto from 'crypto';

const db = getFirestore(getApp(), 'tng-systems');

/**
 * Generates a salted scrypt hash for the given PIN.
 */
function hashPin(pin: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    // Using scrypt for memory-hard hashing
    const hash = crypto.scryptSync(pin, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

/**
 * Verifies a PIN against a stored salted hash.
 */
function verifyPinHash(pin: string, storedHash: string): boolean {
    try {
        const parts = storedHash.split(':');
        if (parts.length !== 2) return false;
        const [salt, key] = parts;
        const hashBuffer = crypto.scryptSync(pin, salt, 64);
        const keyBuffer = Buffer.from(key, 'hex');
        return crypto.timingSafeEqual(hashBuffer, keyBuffer);
    } catch (error) {
        console.error('Error verifying PIN hash:', error);
        return false;
    }
}

/**
 * Set POS PIN for a user or the global super admin.
 * Requires the caller to be an admin or the user themselves (if setting their own PIN).
 */
export const setPosPin = onCall(async (request: CallableRequest<{ userId: string; pin: string; isSuperAdmin?: boolean }>) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to set a PIN.');
    }

    const { userId, pin, isSuperAdmin } = request.data;

    // Check if we are clearing the PIN
    if (pin === '') {
        try {
            if (isSuperAdmin) {
                const settingsRef = db.collection('settings').doc('pos');
                await settingsRef.set({
                    superAdminPinHash: '',
                    superAdminPin: '', // clear legacy
                    lastUpdated: new Date().toISOString(),
                    updatedBy: request.auth.uid
                }, { merge: true });
            } else {
                if (!userId) {
                    throw new HttpsError('invalid-argument', 'userId is required.');
                }
                const userRef = db.collection('users').doc(userId);
                await userRef.update({
                    posPinHash: '',
                    posPin: '' // clear legacy
                });
            }
            return { success: true };
        } catch (error) {
            console.error('Error clearing PIN:', error);
            throw new HttpsError('internal', 'Failed to clear PIN.');
        }
    }

    if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
        throw new HttpsError('invalid-argument', 'PIN must be exactly 4 digits.');
    }

    const hashedPin = hashPin(pin);

    try {
        if (isSuperAdmin) {
            // Store as superAdminPinHash in settings
            const settingsRef = db.collection('settings').doc('pos');
            await settingsRef.set({
                superAdminPinHash: hashedPin,
                superAdminPin: '', // clear legacy
                lastUpdated: new Date().toISOString(),
                updatedBy: request.auth.uid
            }, { merge: true });
        } else {
            if (!userId) {
                throw new HttpsError('invalid-argument', 'userId is required.');
            }
            // Store as posPinHash in users
            const userRef = db.collection('users').doc(userId);
            await userRef.update({
                posPinHash: hashedPin,
                posPin: '' // clear legacy
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Error setting PIN:', error);
        throw new HttpsError('internal', 'Failed to set PIN.');
    }
});

/**
 * Verify a POS PIN to allow access to POS functions.
 * Validates against both the specified user's PIN and the super admin PIN.
 */
export const verifyPosPin = onCall(async (request: CallableRequest<{ pin: string }>) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in to verify PIN.');
    }

    const { pin } = request.data;
    if (!pin || pin.length !== 4) {
        throw new HttpsError('invalid-argument', 'Invalid PIN format.');
    }

    try {
        // 1. Check Global Super Admin PIN
        const settingsDoc = await db.collection('settings').doc('pos').get();
        if (settingsDoc.exists) {
            const data = settingsDoc.data();
            if (data?.superAdminPinHash) {
                if (verifyPinHash(pin, data.superAdminPinHash)) {
                    return { success: true, role: 'SUPER_ADMIN' };
                }
            } else if (data?.superAdminPin) {
                // Fallback for legacy plaintext PIN
                if (data.superAdminPin === pin) {
                    return { success: true, role: 'SUPER_ADMIN' };
                }
            }
        }

        // 2. Check all users to find who this PIN belongs to
        // Note: For a 4-digit PIN, querying all users and checking hashes might be slow
        // if there are thousands of users, but typical POS systems have < 100 users.
        const usersSnapshot = await db.collection('users').get();
        
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            if (userData.posPinHash) {
                if (verifyPinHash(pin, userData.posPinHash)) {
                    return { success: true, user: { ...userData, id: doc.id } };
                }
            } else if (userData.posPin) {
                // Fallback for legacy plaintext PIN
                if (userData.posPin === pin) {
                    return { success: true, user: { ...userData, id: doc.id } };
                }
            }
        }

        return { success: false, message: 'Invalid PIN' };
    } catch (error) {
        console.error('Error in verifyPosPin:', error);
        throw new HttpsError('internal', 'An error occurred while verifying the PIN.');
    }
});
