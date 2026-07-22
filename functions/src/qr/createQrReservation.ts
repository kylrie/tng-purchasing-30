/**
 * createQrReservation — Callable Cloud Function (Ops → Tables quick reservations).
 *
 * Thin onCall wrapper; all logic (RBAC, authoritative table/BU resolution, PH
 * phone validation, conflict rejection) lives in createQrReservation.handler.ts
 * so it is testable with an injected Firestore.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import { createQrReservationHandler, CreateQrReservationInput } from './createQrReservation.handler';

export const createQrReservation = onCall<CreateQrReservationInput>(request => createQrReservationHandler(qrDb, request));
