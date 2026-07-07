/**
 * QR Ordering — shared Firestore handle (Sprint 1 remediation · M6)
 *
 * Single source of the QR callables' Firestore instance. Previously each
 * callable inlined `getFirestore(getApp(), 'tng-systems')`, so the still-open
 * P0-2 production-database decision was hardcoded in three places and could
 * drift. Centralizing it here means the eventual P0-2 outcome changes exactly
 * one line.
 *
 * NOTE (P0-2 / Master Plan O9): the target below matches the existing
 * functions (transactions.ts / admin.ts), which target 'tng-systems'. If the
 * production-database decision lands on '(default)', change ONLY this constant.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';

export const QR_DATABASE_ID = 'tng-systems';

export const qrDb = getFirestore(getApp(), QR_DATABASE_ID);
