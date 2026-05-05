import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    onSnapshot,
    serverTimestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

// ============================================================
// TYPES
// ============================================================

export type ActivityModule =
    | 'Procurement'
    | 'Finance'
    | 'Inventory'
    | 'POS'
    | 'Menu'
    | 'Goods Receiving'
    | 'Wastage'
    | 'Reconciliation'
    | 'Settings'
    | 'Admin'
    | 'System';

export type ActivitySeverity = 'info' | 'success' | 'warning' | 'error';

export interface ActivityLogEntry {
    id?: string;
    // Who
    actorId: string;
    actorName: string;
    // What
    module: ActivityModule;
    action: string;           // e.g. "Created PRF", "Approved", "Imported POS Sales"
    description: string;      // Human-readable detail
    severity: ActivitySeverity;
    // Where
    businessUnitId: string;
    businessUnitName?: string;
    // Reference to the affected entity (optional)
    entityId?: string;
    entityType?: string;      // e.g. "PRF", "Inventory Item", "POS Batch"
    // Metadata
    metadata?: Record<string, unknown>;
    // Firestore timestamps
    timestamp?: ReturnType<typeof serverTimestamp>;
    createdAt?: string;       // ISO string — populated on read
}

export type LogActivityInput = Omit<ActivityLogEntry, 'id' | 'timestamp' | 'createdAt'>;

const COLLECTION = 'system_activity_logs';

// ============================================================
// SERVICE
// ============================================================

export class ActivityLogService {
    /**
     * Write a single activity log entry.
     * Fire-and-forget — never throws; failures are logged to console only
     * so callers never need try/catch.
     */
    static async logActivity(input: LogActivityInput): Promise<void> {
        try {
            const colRef = collection(db, COLLECTION);
            await addDoc(colRef, {
                ...input,
                timestamp: serverTimestamp(),
            });
        } catch (err) {
            // Never block the calling action due to a log failure
            console.warn('[ActivityLogService] Failed to write log entry:', err);
        }
    }

    /**
     * Convenience wrapper — same as logActivity but severity defaults to 'info'.
     */
    static log(
        module: ActivityModule,
        action: string,
        description: string,
        actor: { id: string; name: string },
        businessUnitId: string,
        extras?: Partial<LogActivityInput>
    ): void {
        // Intentionally not awaited — fire and forget
        this.logActivity({
            actorId: actor.id,
            actorName: actor.name,
            module,
            action,
            description,
            severity: 'info',
            businessUnitId,
            ...extras,
        });
    }

    /**
     * Fetch the most recent N log entries (one-time read).
     */
    static async getLogs(options: {
        businessUnitId?: string;
        module?: ActivityModule;
        limitCount?: number;
    } = {}): Promise<ActivityLogEntry[]> {
        try {
            const colRef = collection(db, COLLECTION);
            const constraints = [];

            if (options.businessUnitId && options.businessUnitId !== 'all') {
                constraints.push(where('businessUnitId', '==', options.businessUnitId));
            }
            if (options.module) {
                constraints.push(where('module', '==', options.module));
            }
            constraints.push(orderBy('timestamp', 'desc'));
            constraints.push(limit(options.limitCount ?? 500));

            const q = query(colRef, ...constraints);
            const snap = await getDocs(q);

            return snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.timestamp?.toDate?.()?.toISOString() ?? '',
                } as ActivityLogEntry;
            });
        } catch (err) {
            console.error('[ActivityLogService] Failed to fetch logs:', err);
            return [];
        }
    }

    /**
     * Real-time subscription to log entries.
     * Returns an unsubscribe function.
     */
    static subscribeLogs(
        options: {
            businessUnitId?: string;
            module?: ActivityModule;
            limitCount?: number;
        },
        callback: (entries: ActivityLogEntry[]) => void
    ): Unsubscribe {
        const colRef = collection(db, COLLECTION);
        const constraints = [];

        if (options.businessUnitId && options.businessUnitId !== 'all') {
            constraints.push(where('businessUnitId', '==', options.businessUnitId));
        }
        if (options.module) {
            constraints.push(where('module', '==', options.module));
        }
        constraints.push(orderBy('timestamp', 'desc'));
        constraints.push(limit(options.limitCount ?? 500));

        const q = query(colRef, ...constraints);

        return onSnapshot(q, snap => {
            const entries: ActivityLogEntry[] = snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.timestamp?.toDate?.()?.toISOString() ?? '',
                } as ActivityLogEntry;
            });
            callback(entries);
        }, err => {
            console.error('[ActivityLogService] Subscription error:', err);
        });
    }
}
