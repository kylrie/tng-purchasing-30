# Phase 0.5 — Firebase + Production Readiness Audit

> **Official audit artifact.** Findings here feed the [Master Plan](QR_ORDERING_MASTER_PLAN.md), the [Decision Record](TNG_QR_ORDERING_DECISION_RECORD.md), and the [Remediation Backlog](PRODUCTION_READINESS_REMEDIATION.md).

| Field | Value |
|---|---|
| **Audit date** | 2026-07-02 |
| **Repository** | `tng-purchasing-30` |
| **Phase** | 0.5 — Firebase Audit (per Master Plan §8) |
| **Type** | Read-only. No files, code, config, rules, or credentials were modified. |
| **Status** | Complete — **Conditional Pass** (see §9) |

---

## Executive summary

The TNG ERP rests on a **more capable foundation than the QR Ordering initiative assumed**: a mature role- and permission-based Firestore security model with a terminal default-deny, business-unit multi-tenancy, immutable audit trails, a production-grade bill-of-materials (BOM) inventory-deduction engine with import idempotency, atomic sequential ID generation, and reusable real-time listeners. Much of the hard work QR Ordering needs already exists and is directly reusable.

However, the audit surfaced **five production-readiness blockers** that must be addressed before (or as a gated part of) QR implementation:

1. **Two live Firebase service-account private keys are committed to git** (must be treated as compromised).
2. **The build fails** on committed TypeScript errors (`tsc -b` blocks `npm run build`).
3. **Firestore rules contain deliberate bypasses** on inventory and fund-release paths.
4. **No HTTP webhook infrastructure exists** — the Xendit webhook is greenfield.
5. **Stock deduction is not transaction-guarded** — an oversell risk once live payments depend on it.

The QR Ordering direction, business flow, BIR boundary, and Xendit payment architecture **remain valid and approved**. The audit reinforces two existing design decisions: use a **dedicated `qr_orders` collection** (the current POS order model cannot express an order lifecycle) and route **all customer access through Cloud Function callables** (keeping the staff-only security rules untouched).

**Gate decision: CONDITIONAL PASS** — QR implementation should not begin until the P0 items (§10) are cleared.

---

## Audit scope

In scope (read-only inspection):
- Firestore security rules (`firestore.rules`, ~1,130 lines) and indexes (`firestore.indexes.json`).
- Firestore collection inventory and access model.
- Cloud Functions (`functions/`), `firebase.json`, `.firebaserc`, deploy scripts, CI configuration.
- Existing POS / Menu / Inventory / Reporting schemas and services, and the real-time layer.
- Secrets & security posture (committed credentials, `.gitignore`, env handling, CORS).
- Build & code health (dependencies, TypeScript errors, lint state, test coverage).

Out of scope: live penetration testing, load testing, Firebase console/IAM inspection, and any change to code, config, rules, or credentials.

## Methodology

Five parallel read-only investigation agents, each covering one domain (secrets/security, rules/collections, functions/deployment, schema/workflow readiness, build/health), each returning structured findings with `file:line` evidence. Results were cross-checked and synthesized into this report.

**Evidence caveat:** build-health findings (TypeScript-error and lint counts) were read from **committed snapshot files** (`tsc-errors.txt`, `lint_report.txt`) rather than from a live compiler run. They are marked `[ASSUMPTION]` pending a live `npm run build` / `eslint` in the remediation phase.

## Severity legend

| Tag | Meaning |
|---|---|
| **[CONFIRMED]** | Verified against a cited file/line during this audit. |
| **[BLOCKER]** | Must be resolved before QR implementation (or before go-live where noted). |
| **[WARNING]** | Should be resolved; risk to quality, security drift, or maintainability. |
| **[ASSUMPTION]** | Believed true but not directly verified this pass; flagged to confirm. |

---

## 1. Firebase architecture map

| Layer | Reality | Tag |
|---|---|---|
| **Project** | Single Firebase project `tng-systems`; staging (`tng-systems-staging`) is hosting-only (`.firebaserc`). | [CONFIRMED] |
| **Databases** | **Two Firestore databases** — `(default)` and `tng-systems` — share the *same* `firestore.rules` and `firestore.indexes.json` (`firebase.json`). Functions target `tng-systems` (`admin.ts:21`, `transactions.ts:18`). `scripts/clone-db.mjs` copies `tng-systems → (default)`. **Production source-of-truth DB is ambiguous.** | [CONFIRMED] / [BLOCKER] |
| **Auth** | Firebase Auth (email/password + Google). Roles stored in `users` docs; no custom claims. | [CONFIRMED] |
| **Functions** | Node 20, `firebase-functions ^5`, `firebase-admin ^12`. Exactly **2 functions, both `onCall`** (`setBudgetLimit`, `postTransaction`). **No HTTP (`onRequest`) endpoint.** | [CONFIRMED] |
| **Hosting** | SPA on `dist/`, rewrite `/** → /index.html`, COOP header set. | [CONFIRMED] |
| **Client** | React 19 + Vite 7 + Tailwind 4, Firebase Web SDK 12, Capacitor 8 configured (no native projects), Gemini AI client-side. | [CONFIRMED] |
| **CI/CD** | **None.** `.github/workflows/` is an empty 0-byte file. Manual, hosting-only deploys; functions deployed by hand. | [CONFIRMED] |

## 2. Firestore database usage findings

- **~30 top-level collections**, consistently BU-scoped (`businessUnitId`/`businessId`) for multi-tenancy. [CONFIRMED]
- **Strong immutability** on audit trails: `stock_transactions`, `pos_sales`, `recon_history`, `stocktake_audit_logs`, and batch-metadata collections set `update/delete: false`. [CONFIRMED]
- **Financial writes are funneled through a Cloud Function:** `transactions` has `allow write: if false` (`firestore.rules:953`), forcing atomic budget validation via `postTransaction`. [CONFIRMED]
- **Aggregation is client-side** — dashboards use `getDocs` + JS reduction, no rollups, no real-time. Revenue is a placeholder: `monthlyRevenue = expenses × 1.3` (`finance.dashboard.service.ts:170`). [CONFIRMED]
- **Indexes are thin** — only 4 composite indexes (`stock_transactions ×2`, `pos_sales`, `blackBookRecipes`). Likely-missing indexes for `requisitions(businessId,status)`, `requisitions(requesterId,status)`, `pcf_liquidations(userId,status)`, `notifications(targetRoles,createdAt)`. New QR queries will need new composite indexes. [WARNING]

## 3. Collection inventory (condensed)

| Collection | Read | Write | Note | Tag |
|---|---|---|---|---|
| `requisitions` | owner/BU/perm | 8-stage validated workflow | Best-practice example | [CONFIRMED] |
| `users` | signed-in | self-register (PENDING) / admin | Guarded | [CONFIRMED] |
| `businesses`,`suppliers`,`uom`,`config`,`chart_of_accounts`,`settings` | signed-in | permission/admin | Master data | [CONFIRMED] |
| `counters` | signed-in | start at 1, increment-only, no delete | Anti-spoof | [CONFIRMED] |
| `transactions` | signed-in | **`false`** (CF only) | Atomic via `postTransaction` | [CONFIRMED] |
| `inventory_items` | perm + BU | perm; POS may update stock fields only | Scoped | [CONFIRMED] |
| `stock_transactions`,`stocktake_audit_logs`,`recon_history`,`pos_sales`,`*_batches` | signed-in/BU | create-only, immutable | Audit trails | [CONFIRMED] |
| `stock_counts` | perm/BU | **create: `perm \|\| true`** | Fallback bypass | [BLOCKER] |
| `wastage_records` | perm/BU | **create: `perm \|\| true`** | Fallback bypass | [BLOCKER] |
| `goods_receiving_logs` | perm/BU | **create: `perm \|\| true`** | Fallback bypass | [BLOCKER] |
| `menu_items` | signed-in | **create/update: `isSignedIn()`** (no validation) | QR-relevant | [WARNING] |
| `productionRecipes`,`blackBookRecipes`,`event_package_templates` | signed-in | **`isSignedIn()`** only | No validation | [WARNING] |
| `budgetReservations` | signed-in | **`isSignedIn()`** (financial, unvalidated) | Financial | [BLOCKER] |
| `bankReconStatements` (+`sheetData`) | signed-in | **`isSignedIn()`** create/update/delete | Financial | [BLOCKER] |
| `pos_orders` | signed-in | **create/update: `isSignedIn()`** (no validation) | QR builds near this | [WARNING] |
| `event_sales` | signed-in | create-only, immutable, unvalidated | — | [WARNING] |
| `system_activity_logs` | **SuperAdmin only** | **create: any signed-in** | Audit-injection risk | [WARNING] |
| `pcf_liquidations`,`inventory_investigations` | owner/perm | workflow / no-delete | OK | [CONFIRMED] |

## 4. Security rules review

Overall: a **mature RBAC model** with a terminal default-deny (`firestore.rules:1130`), BU-scoping, immutable audit logs, and thorough validation on the procurement core — undermined by several deliberate bypasses (security drift):

- **Three `|| true` permission fallbacks** — `:783` `stock_counts`, `:809` `wastage_records`, `:1098` `goods_receiving_logs`. Any signed-in user can create these records with arbitrary data. Marked "temporary fallback." [BLOCKER]
- **Commented-out workflow validation** at PRF Stage 7 (`:460-461`, "TEMPORARY WORKAROUND: Bypass isValidWorkflowUpdate()") — allows arbitrary field mutation on the `PENDING_CHECK_AUTH_BOD → FOR_FUND_RELEASE` (fund-release) transition. [BLOCKER]
- **Unvalidated financial writes:** `budgetReservations` and `bankReconStatements`/`sheetData` allow any signed-in user to create/update/delete. [BLOCKER]
- **`notifications` read rule** (`:589`) does `request.auth.uid in resource.data.targetRoles` — field name says *roles* but matches a *uid*; likely a latent bug. [WARNING] [ASSUMPTION] (verify data shape)
- **Performance:** helper functions (`getUserData`, `getPermissionsDoc`) are re-fetched multiple times per rule evaluation. [WARNING]

**QR relevance:** `menu_items` and `pos_orders` lack field validation for authenticated writers. This is acceptable **only because** the QR customer path will never write Firestore directly — all customer access goes through Cloud Function callables (Admin SDK bypasses rules). The mitigation is architectural and already in the Master Plan. [CONFIRMED]

## 5. Functions / deployment review

- **2 functions, both `onCall`.** `setBudgetLimit` has proper RBAC (FINANCE_HEAD/SUPER_ADMIN) + validation; `postTransaction` is atomic via `runTransaction` but **has no role check** — any authenticated user can post a transaction. [CONFIRMED] / [WARNING]
- **No `onRequest` HTTP endpoint exists** — the Xendit webhook (Phase 3) is entirely greenfield, the repo's first HTTP function. [CONFIRMED] / [BLOCKER for payment phase]
- **Deploy scripts mutate `firebase.json` on disk** then restore it — a crash mid-deploy leaves it wrong. [WARNING]
- **Deploy scripts push hosting only** (`--only hosting`); functions must be deployed manually and separately. [WARNING]
- **No CI/CD** — no automated lint/test/build gate. [WARNING]
- **`clone-db.mjs`** overwrites the target DB with no dry-run/confirmation. [WARNING]

## 6. Existing workflow readiness check

**Reusable and production-grade (reuse directly):** [CONFIRMED]
- **BOM explosion + stock deduction** (`pos-import.service.ts:537-597`, recursive PRODUCTION handling) — the core inventory engine for QR completion.
- **Idempotency via SHA-256 file hash** (`pos-import.service.ts:174-194`) — the pattern the Xendit `xendit_events` ledger should mirror.
- **Atomic `writeBatch` with 490-op chunking** for multi-collection writes.
- **`CounterService`** atomic sequential IDs via `runTransaction` (`counter.service.ts:44-83`).
- **`FirestoreService.subscribeToCollection/Document`** `onSnapshot` wrappers (`firestore.service.ts:211-261`) — ready for kitchen/bar queues.
- **Menu ↔ inventory sync** via `linkedInventoryItemId` and atomic `createMenuItem` (`recipes.service.ts:326-373`).

**Not ready / must change for QR:**
- **POS order status hardcoded `COMPLETED`** (`pos.service.ts:16`) — no lifecycle. Validates the decision to use a new `qr_orders` collection. [BLOCKER]
- **Order numbers use random 3-byte hex** (`pos.service.ts:15`, ~16M space, no uniqueness guarantee) — QR must use `CounterService`. [BLOCKER]
- **No `runTransaction` around stock deduction** (`pos-import.service.ts:617-789` uses batch, not a transaction) — concurrent deductions can oversell. QR's pre-payment stock check must use `runTransaction`. [BLOCKER]
- **No revenue / POS→finance reporting** — QR revenue reporting is net-new. [WARNING]

## 7. Production readiness risks

| # | Risk | Tag |
|---|---|---|
| R1 | **Two live Firebase service-account private keys committed to git** (`tng-systems-firebase-adminsdk-fbsvc-*.json`, tracked, added May & Jun 2026). | [CONFIRMED] [BLOCKER] |
| R2 | `.gitignore` misses the real key filename pattern and `.env.development`/`.env.test` (both committed). | [CONFIRMED] [BLOCKER] |
| R3 | **`tsc -b` fails** — 11 committed TypeScript errors (permission-union + missing `POS_ORDERS` in `COLLECTION_NAMES`); `npm run build` blocks before Vite. | [ASSUMPTION] [BLOCKER] (verify live) |
| R4 | Rules bypasses: 3× `\|\| true`, commented-out fund-release validation, unvalidated financial collections. | [CONFIRMED] [BLOCKER] |
| R5 | No Xendit webhook (`onRequest`) infrastructure exists. | [CONFIRMED] [BLOCKER for payment] |
| R6 | No CI/CD; manual, hosting-only deploys; functions deployed by hand. | [CONFIRMED] [WARNING] |
| R7 | Dual-database ambiguity (`(default)` vs `tng-systems`). | [CONFIRMED] [WARNING] |
| R8 | ~166 ESLint errors / 20 warnings, incl. `set-state-in-effect` (infinite-loop risk). | [ASSUMPTION] [WARNING] (verify live) |
| R9 | Near-zero test coverage (1 stale hardcoded Playwright screenshot test). | [CONFIRMED] [WARNING] |
| R10 | No stock-deduction transaction (oversell). | [CONFIRMED] [WARNING → BLOCKER at go-live] |
| R11 | `postTransaction` has no RBAC. | [CONFIRMED] [WARNING] |

## 8. QR Ordering integration impact

- **Security model is compatible** with the approved callable-mediated design — *only* because customers won't touch Firestore directly. Keep every customer read/write in Cloud Functions; do **not** relax `menu_items`/`pos_orders` rules. [CONFIRMED]
- **New infrastructure required:** first `onRequest` function (Xendit webhook), new `qr_orders`/`qr_tables`/`xendit_events` collections, new composite indexes, `qrcode` + Xendit SDK dependencies (all currently absent). [CONFIRMED]
- **Reuse is real:** BOM deduction, idempotency-by-hash, `writeBatch`, `CounterService`, and `onSnapshot` wrappers cover the hardest parts. [CONFIRMED]
- **Must fix before building on it:** order-number generation (→ CounterService), status lifecycle (→ new collection), transactional stock reservation (→ `runTransaction`). [CONFIRMED]
- **Dual-DB decision must be made first** — QR writes need one unambiguous production database. [CONFIRMED]

## 9. PASS / WARNING / BLOCKER summary

**BLOCKERS (5)**
1. Committed live service-account keys (R1) + `.gitignore` gaps (R2).
2. Build fails on committed `tsc` errors (R3) — verify with a live `npm run build`.
3. Firestore rules bypasses on inventory + fund-release + financial collections (R4).
4. No Xendit webhook / HTTP-function infrastructure (R5).
5. No transactional stock deduction → oversell once live payments depend on it (R10; escalates to BLOCKER at go-live).

**WARNINGS (7):** no CI/CD (R6) · dual-DB ambiguity (R7) · lint debt incl. set-state-in-effect (R8) · negligible tests (R9) · `postTransaction` no RBAC (R11) · deploy scripts mutate `firebase.json` & skip functions · `system_activity_logs` write-open.

**PASSES:** RBAC + default-deny rules core · immutable audit trails · atomic `postTransaction` · anti-spoof `counters` · production-grade BOM explosion + import idempotency · restrictive `cors.json` · explicit DB targeting in functions · reusable real-time listeners.

## 10. Recommended next actions

**Immediate (security — before anything else):**
1. **Treat the two service-account keys as compromised:** rotate/revoke in Google Cloud IAM, remove from the repo and purge from git history, and extend `.gitignore` to cover `*firebase-adminsdk*.json`, `.env.development`, `.env.test`.

**Before QR build starts (converts Master-Plan assumptions to facts):**
2. Fix the 11 `tsc` errors so `npm run build` is green (the missing `POS_ORDERS` in `COLLECTION_NAMES` directly touches the POS module QR neighbors).
3. **Decide the production database** (`(default)` vs `tng-systems`) and document it — QR writes and new indexes depend on it.
4. Remediate the rules bypasses (`|| true` ×3, PRF Stage-7 validation).
5. Design QR foundations to avoid inheriting POS flaws: `CounterService` order numbers, dedicated `qr_orders` lifecycle, `runTransaction` stock reservation.

**Program hygiene (parallel):**
6. Stand up a minimal CI gate (lint + `tsc` + build) before payment code lands.
7. Add `firebase deploy --only functions` to the deploy path so functions aren't left un-deployed once the webhook exists.

**Gate decision: CONDITIONAL PASS.** Architecture is sound and highly reusable; QR implementation should not begin until BLOCKERS 1–3 are cleared (secret rotation, green build, production-DB decision). BLOCKERS 4–5 are addressed within the QR phases (rules hardening + building the webhook); the oversell risk is designed out by using `runTransaction` in the Phase 2/3 stock check.

---

*Read-only audit — no files, code, config, rules, or credentials were modified in producing this report. Remediation is tracked in [`PRODUCTION_READINESS_REMEDIATION.md`](PRODUCTION_READINESS_REMEDIATION.md).*
