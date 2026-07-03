# QR Ordering — App Check / Abuse Protection Plan

> **Document type:** Planning only (per Task 4's outcome, explained in §4). No product code was changed to produce this document.
> **Goal:** protect the two anonymous public QR callables (`getPublicMenu`, `createQrOrder`) before Sprint 2's Xendit/payment work lands — this closes remediation finding **H2** from [`QR_SPRINT1_REVIEW.md`](QR_SPRINT1_REVIEW.md) / [`QR_SPRINT1_REMEDIATION_PLAN.md`](QR_SPRINT1_REMEDIATION_PLAN.md).
> **Hard constraints honored:** no deployment, no Xendit code touched, no production Firebase touched, no live credentials used.
> **Date:** 2026-07-03

---

## Implementation status (updated 2026-07-03)

| Layer | Status |
|---|---|
| **Rate limiting (§2.5 / §2.6)** | ✅ **IMPLEMENTED** — `functions/src/qr/rateLimit.ts`, wired into `getPublicMenu` and `createQrOrder`. Fixed-window per-table counters in `qr_rate_limits`; separate budgets: menu reads **30/60s**, order creation **10/60s**. Generic `resource-exhausted` message (`RATE_LIMIT_MESSAGE`, no threshold revealed). Structured `logger.warn('qr.rateLimit.blocked', …)` on block. Explicit server-only `qr_rate_limits` Firestore rule added. **44 functions tests pass (10 new), 7 emulator rules tests pass, builds green.** |
| **App Check enforcement (§2.1–2.4, §3.1)** | ⛔ **NOT implemented** — still blocked on Firebase Console provisioning of a reCAPTCHA site key (production access, out of scope). Client scaffold in `firebase.ts` remains ready but inert. `enforceAppCheck` intentionally NOT enabled (per this task's rules). |
| **Failure UX (§2.8)** | ⬜ Deferred to Sprint 2 (lands with real client `httpsCallable` wiring). The server side already returns generic messages. |

> Rate limiting is the layer that protects the ordering surface **today**, independent of App Check. App Check remains the recommended second layer and a go-live requirement, but is Console-gated.

---

## 1. Research — current repo support (evidence-based)

### 1.1 Firebase client config / app initialization
`src/config/firebase.ts` calls `initializeApp(firebaseConfig)` once, then conditionally sets up **App Check**:

```
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
}
```
**Finding: App Check client scaffolding already exists** — a real prior effort ("FIX C4" comment) wired reCAPTCHA **v3** (not Enterprise) behind a safe, no-crash conditional. It only activates if `VITE_RECAPTCHA_SITE_KEY` is set.

### 1.2 Existing environment variables
Checked `.env` (the real, active dev config), `.env.template`, `.env.example`, `.env.development`, `.env.test`:
- **`VITE_RECAPTCHA_SITE_KEY` is NOT set anywhere real.** It exists only as a blank placeholder line in `.env.template` ("Optional: reCAPTCHA for App Check").
- **Conclusion: the client-side App Check init is currently a no-op in this project.** The site key was never actually provisioned — the scaffold was built but never finished.

### 1.3 Functions callable setup + version support
All 6 exported functions (`postTransaction`, `setBudgetLimit`, `getPublicMenu`, `createQrOrder`, `createQrTable`, `listQrTables`) use `firebase-functions/v2/https` `onCall(handler)` with **no options object** — meaning no `enforceAppCheck` anywhere.
- `functions/package.json` declares `firebase-functions: ^5.0.0`; the installed version is **5.1.1**.
- `enforceAppCheck: true` (and the related `consumeAppCheckToken` replay-protection option) on `onCall` has been supported since firebase-functions **v4.3+** — this repo's version fully supports it. **The capability exists; it's simply never turned on.**

### 1.4 Existing auth / App Check setup
- **No `enforceAppCheck` usage anywhere** in `functions/src`.
- **No App Check debug-token handling** for local/emulator development anywhere in the codebase.
- **No rate-limiting code** anywhere (client or functions) — confirmed by repo-wide search.
- Firebase Auth (email/Google) + Firestore-role RBAC is the *only* access control today, and it covers staff-only callables (`createQrTable`, `listQrTables`) via the Sprint 1 remediation. The two anonymous callables (`getPublicMenu`, `createQrOrder`) have **zero** protection beyond basic input validation.

### 1.5 Related context
- `cors.json` restricts browser origins for Storage/Hosting (`localhost:5173/5174`, `tng-systems.web.app/firebaseapp.com`) — unrelated to App Check but confirms the web-only target.
- `capacitor.config.ts` is configured but **no native iOS/Android projects are initialized** — confirms Master Plan assumption P4 (mobile web only for MVP). This matters for provider choice: web attestation (reCAPTCHA) is the right family; native attestation (Play Integrity / DeviceCheck) does not apply yet.
- The QR customer UI (`CustomerMenuView.tsx` etc.) is **still 100% mock** — confirmed no real `httpsCallable()` wiring exists anywhere in `src/features/qr-ordering`. The only reference to `getPublicMenu` in that folder is a code comment ("Simulate the future getPublicMenu() callable..."). This means enabling `enforceAppCheck` today would affect **zero live client traffic** — there is no real caller yet to break, but also no real integration point to verify against end-to-end.

**Net assessment:** the repo has a **safe but incomplete/inactive** App Check foundation. The missing piece — a provisioned reCAPTCHA site key + Firebase Console App Check registration — requires production Firebase Console access, which this task explicitly forbids. This directly shapes §4's decision.

---

## 2. Recommended protection strategy

### 2.1 Firebase App Check for customer web routes
Only the **anonymous, customer-facing** surface needs App Check: the future `/order/:tableId`, `/checkout/:sessionId` routes and their two backing callables, `getPublicMenu` and `createQrOrder`. Staff routes (kitchen/bar/cashier, admin table management) are already behind Firebase Auth + RBAC (Sprint 1 remediation) — App Check adds only marginal value there and is lower priority.
Once `initializeAppCheck` has run in the same app instance, the Firebase Functions client SDK **automatically attaches** the App Check token to every `httpsCallable` request — no per-call-site code is needed.

### 2.2 reCAPTCHA Enterprise or reCAPTCHA v3
**Recommendation: keep reCAPTCHA v3** (already scaffolded, zero cost). It's score-based and invisible to the user — sufficient for a single-location MVP pilot (Master Plan O7). reCAPTCHA **Enterprise** is a paid GCP product with richer risk analytics and its own project wiring; note it as a **documented future upgrade**, not a Sprint 2 dependency. Do not let an Enterprise-vs-v3 debate delay payment work.

### 2.3 Callable enforcement strategy
Turn on `enforceAppCheck: true` on exactly **two** functions: `getPublicMenu`, `createQrOrder`. **Do not** enable it on `createQrTable`/`listQrTables` (already RBAC-gated, Sprint 1) or the pre-existing `postTransaction`/`setBudgetLimit` (out of QR scope). `enforceAppCheck: true` alone rejects any call lacking a valid, unexpired token with `unauthenticated` — no handler-body code needed.
**Do not enable `consumeAppCheckToken`** (one-time-use/replay-protection tokens) yet — it adds client complexity (tokens must be minted per call) that isn't justified by this threat model (bot/scraping, not sophisticated token replay) at MVP scale.

### 2.4 Local/dev emulator behavior
App Check normally can't complete a real reCAPTCHA challenge from `localhost`. The supported pattern: a **debug provider** — set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` (or a fixed value) before `initializeAppCheck` runs, gated on `import.meta.env.DEV` only. The SDK then logs a debug token to the console; a developer registers it **once** in the Firebase Console's App Check debug-token allowlist (not a secret, not production data, one-time per machine). The Functions/Firestore emulator does **not** enforce App Check by default — recommend testing the `enforceAppCheck: true` *option is set* via a unit assertion rather than attempting a live emulator App Check challenge, which is disproportionate effort at this stage (see §3.5).

### 2.5 Rate limiting fallback
This is the layer that provides real protection **today**, independent of whether/when App Check gets fully provisioned (see §4). Design (planned, not implemented — see §3.3):
- A small Firestore-based sliding-window counter, e.g. `qr_rate_limits/{tableId}`, holding a rolling count + window-start.
- `createQrOrder` checks/increments it **inside its existing `runTransaction`** (cheap — it already reads/writes there) and rejects with `resource-exhausted` past a small per-minute threshold.
- `getPublicMenu` gets a lighter, read-only pre-check (higher ceiling — it's cheaper to over-tolerate reads than writes).
- Reuses the exact "read-check-write inside one transaction" discipline already established for the counter/stock logic in Sprint 1.

### 2.6 Per-table/order abuse limits
Same mechanism as §2.5, tuned per surface:
- `createQrOrder`: caps order-creation attempts **per table** per short window — catches "flood junk orders," which inflates `counters/qr` and creates operational noise.
- `getPublicMenu`: caps menu-fetch attempts **per resolved token** per short window — catches read-cost hammering.
Both share one small helper module so the limiting logic isn't duplicated across the two handlers.

### 2.7 Logging / observability
Today: bare `console.error` only (Sprint 1 review finding L6). Recommend structured log lines via `firebase-functions/logger` (already available, no new dependency) capturing `{ table, outcome, latency, appCheckPresent }` on both callables — so "rejected: no App Check token" vs. "rejected: rate limit" vs. "rejected: business rule" are distinguishable in Cloud Logging without a full observability platform.

### 2.8 Failure UX for customers
Once real client wiring lands (Sprint 2), **every** callable failure (App Check rejection, rate limit, or business error) should surface one friendly, generic message — never a raw Firebase error string:
- `getPublicMenu` failure → "Something went wrong loading the menu — please rescan the table QR code."
- `createQrOrder` failure → "We couldn't place your order — please try again in a moment," with a retry action.
Rate-limit rejections specifically must **not** reveal "you're rate limited" — that teaches an attacker the exact threshold. Use the same generic retry copy for every failure class.

---

## 3. Implementation plan

### 3.1 Required Firebase Console setup *(blocked — requires production access)*
1. Enable App Check for the `tng-systems` project (App Check console page).
2. Register the web app with reCAPTCHA v3 (Console auto-provisions a site key, or register manually in the Google reCAPTCHA admin console).
3. Add each developer's debug token to the App Check debug-token allowlist (one-time, low-risk, still requires Console access).
4. Set enforcement mode to **Monitor** first (metrics only, no rejection) before ever switching to **Enforce** — this is the safe-rollout switch and is itself a Console toggle.
**None of these can be performed in this session** — they require live Firebase Console/production credentials, which this task explicitly forbids.

### 3.2 Required env vars
- **`VITE_RECAPTCHA_SITE_KEY`** (client, already read by `firebase.ts`) — populate once §3.1 is done. **No code change needed** once the value exists; the conditional init already handles it correctly.
- **No new functions/server env var is needed.** `enforceAppCheck: true` verifies tokens against Google's servers automatically under the hood — no manual secret to configure.
- Optional, dev-only, not secret: a stable debug-token value could be pinned for consistency across dev machines, but this is polish, not a requirement.

### 3.3 Code changes required (client) — described, not implemented
- Add a **DEV-only** debug-token branch above the existing `initializeAppCheck` call in `firebase.ts`, gated on `import.meta.env.DEV`, so local development works without requiring a real site key at all. Exact pattern (dummy site key + debug flag vs. skip-if-absent-in-dev) is a small decision to make when this is actually implemented — not before, since it has zero value until real client callable wiring exists.
- **No per-call-site changes needed** for App Check itself once initialized — the SDK auto-attaches tokens.
- Bundle the friendly-failure-UX handling (§2.8) into the same PR that wires the real `httpsCallable` invocations (Sprint 2), since that's the first point failures become reachable.

### 3.4 Functions changes required — described, not implemented
- `getPublicMenu.ts` / `createQrOrder.ts`: change `onCall(handler)` → `onCall({ enforceAppCheck: true }, handler)`. One option object; zero handler-logic change.
- New module `functions/src/qr/rateLimit.ts`: a pure, injectable-`db` function following the exact pattern established in Sprint 1 (`orderLogic.ts` + the `*.handler.ts` split) — so it is unit-testable with the existing `FakeFirestore` harness, no emulator required. Called from inside `createQrOrder.handler.ts`'s existing transaction, and as a lightweight pre-check in `getPublicMenu.handler.ts`.
- Replace `console.error`/`console.log` in the two QR callables with `firebase-functions/logger` structured calls (§2.7).
- **No change needed** to `createQrTable`/`listQrTables` — already RBAC-gated (Sprint 1 remediation); App Check would be redundant there for now.

### 3.5 Tests required
- **Unit tests (no emulator)** for the rate-limit pure logic, using the same `FakeFirestore` harness from Sprint 1: Nth request within a window rejected; request after the window elapses allowed; per-table isolation (table A's volume doesn't affect table B's limit).
- **Handler integration tests**: extend `createQrOrder.handler.test.ts` / `getPublicMenu.handler.test.ts` to cover the new rate-limit rejection path, reusing the existing `expectReject` helper.
- **Emulator test for `enforceAppCheck`** — deferred. It cannot be meaningfully authored without a real or debug App Check token flow, which depends on §3.1's Console setup. Tracked as a follow-up test once that's done, not written now.
- **Manual/staging verification** (per the original remediation plan's H2 fix plan): once deployed to a real, access-restricted staging environment, confirm a request without a valid App Check token is actually rejected.

### 3.6 Rollout plan
1. Provision the reCAPTCHA v3 site key + register App Check in the Firebase Console (owner/DevOps; requires production access — out of this session's scope).
2. Set `VITE_RECAPTCHA_SITE_KEY` in the deployment environment (never committed to git).
3. Implement the rate-limit module + its tests — **can start immediately, no Console dependency.**
4. Flip `enforceAppCheck: true` on the two anonymous callables; deploy to staging first.
5. Run App Check in **Monitor mode** for a few days to observe real traffic/false-positive patterns before rejecting anything.
6. Switch to **Enforce mode** once monitor-mode data looks clean.
7. Ship the friendly failure-UX copy (§2.8) alongside the real client callable wiring in Sprint 2.

### 3.7 Risks
| Risk | Mitigation |
|---|---|
| reCAPTCHA v3's invisible score-based challenge can occasionally false-negative on poor connections/unusual browsers | Monitor-mode rollout (step 5) before enforcing |
| Rate-limit thresholds set too low could block a legitimate large table ordering multiple quick rounds | Start with a generous documented default; consider a tunable `config/qr_rate_limits` doc later rather than a hardcoded constant, so limits can be adjusted without a redeploy |
| App Check enforcement is all-or-nothing per callable — a misconfigured site key at enforcement time hard-blocks every real customer | Staging + Monitor-mode rollout is the direct mitigation; never flip straight to Enforce in production |
| This plan does not replace Xendit's own webhook idempotency/token security | App Check/rate-limiting stops bots and floods; it does not substitute for the payment-layer security already specified in Master Plan §7.4 — both are required, independently |

### 3.8 What blocks Xendit
**Nothing here technically blocks starting Xendit/payment work** — App Check and rate limiting are additive layers protecting the *ordering* surface, independent of the *payment* surface's own security design (webhook token verification, idempotency ledger — already specified in the Master Plan, unaffected by this plan).

However: Sprint 2's `createXenditSession` callable will call a **paid external API** per invocation, making it the single most expensive thing to leave unprotected — a flood of scripted calls there costs real money, not just junk Firestore documents. **Recommendation: land the rate-limiting layer (§2.5/§2.6, §3.3–3.4) before `createXenditSession` ships**, since it has zero Console dependency and can be built/tested right now. App Check itself (Console-dependent) should complete in parallel or shortly after, and must land before go-live — but it is not a hard blocker for *starting* Sprint 2's payment code.

---

## 4. Task 4 outcome — why no code was written this pass

Per the task's explicit instruction: *"If the repo already supports App Check safely, implement minimal non-production code. If it does not, do not implement half-working App Check. Document the plan only."*

**Verdict: the repo does not yet safely/completely support App Check**, for a reason specific to this session's constraints, not the code itself:
- The client scaffold (§1.1) is well-built and safe (no-crash, conditional) — but it is **inert** without a provisioned `VITE_RECAPTCHA_SITE_KEY`.
- Provisioning that key requires **Firebase Console registration** (§3.1) — which is **production Firebase access**, explicitly forbidden by this task's rules.
- Flipping `enforceAppCheck: true` on either callable **without** a working site key would either do nothing (if App Check simply isn't configured, the enforcement check may still require *some* valid App Check setup to not hard-fail everything) or — once a real client eventually calls these functions — silently break every request until someone completes the Console step. That is precisely the "half-working App Check" outcome the instructions say not to ship.

**Therefore, per instructions: this task delivers a plan only, no App Check code changes.** The one piece of *this* plan that has zero Console dependency and is safe to build immediately — the rate-limiting fallback (§2.5/§2.6) — is **fully designed above but intentionally not implemented in this pass either**, since Task 4's conditional gate was scoped specifically to App Check and the task's overall shape (Task 3's deliverable is a planning document) reads as plan-first for this whole exercise. It is the natural next coding task once this plan is reviewed.

---

*Documentation only. No client code, functions code, Firestore rules, indexes, or Cloud Functions were created or modified in producing this plan. Nothing was deployed; no live credentials or production Firebase Console access were used.*
