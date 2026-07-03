# TNG QR Ordering — Master Plan (Authoritative Source of Truth)

> **Status:** Approved in principle by owner — 2026-07-02
> **Document type:** Unified architecture + roadmap + delivery plan
> **Authority:** This is the **single source of truth** for the QR Ordering initiative. It merges (a) the original architecture review, (b) the Xendit payment revision, and (c) the owner-approved business direction. Where any other document, chat message, or older note conflicts with this file, **this file wins**.
> **Scope of this file:** Planning and documentation only. It contains no application code and does not authorize implementation. Implementation begins only on a separate, explicit go-ahead.

---

## 0. How to read this document

| Section | What it answers |
|---|---|
| [1. Executive summary](#1-executive-summary) | The decision and why |
| [2. Approved business direction](#2-approved-business-direction) | The end-to-end flow the owner approved |
| [3. Decision register](#3-decision-register) | Approved decisions / Open decisions / Assumptions / Risks |
| [4. Current-state analysis](#4-current-state-analysis-what-already-exists) | What already exists in the codebase (evidence-based) |
| [5. Gap analysis](#5-gap-analysis) | Reuse vs extend vs build-new, per module |
| [6. Target architecture](#6-target-architecture) | Flows, data model, security |
| [7. Payment architecture (Xendit)](#7-payment-architecture-xendit) | The MVP payment + reconciliation design |
| [8. Development roadmap](#8-development-roadmap-phases-0-7) | Phases 0–7, incl. deferred Phase 7 |
| [9. Timeline estimate](#9-timeline-estimate-re-estimated) | Optimistic / realistic / conservative |
| [10. Developer ownership](#10-developer-ownership-elio--fred) | Elio & Fred responsibilities |
| [11. MVP boundaries](#11-mvp-boundaries) | In scope / out of scope |
| [12. Slack Announcement Draft](#12-slack-announcement-draft) | Copy-paste stakeholder summary |
| [Appendix A. Evidence index](#appendix-a-evidence-index-file-citations) | File citations backing the analysis |

**Related documents:** the [Phase 0.5 Firebase Audit](PHASE_0.5_FIREBASE_AUDIT.md) (official audit artifact) and the [Production Readiness Remediation Backlog](PRODUCTION_READINESS_REMEDIATION.md) (P0/P1/P2 tracking). The two roadmap gates (GATE A / GATE B in Section 8) are driven by those documents.

**Confirmed fact vs assumption:** claims are marked `[CONFIRMED]` when backed by a cited file, or `[ASSUMPTION]` when not yet verified. Do not treat assumptions as settled.

---

## 1. Executive summary

**Decision: Build QR Ordering as a new module *inside* the existing TNG ERP repository (`tng-purchasing-30`), not as a standalone Firebase app.**

The ERP already contains mature, directly reusable foundations — Firebase Auth with a dynamic role/permission system, an inventory engine with BOM (bill-of-materials) explosion and stock deduction, menu management with recipe costing linked to inventory, and a reusable real-time (`onSnapshot`) data layer. A standalone app would duplicate all of this for no benefit and would fragment reporting and inventory truth across two systems.

The target ERP shape:

```
TNG ERP
├─ Procurement
├─ Inventory
├─ Menu
├─ POS
├─ Finance
├─ Dashboard
├─ Notifications
└─ QR Ordering Module (NEW)
```

**Payment is online via Xendit and is in MVP.** A diner scans a table QR, orders on their phone, and pays through Xendit (GCash / Maya / QRPH / card). Only a **webhook-confirmed** payment releases the order to the kitchen/bar. The order then flows into inventory and operational reporting.

**BIR boundary (hard rule):** TNG QR Ordering does **not** emit official BIR invoices or receipts in MVP. The existing **BIR-registered invoicing/POS system remains the sole official issuer.** After it issues the receipt, the cashier posts that **official invoice number back into TNG** against the order for reconciliation. QR/kitchen tickets are operational documents only.

**Highest-risk areas:** (1) the new public webhook surface and payment correctness (idempotency, spoof/replay, amount validation); (2) exposing a customer-facing surface without weakening the ERP's existing staff-only Firestore security; (3) stock oversell between payment and fulfillment.

**Re-estimated timeline (two developers in parallel):** optimistic **~5 weeks**, realistic **~7 weeks**, conservative **~10 weeks** — see [Section 9](#9-timeline-estimate-re-estimated).

---

## 2. Approved business direction

The owner has approved the following end-to-end flow as the baseline:

```
Customer
  → Scan QR (at table)
  → Browse Menu
  → Add to Cart
  → Pay via Xendit
  → Webhook-confirmed payment
  → Kitchen / Bar workflow
  → Inventory integration (stock deducted on completion)
  → Reporting integration (operational sales reporting)
  → Existing registered invoicing/POS system emits the OFFICIAL invoice
  → Cashier posts the official invoice number back into TNG for reconciliation
```

**Non-negotiable rule:** TNG does **not** generate official BIR invoices in MVP. The existing registered invoicing/POS system remains the official invoice issuer.

The original architecture report and the payment revision report are **approved as the baseline direction** and are now merged into this document.

---

## 3. Decision register

### 3.1 Approved decisions ✅

| # | Decision |
|---|---|
| A1 | Build QR Ordering **inside** the TNG ERP repo as a new module, not as a separate app. |
| A2 | **Xendit online payment is in MVP.** Payment happens from the customer/QR flow before fulfillment. |
| A3 | The **webhook is the source of truth** for payment. Kitchen/bar release happens only on a verified `SUCCEEDED` webhook — never on the browser redirect. |
| A4 | **TNG does not emit BIR official invoices in MVP.** The existing registered POS remains the official issuer. |
| A5 | The **cashier posts the official invoice number** back into TNG (`officialInvoiceNumber`) for reconciliation. |
| A6 | Use a **dedicated `qr_orders` collection**, written server-side only (Admin SDK / Cloud Functions), isolated from staff-facing `pos_orders`. |
| A7 | **Reuse** the existing inventory BOM-deduction logic, menu/recipe model, real-time listeners, and reporting rather than rebuilding them. |
| A8 | **Phase 7 (automated POS synchronization) is deferred** and explicitly out of MVP. Reconciliation in MVP is manual (cashier posts the invoice number). |
| A9 | Customer surface is routed through **Cloud Function callables** (Admin SDK), so `firestore.rules` stays staff-only and is not opened to the public. |
| A10 | **(Audit-confirmed)** QR order numbers use the atomic **`CounterService`** pattern (`runTransaction`). The existing POS random-hex order-ID approach is **not approved** for QR Ordering (collision risk). |
| A11 | **(Audit-confirmed)** QR inventory deduction / stock reservation must use **`runTransaction`** (not a plain `writeBatch`) so a diner cannot be charged for out-of-stock items. |
| A12 | **(Audit-confirmed)** A **Security Remediation Gate** and a **Production Readiness Gate** (Section 8) must be passed before/around QR implementation. Details in [`PHASE_0.5_FIREBASE_AUDIT.md`](PHASE_0.5_FIREBASE_AUDIT.md) and [`PRODUCTION_READINESS_REMEDIATION.md`](PRODUCTION_READINESS_REMEDIATION.md). |

### 3.2 Open decisions ❓ (need an owner/lead answer before or during the relevant phase)

| # | Open question | Blocks |
|---|---|---|
| O1 | Which **registered POS/invoicing product** is the official issuer, and does it expose an API? | Phase 7 scoping (and reconciliation UX detail) |
| O2 | Is **printer integration** (kitchen ticket printing) in MVP, or is an on-screen KDS sufficient for the pilot? | Phase 6 estimate / conservative timeline |
| O3 | **Dine-in only** for MVP, or also takeout? (Plan assumes dine-in only.) | Phase 2 scope |
| O4 | **Session-expiry policy** — when a diner abandons an unpaid order (Xendit 30-min default), do we auto-void the table order? | Phase 3 behavior |
| O5 | **VAT / tax display** on the customer checkout total — since no BIR invoice is issued by TNG, what tax breakdown (if any) do we show the diner? (Accountant input.) | Phase 2 menu/checkout copy |
| O6 | **Refund authority** — which staff role may issue a Xendit refund, and what approval is required? | Phase 3 refund path |
| O7 | **Pilot scope** — single location/business unit for launch, or multiple? | Phase 6 rollout |
| O8 | Menu **modifiers/variants** (size, add-ons) — confirmed deferred to post-MVP? (Plan assumes yes.) | Phase 1–2 menu model |
| O9 | **(Audit-raised) Which Firestore database is the production source of truth — `(default)` or `tng-systems`?** Two databases exist sharing rules/indexes; functions target `tng-systems`; `clone-db.mjs` copies `tng-systems → (default)`. QR writes and new indexes depend on one unambiguous answer. | **Security Remediation Gate / QR START** (P0-2) |

### 3.3 Assumptions 📌 (currently unverified — validate in Phase 0)

| # | Assumption | Verify by |
|---|---|---|
| P1 | The repo is git-managed on an origin with a `main` branch. **`[CONFIRMED]` by Phase 0.5 audit** — the project subfolder is a git repo. Confirm the origin/branch before branching. | `git remote -v` on origin |
| P2 | A Xendit merchant account can be provisioned for TNG in the Philippines with GCash, Maya, QRPH, and cards activated. | Xendit onboarding |
| P3 | The menu's **single-price model** (no modifiers) is acceptable for MVP. | Owner confirm (O8) |
| P4 | Customer flow ships as **mobile web** (QR → browser), not a native Capacitor build, for MVP. `[CONFIRMED]` Capacitor is configured but no native project folders are initialized yet. | Already observed |
| P5 | Existing reporting can absorb a new sales feed via a `pos_sales`-shaped summary record. `[CONFIRMED]` audit found `pos_sales` immutable + BOM-deduction path reusable; revenue reporting itself is net-new. | Phase 5 |
| P6 | The build compiles. **`[DISPROVEN]` by audit** — `tsc -b` fails on ~11 committed errors (build snapshot; verify live). Tracked as P0-3. | live `npm run build` |

### 3.4 Risks 🔴 — see the full payment risk table in [Section 7.5](#75-payment-risks). Program-level risks:

| Risk | Severity | Mitigation |
|---|---|---|
| Xendit merchant onboarding / KYC lead time delays payment testing | Med-High | Start account provisioning in Phase 0, before code is ready. |
| New public webhook is a fresh attack surface (none exists today) | High | Token verification, HTTPS-only, amount re-validation, idempotency ledger, optional IP allowlist. |
| Stock oversell between payment and fulfillment | Med-High | Transactional stock check **before** creating the Xendit session. |
| Paid orders never reconciled to a BIR receipt | Med | Mandatory "unreconciled paid orders" cashier queue; block day-close until cleared. |
| Printer integration is an unknown (no code exists) | Med | Treat as an isolated Phase 6 spike; keep KDS-on-screen as the fallback (O2). |
| Scope creep into official invoicing / Phase 7 pulled early | Med | This document's BIR rule (A4) and MVP boundaries (Section 11) are the guardrail. |
| **(Audit) Committed live Firebase service-account keys** — repo holds admin credentials to `tng-systems` | **Critical** | Rotate/purge before QR start; Remediation P0-1. |
| **(Audit) Build is red** — `tsc -b` fails, blocking CI/integration of new code | High | Fix committed `tsc` errors before QR start; Remediation P0-3. |
| **(Audit) Dual-database ambiguity** — QR could write to the wrong Firestore DB | High | Decide production DB (O9) before QR start; Remediation P0-2. |
| **(Audit) Xendit webhook is greenfield** — no `onRequest`/HTTP function exists in the repo today | Med-High | Build the first HTTP function in Phase 3 with token verify + idempotency; extra hardening/testing budget. |
| **(Audit) Firestore rule bypasses** (`\|\| true` ×3, commented-out fund-release validation, unvalidated financial collections) live in the shared project | Med | Remediate before go-live (P1-1); QR itself avoids these paths via callables. |
| **(Audit) No CI/CD + hosting-only deploys** — payment/webhook code could ship unvetted or functions left un-deployed | Med | Stand up a minimal CI gate and add a functions-deploy step before payment code lands (P1-2, P1-3). |
| **(Audit) POS lifecycle & order-numbering flaws** could be inherited if QR reuses `pos_orders` | Med | Use dedicated `qr_orders` + `CounterService` + `runTransaction` (A6, A10, A11). |

---

## 4. Current-state analysis (what already exists)

Evidence-based from direct code inspection. Citations in [Appendix A](#appendix-a-evidence-index-file-citations).

### 4.1 Stack & shape `[CONFIRMED]`
React 19 + TypeScript + Vite SPA, feature-folder architecture, Firebase (Auth + Firestore), 2 Cloud Functions, Tailwind, Capacitor v8 configured but no native projects initialized. Fundamentally a **B2B staff-only** procurement/inventory/finance ERP today — **no customer-facing surface exists**.

### 4.2 Module maturity `[CONFIRMED]`

| Module | Maturity | Notes |
|---|---|---|
| Procurement | High | Multi-stage requisition/approval/liquidation workflow. |
| Inventory | High | Multi-unit stock, BOM recipes, stock transactions, **working sales→stock deduction** via BOM explosion. |
| Menu | Medium | Recipe costing + CRUD; each menu item links to a FINISHED_GOOD inventory item. Single price; **no variants/modifiers**. |
| POS | Low-Medium | Order shape exists but status is **hardcoded `COMPLETED`**; card/e-wallet are recorded, not processed. Mostly a costing/import tool. |
| Finance | Low (for revenue) | Procurement budgets/liquidations only. Revenue is a placeholder (`expenses × 1.3`). No BIR/receipt logic. |
| Dashboard | Low | Client-side aggregation at page load; no snapshot rollups. |
| Notifications | Medium | In-app only, Firestore-backed, **real-time `onSnapshot` pattern is reusable** for queues. |
| Auth | High | Firebase Auth (email + Google) + dynamic Firestore role/permission matrix; **every rule requires `isSignedIn()` — no public access precedent.** |

### 4.3 Key reusable assets `[CONFIRMED]`
- **Inventory BOM deduction** — `pos-import.service.ts` (~536–705): explodes a sale into raw-material deductions, writes `stock_transactions`, updates `inventory_items`. Directly reusable for the QR completion→inventory bridge.
- **Real-time listeners** — `firestore.service.ts` (~208–261): generic `onSnapshot` wrappers. Reusable for kitchen/bar queues and customer status.
- **Atomic ID generation** — `CounterService` (`docs/COUNTER_SERVICE_USAGE.md`): transaction-safe, zero-padded IDs (PRF/BURF/LIQ). **Reuse this pattern for QR order numbers** instead of the random-hex approach POS uses today (which risks collisions).
- **Idempotency/dedupe precedent** — `pos_sales_batches` / `event_import_batches` (fileHash + businessUnitId). Mirror this for the Xendit webhook event ledger.
- **Cloud Functions** — only `onCall` functions exist (`transactions.ts`, `admin.ts`). **No `onRequest`/HTTPS endpoint exists yet** — the Xendit webhook will be the first.

### 4.4 What is missing for QR ordering `[CONFIRMED]`
Order status lifecycle, table/session identity, order type, customer contact capture, real payment processing, kitchen/bar queue views, a public/anonymous customer access path, QR generation, a public HTTP webhook endpoint, and a real revenue→reporting feed.

---

## 5. Gap analysis

| Area | Exists? | Reuse | Extend | Build new |
|---|---|---|---|---|
| Menu / Product mgmt | Yes | Model, costing, inventory link | `isAvailable` toggle; sanitized customer read projection | Public menu API (callable) |
| POS | Partial | `POSOrderItem` shape, cart pattern | — | New `qr_orders` lifecycle (separate from `pos_orders`) |
| Inventory | Yes (strong) | BOM deduction logic | Refactor into shared service callable from live orders | Stock reservation at submit (anti-oversell) |
| Reporting | Partial | Aggregation UI patterns | Real revenue feed from completed orders | Optional daily-summary rollup function |
| User mgmt / Auth | Yes (strong) | Auth + permission helpers | — | Anonymous/session customer identity (via callables) |
| Notifications | Yes | `onSnapshot` real-time pattern | Order-status triggers | Customer status surface |
| Table management | No | — | — | `qr_tables` + QR generation/printing |
| Order management | Partial | Line-item shape | — | Full status state machine, queues |
| Payment | No (recorded only) | UI/field pattern only | — | **Xendit Payment Sessions + webhook (net-new)** |
| Reconciliation | No | — | — | `officialInvoiceNumber` field + cashier posting |

**Reuse verdict:** high on domain/data logic (~70–80% for menu + inventory), low on order lifecycle / payment / queues / reconciliation (net-new).

---

## 6. Target architecture

### 6.1 End-to-end flow

```
CUSTOMER (phone, no login)
  scan table QR → browse menu → cart → SUBMIT
        │
        ▼
TNG SERVER (Cloud Function, Admin SDK)
  createQrOrder()       → order status = AWAITING_PAYMENT (NOT in kitchen)
  createXenditSession() → POST /sessions → returns payment_link_url
        │
        ▼
CUSTOMER redirected to Xendit hosted checkout
  pays via GCash / Maya / QRPH / card (3DS)
        │
        ▼
XENDIT → webhook POST → xenditWebhook (onRequest HTTPS fn)   ◄── SOURCE OF TRUTH
  verify x-callback-token → match order by reference_id
  assert status=SUCCEEDED AND amount==total AND currency==PHP
  conditional transition AWAITING_PAYMENT → PAID (idempotent)
  persist payment_id / session_id / channel
  RELEASE to kitchen/bar
        │
        ├──────────────► KITCHEN / BAR QUEUE (staff, onSnapshot)
        │                 IN_KITCHEN → READY → SERVED → COMPLETED
        │                        │
        │                        ▼ (on COMPLETED)
        │                 shared inventory-deduction bridge (BOM explosion)
        │                 → stock_transactions + inventory_items
        │                 → pos_sales-shaped summary → operational reporting
        │
        ▼
CASHIER posts sale into EXISTING BIR-REGISTERED POS
  → official receipt issued THERE (never by TNG)
  → cashier types officialInvoiceNumber back into TNG
  → order reconciled (Xendit payment_id ↔ BIR receipt no.)
```

### 6.2 Role-specific flows

- **Customer:** scan QR (no login) → menu (sanitized, no cost/margin) → cart (client state) → submit (server creates `AWAITING_PAYMENT`) → pay on Xendit → watch status via `onSnapshot` on their own order.
- **Kitchen:** staff-authenticated `onSnapshot` on `qr_orders where status in (PAID, IN_KITCHEN)`, grouped by table; advance `PAID → IN_KITCHEN → READY`.
- **Bar:** same queue pattern filtered to Beverages/Cocktails categories (existing menu categories); no new backend concept.
- **Cashier:** lists PAID orders; marks `SERVED/COMPLETED`; posts `officialInvoiceNumber`; reconciles.
- **Admin:** manages `qr_tables` and prints QR codes; reuses existing Menu Engineering screens unchanged; views operational sales reporting.

### 6.3 Data model

**Collection decision (A6):** dedicated **`qr_orders`** collection, written server-side only. Reuse the `POSOrderItem` shape. On `COMPLETED`, write a `pos_sales`-shaped summary so existing inventory deduction and reporting work unchanged. (Alternative considered: extend the existing `POSOrder` type for free reporting reuse — rejected because `pos_orders` has permissive rules, no field validation, and hardcodes `status = COMPLETED`, which is incompatible with an unpaid/in-progress lifecycle.)

```
qr_orders/{id}
  id, businessUnitId, tableId, orderNumber,       // orderNumber via CounterService pattern
  items: POSOrderItem[],                           // reuse existing shape
  customerName?, orderType: 'DINE_IN' | 'TAKEOUT',
  subtotal, taxAmount, totalAmount, currency: 'PHP',

  // fulfillment lifecycle
  status: 'CART' | 'AWAITING_PAYMENT' | 'PAID' | 'IN_KITCHEN' | 'IN_BAR'
        | 'READY' | 'SERVED' | 'COMPLETED'
        | 'PAYMENT_FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED',

  // payment lifecycle (Xendit)
  paymentStatus: 'UNPAID' | 'AWAITING_PAYMENT' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED',
  paymentReference,          // = our orderId, sent as Xendit reference_id (shared join key)
  xenditPaymentSessionId,    // ps-... / sess_...
  xenditPaymentRequestId,    // pr-...
  xenditPaymentId,           // py-...  canonical id for refunds + settlement matching
  xenditChannelCode,         // GCASH | PAYMAYA | QRPH | CARDS
  paymentMethodType,
  paidAt,

  // refund (only if cancelled after PAID)
  xenditRefundId?,           // rfd-...
  refundStatus?, refundedAmount?,

  // BIR reconciliation (posted LATER by cashier — never at payment time)
  officialInvoiceNumber?,    // null until cashier posts it from the registered POS
  officialInvoicePostedAt?,
  officialInvoicePostedBy?,  // staff uid, for audit

  createdAt, updatedAt

qr_tables/{id}
  id, businessUnitId, tableNumber, qrToken, isActive

xendit_events/{id}          // idempotency ledger — unique on (xenditPaymentId, event)
  xenditPaymentId, event, orderId, businessUnitId, receivedAt, processedAt, result
```

Three-way reconciliation this enables: order ↔ Xendit via `paymentReference`/`xenditPaymentId`; Xendit payment ↔ BIR receipt via `officialInvoiceNumber`. Also set Xendit session `metadata: { order_id, table_no }` so orders appear in Xendit settlement exports for finance.

### 6.4 Security architecture (critical)

Every existing Firestore rule requires `isSignedIn()`; there is **no public-access precedent**, and `menu_items`/`pos_orders` lack field-level validation even for staff. **Do not broadly loosen `firestore.rules`.** Instead, **route all customer reads/writes through Cloud Function callables/HTTPS (Admin SDK)**, which bypass rules entirely and keep the staff-only rule set untouched. This is both the simplest and the safest path (no full re-audit of the 1,130-line rules file to carve a public hole). Menu data served to customers must be a **sanitized projection** (name, price, category, image, availability) — never cost, margin, or recipe fields.

---

## 7. Payment architecture (Xendit)

Based on current Xendit documentation research. This is a **core, blocking MVP capability** (not a fast-follow).

### 7.1 Product choice
Use **Xendit Payments API v3 — Payment Sessions** (`POST /sessions`, `session_type: "PAY"`, `mode: "PAYMENT_LINK"`), which returns a hosted-checkout `payment_link_url`. One integration covers **GCash, Maya, QRPH, and cards (3DS)** for the PH market — the successor to the legacy Invoices/Payment Links API. Use `capture_method: "AUTOMATIC"` (single settled charge). Hosted checkout keeps card data (PCI/3DS) off TNG's servers.

### 7.2 Payment lifecycle
`ACTIVE (session) → PENDING (customer paying) → SUCCEEDED` (the only state that releases the kitchen) — or `FAILED` / `EXPIRED` (30-min default) / `CANCELED`. Refunds are a separate lifecycle: `PENDING → SUCCEEDED | FAILED`.

### 7.3 Webhook flow (source of truth)
1. On submit, server calls `POST /sessions` with `reference_id = orderId` (unique per attempt), amount, `currency: PHP`, `capture_method: AUTOMATIC`, items, return URLs, `metadata`, and an **`Idempotency-key`** header. Store `payment_session_id` + `payment_link_url`; mark order `AWAITING_PAYMENT`.
2. Redirect the phone to `payment_link_url`.
3. Xendit POSTs to the webhook. Subscribe to and branch on the `event` field: `payment.succeeded` / `payment_session.completed` (success), plus `payment.failed` and `payment_session.expired`.
4. Verify `x-callback-token`; look up the order by `reference_id`; assert `status == SUCCEEDED` **and** `amount == total` **and** `currency == PHP`.
5. Only then: idempotent transition `AWAITING_PAYMENT → PAID`, persist `payment_id`/`session_id`/channel, release to kitchen.
6. Return `2xx` fast (dispatch the kitchen ticket quickly/idempotently after acknowledging).

**The browser `success_return_url` redirect is NOT proof of payment** (it can be lost or spoofed) — it is a UI "thank you" screen only.

### 7.4 Security & idempotency
- **Auth:** constant-time compare the `x-callback-token` header against the dashboard secret; HTTPS-only; server-side only; optional Xendit IP allowlist; never log the token; rotate if leaked.
- **Business validation:** re-validate amount + currency + that `reference_id` maps to a real order before acting (blocks tampering / misrouted events).
- **Create idempotency:** `Idempotency-key` on `POST /sessions` and `POST /refunds`.
- **Webhook idempotency:** Xendit retries ~6× with backoff and may deliver out-of-order/duplicates. Dedupe on `(payment_id, event)` via the `xendit_events` ledger; make "release to kitchen" a one-way conditional transition so the ticket is created **exactly once**. Ignore a late `payment.failed` after `SUCCEEDED`.

### 7.5 Payment risks

| Risk | Severity | Mitigation |
|---|---|---|
| Kitchen released on spoofable/lost redirect instead of webhook | High | Release only on verified webhook. |
| Duplicate/out-of-order webhooks double-fire the kitchen ticket | High | `xendit_events` ledger + one-way conditional transition; ack 2xx + no-op if already PAID. |
| Amount tampering / misrouted event | High | Re-validate `amount == total && currency == PHP` and order match. |
| New public webhook attack surface | High | Token verify, HTTPS-only, server-side only, optional IP allowlist. |
| Paid but unfulfillable (oversell / out of stock) | Med-High | Transactional stock check **before** creating the session; refund path if it fails post-payment. |
| Paid order never reconciled to a BIR receipt | Med | Mandatory "unreconciled paid orders" queue; block day-close until cleared. |
| Double inventory deduction (live bridge + later manual import) | Med | Tag `stock_transactions.referenceId = orderId`; importer skips QR-sourced sales. |
| Session expiry abandons table order (30-min default) | Low-Med | Decide auto-void policy (O4); require a fresh session on retry. |
| Treating Xendit `payment_id` / checkout page as a fiscal receipt | Med | Governance: `officialInvoiceNumber` is the only fiscal reference. |
| QRPH/e-wallet async settlement + slower refunds | Low-Med | "Confirming payment" UI state; ensure Xendit balance for refunds. |

### 7.6 Failure, expiry & refunds
- **Failed/expired:** keep order unreleased; offer retry via a **fresh** session (new `reference_id` + new `Idempotency-key`); nothing charged → no refund.
- **Refund** (cancelled after PAID): `POST /refunds` with `payment_request_id`, idempotent; mark `REFUNDED` only on `refund.succeeded`; store `xenditRefundId` + status. Refund authority is open (O6).

---

## 8. Development roadmap (Phases 0–7)

Each phase lists Objectives / Deliverables / Dependencies / Risks / Acceptance. Critical path: **Phase 0 → 0.5 → 🚧 GATE A (Security Remediation) → 1 → 2 → 3 → 3.5 → 5 → 🚧 GATE B (Production Readiness) → 6.** Phase 4 is polish. **Phase 7 is deferred (non-MVP).** The two gates were introduced by the Phase 0.5 audit and are hard entry conditions.

### Phase 0 — Architecture validation (3–5 days)
- **Objectives:** confirm the callable-mediated access pattern and the BIR "no official invoice" boundary with owner + accountant; provision the Xendit account early.
- **Deliverables:** this document signed off; Xendit account provisioning started; open decisions O1–O8 triaged.
- **Dependencies:** owner/accountant availability.
- **Risks:** scope creep into invoicing (A4 is the guard).
- **Acceptance:** written sign-off on data model + security approach; Xendit onboarding in progress.

### Phase 0.5 — Firebase audit (3–4 days) — ✅ COMPLETE (2026-07-02)
Runs immediately after architecture sign-off and **before any QR implementation begins**. The goal is to replace the remaining `[ASSUMPTION]` markers in this document with verified facts, so no schema, permission, or collection is guessed at during build. **Completed — findings in [`PHASE_0.5_FIREBASE_AUDIT.md`](PHASE_0.5_FIREBASE_AUDIT.md); remediation tracked in [`PRODUCTION_READINESS_REMEDIATION.md`](PRODUCTION_READINESS_REMEDIATION.md). Outcome: Conditional Pass — the Security Remediation Gate below must clear before Phase 1.**
- **Objectives:**
  - Review Firestore **collections** (names, shapes, ownership, BU-scoping).
  - Review Firestore **indexes** (existing composite indexes and the query patterns they imply).
  - Review **security rules** (`firestore.rules`) — helper functions, per-collection access, and confirmation that no public path exists today.
  - Review the existing **Menu schema** (`menu_items`, recipe/ingredient links).
  - Review the existing **POS schema** (`pos_orders`, `pos_sales`, batches).
  - Review the existing **Inventory schema** (`inventory_items`, `stock_transactions`, BOM structure, units).
  - Review the existing **Reporting schema** (dashboard aggregation sources, any summary collections).
  - Review the **Functions architecture** (`functions/` — triggers, exports, current `onCall`-only setup, deploy config).
- **Deliverables:**
  - **Firestore schema map** — collection → fields → relationships (esp. menu ↔ inventory ↔ sales).
  - **Collection inventory** — every collection, its purpose, writer(s), and access rule.
  - **Security audit report** — rule-by-rule summary, gaps, and the exact surface a callable-mediated customer flow must respect.
  - **Reusable services inventory** — concrete list of existing services to reuse (BOM deduction, real-time listeners, `CounterService`, idempotency/batch patterns) with file references.
- **Dependencies:** Phase 0 sign-off; read access to the repo and Firebase project/console.
- **Risks:** discovering a schema/permission constraint late that changes the `qr_orders` design — precisely why this phase runs before build.
- **Acceptance:** the current Firebase architecture is fully understood before QR implementation starts; **no assumptions remain** around collections, permissions, or schema (all Section 3.3 assumptions either confirmed or explicitly re-flagged as decisions). ✅ Met.

### 🚧 GATE A — Security Remediation Gate (blocks Phase 1 / QR START)
A hard gate introduced by the Phase 0.5 audit. **No QR implementation (Phase 1+) begins until every item here is cleared or explicitly waived by the owner.** Tracked as P0 in [`PRODUCTION_READINESS_REMEDIATION.md`](PRODUCTION_READINESS_REMEDIATION.md).
- **Exit criteria:**
  1. **Service-account key rotation (P0-1)** — the two committed Firebase admin keys are revoked/rotated, removed from the repo, and purged from git history; `.gitignore` extended.
  2. **Production database decision (P0-2 / O9)** — `(default)` vs `tng-systems` chosen and documented as the QR source of truth.
  3. **Build verification (P0-3)** — a live `npm run build` is green (committed `tsc` errors fixed).
  4. **Firestore rule bypass review scoped (P1-1)** — the `|| true` fallbacks and the commented-out fund-release validation are reviewed and a remediation owner/plan assigned (full fix may land before go-live, not necessarily before Phase 1).
- **Owner:** repo owner / tech lead. **Status:** OPEN.

### Phase 1 — Foundation (1–2 weeks)
- **Objectives:** scaffold the `qr-ordering` module and shared types; table QR generation + printing; sanitized public menu API.
- **Deliverables:** `qr_orders`/`qr_tables` types frozen; `getPublicMenu()` callable; admin table management + printable QR codes.
- **Dependencies:** Phase 0 sign-off; **GATE A (Security Remediation) passed**; production DB chosen (O9).
- **Risks:** menu sanitization must strip cost/margin/recipe fields (leak = COGS exposure). Building on a repo with a red build or ambiguous DB (mitigated by GATE A).
- **Acceptance:** scanning a QR opens a customer menu with no login prompt and no internal cost data present; all new code compiles under the green build baseline.

### Phase 2 — QR ordering core (2–3 weeks)
- **Objectives:** cart, server-side order creation, order state machine, kitchen/bar/cashier queue views.
- **Deliverables:** `createQrOrder()` callable with **transactional stock check before session creation**; queue views via `onSnapshot`.
- **Dependencies:** Phase 1 menu API + frozen order shape.
- **Risks:** oversell on concurrent last-unit orders.
- **Acceptance:** a submitted order is created `AWAITING_PAYMENT` and does **not** appear in the kitchen queue until paid.

### Phase 3 — Payments (Xendit) (1.5–2 weeks) — **core MVP**
- **Objectives:** online payment; webhook-gated kitchen release; references persisted.
- **Deliverables:** `createXenditSession()` callable; new `xenditWebhook` **`onRequest` HTTPS function** (first HTTP endpoint in the repo); token verification, amount re-validation, idempotent release; failure/expiry retry; refund callable.
- **Dependencies:** Xendit account with GCash/Maya/QRPH/cards **activated**; test-mode keys first, separate prod keys + webhook token; `#payments-xendit`.
- **Risks:** see [7.5](#75-payment-risks) — highest-risk phase.
- **Acceptance:** sandbox payment via each channel flips the order to PAID **only on the verified webhook**, appearing in the kitchen queue within ~2s; a replayed/duplicate webhook creates exactly one ticket; bad token or mismatched amount is rejected.

### Phase 3.5 — Reconciliation (0.5 week)
- **Objectives:** cashier posts the official BIR receipt number back into TNG.
- **Deliverables:** `postOfficialInvoice(orderId, officialInvoiceNumber)` callable (audit-stamped); cashier UI field; "unreconciled paid orders" filter.
- **Dependencies:** Phase 3 payment contract.
- **Risks:** orders slipping through unreconciled.
- **Acceptance:** posting a number stamps who/when; a filter lists all PAID orders lacking a number; TNG emits no BIR document anywhere (verified by inspection).

### Phase 4 — Kitchen operations (1 week)
- **Objectives:** refine kitchen/bar UX; prep-time indicators; "order ready" customer signal.
- **Deliverables:** polished KDS-style views; customer status screen.
- **Dependencies:** Phase 2 core.
- **Risks:** low (UX polish on existing real-time infra).
- **Acceptance:** kitchen staff operate the queue unaided.

### Phase 5 — Inventory integration (1 week)
- **Objectives:** wire order completion to the shared BOM-deduction service; prevent oversell.
- **Deliverables:** refactor `pos-import.service.ts` BOM logic into a shared `InventoryDeductionService`; trigger on `qr_orders → COMPLETED`; write `pos_sales`-shaped summary with `referenceId = orderId`.
- **Dependencies:** Phase 2; existing import logic.
- **Risks:** double-deduction (mitigated via `referenceId` tagging + importer skip of QR sales). Oversell if deduction is not transaction-guarded — **must use `runTransaction`** (A11), not the existing plain `writeBatch`, since the audit confirmed the current import path has no transaction wrapper.
- **Acceptance:** completing a paid QR order deducts linked ingredient stock identically to the existing import path, under a `runTransaction` that cannot oversell.

### 🚧 GATE B — Production Readiness Gate (blocks Phase 6 / GO-LIVE)
A hard gate introduced by the Phase 0.5 audit. **No production deployment until every item here is cleared or explicitly waived.** Tracked as P1 in [`PRODUCTION_READINESS_REMEDIATION.md`](PRODUCTION_READINESS_REMEDIATION.md).
- **Exit criteria:**
  1. **Firestore rule bypasses remediated (P1-1)** — `|| true` fallbacks and the commented-out fund-release validation removed/fixed; financial collections validated.
  2. **CI/CD baseline (P1-2)** — a minimal automated gate (lint + `tsc` + build) exists and passes on the release branch.
  3. **Deployment process reviewed (P1-3)** — the deploy path deploys **functions** (not hosting-only), and no longer relies on crash-fragile on-disk `firebase.json` mutation.
  4. **QR-phase items done** — required composite indexes deployed; payment/idempotency/oversell paths have automated tests.
- **Owner:** tech lead / DevOps. **Status:** OPEN.

### Phase 6 — Deployment (3–5 days)
- **Objectives:** production Firebase config; prod Xendit keys + webhook token registered; pilot rollout; printer integration (if in scope, O2).
- **Deliverables:** live QR codes at tables; staff trained; rollback plan posted.
- **Dependencies:** all prior phases at MVP quality; **GATE B (Production Readiness) passed**.
- **Risks:** printer integration is an unknown — isolate as a spike; KDS-on-screen is the fallback. Shipping without the functions-deploy fix would leave the Xendit webhook un-deployed (mitigated by GATE B).
- **Acceptance:** a real customer order goes phone → kitchen → payment → reconciliation at the pilot site without a P0 incident.

### Phase 7 — POS Synchronization (**DEFERRED — NOT MVP**)

**Purpose:** long-term automation so TNG can automatically create or synchronize completed sales into the existing registered invoicing/POS system, eliminating manual re-entry and manual reconciliation.

- **Goals:**
  - Auto-push each completed, paid QR order into the registered POS so it issues the official receipt without manual re-keying.
  - Auto-capture the returned official invoice number back onto `qr_orders` (replacing the manual cashier step from Phase 3.5).
  - Preserve a full audit trail linking Xendit payment ↔ TNG order ↔ official receipt.
- **Dependencies:**
  - O1 resolved — the exact registered POS product identified **and** an available integration surface (API, import format, or middleware).
  - Accountant/BIR validation that automated push does not risk double-issuance or non-compliance.
  - MVP live and stable (real reconciliation data to model against).
- **Risks:**
  - BIR compliance risk — an automation bug could double-issue or misstate official receipts. **Highest-severity risk of this phase.**
  - Vendor lock / brittle integration if the registered POS lacks a clean API.
  - Reconciliation drift if the two systems disagree on totals/rounding.
- **Integration options (to evaluate when O1 is answered):**
  1. **Official API of the registered POS** — cleanest; real-time; depends entirely on vendor API availability.
  2. **File/CSV batch bridge** — export completed sales, import into the POS; **mirrors the existing `pos-import`/`event-import` batch pattern** already in the codebase; lowest integration risk but not real-time.
  3. **Middleware / inbound webhook** — if the registered POS accepts inbound events.
  4. **RPA / UI automation** — brittle last resort; only if no data interface exists.
- **Why deferred:**
  - MVP already reconciles safely via the manual `officialInvoiceNumber` step (Phase 3.5), which is sufficient to launch and to satisfy the BIR boundary.
  - The integration surface is unknown until O1 is answered; scoping it now would be speculative.
  - Automating fiscal-document creation is the single highest-compliance-risk activity in the program and should not gate the operational MVP.

---

## 9. Timeline estimate (re-estimated)

The prior 8–10 week figure assumed online payment was an add-on. Re-reviewing the actual codebase, the reusable foundation is larger than that estimate credited: inventory BOM deduction, menu/recipe model, real-time listeners, atomic counters, and Cloud Functions scaffolding all already exist. The genuinely net-new, higher-risk work is narrower than a greenfield build: the Xendit payment + public webhook, the queue UIs, table/QR management, and reconciliation.

Assumes **two developers working in parallel** per [Section 10](#10-developer-ownership-elio--fred).

| Estimate | Duration | Reasoning |
|---|---|---|
| **Optimistic** | **~5 weeks** | Xendit account + channels already provisioned before code starts (Phase 0 overlap); printer deferred (KDS-on-screen for pilot, O2); reuse of inventory/menu/listeners goes smoothly; single pilot location; menu modifiers deferred (P3/O8); dedicated, uninterrupted focus; minimal review churn. |
| **Realistic** | **~7 weeks** | Normal integration friction on the first-ever HTTP webhook; sandbox↔prod key/token handling; oversell/idempotency/refund edge-case hardening; a couple of review cycles; some open decisions resolved mid-flight. |
| **Conservative** | **~10 weeks** | Xendit merchant onboarding/KYC lead time delays payment testing; printer integration pulled into MVP (O2) as a real spike; BIR/accountant clarifications; multi-location pilot; refund/reconciliation policy iteration; concurrency edge cases surfacing in QA. |

The **Phase 0.5 Firebase audit (3–4 days)** is included in these figures as front-loaded validation work; because the two developers split it (rules/functions vs. schema/services) and it can partially overlap the start of Phase 1, it does not materially shift the ranges above.

**Drivers that move the number:** Xendit onboarding timing (start it in Phase 0), the printer decision (O2), and whether menu modifiers stay deferred (O8). Phase 7 is **not** included in any of these figures.

---

## 10. Developer ownership (Elio & Fred)

Split by **layer**, not feature, to minimize merge conflicts: **Elio** owns the customer surface + Cloud Functions (incl. payment); **Fred** owns staff-facing views + inventory/reporting integration. Both co-own the shared types file early, then freeze it.

| Phase | Elio (Customer + Cloud Functions) | Fred (Staff Views + Inventory/Reporting) |
|---|---|---|
| 0 Validation | Draft `qr_orders`/`qr_tables` types; confirm callable pattern | Review inventory/reporting reuse points; confirm BOM-refactor plan |
| 0.5 Firebase audit | Security rules review + security audit report; Functions architecture review | Firestore schema map + collection inventory; reusable services inventory (menu/POS/inventory/reporting) |
| 1 Foundation | `getPublicMenu()` callable; QR token generation; freeze shared types | Admin table-management + QR print UI |
| 2 Ordering core | Customer cart + menu UI; `createQrOrder()` with **transactional stock check** | Kitchen queue, bar queue, cashier queue views (`onSnapshot`) |
| 3 Payments | `createXenditSession()`; **`xenditWebhook` onRequest fn**; token verify; `xendit_events` idempotency; failure/expiry retry; refund callable | "Confirming payment" + payment-status display on queues; UI reaction to webhook-driven flips |
| 3.5 Reconciliation | `postOfficialInvoice()` callable + validation | Cashier UI field to post `officialInvoiceNumber`; "unreconciled paid orders" filter |
| 4 Kitchen ops | Customer order-status screen (thank-you page is UI-only) | Kitchen/bar UX polish; prep-time display |
| 5 Inventory | — (light) | Refactor BOM logic into shared `InventoryDeductionService`; wire `qr_orders → COMPLETED` trigger + `pos_sales` summary |
| 6 Deploy | Prod Xendit keys + **prod webhook token**; register webhook URL; verify channel activation | Printer integration spike; pilot rollout support |
| 7 (deferred) | POS sync API/middleware client (if API route chosen) | POS sync batch bridge (if file route chosen); reconciliation automation |

**Files likely affected**
- **Elio:** `functions/src/xendit-webhook.ts` (new onRequest), `functions/src/qr-orders.ts`, `functions/src/qr-menu.ts`, `functions/src/index.ts` (add exports), `src/features/qr-ordering/customer/**`
- **Fred:** `src/features/qr-ordering/staff/**` (incl. cashier reconciliation UI), `src/features/qr-ordering/admin/**`, shared `InventoryDeductionService` (refactored from `pos-import.service.ts`), `src/features/dashboard/**`

**Handoff points**
1. End of Phase 1 — menu API contract + `qr_orders` shape frozen.
2. End of Phase 3 — Elio → Fred hand off the **payment→PAID state contract** (`paymentStatus`, `xenditPaymentId`, `paidAt`) that both kitchen release and cashier reconciliation depend on.
3. End of Phase 3.5 — reconciliation field contract.
4. Phase 5 — `qr_orders → COMPLETED` is the single trigger Fred hooks inventory into.

**Shared-file discipline:** the only file both touch routinely is the shared types file — agree it once in Phase 0–1, then treat changes as a reviewed handoff, not ad-hoc edits.

---

## 11. MVP boundaries

### In scope ✅
- QR scan → menu browse → cart → submit → **Xendit online payment** → webhook-confirmed → kitchen/bar queue → cashier completes → inventory deduction → operational reporting.
- Manual reconciliation: cashier posts `officialInvoiceNumber` from the registered POS.
- Dine-in (table-based) ordering. Cards + GCash + Maya + QRPH via Xendit hosted checkout.

### Out of scope ❌ (protect against scope creep)
- **Official BIR invoice/receipt generation by TNG** — stays with the existing registered POS (A4).
- **Automated POS synchronization** — deferred to Phase 7.
- Menu variants/modifiers (size, add-ons); single-price items only for MVP.
- Loyalty, customer accounts/history, delivery logistics, tipping, split bills, discounts/promo codes.
- Native Capacitor customer app — MVP is mobile web only.
- Multi-location table management beyond the pilot (unless O7 says otherwise).

---

## 12. Slack Announcement Draft

> Written for non-technical stakeholders. Copy-paste into `#project-status` (or `#general` / `#decisions` as appropriate). Trim as needed.

---

**📣 TNG QR Ordering — we're building it inside TNG (approved direction)**

**What's changing and why**
We originally considered a separate app for QR ordering. After reviewing our existing TNG system in detail, we found the hard parts are already built — inventory, recipes/menu, costing, user roles, and live updates. So instead of building a second system from scratch, **we're adding QR Ordering as a new module inside TNG.** Less duplication, one source of truth, faster to launch.

**How it will work for a customer**
Scan the QR at the table → browse the menu on their phone → add to cart → **pay online (GCash, Maya, QRPH, or card via Xendit)** → once payment is confirmed, the order automatically goes to the kitchen/bar. They can see their order status on their phone.

**What we're reusing (already built)**
- Inventory + automatic stock deduction from recipes
- Menu and recipe/costing management
- Staff roles and permissions
- Live real-time updates (for the kitchen screen)
- Sales/operational reporting foundations

**What we still need to build**
- The customer ordering screens (menu + cart on the phone)
- Online payment via Xendit and confirmation handling
- Kitchen / bar / cashier screens
- Table QR codes
- Linking each paid order back to the official receipt for reconciliation

**Important — official receipts (BIR)**
For the first version, **TNG will NOT issue official BIR receipts.** Our existing registered invoicing/POS system stays the official receipt issuer, exactly as today. After it issues the receipt, the cashier enters that official receipt number back into TNG so every online payment is matched to its official receipt. Nothing about our BIR compliance changes.

**Expected benefits**
- Faster table turnover — customers order and pay from their phones
- Fewer manual order errors
- Payments confirmed before the kitchen starts cooking
- Sales and stock update automatically
- Clean, auditable link between each payment and its official receipt

**MVP scope (first release)**
Dine-in QR ordering + Xendit online payment + kitchen/bar workflow + inventory + operational reporting + manual reconciliation to the official receipt. **Not** in the first release: TNG-issued official invoices, menu add-ons/sizes, loyalty, delivery.

**What comes later**
A future phase (Phase 7) will explore **automatically syncing** completed sales into the registered POS so staff don't have to re-enter anything. That's deliberately after the first launch, because automating official receipts carries compliance risk we want to get right — not rush.

**Timeline (two developers, in parallel):** roughly **5 weeks (optimistic) / 7 weeks (realistic) / 10 weeks (conservative)**, depending mainly on Xendit account setup timing and whether kitchen-ticket printing is included at launch.

---

## Appendix A. Evidence index (file citations)

| Claim | Evidence |
|---|---|
| POS order shape; status hardcoded COMPLETED | `src/features/pos/types/pos.types.ts`; `src/features/pos/services/pos.service.ts:16,21` |
| Menu model + recipe/inventory link | `src/features/menu/types/menu.types.ts:91-109`; `src/features/menu/services/recipes.service.ts` |
| Inventory BOM explosion + stock deduction | `src/features/pos/services/pos-import.service.ts:536-705` |
| Real-time listener pattern | `src/shared/services/firestore.service.ts:208-261` |
| Atomic ID counter pattern | `docs/COUNTER_SERVICE_USAGE.md`; `src/shared/services/counter.service.ts` |
| Idempotency/dedupe precedent | `pos-import.service.ts:184-194`; `event-import.service.ts:435-444` |
| Only onCall functions; no HTTP endpoint | `functions/src/index.ts`; `functions/src/transactions.ts:70`; `functions/src/admin.ts:64` |
| All Firestore rules require auth; no public precedent | `firestore.rules` (helper `isSignedIn()` gating throughout) |
| Finance revenue is a placeholder | `src/features/finance/services/finance.dashboard.service.ts:169` |
| Capacitor configured, no native projects | `capacitor.config.ts`; absence of initialized `android/`/`ios/` project state |

---

*End of master plan. Planning/documentation only — no implementation is authorized by this document.*
