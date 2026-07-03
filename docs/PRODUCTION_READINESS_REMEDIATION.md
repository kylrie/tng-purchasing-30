# Production Readiness — Remediation Backlog

> **Operational tracking document** for findings from the [Phase 0.5 Firebase Audit](PHASE_0.5_FIREBASE_AUDIT.md). Each item must be resolved (or explicitly waived) per its blocking status. This is the working checklist that gates entry into QR Ordering implementation.

| Field | Value |
|---|---|
| **Created** | 2026-07-02 |
| **Source** | Phase 0.5 Firebase + Production Readiness Audit |
| **Owners** | Elio (customer + Cloud Functions), Fred (staff views + inventory/reporting). "Lead/Owner" = whoever the team assigns; suggestions below. |
| **Legend** | 🔴 P0 Critical · 🟠 P1 High · 🟡 P2 Medium |

**Blocking status key:**
- **BLOCKS QR START** — must be resolved before any QR implementation begins.
- **BLOCKS GO-LIVE** — may be built in parallel but must be resolved before production launch.
- **NON-BLOCKING** — quality/hygiene; resolve opportunistically.

---

## P0 — Critical 🔴

### P0-1 — Rotate committed Firebase service-account keys
- **Description:** Two live service-account JSON keys (`tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json`, `tng-systems-firebase-adminsdk-fbsvc-e2c2bb4cf9.json`) with RSA private keys are committed and tracked in git.
- **Severity:** BLOCKER (R1/R2).
- **Why it matters:** Anyone with repo access holds admin credentials to the `tng-systems` Firebase project — full read/write to all data, bypassing all security rules. This is an active credential exposure.
- **Recommended owner:** Repo owner / DevOps (with Firebase project admin rights).
- **Blocking status:** **BLOCKS QR START.**
- **Resolution outline (not performed in this doc task):** revoke/rotate keys in Google Cloud IAM; remove files and purge from git history; add `.gitignore` patterns (`*firebase-adminsdk*.json`, `.env.development`, `.env.test`).

### P0-2 — Decide production database source of truth
- **Description:** Two Firestore databases exist — `(default)` and `tng-systems` — sharing rules/indexes; functions target `tng-systems`; `clone-db.mjs` copies `tng-systems → (default)`.
- **Severity:** BLOCKER (R7 elevated for QR).
- **Why it matters:** QR Ordering will introduce new collections, writes, and indexes. Writing to the wrong database (or ambiguously across both) risks split data and broken reporting/inventory. One authoritative DB must be chosen and documented.
- **Recommended owner:** Tech lead + owner.
- **Blocking status:** **BLOCKS QR START.**
- **Cross-ref:** Master Plan open decision **O9**.

### P0-3 — Build verification (green `npm run build`)
- **Description:** Committed `tsc-errors.txt` lists ~11 TypeScript errors (permission-union type + missing `POS_ORDERS` in `COLLECTION_NAMES`); `build` runs `tsc -b && vite build`, so it blocks.
- **Severity:** BLOCKER (R3) — **[ASSUMPTION]** from snapshot file; confirm with a live build.
- **Why it matters:** A red build blocks any reliable CI, deploy, or integration of new QR code. The `POS_ORDERS` error sits in the exact module QR neighbors.
- **Recommended owner:** Frontend (Fred) for `POS_ORDERS`/COLLECTION_NAMES; Elio/Fred split for permission types.
- **Blocking status:** **BLOCKS QR START.**

---

## P1 — High 🟠

### P1-1 — Firestore rule bypass review
- **Description:** Three `|| true` create fallbacks (`stock_counts:783`, `wastage_records:809`, `goods_receiving_logs:1098`), a commented-out `isValidWorkflowUpdate()` on the PRF fund-release transition (`:460-461`), and unvalidated financial collections (`budgetReservations`, `bankReconStatements`/`sheetData`).
- **Severity:** BLOCKER (R4).
- **Why it matters:** Any signed-in user can write unvalidated inventory/financial records or mutate a fund-release step — privilege-escalation and data-integrity risk in the shared project QR will run inside.
- **Recommended owner:** Backend/security (Elio) with procurement domain input.
- **Blocking status:** **BLOCKS GO-LIVE** (QR uses callables and doesn't depend on these paths, but they are live risks in the shared project).

### P1-2 — CI/CD baseline
- **Description:** `.github/workflows/` is empty; no automated lint/type/build/test gate.
- **Severity:** WARNING (R6).
- **Why it matters:** Payment and webhook code must not reach production unvetted. A minimal CI gate (lint + `tsc` + build) protects the QR work and everything else.
- **Recommended owner:** DevOps / either developer.
- **Blocking status:** **BLOCKS GO-LIVE** (should exist before payment code lands).

### P1-3 — Deployment process review
- **Description:** Deploy scripts mutate `firebase.json` on disk then restore (crash = wrong state); deploy hosting only (`--only hosting`), so functions must be deployed by hand; `clone-db.mjs` overwrites the target DB with no dry-run.
- **Severity:** WARNING (R6, deployment).
- **Why it matters:** Once the Xendit webhook (a function) exists, hosting-only deploys will silently leave payment logic un-deployed; disk-mutation is fragile.
- **Recommended owner:** DevOps / Elio.
- **Blocking status:** **BLOCKS GO-LIVE** (functions deploy path needed before the webhook ships).

---

## P2 — Medium 🟡

### P2-1 — Index optimization
- **Description:** Only 4 composite indexes exist; likely-missing indexes for `requisitions(businessId,status)`, `requisitions(requesterId,status)`, `pcf_liquidations(userId,status)`, `notifications(targetRoles,createdAt)`. QR will add its own (`qr_orders` status/time queries).
- **Severity:** WARNING.
- **Why it matters:** Missing indexes cause collection scans (cost/latency) and failed queries at runtime; QR queries must be indexed from day one.
- **Recommended owner:** Backend (Elio/Fred).
- **Blocking status:** NON-BLOCKING (but add QR indexes as part of QR phases).

### P2-2 — Test coverage improvements
- **Description:** Single stale, hardcoded Playwright screenshot test; no unit/integration coverage.
- **Severity:** WARNING (R9).
- **Why it matters:** Payment/idempotency/oversell logic is high-risk and needs automated tests; there is currently no safety net.
- **Recommended owner:** Both developers (test the QR modules they own).
- **Blocking status:** NON-BLOCKING (but QR payment paths should ship with tests).

### P2-3 — Lint cleanup
- **Description:** ~166 ESLint errors / 20 warnings **[ASSUMPTION]** from snapshot; includes `set-state-in-effect` (infinite-loop risk) and `no-explicit-any`.
- **Severity:** WARNING (R8).
- **Why it matters:** Some patterns (set-state-in-effect) are latent runtime bugs; large `any` debt weakens type safety around new code.
- **Recommended owner:** Both developers, incremental.
- **Blocking status:** NON-BLOCKING (confirm counts with a live lint run).

### P2-4 — `postTransaction` RBAC
- **Description:** `postTransaction` (`transactions.ts:70`) authenticates but has no role check, unlike `setBudgetLimit`.
- **Severity:** WARNING (R11).
- **Why it matters:** Any authenticated user can post a budget transaction; not QR-specific but a standing gap.
- **Recommended owner:** Backend (Elio).
- **Blocking status:** NON-BLOCKING.

### P2-5 — `system_activity_logs` write hardening
- **Description:** Read is SuperAdmin-only but create is open to any signed-in user (`:1112`).
- **Severity:** WARNING.
- **Why it matters:** Audit-log injection/manipulation risk.
- **Recommended owner:** Backend/security (Elio).
- **Blocking status:** NON-BLOCKING.

---

## Gate summary

| Gate | Items that must clear |
|---|---|
| **QR START** (Security Remediation Gate) | P0-1, P0-2, P0-3, and rule review scoped (P1-1) |
| **GO-LIVE** (Production Readiness Gate) | P1-1, P1-2, P1-3 resolved; QR-phase items (indexes, tests) done |
| **Non-blocking** | P2-1…P2-5 as capacity allows |

*This backlog is a living document — update blocking status and owners as items are resolved. It does not authorize implementation; it records what implementation must clear.*
