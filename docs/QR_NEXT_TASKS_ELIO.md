# QR Ordering — Next Tasks for Elio

> **Document type:** Planning only. Reflects repo state as of **2026-07-03**, branch `feat/qr-customer-menu`.
> **Source docs:** [`QR_ORDERING_MASTER_PLAN.md`](QR_ORDERING_MASTER_PLAN.md) (roadmap authority), [`QR_MVP_GAP_ANALYSIS.md`](QR_MVP_GAP_ANALYSIS.md) (current-vs-plan comparison), [`QR_SPRINT1_REMEDIATION_PLAN.md`](QR_SPRINT1_REMEDIATION_PLAN.md) (security fix tracking).
> **Gate status:** ✅ **Gate A (Security Remediation) is CLOSED** — P0-1 (keys rotated + repo cleanup) and P0-2 (production DB confirmed `tng-systems`) both resolved 2026-07-03. Gate B (Production Readiness) is the next gate, relevant only at go-live, not for continued Sprint 1/2 backend work.

---

## 1. Completed by Elio

Per the Master Plan's ownership split (§10 — Elio owns customer surface + Cloud Functions), the following is done and verified:

- **`getPublicMenu` callable** (`functions/src/qr/getPublicMenu.ts` / `.handler.ts`) — resolves a QR token → table/BU, returns a sanitized menu projection. Unit-tested: sanitization (never leaks `calculatedCost`/`grossMargin`/`marginPercent`/`foodCostPercent`/`ingredients`/`linkedInventoryItemId`/`businessUnitId`/`isActive`), invalid/missing/inactive-table rejection, rate-limit enforcement.
- **`createQrOrder` callable** (`functions/src/qr/createQrOrder.ts` / `.handler.ts`) — server-authoritative repricing (client-submitted prices ignored), atomic order-number allocation + order write inside one `runTransaction`, rate-limited. Unit-tested. Stock check explicitly deferred to Phase 5 (documented, in scope by design).
- **`createQrTable` / `listQrTables` callables** — RBAC-gated (admin-only via `functions/src/qr/auth.ts`), BU-existence + duplicate-active-table checks, `listQrTables` returns a token-omitting DTO. Unit-tested.
- **Rate limiting** (`functions/src/qr/rateLimit.ts`) — Firestore-backed fixed-window limiter, live on `getPublicMenu` (30/min/table) and `createQrOrder` (10/min/table). Unit-tested.
- **DB-target centralization** (`functions/src/qr/firestore.ts`) — single `qrDb` export resolving the closed P0-2 decision (`tng-systems`); all four callables import it.
- **Firestore rules hardening** — `qrToken` no longer exposed to any signed-in reader; `qr_orders` reads BU-scoped. Verified live via 7 Firestore-emulator tests.
- **Client integration: Customer Menu ↔ `getPublicMenu`** (`src/features/qr-ordering/services/publicMenu.service.ts` + `publicMenu.mapper.ts`, wired into `CustomerMenuView.tsx`) — real callable call, field-whitelisted mapping (defence in depth beyond the server's own sanitization), loading/error+retry/empty states, mock fallback preserved for `/order/demo` and local/unconfigured-Firebase dev.
- **Gate A closure (repo-hygiene half)** — untracked and deleted the two committed Firebase admin-key JSON files; extended `.gitignore` to a working glob; documented P0-1/P0-2 closure across the Gap Analysis, Sprint 1 Review, and Remediation Plan.
- **Test suite health** — 44 functions unit tests + 7 Firestore-emulator rules tests, all passing; functions `tsc`, root `tsc --noEmit`, and root `npm run build` all green.

**Not Elio-owned but worth noting as already done by the team:** Bar Queue mock screen (`BarQueueView.tsx`) now exists, completing 8/8 Screen Spec mock screens — this was a gap flagged in an earlier pass and has since been closed.

---

## 2. Remaining tasks (full picture, not just Elio's slice)

| # | Task | Owner (per Master Plan §10) | Phase |
|---|---|---|---|
| 1 | `createQrOrder` client wiring (cart/checkout calls the real callable instead of routing to mock checkout) | Elio | Phase 2 |
| 2 | Order-creation idempotency key (M1) | Elio | Remediation / pre-Phase 3 |
| 3 | Admin table-management UI + printable QR codes (calls the already-built `createQrTable`/`listQrTables`) | Fred | Phase 1 |
| 4 | Kitchen/Bar/Cashier queue `onSnapshot` wiring + BU-scoping + staff `Layout`/permission shell | Fred | Phase 2/4 |
| 5 | Firebase App Check enforcement (H2 remaining half) | Elio (client) + Fred/DevOps (console config) | Remediation, before real/public traffic |
| 6 | Transactional stock check in `createQrOrder` (H3 real implementation) | Elio (function) + Fred (`InventoryDeductionService` refactor) | Phase 5 |
| 7 | `createXenditSession` + `xenditWebhook` + refund callable | Elio | Phase 3 |
| 8 | `postOfficialInvoice` callable + cashier UI wiring | Elio (callable) + Fred (UI) | Phase 3.5 |
| 9 | Inventory deduction bridge (`qr_orders → COMPLETED` trigger, shared `InventoryDeductionService`) | Fred | Phase 5 |
| 10 | Real revenue/reporting feed from completed QR orders | Fred | Phase 5 |
| 11 | Refresh stale audit build-health evidence (`tsc-errors.txt`/`lint_report.txt`) | Either | Housekeeping |
| 12 | Owner triage of open decisions O1–O8 | Owner/Fred to schedule | Cross-phase |
| 13 | Git-history purge of the old committed admin keys (if repo was ever public) | Repo owner/DevOps | Security housekeeping |
| 14 | Gate B items (Firestore `|| true` rule bypasses, CI/CD baseline, deployment-path fix) | Tech lead/DevOps | Pre-go-live |

---

## 3. Safe tasks Elio can continue without Fred

These touch only Elio's existing files (Cloud Functions + customer surface), have no dependency on Fred's staff-view work, and don't need an owner decision to start:

- **Task 1 — Wire `createQrOrder` into the client.** Same pattern as `getPublicMenu`: add a `createOrder.service.ts` alongside the existing `publicMenu.service.ts`, call it from `CartDrawer`'s checkout action, keep the mock checkout flow as the fallback for `/order/demo`. Self-contained; no Fred dependency.
- **Task 2 — Idempotency key on `createQrOrder`.** Pure backend change to `createQrOrder.handler.ts` + a client-generated key threaded through the new service from Task 1. No Fred dependency, and should land *before or alongside* Task 1 so the first real client wiring is already double-submit-safe.
- **Task 5 (client half only) — App Check client wiring.** Elio can add the `firebase/app-check` client initialization and pass tokens through the existing `publicMenu.service.ts`/new order service, **without enabling enforcement** (enforcement toggle is a Firebase-console action — see §4). This means the client-side half of App Check can be built and tested now, ready to flip on later.
- **Task 7 (design only) — Xendit webhook security design review.** A paper/design exercise (token verification strategy, idempotency ledger shape, amount-validation rule) that doesn't require sandbox credentials yet — can be drafted as a doc now, ahead of Phase 3 coding, per the Gap Analysis's own recommendation.
- **Task 11 — Refresh stale audit build-health evidence.** Re-run `npm run build`/lint, replace the stale `tsc-errors.txt`/`lint_report.txt` snapshots. Pure documentation housekeeping, zero code risk.
- **Housekeeping — Lows from the Remediation Plan (L1–L6)** not yet addressed (token modulo bias, price-display TOCTOU, `isAvailable` always-true note, error-message code leakage, `functions/lib` git-tracking, missing structured logging). None require Fred or an owner decision; L4/L6 pair naturally with the App Check client work since all three touch error-handling/logging on the same callables.

---

## 4. Tasks blocked by Firebase/production access (need Fred, DevOps, or the owner)

- **Task 3 — Admin table-management UI.** Backend (`createQrTable`/`listQrTables`) is done; the UI itself is Fred's ownership area (staff views) per Master Plan §10 — Elio *could* build it, but it's explicitly Fred's slice to avoid merge conflicts on staff-facing code.
- **Task 4 — Kitchen/Bar/Cashier real-time wiring.** Needs the `qr_orders`/`qr_tables` collections to have real data flowing (which now exists) plus Fred's staff `Layout`/permission-shell integration — Fred's ownership area.
- **Task 5 (console half) — App Check enforcement toggle.** Requires a Firebase-console action (registering a reCAPTCHA Enterprise/v3 site key, flipping enforcement) that only a project owner/DevOps with console access can do. Client wiring (§3) can be finished first; enforcement itself waits on this.
- **Task 6 — Inventory stock check + deduction bridge.** Needs Fred's `InventoryDeductionService` refactor from the existing `pos-import.service.ts` BOM logic — cross-cutting with Fred's inventory ownership.
- **Task 7 (implementation half) — Xendit integration.** Blocked on an actual Xendit merchant account (KYC has real-world lead time) and sandbox credentials — an external dependency, not something either developer can unblock alone. The design-review half (§3) is not blocked and can start now.
- **Task 13 — Git-history purge.** Requires deciding whether the repo was ever public during the key-exposure window and running `git-filter-repo`/BFG — a repo-owner/DevOps call given the blast radius (rewrites all commit hashes).
- **Task 14 — Gate B items.** Firestore rule-bypass remediation, CI/CD baseline, and deployment-path fixes are tech-lead/DevOps-owned and gate production go-live, not continued feature work.
- **Task 12 — Open decisions O1–O8.** Needs an owner/accountant working session (per Gap Analysis recommendation #6); not something a developer can resolve unilaterally.

---

## 5. Exact next sprint order

Sequenced so each step either unblocks the next or is safe to start immediately without waiting on anything blocked:

1. **Idempotency key on `createQrOrder`** (§3, Task 2) — do this *before* wiring the client to `createQrOrder`, so the very first real client call is already double-submit-safe. Backend-only; no dependency.
2. **Wire `createQrOrder` into the client** (§3, Task 1) — follow the exact pattern already proven for `getPublicMenu` (`*.service.ts` + `*.mapper.ts`, mock fallback preserved). This is the direct next step after the menu wiring just completed.
3. **App Check client-side wiring, enforcement OFF** (§3, Task 5 client half) — build and test the attestation plumbing now while it's cheap to add alongside the order-service work, without flipping enforcement on.
4. **Refresh stale audit build-health evidence** (§3, Task 11) — cheap, zero-risk, can slot in anywhere; do it once rather than let it rot further.
5. **Xendit webhook security design review** (§3, Task 7 design half) — start the paper review in parallel with steps 1–4; it's pure design work and de-risks Phase 3 before any payment code is written.
6. **— Handoff point —** Once steps 1–3 land, hand off to Fred (or coordinate) for: admin table-management UI (Task 3), Kitchen/Bar/Cashier real-time wiring (Task 4). These depend on nothing Elio still needs to build, so they can run in parallel with steps 4–5 above rather than strictly after.
7. **App Check enforcement toggle** (Task 5 console half) — once the client wiring (step 3) is proven, ask DevOps/owner to flip enforcement in the Firebase console.
8. **Xendit account/sandbox credentials** (Task 7 implementation half) — start provisioning now if not already in motion (KYC lead time); implementation begins once credentials exist and the design review (step 5) is signed off.
9. **Inventory stock check + deduction bridge** (Task 6) — Phase 5, after Fred's `InventoryDeductionService` refactor; Elio's half (extending `createQrOrder`'s transaction) is a small, well-scoped addition once that service exists.
10. **`postOfficialInvoice` + reconciliation UI** (Task 8) — Phase 3.5, after the Xendit payment contract (step 8) is stable.
11. **Owner triage of O1–O8** (Task 12) — can happen at any point once someone schedules it; doesn't block 1–10 but should not be left indefinitely, since O4/O5/O6/O7 affect Phase 3 behavior.
12. **Git-history purge + Gate B items** (Tasks 13, 14) — schedule ahead of any real pilot/go-live date, independent of the feature-work sequence above.

---

## 6. Prompt list for each next task

Ready-to-paste prompts for the next session per task, self-contained with enough context to act.

### Task 1 — Idempotency key on `createQrOrder`
> Add an idempotency key to the `createQrOrder` callable to fix Remediation finding M1 (docs/QR_SPRINT1_REMEDIATION_PLAN.md §2 M1). Accept an optional client-generated `idempotencyKey` string in the input; inside the existing `runTransaction` in `functions/src/qr/createQrOrder.handler.ts`, check whether an order with that key already exists for that table within a short recency window (e.g. by querying `qr_orders` on `tableId` + `idempotencyKey`), and if so return the existing order's `orderId`/`orderNumber` instead of creating a new document. Add unit tests to `functions/src/qr/__tests__/createQrOrder.handler.test.ts` proving a repeated call with the same key returns the same order and does not double-increment the counter. Run `npm --prefix functions run test` and `npm --prefix functions run test:emulator` (Java 21 at `C:\Users\agrob\jdk21\jdk-21.0.11+10` — set `JAVA_HOME`/`Path` first) after. No deploy, no Xendit, no production Firebase.

### Task 2 — Wire `createQrOrder` into the client
> Wire the Customer Menu/Cart to the real `createQrOrder` callable, following the exact pattern used for `getPublicMenu` (see `src/features/qr-ordering/services/publicMenu.service.ts` and `publicMenu.mapper.ts`). Create `createOrder.service.ts` + a mapper if needed. The Cart's checkout action (`CartDrawer.tsx` → currently navigates straight to `/checkout/demo`) should call the real callable when not in mock/demo mode, passing the cart lines + tableId, and route to the real order-status flow with the returned `orderId`/`orderNumber` on success. Preserve the mock checkout flow for `/order/demo` and local/unconfigured-Firebase dev, matching how `CustomerMenuView` already decides mock-vs-real. Add loading/error+retry states consistent with the menu wiring. Do the idempotency-key task first if not already done, and thread the key through this new service. No Xendit, no payment, no inventory deduction, no deployment. Run functions tests, emulator tests, root typecheck, and root build after; report files changed.

### Task 3 — Admin table-management UI
> Build a staff-facing admin screen to manage QR tables, calling the already-built `createQrTable` and `listQrTables` callables (`functions/src/qr/createQrTable.ts`, `functions/src/qr/listQrTables.ts` — both RBAC-gated to `SUPER_ADMIN`/`ADMIN`, already unit-tested). The screen needs: a list of tables for the caller's business unit (via `listQrTables`, which already omits `qrToken`), a "create table" form (business unit + table number) calling `createQrTable`, and a printable QR-code view for each table's token (the callable returns `qrToken` only at creation time — plan the UI to capture/display it then, since it's not retrievable later via `listQrTables` by design). Place it inside the existing staff `Layout`/permission shell, following the app's existing admin-screen conventions. No changes to the callables themselves unless a test fails. No deployment.

### Task 4 — Kitchen/Bar/Cashier real-time wiring
> Convert the Kitchen Queue, Bar Queue, and Cashier Reconciliation mock screens (`src/features/qr-ordering/kitchen/KitchenQueueView.tsx`, `bar/BarQueueView.tsx`, `cashier/CashierReconciliationView.tsx` — currently local `useState` only) to real `onSnapshot` listeners on the `qr_orders` collection, reusing the existing reusable listener wrappers in `src/shared/services/firestore.service.ts`. Scope each queue's query to the caller's business unit (mirroring the BU-scoping already enforced server-side in `firestore.rules` for `qr_orders`). Move all three views inside the staff `Layout`/permission shell if not already (per Screen Spec §6/§7/§8's role-gated placement requirement). No changes to `createQrOrder`/order lifecycle logic — this is read-side wiring only. No deployment.

### Task 5 — App Check client-side wiring (enforcement OFF)
> Add Firebase App Check client-side initialization for the QR customer surface, following Master Plan assumption P4 (mobile web) and the existing App Check scaffold already present in `src/config/firebase.ts` (reCAPTCHA v3 provider, currently used for the general app). Ensure the QR customer flow's callable calls (`getPublicMenu`, and the new `createQrOrder` client call from Task 2) pass through App Check tokens automatically once the SDK is initialized — do **not** enable App Check *enforcement* on the Cloud Functions side; that is a separate Firebase-console action for a project owner (see docs/QR_APP_CHECK_ABUSE_PROTECTION_PLAN.md). This task is client-side plumbing only, verifiable by confirming tokens are attached to outgoing callable requests (e.g. via network inspection in a local dev preview), not by testing actual enforcement.

### Task 6 — Inventory stock check + deduction bridge (Phase 5)
> Implement the Phase 5 inventory integration for QR orders, per Master Plan §8 Phase 5 and Remediation finding H3. Two parts: (1) refactor the existing BOM-explosion stock-deduction logic in `src/features/pos/services/pos-import.service.ts` (~lines 536–705) into a shared `InventoryDeductionService` callable from both the existing POS import path and QR orders. (2) Extend `createQrOrder`'s existing transaction (`functions/src/qr/createQrOrder.handler.ts`) to read each line's linked `inventory_items` via `linkedInventoryItemId`, run the BOM-explosion check inside the same `runTransaction`, and abort the write (with a clear `failed-precondition` error) if any line is insufficiently stocked — this closes the oversell risk Master Plan A11 requires. Tag `stock_transactions.referenceId = orderId` so the existing POS importer can skip QR-sourced sales and avoid double-deduction. Add tests proving: a well-stocked order succeeds and deducts correctly; an understocked order is rejected and deducts nothing; two concurrent orders for the last unit cannot both succeed. No deployment.

### Task 7 — Xendit webhook security design review (design-only, start now)
> Write a design document (not code) for the `xenditWebhook` HTTPS function described in Master Plan §7.3–7.4, covering: `x-callback-token` verification strategy (constant-time compare, where the secret is stored/read from), the `xendit_events` idempotency ledger's exact schema and dedupe key (`payment_id` + `event`), the amount/currency re-validation rule before any state transition, and whether an IP allowlist is in scope. This is a paper/design review only — no Xendit SDK, no `onRequest` function, no sandbox credentials needed yet. Save as `docs/QR_XENDIT_WEBHOOK_SECURITY_DESIGN.md` or fold into the Master Plan §7 if preferred. Purpose: de-risk Phase 3 before a line of payment code is written, per the Gap Analysis's own recommendation.

### Task 11 — Refresh stale audit build-health evidence
> Refresh the Phase 0.5 Firebase audit's build-health evidence, which is currently stale/contradicted (docs/PHASE_0.5_FIREBASE_AUDIT.md, plus the committed `tsc-errors.txt`/`lint_report.txt` snapshots at repo root). Run `npx tsc --noEmit` and `npm run build` live, confirm they're green (they were as of 2026-07-03), replace or annotate the stale snapshot files with current output, and update the audit doc's relevant section to state the live-verified pass. Documentation/evidence-file only — no source code changes.

---

*Documentation only. No application code, configuration, Firestore rules, indexes, or Cloud Functions were created, modified, or deployed in producing this document.*
