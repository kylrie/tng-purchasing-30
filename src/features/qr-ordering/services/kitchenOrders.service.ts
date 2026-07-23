// QR Ordering — Kitchen Queue live read (Sprint 2 · real qr_orders listener).
//
// Staff-facing: kitchen users are signed-in, so they read `qr_orders` DIRECTLY
// via a BU-scoped onSnapshot (firestore.rules: `allow read: belongsToSameBU`).
// The query is scoped to a single businessUnitId so the rule is satisfied for
// every returned doc. Writes are NOT done here — `qr_orders` is `write: if false`
// and there is no kitchen-transition callable yet, so the LIVE board is read-only
// (the demo board keeps its mock status buttons). No Xendit, no inventory deduction.
//
// The kitchen shows FOOD lines only (drinks route to the bar); the pure card
// mapping + food/drink split lives in the firebase-free ./kitchenCard module so it
// is unit-testable. Lifecycle: the kitchen only ever shows PAID work — until Xendit
// lands, real orders sit at AWAITING_PAYMENT, so the live board is legitimately
// empty ("No paid kitchen orders yet.").

import { FirestoreService, where } from '../../../shared/services/firestore.service';
import type { Unsubscribe } from 'firebase/firestore';
import { toKitchenCard, type KitchenCard, type RawQrOrderDoc } from './kitchenCard';

// Re-exported so existing importers (KitchenQueueView, ops) keep working unchanged
// while the pure implementation lives in a firebase-free module.
export { kitchenLaneFor, toKitchenCard } from './kitchenCard';
export type { KitchenLane, KitchenCardLine, KitchenCard } from './kitchenCard';

/**
 * Subscribe to the live kitchen board for one business unit. Returns the
 * unsubscribe fn. Cards arrive oldest-first (FIFO — the order the kitchen should
 * work them). Non-kitchen statuses and drinks-only orders are filtered out
 * client-side (no composite index needed — the query is a single-field equality
 * on businessUnitId).
 */
export function subscribeKitchenOrders(
    businessUnitId: string,
    onData: (cards: KitchenCard[]) => void,
    onError: (err: Error) => void,
): Unsubscribe {
    return FirestoreService.subscribeToCollection<RawQrOrderDoc>(
        'qr_orders',
        docs => {
            const now = Date.now();
            const cards = docs
                .map(d => toKitchenCard(d, now))
                .filter((c): c is KitchenCard => c !== null)
                .sort((a, b) => a.createdAtMillis - b.createdAtMillis);
            onData(cards);
        },
        [where('businessUnitId', '==', businessUnitId)],
        onError,
    );
}
