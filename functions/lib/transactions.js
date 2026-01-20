"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.postTransaction = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
/**
 * Determine week number from day of month
 * Week 1: Days 1-7
 * Week 2: Days 8-14
 * Week 3: Days 15-21
 * Week 4: Days 22-28
 * Week 5: Days 29-31
 */
function getWeekNumber(dayOfMonth) {
    if (dayOfMonth <= 7)
        return 1;
    if (dayOfMonth <= 14)
        return 2;
    if (dayOfMonth <= 21)
        return 3;
    if (dayOfMonth <= 28)
        return 4;
    return 5;
}
/**
 * Get week key for weeklySpent object
 */
function getWeekKey(weekNumber) {
    return `week${weekNumber}`;
}
exports.postTransaction = (0, https_1.onCall)(async (request) => {
    // 1. Validate authentication
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // 2. Validate and extract input
    const data = request.data;
    const { amount, businessUnitId, coaId, date, description } = data;
    if (!amount || amount <= 0) {
        throw new https_1.HttpsError('invalid-argument', 'Amount must be a positive number');
    }
    if (!businessUnitId || typeof businessUnitId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'businessUnitId is required');
    }
    if (!coaId || typeof coaId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'coaId is required');
    }
    if (!date || typeof date !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'date is required');
    }
    // 3. Extract fiscal year, month, and day from date
    const transactionDate = new Date(date);
    if (isNaN(transactionDate.getTime())) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid date format');
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
                throw new https_1.HttpsError('not-found', `No budget found for ${businessUnitId}/${coaId} in ${monthStr}/${fiscalYear}`);
            }
            const budget = budgetDoc.data();
            const newSpent = budget.currentSpent + amount;
            // 6. Check if transaction would exceed budget limit
            if (newSpent > budget.totalLimit) {
                const remaining = budget.totalLimit - budget.currentSpent;
                throw new https_1.HttpsError('failed-precondition', `Budget Exceeded. Limit: ${budget.currency} ${budget.totalLimit.toLocaleString()}, ` +
                    `Spent: ${budget.currency} ${budget.currentSpent.toLocaleString()}, ` +
                    `Remaining: ${budget.currency} ${remaining.toLocaleString()}, ` +
                    `Requested: ${budget.currency} ${amount.toLocaleString()}`);
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
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
                createdBy: request.auth.uid,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
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
    }
    catch (error) {
        // Re-throw HttpsError as-is
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        // Wrap other errors
        console.error('postTransaction error:', error);
        throw new https_1.HttpsError('internal', 'Failed to process transaction');
    }
});
//# sourceMappingURL=transactions.js.map