/**
 * QR Ordering — print-control Callable Cloud Functions. Thin onCall wrappers; all
 * logic + auth live in printControl.handler.ts. Server-mediated because
 * qr_print_jobs / qr_print_config are `write: if false` for clients.
 */

import { onCall } from 'firebase-functions/v2/https';
import { qrDb } from './firestore';
import {
    setAutoPrintHandler, SetAutoPrintInput,
    retryPrintJobHandler, RetryPrintJobInput,
} from './printControl.handler';

export const setAutoPrint = onCall<SetAutoPrintInput>(request => setAutoPrintHandler(qrDb, request));
export const retryPrintJob = onCall<RetryPrintJobInput>(request => retryPrintJobHandler(qrDb, request));
