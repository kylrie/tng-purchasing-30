import {
    collection,
    doc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    getDocs
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { getTenantConstraints } from '../../../shared/utils/tenantFilters';
import type { User } from '../../procurement/types';

export interface TimelineEvent {
    id: string;
    timestamp: string;
    action: string;
    actor?: string;
    createdAt: Date;
}

export interface InvestigationCase {
    id?: string;
    businessId: string;
    itemId: string;
    itemName: string;
    category: string;
    totalLoss: number;
    date: string;
    time: string;
    assignee: string;
    assigneeRole: string;
    initialNote: string;
    priority: 'urgent' | 'watch';
    status: 'active' | 'resolved';
    resolvedAt?: string;
    resolvedBy?: string;
    timeline: TimelineEvent[];
    createdAt: Timestamp;
}

export class InvestigationsService {
    /**
     * Subscribe to investigation cases in real-time.
     *
     * @param userOrBuId - Pass a `User` for multi-BU-aware subscription,
     *                     or a `string` businessId for single-BU scope.
     */
    static subscribeToInvestigations(
        userOrBuId: User | string,
        callback: (cases: InvestigationCase[]) => void
    ) {
        const tenantConstraints = typeof userOrBuId === 'string'
            ? [where('businessId', '==', userOrBuId)]
            : getTenantConstraints(userOrBuId, 'businessId');

        const q = query(
            collection(db, 'inventory_investigations'),
            ...tenantConstraints,
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const cases: InvestigationCase[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    timeline: data.timeline?.map((t: any) => ({
                        ...t,
                        createdAt: t.createdAt?.toDate() || new Date()
                    })) || []
                } as InvestigationCase;
            });
            callback(cases);
        }, (error) => {
            console.error("Error subscribing to investigations:", error);
            callback([]); // Return empty on error to handle gracefully
        });
    }

    static async assignInvestigation(data: Omit<InvestigationCase, 'id' | 'createdAt' | 'status' | 'timeline'>, creatorName: string) {
        const newCase: Omit<InvestigationCase, 'id'> = {
            ...data,
            status: 'active',
            timeline: [
                {
                    id: crypto.randomUUID(),
                    action: 'Flagged automatically by variance engine',
                    actor: 'System',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    createdAt: new Date()
                },
                {
                    id: crypto.randomUUID(),
                    action: `Assigned to ${data.assignee} (${data.assigneeRole})`,
                    actor: creatorName,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    createdAt: new Date()
                }
            ],
            createdAt: serverTimestamp() as Timestamp
        };

        if (data.initialNote) {
            newCase.timeline.push({
                id: crypto.randomUUID(),
                action: `Note: ${data.initialNote}`,
                actor: creatorName,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: new Date()
            });
        }

        const docRef = await addDoc(collection(db, 'inventory_investigations'), newCase);
        return docRef.id;
    }

    static async resolveInvestigation(caseId: string, resolverName: string, resolutionNote: string = 'Case resolved') {
        const docRef = doc(db, 'inventory_investigations', caseId);

        const resolveEvent: TimelineEvent = {
            id: crypto.randomUUID(),
            action: resolutionNote,
            actor: resolverName,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date()
        };

        // Since we can't easily arrayUnion with complex nested objects that include Dates in frontend easily without reading first,
        // and we want to update status anyway, we'll just do a targeted update. In a real app we might read-modify-write if not using transaction

        // We need to fetch current timeline to append to it
        const caseParams = await getDocs(query(collection(db, 'inventory_investigations'), where('__name__', '==', caseId)));
        if (caseParams.empty) return;

        const docData = caseParams.docs[0].data();
        const newTimeline = [...(docData.timeline || []), resolveEvent];

        await updateDoc(docRef, {
            status: 'resolved',
            resolvedAt: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
            resolvedBy: resolverName,
            timeline: newTimeline
        });
    }

    static async addTimelineEvent(caseId: string, action: string, actor: string) {
        const docRef = doc(db, 'inventory_investigations', caseId);

        const newEvent: TimelineEvent = {
            id: crypto.randomUUID(),
            action,
            actor,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date()
        };

        const caseParams = await getDocs(query(collection(db, 'inventory_investigations'), where('__name__', '==', caseId)));
        if (caseParams.empty) return;

        const docData = caseParams.docs[0].data();
        const newTimeline = [...(docData.timeline || []), newEvent];

        await updateDoc(docRef, {
            timeline: newTimeline
        });
    }
}
