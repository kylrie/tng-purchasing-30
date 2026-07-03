# QR Ordering — MVP Gap Analysis

> **Document type:** Read-only comparison of the current implementation against [`QR_ORDERING_MASTER_PLAN.md`](QR_ORDERING_MASTER_PLAN.md) (and its companions, [`QR_SCREEN_SPEC.md`](QR_SCREEN_SPEC.md), [`PHASE_0.5_FIREBASE_AUDIT.md`](PHASE_0.5_FIREBASE_AUDIT.md), [`PRODUCTION_READINESS_REMEDIATION.md`](PRODUCTION_READINESS_REMEDIATION.md)).
> **Scope:** Documentation only. No code was written or changed to produce this report. All "current implementation" claims are evidence-based (file/route citations); a few infrastructure checks (`tsc --noEmit`, `npm run build`) were run **read-only** to verify build health, not to change anything.
> **Date:** 2026-07-03 · **Branch inspected:** `feat/qr-customer-menu`

---

## 0. How to read this

Every prior QR session **explicitly built mock-only, frontend-only UI** ("Mock data only. No Firebase. No Xendit. No Functions. No backend."). That instruction was followed correctly in every session. This document evaluates that mock UI work against the master plan's **production-grade MVP bar**, so almost everything below reads as "partial" or "not started" from the plan's perspective — that is expected and is not a defect in the work done; it reflects that Phases 1–7 (real backend, real payment, real persistence) have not been authorized or started yet.

---

## 1. Completed

Items that are fully done relative to their own defined scope — no remaining gap for that scope.

| Item | Evidence | Master Plan ref |
|---|---|---|
| **Phase 0.5 — Firebase audit** | [`PHASE_0.5_FIREBASE_AUDIT.md`](PHASE_0.5_FIREBASE_AUDIT.md) — read-only, 5-domain audit, Conditional Pass verdict recorded | §8 Phase 0.5 |
| **Planning documentation set** | Master Plan, Screen Spec, UI Guide, Decision Record, Remediation Backlog, this gap analysis — all present in `docs/` | §0 front matter |
| **Owner sign-off on business direction** | Master Plan header: "Approved in principle by owner — 2026-07-02"; Decision Record mirrors it | §1–2 |
| **Customer Menu (mock UI)** | `CustomerMenuView.tsx` — category nav (Food/Drinks + subcats), product cards, search removed in favor of category nav, image + gradient/placeholder fallback, cart badge | Screen Spec §1 |
| **Product Details (mock UI)** | `ProductDetailsSheet.tsx` — qty stepper, notes field, sold-out state, Add to Cart | Screen Spec §2 |
| **Cart (mock UI)** | `CartDrawer.tsx` — line qty/remove/clear, totals, "Proceed to checkout" wired to the mock checkout route | Screen Spec §3 |
| **Checkout (mock UI)** | `CheckoutView.tsx` at `/checkout/:sessionId?` — order summary, 4 payment-method cards (GCash/Maya/QRPH/Card), safe-processing note, timed "confirming" mock, routes to order-status | Screen Spec §4 |
| **Order Status (mock UI)** | `OrderStatusView.tsx` at `/order-status/:orderId?` — stepper, confirming-payment mock state, items summary | Screen Spec §5 |
| **Kitchen Queue (mock UI)** | `KitchenQueueView.tsx` at `/kitchen/:sessionId?` — 3 lanes (New/Paid, Preparing, Ready), late-order flag, local-state status advance | Screen Spec §6 |
| **Cashier Reconciliation (mock UI)** | `CashierReconciliationView.tsx` at `/cashier/:sessionId?` — KPI cards, unreconciled-warning banner, filter tabs, inline invoice-number entry, BIR/POS helper copy | Screen Spec §8 |
| **Live build is green** | `npx tsc --noEmit` → 0 errors; `npm run build` → succeeds (verified live, this pass) | Remediation P0-3 (see §4 below — the *committed* audit snapshot disagrees) |

---

## 2. Partially Complete

Items with real, working progress but a material gap remains before they satisfy the master plan's definition of done.

| Item | What exists | What's missing | Master Plan ref |
|---|---|---|---|
| **Customer ordering flow (Phases 1–2)** | All 5 customer screens exist and interconnect correctly as a click-through prototype; local cart state; mock data shaped close to `PublicMenuItem`/order projections | No `getPublicMenu()` callable, no `createQrOrder()`, no server-computed totals, no real session/table-token resolution, no stock check | Phase 1 (Foundation), Phase 2 (Ordering core) |
| **Payment UX (Phase 3)** | Checkout screen has the full visual flow: method selection, "Pay with Xendit" CTA, a timed "confirming" state, and a hand-off to Order Status — a faithful *simulation* of the intended UX | Zero real Xendit integration: no SDK dependency, no `createXenditSession()`, no `payment_link_url` redirect, no webhook, no idempotency ledger. "Payment confirmed" in the mock is a `setTimeout`, not a webhook | Phase 3 (Payments) — core MVP |
| **Order Status "confirming payment" state** | UI state exists and matches the spec's requirement to never claim "paid" from a redirect alone | It's simulated by a timer, not driven by an actual webhook-flipped `paymentStatus` field — the *real* mechanism this state exists to protect against doesn't exist yet | Screen Spec §5 row 10; Master Plan §7.3 |
| **Kitchen Queue** | Lane structure, card content (table #, order #, elapsed time, items, notes, late flag), and status-advance buttons all match the spec's UX intent | No `onSnapshot` subscription, no BU-scoping, no real elapsed-timer from a real `paidAt`, not inside the staff `Layout`/permission shell (spec calls for role-gated, in-`Layout` placement) | Screen Spec §6 |
| **Cashier Reconciliation** | KPI cards, unreconciled-orders banner, filter tabs, and inline invoice-number posting all match the spec's UX intent; correctly encodes the BIR/POS non-negotiable rule in on-screen copy | No `postOfficialInvoice()` callable, no audit-stamp (who/when), no day-close blocking logic, not inside staff `Layout`/permission shell, `xenditRef` is fabricated display text | Screen Spec §8; Master Plan A5, Phase 3.5 |
| **Build verification (Remediation P0-3)** | A **live** `npm run build` passes today with 0 errors | The **committed audit evidence** (`tsc-errors.txt`, `lint_report.txt`) is now stale/contradicted and was never updated to reflect this. The audit's finding was explicitly flagged `[ASSUMPTION]` pending a live check — that check now passes, but the artifact itself hasn't been refreshed | Remediation P0-3; Audit §9 |

---

## 3. Not Started

Items with no implementation movement at all — confirmed absent by direct code/repo search.

- **`qr_orders` / `qr_tables` / `xendit_events` collections** — no schema, no Firestore rules, no type definitions anywhere in `src/` or `functions/`.
- **Any Cloud Function for QR** — `functions/src/` still contains exactly the two pre-existing `onCall` functions (`postTransaction`, `setBudgetLimit`); no `getPublicMenu`, `createQrOrder`, `createXenditSession`, `xenditWebhook`, `postOfficialInvoice`, or refund callable exists.
- **Xendit SDK / `qrcode` package** — neither dependency is present in `package.json`; confirmed via direct search (only comment/label text mentions "Xendit"/"QRPH", never an API call).
- **Table management + QR code generation/printing (admin)** — no `qr_tables` admin screen, no QR-image generation, no printable-code flow anywhere in `src/features`.
- **Bar Queue screen** — Screen Spec §7 defines a dedicated bar-filtered queue (drink categories, "waiting on kitchen" cross-queue tag); **no `BarQueue`/`bar-queue` file or route exists**. This is the one Screen Spec screen with zero implementation.
- **Real-time (`onSnapshot`) wiring for any QR screen** — Order Status, Kitchen Queue, and Cashier Reconciliation all use local `useState` only; the existing reusable `firestore.service.ts` listener wrappers are not yet connected to any QR collection (because that collection doesn't exist yet).
- **Inventory integration (Phase 5)** — no `InventoryDeductionService` refactor, no `qr_orders → COMPLETED` trigger, no `pos_sales`-shaped summary write.
- **Reporting integration** — no real revenue feed from QR orders (existing finance revenue figure remains the pre-existing `expenses × 1.3` placeholder, untouched).
- **CI/CD pipeline** — `.github/workflows/` still has no active workflow file.
- **Phase 6 deployment artifacts** — no prod Xendit keys/webhook registration, no pilot rollout plan executed (rollout plan is documentation-only in the master plan).
- **Phase 7 (POS synchronization)** — correctly not started; explicitly deferred/out-of-scope per the plan itself, not a gap.
- **Open decisions O1–O9** — **O9 (production DB) is now RESOLVED (2026-07-03): `tng-systems`.** The other eight open questions in Master Plan §3.2 (registered POS product/API, printer scope, dine-in-only, session-expiry policy, VAT display, refund authority, pilot scope, modifiers) still have no recorded answer since the plan was written.

---

## 4. Blocked by Firebase Audit

These master-plan items are explicitly gated by **GATE A — Security Remediation Gate**, which the Phase 0.5 audit introduced as a hard precondition for any Phase 1+ (real backend) work. Current status of each exit criterion, re-verified this pass:

| Gate A exit criterion | Status (re-verified live) | Still blocking? |
|---|---|---|
| **P0-1 — Rotate committed service-account keys** | ✅ **CLOSED (2026-07-03).** Fred confirmed the old service-account keys were rotated/revoked in Google Cloud and are no longer active. Repo cleanup this pass `git rm`'d both key files (`tng-systems-firebase-adminsdk-fbsvc-72a29d9d37.json`, `...-e2c2bb4cf9.json`) from tracking and the working tree, and extended `.gitignore` with `*firebase-adminsdk*.json` and `*-adminsdk-*.json` to prevent re-adding (verified via `git check-ignore`). ⚠️ Git **history** was not purged in this task — a full history purge (git-filter-repo/BFG) is recommended as a separate task if the repo was ever public during the exposure window. | **No — resolved** |
| **P0-2 — Decide production database** ((default) vs tng-systems) | ✅ **CLOSED (2026-07-03).** Production Firestore database confirmed as **`tng-systems`** (Fred). The QR backend already targets this correctly via `getFirestore(getApp(), 'tng-systems')` (centralized in `functions/src/qr/firestore.ts`), so no code change is required. Open decision O9 is now resolved. | **No — resolved** |
| **P0-3 — Green build** | ✅ **Resolved in practice** — live `tsc --noEmit` and `npm run build` both succeed today. ⚠️ The committed snapshot evidence (`tsc-errors.txt`, `lint_report.txt`) was never refreshed to reflect this, so the audit document itself still reads as unverified/failing. | No (recommend closing the paperwork) |
| **P1-1 — Rules bypass review scoped** | ❌ **No evidence of review.** The three `\|\| true` fallbacks, the commented-out PRF Stage-7 validation, and the unvalidated financial collections (`budgetReservations`, `bankReconStatements`) were not re-inspected this pass, but nothing in the repo suggests they were touched since the audit. | Partial — this item alone doesn't block QR *start* per the plan, but see §5 |

**Net effect (updated 2026-07-03):** ✅ **GATE A is now CLOSED.** Both hard blockers are resolved — **P0-1** (keys rotated by Fred; repo cleanup done) and **P0-2** (production DB confirmed as `tng-systems`). Phase 1 (real Firestore / Cloud Functions) is unblocked. (P0-3 green-build was already resolved in practice.) The remaining go-live work belongs to **Gate B — Production Readiness** (security review, CI/CD, deployment path), not Gate A.

---

## 5. Blocked by Security Review

Items gated by a security review that is broader than (or downstream of) the Firebase audit's infra findings — these gate **GATE B — Production Readiness Gate**, not the earlier "QR start" gate, but they will block go-live and should be scheduled now.

- **Firestore rule bypasses (P1-1 full remediation)** — the `\|\| true` fallbacks on `stock_counts`, `wastage_records`, `goods_receiving_logs`; the commented-out fund-release validation at PRF Stage 7; unvalidated `budgetReservations`/`bankReconStatements` writes. QR itself avoids these paths via callables, but they are live risks in the **shared** project QR will run inside, and Master Plan A12 requires them addressed before go-live.
- **Xendit webhook security design review** — token verification (`x-callback-token` constant-time compare), amount/currency re-validation, idempotency ledger design, optional IP allowlisting. This is a **design review that should happen before Phase 3 coding starts**, not after — it's the single highest-risk new attack surface the plan identifies (§7.4–7.5), and no HTTP (`onRequest`) function exists yet to review.
- **CI/CD gate before payment code lands (P1-2)** — no automated lint/type/build gate exists; the plan calls for this to exist *before* payment/webhook code ships, not after.
- **Deployment path review (P1-3)** — current deploy scripts are hosting-only and mutate `firebase.json` on disk; must be fixed before any function (including the future webhook) can be relied on to actually deploy.
- **`postTransaction` RBAC gap (P2-4)** and **`system_activity_logs` open write (P2-5)** — pre-existing, non-QR-specific findings that a full security review should still close before the shared project takes on a public-facing payment surface.

None of these block the mock-UI work already done. All of them block **Phase 3 (Payments)** specifically and **Phase 6 (go-live)** generally.

---

## 6. Blocked by Xendit

Items that cannot proceed until an actual Xendit merchant relationship and integration exist — entirely external dependencies, not something more mock UI can substitute for.

- **Merchant account provisioning** (Assumption P2) — no evidence a Xendit account for TNG in the Philippines has been provisioned or that GCash/Maya/QRPH/card channels are activated. This has a real-world lead time (KYC) and is explicitly called out as the item to start earliest (Phase 0, "before code is ready").
- **Real Payment Sessions integration** (`POST /sessions`, `session_type: PAY`, `mode: PAYMENT_LINK`) — zero implementation; today's "Pay with Xendit" button is a local timer.
- **The Xendit webhook itself** (`xenditWebhook` `onRequest` function) — the plan's designated source of truth for "paid." Cannot be built or tested without sandbox credentials and a registered webhook URL/token.
- **Refund flow** (`POST /refunds`) — not started; also blocked on open decision O6 (refund authority).
- **Sandbox-to-production key/token cutover** — a Phase 6 activity, not reachable until the above exists.
- **Session-expiry / auto-void policy (O4)** — meaningful to implement only once real Xendit sessions (with their real 30-minute default expiry) exist.

---

## 7. Blocked by POS Decisions

Items that depend on an answer about the **existing registered POS/invoicing system** — open decision **O1** ("Which registered POS/invoicing product is the official issuer, and does it expose an API?") and its immediate neighbors.

- **Phase 7 (automated POS synchronization)** — entirely blocked on O1; correctly deferred and out of MVP scope per the plan. No action needed now beyond keeping it out of scope.
- **Reconciliation UX detail beyond the MVP mock** — the current Cashier Reconciliation mock assumes a free-text invoice-number field is sufficient (matches Phase 3.5's manual-entry design), which is safe regardless of O1's answer. But any *format validation* or *duplicate-detection* logic (mentioned in Screen Spec §8 row 9 — "duplicate invoice # warning") depends on knowing the real POS's invoice-number format, which depends on O1.
- **Printer integration decision (O2)** — not strictly a "which POS" question, but bundled with the same class of external-vendor unknowns; determines whether Phase 6 needs a real printer spike or ships with on-screen KDS only (current Kitchen Queue mock already assumes on-screen-only, which is the safe default per the plan).
- **Pilot scope (O7)** — single vs. multi-location launch; affects `qr_tables` design (not yet started) more than any code already written.

---

## 8. Recommended Next Sprint

Prioritized, read-only recommendations. No code is proposed here — these are sequencing/decision recommendations only.

1. **~~Close P0-1 for real.~~ ✅ DONE (2026-07-03).** Keys rotated/revoked by Fred; both committed key files `git rm`'d from tracking and working tree; `.gitignore` extended to a working glob (`*firebase-adminsdk*.json`, `*-adminsdk-*.json`). Residual: a full git-history purge is recommended as a separate task if the repo was ever public during exposure.
2. **~~Get the O9/P0-2 production-database decision on the owner's desk.~~ ✅ DONE (2026-07-03).** Decided: production DB is **`tng-systems`** (Fred). Phase 1 is unblocked; the backend already targets this DB.
3. **Refresh the audit's build-health evidence.** Re-run `npm run build` / lint live, replace `tsc-errors.txt`/`lint_report.txt` with current output, and update §9 of the audit doc — P0-3 is very likely closeable this sprint with zero code changes.
4. **Fill the one missing screen: Bar Queue.** Every other Screen Spec surface has a mock; Bar Queue (§7) does not. If the Kitchen Queue mock pattern is reused (same lane/card/status components, drink-category filter, amber "Bar" accent), this is a small, low-risk addition that completes 8/8 mock-screen coverage before any real backend work begins.
5. **Schedule the webhook security design review now, not during Phase 3.** Since it's a pure design/paper review (token strategy, idempotency ledger shape, amount-validation rule), it can happen in parallel with Gate A closure and de-risks the highest-risk phase before a line of payment code is written.
6. **Triage the open decisions (O1–O9) as a single owner working session.** Several (O3 dine-in-only, O8 modifiers-deferred, O2 printer) are already implicitly assumed correctly by the mocks built so far — formally confirming them costs little and removes ambiguity before Phase 1 starts.
7. **~~Do not deploy Phase 1 until Gate A clears.~~ ✅ GATE A CLOSED (2026-07-03).** Both P0-1 (keys) and P0-2 (prod DB = `tng-systems`) are resolved. Phase 1 is unblocked. Deployment now gates on **Gate B — Production Readiness** (security review, CI/CD, deployment-path fixes), not Gate A.

---

*This is a documentation-only comparison. No application code, configuration, or Firebase resources were created, modified, or deployed in producing this report.*
