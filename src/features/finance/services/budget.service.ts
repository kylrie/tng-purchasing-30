/**
 * Budget Service
 * 
 * Provides functions for budget management during the requisition workflow:
 * - Check budget availability
 * - Reserve budget on approval
 * - Release budget on rejection/cancellation
 * - Commit budget on fund release
 * 
 * BUDGET WORKFLOW:
 * 1. PENDING: Budget check only, no reservation
 * 2. RESERVED: On BURF approval, budget is reserved (soft hold)
 * 3. COMMITTED: On fund release, budget is permanently committed
 * 4. RELEASED: On rejection/cancellation, reservation is released
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    runTransaction,
    query,
    where,
    Timestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { COLLECTIONS } from '../../../shared/types/firebase.types';

// ============================================================
// TYPES
// ============================================================

export interface Budget {
    id: string;
    businessUnitId: string;
    coaId: string;
    fiscalYear: number;
    totalLimit: number;
    currentSpent: number;
    reserved: number; // Amount currently reserved but not yet spent
    currency: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface BudgetCheckResult {
    isAvailable: boolean;
    coaCode: string;
    coaName?: string;
    totalLimit: number;
    currentSpent: number;
    reserved: number;
    available: number; // totalLimit - currentSpent - reserved
    requestedAmount: number;
    shortfall: number; // How much over budget (0 if available)
    percentage: number; // Current utilization percentage
}

export interface BudgetReservation {
    id: string;
    requisitionId: string;
    businessUnitId: string;
    coaCode: string;
    amount: number;
    status: 'RESERVED' | 'COMMITTED' | 'RELEASED';
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

export interface BudgetCheckRequest {
    businessUnitId: string;
    items: Array<{
        coaCode: string;
        amount: number;
    }>;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get the current fiscal year (can be configured)
 */
const getCurrentFiscalYear = (): number => {
    return new Date().getFullYear();
};

/**
 * Generate a unique budget reservation ID
 */
const generateReservationId = (): string => {
    return `BRV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
};

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Get budgeted COAs for a Business Unit
 * Returns COAs that have budget limits set for the current fiscal year
 * @param businessUnitId - The business unit to get budgets for
 * @param month - Optional month (1-12) to filter by specific budget month (for Date Needed feature)
 */
export async function getBudgetedCOAs(businessUnitId: string, month?: number): Promise<Array<{
    code: string;
    name: string;
    available: number;
    totalLimit: number;
    percentage: number;
}>> {
    const fiscalYear = getCurrentFiscalYear();

    // Build base query
    let budgetsQuery = query(
        collection(db, COLLECTIONS.BUDGETS),
        where('businessUnitId', '==', businessUnitId),
        where('fiscalYear', '==', fiscalYear)
    );

    const budgetsSnapshot = await getDocs(budgetsQuery);
    const budgetedCoaCodes = new Set<string>();
    const budgetMap = new Map<string, { totalLimit: number; currentSpent: number; reserved: number }>();

    budgetsSnapshot.docs.forEach(doc => {
        const data = doc.data();

        // Filter by month if specified (for Date Needed feature)
        // Budget doc IDs are: {businessId}_{coaId}_{year}_{month}
        if (month) {
            const monthFromDoc = data.month || parseInt(doc.id.split('_').pop() || '0', 10);
            if (monthFromDoc !== month) return; // Skip if month doesn't match
        }

        if (data.totalLimit > 0) {
            budgetedCoaCodes.add(data.coaId);
            budgetMap.set(data.coaId, {
                totalLimit: data.totalLimit || 0,
                currentSpent: data.currentSpent || 0,
                reserved: data.reserved || 0
            });
        }
    });

    if (budgetedCoaCodes.size === 0) {
        return [];
    }

    // Get COA details
    const coaSnapshot = await getDocs(collection(db, COLLECTIONS.CHART_OF_ACCOUNTS));
    const budgetedCOAs: Array<{
        code: string;
        name: string;
        available: number;
        totalLimit: number;
        percentage: number;
    }> = [];

    coaSnapshot.docs.forEach(doc => {
        if (budgetedCoaCodes.has(doc.id)) {
            const coaData = doc.data();
            const budget = budgetMap.get(doc.id)!;
            const available = budget.totalLimit - budget.currentSpent - budget.reserved;
            const percentage = budget.totalLimit > 0
                ? Math.round(((budget.currentSpent + budget.reserved) / budget.totalLimit) * 100)
                : 0;

            budgetedCOAs.push({
                code: doc.id,
                name: coaData.name || doc.id,
                available,
                totalLimit: budget.totalLimit,
                percentage
            });
        }
    });

    // Sort by available budget descending
    budgetedCOAs.sort((a, b) => b.available - a.available);

    return budgetedCOAs;
}

/**
 * Check budget availability for a set of items
 * Does NOT create any reservations - just checks if budget is available
 */
export async function checkBudgetAvailability(
    request: BudgetCheckRequest
): Promise<BudgetCheckResult[]> {
    const { businessUnitId, items } = request;
    const fiscalYear = getCurrentFiscalYear();
    const results: BudgetCheckResult[] = [];

    // Group items by COA
    const coaAmounts = new Map<string, number>();
    items.forEach(item => {
        if (item.coaCode) {
            const current = coaAmounts.get(item.coaCode) || 0;
            coaAmounts.set(item.coaCode, current + item.amount);
        }
    });

    // Check each COA
    for (const [coaCode, requestedAmount] of coaAmounts) {
        // Find the budget for this COA and BU
        const budgetQuery = query(
            collection(db, COLLECTIONS.BUDGETS),
            where('businessUnitId', '==', businessUnitId),
            where('coaId', '==', coaCode),
            where('fiscalYear', '==', fiscalYear)
        );

        const budgetSnapshot = await getDocs(budgetQuery);

        if (budgetSnapshot.empty) {
            // No budget set for this COA
            results.push({
                isAvailable: false,
                coaCode,
                totalLimit: 0,
                currentSpent: 0,
                reserved: 0,
                available: 0,
                requestedAmount,
                shortfall: requestedAmount,
                percentage: 0
            });
            continue;
        }

        const budgetDoc = budgetSnapshot.docs[0];
        const budget = budgetDoc.data();
        const totalLimit = budget.totalLimit || 0;
        const currentSpent = budget.currentSpent || 0;
        const reserved = budget.reserved || 0;
        const available = totalLimit - currentSpent - reserved;
        const percentage = totalLimit > 0
            ? Math.round(((currentSpent + reserved) / totalLimit) * 100)
            : 0;

        const isAvailable = available >= requestedAmount;
        const shortfall = isAvailable ? 0 : requestedAmount - available;

        // Get COA name
        let coaName: string | undefined;
        try {
            const coaDoc = await getDoc(doc(db, COLLECTIONS.CHART_OF_ACCOUNTS, coaCode));
            if (coaDoc.exists()) {
                coaName = coaDoc.data().name;
            }
        } catch {
            // Ignore COA lookup errors
        }

        results.push({
            isAvailable,
            coaCode,
            coaName,
            totalLimit,
            currentSpent,
            reserved,
            available,
            requestedAmount,
            shortfall,
            percentage
        });
    }

    return results;
}

/**
 * Reserve budget for approved requisition items
 * Creates a soft hold on the budget amount
 * 
 * @param requisitionId - The requisition ID
 * @param businessUnitId - Business unit for the budget
 * @param items - Items with COA codes and amounts
 * @param userId - User making the reservation
 * @returns Reservation ID if successful
 */
export async function reserveBudget(
    requisitionId: string,
    businessUnitId: string,
    items: Array<{ coaCode?: string; amount: number }>,
    userId: string
): Promise<string | null> {
    const fiscalYear = getCurrentFiscalYear();

    // Filter items with COA codes and group by COA
    const coaAmounts = new Map<string, number>();
    items.forEach(item => {
        if (item.coaCode) {
            const current = coaAmounts.get(item.coaCode) || 0;
            coaAmounts.set(item.coaCode, current + item.amount);
        }
    });

    if (coaAmounts.size === 0) {
        console.log('No items with COA codes to reserve budget for');
        return null;
    }

    const reservationId = generateReservationId();
    const now = new Date().toISOString();

    try {
        await runTransaction(db, async (transaction) => {
            // Update budget reserved amounts for each COA
            for (const [coaCode, amount] of coaAmounts) {
                const budgetQuery = query(
                    collection(db, COLLECTIONS.BUDGETS),
                    where('businessUnitId', '==', businessUnitId),
                    where('coaId', '==', coaCode),
                    where('fiscalYear', '==', fiscalYear)
                );

                const budgetSnapshot = await getDocs(budgetQuery);

                if (!budgetSnapshot.empty) {
                    const budgetDocRef = budgetSnapshot.docs[0].ref;
                    const budgetData = budgetSnapshot.docs[0].data();
                    const currentReserved = budgetData.reserved || 0;

                    transaction.update(budgetDocRef, {
                        reserved: currentReserved + amount,
                        updatedAt: Timestamp.now()
                    });
                }
            }

            // Create reservation record
            const reservationRef = doc(collection(db, COLLECTIONS.BUDGET_RESERVATIONS || 'budgetReservations'));
            const totalAmount = Array.from(coaAmounts.values()).reduce((sum, amt) => sum + amt, 0);

            const reservation: Omit<BudgetReservation, 'id'> = {
                requisitionId,
                businessUnitId,
                coaCode: Array.from(coaAmounts.keys()).join(','), // Multiple COAs
                amount: totalAmount,
                status: 'RESERVED',
                createdAt: now,
                updatedAt: now,
                createdBy: userId
            };

            transaction.set(reservationRef, { id: reservationId, ...reservation });
        });

        console.log(`Budget reserved: ${reservationId} for requisition ${requisitionId}`);
        return reservationId;
    } catch (error) {
        console.error('Error reserving budget:', error);
        throw error;
    }
}

/**
 * Release a budget reservation (on rejection or cancellation)
 * Frees up the reserved amount
 */
export async function releaseBudget(
    requisitionId: string,
    reason: string = 'Released'
): Promise<void> {
    const fiscalYear = getCurrentFiscalYear();

    try {
        // Find reservation for this requisition
        const reservationQuery = query(
            collection(db, COLLECTIONS.BUDGET_RESERVATIONS || 'budgetReservations'),
            where('requisitionId', '==', requisitionId),
            where('status', '==', 'RESERVED')
        );

        const reservationSnapshot = await getDocs(reservationQuery);

        if (reservationSnapshot.empty) {
            console.log(`No active reservation found for requisition ${requisitionId}`);
            return;
        }

        await runTransaction(db, async (transaction) => {
            for (const reservationDoc of reservationSnapshot.docs) {
                const reservation = reservationDoc.data() as BudgetReservation;
                const coaCodes = reservation.coaCode.split(',');
                const amountPerCoa = reservation.amount / coaCodes.length; // Simplified distribution

                // Release budget for each COA
                for (const coaCode of coaCodes) {
                    const budgetQuery = query(
                        collection(db, COLLECTIONS.BUDGETS),
                        where('businessUnitId', '==', reservation.businessUnitId),
                        where('coaId', '==', coaCode.trim()),
                        where('fiscalYear', '==', fiscalYear)
                    );

                    const budgetSnapshot = await getDocs(budgetQuery);

                    if (!budgetSnapshot.empty) {
                        const budgetDocRef = budgetSnapshot.docs[0].ref;
                        const budgetData = budgetSnapshot.docs[0].data();
                        const currentReserved = budgetData.reserved || 0;

                        transaction.update(budgetDocRef, {
                            reserved: Math.max(0, currentReserved - amountPerCoa),
                            updatedAt: Timestamp.now()
                        });
                    }
                }

                // Update reservation status
                transaction.update(reservationDoc.ref, {
                    status: 'RELEASED',
                    updatedAt: new Date().toISOString(),
                    releaseReason: reason
                });
            }
        });

        console.log(`Budget released for requisition ${requisitionId}`);
    } catch (error) {
        console.error('Error releasing budget:', error);
        throw error;
    }
}

/**
 * Commit budget on fund release
 * Moves reserved amount to spent (permanent deduction)
 */
export async function commitBudget(
    requisitionId: string,
    actualAmount?: number // Optional: actual amount if different from reserved
): Promise<void> {
    const fiscalYear = getCurrentFiscalYear();

    try {
        // Find reservation for this requisition
        const reservationQuery = query(
            collection(db, COLLECTIONS.BUDGET_RESERVATIONS || 'budgetReservations'),
            where('requisitionId', '==', requisitionId),
            where('status', '==', 'RESERVED')
        );

        const reservationSnapshot = await getDocs(reservationQuery);

        if (reservationSnapshot.empty) {
            console.log(`No active reservation found for requisition ${requisitionId}`);
            return;
        }

        await runTransaction(db, async (transaction) => {
            for (const reservationDoc of reservationSnapshot.docs) {
                const reservation = reservationDoc.data() as BudgetReservation;
                const coaCodes = reservation.coaCode.split(',');
                const commitAmount = actualAmount ?? reservation.amount;
                const amountPerCoa = commitAmount / coaCodes.length;
                const reservedAmountPerCoa = reservation.amount / coaCodes.length;

                // Commit budget for each COA
                for (const coaCode of coaCodes) {
                    const budgetQuery = query(
                        collection(db, COLLECTIONS.BUDGETS),
                        where('businessUnitId', '==', reservation.businessUnitId),
                        where('coaId', '==', coaCode.trim()),
                        where('fiscalYear', '==', fiscalYear)
                    );

                    const budgetSnapshot = await getDocs(budgetQuery);

                    if (!budgetSnapshot.empty) {
                        const budgetDocRef = budgetSnapshot.docs[0].ref;
                        const budgetData = budgetSnapshot.docs[0].data();
                        const currentReserved = budgetData.reserved || 0;
                        const currentSpent = budgetData.currentSpent || 0;

                        transaction.update(budgetDocRef, {
                            reserved: Math.max(0, currentReserved - reservedAmountPerCoa),
                            currentSpent: currentSpent + amountPerCoa,
                            updatedAt: Timestamp.now()
                        });
                    }
                }

                // Update reservation status
                transaction.update(reservationDoc.ref, {
                    status: 'COMMITTED',
                    committedAmount: commitAmount,
                    updatedAt: new Date().toISOString()
                });
            }
        });

        console.log(`Budget committed for requisition ${requisitionId}`);
    } catch (error) {
        console.error('Error committing budget:', error);
        throw error;
    }
}

/**
 * Get budget summary for a business unit
 */
export async function getBudgetSummary(businessUnitId: string): Promise<{
    totalLimit: number;
    currentSpent: number;
    reserved: number;
    available: number;
    utilizationPercentage: number;
    budgetCount: number;
}> {
    const fiscalYear = getCurrentFiscalYear();

    const budgetsQuery = query(
        collection(db, COLLECTIONS.BUDGETS),
        where('businessUnitId', '==', businessUnitId),
        where('fiscalYear', '==', fiscalYear)
    );

    const snapshot = await getDocs(budgetsQuery);

    let totalLimit = 0;
    let currentSpent = 0;
    let reserved = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        totalLimit += data.totalLimit || 0;
        currentSpent += data.currentSpent || 0;
        reserved += data.reserved || 0;
    });

    const available = totalLimit - currentSpent - reserved;
    const utilizationPercentage = totalLimit > 0
        ? Math.round(((currentSpent + reserved) / totalLimit) * 100)
        : 0;

    return {
        totalLimit,
        currentSpent,
        reserved,
        available,
        utilizationPercentage,
        budgetCount: snapshot.docs.length
    };
}

// Export all functions
export const BudgetService = {
    getBudgetedCOAs,
    checkBudgetAvailability,
    reserveBudget,
    releaseBudget,
    commitBudget,
    getBudgetSummary
};

export default BudgetService;
