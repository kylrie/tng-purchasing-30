// QR Ordering — Bar Queue live read (Sprint 2 · real qr_orders listener).
//
// Same access model as the kitchen board: signed-in bar staff read `qr_orders`
// DIRECTLY via a BU-scoped onSnapshot (firestore.rules: `belongsToSameBU`).
// The bar shows DRINK lines only; when an order also has food, the card carries a
// "Food also in kitchen" flag. Writes are NOT done here (`qr_orders` is
// `write: if false`, no bar-transition callable yet) — the LIVE board is read-only
// (the demo board keeps its mock status buttons). No Xendit, no inventory deduction.
//
// The pure card mapping + drink split lives in the firebase-free ./barCard module
// so it is unit-testable. Lifecycle: the bar only shows PAID work — until Xendit
// lands, real orders sit at AWAITING_PAYMENT, so the live board is legitimately
// empty ("No paid bar orders yet.").

import { FirestoreService, where } from '../../../shared/services/firestore.service';
import type { Unsubscribe } from 'firebase/firestore';
import { toBarCard, type BarCard, type RawQrOrderDoc } from './barCard';

// Re-exported so existing importers (BarQueueView, QrOpsView, ops nav counts) keep
// working unchanged while the pure implementation lives in firebase-free modules.
export { barLaneFor, toBarCard } from './barCard';
export type { BarLane, BarCardLine, BarCard } from './barCard';
export { isDrinkCategory } from '../utils/isDrinkCategory';

/**
 * Subscribe to the live bar board for one business unit. Returns the unsubscribe
 * fn. Cards arrive oldest-first (FIFO). Single-field equality query — no composite
 * index required; non-bar / no-drink orders are filtered client-side.
 */
export function subscribeBarOrders(
    businessUnitId: string,
    onData: (cards: BarCard[]) => void,
    onError: (err: Error) => void,
): Unsubscribe {
    return FirestoreService.subscribeToCollection<RawQrOrderDoc>(
        'qr_orders',
        docs => {
            const now = Date.now();
            const cards = docs
                .map(d => toBarCard(d, now))
                .filter((c): c is BarCard => c !== null)
                .sort((a, b) => a.createdAtMillis - b.createdAtMillis);
            onData(cards);
        },
        [where('businessUnitId', '==', businessUnitId)],
        onError,
    );
}
