/**
 * postTransaction - Callable Cloud Function
 * 
 * Validates transactions against MONTHLY budget limits and atomically
 * updates the budget's currentSpent and weeklySpent using Firestore Transactions.
 * 
 * Features:
 * - Monthly budget validation
 * - Weekly spending breakdown tracking
 * 
 * @throws HttpsError('failed-precondition') if budget is exceeded
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';

const db = getFirestore(getApp(), 'tng-systems');

interface PostTransactionInput {
    amount: number;
    businessUnitId: string;
    coaId: string;
    date: string;
    description?: string;
}

interface WeeklySpent {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
    week5: number;
}

interface Budget {
    businessUnitId: string;
    coaId: string;
    fiscalYear: number;
    month: number;
    totalLimit: number;
    currentSpent: number;
    weeklySpent: WeeklySpent;
    currency: string;
}

/**
 * Determine week number from day of month
 * Week 1: Days 1-7
 * Week 2: Days 8-14
 * Week 3: Days 15-21
 * Week 4: Days 22-28
 * Week 5: Days 29-31
 */
function getWeekNumber(dayOfMonth: number): number {
    if (dayOfMonth <= 7) return 1;
    if (dayOfMonth <= 14) return 2;
    if (dayOfMonth <= 21) return 3;
    if (dayOfMonth <= 28) return 4;
    return 5;
}

/**
 * Get week key for weeklySpent object
 */
function getWeekKey(weekNumber: number): keyof WeeklySpent {
    return `week${weekNumber}` as keyof WeeklySpent;
}

export const postTransaction = onCall(async (request: CallableRequest<PostTransactionInput>) => {
    console.log('[postTransaction] Called with data:', JSON.stringify(request.data));

    // 1. Validate authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // 2. Validate and extract input
    const data = request.data as PostTransactionInput;
    const { amount, businessUnitId, coaId, date, description } = data;

    if (!amount || amount <= 0) {
        throw new HttpsError('invalid-argument', 'Amount must be a positive number');
    }
    if (!businessUnitId || typeof businessUnitId !== 'string') {
        throw new HttpsError('invalid-argument', 'businessUnitId is required');
    }
    if (!coaId || typeof coaId !== 'string') {
        throw new HttpsError('invalid-argument', 'coaId is required');
    }
    if (!date || typeof date !== 'string') {
        throw new HttpsError('invalid-argument', 'date is required');
    }

    // 3. Extract fiscal year, month, and day from date
    const transactionDate = new Date(date);
    if (isNaN(transactionDate.getTime())) {
        throw new HttpsError('invalid-argument', 'Invalid date format');
    }
    const fiscalYear = transactionDate.getFullYear();
    const month = transactionDate.getMonth() + 1; // JavaScript months are 0-indexed
    const dayOfMonth = transactionDate.getDate();
    const weekNumber = getWeekNumber(dayOfMonth);
    const weekKey = getWeekKey(weekNumber);

    // 4. Build composite budget document ID (includes month)
    const monthStr = month.toString().padStart(2, '0');
    const budgetId = `${businessUnitId}_${coaId}_${fiscalYear}_${monthStr}`;

    // 5. Use Firestore Transaction for atomic read-check-write
    try {
        const result = await db.runTransaction(async (transaction) => {
            const budgetRef = db.collection('budgets').doc(budgetId);
            const budgetDoc = await transaction.get(budgetRef);

            // Check if budget exists
            if (!budgetDoc.exists) {
                throw new HttpsError(
                    'not-found',
                    `No budget found for ${businessUnitId}/${coaId} in ${monthStr}/${fiscalYear}`
                );
            }

            const budget = budgetDoc.data() as Budget;
            const newSpent = budget.currentSpent + amount;

            // 6. Check if transaction would exceed budget limit
            if (newSpent > budget.totalLimit) {
                const remaining = budget.totalLimit - budget.currentSpent;
                throw new HttpsError(
                    'failed-precondition',
                    `Budget Exceeded. Limit: ${budget.currency} ${budget.totalLimit.toLocaleString()}, ` +
                    `Spent: ${budget.currency} ${budget.currentSpent.toLocaleString()}, ` +
                    `Remaining: ${budget.currency} ${remaining.toLocaleString()}, ` +
                    `Requested: ${budget.currency} ${amount.toLocaleString()}`
                );
            }

            // 7. Calculate new weekly spent
            const currentWeeklySpent = budget.weeklySpent || {
                week1: 0, week2: 0, week3: 0, week4: 0, week5: 0
            };
            const newWeeklySpent = {
                ...currentWeeklySpent,
                [weekKey]: (currentWeeklySpent[weekKey] || 0) + amount,
            };

            // 8. All checks passed - update budget and create transaction atomically
            const transactionRef = db.collection('transactions').doc();

            // Update budget's currentSpent and weeklySpent
            transaction.update(budgetRef, {
                currentSpent: newSpent,
                weeklySpent: newWeeklySpent,
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Create the transaction document
            transaction.set(transactionRef, {
                amount,
                businessUnitId,
                coaId,
                date,
                description: description || '',
                budgetId,
                weekNumber,
                createdBy: request.auth!.uid,
                createdAt: FieldValue.serverTimestamp(),
            });

            return {
                transactionId: transactionRef.id,
                newSpent,
                remaining: budget.totalLimit - newSpent,
                currency: budget.currency,
                weekNumber,
            };
        });

        return {
            success: true,
            transactionId: result.transactionId,
            newBalance: result.remaining,
            weekNumber: result.weekNumber,
            message: `Transaction recorded (Week ${result.weekNumber}). Remaining budget: ${result.currency} ${result.remaining.toLocaleString()}`,
        };

    } catch (error) {
        // Re-throw HttpsError as-is
        if (error instanceof HttpsError) {
            throw error;
        }
        // Wrap other errors
        console.error('postTransaction error:', error);
        throw new HttpsError('internal', 'Failed to process transaction');
    }
});
