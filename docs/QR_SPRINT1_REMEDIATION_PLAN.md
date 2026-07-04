# QR Ordering — Sprint 1 Remediation Plan

> **Document type:** Originally planning-only; **updated 2026-07-03 (later same day) to record actual implementation status** now that the fixes below have been built and tested. Sections below are annotated ✅/🟡/❌ against the plan as written.
> **Source of truth:** [`QR_SPRINT1_REVIEW.md`](QR_SPRINT1_REVIEW.md) (16 findings: 1 Critical, 3 High, 6 Medium, 6 Low). This plan resolves the Critical, High, and Medium findings; Lows are triaged but not planned in detail (see §4).
> **Date:** 2026-07-03
> **Implementation status at a glance:** ✅ C1 (Gate A), H1+M5 (RBAC/BU-scope on `createQrTable`), M3 (`qrToken` no longer exposed), M4 (`qr_orders` BU-scoped), M6 (DB centralized), H2 rate-limit half, **M1 (idempotency) DONE 2026-07-03**. 🟡 H2 App Check half (deliberately not enabled yet). ❌ H3 real stock check (correctly deferred to Phase 5).

---

## 1. Fix plan — Critical & High findings

### C1 — Deploying onto an open Gate A *(Critical — CLOSED 2026-07-03)*
Not a code fix — a release-process gate. ✅ **Both preconditions are now met, so Gate A is CLOSED:**
- **P0-1** (service-account keys) — ✅ CLOSED: Fred confirmed the old keys were rotated/revoked in Google Cloud; repo cleanup removed both tracked JSON files from tracking + working tree and extended `.gitignore` to a working glob (`*firebase-adminsdk*.json`, `*-adminsdk-*.json`). ⚠️ Git history not purged in that task — recommended separately if the repo was ever public during exposure.
- **P0-2** (production database) — ✅ CLOSED: confirmed as **`tng-systems`** (Fred), which the backend already targets via `getFirestore(getApp(), 'tng-systems')`. No code change required.
**Owner:** repo owner / DevOps, per `PRODUCTION_READINESS_REMEDIATION.md`. **Verification:** both items marked resolved in that backlog (2026-07-03). Remaining deploy preconditions now live under Gate B — Production Readiness.

### H1 — `createQrTable` has no RBAC *(High)* — ✅ IMPLEMENTED
**Done:** `functions/src/qr/auth.ts` (`requireStaffRole`) replaces the `if (!request.auth)`-only check with a real role check against `users/{uid}.role`, mirroring the existing app's role/permission pattern; fails closed on missing/unknown role; rejects with `permission-denied`. Allow-listed to `SUPER_ADMIN`/`ADMIN` (`QR_TABLE_ADMIN_ROLES`).
**Bundled in the same change, as planned:**
- ✅ BU-existence check — `createQrTable` verifies the referenced `businessUnitId` corresponds to a real `businesses` document (`not-found` otherwise).
- ✅ Duplicate-active-table check — rejects (`already-exists`) if an active table with the same `tableNumber` already exists in that BU.
- 🟡 "Constrain to a BU the caller is authorized for" — RBAC currently gates on role (admin), not a per-caller BU allow-list; ADMIN/SUPER_ADMIN are cross-BU by design in this app (mirrors the existing `belongsToSameBU` rules helper's admin exception), so this is a deliberate design choice, not an oversight — flagged here in case a narrower BU-scoped admin role is later introduced.

### H2 — No abuse protection on anonymous callables *(High)* — 🟡 PARTIALLY IMPLEMENTED (rate limit done, App Check deliberately deferred)
**Two parts:**
1. **Firebase App Check** on `getPublicMenu` and `createQrOrder` — ❌ **Not enabled yet, by explicit decision** (task rule: "do not enable App Check enforcement yet" — needs client-side attestation wiring not yet present). Design captured in [`QR_APP_CHECK_ABUSE_PROTECTION_PLAN.md`](QR_APP_CHECK_ABUSE_PROTECTION_PLAN.md) as a plan, not half-built code.
2. **A lightweight rate limit** keyed on the resolved `tableId` — ✅ **IMPLEMENTED.** `functions/src/qr/rateLimit.ts`: a Firestore-backed fixed-window limiter (`qr_rate_limits` collection), applied to both `getPublicMenu` (30 req/min per table) and `createQrOrder` (10 req/min per table), atomic via `runTransaction`, generic customer-facing message (never reveals the threshold). Unit-tested (pure decision logic + the transactional wrapper via `FakeFirestore`).

### H3 — Missing stock validation / plan divergence *(High)*
**This finding has two separate outputs, not one fix:**
1. **Documentation reconciliation (in scope for this remediation pass):** amend `QR_SPRINT1_IMPLEMENTATION_PLAN.md` §4 to state explicitly that the transactional stock check is deferred to the Master Plan's Phase 5 (Inventory Integration), matching what Sprint 1 actually built under the "no inventory deduction" instruction. This removes the plan/code contradiction the review flagged, with zero code risk.
2. **Forward-scheduled implementation (out of scope for this remediation pass, tracked here so it isn't lost):** when Phase 5 starts, extend `createQrOrder`'s existing transaction — which already reads menu items in the correct place — to also read each line's linked `inventory_items` via `linkedInventoryItemId`, run the BOM-explosion check, and abort the write if any line is insufficiently stocked. This reuses the audit-confirmed BOM logic rather than reimplementing it, per the Master Plan's existing plan to refactor it into a shared `InventoryDeductionService`.

---

## 2. Fix plan — Medium findings

### M1 — No order-creation idempotency — ✅ IMPLEMENTED (2026-07-03)
**Done:** `createQrOrder` now accepts an optional client-supplied `idempotencyKey` (a.k.a. `clientRequestId`), validated `[A-Za-z0-9_-]{8,64}` in `orderLogic.validateCreateOrderInput`. Inside the existing `runTransaction`, a **table-scoped** dedupe record at `qr_order_idempotency/${tableId}:${key}` is read first; a repeat submit with the same (table, key) returns the original `orderId`/`orderNumber` with no new document and no counter bump. The record is written in the same transaction as the order + counter, so two concurrent submits collide and the loser retries into the short-circuit (Firestore optimistic concurrency). `qr_order_idempotency` is locked in `firestore.rules` (`read, write: if false`). The customer client (`CustomerMenuView` → `createOrder.service.ts` `newIdempotencyKey`) mints one key per submit and reuses it across retries, regenerating after success. Covered by 5 handler tests + 2 validator tests.

### M2 — Single hot counter document — ⬜ Deferred (unchanged)
**Fix (deferred by default — see §4):** if pilot load data ever shows contention on `counters/qr`, the standard remedy is a sharded counter (N sub-documents summed on read, randomly selected on write) or decoupling order-number assignment from the write transaction. Not scheduled; no pilot-scale evidence of contention yet.

### M3 — `qr_tables` read exposes `qrToken` — ✅ IMPLEMENTED
**Done:** `functions/src/qr/listQrTables.handler.ts` returns a token-omitting projection (`{ id, tableNumber, isActive }` only) via a new RBAC-gated `listQrTables` callable; the raw `qr_tables` document (with `qrToken`) is no longer the read path for staff. Verified live: `rules.emulator.test.ts` asserts a normal employee cannot directly read a table (`qrToken` hidden) while ADMIN can (admin path is the callable/rules-console-exception case, not a client read).

### M4 — `qr_orders` read not business-unit scoped — ✅ IMPLEMENTED
**Done:** `firestore.rules` scopes `qr_orders` reads to the caller's own business unit(s), using the same BU-membership helper pattern the rest of the project uses; ADMIN reads cross-BU by design. Verified live via 3 emulator tests: own-BU read allowed, other-BU read denied, ADMIN cross-BU read allowed — plus a direct-write-denied test (`write: if false` — all writes are server-side only via the Admin SDK).

### M5 — `createQrTable` integrity gaps — ✅ IMPLEMENTED
**Done:** bundled into H1's implementation (§1) as planned — BU-existence and duplicate-`tableNumber` checks live in `createQrTable.handler.ts` alongside the RBAC fix.

### M6 — Hardcoded `'tng-systems'` DB target — ✅ IMPLEMENTED
**Done:** `functions/src/qr/firestore.ts` exports a single `qrDb` (and `QR_DATABASE_ID` constant) that `getPublicMenu`, `createQrOrder`, `createQrTable`, and `listQrTables` all import — one place encodes the P0-2 answer (`tng-systems`), removing the three-copy drift risk the finding flagged.

---

## 3. Which findings block deployment

"Deployment" here means deploying these functions/rules/indexes to the live Firebase project — staging or production — at all, given the project has no isolated sandbox and self-registration means "signed-in" is not a strong trust signal.

| Finding | Blocks deployment? | Why |
|---|---|---|
| **C1** | ✅ **CLOSED 2026-07-03.** | Gate A closed — P0-1 (keys) + P0-2 (prod DB = `tng-systems`) both resolved. No longer a Gate A deploy blocker; remaining deploy preconditions are Gate B. |
| **H1** | ✅ **RESOLVED.** | `requireStaffRole` RBAC (admin-only) implemented in `auth.ts`; no longer a privilege-escalation path. |
| **H2** | 🟡 **Rate-limit half resolved; App Check half still needed before real/public traffic.** | Per-table rate limiting is live (blunts scripted flooding today). Firebase App Check attestation is deliberately not enabled yet — still needed before this surface is exposed to real, uncontrolled diner traffic (an internal/pilot-controlled test environment is lower-risk without it). |
| **H3** | **Yes, before real ordering/payment.** | Oversell risk. Not a risk while no payment exists and no real diners are ordering; correctly deferred to Phase 5; becomes a hard blocker the moment Sprint 2 (payment) or any live pilot begins. |
| **M3** | ✅ **RESOLVED.** | `qrToken` no longer reachable via any signed-in-staff read path; verified live via emulator test. |
| **M4** | ✅ **RESOLVED.** | `qr_orders` reads are BU-scoped in `firestore.rules`; verified live via emulator test (own-BU allowed, other-BU denied, ADMIN cross-BU allowed). |
| **M6** | ✅ **Resolved (centralized).** | P0-2 closed — DB target confirmed as `tng-systems`, centralized in `functions/src/qr/firestore.ts`. Correct target, single source of truth. |

**Updated net:** C1, H1, M3, M4, M6 are resolved. **Remaining before any deploy to the live project: H2's App Check half, and H3's real stock check before real ordering/payment begins** (H3 itself is correctly out of scope until Phase 5).

---

## 4. Which findings can be deferred

| Finding | Deferrable? | Condition |
|---|---|---|
| **M1** | Deferrable for an initial *internal-only* controlled test (manual cleanup of any duplicate junk orders is tolerable when no money has changed hands). **Hard-blocks before Sprint 2 payment code lands** — a duplicate submit must never become a duplicate charge. |
| **M2** | Fully deferrable. No pilot-scale evidence of contention yet; revisit only if real throughput data warrants it (ties to still-open O7, pilot scope). |
| **M5** | Not independently deferrable — bundled into H1 (§1/§2), so it resolves at the same time by construction, not by separate scheduling. |
| **L1** (token modulo bias) | Deferrable indefinitely. Negligible entropy loss at 18 chars; hygiene-only. |
| **L2** (price display↔charge TOCTOU) | Deferrable. Re-pricing from source is the safer default already; a price-confirmation UX is a product nicety, not a security gap. |
| **L3** (`isAvailable` always `true`) | Deferrable — a product-parity note for whenever the Sprint 2 UI wiring happens, not a backend defect. |
| **L4** (error-message leakage) | Cheap enough to fix opportunistically; not a deployment blocker on its own, but worth doing alongside the H2 work since both touch error-handling paths. |
| **L5** (`functions/lib` tracked in git) | Deferrable — a repo-hygiene decision (gitignore + CI build) independent of this feature. |
| **L6** (no observability) | Deferrable for Sprint 1 volumes; should be picked up together with H2's rate-limiting work since both want request-level logging. |

---

## 5. Exact implementation order

Sequenced so each step either unblocks or de-risks the next; mechanical/cheap items go first so later diffs are written against final structure, not against something about to change again.

1. **~~Gate A external closure~~ ✅ DONE (2026-07-03)** (§1 C1) — P0-1 (keys) + P0-2 (prod DB = `tng-systems`) both closed.
2. **~~M6~~ ✅ DONE** — DB-target module centralized in `functions/src/qr/firestore.ts`.
3. **~~H1 + M5~~ ✅ DONE** — RBAC, BU-existence, and duplicate-table checks on `createQrTable`, in `auth.ts` + `createQrTable.handler.ts`.
4. **~~M3~~ ✅ DONE** — `listQrTables` callable returns a token-omitting DTO; direct `qr_tables` reads by non-admin staff denied (verified live).
5. **~~M4~~ ✅ DONE** — `qr_orders` read rule is BU-scoped (verified live).
6. **~~H2 (rate-limit half)~~ ✅ DONE** — `rateLimit.ts` live on `getPublicMenu`/`createQrOrder`. **App Check half — ❌ still open by deliberate decision** (needs client-side attestation wiring; tracked in `QR_APP_CHECK_ABUSE_PROTECTION_PLAN.md`).
7. **M1 — ✅ DONE (2026-07-03).** Idempotency key on `createQrOrder` (table-scoped `qr_order_idempotency` dedupe record) + client key generation/reuse. Closes the last blocker before Phase 3 payment code.
8. **H3 documentation reconciliation** — done implicitly (Master Plan Phase 2/5 sections now state the deferral explicitly); the actual BOM stock-check implementation remains scheduled into the Phase 5 Inventory Integration sprint, not before.
9. **M2** — not scheduled; revisit only if pilot load data warrants it (§4).
10. **Lows** — still opportunistic; unchanged from the original plan (L1/L2/L3/L4/L5/L6 not yet addressed).

---

## 6. Tests required — ✅ implemented and passing (2026-07-03)

| Fix | Test type | Status |
|---|---|---|
| **H1 + M5** (`createQrTable` RBAC/scope) | `functions/src/qr/__tests__/createQrTable.handler.test.ts` (unit, `FakeFirestore`) | ✅ Passing — covers unauthenticated rejection, non-admin rejection, non-existent BU rejection, duplicate-active-table rejection, and the success path. |
| **H2 — App Check** | Not testable yet — not enabled | ❌ Deferred with the feature itself; will need manual/staging verification once enabled. |
| **H2 — rate limit** | `functions/src/qr/__tests__/rateLimit.test.ts` (unit, pure decision logic + `enforceRateLimit` via `FakeFirestore`) + exercised inside `getPublicMenu.handler.test.ts`/`createQrOrder.handler.test.ts` | ✅ Passing — proves N allowed then blocked, window-reset recovery, independent per-key budgets, generic non-revealing block message. |
| **H3 — doc reconciliation** | Documentation-only | ✅ Done — Master Plan Phase 2/5 now state the deferral explicitly. Phase-5 stock-check test still to be written at that time. |
| **M1 — idempotency** | `orderLogic.test.ts` (key validation) + `createQrOrder.handler.test.ts` (first-request, retry-returns-same + no double counter bump, same-key-different-table, different-keys, invalid-key) | ✅ Done — 7 tests passing. Firestore concurrent-collision path relies on real transaction retry (documented; not reproducible in the single-threaded FakeFirestore). |
| **M2 — sharded counter** | Not applicable | ⬜ Deferred per §4. |
| **M3 — `qrToken` exposure** | `functions/src/qr/__tests__/rules.emulator.test.ts` (Firestore-emulator, real rules context) | ✅ Passing — normal employee cannot directly read a table (`qrToken` hidden); ADMIN can; no client can write directly. |
| **M4 — `qr_orders` BU scope** | `rules.emulator.test.ts` | ✅ Passing — own-BU read allowed, other-BU read denied, ADMIN cross-BU read allowed, no client write. |
| **M6 — centralized DB module** | Import-level (`functions/src/qr/firestore.ts` is the sole `qrDb` export, imported by all four callables) | ✅ Verified by code inspection; no dedicated test needed for a single-module import. |
| **Regression, every step** | `npm --prefix functions run test` (44 tests) + `npm --prefix functions run test:emulator` (7 tests) + `functions` `tsc` + root `tsc --noEmit` + root `npm run build` | ✅ **All green as of 2026-07-03** (see verification run this date; emulator suite requires a local JDK — Temurin 21 confirmed working). |

**Total: 44 functions unit tests + 7 Firestore-emulator rules tests, all passing.**

---

*Originally documentation-only; this update (2026-07-03) records actual implementation and test status now that the fixes have shipped. No code changes were made in producing this documentation update itself.*
