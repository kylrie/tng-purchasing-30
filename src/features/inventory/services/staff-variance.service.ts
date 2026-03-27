import { db } from '../../../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp,
} from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

/**
 * A single staff member's rolling variance record.
 * This is the shape consumed by the ShiftOverlayTab component.
 */
export interface StaffVarianceRecord {
    staffId: string;
    staffName: string;
    role: string;
    shiftsWorked: number;
    avgVariancePercent: number;
    totalLossPeso: number;
    pattern: 'Recurring — Investigate' | 'Watch' | 'Normal';
}

/**
 * Internal accumulator used while processing recon snapshots.
 * We aggregate per-staff totals before computing final averages.
 */
interface StaffAccumulator {
    staffId: string;
    staffName: string;
    role: string;
    shiftsWorked: number;          // Number of recon snapshots this person saved
    totalLossPeso: number;         // Sum of variance cost (₱) across their snapshots
    totalTheoreticalUsage: number; // Sum of expected usage cost (₱) for divide-by
}

/**
 * Shape of a row stored inside `recon_history.rows[]`.
 * We only need the fields relevant to variance calculation.
 */
interface ReconSnapshotRow {
    itemId: string;
    itemName: string;
    category: string;
    endingSystem: number;   // Expected closing stock (theoretical)
    endingActual: number;   // Physical count entered by staff
    variance: number;       // endingActual - endingSystem (negative = missing)
    costPerUnit: number;
}

/**
 * Shape of a Firestore document in the `recon_history` collection.
 * Each document is a full reconciliation snapshot saved by a staff member.
 */
interface ReconHistoryDoc {
    id: string;
    businessUnitId: string;
    savedAt: Date;
    savedBy: string;        // userId
    savedByName: string;    // Display name
    totalItems: number;
    itemsWithVariance: number;
    totalVarianceCost: number;
    rows: ReconSnapshotRow[];
}

// ============================================================
// COLLECTIONS
// ============================================================

const COL = {
    RECON_HISTORY: 'recon_history',
    USER_PROFILES: 'user_profiles',
} as const;

// ============================================================
// HELPERS
// ============================================================

/**
 * Pattern thresholds (based on user requirements):
 *   >= 10% → 'Recurring — Investigate'
 *    >= 5% → 'Watch'
 *      < 5% → 'Normal'
 */
function getPatternTag(avgVariancePercent: number): StaffVarianceRecord['pattern'] {
    const abs = Math.abs(avgVariancePercent);
    if (abs >= 10) return 'Recurring — Investigate';
    if (abs >= 5) return 'Watch';
    return 'Normal';
}

/**
 * Returns a Date object set to midnight N days ago.
 */
function daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ============================================================
// SERVICE
// ============================================================

/**
 * getRollingStaffVariance
 * ──────────────────────────────────────────────────────────
 * Calculates a rolling N-day staff variance report by performing
 * an IN-MEMORY JOIN between recon_history snapshots and the staff
 * who recorded them.
 *
 * ### Why an in-memory join?
 * Firestore doesn't support SQL-style JOINs or GROUP BY. Instead,
 * we fetch all recon_history documents for the date range in a
 * single query, then aggregate per-staff in a Map on the client.
 * This is efficient because recon snapshots are saved at most once
 * per shift per person (typically 1–3 per day), so even a 30-day
 * window yields a manageable dataset.
 *
 * ### The 3-step aggregation process:
 *
 *   Step A — Fetch: Query `recon_history` for the businessUnitId
 *            within the date range [now - N days, now].
 *
 *   Step B — Accumulate: For each recon document (= 1 staff shift),
 *            extract the `savedBy` (staff ID) and loop through the
 *            embedded `rows[]` to sum:
 *              • totalLossPeso: variance × costPerUnit (negative variance = loss)
 *              • totalTheoreticalUsage: endingSystem × costPerUnit
 *              • shiftsWorked: +1 per document
 *
 *   Step C — Compute & Tag: For each staff member, calculate:
 *              avgVariancePercent = (totalLossPeso / totalTheoreticalUsage) × 100
 *            Then tag the pattern as 'Recurring — Investigate' / 'Watch' / 'Normal'.
 *
 * @param businessUnitId - The BU to scope the query to
 * @param days - Rolling window in days (default: 7)
 * @returns StaffVarianceRecord[] sorted descending by totalLossPeso
 */
export async function getRollingStaffVariance(
    businessUnitId: string,
    days: number = 7
): Promise<StaffVarianceRecord[]> {

    // ────────────────────────────────────────────────────────
    // STEP A: Fetch recon_history snapshots for the date range
    // ────────────────────────────────────────────────────────

    const cutoffDate = daysAgo(days);

    try {
        const reconQ = query(
            collection(db, COL.RECON_HISTORY),
            where('businessUnitId', '==', businessUnitId),
            where('savedAt', '>=', Timestamp.fromDate(cutoffDate)),
            orderBy('savedAt', 'desc')
        );

        const reconSnap = await getDocs(reconQ);

        if (reconSnap.empty) {
            console.log(`[StaffVariance] No recon snapshots found for BU ${businessUnitId} in last ${days} days`);
            return [];
        }

        // Parse Firestore docs into typed objects
        const reconDocs: ReconHistoryDoc[] = reconSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                businessUnitId: data.businessUnitId,
                savedAt: data.savedAt?.toDate?.() || new Date(data.savedAt),
                savedBy: data.savedBy,
                savedByName: data.savedByName,
                totalItems: data.totalItems,
                itemsWithVariance: data.itemsWithVariance,
                totalVarianceCost: data.totalVarianceCost,
                rows: (data.rows || []) as ReconSnapshotRow[],
            };
        });

        // ────────────────────────────────────────────────────────
        // STEP B: Accumulate per-staff totals via in-memory Map
        // ────────────────────────────────────────────────────────
        //
        // Key:   staffId (savedBy)
        // Value: StaffAccumulator with running totals
        //
        // For each recon document, the `savedBy` field tells us
        // WHICH staff member performed the count. The embedded
        // `rows[]` tells us what the variance was for every item.

        const staffMap = new Map<string, StaffAccumulator>();

        for (const reconDoc of reconDocs) {
            const staffId = reconDoc.savedBy;
            const staffName = reconDoc.savedByName || 'Unknown';

            // Initialize accumulator if first encounter
            if (!staffMap.has(staffId)) {
                staffMap.set(staffId, {
                    staffId,
                    staffName,
                    role: 'Staff', // Default; overridden below if user_profiles available
                    shiftsWorked: 0,
                    totalLossPeso: 0,
                    totalTheoreticalUsage: 0,
                });
            }

            const acc = staffMap.get(staffId)!;

            // Each recon document = 1 shift/session counted by this person
            acc.shiftsWorked += 1;

            // Loop through the embedded item rows to compute variance totals
            for (const row of reconDoc.rows) {
                // Variance in the recon schema: endingActual - endingSystem
                // Negative = missing stock = loss
                const varianceQty = row.variance ?? (
                    row.endingActual != null
                        ? row.endingActual - row.endingSystem
                        : 0
                );

                // Loss = negative variance × costPerUnit (we want the LOSS as a positive ₱ value)
                const lossPeso = Math.abs(varianceQty) * row.costPerUnit;

                // Theoretical value = what the system expected (endingSystem × costPerUnit)
                const theoreticalValue = Math.abs(row.endingSystem) * row.costPerUnit;

                // Only count items that actually have a variance
                if (Math.abs(varianceQty) > 0.001) {
                    acc.totalLossPeso += lossPeso;
                }

                // Always accumulate theoretical for the denominator
                acc.totalTheoreticalUsage += theoreticalValue;
            }
        }

        // ────────────────────────────────────────────────────────
        // STEP B.5 (Optional): Enrich with roles from user_profiles
        // ────────────────────────────────────────────────────────
        //
        // If user_profiles exists, fetch role info for staff members.
        // This is a single query that brings back light profile docs.

        try {
            const staffIds = Array.from(staffMap.keys());
            if (staffIds.length > 0) {
                // Firestore 'in' queries support up to 30 values
                const batches = [];
                for (let i = 0; i < staffIds.length; i += 30) {
                    batches.push(staffIds.slice(i, i + 30));
                }

                for (const batch of batches) {
                    const profileQ = query(
                        collection(db, COL.USER_PROFILES),
                        where('__name__', 'in', batch)
                    );
                    const profileSnap = await getDocs(profileQ);

                    for (const profileDoc of profileSnap.docs) {
                        const data = profileDoc.data();
                        const acc = staffMap.get(profileDoc.id);
                        if (acc) {
                            acc.role = data.role || data.position || data.department || 'Staff';
                            // Use display name from profile if available
                            if (data.displayName) {
                                acc.staffName = data.displayName;
                            }
                        }
                    }
                }
            }
        } catch (profileError) {
            // user_profiles may not exist yet — this is non-critical
            console.warn('[StaffVariance] Could not enrich staff roles:', profileError);
        }

        // ────────────────────────────────────────────────────────
        // STEP C: Compute avgVariancePercent & tag pattern
        // ────────────────────────────────────────────────────────

        const results: StaffVarianceRecord[] = [];

        for (const acc of staffMap.values()) {
            // Guard against divide-by-zero: if no theoretical usage,
            // we can't compute a meaningful variance percentage
            const avgVariancePercent = acc.totalTheoreticalUsage > 0
                ? (acc.totalLossPeso / acc.totalTheoreticalUsage) * 100
                : 0;

            results.push({
                staffId: acc.staffId,
                staffName: acc.staffName,
                role: acc.role,
                shiftsWorked: acc.shiftsWorked,
                avgVariancePercent: Math.round(avgVariancePercent * 10) / 10, // 1 decimal
                totalLossPeso: Math.round(acc.totalLossPeso),
                pattern: getPatternTag(avgVariancePercent),
            });
        }

        // ────────────────────────────────────────────────────────
        // SORT: Descending by totalLossPeso (highest loss at top)
        // ────────────────────────────────────────────────────────

        results.sort((a, b) => b.totalLossPeso - a.totalLossPeso);

        console.log(`[StaffVariance] Computed ${results.length} staff records for BU ${businessUnitId} over ${days} days`);
        return results;

    } catch (error) {
        console.error('[StaffVariance] Error computing rolling staff variance:', error);
        return [];
    }
}
