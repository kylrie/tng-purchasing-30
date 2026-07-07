# QR Ordering — Xendit Payment Implementation Plan (Phase 3)

> **Document type:** Planning only. **No code, configuration, Firestore rules, indexes, or Cloud Functions are created or changed by this document.** It maps the payment architecture in [`QR_ORDERING_MASTER_PLAN.md`](QR_ORDERING_MASTER_PLAN.md) §7 onto the **current** QR backend and defines exactly what to build, in what order, how to secure it, how to test it, and how to roll it out / back.
> **Status:** Draft for the pre‑Phase‑3 security design review (Gap Analysis recommendation #5).
> **Date:** 2026-07-03
> **Authoritative source:** Master Plan §7 (payment architecture) and §6.3 (data model) win on any conflict; this file is the build‑level elaboration.

---

## 0. Current state (what exists vs. what's net‑new)

**Already built and tested (Sprint 1–2):**

| Piece | File | Relevance to payment |
|---|---|---|
| `createQrOrder` callable | `functions/src/qr/createQrOrder.{ts,handler.ts}` | Writes the order at `status = AWAITING_PAYMENT`, `paymentStatus = UNPAID` inside a `runTransaction` with server‑authoritative pricing + atomic order number. **This is the order the payment session is created for.** |
| `getQrOrder` callable | `functions/src/qr/getQrOrder.{ts,handler.ts}` | Customer order‑status read. The status screen reads paid/unpaid state from here. |
| `postOfficialInvoice` callable | `functions/src/qr/postOfficialInvoice.{ts,handler.ts}` | Phase 3.5 reconciliation — requires **paid** orders, which only exist once this plan ships. |
| Shared DB handle | `functions/src/qr/firestore.ts` (`qrDb`, `QR_DATABASE_ID = 'tng-systems'`) | All payment functions import this — one DB target. |
| RBAC helper | `functions/src/qr/auth.ts` (`requireStaffRole`) | Reused by the refund callable (staff‑only). |
| Rate limiter | `functions/src/qr/rateLimit.ts` (`enforceRateLimit`, fixed‑window) | Reused to cap session creation per table. |
| Test harnesses | `functions/src/qr/__tests__/fakeFirestore.ts`, `testUtils.ts`, `rules.emulator.test.ts` | The pattern all new handlers/tests follow. |
| Order type contract | `src/features/qr-ordering/types/qrOrder.types.ts` | **Already declares the full payment lifecycle** (`paymentStatus`, `xenditPaymentSessionId`, `xenditPaymentRequestId`, `xenditPaymentId`, `xenditChannelCode`, `paidAt`, refund fields). No breaking migration needed. |

**Net‑new for this plan:**

- ~~`createXenditSession` — callable that turns an `AWAITING_PAYMENT` order into a Xendit hosted‑checkout link.~~ **✅ DONE (2026-07-03).** Injectable handler + onCall wrapper, `SESSION_CREATE_LIMIT`, App‑level session reuse + per‑attempt `reference_id`. Gated behind `QR_PAYMENTS_ENABLED` (default off).
- ~~`xenditWebhook` — the **first `onRequest` HTTP function in the repo** (source of truth for "paid").~~ **✅ DONE (2026-07-03).** `onRequest` wrapper + injectable `xenditWebhook.handler.ts` (constant‑time token verify, `xendit_events` ledger idempotency, amount/currency re‑validation, one‑way `AWAITING_PAYMENT→PAID`, dormant `releaseQrOrder` invoked exactly once; failed/expired update `paymentStatus` only, never release). Binds `XENDIT_CALLBACK_TOKEN` (Secret Manager). Unit‑tested with FakeFirestore + stubbed release (13 cases); `xendit_events` rule added (`read, write: if false`) + emulator coverage.
- `refundQrOrder` — staff callable (Phase 3 tail / O6‑gated). *(Not yet built.)*
- ~~A thin **Xendit HTTP client wrapper** (injectable, so handlers stay testable).~~ **✅ DONE (2026-07-03)** (`xenditClient.ts` + mock, stubbed‑fetch tests).
- ~~`xendit_events` collection (idempotency ledger — declared in Master Plan §6.3, not built).~~ **✅ DONE (2026-07-03)** (written by the webhook; client‑unwritable rule + emulator test).
- Secret management (Cloud Secret Manager) — `defineSecret` now used for `XENDIT_SECRET_KEY` (session) and `XENDIT_CALLBACK_TOKEN` (webhook).

**Hard prerequisites before any payment code ships (blocking):**

1. ~~**M1 — order‑creation idempotency** (`createQrOrder`)~~ **✅ DONE (2026-07-03).** `createQrOrder` accepts a client `idempotencyKey` and dedupes via a table‑scoped `qr_order_idempotency` record; a retry returns the original order (no duplicate → no duplicate session/charge). See [`QR_SPRINT1_REMEDIATION_PLAN.md`](QR_SPRINT1_REMEDIATION_PLAN.md) §2 M1.
2. **H2 — App Check enforcement** on the anonymous customer callables (adds `createXenditSession`).
3. **Gate B — deployment path fix (P1‑3)**: current deploy scripts are hosting‑only and mutate `firebase.json`; the webhook is useless if functions don't actually deploy. And **CI/CD gate (P1‑2)** must exist before payment code merges.
4. **This security design review** signed off.
5. **Stock reservation ordering decision** (Master Plan A11 / Phase 5): a transactional stock check should happen **before** a session is created, or a refund path must cover paid‑but‑unfulfillable. See §8 open items.

---

## 1. Payment session flow (`createXenditSession`)

**Product:** Xendit **Payments API v3 — Payment Sessions** (`POST /v3/sessions`, `session_type: "PAY"`, `mode: "PAYMENT_LINK"`, `capture_method: "AUTOMATIC"`). One integration covers GCash, Maya, QRPH, and cards (3DS) for PH. Returns a hosted‑checkout `payment_link_url` (card data / 3DS never touches TNG servers).

**Shape:** thin `onCall` wrapper (`createXenditSession.ts`) → injectable handler (`createXenditSession.handler.ts`) taking `(db, xenditClient, request)`. Anonymous customer callable (like `createQrOrder`), App Check enforced, rate‑limited per table.

**Input:** `{ orderId: string }` (the order already created by `createQrOrder`). Nothing about amount/price is trusted from the client — it is read from the order document.

**Handler steps:**

1. **App Check + rate limit.** Reuse `enforceRateLimit(db, 'session:${tableId}', SESSION_CREATE_LIMIT)` after the order is resolved (bogus ids fail first, keeping the limiter collection bounded).
2. **Resolve + validate the order.** Read `qr_orders/{orderId}`; require it exists and is `status = AWAITING_PAYMENT` / `paymentStatus ∈ {UNPAID, AWAITING_PAYMENT, FAILED, EXPIRED}`. Reject `failed-precondition` for a paid/served/cancelled order (never create a session for an already‑paid order).
3. **Reuse an in‑flight session (idempotency, see §5).** If the order already has an `xenditPaymentSessionId` from a still‑ACTIVE session, return that link instead of creating a second one.
4. **Build the session request** from the **server's** order data:
   - `reference_id` = a **per‑attempt** id, e.g. `${orderId}:${attempt}` (unique per session; not reused after FAILED/EXPIRED — a retry mints a new one).
   - `amount` = `order.totalAmount`, `currency: "PHP"`.
   - `items` = mapped from `order.items` (name, qty, price) for the Xendit receipt.
   - `success_return_url` / `cancel_return_url` = `${QR_PUBLIC_BASE_URL}/order-status/${orderId}` (UI only — not proof of payment).
   - `metadata: { order_id, table_no, business_unit_id }` (so orders appear in Xendit settlement exports).
   - `capture_method: "AUTOMATIC"`.
   - HTTP header **`Idempotency-key: session:${reference_id}`**.
5. **Call Xendit** via the client wrapper (Basic auth with the secret key — see §3).
6. **Persist + transition** in a `runTransaction`: store `xenditPaymentSessionId`, `xenditPaymentRequestId`, `paymentReference = reference_id`, `paymentLinkUrl` (transient), set `paymentStatus = AWAITING_PAYMENT`. **Do not** touch `status` (stays `AWAITING_PAYMENT`) and **never** set `PAID` here.
7. **Return** `{ paymentLinkUrl }` to the client, which redirects the phone to Xendit.

**Client wiring (frontend, later task):** after `createQrOrder` succeeds, call `createXenditSession(orderId)`, then `window.location.assign(paymentLinkUrl)`. Behind the `QR_PAYMENTS_ENABLED` flag; when off, the existing mock checkout stays. The `/checkout/demo` and `/order-status/demo` mock modes are preserved regardless.

**Payment lifecycle (Xendit):** `ACTIVE (session) → PENDING (paying) → SUCCEEDED` (the only state that releases the kitchen) — or `FAILED` / `EXPIRED` (30‑min default) / `CANCELED`. Refunds are a separate lifecycle (§ refund).

---

## 2. Webhook flow (`xenditWebhook`) — source of truth  ✅ IMPLEMENTED (2026-07-03)

> **Status:** Built per this section. `functions/src/qr/xenditWebhook.{ts,handler.ts}`; ledger `xendit_events`; release via the dormant `releaseQrOrder`. Steps 1–10 below are implemented; live‑channel + App‑Check behaviour remain staging/sandbox verifications (§7). Not deployed; no live credentials used.

**This is the only thing that flips an order to `PAID`.** The browser `success_return_url` is a "thank‑you" screen, never proof of payment (it can be lost or spoofed).

**Shape:** `functions/src/qr/xenditWebhook.ts` = the first `onRequest` (HTTPS) function. Logic in an injectable `xenditWebhook.handler.ts` taking `(db, rawBody, headers, now)` so it is unit‑testable without a live HTTP server. Subscribe in the Xendit dashboard to: `payment.succeeded` / `payment_session.completed` (success), `payment.failed`, `payment_session.expired`.

**Handler steps:**

1. **Method + content guard.** POST only; parse JSON body (keep the raw body for logging/verification).
2. **Verify `x-callback-token`** — constant‑time compare against `XENDIT_CALLBACK_TOKEN` (§4). On mismatch → **401**, no processing, no detail leaked, token never logged.
3. **(Optional) IP allowlist** — if enabled, reject non‑Xendit source IPs (`XENDIT_WEBHOOK_IP_ALLOWLIST`).
4. **Extract** `event`, `payment_id` (py‑…), `payment_session_id`/`reference_id`, `status`, `amount`, `currency`.
5. **Idempotency claim (see §5).** In a `runTransaction`, create `xendit_events/${payment_id}:${event}`; if it already exists → **return 200 immediately** (duplicate — no‑op). Xendit retries ~6× with backoff and may deliver out‑of‑order/duplicates.
6. **Resolve the order** by `reference_id` (→ orderId) or `xenditPaymentSessionId`. If no match → 200 + log (mis‑routed event; nothing to do).
7. **Re‑validate business facts:** assert `status == SUCCEEDED` **and** `amount == order.totalAmount` **and** `currency == "PHP"`. Any mismatch → record the event as `rejected`, return 200 (acknowledged, not applied), alert.
8. **One‑way conditional transition:** only `AWAITING_PAYMENT → PAID`. Inside the same transaction:
   - Set `status = PAID`, `paymentStatus = PAID`, `paidAt = serverTimestamp()`, persist `xenditPaymentId`, `xenditChannelCode`, `paymentMethodType`.
   - If the order is already `PAID` (or beyond) → no‑op (idempotent), still 200.
   - Ignore a late `payment.failed`/`expired` that arrives **after** SUCCEEDED.
9. **Release to kitchen/bar** — call the **already-built, dormant** release service `releaseQrOrder(qrDb, orderId, { source: 'XENDIT_WEBHOOK', releaseEventId: paymentId })` (see [`QR_ORDER_RELEASE_SERVICE.md`](QR_ORDER_RELEASE_SERVICE.md)). It is PAID-gated, idempotent (one-way `released` guard → exactly-once fulfillment), and audit-stamps `releasedAt`/`releaseSource`/`releaseEventId`. The kitchen/bar boards already key off `PAID` and only show paid orders (the interim `AWAITING_PAYMENT` surfacing was already removed from `kitchenOrders.service.ts` / `barOrders.service.ts` `*LaneFor`). (No push needed — the boards are live `onSnapshot`.)
10. **Return 200 fast.** Any slow follow‑up work must be idempotent and off the ack path.

**Failure / expiry:** `payment.failed` / `payment_session.expired` → set `paymentStatus = FAILED`/`EXPIRED`, leave `status = AWAITING_PAYMENT` (never released). The client offers "retry" → a **fresh** session (new `reference_id` + new `Idempotency-key`).

---

## 3. Environment variables & secrets

Functions currently use **no** secrets or env config, so this is greenfield. Use **Firebase Functions v2 + Cloud Secret Manager** (`defineSecret`) — never commit keys (the P0‑1 committed‑key incident is the cautionary tale; `.gitignore` already blocks `*firebase-adminsdk*.json`).

| Name | Type | Where | Purpose |
|---|---|---|---|
| `XENDIT_SECRET_KEY` | **Secret** (Secret Manager) | Functions | Basic‑auth to Xendit API (`base64(secretKey + ":")`). Separate **test** vs **live** values. |
| `XENDIT_CALLBACK_TOKEN` | **Secret** | Functions (webhook only) | Verifies the `x-callback-token` header. Separate test vs live. |
| `XENDIT_API_BASE` | Config (non‑secret) | Functions | Default `https://api.xendit.co`; override for sandbox tooling if needed. |
| `QR_PUBLIC_BASE_URL` | Config | Functions | Base for `success/cancel_return_url` (e.g. `https://tng-systems.web.app`). |
| `XENDIT_WEBHOOK_IP_ALLOWLIST` | Config (optional) | Functions (webhook) | Comma‑separated Xendit source IPs, if IP allowlisting is enabled. |
| `XENDIT_MODE` | Config | Functions | `sandbox` \| `live` — selects which secret set + base is active and drives structured logs. |
| `QR_PAYMENTS_ENABLED` | Config / Remote flag | Client + Functions | Master on/off for the payment path (rollout + instant rollback). When off, the mock checkout flow is used and `createXenditSession` refuses. |

**Client (`VITE_*`) needs no Xendit secret** — the `payment_link_url` is minted server‑side. The only client value is the feature flag (`VITE_QR_PAYMENTS_ENABLED`, or a Remote Config value) and the already‑present Firebase config.

**Test vs. production separation:** keep **distinct Secret Manager secrets** (or distinct versions bound per deploy target) for sandbox and live; select via `XENDIT_MODE`. Never let a sandbox build reach the live secret or vice‑versa. Document the exact secret names in the deploy runbook (not here).

**Local/dev:** with no real keys, `createXenditSession` runs in **mock mode** (returns a fake `/checkout/demo`‑style link) — reuse the existing "demo/local ⇒ mock" gating so the emulator and design‑preview never call Xendit.

---

## 4. Security

Ordered by the Master Plan §7.4–7.5 risk table.

- **Webhook token verification** — constant‑time compare of `x-callback-token` vs `XENDIT_CALLBACK_TOKEN`; HTTPS‑only; POST‑only; server‑side only; never log the token; rotate immediately if leaked. Bad token → 401, no processing.
- **Amount/currency re‑validation** — every applied event re‑asserts `amount == order.totalAmount && currency == "PHP"` and that `reference_id` maps to a real order in `AWAITING_PAYMENT`. Blocks tampering and mis‑routed events.
- **Never trust the redirect** — `success_return_url` only navigates the UI; the order flips to paid **only** on the verified webhook.
- **Secrets in Secret Manager**, least‑privilege service account, not in the repo, not in client bundles.
- **App Check** on `createXenditSession` (customer surface) + the existing per‑table **rate limit** (`SESSION_CREATE_LIMIT`) to blunt session‑spam and card‑testing.
- **One‑way state machine** — the webhook can only move `AWAITING_PAYMENT → PAID`; it can never re‑open, downgrade, or re‑charge. Refunds are a separate, RBAC‑gated staff action.
- **`xendit_events` + `qr_orders` stay `write: if false`** for clients — all writes via the Admin SDK. Add a `xendit_events` rule mirroring `qr_rate_limits` (`allow read, write: if false`). Verify with an emulator rules test.
- **PII / receipt boundary** — TNG stores only `officialInvoiceNumber` (registered POS issues the BIR receipt, A4). The Xendit `payment_id` is a settlement reference, never a fiscal document.
- **Optional IP allowlist** for the webhook as defence‑in‑depth.
- **Structured, tokenless logging** on both functions for observability (ties to L6): log `event`, `orderId`, `payment_id`, `result` — never secrets/tokens/PII.

---

## 5. Idempotency (three independent layers)

1. **Order creation (M1 — ✅ DONE).** Client‑generated idempotency key on `createQrOrder` (validated `[A-Za-z0-9_-]{8,64}`); a retried submit returns the same order via the table‑scoped `qr_order_idempotency` record rather than minting a new one. This is the foundation the session/webhook layers build on.
2. **Session creation.** `Idempotency-key` header on `POST /v3/sessions` (keyed on `reference_id`). Plus an app‑level guard: if the order already has an ACTIVE `xenditPaymentSessionId`, reuse it instead of creating another. A retry after FAILED/EXPIRED uses a **new** `reference_id` (Xendit forbids reusing a spent reference).
3. **Webhook processing.** The `xendit_events/${payment_id}:${event}` ledger doc is created inside the same transaction that applies the effect — a second delivery finds the doc and no‑ops. The `AWAITING_PAYMENT → PAID` transition is itself one‑way and conditional, so even a ledger miss cannot double‑release the kitchen or double‑stamp `paidAt`. Late/out‑of‑order `failed` after `succeeded` is ignored.

**`xendit_events/{id}` shape** (Master Plan §6.3): `{ id: "${payment_id}:${event}", xenditPaymentId, event, orderId, businessUnitId, amount, currency, receivedAt, processedAt, result: "applied" | "duplicate" | "rejected" }`.

---

## 6. Data model & rules (supporting)

**`qr_orders` — fields already declared** in `qrOrder.types.ts`, written by the new functions:

- `paymentStatus`: `UNPAID → AWAITING_PAYMENT → PAID` (or `FAILED`/`EXPIRED`/`REFUNDED`).
- `status`: `AWAITING_PAYMENT → PAID → IN_KITCHEN/IN_BAR → READY → SERVED → COMPLETED` (payment only owns the `→ PAID` edge).
- `paymentReference`, `xenditPaymentSessionId`, `xenditPaymentRequestId`, `xenditPaymentId`, `xenditChannelCode`, `paymentMethodType`, `paidAt`; refund fields `xenditRefundId`, `refundStatus`, `refundedAmount`.

**State machine (payment‑owned edges in bold):**

| From | Event | To |
|---|---|---|
| `AWAITING_PAYMENT` / `UNPAID` | session created | `AWAITING_PAYMENT` / **`AWAITING_PAYMENT`** |
| `AWAITING_PAYMENT` | webhook `succeeded` (validated) | **`PAID`** / **`PAID`** + `paidAt` |
| `AWAITING_PAYMENT` | webhook `failed`/`expired` | `AWAITING_PAYMENT` / **`FAILED`**/**`EXPIRED`** |
| `PAID` | staff refund (`refund.succeeded`) | **`REFUNDED`** / **`REFUNDED`** |

**Rules:** `xendit_events` → `allow read, write: if false`; `qr_orders` write stays `if false` (unchanged). Add an emulator test for both.

**Indexes:** the existing `qr_orders (businessUnitId, status, createdAt)` composite covers kitchen/bar/cashier queries. If a "sessions awaiting payment" admin view is added, consider `(businessUnitId, paymentStatus, createdAt)` — declare in `firestore.indexes.json` and deploy via the fixed functions/index deploy path.

**Refund (`refundQrOrder`, staff callable):** `requireStaffRole` (finance/admin — confirm allow‑list, mirror `QR_RECONCILE_ROLES`), `POST /refunds` with the `payment_request_id`, `Idempotency-key`, mark `REFUNDED` only on the `refund.succeeded` webhook. Gated on open decision **O6** (refund authority).

---

## 7. Tests

Following the existing harness (`node --test` + `FakeFirestore` for handlers; `firebase emulators:exec` for rules), plus an **injected HTTP client** so Xendit calls are stubbed.

| Target | Type | Must prove |
|---|---|---|
| `createXenditSession` handler | Unit (FakeFirestore + stub client) | Rejects non‑`AWAITING_PAYMENT` orders; builds the payload from **server** amount (ignores any client amount); sets `Idempotency-key`; stores session ids; reuses an ACTIVE session instead of creating a second; rate‑limited per table. |
| Xendit client wrapper | Unit (stub `fetch`) | Correct base/auth header; success, HTTP‑error, and timeout paths; `Idempotency-key` forwarded; secrets never logged. |
| `xenditWebhook` handler | Unit (FakeFirestore) | Bad/missing token → rejected (401 path); valid `succeeded` → one‑way `PAID` + `paidAt`; **duplicate** delivery → single effect (ledger); **out‑of‑order** `failed` after `succeeded` → ignored; **amount/currency mismatch** → rejected, not applied; unknown `reference_id` → acknowledged no‑op. |
| Idempotency ledger | Unit | `${payment_id}:${event}` uniqueness; concurrent deliveries yield exactly one applied effect. |
| `refundQrOrder` handler | Unit | RBAC + BU scope; only refunds `PAID`; idempotent; `REFUNDED` only on `refund.succeeded`. |
| Rules | Emulator (`rules.emulator.test.ts`) | `xendit_events` and `qr_orders` are client‑unwritable; paid transition only via Admin SDK. |
| End‑to‑end | **Manual / staging (sandbox)** | Each channel (GCash/Maya/QRPH/card) flips the order to `PAID` **only** on the verified webhook, appearing in the kitchen queue within ~2s; a replayed webhook creates exactly one ticket; bad token / mismatched amount rejected. App Check enforcement rejects an unattested `createXenditSession`. |
| Regression | Existing suite | `npm --prefix functions run test` (currently 57) + `run test:emulator` (7) + root `tsc -b` + `npm run build` stay green after each step. |

App Check enforcement and live‑channel behaviour **cannot** be meaningfully unit‑tested — they are staging/sandbox verifications, called out explicitly so they aren't assumed covered.

---

## 8. Rollout

Payment ships **dark then canary**, behind `QR_PAYMENTS_ENABLED`, on top of the closed Gate A and a cleared Gate B.

**Stage 0 — Prerequisites (blocking):** ~~M1 idempotency merged~~ (✅ done 2026-07-03); App Check enforced; **CI/CD gate (P1‑2)** live; **functions‑deploy path fixed (P1‑3)**; this design review signed off; Xendit **merchant account provisioned** (KYC has real lead time — start earliest) with GCash/Maya/QRPH/card activated; stock‑reservation ordering decided (A11) or refund path accepted as the safety net.

**Stage 1 — Sandbox (flag OFF in prod):** provision **test** secrets in Secret Manager; deploy the four functions to the project with `XENDIT_MODE=sandbox`; register the **test** webhook URL + token in the Xendit dashboard; run the full sandbox E2E (§7) across all channels + replay/mismatch cases. Mock checkout remains the default for all users.

**Stage 2 — Canary / pilot (flag ON for one BU):** cut over to **live** secrets + live webhook URL/token; enable `QR_PAYMENTS_ENABLED` for a **single pilot business unit** (ties to O7). Watch: webhook 2xx rate + latency, `xendit_events.result` distribution (`applied`/`duplicate`/`rejected`), unreconciled‑paid count, refund count, error logs. Keep the mock demo routes working.

**Stage 3 — General availability:** enable per‑BU as each location is trained; keep the flag as the kill switch. Only after stable pilot metrics.

**Deploy mechanics:** functions deploy via the **fixed** pipeline (not hosting‑only). Register/rotate the webhook URL and token as a documented dashboard step. Keep the previous function revision available for instant rollback.

---

## 9. Rollback

Designed to be low‑risk because every change is **additive** (new functions, new collection, new fields) and the webhook is **idempotent + one‑way**.

- **Instant kill switch:** set `QR_PAYMENTS_ENABLED = false`. The client reverts to the pre‑payment flow (order stays `AWAITING_PAYMENT`); `createXenditSession` refuses new sessions. No redeploy needed.
- **Function rollback:** redeploy the previous revision of `createXenditSession` (and, if needed, the webhook). **Keep the webhook deployed even during rollback** so in‑flight/late events for already‑created sessions are still honoured (constant‑time token verify + idempotent apply make this safe) — otherwise a customer who already paid would be stranded.
- **In‑flight sessions:** existing ACTIVE sessions are allowed to complete (webhook applies) or expire (30‑min). Document that flipping the flag off does **not** cancel already‑issued links.
- **Data:** no destructive migration — new fields/collection are additive, so a rollback leaves historical orders intact and readable. No down‑migration required.
- **Money safety:** any charged‑but‑stranded order is resolved via the **refund** path (or manual Xendit dashboard refund) + the reconciliation queue; the `xendit_events` ledger + `paidAt`/`xenditPaymentId` give a full audit trail to reconcile against Xendit settlement.
- **Secret compromise:** rotate `XENDIT_CALLBACK_TOKEN` / `XENDIT_SECRET_KEY` in Secret Manager and re‑register the webhook token; the one‑way state machine means a leaked token can't retro‑actively falsify a `PAID` without also matching amount + a real `AWAITING_PAYMENT` order.
- **Post‑rollback verification:** confirm no order is left in `AWAITING_PAYMENT` with a SUCCEEDED Xendit payment (query + settlement diff); reconcile before re‑enabling.

---

## 10. Open items / dependencies (decide before Stage 2)

- **O4** — session‑expiry / auto‑void policy for abandoned unpaid orders (Xendit 30‑min default).
- **O5** — VAT/tax display on the checkout total (accountant input; affects `taxAmount`, currently 0).
- **O6** — refund authority (which role may refund) — gates `refundQrOrder`.
- **O7** — pilot scope (single vs. multi‑BU) — drives Stage 2.
- **A11 / Phase 5** — transactional stock reservation before session creation, or accept refund‑as‑safety‑net for paid‑but‑out‑of‑stock.
- **Kitchen/bar interim behaviour** — once payments are live, switch `*LaneFor` to key off `PAID` (drop the pre‑payment `AWAITING_PAYMENT` surfacing added in Sprint 2).

---

*Documentation only. No application code, configuration, Firestore rules, indexes, or Cloud Functions were created, modified, or deployed in producing this plan. Implementation begins in a separate, explicit pass, gated on §0's prerequisites.*
