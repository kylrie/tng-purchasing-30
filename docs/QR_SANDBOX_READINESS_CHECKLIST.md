# QR Ordering — Xendit Sandbox Readiness Checklist

> **Document type:** Operational checklist. **Documentation only — no application code, configuration, Firestore rules, indexes, or Cloud Functions are created or changed by this document.**
> **Purpose:** Everything needed to take the QR ordering + Xendit payment flow from "code complete, gated off" to a **verified sandbox end‑to‑end run** on a real Firebase project with Xendit **test** credentials — safely, and with a clean rollback.
> **Date:** 2026-07-04
> **Grounded in:** the current code (`functions/src/qr/*`, `src/features/qr-ordering/*`, `firestore.rules`, `firebase.json`, `.firebaserc`). Where the earlier plan and the code disagree, the **code wins** and is flagged.
> **Authoritative companions:** [`QR_XENDIT_IMPLEMENTATION_PLAN.md`](QR_XENDIT_IMPLEMENTATION_PLAN.md) (architecture), [`QR_ORDER_RELEASE_SERVICE.md`](QR_ORDER_RELEASE_SERVICE.md), [`QR_APP_CHECK_ABUSE_PROTECTION_PLAN.md`](QR_APP_CHECK_ABUSE_PROTECTION_PLAN.md).

---

## 0. Scope & ground truth

**Project / infra (from `.firebaserc`, `firebase.json`):**

| Fact | Value | Source |
|---|---|---|
| Firebase project (default) | `tng-systems` | `.firebaserc` |
| Firestore database | **named** `tng-systems` (not `(default)`) | `functions/src/qr/firestore.ts` (`QR_DATABASE_ID`), `firebase.json` (rules on both DBs) |
| Hosting sites | `tng-systems` (prod), `tng-systems-staging` (staging) | `.firebaserc` |
| Functions region | **`us-central1`** (no `setGlobalOptions`/region override) | `functions/src/**` |
| Functions codebase | `default`, source `functions/` | `firebase.json` |

**Recommendation:** run the sandbox against the **staging hosting site** (`tng-systems-staging`) so no production customer can reach the flow. Note the caveat in §6: staging and prod currently share the **same** `tng-systems` project and **same** Firestore database, so sandbox test orders land in the same DB as real data — use a **dedicated test business unit** (§7) to isolate them, and clean up afterwards.

---

## 1. What is complete ✅

All of the following is **implemented, unit-tested, and green** (`functions/`: 117 node tests, 9 emulator rules tests; root `tsc -b` + `vite build` clean). It is all gated behind flags that default **off**, so nothing is live yet.

**Backend (Cloud Functions, `functions/src/qr/`):**

| Piece | File | State |
|---|---|---|
| Public menu read | `getPublicMenu.{ts,handler.ts}` | ✅ resolves table by `qrToken` → sanitized menu (no cost/margin) |
| Order creation | `createQrOrder.{ts,handler.ts}` | ✅ server-priced, atomic order number, client-key idempotency (`qr_order_idempotency`) |
| Table admin | `createQrTable`, `listQrTables` (token-omitting), `getQrTableToken` (on-demand) | ✅ admin-only |
| Customer order read | `getQrOrder.{ts,handler.ts}` | ✅ sanitized projection (no `xendit*`/`tableId`/BU) |
| Reconciliation | `postOfficialInvoice.{ts,handler.ts}` | ✅ staff-only, paid orders |
| **Payment session** | `createXenditSession.{ts,handler.ts}` | ✅ session reuse, per-attempt `reference_id`, `SESSION_CREATE_LIMIT`, **mock-mode when no secret** |
| **Xendit client** | `xenditClient.ts` | ✅ injectable HTTP client + mock; Basic auth; secret never logged |
| **Webhook (source of truth)** | `xenditWebhook.{ts,handler.ts}` | ✅ token verify, `xendit_events` ledger idempotency, amount/currency re-validation, one-way `AWAITING_PAYMENT→PAID`, calls `releaseQrOrder` exactly once (self-heals a missed release) |
| Release service | `releaseOrder.ts` / `releaseLogic.ts` | ✅ PAID-gated, idempotent |
| Rate limiting | `rateLimit.ts` | ✅ `MENU_READ_LIMIT`, `ORDER_CREATE_LIMIT`, `SESSION_CREATE_LIMIT` |

**Frontend (`src/features/qr-ordering/`):**

| Piece | State |
|---|---|
| Customer menu → cart → order | ✅ real `createQrOrder`, mock fallback for `/order/demo` |
| Checkout → Xendit | ✅ real orders (flag on) call `createXenditSession`, redirect to `paymentLinkUrl`; `/checkout/demo` mock preserved |
| Return experience | ✅ `OrderStatusView` detects `?return=xendit`, shows "Confirming payment…", polls `getQrOrder` (bounded), safe timeout message |
| Order status | ✅ real read + manual refresh; never marks paid from redirect (webhook truth) |
| Table management + QR print/export | ✅ on-demand token reveal, local QR render, print + SVG download (token never in the list) |

**Firestore rules (`firestore.rules`):** `qr_orders` (read same-BU staff, `write:if false`), `qr_tables` (read admin-only, `write:if false`), `qr_rate_limits` / `qr_order_idempotency` / **`xendit_events`** (`read,write:if false` — Admin-SDK only). Server writes go through the Admin SDK.

**Known gaps that are NOT blockers for a sandbox run but must be understood (see §5, §6, §11):**
- **App Check is NOT enforced** on the callables (client wires reCAPTCHA v3; server does not require it). Rate limiting is today's abuse defense.
- **Deploy scripts are hosting-only.** `scripts/deploy-*.mjs` run `firebase deploy --only hosting`. **Functions, rules, and indexes must be deployed separately** (§6).
- The earlier plan mentions `XENDIT_MODE` and `XENDIT_WEBHOOK_IP_ALLOWLIST` — **these are not implemented in code.** Do not try to set them; they do nothing. The live config keys are exactly the five in §4.

---

## 2. What must be configured in Firebase

- [ ] **Billing enabled** (Blaze plan) on `tng-systems` — required for Cloud Functions v2 (Cloud Run) + outbound calls to Xendit + Secret Manager.
- [ ] **Secret Manager API enabled** (auto-prompted on first `functions:secrets:set`).
- [ ] **Firestore named database `tng-systems`** exists (it already backs the app). Confirm rules are deployed to it (§6) — `firebase.json` targets both `(default)` and `tng-systems`.
- [ ] **Composite indexes deployed** (`firestore.indexes.json`) — includes `qr_orders (businessUnitId, status, createdAt)` and `(businessUnitId, tableId, createdAt)`, and `qr_tables (businessUnitId, isActive)`. Deploy via §6 (kitchen/bar/cashier boards need these).
- [ ] **Runtime service account has Secret Manager access.** Functions v2 default compute SA must have `roles/secretmanager.secretAccessor` for `XENDIT_SECRET_KEY` and `XENDIT_CALLBACK_TOKEN`. Binding secrets to the functions (via the `secrets:` array in code, already present) provisions this on deploy; verify in the console if a deploy warns.
- [ ] **Hosting** for the target site (staging recommended) reachable over HTTPS at a stable URL — this becomes `QR_PUBLIC_BASE_URL` (§4).
- [ ] **(Optional, for App Check later)** reCAPTCHA v3 site registered + App Check enabled for the web app (§5).

---

## 3. What must be configured in Xendit

Use the **Xendit dashboard in TEST mode** throughout. Nothing here touches live money.

- [ ] **Merchant account** provisioned and in **Test mode** (KYC not required for test keys, but production go-live later will be — start that lead time separately).
- [ ] **Test API secret key** copied (`xnd_development_...`). → becomes `XENDIT_SECRET_KEY` (§4).
- [ ] **Payments API v3 / Payment Sessions** available on the account (the integration uses `POST /v3/sessions`, `session_type: PAY`, `mode: PAYMENT_LINK`, `capture_method: AUTOMATIC`).
- [ ] **Test payment channels activated:** GCash, Maya (PayMaya), QRPH, Cards (3DS) — whichever you intend to test.
- [ ] **Webhook (callback) registered** for the deployed `xenditWebhook` URL (get the exact URL after §6 deploy):
  - Events (subscribe all): **`payment.succeeded`** and/or **`payment_session.completed`** (success), **`payment.failed`**, **`payment_session.expired`**.
  - The handler classifies by event name **or** status (`SUCCEEDED`/`COMPLETED`/`PAID` → paid; `FAILED`; `EXPIRED`), so the exact event catalog naming is tolerant — subscribe to the success + failure + expiry events your account exposes.
- [ ] **Callback verification token** set in the dashboard and copied → becomes `XENDIT_CALLBACK_TOKEN` (§4). The webhook does a **constant-time compare** of the `x-callback-token` header; a mismatch → **401**, no processing.
- [ ] Confirm the webhook is **HTTPS** and reachable (the Cloud Functions URL is HTTPS by default).

---

## 4. Required env / secrets

### 4a. Server — Cloud Functions (exact keys, from the code)

Two are **Secret Manager** secrets; three are **params** (`defineString`/`defineBoolean`, settable via `.env`-style function config or Secret Manager). Source: `createXenditSession.ts`, `xenditWebhook.ts`.

| Name | Type | Used by | Sandbox value | If unset |
|---|---|---|---|---|
| `XENDIT_SECRET_KEY` | **Secret** | `createXenditSession` | Xendit **test** secret key | **Falls back to MOCK client** — returns a fake `/checkout/demo` link, never calls Xendit |
| `XENDIT_CALLBACK_TOKEN` | **Secret** | `xenditWebhook` | Dashboard callback token | Empty string ⇒ token compare fails ⇒ **all webhooks 401** |
| `XENDIT_API_BASE` | Param (string) | `createXenditSession` | `https://api.xendit.co` (default) | Uses default |
| `QR_PUBLIC_BASE_URL` | Param (string) | `createXenditSession` | **staging hosting URL**, e.g. `https://tng-systems-staging.web.app` | Defaults to `https://tng-systems.web.app` — success/cancel return URLs would point to prod |
| `QR_PAYMENTS_ENABLED` | Param (bool) | `createXenditSession` | **`true`** for the sandbox run | Defaults to **`false`** ⇒ callable refuses with `failed-precondition` |

Set secrets (documentation only — do not run from this doc):
```
# from functions/
firebase functions:secrets:set XENDIT_SECRET_KEY
firebase functions:secrets:set XENDIT_CALLBACK_TOKEN
```
Params (`XENDIT_API_BASE`, `QR_PUBLIC_BASE_URL`, `QR_PAYMENTS_ENABLED`) are set via a functions `.env` (e.g. `functions/.env.tng-systems`) or `firebase functions:config`/params per your chosen mechanism; ensure `QR_PAYMENTS_ENABLED=true` for the run.

> ⚠️ **The secret must be a TEST key.** A live key here would create real charges. There is no `XENDIT_MODE` switch in code — separation is purely "which key you put in the secret." Double-check the key prefix is the test/development one.

> 🔒 **Secrets never reach the client bundle.** `payment_link_url` is minted server-side; the client only calls the callable. Verified: no `XENDIT_*` secret appears in `src/` or `dist/`.

### 4b. Client — Vite build-time env (`.env` for the deployed build)

| Name | Sandbox value | Notes |
|---|---|---|
| `VITE_FIREBASE_*` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId) | project web config | required for the SPA + callables |
| `VITE_FIREBASE_DATABASE_ID` | **`tng-systems`** | must match the named DB |
| `VITE_QR_PAYMENTS_ENABLED` | **`true`** | routes a real created order into Xendit checkout; else it goes straight to order-status (pre-payment flow) |
| `VITE_RECAPTCHA_SITE_KEY` | (optional) | if set, client initializes App Check (reCAPTCHA v3). Not required for the sandbox run since enforcement is off (§5) |
| `VITE_FUNCTIONS_EMULATOR_HOST` | **unset** | must NOT be set for a deployed sandbox (only used to point the client at a local emulator) |

---

## 5. Required App Check setup

**Current state (from code):** `src/config/firebase.ts` initializes App Check with a reCAPTCHA v3 provider **only when `VITE_RECAPTCHA_SITE_KEY` is present**. **No callable sets `enforceAppCheck`**, and the webhook is an `onRequest` (App Check does not apply). So App Check is, in effect, **advisory on the client and NOT enforced on the server**.

**For the sandbox run:** App Check is **not required** — the anonymous customer callables are protected today by the per-surface **rate limits** (`MENU_READ_LIMIT`, `ORDER_CREATE_LIMIT`, `SESSION_CREATE_LIMIT`). Proceed without it.

**To actually enforce App Check (recommended before any public/live traffic — this is a separate CODE task, tracked as "H2", not part of this checklist):**
- [ ] Register reCAPTCHA v3, set `VITE_RECAPTCHA_SITE_KEY`, enable App Check for the web app in the Firebase console.
- [ ] Add `enforceAppCheck: true` to the customer callables (`getPublicMenu`, `createQrOrder`, `getQrOrder`, `createXenditSession`) — **code change, out of scope here.**
- [ ] Verify an unattested call is rejected (staging-only; cannot be unit-tested).

> Record in Go/No-Go (§11) that the sandbox run is proceeding **with App Check enforcement OFF**, relying on rate limiting.

---

## 6. Required deployment steps

> ⚠️ **The repo deploy scripts (`scripts/deploy-staging.mjs`, `deploy-production.mjs`) deploy `--only hosting`.** They do **not** deploy functions, rules, or indexes. You must deploy those explicitly. This is the "Gate B / P1-3" gap.

Recommended order (documentation only):

1. **Build + test locally** (must be green before deploy):
   - `npm --prefix functions run test` (117) · `npm --prefix functions run test:emulator` (9, needs Java) · `npm --prefix functions run build` · root `tsc -b` · `vite build`.
2. **Set secrets + params** (§4a) on `tng-systems`, including `QR_PAYMENTS_ENABLED=true`.
3. **Deploy Firestore rules + indexes:**
   `firebase deploy --only firestore:rules,firestore:indexes` (applies to `(default)` and `tng-systems`). Wait for indexes to finish building.
4. **Deploy functions:**
   `firebase deploy --only functions` — this deploys all QR callables + `xenditWebhook` and binds the secrets. **Capture the `xenditWebhook` URL from the output** (form: `https://us-central1-tng-systems.cloudfunctions.net/xenditWebhook` or its Cloud Run URL).
5. **Register the webhook URL + callback token in Xendit** (§3) using the captured URL.
6. **Deploy the client** with the §4b env to the **staging** site: `firebase deploy --only hosting:staging` (or the repo staging script). Confirm `VITE_QR_PAYMENTS_ENABLED=true` and `VITE_FIREBASE_DATABASE_ID=tng-systems` were in the build.
7. **Smoke the deploy:** open the staging URL; confirm the SPA loads and `getPublicMenu` works for the test table (§7).

> **Isolation caveat:** staging + prod share the `tng-systems` project and the `tng-systems` Firestore DB. Sandbox orders are real documents in that DB. Contain them to a **test business unit** (§7) and clean up (§10).

---

## 7. Required test table setup

Tables are created **only** via the `createQrTable` admin callable (rules make `qr_tables` `write:if false`; the server generates the opaque `qrToken`). Do **not** hand-write table docs.

- [ ] Sign in to staging as an **ADMIN / SUPER_ADMIN**.
- [ ] Pick/create a **dedicated test business unit** id (e.g. `qr-sandbox-bu`) to isolate sandbox data.
- [ ] In **QR Tables** admin (`/qr-tables/live`), create at least one table (e.g. number `S1`) under that BU → this calls `createQrTable`, producing a `qr_tables` doc with `{ businessUnitId, tableNumber, qrToken, isActive: true }`.
- [ ] Open **Show QR** for the table → reveals the token on demand (`getQrTableToken`), renders the QR, and gives the customer link `/order/{qrToken}`. **Print or download** it for scanning.
- [ ] Confirm the token is **not** shown in the table list (only inside the reveal panel).

Required `qr_tables` doc shape (created by the callable): `businessUnitId`, `tableNumber`, `qrToken` (opaque), `isActive: true`, `createdAt`, `updatedAt`.

---

## 8. Required test menu setup

`getPublicMenu` returns **active** `menu_items` for the table's business unit, sanitized. The customer/order flow needs at least a couple of active items in the **same BU** as the test table.

- [ ] Create ≥ 2 `menu_items` under the **same `businessUnitId`** as the test table, each with:
  - `businessUnitId` = test BU (must match the table)
  - `name` (string), `category` (string)
  - `sellingPrice` (number ≥ 0) — this is the **server-authoritative** price used for the order and the Xendit amount
  - `isActive: true` (maps to customer-facing `isAvailable`; inactive items are hidden and rejected at order time)
  - optional: `description`, `imageUrl`
- [ ] **Do not** rely on any client-sent price — `createQrOrder` reprices every line from `menu_items`, and the webhook re-validates `amount === order.totalAmount`.
- [ ] Confirm sensitive fields (`calculatedCost`, `grossMargin`, recipe, etc.) exist only server-side and **never** appear in the `getPublicMenu` response (they're stripped by `sanitizeMenuItem`).
- [ ] Verify by scanning the QR / opening `/order/{qrToken}` on a phone — the menu should list your test items with the correct prices.

Menu items may be created through the existing Menu admin UI (whatever the app already provides) or by an admin-authorized write; `menu_items` read requires signed-in, BU scoping is enforced by the query.

---

## 9. End-to-end sandbox test script

Run on a **real phone** (or mobile emulation) against the staging URL, Xendit in **test mode**. Repeat the happy path once per channel you activated (GCash / Maya / QRPH / Card).

**A. Happy path — payment succeeds → order flips to PAID → released**
1. Scan the printed QR (or open `/order/{qrToken}`). → menu loads (`getPublicMenu`).
2. Add ≥ 1 item, open cart, **Place order**. → `createQrOrder` creates `qr_orders/{id}` at `status=AWAITING_PAYMENT`, `paymentStatus=UNPAID`. Note the **order number**.
3. With `VITE_QR_PAYMENTS_ENABLED=true`, you land on **Checkout**. Tap **Pay with Xendit**. → `createXenditSession` (real key ⇒ real session), redirect to the Xendit **test** hosted checkout.
4. Complete payment with the channel's **test credentials** (e.g. Xendit test OTP / test card).
5. Xendit redirects back to `/order-status/{orderId}?return=xendit`. → screen shows **"Confirming payment…"** and polls `getQrOrder`.
6. Xendit fires `payment.succeeded` → `xenditWebhook`:
   - verifies `x-callback-token`, writes ledger `xendit_events/{payment_id}:{event}`,
   - re-validates amount + currency, one-way sets `status=PAID`, `paymentStatus=PAID`, `paidAt`, `xenditPaymentId`, `xenditChannelCode`, `paymentMethodType`,
   - calls `releaseQrOrder` (sets `released=true`, `releaseSource=XENDIT_WEBHOOK`).
7. Within ~seconds the status screen flips to **Paid**; the order appears on the **kitchen/bar** board (they key off PAID). ✔️

**B. Idempotency / replay** — In the Xendit dashboard, **resend** the `payment.succeeded` webhook. → second delivery hits the existing ledger doc, **no second release**, order stays PAID, webhook returns 200 fast. ✔️

**C. Bad token** — Send a webhook with a wrong `x-callback-token` (or temporarily wrong token). → **401**, order unchanged, no ledger entry. ✔️

**D. Amount/currency mismatch** — (If the dashboard allows editing a test event) deliver a `succeeded` with a different amount. → recorded as `rejected`, order **not** flipped to PAID, 200. ✔️

**E. Failure / expiry** — Start a session and let it **fail** or **expire** (or trigger the test failed event). → `paymentStatus=FAILED`/`EXPIRED`, `status` stays `AWAITING_PAYMENT`, **not released**; the customer can retry (a **new** session / `reference_id`). ✔️

**F. Session reuse** — Tap **Pay** twice quickly on the same unpaid order. → the second call **reuses** the live session (same link), Xendit session created **once**. ✔️

**G. Kill switch** — Set `QR_PAYMENTS_ENABLED=false` (or client flag off), retry. → `createXenditSession` refuses with `failed-precondition`; the client shows the safe "pay at the counter" / mock behavior; **no charge**. ✔️

**H. Never-paid-from-redirect** — Manually open `/order-status/{orderId}?return=xendit` for an unpaid order. → shows "Confirming…" then the safe timeout message; the order is **never** marked paid without the webhook. ✔️

**Observability during the run:** watch `firebase functions:log` for structured `xenditWebhook.processed` lines (`event`, `orderId`, `payment_id`, `result` ∈ applied/duplicate/rejected/ignored). Confirm **no** secret/token is logged.

---

## 10. Rollback plan

Every change is additive; the webhook is idempotent + one-way. Ordered by blast radius:

1. **Instant kill switch (no redeploy):** set `QR_PAYMENTS_ENABLED=false` (server) and/or `VITE_QR_PAYMENTS_ENABLED` off on the next client build. `createXenditSession` refuses; the client reverts to the pre-payment/mock flow. Existing in-flight sessions still complete or expire (Xendit ~30 min); flipping the flag does **not** cancel already-issued links.
2. **Function rollback:** redeploy the previous function revision. **Keep `xenditWebhook` deployed** even during rollback so a customer who already paid is still honored (constant-time token verify + idempotent apply make this safe).
3. **Data:** no destructive migration — new fields (`paymentLinkUrl`, `paymentAttempt`, `sessionExpiresAtMillis`, `xendit*`, `paidAt`, release fields) and the `xendit_events` collection are additive. Rollback leaves historical orders readable.
4. **Sandbox data cleanup:** delete the test BU's `qr_orders`, `qr_tables`, `menu_items`, `xendit_events`, `qr_rate_limits`, `qr_order_idempotency`, and `counters/qr` test entries. Because staging shares the prod DB, cleaning up the **test BU** keeps real data untouched.
5. **Secret compromise:** rotate `XENDIT_SECRET_KEY` / `XENDIT_CALLBACK_TOKEN` in Secret Manager and re-register the callback token in Xendit. The one-way state machine means a leaked token can't fabricate a PAID without also matching amount + a real `AWAITING_PAYMENT` order.
6. **Money safety (test mode):** no real funds move in sandbox. For any stranded test order, the `xendit_events` ledger + `paidAt`/`xenditPaymentId` give a full audit trail.

---

## 11. Go / No-Go checklist

Tick every box before starting the sandbox E2E (§9). A single unchecked **blocker** = **No-Go**.

**Blockers (must be true):**
- [ ] Billing (Blaze) + Secret Manager enabled on `tng-systems`.
- [ ] `firebase deploy --only firestore:rules,firestore:indexes` done; indexes finished building.
- [ ] `firebase deploy --only functions` done; `xenditWebhook` URL captured.
- [ ] `XENDIT_SECRET_KEY` = **test** key set as a secret (verified test/dev prefix).
- [ ] `XENDIT_CALLBACK_TOKEN` set as a secret; **same** value registered in Xendit dashboard.
- [ ] Xendit webhook registered at the captured URL for succeeded/failed/expired events.
- [ ] `QR_PAYMENTS_ENABLED=true` (server) **and** `VITE_QR_PAYMENTS_ENABLED=true` (client build).
- [ ] `QR_PUBLIC_BASE_URL` points at the **staging** URL; client `VITE_FIREBASE_DATABASE_ID=tng-systems`; `VITE_FUNCTIONS_EMULATOR_HOST` unset.
- [ ] Test **business unit**, ≥ 1 **active table**, ≥ 2 **active menu items** all under the same BU (§7–8).
- [ ] Local suite green (functions 117 + emulator 9, functions build, root `tsc -b`, `vite build`).

**Accepted risks / conscious Go decisions (record who approved):**
- [ ] **App Check enforcement is OFF** — proceeding with rate-limiting as the abuse defense (sandbox only). Enforcement (H2) is a separate task before public/live traffic.
- [ ] **Staging shares the prod DB** — isolation via a dedicated test BU + cleanup, understood and accepted.
- [ ] `XENDIT_MODE` / IP-allowlist are **not implemented** — key separation is the only test/live boundary; test key confirmed.

**Post-run (before calling it done):**
- [ ] All §9 cases A–H pass (each activated channel for A).
- [ ] `firebase functions:log` shows correct `xendit_events.result` distribution and **no** secrets/tokens logged.
- [ ] No order left `AWAITING_PAYMENT` with a SUCCEEDED Xendit test payment (reconcile).
- [ ] Sandbox test data cleaned up (§10.4) or intentionally retained for evidence.
- [ ] `QR_PAYMENTS_ENABLED` returned to `false` after the run if not moving straight to canary.

---

*Documentation only. No application code, configuration, Firestore rules, indexes, or Cloud Functions were created, modified, or deployed in producing this checklist. It reflects the repository state as of 2026-07-04; re-verify secret/param mechanics and the `xenditWebhook` URL against the actual deploy output before the run.*
