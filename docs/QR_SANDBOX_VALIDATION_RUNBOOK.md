# QR Ordering — Sandbox Validation Runbook (Phase B)

> **Document type:** Operational runbook — ordered, executable steps for a **sandbox/TEST-mode** end-to-end validation of the QR ordering + Xendit payment flow.
> **Safety guardrails:** This document performs **no deploy by itself** — every deploy is an explicit command you run. **Xendit TEST mode only** (`xnd_development_…` key); **no live credentials** anywhere; **no live funds move at any point**. All levers used here are additive-safe: the webhook is idempotent, the order state machine is one-way, and nothing below deletes production data.
> **Companions:** [`QR_SANDBOX_READINESS_CHECKLIST.md`](QR_SANDBOX_READINESS_CHECKLIST.md) (the what/why checklist — this runbook is the how; references to that document are written `checklist §N`) and [`QR_XENDIT_IMPLEMENTATION_PLAN.md`](QR_XENDIT_IMPLEMENTATION_PLAN.md) (architecture). Where the plan and the code disagree, **the code wins** (see the "Do not invent config" warning in §4).

---

## 1. Prerequisites / ground truth

Verified against the repo at `C:/Users/agrob/TNG-Purchasing/tng-purchasing-30` (checklist §0):

| Fact | Value | Source |
|---|---|---|
| Firebase project | `tng-systems` | `.firebaserc` (default) |
| Firestore database | **named** `tng-systems` — not `(default)` | `functions/src/qr/firestore.ts` (`QR_DATABASE_ID = 'tng-systems'`); `firebase.json` configures rules/indexes for **both** DBs |
| Hosting sites | `tng-systems` (prod), `tng-systems-staging` (staging) | `.firebaserc` |
| Functions region | **`us-central1`** (v2 default — no region override in code) | `functions/src/**` |
| Feature state | **UNCOMMITTED** on branch `feat/qr-customer-menu` (working tree dirty beyond HEAD `ace1261`) | Go/No-Go accepted-risk item, §9.2 |
| Repo deploy scripts | **hosting-only** — they never deploy functions/rules/indexes | `scripts/deploy-production.mjs`, `scripts/deploy-staging.mjs` |
| Firebase CLI | **local devDependency only** (`firebase-tools` ^15.4, resolved 15.12.0) — there is **no global `firebase` command** on this machine | root `package.json`; repo scripts invoke `npx firebase` |

> **CLI convention for this entire runbook:** every Firebase CLI command below is written `npx firebase …` and must be run **from the repo root** so the local `firebase-tools` resolves. If you prefer a global install, run `npm i -g firebase-tools && firebase login` first and drop the `npx` — but do not mix the two mid-run. A bare `firebase …` that silently resolves to nothing is exactly how the `$CBTOKEN` capture in §7 ends up empty and every webhook injection 401s.

> **WARNING — the repo's deploy scripts do NOT deploy functions, rules, or indexes.**
> `scripts/deploy-production.mjs` and `scripts/deploy-staging.mjs` build the Vite app and run `npx firebase deploy --only hosting` (production pins `hosting.site` to `tng-systems`; staging pins it to `tng-systems-staging`). Running `npm run deploy`-style scripts will never publish `createXenditSession`, `xenditWebhook`, Firestore rules, or composite indexes. You must run the explicit commands in §2 yourself. (This is the checklist's §6 "Gate B / P1-3" gap.)
> **Additionally:** the stock staging script **always produces a `(default)`-database client build** — see the mandatory procedure in §2.4 before using it for this run.

**Console discipline:** every Firestore read/write in this runbook happens in the **named database `tng-systems`**. In the Firebase console, switch the database picker from `(default)` to `tng-systems` first, every time — otherwise your test data is invisible to the functions.

**Execution sequence.** Sections below are grouped by topic; the actual run order is:

1. §4 steps 1–3 + 6 — Xendit dashboard prep (test key, channels, verification token)
2. §3 — set Firebase secrets + params (secrets bind at deploy)
3. §2 — deploy functions, rules, indexes (full functions deploy first — see §2.1)
4. §5 — capture the `xenditWebhook` URL
5. §4 steps 4–5 — register the webhook URL + events in Xendit
6. §6 — test BU / table / menu setup
7. §9.1–9.2 — pre-run Go/No-Go gate (any failure = stop)
8. §7 — full E2E (cases A–H)
9. §9.3 — post-run verification, then §8 R1/R4 (restore kill switch **durably**, cleanup)
10. §10 — post the Slack report

---

## 2. Deploy commands (functions / rules / indexes)

> **Dependency:** run §3 (secrets + params) and §4 steps 1–3 (Xendit test key + token values) **before** deploying — secrets bind to the functions at deploy time.

`firebase.json` `functions.predeploy` runs `npm --prefix functions run build` automatically. Before any deploy, the local suite must be green (checklist §6 step 1): `npm --prefix functions run test` (117), `npm --prefix functions run test:emulator` (9, needs Java), `npm --prefix functions run build`, root `tsc -b`, `vite build`.

### 2.1 Deploy functions

**Primary — first deploy of this branch MUST be a full functions deploy.** The feature is uncommitted (§9.2 accepted risk), so the non-payment QR functions (`getPublicMenu`, `createQrOrder`, `createQrTable`, `listQrTables`, `getQrTableToken`, `getQrOrder`) are absent or stale in production. The §6/§7 E2E requires **all eight QR functions live at the current working-tree version** — a two-function partial deploy would leave `createQrOrder`/`getPublicMenu` missing or old (a stale `createQrOrder` doesn't write the `paymentStatus` fields the webhook expects).

```bash
cd C:/Users/agrob/TNG-Purchasing/tng-purchasing-30
npx firebase deploy --only functions --project tng-systems
```

This publishes all 11 exported functions (`postTransaction`, `setBudgetLimit`, `getPublicMenu`, `createQrOrder`, `createQrTable`, `listQrTables`, `getQrTableToken`, `getQrOrder`, `postOfficialInvoice`, `createXenditSession`, `xenditWebhook`).

**Subsequent iterations only** (after a full deploy of the branch is live), the two-function partial deploy is the fast path:

```bash
npx firebase deploy --only functions:createXenditSession,functions:xenditWebhook --project tng-systems
```

> **Kill-switch caveat:** every functions deploy re-applies the param values in `functions/.env.tng-systems` — including `QR_PAYMENTS_ENABLED` — and replaces the Cloud Run revision, **overwriting any gcloud-set kill-switch flip** (see §8 R1). Before any redeploy, make sure that file holds the value you intend.

**Capture the `xenditWebhook` URL from the deploy output** (see §5) — you need it for §4 step 4.

### 2.2 Deploy Firestore rules

> **WARNING — `--only firestore:rules` and `--only firestore:indexes` are SILENT NO-OPS in this repo. Never use them.**
> `firebase.json` declares `firestore` as an **array** of database-keyed configs (`(default)` + `tng-systems`). In firebase-tools 15.12.0, anything after `firestore:` is treated as a **database/target name** (`lib/firestore/fsConfig.js`): `rules` and `indexes` match no configured database, are then explicitly deleted from the error-check set, and the deploy exits **successfully having published nothing**. An operator trusting the exit code would believe the QR rules (`qr_tables` `write: false`, `xendit_events` `read,write: false`) and composite indexes are live when they are not.

Deploy rules **and** indexes to **both** configured databases:

```bash
npx firebase deploy --only firestore --project tng-systems
```

Or per database (the database-id form is verified to work with this CLI version and config):

```bash
npx firebase deploy --only firestore:tng-systems --project tng-systems
npx firebase deploy --only "firestore:(default)" --project tng-systems
```

**Independent verification (mandatory — do not trust the deploy exit code):** Console → Firestore → **each** database (`tng-systems` and `(default)`) → Rules tab → confirm the ruleset **publish timestamp** is from this deploy.

### 2.3 Deploy Firestore indexes

Indexes are published by the **same** `--only firestore` (or per-database) command in §2.2 — there is no working indexes-only filter with this repo's array config (see the warning above).

`firestore.indexes.json` includes the three QR composites the flows need: `qr_orders (businessUnitId ASC, status ASC, createdAt DESC)`, `qr_orders (businessUnitId ASC, tableId ASC, createdAt DESC)`, and `qr_tables (businessUnitId ASC, isActive ASC)`. Index builds are asynchronous — confirm state `READY` in Console → Firestore → database `tng-systems` → Indexes before running list/status queries.

### 2.4 Client (hosting) — staging deploy, mandatory procedure

The client build for the run needs `VITE_QR_PAYMENTS_ENABLED=true` and `VITE_FIREBASE_DATABASE_ID=tng-systems`, with `VITE_FUNCTIONS_EMULATOR_HOST` **unset** (checklist §4b).

> **WARNING — the stock staging script produces the WRONG build for this run.**
> `scripts/deploy-staging.mjs` line 10 force-writes `.env.staging` containing `VITE_FIREBASE_DATABASE_ID=` (**empty**) and builds with `--mode staging`; the Vite mode file overrides `.env`, and `src/config/firebase.ts` maps an empty value to the **`(default)`** database. That is the script's deliberate design (staging = default DB) — but for this run it directly violates §6's precondition and gate 9.1 #8: the staging client's direct Firestore reads/writes (admin table UI at `/qr-tables`, menu-item creation) would silently land in `(default)` while every QR function is hard-pinned to the named `tng-systems` DB. Test data becomes invisible to the functions; stray writes land in the wrong database.

**Required procedure:**

1. Create `.env.staging.local` in the repo root (Vite loads it **after** `.env.staging`, so it overrides the script's blanked value; `*.local` is gitignored):

   ```
   VITE_FIREBASE_DATABASE_ID=tng-systems
   VITE_QR_PAYMENTS_ENABLED=true
   ```

2. Run the script — it builds and deploys to the staging site by temporarily setting `hosting.site` to `tng-systems-staging`:

   ```bash
   node scripts/deploy-staging.mjs
   ```

3. **Post-deploy verification against the deployed artifact** (not the build log — this is the gate 9.1 #8 check): open `https://tng-systems-staging.web.app`, open DevTools → Console, and confirm the line `🔥 Firestore Database: tng-systems`. If it says `(default)`, stop — the override did not take.

4. After the run, delete `.env.staging.local` if staging should revert to its normal `(default)`-DB builds.

**Do NOT use:**

- `npx firebase deploy --only hosting:staging` — **fails outright** with this repo's `firebase.json`: the hosting block declares `"site": "tng-systems"` with no `target` field, so `staging` matches neither and the CLI throws `Hosting site or target staging not detected in firebase.json`. The `.firebaserc` hosting targets (`production`/`staging`) are inert because `firebase.json` never references them.
- plain `npx firebase deploy --only hosting` — **publishes the uncommitted, dirty-tree client build to the PRODUCTION site `tng-systems`** (pinned in `firebase.json`).

The only safe raw-CLI staging path with the current config is `--only hosting:tng-systems-staging` **after** temporarily setting `hosting.site` to `tng-systems-staging` — which is exactly what the script does. Longer-term fix (out of scope for this run): convert `firebase.json` to target-based hosting configs (`"target": "staging"` / `"target": "production"`) so the `.firebaserc` targets actually bind.

---

## 3. Secrets (Firebase + GitHub)

### 3.1 The two Firebase secrets (Cloud Secret Manager)

The exact `defineSecret` names in the code are:

| Secret | Declared in | Used for |
|---|---|---|
| `XENDIT_SECRET_KEY` | `functions/src/qr/createXenditSession.ts` | Basic-auth header of the Xendit API client. **Sandbox = your `xnd_development_...` key.** If unset, the callable silently uses the mock client and never calls Xendit. |
| `XENDIT_CALLBACK_TOKEN` | `functions/src/qr/xenditWebhook.ts` | Constant-time compare against the webhook's callback-token header. Copy it from Xendit Dashboard (TEST mode) → Settings → Webhooks → Verification token (§4 step 6). |

```bash
cd C:/Users/agrob/TNG-Purchasing/tng-purchasing-30
npx firebase functions:secrets:set XENDIT_SECRET_KEY --project tng-systems
# paste the xnd_development_... TEST key when prompted

npx firebase functions:secrets:set XENDIT_CALLBACK_TOKEN --project tng-systems
# paste the Xendit TEST-mode webhook verification token when prompted
```

**Verify — prefix/metadata only. NEVER print a full secret value to the terminal** (console scrollback and PowerShell transcripts capture it — that is exactly the exposure class §8 R5 treats as a rotation trigger):

```powershell
# Key: check the prefix ONLY (same check as gate 9.1 #4) — must print xnd_development
(npx firebase functions:secrets:access XENDIT_SECRET_KEY --project tng-systems).Substring(0,15)

# Callback token: verify existence + version metadata ONLY — never the raw value
npx firebase functions:secrets:get XENDIT_CALLBACK_TOKEN --project tng-systems
```

Both secrets must be set **before** the §2.1 functions deploy (secrets bind at deploy) and before any E2E payment — an unset/wrong `XENDIT_CALLBACK_TOKEN` means every webhook delivery gets 401 and Xendit retries against a rejecting endpoint.

### 3.2 The three non-secret params

`createXenditSession.ts` declares three v2 params. Their in-code defaults:

| Param | Type | Default | Sandbox value |
|---|---|---|---|
| `XENDIT_API_BASE` | `defineString` | `https://api.xendit.co` | keep default (TEST vs LIVE is decided by the key prefix, not the URL) |
| `QR_PUBLIC_BASE_URL` | `defineString` | `https://tng-systems.web.app` | set to the hosting site you run against — the checklist (§0, §4a) recommends staging, `https://tng-systems-staging.web.app`; return URLs are built from this value |
| `QR_PAYMENTS_ENABLED` | `defineBoolean` | `false` (**kill switch — callable refuses while false**) | `true` for the sandbox run |

Create `functions/.env.tng-systems` so deploys are non-interactive and reproducible:

```
XENDIT_API_BASE=https://api.xendit.co
QR_PUBLIC_BASE_URL=https://tng-systems.web.app
QR_PAYMENTS_ENABLED=true
```

(Substitute `QR_PUBLIC_BASE_URL=https://tng-systems-staging.web.app` if you run against staging, per the checklist recommendation — the E2E examples in §7 use the base you set here. Without this file, `firebase deploy` prompts for any param that has no saved value; defaults above apply if you accept them.)

> **This file is the source of truth for `QR_PAYMENTS_ENABLED` — treat it that way.**
> Every `firebase deploy --only functions…` re-reads this file and re-applies its values to the service environment, replacing the Cloud Run revision and **overwriting any env var set directly via gcloud**. The fast no-deploy kill switch in §8 R1 is therefore only durable if you **also edit this file** when you flip the flag. Note the file is not covered by `.gitignore` (which lists only `.env`, `.env.local`, `.env.production`) — do not commit it with `true` set, and never put secrets in it.

To roll back payments later: follow §8 R1 **in full** (gcloud flip + edit this file), or edit this file to `QR_PAYMENTS_ENABLED=false` and redeploy the function.

### 3.3 GitHub Actions secrets

**None required.** `.github/workflows/` exists in the repo but is **empty** — there are no CI workflow files, so no GitHub repository secrets are consumed. All deploys in this runbook are manual CLI deploys using your local `firebase login` credentials.

---

## 4. Xendit sandbox settings (dashboard, TEST mode)

Everything in this section happens in the **Xendit Dashboard in Test mode** — no code changes, no deploys, no live credentials. The two values you leave this section holding map 1:1 to the only two Xendit secrets the code binds (§3.1):

| Dashboard value | Goes into (Cloud Secret Manager) | Bound by | Used as |
|---|---|---|---|
| Test **secret API key** | `XENDIT_SECRET_KEY` | `functions/src/qr/createXenditSession.ts` (`defineSecret('XENDIT_SECRET_KEY')`) | Basic auth on `POST {XENDIT_API_BASE}/v3/sessions` — header is `Basic base64(secretKey + ':')` (`functions/src/qr/xenditClient.ts`) |
| **Webhook verification token** | `XENDIT_CALLBACK_TOKEN` | `functions/src/qr/xenditWebhook.ts` (`defineSecret('XENDIT_CALLBACK_TOKEN')`) | Constant-time compare against the `x-callback-token` request header; mismatch → HTTP 401, no processing (`functions/src/qr/xenditWebhook.handler.ts`) |

> **Do not invent config.** The code has **no `XENDIT_MODE` parameter and no IP-allowlist** — the implementation plan (§3 of that doc) lists them aspirationally, but `createXenditSession.ts` defines only `XENDIT_SECRET_KEY`, `XENDIT_API_BASE` (default `https://api.xendit.co`), `QR_PUBLIC_BASE_URL` (default `https://tng-systems.web.app`), and `QR_PAYMENTS_ENABLED` (default `false`). Test-vs-live is selected **solely by which key value is stored in `XENDIT_SECRET_KEY`**; the API base is the same for both. The webhook authenticates **solely by token** — do not add IP-allowlist steps.

### Step 1 — Switch the dashboard to Test mode
1. Log in at `https://dashboard.xendit.co`.
2. Flip the **Test mode** toggle (top of the left sidebar). Every step below must be done with this toggle ON — test keys, test channels, and the test webhook token are all scoped to Test mode and are distinct from their Live counterparts.

### Step 2 — Generate the test secret API key
1. Go to **Settings → Developers → API Keys → Generate secret key**.
2. Name it something identifiable (e.g. `tng-qr-sandbox`), grant **Money-in: Write** permission (required for creating payment sessions), and generate.
3. Confirm the key prefix is the **test/development prefix `xnd_development_...`** — a `xnd_production_...` key means you are in Live mode; stop and redo Step 1.
4. Copy it immediately (shown once). This value becomes the `XENDIT_SECRET_KEY` secret (set via §3.1 — do NOT paste it into any file in the repo).
5. Note the code behavior this key drives (`createXenditSession.ts`): **if `XENDIT_SECRET_KEY` is empty/unset, the function silently uses the mock client** (`createMockXenditClient`, returns `/checkout/demo?ref=...` links and never calls Xendit). Sandbox E2E therefore requires the test key to actually be set — a "payment link" starting with `/checkout/demo` means the secret was not bound.

### Step 3 — Verify the test payment channels
1. Go to **Settings → Payment methods** (still in Test mode).
2. Confirm all four channels the session covers are active for test transactions: **GCash**, **Maya**, **QR Ph**, and **Cards**. In Test mode these are typically pre-enabled; request activation for any that are missing.
3. Context: the code creates one hosted-checkout session covering all of them — `POST /v3/sessions` with `session_type: 'PAY'`, `mode: 'PAYMENT_LINK'`, `capture_method: 'AUTOMATIC'` (`xenditClient.ts`). There is no per-channel configuration in the codebase; channel availability is purely a dashboard concern.

### Step 4 — Register the webhook URL
1. Go to **Settings → Developers → Webhooks** (Test mode — the Test and Live webhook registrations are separate).
2. Set the callback URL to the deployed `xenditWebhook` HTTPS function for project `tng-systems` — the exact URL comes from the §2.1 deploy output / §5 below. If you are doing dashboard prep before the deploy step, leave this field for a second pass — the rest of this section does not depend on it.
3. Notes on what the endpoint accepts (`xenditWebhook.handler.ts`): **POST only** (anything else → 405), JSON body, and it ACKs with 200 even for duplicates / unknown orders / non-actionable events so Xendit does not retry-storm. Only a bad/missing `x-callback-token` returns non-200 (401).

### Step 5 — Subscribe to the payment-session events
Subscribe the webhook to the Payments API v3 session/payment events. The handler (`classifyEvent` in `xenditWebhook.handler.ts`) maps them by substring of the event name, with the payload `status` as fallback:

| Subscribe to | Handler classifies as | Effect on `qr_orders/{orderId}` |
|---|---|---|
| `payment.succeeded` / `payment_session.completed` | `paid` (name contains `succeeded`/`completed`, or status `SUCCEEDED`/`COMPLETED`/`PAID`) | one-way `AWAITING_PAYMENT → PAID` (+ `paidAt`, `xenditPaymentId`, `xenditChannelCode`, `paymentMethodType`), then release to kitchen/bar |
| `payment.failed` | `failed` (name contains `failed`, or status `FAILED`) | `paymentStatus = 'FAILED'` only; `status` never changes, never released |
| `payment_session.expired` | `expired` (name contains `expired`, or status `EXPIRED`) | `paymentStatus = 'EXPIRED'` only; same non-release guarantee |

Payload fields the handler extracts (from the root or nested `data` object): `event`, `payment_id` (or `id`), `reference_id` (format `${orderId}:${attempt}` — the orderId is everything before the first `:`), `payment_session_id`/`session_id`, `status`, `amount`, `currency`, `channel_code`, `payment_method.type`. A delivery without `payment_id` + `event` is ACKed and ignored. For a `paid` event to apply, `amount` must **exactly equal** the server order's `totalAmount` and `currency` must equal the order's currency (default `'PHP'`) — the dashboard's "send test event" button with fabricated amounts will land as `rejected`, which is expected.

### Step 6 — Copy the webhook verification token
1. On the same **Webhooks** page, reveal and copy the **Webhook verification token** for **Test mode** (it is a different value from the Live token).
2. This value becomes the `XENDIT_CALLBACK_TOKEN` secret (§3.1). Xendit sends it on every delivery as the `x-callback-token` header; the handler compares it constant-time (`tokensMatch`) and never logs it.
3. Sequencing matters: the token must be stored in Secret Manager **before** you run any E2E payment, otherwise every delivery gets 401 and Xendit retries against a rejecting endpoint. Set both secrets together (§3.1).

### Exit criteria for this section
- [ ] Dashboard is in Test mode; test secret key with `xnd_development_` prefix copied (destined for `XENDIT_SECRET_KEY`).
- [ ] GCash / Maya / QR Ph / Cards visible as active test channels.
- [ ] Webhook URL registered (or explicitly deferred until after the §2.1 functions deploy).
- [ ] Subscribed to `payment.succeeded`, `payment_session.completed`, `payment.failed`, `payment_session.expired`.
- [ ] Test-mode webhook verification token copied (destined for `XENDIT_CALLBACK_TOKEN`).
- [ ] No `XENDIT_MODE`, no IP allowlist, and no redirect-URL configured in the dashboard — return URLs are passed per-session by the code (`success_return_url = {QR_PUBLIC_BASE_URL}/order-status/{orderId}?return=xendit`, cancel is the same URL **bare**), so there is nothing to set dashboard-side for redirects.

---

## 5. Webhook URL format

`xenditWebhook` is a Firebase Functions **v2** `onRequest` function (region `us-central1`, project `tng-systems`), so it is served as a Cloud Run service with two valid URL forms:

- **cloudfunctions.net form** (deterministic):
  `https://us-central1-tng-systems.cloudfunctions.net/xenditWebhook`
- **Cloud Run form** (contains a per-project hash — you cannot guess it):
  `https://xenditwebhook-<hash>-uc.a.run.app`
  (v2 lowercases the **service** name; `uc` = us-central1)

The authoritative URL is printed in the deploy output (`Function URL (xenditwebhook(us-central1): ...)`). Retrieve it any time — primary source of truth first:

```powershell
# Primary (case-insensitive, lists all functions + URLs):
npx firebase functions:list --project tng-systems

# Alternatives — note the name casing: the Cloud Functions RESOURCE keeps the exported
# camelCase id (xenditWebhook); only the derived Cloud Run SERVICE name is lowercased
# (xenditwebhook). gcloud lookups are case-sensitive.
gcloud functions describe xenditWebhook --region us-central1 --project tng-systems --format="value(url)"
gcloud run services describe xenditwebhook --region us-central1 --project tng-systems --format="value(status.url)"
```

Use that exact URL as the TEST-mode callback URL in the Xendit dashboard (§4 step 4). Never guess the URL — capture it. The handler accepts POST only and verifies the callback-token header against `XENDIT_CALLBACK_TOKEN` before touching Firestore.

---

## 6. Test BU / table / menu setup + expected doc shapes

Everything in this section happens in the **named Firestore database `tng-systems`** — the QR callables are hard-pinned to it via `QR_DATABASE_ID = 'tng-systems'` in `functions/src/qr/firestore.ts`. In the Firebase console, switch the database picker from `(default)` to `tng-systems` before every read/write below, or your test data will be invisible to the functions. (Cross-reference: checklist §7–§8 for the requirements; the steps below are the exact operational procedure.)

**Preconditions**
- [ ] A staff account whose `users/{uid}` doc (in `tng-systems`) has `role: "SUPER_ADMIN"` or `role: "ADMIN"` — `createQrTable` fails closed for any other role (`QR_TABLE_ADMIN_ROLES` in `functions/src/qr/auth.ts`).
- [ ] The web app you use for admin/menu work is running with `VITE_FIREBASE_DATABASE_ID=tng-systems` (see `src/config/firebase.ts:85-91` and the §2.4 procedure — verify the browser console line `🔥 Firestore Database: tng-systems`). If this is empty, UI-created menu items land in `(default)` and `getPublicMenu` will never see them.

### Step 1 — Create a dedicated sandbox business unit

Use a BU id that can never collide with real reporting, e.g. `qr-sandbox-bu`.

1. Console → Firestore → database `tng-systems` → collection `businesses` → Add document, **Document ID:** `qr-sandbox-bu`:
   ```json
   { "name": "QR Sandbox Test BU" }
   ```
   `createQrTable` only checks that the doc **exists** (`createQrTable.handler.ts:40-43`), so a minimal doc is sufficient. (Client-side creation would require the `admin:business:edit` permission per `firestore.rules`; console creation bypasses rules and is fine for this one seed doc.)
2. Checkpoint — the BU is clean: query `menu_items` and `qr_tables` where `businessUnitId == "qr-sandbox-bu"` → both must return **0 docs**.

### Step 2 — Create the table via the `createQrTable` callable ONLY

Never hand-write a `qr_tables` doc. Rules are `allow write: if false` (`firestore.rules`, `match /qr_tables/{tableId}`), and the server mints the `qrToken` (18 base62 chars, ~107 bits, `crypto.randomBytes` — `createQrTable.handler.ts:16,58`) plus enforces the duplicate-active-table check. A console-written doc bypasses all of that and produces a token the security model assumes no human ever chose.

**Option A (recommended):** signed in as the admin account, open the admin UI at **`/qr-tables`** (`TableManagementView`), and create a table with BU `qr-sandbox-bu`, table number `T-SANDBOX-01`.

**Option B (curl, no UI):** grab the ID token from any authenticated request in DevTools → Network (tokens expire after ~1 h). **Do not paste the token into the command line** — on Windows, child-process argv is visible to any local process (Task Manager, `Get-CimInstance Win32_Process`) and this is a ~1 h SUPER_ADMIN/ADMIN credential. Pass it via a curl config file instead:

```powershell
# Put ONLY the header line in a temp config file (never in argv):
$authCfg = Join-Path $env:TEMP ("qr-auth-" + [guid]::NewGuid().ToString('N') + ".conf")
"header = `"Authorization: Bearer <PASTE_ID_TOKEN_HERE>`"" | Set-Content -Encoding ascii $authCfg
try {
  curl.exe -s -X POST "https://us-central1-tng-systems.cloudfunctions.net/createQrTable" `
    --config $authCfg `
    -H "Content-Type: application/json" `
    -d '{"data":{"businessUnitId":"qr-sandbox-bu","tableNumber":"T-SANDBOX-01"}}'
} finally { Remove-Item $authCfg -Force }
```

Expected response:
```json
{ "result": { "tableId": "<auto-id>", "tableNumber": "T-SANDBOX-01", "qrToken": "<18 base62 chars>" } }
```

- [ ] **Record `tableId` and `qrToken` now.** `listQrTables` deliberately omits tokens; later reveal is a one-at-a-time `getQrTableToken` call.
- [ ] Repeat with `T-SANDBOX-02` if you want a second table for idempotency/rate-limit tests.

Error table (all from `createQrTable.handler.ts`):

| Error code | Cause |
|---|---|
| `unauthenticated` / `permission-denied` | No auth, or `users/{uid}.role` not in `SUPER_ADMIN`/`ADMIN` |
| `invalid-argument` | Missing/empty `businessUnitId` or `tableNumber` |
| `not-found` | `businesses/qr-sandbox-bu` doesn't exist in `tng-systems` |
| `already-exists` | An **active** table with the same `tableNumber` already exists in this BU |

### Step 3 — Verify the `qr_tables` doc shape

Console (admin account; direct reads are `isSuperAdminOrAdmin()`-only) → `tng-systems` → `qr_tables/{tableId}`:

```json
{
  "id": "<same as doc id>",
  "businessUnitId": "qr-sandbox-bu",
  "tableNumber": "T-SANDBOX-01",
  "qrToken": "<18 base62 chars, e.g. aZ3kP9qL2mN8xR5tWb>",
  "isActive": true,
  "createdBy": "<admin uid>",
  "createdAt": "<server Timestamp>",
  "updatedAt": "<server Timestamp>"
}
```

### Step 4 — Create ≥ 2 active menu items in the SAME BU

`menu_items` allows create/update by any signed-in user (`firestore.rules`, `match /menu_items/{itemId}`), so use either the console (database `tng-systems`) or the app's menu UI. The QR flow reads exactly the `RawMenuItem` fields (`functions/src/qr/orderLogic.ts:11-22`):

| Field | Type | Notes |
|---|---|---|
| `businessUnitId` | string | Must be exactly `qr-sandbox-bu` — `getPublicMenu` filters on it and `repriceLine` rejects cross-BU items (`MENU_ITEM_WRONG_BU`) |
| `name` | string | required |
| `category` | string | Use one of the app's `MENU_CATEGORIES` (`Appetizers`, `Mains`, `Desserts`, `Beverages`, `Cocktails`, `Sides`, `Specials`, `Other` — `src/features/menu/types/menu.types.ts:8-16`) |
| `sellingPrice` | **number** | Must be Firestore *number* type, finite, ≥ 0 — otherwise `MENU_ITEM_BAD_PRICE` at order time |
| `isActive` | boolean | Must be `true` (`getPublicMenu` filters `isActive == true`; maps to `isAvailable` in the public DTO) |
| `description` | string, optional | passed through if present |
| `imageUrl` | string, optional | passed through if present |

Suggested docs (two price points make total-amount checks obvious later):

`menu_items/<auto-id>` #1:
```json
{
  "businessUnitId": "qr-sandbox-bu",
  "name": "Sandbox Iced Tea",
  "category": "Beverages",
  "sellingPrice": 50,
  "description": "QR sandbox test item — cheap line",
  "isActive": true
}
```

`menu_items/<auto-id>` #2:
```json
{
  "businessUnitId": "qr-sandbox-bu",
  "name": "Sandbox Burger",
  "category": "Mains",
  "sellingPrice": 249.5,
  "description": "QR sandbox test item — decimal price line",
  "isActive": true
}
```

**Sensitive fields:** the full app `MenuItem` type also carries `calculatedCost`, `grossMargin`, `marginPercent`, `foodCostPercent`, and `ingredients` (`src/features/menu/types/menu.types.ts:91-109`). Do **not** put real cost data on sandbox items — and note that even if present, `sanitizeMenuItem` is a strict whitelist (`orderLogic.ts:75-86`, applied in `getPublicMenu.handler.ts:47-50`): the public response can only ever contain `id`, `name`, `category`, `sellingPrice`, `description?`, `imageUrl?`, `isAvailable`. A later validation step asserts the cost/margin fields are absent from the `getPublicMenu` payload.

### Step 5 — Exit checkpoints for this section

- [ ] `getPublicMenu` with the recorded `qrToken` returns `{ tableId, tableNumber: "T-SANDBOX-01", businessUnitId: "qr-sandbox-bu", items: [ ...2 items ] }` and each item has **only** the whitelisted DTO keys above (no `calculatedCost`, no `grossMargin`, no `ingredients`).
- [ ] **Pricing is server-authoritative.** The customer cart never submits prices — `createQrOrder` re-prices every line from `menu_items.sellingPrice` at order time (`repriceLine`, `orderLogic.ts:97-122`) and rejects unknown (`MENU_ITEM_NOT_FOUND`), cross-BU (`MENU_ITEM_WRONG_BU`), and inactive (`MENU_ITEM_UNAVAILABLE`) items. To change a test price, edit the `menu_items` doc; sending a different price from the client is silently ignored by design.
- [ ] `qrToken`, `tableId`, and the two menu item doc ids are recorded in your run log — §7 consumes them.

---

## 7. Full end-to-end sandbox test script — with expected Firestore state after each step

All names below are verified against the repo (`functions/src/qr/*.handler.ts`, `functions/src/index.ts`, `src/features/qr-ordering/**`). SANDBOX/TEST mode only: Xendit **test-mode** secret key (`xnd_development_…`) bound to secret `XENDIT_SECRET_KEY`, test-mode webhook verification token bound to secret `XENDIT_CALLBACK_TOKEN`. Never use live credentials in this script. Cases A–H below are the operational expansion of checklist §9 — same letters, same intent.

> URLs in this section use `https://tng-systems.web.app`; if you set `QR_PUBLIC_BASE_URL` to the staging host in §3.2 (recommended), substitute `https://tng-systems-staging.web.app` throughout.

### 0. Conventions, variables, and verification method

**Deployed surfaces** (from `functions/src/index.ts`):

| Surface | Type | Name |
|---|---|---|
| Order creation | Callable | `createQrOrder` |
| Session creation | Callable | `createXenditSession` (secret `XENDIT_SECRET_KEY`; params `XENDIT_API_BASE`, `QR_PUBLIC_BASE_URL`, `QR_PAYMENTS_ENABLED`) |
| Payment truth | HTTP `onRequest` | `xenditWebhook` (secret `XENDIT_CALLBACK_TOKEN`) |
| Status read | Callable | `getQrOrder` |

**PowerShell session variables** (set once; run from the repo root so `npx firebase` resolves; project id is `tng-systems` from `.firebaserc`, region is the v2 default `us-central1`):

```powershell
$PROJECT = 'tng-systems'
$WEBHOOK = "https://us-central1-$PROJECT.cloudfunctions.net/xenditWebhook"
# TEST-mode webhook token — the exact value stored in Secret Manager secret XENDIT_CALLBACK_TOKEN.
# Read it once into a variable (not echoed); do NOT hardcode it in files:
$CBTOKEN = (& npx firebase functions:secrets:access XENDIT_CALLBACK_TOKEN --project $PROJECT)
if ([string]::IsNullOrWhiteSpace($CBTOKEN)) { throw 'XENDIT_CALLBACK_TOKEN secret read failed — fix before any injection (an empty token means every webhook delivery 401s and cases A/B/D/E fail confusingly)' }
$ORDER_ID = '<paste qr_orders doc id after step A2>'
```

**Firestore verification.** After each step, inspect docs in the console:
`https://console.firebase.google.com/project/tng-systems/firestore/data/~2Fqr_orders~2F<ORDER_ID>` (same pattern for `xendit_events`, `counters`, `qr_order_idempotency`, `qr_rate_limits`). "(unchanged)" below means byte-identical to the previous step except where noted. `ts` = Firestore server `Timestamp`.

**Key formats (verified in code):**
- `paymentReference` / Xendit `reference_id` = `` `${orderId}:${attempt}` `` (`referenceIdFor()` in `createXenditSession.handler.ts`); the webhook parses everything before the **first** `:` back to the orderId.
- Xendit session `Idempotency-key` header = `` `session:${orderId}:${attempt}` `` — it dedupes **retries of the same attempt only**, never across attempts (see case F).
- `xendit_events` ledger doc id = `` `${payment_id}:${event}` `` with `result ∈ {applied, duplicate, rejected, ignored}`.
- `counters/qr` = `{ value: <int>, prefix: 'QR', lastUpdated: '<ISO string>' }`; `orderNumber` = `QR-` + `value` left-padded to **5** digits (`formatOrderNumber`, `ORDER_NUMBER_PAD = 5`), e.g. `QR-00042`.

**Webhook injection helper** (used for B–E; deterministic alternative to waiting for Xendit's test-mode delivery). The handler tolerates the nested v3 shape: `event` at root, fields under `data` (`extractEvent`). Amount must equal the order's `totalAmount` **exactly** (strict `Number(order.totalAmount) === ev.amount` compare) and currency must equal the order's `currency` (`PHP`).

**The callback token is never passed on the command line** — argv is visible to any local process on Windows and can leak into transcripts/error output. The helper writes the header to a per-call temp curl config file and deletes it afterwards:

```powershell
function Send-XenditEvent($payloadPath, $token = $CBTOKEN) {
  $cfg = Join-Path $env:TEMP ("xnd-hdr-" + [guid]::NewGuid().ToString('N') + ".conf")
  "header = `"x-callback-token: $token`"" | Set-Content -Encoding ascii $cfg
  try {
    curl.exe -s -o - -w "`nHTTP %{http_code}`n" -X POST $WEBHOOK `
      -H "content-type: application/json" --config $cfg `
      --data "@$payloadPath"
  } finally { Remove-Item $cfg -Force }
}
```

---

### A. Happy path: scan → order → pay → webhook `succeeded` → PAID → released

**A1. Scan the table QR / open the menu.**
Open `https://tng-systems.web.app/order/{qrToken}` on a phone (or desktop). Requires the client build to have `VITE_QR_PAYMENTS_ENABLED=true` (client UX gate in `createSession.service.ts`) and the deployed function param `QR_PAYMENTS_ENABLED=true`.

*Expected Firestore state:* no `qr_orders` writes. Side effect only: `qr_rate_limits` menu-read counter doc ticks (fixed-window `{ windowStart, count }`; budget 30/60 s). `counters/qr` unchanged.

**A2. Add items, submit the order** (CustomerMenuView → `createQrOrder` callable).

*Expected `qr_orders/{ORDER_ID}` (new doc, auto-id):*

```
id:              '<ORDER_ID>'            // equals the doc id
businessUnitId:  '<from qr_tables/{tableId}>'
tableId:         '<tableId>'
tableNumber:     '<denormalized from the table>'
orderNumber:     'QR-000NN'              // counters/qr.value after increment, padded to 5
items:           [ server-repriced lines: productName, quantity, unitPrice, subtotal, … ]
orderType:       'DINE_IN'
subtotal:        <number>   taxAmount: 0   totalAmount: <number>
currency:        'PHP'
status:          'AWAITING_PAYMENT'
paymentStatus:   'UNPAID'
createdAt: ts    updatedAt: ts
customerName:    '<only if entered>'
// NOT present yet: paymentAttempt, paymentReference, paymentLinkUrl,
// xenditPaymentSessionId, sessionExpiresAtMillis, paidAt, released
```

*Expected `counters/qr`:* `value` incremented by exactly 1 (created as `{ value: 1, prefix: 'QR', lastUpdated: ISO }` if it did not exist).
*Expected `qr_order_idempotency/{tableId}:{idempotencyKey}` (new):* `{ orderId, orderNumber, totalAmount, tableId, businessUnitId, idempotencyKey, createdAt: ts }` — written in the same transaction as the order.
*Expected `xendit_events`:* none yet. Record the doc id as `$ORDER_ID`.

**A3. Tap "Pay" on `/checkout/{ORDER_ID}`** (CheckoutView → `createXenditSession` callable → full-page redirect to the returned `paymentLinkUrl`).

*Expected `qr_orders/{ORDER_ID}` deltas (two transactions: attempt bump, then session persist):*

```
paymentAttempt:          1
paymentStatus:           'AWAITING_PAYMENT'        // was UNPAID
paymentReference:        '<ORDER_ID>:1'
xenditPaymentSessionId:  'ps-…'                    // Xendit payment_session_id
xenditPaymentRequestId:  'pr-…' or ''
paymentLinkUrl:          'https://…'               // Xendit hosted checkout (test mode)
sessionExpiresAtMillis:  <epoch ms>                // Xendit expires_at, else now + 30 min
updatedAt:               ts (bumped)
// status STILL 'AWAITING_PAYMENT' — this handler never writes PAID
```

*Also:* `qr_rate_limits/session:{tableId}` ticks (budget 5/60 s). Browser is now on the Xendit test checkout; the session in the Xendit test dashboard shows `reference_id = <ORDER_ID>:1`, `success_return_url = https://tng-systems.web.app/order-status/<ORDER_ID>?return=xendit`, `cancel_return_url` = same URL without the query.

**A4. Complete payment on the Xendit test checkout** (e.g. test e-wallet/QRPH channel). No Firestore change happens from the browser — the redirect back is only a hint.

**A5. Xendit test-mode delivers `payment.succeeded` to `$WEBHOOK`** (the webhook URL + verification token were registered in §4 steps 4–6). To simulate instead:

```powershell
@"
{ "event": "payment.succeeded",
  "data": { "payment_id": "pay_sbx_A5", "reference_id": "$($ORDER_ID):1",
            "payment_session_id": "ps_sbx_A5", "status": "SUCCEEDED",
            "amount": <totalAmount>, "currency": "PHP",
            "channel_code": "GCASH", "payment_method": { "type": "EWALLET" } } }
"@ | Set-Content -Encoding utf8 payload-A5.json
Send-XenditEvent payload-A5.json
```

*Expected HTTP:* `200` body `{"received":true,"result":"applied"}`.

*Expected `qr_orders/{ORDER_ID}` (paid + released):*

```
status:            'PAID'                 paymentStatus: 'PAID'
paidAt:            ts
xenditPaymentId:   'pay_sbx_A5'           // the webhook's payment_id
xenditChannelCode: 'GCASH'
paymentMethodType: 'EWALLET'
updatedAt:         ts (bumped)
released:          true                   // written by releaseQrOrder AFTER the PAID commit
releasedAt:        ts
releaseSource:     'XENDIT_WEBHOOK'
releaseEventId:    'pay_sbx_A5'           // = payment_id; no releasedBy (webhook passes none)
```

*Expected `xendit_events/pay_sbx_A5:payment.succeeded` (new):*

```
id: 'pay_sbx_A5:payment.succeeded'   xenditPaymentId: 'pay_sbx_A5'
event: 'payment.succeeded'           orderId: '<ORDER_ID>'
businessUnitId: '<order BU>'         amount: <totalAmount>   currency: 'PHP'
result: 'applied'                    receivedAt: ts   processedAt: ts
```

*`counters/qr`:* unchanged (only order creation bumps it).

**A6. Browser returns to `/order-status/{ORDER_ID}?return=xendit`.**
OrderStatusView detects the marker (`isXenditReturn`), shows the amber "Confirming payment" chip + banner, and polls `getQrOrder` every 2.5 s (max 45 s). As soon as the read returns `paymentStatus: 'PAID'`, polling stops and the UI shows status **Paid** / payment chip **Paid**.

*Expected Firestore:* `qr_orders` doc unchanged from A5 (`getQrOrder` is read-only); `qr_rate_limits/order-read:{ORDER_ID}` ticks (budget 30/60 s — the 2.5 s poll ≈ 24/min stays under it).

---

### B. Duplicate / replayed webhook → idempotent no-op

**B1.** Re-send the exact A5 payload: `Send-XenditEvent payload-A5.json`.

*Expected HTTP:* `200` `{"received":true,"result":"duplicate"}` (ledger doc `pay_sbx_A5:payment.succeeded` already exists — the transaction short-circuits).
*Expected `qr_orders/{ORDER_ID}`:* **unchanged** — `paidAt` NOT re-stamped, `updatedAt` NOT bumped, release NOT re-run (`released` was already `true`, and `releaseQrOrder` is itself gated on `released !== true`).
*Expected `xendit_events`:* still exactly **one** doc for this payment/event; its `result` stays `'applied'` (the ledger is never overwritten).

**B2 (variant).** Same payment, *different* event name (new ledger id), e.g. change `"event"` to `"payment.completed"` and `payment_id` stays `pay_sbx_A5` → `200` `result:'duplicate'` via the already-paid branch; a **second** ledger doc `pay_sbx_A5:payment.completed` is created with `result: 'duplicate'`; order unchanged.

---

### C. Bad callback token → 401, nothing processed

```powershell
Send-XenditEvent payload-A5.json 'wrong-token-value'
```

*Expected HTTP:* `401` body `{"received":false,"error":"unauthorized"}` (constant-time compare in `tokensMatch`; the log line is `xenditWebhook.auth.rejected` with no token echoed).
*Expected Firestore:* **zero writes** — no `xendit_events` doc, no `qr_orders` change.

Also verify the two other guard responses:

- `GET $WEBHOOK` → `405` `{"received":false,"error":"method_not_allowed"}`.
- Valid token + non-JSON body → the handler's own `invalid_json` branch (`xenditWebhook.handler.ts`) is only reachable over HTTP with a **non-JSON content type**: if you send a malformed body with `Content-Type: application/json`, the framework's express JSON body-parser rejects it with its own 400 **before the handler runs**, and the documented body will not appear. Probe it with `text/plain`:

  ```powershell
  $cfg = Join-Path $env:TEMP ("xnd-hdr-" + [guid]::NewGuid().ToString('N') + ".conf")
  "header = `"x-callback-token: $CBTOKEN`"" | Set-Content -Encoding ascii $cfg
  try {
    curl.exe -s -o - -w "`nHTTP %{http_code}`n" -X POST $WEBHOOK `
      -H "content-type: text/plain" --config $cfg --data "not-json{"
  } finally { Remove-Item $cfg -Force }
  ```

  *Expected:* `400` `{"received":false,"error":"invalid_json"}`. (If you probe with `application/json` instead, assert **HTTP 400 only** — any body — since the framework answers first.)

---

### D. Amount / currency mismatch → `rejected`, not applied

**D1.** Create a fresh order + session (repeat A2–A3; call its id `ORDER_D`, reference `<ORDER_D>:1`).
**D2.** Inject a `payment.succeeded` whose `amount` is `totalAmount + 1` (or `currency: "USD"`), `payment_id: "pay_sbx_D"`.

*Expected HTTP:* `200` `{"received":true,"result":"rejected"}` (200 on purpose — acknowledged so Xendit does not retry-storm, but not applied).
*Expected `qr_orders/{ORDER_D}`:* **unchanged** — `status: 'AWAITING_PAYMENT'`, `paymentStatus: 'AWAITING_PAYMENT'`, no `paidAt`, no `released`, no `xenditPaymentId`.
*Expected `xendit_events/pay_sbx_D:payment.succeeded`:* `result: 'rejected'`, `amount: <the mismatched number>`, `orderId: '<ORDER_D>'`, `businessUnitId: '<order BU>'` (the order exists, so the BU is stamped — R4's BU-scoped cleanup catches this doc).
**D3 (variant).** A `reference_id` pointing at a nonexistent order also yields `result: 'rejected'` — with `orderId` set to the parsed (unknown) id (**not** null) and `businessUnitId: null`. These D3 ledger docs are the ones R4's BU-scoped query cannot catch — see the R4 manual-cleanup note (filter on `businessUnitId == null`).

---

### E. `failed` / `expired` → paymentStatus updated, NOT released; retry mints a new reference

**E1.** On `ORDER_D` (still awaiting payment), inject:

```json
{ "event": "payment.failed",
  "data": { "payment_id": "pay_sbx_E1", "reference_id": "<ORDER_D>:1",
            "status": "FAILED", "amount": <totalAmount>, "currency": "PHP" } }
```

*Expected HTTP:* `200` `result:'applied'`.
*Expected `qr_orders/{ORDER_D}`:* `paymentStatus: 'FAILED'`, `updatedAt` bumped — and **only** that: `status` stays `'AWAITING_PAYMENT'`, **no** `released`/`paidAt`/`xenditPaymentId`. (A `payment_session.expired`-style event writes `paymentStatus: 'EXPIRED'` identically.)
*Expected ledger:* `xendit_events/pay_sbx_E1:payment.failed` → `result: 'applied'`.

**E2. Retry payment** — tap Pay again on `/checkout/{ORDER_D}`. `FAILED` is in `PAYABLE_PAYMENT_STATUSES`, and `isReusableSession` is false (paymentStatus ≠ `AWAITING_PAYMENT`), so a **new** session is minted:

```
paymentAttempt:         2                       // bumped transactionally
paymentReference:       '<ORDER_D>:2'           // fresh reference — never reuses :1
paymentStatus:          'AWAITING_PAYMENT'
xenditPaymentSessionId / paymentLinkUrl / sessionExpiresAtMillis:  all NEW values
```

**E3 (guard).** After a successful pay on attempt 2, inject a late `payment.failed` for `<ORDER_D>:2` with a new `payment_id` → `200` `result:'ignored'` (never downgrades a PAID order); order unchanged; ledger doc written with `result: 'ignored'`.

---

### F. Session reuse — sequential re-tap of Pay reuses the session

**F1.** Fresh order `ORDER_F`; tap Pay (session 1 created as in A3, `paymentAttempt: 1`, reference `<ORDER_F>:1`).
**F2.** Navigate back and tap Pay **again** within the session TTL (`sessionExpiresAtMillis` still in the future). **Tap the second time only after the first checkout page has fully loaded** — the reuse guarantee below is for sequential taps, and racing the two calls will false-fail this case.

*Expected callable result:* the SAME `paymentLinkUrl` and `reference: '<ORDER_F>:1'` (the `isReusableSession` branch returns before any transaction — **no Xendit call is made**).
*Expected `qr_orders/{ORDER_F}`:* **byte-identical** to after F1 — `paymentAttempt` still `1`, `updatedAt` not bumped.
*Cross-check:* the Xendit test dashboard shows exactly one session for `<ORDER_F>:1` — **for sequential taps**.

> **What the guarantee is (and is not).** A *sequential* re-tap within the TTL reuses the session (`isReusableSession` branch — no Xendit call). *Truly concurrent* duplicate calls that both pass the reuse check before either persists a session each transactionally reserve **different** attempt numbers, producing distinct `reference_id`s and distinct Xendit `Idempotency-key`s (`session:<id>:1` vs `session:<id>:2`) — by design, the attempt transaction guarantees distinct references (the code's own comment: concurrent calls "can never mint the same reference_id"), and the Xendit-side `Idempotency-key` only dedupes retries of the SAME attempt. If the dashboard shows two sessions for `ORDER_F` after a race, that is **expected, not a failure** — and it is money-safe: only one can be paid, the webhook amount/currency check still gates PAID, and the state machine is one-way.

---

### G. Kill switch — `QR_PAYMENTS_ENABLED=false` → `failed-precondition`

**G1.** With the deployed param `QR_PAYMENTS_ENABLED=false` (`defineBoolean`, default **false** — this is the dark-launch default; flip it with the §8 R1 procedure), call `createXenditSession` for any payable order (tap Pay, or invoke the callable directly).

*Expected callable error:* code `functions/failed-precondition`, message `Online payments are currently unavailable.` The check runs **before** the order read, the rate limiter, and any Xendit call.
*Expected Firestore:* **zero writes** — no `paymentAttempt` bump, no session fields, not even a `qr_rate_limits/session:*` tick.
*Expected UI:* CheckoutView maps it via `isPaymentsDisabledError` → the "pay at the counter" copy (`toUserFacingSessionError`: "Online payment isn't available right now. Please pay at the counter or ask our staff for help."), with no retry loop.
*Note:* the client flag `VITE_QR_PAYMENTS_ENABLED` is a UX gate only; this server param is the security control being validated here. To restore for the remaining cases, flip the flag back **both ways it is set** — gcloud env var AND `functions/.env.tng-systems` — per the §8 R1 durability rule, and re-verify functionally (Pay succeeds again) before continuing.

---

### H. Open `/order-status/{id}?return=xendit` for an UNPAID order → confirming + timeout, never PAID from a redirect

**H1.** Take any order whose `paymentStatus` is `'UNPAID'` or `'AWAITING_PAYMENT'` (e.g. one where the diner abandoned the Xendit page) and manually open:
`https://tng-systems.web.app/order-status/<ORDER_ID>?return=xendit`

*Expected UI timeline:* amber **Confirming payment** chip + "Confirming payment… This can take a few seconds for e-wallets & QRPH." banner; `getQrOrder` polled every **2,500 ms** for up to **45,000 ms** (`POLL_INTERVAL_MS` / `POLL_WINDOW_MS`). After the window elapses with no settle: the banner is replaced by "Payment may still be processing. Please ask staff if this takes too long." with a **Check again** manual-refresh button. The payment chip reads **Not paid yet** (UNPAID) or **Awaiting payment** — never Paid.
*Expected Firestore:* `qr_orders/{ORDER_ID}` **unchanged** throughout — the redirect/marker is a poll hint only; the webhook remains the sole writer of `PAID`. Only `qr_rate_limits/order-read:{ORDER_ID}` ticks (≈24 reads/min, under the 30/60 s budget).
**H2 (positive control).** While H1's poll is running, inject a valid `payment.succeeded` (as in A5, correct amount/currency, attempt-correct reference) → within one 2.5 s tick the chip flips to **Paid** and polling stops — proving the poll surfaces webhook truth rather than asserting it.

---

### Pass criteria summary (single glance)

| Case | HTTP / callable result | `qr_orders` after | `xendit_events.result` | `released` |
|---|---|---|---|---|
| A5 happy path | 200 `applied` | `PAID`/`PAID`, paidAt, xenditPaymentId, channel, method | `applied` | `true`, `releaseSource: XENDIT_WEBHOOK` |
| B replay | 200 `duplicate` | unchanged | one doc, still `applied` | unchanged |
| C bad token | **401** `unauthorized` | unchanged | **no doc** | unchanged |
| D mismatch | 200 `rejected` | unchanged (still awaiting) | `rejected` | absent |
| E failed | 200 `applied` | `paymentStatus: FAILED` only | `applied` | absent; retry → ref `:2` |
| F reuse (sequential) | same link, ref `:1` | byte-identical, attempt 1 | n/a | n/a |
| G kill switch | `failed-precondition` | zero writes | none | n/a |
| H redirect-only | UI timeout | unchanged | none | absent |

**Observability during the run** (checklist §9): watch `npx firebase functions:log` for structured `xenditWebhook.processed` lines (`event`, `orderId`, `payment_id`, `result` ∈ applied/duplicate/rejected/ignored). Confirm **no** secret/token is logged.

---

## 8. Rollback (ordered by blast radius — execute top-down, stop when contained)

> **Scope guard:** everything below assumes **Xendit TEST mode** (`xnd_development_…` key) on project `tng-systems`, named Firestore DB `tng-systems`, staging hosting `tng-systems-staging`, functions in `us-central1`. **No live funds move at any point.** All rollback levers are additive-safe: the webhook is idempotent, the order state machine is one-way, and no step below deletes production data. (Cross-reference: checklist §10 — same ordering, operational commands here.)

### R1. Instant kill switch — `QR_PAYMENTS_ENABLED=false` (no code redeploy) — TWO mandatory steps

`createXenditSession` reads `QR_PAYMENTS_ENABLED` (a `defineBoolean` param, **default `false`** — `functions/src/qr/createXenditSession.ts:34`) at invocation time from the service's environment.

**Step 1 — flip the live service** with a config-only Cloud Run revision (no build, no `firebase deploy`, live in seconds):

```powershell
gcloud run services update createxenditsession --project tng-systems --region us-central1 --update-env-vars QR_PAYMENTS_ENABLED=false
```

**Step 2 — MANDATORY companion: immediately edit `functions/.env.tng-systems`** so the on-disk param source matches the intended state — set `QR_PAYMENTS_ENABLED=false` (or delete the line; the code default is `false`).

> **Why step 2 is not optional:** `firebase deploy --only functions…` re-applies the param values from `functions/.env.tng-systems` on every functions deploy and replaces the Cloud Run revision — **silently overwriting any gcloud-set env var, in either direction**. With `true` still in the file, ANY later deploy — including §8 R5's own rotation redeploy — re-enables payments with no warning after you have "restored" the kill switch. The `.env` file, not the Cloud Run revision, is the flag's steady-state source of truth.

**Verification — the authoritative check is FUNCTIONAL, not the describe command:** tap **Pay with Xendit** on any unpaid test order → the callable must refuse with `failed-precondition` and the client must fall back to the safe pre-payment flow. **No new sessions can be created from this moment.** (The `gcloud run services describe … --format="value(spec.template.spec.containers[0].env)"` command shows the **template of the latest revision**, which is not necessarily the serving revision — see the R2 pinning caveat below — so it can show `false` while a pinned revision keeps serving `true`.)

> **Traffic-pinning caveat:** if R2's `update-traffic --to-revisions <PREV>=100` was ever run on this service, a config-only update creates a NEW revision that receives **0% traffic** — the flip silently does not take effect. After any pin, run `gcloud run services update-traffic createxenditsession --project tng-systems --region us-central1 --to-latest` (or re-pin to the new revision) for the kill switch to serve.

Notes:
- Flipping the flag does **not** cancel Xendit payment links already issued (test sessions live ~30 min). That is exactly why R2 keeps `xenditWebhook` up — in-flight payers are still honored.
- Optional slower lever: the client flag `VITE_QR_PAYMENTS_ENABLED` is **baked at build time**; turning it off requires a rebuild + hosting deploy following the full §2.4 procedure (including the `.env.staging.local` override — the stock script alone produces a `(default)`-DB build, see §2.4). Do this only if you also want the checkout button gone from the UI; R1 alone already makes payment impossible.

### R2. Function revision rollback — KEEP `xenditWebhook` deployed

If a QR function itself misbehaves, roll back **only the affected service** to its previous Cloud Run revision:

```powershell
gcloud run revisions list --service createxenditsession --project tng-systems --region us-central1
gcloud run services update-traffic createxenditsession --project tng-systems --region us-central1 --to-revisions <PREVIOUS_GOOD_REVISION>=100
```

(Same pattern for `createqrorder`, `getpublicmenu`, `getqrorder` if needed — v2 **Cloud Run service names** are the lowercased function names; the Cloud Functions resource keeps the camelCase id, see §5.)

> **After any traffic pin, subsequent config changes do NOT serve.** Pinning routes 100% of traffic to a named revision; from then on, any `gcloud run services update` (including the R1 kill-switch flip) only creates a new, non-serving revision. When the incident is over — or before relying on R1 — restore `--to-latest`:
>
> ```powershell
> gcloud run services update-traffic createxenditsession --project tng-systems --region us-central1 --to-latest
> ```

**Do NOT roll back or delete `xenditwebhook`.** A customer who already paid in the sandbox window must still get their order flipped to PAID and released. This is safe to leave running because the handler (`functions/src/qr/xenditWebhook.handler.ts`) does a constant-time `x-callback-token` compare (401 on mismatch, nothing processed), dedupes via the `xendit_events/{payment_id}:{event}` ledger, re-validates `amount`/`currency` against the order, and only ever moves `AWAITING_PAYMENT → PAID` one way, releasing exactly once.

### R3. Data — no destructive migration exists; nothing to reverse

All schema changes are **additive**. Rolling back code leaves historical orders fully readable. The only new artifacts are:

- New fields on `qr_orders` docs (the complete additive surface, matching the code's writes in `createXenditSession.handler.ts`, `xenditWebhook.handler.ts`, and `releaseLogic.ts` `buildReleasePatch`): `paymentAttempt`, `paymentReference`, `paymentLinkUrl`, `xenditPaymentSessionId`, `xenditPaymentRequestId`, `sessionExpiresAtMillis`, `xenditPaymentId`, `xenditChannelCode`, `paymentMethodType`, `paidAt`, `released`, `releasedAt`, `releaseSource`, `releaseEventId` (and `releasedBy` when a staff release is used) — older code simply ignores them.
- New server-only collections: `xendit_events` (ledger), plus `qr_rate_limits` / `qr_order_idempotency` entries. All are `read,write: if false` in `firestore.rules` (Admin-SDK only).

**Action for this step: none.** It is a verification note — confirm no one attempts a "cleanup migration" on `qr_orders`; there is nothing to migrate.

### R4. Sandbox test-data cleanup — scoped strictly to the test business unit

Staging shares the prod `tng-systems` DB, so cleanup is **by `businessUnitId` only** — never collection-wide. Save the script below as `C:/Users/agrob/TNG-Purchasing/tng-purchasing-30/functions/cleanup-qr-sandbox.mjs` (run from `functions/` so its `firebase-admin` resolves). It is **dry-run by default**; it deletes only docs whose `businessUnitId` equals your test BU (plus the per-table keyed docs derived from your test tables).

```js
// cleanup-qr-sandbox.mjs — SANDBOX cleanup, scoped to ONE test business unit.
// From functions/:  node cleanup-qr-sandbox.mjs        (dry run — counts only)
//                   APPLY=1 node cleanup-qr-sandbox.mjs (bash)  |  $env:APPLY='1'; node cleanup-qr-sandbox.mjs (PowerShell)
// Auth: gcloud auth application-default login  (Admin SDK; rules do not apply)
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const TEST_BU = 'qr-sandbox-bu';                 // <-- EDIT: your test BU id (checklist §7)
const APPLY = process.env.APPLY === '1';

const app = initializeApp({ credential: applicationDefault(), projectId: 'tng-systems' });
const db = getFirestore(app, 'tng-systems');     // NAMED database — not (default)

const del = async (label, snap) => {
    console.log(`${label}: ${snap.size} doc(s)${APPLY ? ' — DELETING' : ' (dry run)'}`);
    if (APPLY) for (const d of snap.docs) await d.ref.delete();
};

// 1. Capture test tables first — their ids key the rate-limit + idempotency docs.
const tables = await db.collection('qr_tables').where('businessUnitId', '==', TEST_BU).get();
const tableIds = tables.docs.map(d => d.id);

// 2. BU-scoped collections (xendit_events ledger docs carry businessUnitId).
for (const coll of ['qr_orders', 'menu_items', 'xendit_events'])
    await del(coll, await db.collection(coll).where('businessUnitId', '==', TEST_BU).get());

// 3. Per-table keyed docs:
//    qr_rate_limits ids   = `menu:{tableId}` | `order:{tableId}` | `session:{tableId}`
//    qr_order_idempotency ids = `{tableId}:{clientKey}` (clientKey is 8–64 chars of [A-Za-z0-9_-])
for (const t of tableIds) {
    for (const s of ['menu', 'order', 'session']) {
        const ref = db.collection('qr_rate_limits').doc(`${s}:${t}`);
        if ((await ref.get()).exists) { console.log(`qr_rate_limits/${s}:${t}${APPLY ? ' — DELETING' : ' (dry run)'}`); if (APPLY) await ref.delete(); }
    }
    // Prefix range on the doc id: ';' is the code point immediately after ':'.
    // The key charset [A-Za-z0-9_-] excludes ':' entirely, so [`${t}:`, `${t};`) is an
    // exact prefix scan over every `{t}:{clientKey}` doc.
    await del(`qr_order_idempotency ${t}:*`, await db.collection('qr_order_idempotency')
        .where(FieldPath.documentId(), '>=', `${t}:`).where(FieldPath.documentId(), '<', `${t};`).get());
}

// 4. The test tables themselves, last (so re-runs of steps 2–3 still work).
await del('qr_tables', tables);

console.log('NOTE: counters/qr (shared order-number counter) intentionally NOT touched — additive, prod-safe.');
```

Run order: **dry run → eyeball counts → `APPLY=1` run → dry run again (all zeros)** — with one sanity gate: **the FIRST dry run must show non-zero counts for collections you know have data** (≥ your number of test orders in `qr_orders`, and ≥ 1 `qr_order_idempotency` doc per submitted order that sent an idempotency key). A first dry run that prints zeros where you created data means a query is broken and the final "all zeros" check would be vacuous — stop and investigate before applying.

Manual notes:
- **`counters/qr` is shared** with any future real orders — never delete or reset it; test increments are harmless.
- Deliberate **case-D3 probes** (unknown reference) write `xendit_events` docs with `businessUnitId: null` and `orderId` = the parsed (nonexistent) id — **not** `orderId == null` — so the BU query won't catch them. Review and hand-delete: in the console (DB `tng-systems`), filter `xendit_events` where **`businessUnitId == null`** within the run window (this catches both unknown-order and missing-reference rejected events). Cross-check by the known probe payment_ids you fixed in §7 (e.g. doc `pay_sbx_D:payment.succeeded`). D2 amount-mismatch docs need no manual pass — the order exists, so they carry the test BU and the BU-scoped query catches them. (Case C bad-token probes leave **no** ledger doc — the 401 happens before processing.)
- `qr_rate_limits` docs keyed `order-read:{orderId}` (from the §7 A6/H status polls) are keyed by **order id**, not table id — the per-table loop above misses them. Hand-delete any `order-read:*` docs for your recorded test order ids.
- **Late Xendit retries can re-orphan a "clean" DB:** the webhook stays deployed and registered (per R2), so a test-mode retry arriving after cleanup finds no ledger doc and no order and re-creates a `rejected` ledger doc with `businessUnitId: null` — invisible to both the BU-scoped script and a just-passed zero-count dry run. Wrap-up step: once the run is **fully** complete (and only then), remove or disable the TEST-mode webhook URL registration in the Xendit dashboard before/along with R4 — or re-run the R4 dry run **plus** the `businessUnitId == null` console check after Xendit's retry horizon has passed.

### R5. Secret rotation (only if a key/token was exposed, or as post-run hygiene)

Test keys move no money, but rotate anyway if either secret leaked — pasted in chat, screenshot, wrong terminal, **or passed as a process command-line argument / captured in a shell transcript** (argv exposure counts as a rotation trigger for the callback token; this is why §7's helper uses a curl config file).

Ordered to keep the webhook-401 window to seconds and to honor in-flight payers (the R2 rule):

```powershell
# 0. BEFORE anything else: if the run is over, set QR_PAYMENTS_ENABLED=false in
#    functions/.env.tng-systems NOW — step 3's redeploy re-applies whatever value
#    is in that file and will silently re-arm payments if it still says true.
#    Also confirm no payable orders still have live sessions (sessionExpiresAtMillis
#    in the future — test sessions live ~30 min) and no pending Xendit retries.

# 1. In the Xendit dashboard (TEST mode): generate a NEW test API key.
#    (Do NOT touch the webhook verification token yet.)

# 2. Update Secret Manager (prompts for the values; run from the repo root).
#    When the dashboard forces regeneration of the verification token to reveal a new
#    value, copy it here immediately and run steps 2–3 back-to-back — every delivery
#    between the dashboard-side token change and the redeploy gets 401 (Xendit retries).
cd C:\Users\agrob\TNG-Purchasing\tng-purchasing-30
npx firebase functions:secrets:set XENDIT_SECRET_KEY --project tng-systems
npx firebase functions:secrets:set XENDIT_CALLBACK_TOKEN --project tng-systems

# 3. Secrets bind at deploy — the new versions are NOT live until you redeploy the two consumers.
#    WARNING: this deploy re-applies ALL param values from functions/.env.tng-systems,
#    including QR_PAYMENTS_ENABLED, overwriting any gcloud-set kill-switch flip (see R1).
npx firebase deploy --only functions:createXenditSession,functions:xenditWebhook --project tng-systems

# 4. Verify the flag state FUNCTIONALLY after the redeploy (Pay → failed-precondition
#    if the run is over), then confirm the dashboard webhook token matches the secret
#    exactly (single dashboard-side token step — do not change it again afterwards).

# 5. Revoke the old Xendit test key in the dashboard, then prune superseded secret versions:
npx firebase functions:secrets:prune --project tng-systems
```

Defense-in-depth even if the callback token leaks: a forged webhook still cannot fabricate a PAID order without also matching the exact `amount`/`currency` of a real order sitting in `AWAITING_PAYMENT` — and it can never un-pay one.

---

## 9. Go/No-Go gate

Run this gate **twice**: 9.1 + 9.2 immediately before starting E2E case A; 9.3 before declaring the run complete. **Any unchecked 9.1 box = No-Go. Any un-initialed 9.2 box = No-Go.** (Cross-reference: checklist §11 — same gate, exact verification commands here.)

### 9.1 Hard blockers (all must be TRUE)

| # | Check | How to verify |
|---|---|---|
| 1 | Blaze billing + Secret Manager enabled on `tng-systems` | Firebase console → Usage & billing |
| 2 | Rules + indexes deployed to **both** DBs; indexes finished building | `npx firebase deploy --only firestore --project tng-systems` output lists **both** databases; then **independently** verify: console → Firestore → Rules tab shows this deploy's publish timestamp on **each** database, and Indexes = READY. **Never verify with `--only firestore:rules,firestore:indexes` — those filters are silent no-ops with this repo's firebase.json (see §2.2) and "success" proves nothing** |
| 3 | **All eight QR functions** (`getPublicMenu`, `createQrOrder`, `createQrTable`, `listQrTables`, `getQrTableToken`, `getQrOrder`, `createXenditSession`, `xenditWebhook`) deployed **from this branch's working tree** — not just the webhook — and the `xenditWebhook` URL captured | `npx firebase functions:list --project tng-systems` shows all eight with an update time **after** the §2.1 full deploy of the branch; URL from deploy output / §5 |
| 4 | `XENDIT_SECRET_KEY` is a **TEST** key | `(npx firebase functions:secrets:access XENDIT_SECRET_KEY --project tng-systems).Substring(0,15)` → must print `xnd_development` — check the prefix ONLY, never echo the full key |
| 5 | `XENDIT_CALLBACK_TOKEN` set as secret AND the identical value registered in the Xendit dashboard | `npx firebase functions:secrets:get XENDIT_CALLBACK_TOKEN --project tng-systems` (version metadata) vs. dashboard webhook settings — compare set-dates, never echo the value |
| 6 | Webhook registered in Xendit (TEST mode) for success + failed + expired events at the captured URL | Xendit dashboard → Callbacks |
| 7 | `QR_PAYMENTS_ENABLED=true` on the service AND `VITE_QR_PAYMENTS_ENABLED=true` in the deployed client build | functional check preferred (Pay reaches Xendit checkout); `gcloud run services describe createxenditsession … --format="value(spec.template.spec.containers[0].env)"` shows the latest **template** only (see R1/R2 pinning caveat) |
| 8 | `QR_PUBLIC_BASE_URL` = staging URL; **deployed** client uses the named DB; `VITE_FUNCTIONS_EMULATOR_HOST` unset | Verify against the **deployed artifact, not the build log**: open `https://tng-systems-staging.web.app` → DevTools console shows `🔥 Firestore Database: tng-systems` (per the mandatory §2.4 procedure — the stock staging script alone always produces a `(default)`-DB build) |
| 9 | Test BU + ≥1 active `qr_tables` doc + ≥2 active `menu_items` docs, all same `businessUnitId` | scan the QR → menu loads with correct prices |
| 10 | Local suite green before the deploy that is now live (functions 117 node + 9 emulator tests, `tsc -b`, `vite build`) | run records / CI output from the deploy prep |

### 9.2 Consciously-accepted risks (each needs a name + initials — accepting is a decision, not a default)

| Risk | What you are accepting | Accepted by |
|---|---|---|
| **App Check NOT enforced** on customer callables (`getPublicMenu`, `createQrOrder`, `getQrOrder`, `createXenditSession`) | Only defense is per-table rate limits — actual budgets (`functions/src/qr/rateLimit.ts`): **`MENU_READ_LIMIT` 30/60 s, `ORDER_CREATE_LIMIT` 10/60 s, `SESSION_CREATE_LIMIT` 5/60 s, per table**. Acceptable for a sandbox window on staging; H2 (enforcement) remains a hard prerequisite before any public/live traffic. | ______ |
| **Staging shares the prod `tng-systems` project AND named Firestore DB** | Sandbox orders are real documents in the production database. Isolation is purely the test-BU convention + R4 cleanup. | ______ |
| **Feature is UNCOMMITTED on `feat/qr-customer-menu`** (working tree is dirty beyond HEAD `ace1261`) | The deployed artifact is not reproducible from any commit. Mitigation before deploy: either commit on the branch, or archive the exact state — `git rev-parse --short HEAD` + `git diff > qr-sandbox-run-$(date +%F).patch` — and record both in the Slack report. | ______ |
| **No `XENDIT_MODE` switch exists in code** | The test/live boundary is solely which key sits in `XENDIT_SECRET_KEY` (9.1 #4 is the only guard). | ______ |

### 9.3 Post-run verification (all must be TRUE before reporting GO)

- [ ] E2E cases **A–H** all pass (case A repeated per activated channel).
- [ ] `npx firebase functions:log` shows `xenditWebhook.processed` lines with a sane `result` distribution — every `rejected` traceable to a deliberate case-D probe; **zero** unexplained rejects; **no** secret/token in any log line.
- [ ] **Zero** orders left `AWAITING_PAYMENT` that have a SUCCEEDED Xendit test payment (reconcile dashboard vs. `qr_orders`).
- [ ] Kill switch exercised and restored **durably**: `QR_PAYMENTS_ENABLED` returned to **`false`** in BOTH places — the R1 gcloud flip AND `functions/.env.tng-systems` — unless proceeding directly to a canary; record which. **Warning:** any `firebase deploy --only functions…` (including R5's rotation redeploy) re-applies the `.env` file's value and overwrites the gcloud-set env var — the gcloud flip alone is not durable. Re-verify with the functional test (Pay → `failed-precondition`) **after any subsequent redeploy**.
- [ ] R4 cleanup executed (non-zero first dry run → apply → zero-count dry run, plus the `businessUnitId == null` manual check), or data intentionally retained as evidence — record which. If the TEST-mode webhook registration is left active, schedule the late-retry re-check (R4 manual notes).

---

## 10. Slack report template (paste into the team channel; Slack mrkdwn-ready)

```
:test_tube: *QR × Xendit — SANDBOX validation report* _(Xendit TEST mode — no live funds moved)_

*Run date:* `____-__-__`   *Tester:* @________
*Env:* project `tng-systems` · hosting `tng-systems-staging` · Firestore DB `tng-systems` (named) · functions `us-central1`
*Xendit:* TEST mode, key prefix verified `xnd_development` :white_check_mark:
*Git:* branch `feat/qr-customer-menu` @ commit `________` · tree at deploy: [ ] committed  [ ] dirty → diff archived at `____________`
*Channels tested:* [ ] GCash  [ ] Maya  [ ] QRPH  [ ] Card (3DS)

*E2E results (checklist §9):*
• *A* Happy path → PAID → released — GCash `PASS/FAIL` · Maya `PASS/FAIL` · QRPH `PASS/FAIL` · Card `PASS/FAIL`
• *B* Webhook replay / idempotency (no double release) — `PASS/FAIL`
• *C* Bad callback token → 401, no ledger doc — `PASS/FAIL`
• *D* Amount/currency mismatch → `rejected`, order NOT paid — `PASS/FAIL`
• *E* Failure / expiry → `FAILED`/`EXPIRED`, retry possible — `PASS/FAIL`
• *F* Session reuse (sequential re-tap ⇒ same session; concurrent race ⇒ two refs is expected) — `PASS/FAIL`
• *G* Kill switch (`QR_PAYMENTS_ENABLED=false` ⇒ `failed-precondition`) — `PASS/FAIL`
• *H* Never-paid-from-redirect (webhook is sole truth) — `PASS/FAIL`

*`xendit_events` result distribution:*  applied `__` · duplicate `__` · rejected `__` · ignored `__`
_(expected: rejects only from the deliberate case-D probes; case C leaves NO ledger doc; no secrets in logs: [ ] confirmed)_

*Issues found:*
1. ________
2. ________

*Go / No-Go:*  [ ] :large_green_circle: *GO* — proceed to `____________`   [ ] :red_circle: *NO-GO* — blockers: `____________`
*Accepted risks re-confirmed (initials):* App Check OFF `__` · shared prod DB `__` · uncommitted branch `__` · key-prefix-only test/live boundary `__`
*Post-run state:* `QR_PAYMENTS_ENABLED` = [ ] false (restored in gcloud AND functions/.env.tng-systems)  [ ] true (reason: ______) · test data: [ ] cleaned (R4, zero-count + null-BU check verified)  [ ] retained as evidence
*Next step + owner:* ________ (@________)
```

**Reporting rules:** one message per run — do not edit a posted report; post a corrected follow-up in-thread. A **NO-GO** report must name the failing 9.1 item or E2E case, the owner, and the retest date. A **GO** here means "sandbox validated" only — production go-live still requires App Check enforcement (H2), a committed/tagged build, and a fresh gate; it is never implied by this report.

---

*This runbook performs no deploys itself; every command above is executed deliberately by the operator, in TEST mode, against project `tng-systems`. Re-verify the `xenditWebhook` URL and secret bindings against the actual deploy output before the run.*

*This document is planning/preparation only — no deploy was performed in producing it.*