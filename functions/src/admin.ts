/**
 * setBudgetLimit - Callable Cloud Function (RBAC Protected)
 * 
 * Allows FINANCE_HEAD or SUPER_ADMIN users to create or update
 * MONTHLY budget limits for Business Unit + COA combinations.
 * 
 * Features:
 * - Monthly budget limits (not annual)
 * - Weekly spending breakdown tracking
 * 
 * Security: Checks user role from Firestore (not custom claims)
 * to match the existing auth pattern in the application.
 * 
 * @throws HttpsError('permission-denied') if user is not authorized
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

interface SetBudgetLimitInput {
    businessUnitId: string;
    coaId: string;
    limitAmount: number;
    fiscalYear: number;
    month: number;  // 1-12
    currency?: string;
}

interface WeeklySpent {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
    week5: number;
}

interface FirestoreUser {
    role: string;
    name: string;
    email: string;
}

/**
 * Roles authorized to manage budgets
 */
const AUTHORIZED_ROLES = ['FINANCE_HEAD', 'SUPER_ADMIN'];

/**
 * Create empty weekly spent object
 */
function createEmptyWeeklySpent(): WeeklySpent {
    return {
        week1: 0,
        week2: 0,
        week3: 0,
        week4: 0,
        week5: 0,
    };
}

export const setBudgetLimit = onCall(async (request: CallableRequest<SetBudgetLimitInput>) => {
    // 1. Validate authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = request.auth.uid;

    // 2. Fetch user role from Firestore (matches existing app pattern)
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found');
    }

    const userData = userDoc.data() as FirestoreUser;
    const userRole = userData.role;

    // 3. RBAC Check - Only FINANCE_HEAD or SUPER_ADMIN can set budget limits
    if (!AUTHORIZED_ROLES.includes(userRole)) {
        throw new HttpsError(
            'permission-denied',
            `Only ${AUTHORIZED_ROLES.join(' or ')} can set budget limits. Your role: ${userRole}`
        );
    }

    // 4. Validate input
    const data = request.data as SetBudgetLimitInput;
    const { businessUnitId, coaId, limitAmount, fiscalYear, month, currency } = data;

    if (!businessUnitId || typeof businessUnitId !== 'string') {
        throw new HttpsError('invalid-argument', 'businessUnitId is required');
    }
    if (!coaId || typeof coaId !== 'string') {
        throw new HttpsError('invalid-argument', 'coaId is required');
    }
    if (limitAmount === undefined || typeof limitAmount !== 'number') {
        throw new HttpsError('invalid-argument', 'limitAmount is required and must be a number');
    }
    if (limitAmount < 0) {
        throw new HttpsError('invalid-argument', 'limitAmount must be zero or positive');
    }
    if (!fiscalYear || typeof fiscalYear !== 'number' || fiscalYear < 2000 || fiscalYear > 2100) {
        throw new HttpsError('invalid-argument', 'fiscalYear must be a valid year (2000-2100)');
    }
    if (!month || typeof month !== 'number' || month < 1 || month > 12) {
        throw new HttpsError('invalid-argument', 'month must be between 1 and 12');
    }

    // 5. Build composite document ID (includes month)
    const monthStr = month.toString().padStart(2, '0');
    const budgetId = `${businessUnitId}_${coaId}_${fiscalYear}_${monthStr}`;
    const budgetRef = db.collection('budgets').doc(budgetId);

    try {
        // 6. Check if budget already exists
        const existingDoc = await budgetRef.get();
        const isUpdate = existingDoc.exists;

        if (isUpdate) {
            // Update existing budget - preserve currentSpent and weeklySpent
            const existingData = existingDoc.data()!;

            // Validate: new limit should not be less than current spent
            if (limitAmount < existingData.currentSpent) {
                throw new HttpsError(
                    'failed-precondition',
                    `Cannot set limit (${limitAmount}) below current spent amount (${existingData.currentSpent})`
                );
            }

            await budgetRef.update({
                totalLimit: limitAmount,
                currency: currency || existingData.currency || 'PHP',
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: uid,
            });
        } else {
            // Create new monthly budget with weekly breakdown
            await budgetRef.set({
                businessUnitId,
                coaId,
                fiscalYear,
                month,
                totalLimit: limitAmount,
                currentSpent: 0,
                weeklySpent: createEmptyWeeklySpent(),
                currency: currency || 'PHP',
                createdAt: FieldValue.serverTimestamp(),
                createdBy: uid,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: uid,
            });
        }

        return {
            success: true,
            budgetId,
            action: isUpdate ? 'updated' : 'created',
            message: `Monthly budget ${isUpdate ? 'updated' : 'created'} successfully for ${monthStr}/${fiscalYear}`,
        };

    } catch (error) {
        // Re-throw HttpsError as-is
        if (error instanceof HttpsError) {
            throw error;
        }
        // Wrap other errors
        console.error('setBudgetLimit error:', error);
        throw new HttpsError('internal', 'Failed to set budget limit');
    }
});
