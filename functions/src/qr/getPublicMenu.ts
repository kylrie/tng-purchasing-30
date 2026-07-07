/**
 * getPublicMenu — Callable Cloud Function (Sprint 1 · MOCK-FREE, real Firestore)
 *
 * Thin onCall wrapper. Logic lives in getPublicMenu.handler.ts. No auth required
 * (anonymous diners) — the Admin SDK reads server-side, so firestore.rules is
 * never touched by the customer path (Master Plan §6.4 / A9).
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { getPublicMenuHandler, GetPublicMenuInput } from './getPublicMenu.handler';

// minInstances: 1 keeps one instance warm so a customer's QR scan never pays a
// multi-second cold start on the critical menu-load path (owner decision · MVP).
export const getPublicMenu = onCall<GetPublicMenuInput>(
    { minInstances: 1 },
    request => getPublicMenuHandler(qrDb, request),
);
