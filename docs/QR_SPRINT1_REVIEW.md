# QR Ordering — Sprint 1 Code Review (Real Order Persistence)

> **Type:** Read-only code review. No files were modified to produce this report.
> **Reviewed against:** [`QR_SPRINT1_IMPLEMENTATION_PLAN.md`](QR_SPRINT1_IMPLEMENTATION_PLAN.md) and [`QR_ORDERING_MASTER_PLAN.md`](QR_ORDERING_MASTER_PLAN.md).
> **Scope reviewed:** `functions/src/qr/{orderLogic,getPublicMenu,createQrOrder,createQrTable}.ts`, `functions/src/index.ts`, `src/features/qr-ordering/types/qrOrder.types.ts`, the `qr_orders`/`qr_tables` blocks in `firestore.rules`, and the QR entries in `firestore.indexes.json`.
> **Date:** 2026-07-03

---

## 0. Verdict

The implementation is **functionally sound for its stated Sprint 1 scope** — atomic order-number allocation, server-authoritative re-pricing, strict menu sanitization, and callable-mediated writes are all implemented correctly and match the plan's core intent. The pure logic is well-isolated and unit-tested.

However, the review found **1 Critical, 3 High, 6 Medium, and 6 Low** findings. The Critical is environmental (deploying onto an un-remediated Gate A). The Highs are authorization and abuse-surface gaps that must close before this is exposed to real traffic. **None of the Highs are blocking for a non-deployed sprint**, which is the current state — they are blocking for go-live.

**Severity legend:** **Critical** = must not ship / active exposure · **High** = security/correctness gap, blocks go-live · **Medium** = real risk, schedule before pilot · **Low** = hygiene / hardening / accuracy note.

> **Remediation status (updated 2026-07-03):** the deployment-blocking findings have been remediated in code — see [`QR_SPRINT1_REMEDIATION_PLAN.md`](QR_SPRINT1_REMEDIATION_PLAN.md) and the **Status** column below. **H2 remains OPEN by design** (App Check needs client-side attestation infra not yet present — delivered as a plan, not half-built code). Nothing is deployed (Gate A / C1 still open).

| # | Finding | Area | Severity | Status |
|---|---|---|---|---|
| C1 | Deploying onto an open Gate A (unrotated keys, undecided prod DB) | Security / prod-readiness | **Critical** | ⛔ Open (external gate) |
| H1 | `createQrTable` has zero RBAC — any signed-in user mints tables + tokens | Callable authorization | **High** | ✅ Fixed |
| H2 | No abuse protection (App Check / rate limiting) on the anonymous callables | Security | **High** | 📝 Plan only (see §1 H2) |
| H3 | Stock validation absent — oversell gap; diverges from plan §4 | Missing stock validation | **High** | ✅ Doc reconciled; impl → Phase 5 |
| M1 | No order-creation idempotency — retry/double-tap ⇒ duplicate orders | Race / correctness | **Medium** | ⬜ Deferred (pre-Sprint 2) |
| M2 | Single hot counter document — throughput ceiling + retry amplification | Order-number race | **Medium** | ⬜ Deferred (load-driven) |
| M3 | `qr_tables` read exposes `qrToken` to every signed-in user | Firestore rules | **Medium** | ✅ Fixed |
| M4 | `qr_orders` read is not BU-scoped — cross-BU + PII exposure to any staff | Firestore rules | **Medium** | ✅ Fixed |
| M5 | `createQrTable` lacks BU-scope, BU-existence, and duplicate-`tableNumber` checks | Table lifecycle | **Medium** | ✅ Fixed |
| M6 | Prod-DB target hardcoded `'tng-systems'` in 3 files (P0-2 unresolved) | Prod-readiness | **Medium** | ✅ Fixed (centralized) |
| L1 | `encodeQrToken` modulo bias (`byte % 62`) | Token generation | **Low** | ⬜ Deferred |
| L2 | Price display↔charge TOCTOU (no price lock) | Server-side repricing | **Low** | ⬜ Deferred |
| L3 | `isAvailable` can only ever be `true` (query pre-filters `isActive`) | Menu sanitization | **Low** | ⬜ Deferred |
| L4 | Error messages leak internal codes/ids to the client | Security | **Low** | ⬜ Deferred |
| L5 | `functions/lib` is git-tracked and was recompiled | Prod-readiness | **Low** | ⬜ Deferred |
| L6 | No observability/structured logging on the new callables | Prod-readiness | **Low** | ⬜ Deferred |

**This pass fixed:** H1, H3 (doc), M3, M4, M5, M6. **Still blocking go-live:** C1 (external Gate A), H2 (abuse protection — plan delivered), H3-impl (Phase 5 stock check). **Not blocking (deferred):** M1, M2, all Lows.

---

## 1. Security

### C1 — Deploying onto an open Gate A *(Critical)*
The code targets the live `tng-systems` project, whose **admin service-account keys remain committed to git** (Remediation P0-1, still open per [`QR_MVP_GAP_ANALYSIS.md`](QR_MVP_GAP_ANALYSIS.md) §4) and whose **production database is still undecided** (P0-2 / O9). The implementation itself is not at fault, but *deploying it* would stand up new public-facing endpoints inside a project with exposed credentials and an ambiguous write target. **This code must not be deployed until P0-1 and P0-2 are closed.** As written for a non-deployed sprint, no action is needed in the code — this is a release gate, not a code defect.

### H2 — No abuse protection on anonymous callables *(High)*
`getPublicMenu` and `createQrOrder` are `onCall` functions with **no `request.auth` requirement** (correct for anonymous diners) but **no [Firebase App Check], rate limiting, or per-caller throttling**. Consequences:
- `createQrOrder` can be invoked by anyone who holds an active `tableId` (which `getPublicMenu` hands out to anyone with the physical QR token). A script can then create unbounded `AWAITING_PAYMENT` documents, **inflating the shared `counters/qr` value** and driving Firestore write cost — a cheap denial-of-wallet / junk-data vector.
- `getPublicMenu` can be hammered to drive read cost.
The Master Plan repeatedly names "new public surface" as a top risk (§1, §7.4). App Check (attestation) plus a lightweight per-token/IP rate limit is the standard mitigation and should be added before the endpoints are public. **Severity High** because it is the first genuinely public, unauthenticated surface in the entire project (audit §5: "no public precedent").

### L4 — Internal error codes leak to the client *(Low)*
`repriceLine` throws `MENU_ITEM_NOT_FOUND:<id>` / `MENU_ITEM_WRONG_BU:<id>` and `createQrOrder` forwards the raw message straight into `HttpsError('failed-precondition', message)`. The leaked id is the caller's own submitted value (low sensitivity), but forwarding internal error tokens to clients is poor hygiene and can aid probing (e.g., distinguishing "not found" from "wrong BU" confirms cross-BU item existence). Prefer a generic client message + server-side detail log.

---

## 2. Firestore rules

Both blocks are **correctly `write: if false`** (all writes via Admin SDK callables) — this is the right, plan-conformant choice and is *stricter* than the audit-flagged `pos_orders` (`isSignedIn()` writes). Two read-side gaps:

### M3 — `qr_tables` read exposes `qrToken` *(Medium)*
`allow read: if isSignedIn();` returns the **entire** table document — including `qrToken` — to any authenticated user. The plan (§2.2, §3) treats `qrToken` as the customer-access credential and explicitly wanted it protected ("the token itself is never round-tripped to the browser"). As written, any staff account (or a compromised/low-privilege one — note the project allows self-registered `PENDING` users) can read every table's token and thus drive orders at any table remotely. Mitigation: serve the admin table list through a callable that omits `qrToken`, or restrict the read rule and never return the token field to clients.

### M4 — `qr_orders` read is not business-unit scoped *(Medium)*
`allow read: if isSignedIn();` lets **any** signed-in user read **all** orders across **all** business units, including `customerName` (PII). Every other data collection in the project is BU-scoped (audit §2). This mirrors `pos_orders`' permissiveness, which the audit flagged `[WARNING]`; QR should not inherit it. Mitigation: scope reads by the caller's BU and/or a role/permission check, consistent with the rest of the rule set.

*(Note: customers are anonymous and never signed in, so neither read rule exposes anything to diners — the exposure is staff-side only. That's why these are Medium, not High.)*

---

## 3. Callable authorization

### H1 — `createQrTable` has no RBAC *(High)*
The function checks only `if (!request.auth)`. **Any authenticated user** — including a freshly self-registered `PENDING` account with no permissions — can create `qr_tables` documents and mint valid `qrToken`s for **any** `businessUnitId` they name. This is exactly the `postTransaction`-style RBAC gap the audit called out (P2-4, R11), reproduced in new code. The plan (§3, §10.3) specified a permission-gated path (`hasPermission('MENU_MANAGE_TABLES')` or equivalent). Mitigation: add a role/permission check and constrain the creator to their own BU (see M5). **High** because minting tokens is the credential that gates the whole customer surface.

- `getPublicMenu` / `createQrOrder` intentionally require no auth (anonymous diners) — that decision is correct per design; the associated risk is abuse (H2), not authorization.

---

## 4. Order-number race conditions

**The atomicity is correct.** Counter read → increment → `qr_orders` write all occur inside one `runTransaction`; a conflicting concurrent transaction aborts and retries, so two orders can never receive the same number, and there is no partial (order-without-counter or counter-without-order) state. This satisfies Master Plan A10. Two non-correctness caveats:

### M2 — Single hot counter document *(Medium)*
Every `createQrOrder` contends on the one `counters/qr` document. Firestore's guidance is ~1 sustained write/sec per document; a busy venue's concurrent submits will cause transaction contention → retries → latency, and eventually throttling. This is a **scalability**, not correctness, issue. Mitigations to consider before a high-volume pilot: sharded counters, or decoupling the human-readable order number from document creation (allocate lazily / in batches). Acceptable for a single low-volume pilot; flag for O7 (multi-location) scaling.

- **No duplicate-line merge:** two lines with the same `menuItemId` are read twice in the same transaction (allowed) and stored as two lines — harmless, noted for completeness.

---

## 5. Token generation quality

Source is a CSPRNG (`crypto.randomBytes`), length is 18 chars (~107 bits) — **not brute-forceable**, good. One defect:

### L1 — Modulo bias in `encodeQrToken` *(Low)*
`BASE62[b % 62]` maps a uniform byte (0–255) onto 62 symbols; since 256 is not a multiple of 62, symbols for residues 0–7 occur ~5/256 vs ~4/256 for the rest — a small, non-uniform distribution. At 18 characters the effective-entropy loss is negligible and there is **no practical exploit**, but for a security token the correct approach is rejection sampling or reading a wider integer and reducing mod 62 with rejection. **Low** — hygiene, not a live risk at this token length.

---

## 6. Server-side repricing

**Correct and well-tested.** `repriceLine` uses `menuItem.sellingPrice` from the server's `menu_items` and ignores any client-supplied price (a test explicitly injects `unitPrice: 1` and asserts the server price wins); it also rejects missing items, wrong-BU items, inactive items, and non-finite/negative prices. Totals use an epsilon-corrected `money()` rounding. This closes the price-tampering vector cleanly. One residual:

### L2 — Display↔charge TOCTOU (no price lock) *(Low)*
The price shown by `getPublicMenu` and the price charged by `createQrOrder` are read at different moments; if an admin edits `sellingPrice` in between, the diner is charged the new price with no re-confirmation. The plan did not require a price lock for Sprint 1, and re-pricing from source is the safer default (never undercharges due to a stale cart), but it can *over*charge silently vs. what was displayed. Consider echoing an "as-priced" line total back for the future checkout to confirm. **Low.**

- **Tax = 0** is hardcoded pending O5 (VAT decision) and is documented in code — acceptable for Sprint 1, no finding beyond noting O5 must be resolved before money is actually collected (Sprint 2).

---

## 7. Menu sanitization

**Strong.** `sanitizeMenuItem` is an explicit whitelist — it constructs the DTO field-by-field and never reads `calculatedCost`, `grossMargin`, `marginPercent`, `foodCostPercent`, `ingredients`, or `linkedInventoryItemId`. A unit test asserts the exact output key set and that each sensitive field is absent. This satisfies the Master Plan §6.4 hard rule (no COGS leak to customers). One design limitation:

### L3 — `isAvailable` is always `true` in responses *(Low)*
`getPublicMenu` filters `where('isActive','==',true)` in the query, then `sanitizeMenuItem` derives `isAvailable` from `isActive`. Net effect: every returned item has `isAvailable === true`, and an item that is on the menu but temporarily sold out simply **disappears** rather than appearing with a "sold out" state. The Sprint 1 mock UI had a distinct sold-out badge that this backend cannot express. Not a bug, but a product-parity gap to reconcile when the UI is wired (Sprint 2) — either add a real `isAvailable`/stock flag on `menu_items` (Master Plan §5 "extend: `isAvailable` toggle") or accept absence == unavailable.

*(Indexing note: `getPublicMenu`'s two-equality query (`businessUnitId ==` + `isActive ==`) is servable by Firestore's single-field indexes and does **not** require a composite index, so no missing-index defect here. The composite indexes that were added — `qr_orders` status/time and table/time, `qr_tables` BU/active — are the ones that genuinely need it because they pair equality with an `orderBy`/second field.)*

---

## 8. Missing stock validation

### H3 — No stock check; oversell gap; diverges from plan §4 *(High)*
`createQrOrder` contains only a `// TODO (Phase 5)` where the stock reservation belongs; **no inventory is read or reserved**. This was a deliberate, documented scope decision (the implementing task said "no inventory deduction," and a correct check needs the recursive BOM-explosion engine that is Phase 5 work). Two things a reviewer must record honestly:
1. **It diverges from `QR_SPRINT1_IMPLEMENTATION_PLAN.md` §4**, which lists the transactional read-and-validate stock check as part of Sprint 1's `createQrOrder` contract. The code and the plan disagree; the code chose the narrower, task-scoped interpretation. That divergence should be reconciled in the plan (amend §4) so the documents don't contradict each other.
2. **It is a Master Plan A11 go-live blocker.** Until the BOM-explosion reservation lands (inside this same transaction, which is correctly structured to receive it), a diner can be led toward payment for an out-of-stock item. Harmless while nothing is deployed and no payment exists yet; **blocking before any real ordering/payment goes live.**
Classified **High** as a gap-versus-target, with the explicit acknowledgment that the omission is intentional and well-marked for Sprint 1.

---

## 9. Missing table lifecycle checks

`isActive` is checked in both `getPublicMenu` and `createQrOrder` (a table deactivated mid-session correctly rejects new orders) — the core lifecycle guard is present. Gaps in `createQrTable`:

### M5 — `createQrTable` integrity gaps *(Medium)*
- **No BU-scope check:** a staff user from BU-A can create a table for BU-B (compounds H1). Should constrain to the caller's own BU (or an explicit cross-BU admin permission).
- **No BU-existence check:** `businessUnitId` is accepted as any non-empty string; a typo creates an orphan table for a non-existent BU whose menu query will silently return empty.
- **No duplicate-`tableNumber` guard:** two tables can share `tableNumber` "12" within one BU (each with a different token), which is ambiguous for staff and reporting. The plan (§5) implies one logical table per number; add a uniqueness check (or a documented decision to allow duplicates).
- **Reactivate/deactivate not implemented:** the plan's table lifecycle (§5) includes deactivate/reactivate; Sprint 1 only ships create. Acceptable if scheduled, but the lifecycle is incomplete as delivered.

---

## 10. Production-readiness risks

### M1 — No order-creation idempotency *(Medium)*
Callable clients (Firebase SDK) may retry on transient network errors, and a diner can double-tap "submit." `createQrOrder` has **no idempotency key**, so a retry mints a *second* `qr_orders` document and a second order number for the same intent. The Master Plan makes idempotency central for payment (§7.4); order creation deserves at least a client-supplied idempotency token (or a short-window dedupe on `(tableId, itemsHash)`) to avoid duplicate tickets and, later, duplicate payment sessions. **Medium** now (junk unpaid orders); escalates once payment is attached.

### M6 — Hardcoded `'tng-systems'` DB target *(Medium)*
All three callables call `getFirestore(getApp(), 'tng-systems')`. This encodes the still-open P0-2 decision as a literal in three files. If the production DB is decided to be `(default)`, these will **silently write to the wrong database** with no error. Centralize the DB handle in one module and treat the target as the single documented output of P0-2.

### L5 — `functions/lib` is git-tracked *(Low)*
Compiled output under `functions/lib` is committed (a pre-existing repo choice); building Sprint 1 regenerated it, including incidental recompiles of `admin.js`/`transactions.js` (whose source is unchanged). Recommend `.gitignore`-ing `functions/lib` and building in CI instead, so review diffs reflect source only.

### L6 — No observability on new callables *(Low)*
Only a bare `console.error` on the catch-all. The first public endpoints in the project warrant structured logging (caller/token hash, table, outcome, latency) and, later, metrics/alerts — especially given the abuse surface (H2). **Low** for Sprint 1, but pair with the CI/monitoring items in Remediation P1-2.

---

## What is done well (for balance)

- **Atomic order numbering** via a single transaction — textbook-correct, satisfies A10/A11's numbering requirement.
- **Server-authoritative pricing** with a dedicated, tested pure function — the price-tampering vector is closed.
- **Whitelist sanitization** with a regression test asserting no cost/margin/recipe leakage — satisfies the §6.4 hard rule.
- **`write: if false` rules** — stricter than the surrounding project, correctly forcing all writes through callables.
- **Pure/impure separation** — all business rules live in `orderLogic.ts` with zero Firebase imports, making them unit-testable without emulators (11 passing tests, no framework dependency).
- **Frozen type contract** with the full lifecycle declared up front, per the plan's §2.1.1 anti-migration discipline.
- **Input hardening** — line/qty/name caps guard against oversized payloads.

---

## Recommended fix order (for the next sprint's grooming)

1. **Do not deploy** until Gate A (C1 / P0-1 / P0-2) clears — unchanged from the Gap Analysis.
2. **H1** add RBAC + BU-scope to `createQrTable`; **H2** add App Check + rate limiting to the anonymous callables. These are the two go-live-blocking authorization/abuse gaps.
3. **M3/M4** stop returning `qrToken` to clients and BU-scope `qr_orders` reads.
4. **H3** reconcile the stock-check divergence: either amend plan §4 to match the deferred reality, or schedule the BOM reservation before any live ordering.
5. **M1/M6/M5** idempotency key, single DB-target module, and `createQrTable` integrity checks.
6. **L1–L6** hygiene, opportunistically.

---

*Read-only review. No code, configuration, rules, indexes, or Cloud Functions were modified in producing this document.*
