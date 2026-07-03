# QR Ordering — Sprint 1 Remediation Plan

> **Document type:** Planning only. **No code, configuration, rules, or Firebase resources are changed by this document.** It defines *what* will be fixed, in *what order*, and *how each fix will be verified* — implementation happens in a separate, explicit pass.
> **Source of truth:** [`QR_SPRINT1_REVIEW.md`](QR_SPRINT1_REVIEW.md) (16 findings: 1 Critical, 3 High, 6 Medium, 6 Low). This plan resolves the Critical, High, and Medium findings; Lows are triaged but not planned in detail (see §4).
> **Date:** 2026-07-03

---

## 1. Fix plan — Critical & High findings

### C1 — Deploying onto an open Gate A *(Critical — CLOSED 2026-07-03)*
Not a code fix — a release-process gate. ✅ **Both preconditions are now met, so Gate A is CLOSED:**
- **P0-1** (service-account keys) — ✅ CLOSED: Fred confirmed the old keys were rotated/revoked in Google Cloud; repo cleanup removed both tracked JSON files from tracking + working tree and extended `.gitignore` to a working glob (`*firebase-adminsdk*.json`, `*-adminsdk-*.json`). ⚠️ Git history not purged in that task — recommended separately if the repo was ever public during exposure.
- **P0-2** (production database) — ✅ CLOSED: confirmed as **`tng-systems`** (Fred), which the backend already targets via `getFirestore(getApp(), 'tng-systems')`. No code change required.
**Owner:** repo owner / DevOps, per `PRODUCTION_READINESS_REMEDIATION.md`. **Verification:** both items marked resolved in that backlog (2026-07-03). Remaining deploy preconditions now live under Gate B — Production Readiness.

### H1 — `createQrTable` has no RBAC *(High)*
**Fix:** replace the current `if (!request.auth)`-only check with a real permission check, following the same role/permission pattern the rest of the app already uses (the `firestore.rules` helper functions and the app's permission-matrix model) — ported to a callable-side check, since this is server code, not a rules file. Require a specific permission (e.g., `MENU_MANAGE_TABLES` or the nearest existing equivalent — confirm the exact key with Fred during implementation) and reject with `permission-denied` otherwise.
**Bundled in the same change (cheap, same function, avoids a second review pass):**
- Constrain the table's `businessUnitId` to one the caller is actually authorized for — never trust the raw input value as-is (closes the BU-scope half of M5).
- Validate the referenced `businessUnitId` corresponds to a real `businesses` document (closes the BU-existence half of M5).
- Reject creation if an active table with the same `tableNumber` already exists in that BU, unless the team explicitly decides duplicates are acceptable — if so, that decision should be a one-line comment recording *why*, not a silent gap (closes the duplicate-number half of M5).

### H2 — No abuse protection on anonymous callables *(High)*
**Fix, two parts:**
1. **Firebase App Check** on `getPublicMenu` and `createQrOrder` — requires choosing a web attestation provider (reCAPTCHA Enterprise is the standard pairing for a mobile-web target, consistent with Master Plan assumption P4: mobile web, not native). This is a setup/configuration task as much as a code task — record the provider choice explicitly when scheduled, since it affects client-side wiring the mock UI doesn't currently have.
2. **A lightweight rate limit** keyed on the resolved `tableId` (not the caller, since customers are anonymous) — cap order-creation attempts per table per short window (e.g., a small number per minute), so scripted flooding is blunted even before App Check is fully configured or if it's ever bypassed. Implementation detail (mechanism: a short-lived counter document vs. an in-memory/Firestore TTL record) is an implementation-time decision, not fixed here.

### H3 — Missing stock validation / plan divergence *(High)*
**This finding has two separate outputs, not one fix:**
1. **Documentation reconciliation (in scope for this remediation pass):** amend `QR_SPRINT1_IMPLEMENTATION_PLAN.md` §4 to state explicitly that the transactional stock check is deferred to the Master Plan's Phase 5 (Inventory Integration), matching what Sprint 1 actually built under the "no inventory deduction" instruction. This removes the plan/code contradiction the review flagged, with zero code risk.
2. **Forward-scheduled implementation (out of scope for this remediation pass, tracked here so it isn't lost):** when Phase 5 starts, extend `createQrOrder`'s existing transaction — which already reads menu items in the correct place — to also read each line's linked `inventory_items` via `linkedInventoryItemId`, run the BOM-explosion check, and abort the write if any line is insufficiently stocked. This reuses the audit-confirmed BOM logic rather than reimplementing it, per the Master Plan's existing plan to refactor it into a shared `InventoryDeductionService`.

---

## 2. Fix plan — Medium findings

### M1 — No order-creation idempotency
**Fix:** add a client-supplied idempotency key to `createQrOrder`'s input (generated once per submit-attempt on the client and reused on retry, mirroring the same `Idempotency-key` discipline the Master Plan already specifies for the Sprint 2 Xendit calls — consistent pattern across both callables). Inside the existing transaction, check whether an order with that key already exists for that table within a short recency window; if so, return the existing order's `orderId`/`orderNumber` instead of creating a new document. Recommend the explicit-key approach over a content-hash/time-window heuristic — it's unambiguous and matches the pattern Sprint 2 will need anyway.

### M2 — Single hot counter document
**Fix (deferred by default — see §4):** if pilot load data ever shows contention on `counters/qr`, the standard remedy is a sharded counter (N sub-documents summed on read, randomly selected on write) or decoupling order-number assignment from the write transaction. Recording the fix approach now so it doesn't need re-research later; not scheduling implementation until real throughput justifies it.

### M3 — `qr_tables` read exposes `qrToken`
**Fix:** stop returning the raw document to any `isSignedIn()` reader. Since Firestore rules can't redact individual fields, the practical fix is: (a) any legitimate staff need to see/manage tables goes through a callable that reads server-side (Admin SDK) and returns a DTO with `qrToken` omitted; (b) tighten the `qr_tables` read rule itself to a narrower permission than blanket `isSignedIn()` (which today includes not-yet-approved self-registered accounts), since the only remaining direct-read consumer should be a narrowly-permissioned admin action, not "any staff."

### M4 — `qr_orders` read not business-unit scoped
**Fix:** scope the read rule to the caller's own business unit(s), using the **same** BU-membership helper pattern every other collection in `firestore.rules` already uses — not a new bespoke check. This brings `qr_orders` in line with the rest of the project's consistent multi-tenancy model instead of inheriting `pos_orders`' known permissiveness.

### M5 — `createQrTable` integrity gaps
**Fix:** bundled into H1's implementation (§1) — BU-scope, BU-existence, and duplicate-`tableNumber` checks land in the same PR as the RBAC fix, since they touch the same function and the same review.

### M6 — Hardcoded `'tng-systems'` DB target
**Fix:** extract `getFirestore(getApp(), 'tng-systems')` into one shared module that all three QR callables import, so the eventual P0-2 decision changes exactly one line instead of three. Purely mechanical, low risk, and should land regardless of which database wins — it removes the *drift* risk (three copies quietly diverging), independent of what the copies currently say.

---

## 3. Which findings block deployment

"Deployment" here means deploying these functions/rules/indexes to the live Firebase project — staging or production — at all, given the project has no isolated sandbox and self-registration means "signed-in" is not a strong trust signal.

| Finding | Blocks deployment? | Why |
|---|---|---|
| **C1** | ✅ **CLOSED 2026-07-03.** | Gate A closed — P0-1 (keys) + P0-2 (prod DB = `tng-systems`) both resolved. No longer a Gate A deploy blocker; remaining deploy preconditions are Gate B. |
| **H1** | **Yes.** | Any signed-in (incl. unapproved self-registered) account can mint tables/tokens today — a direct privilege-escalation path onto the customer-facing surface. |
| **H2** | **Yes, before real/public traffic.** | The project's first genuinely anonymous public surface, with no abuse control at all. Could arguably deploy to a fully access-restricted internal test environment without this, but not to anything reachable by real diners. |
| **H3** | **Yes, before real ordering/payment.** | Oversell risk. Not a risk while no payment exists and no real diners are ordering; becomes a hard blocker the moment Sprint 2 (payment) or any live pilot begins. |
| **M3** | **Yes.** | Any signed-in staff account (including unapproved self-registrations) can read every table's access token digitally, bypassing the "physical QR only" model entirely. |
| **M4** | **Yes.** | Cross-business-unit data + customer PII (`customerName`) exposure — breaks the multi-tenancy boundary every other collection maintains. |
| **M6** | ✅ **Resolved (centralized).** | P0-2 closed — DB target confirmed as `tng-systems`, centralized in `functions/src/qr/firestore.ts`. Correct target, single source of truth. |

**Net: C1, H1, H2, H3, M3, M4, M6 must all be resolved before any deploy to the live project.**

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

1. **~~Gate A external closure~~ ✅ DONE (2026-07-03)** (§1 C1) — P0-1 (keys) + P0-2 (prod DB = `tng-systems`) both closed. Precondition met; shipping now gates on Gate B (production readiness).
2. **M6** — centralize the DB-target module. Do first: every subsequent change touches these same three files, so get the shared import in place before layering more edits on top.
3. **H1 + M5** — RBAC, BU-scope, BU-existence, and duplicate-table checks on `createQrTable`, as one PR.
4. **M3** — replace direct `qr_tables` client reads with a token-omitting callable/DTO; tighten the read rule. Independent of step 3 but naturally follows it since both touch table-management access.
5. **M4** — BU-scope the `qr_orders` read rule. Independent, low-risk, quick — grouped here since it's the same category of fix as step 4 (tightening over-broad reads).
6. **H2** — App Check + per-table rate limiting on `getPublicMenu`/`createQrOrder`. Placed after 2–5 deliberately: this is the heaviest infra lift, and it's easier to reason about once the authorization surface (H1/M3/M4) is already narrowed — fewer moving parts to test together.
7. **M1** — idempotency key on `createQrOrder`. Placed after H2 since both touch request-shaping on the same callable; doing them together avoids touching that function twice in close succession.
8. **H3 documentation reconciliation** — can happen at any point in this sequence (it's a plan-file edit, not code); the actual BOM stock-check implementation is explicitly *not* part of this ordered list — it's scheduled into the Phase 5 Inventory Integration sprint.
9. **M2** — not scheduled; revisit only if pilot load data warrants it (§4).
10. **Lows** — opportunistic; L4/L6 naturally fit alongside step 6 (H2) since all three touch error-handling/logging on the same callables; L1/L2/L3/L5 have no natural anchor point and can land whenever convenient.

---

## 6. Tests required

Every fix below is verified either by extending the existing pure-logic unit-test file (`orderLogic.test.ts`, currently 11 passing tests, no framework dependency) or by a Firestore-emulator-backed integration/rules test where real auth/rules context is unavoidable. The existing test suite must also be re-run after every step to confirm no regression to sanitization/repricing/validation logic, alongside the project's existing `tsc`/build verification habit.

| Fix | Test type | What it must prove |
|---|---|---|
| **H1 + M5** (`createQrTable` RBAC/scope) | Emulator-backed integration test (needs real auth context — not a pure-logic test) | An unauthenticated call is rejected; a signed-in caller *without* the required permission is rejected; a caller attempting a `businessUnitId` they're not authorized for is rejected; a non-existent `businessUnitId` is rejected; a duplicate active `tableNumber` within the same BU is rejected (or explicitly allowed, matching whatever the team decided); a correctly-permissioned, correctly-scoped call succeeds and returns a token. |
| **H2 — App Check** | Manual/staging verification against a deployed function (App Check enforcement can't be meaningfully unit-tested locally) | A request without a valid attestation token is rejected once enforcement is enabled; the mock/real client successfully passes attestation. |
| **H2 — rate limit** | Unit test on the pure rate-limit-decision logic + an emulator integration test | Unit: given N prior timestamps within the window, request N+1 is rejected; request after the window elapses is allowed. Integration: hitting the real callable rapidly N+1 times against the emulator reproduces the same rejection. |
| **H3 — doc reconciliation** | None (documentation-only edit) | N/A this pass. The future Phase-5 stock-check will need its own concurrent-submit/oversell test at that time — noted for that sprint's plan, not this one. |
| **M1 — idempotency** | Unit test on the key-matching logic + emulator integration test | Unit: a second call with the same idempotency key within the window returns the *same* `orderId`/`orderNumber` rather than minting a new one. Integration: two near-simultaneous `createQrOrder` calls with the same key against the emulator produce exactly one `qr_orders` document and exactly one counter increment. |
| **M2 — sharded counter** (if/when implemented) | Concurrency/load test | N simultaneous `createQrOrder` calls produce N unique order numbers with no collisions, under measured contention — not required until §4's condition is met. |
| **M3 — `qrToken` exposure** | Firestore rules-unittest-style test + a DTO-shape assertion | A signed-in non-admin client can never receive `qrToken` in any read path; the new table-listing callable's returned shape has `qrToken` absent; a correctly-permissioned admin path still succeeds at its intended action. |
| **M4 — `qr_orders` BU scope** | Firestore rules-unittest-style test | A signed-in user from BU-A cannot read a `qr_orders` document belonging to BU-B; the same user can read documents belonging to their own BU. |
| **M6 — centralized DB module** | Lightweight unit/import check | All three callables resolve to the same Firestore instance/module (guards against future drift back into three hardcoded copies), rather than a runtime behavior test. |
| **Regression, every step** | Existing `orderLogic.test.ts` (11 tests) + `functions/` `tsc` build + root `tsc --noEmit` + root `npm run build` | No step in this remediation introduces a typecheck, build, or existing-test regression. |

---

*Documentation only. No code, configuration, rules, indexes, or Cloud Functions were created or modified in producing this plan. Implementation begins in a separate, explicit pass, gated on §1 C1's closure.*
