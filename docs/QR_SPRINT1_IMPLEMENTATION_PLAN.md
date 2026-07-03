# QR Ordering — Sprint 1 Implementation Plan: Real Order Persistence

> **Document type:** Planning/documentation only. **No code, config, rules, or Firebase resources are created or changed by this document.** It defines what Sprint 1 will build once authorized.
> **Source of truth:** [`QR_ORDERING_MASTER_PLAN.md`](QR_ORDERING_MASTER_PLAN.md) (architecture) and [`QR_MVP_GAP_ANALYSIS.md`](QR_MVP_GAP_ANALYSIS.md) (current state). Where this plan is silent, the Master Plan governs.
> **Scope of "Sprint 1":** Master Plan **Phase 1 (Foundation)** + the persistence half of **Phase 2 (Ordering core)** — i.e., *real* `qr_orders`/`qr_tables` data, a real menu-read callable, and a real order-create callable with an atomic (counter + write) transaction. **Payment (Xendit), kitchen/bar/cashier UI wiring to live data, and inventory deduction/stock validation are explicitly out of this sprint** — they land in Sprints 2–4/Phase 5 per the Master Plan's phase order. *(Amended 2026-07-03: the transactional inventory stock check originally described in §4 is deferred to Phase 5 — see the §4 amendment.)*

---

## 0. Sprint 1 does not start yet — gate status

Per the Gap Analysis §4, **GATE A (Security Remediation Gate)** is a hard precondition for Phase 1, and two of its three exit criteria are still open as of this writing:

| Exit criterion | Status |
|---|---|
| P0-1 — Rotate committed service-account keys | ❌ Open (keys still in repo) |
| P0-2 — Decide production database ((default) vs `tng-systems`) | ❌ Open (no decision recorded) |
| P0-3 — Green build | ✅ Resolved (verify/refresh audit evidence) |

**This plan is written so Sprint 1 can begin the moment P0-1 and P0-2 clear — it is not itself the authorization to write code.** Task 9.0/10.0 below (Elio/Fred's first task each) is explicitly "confirm Gate A is closed" before anything else in this plan starts.

---

## 1. Firestore collections

Three new collections, all written server-side only (Admin SDK / Cloud Functions), per Master Plan A6/A9. No existing collection is modified.

| Collection | Purpose | Written by |
|---|---|---|
| `qr_orders` | One document per customer order; the full lifecycle record (cart → payment → fulfillment). | `createQrOrder` callable only in Sprint 1 (status transitions beyond `AWAITING_PAYMENT` land with Sprint 2's payment work, not this sprint). |
| `qr_tables` | One document per physical table; carries the `qrToken` a customer's scan resolves to a table identity. | Admin table-management UI (Fred), via a callable — not direct client writes. |
| `counters` (existing collection, new document) | Reuses the existing `CounterService`/`getNextId` pattern with a new `QR` prefix for atomic, zero-padded order numbers (`QR-00001`), per Master Plan A10. | `CounterService.getNextId('QR')` — **no new collection needed**, just a new counter document `counters/qr`. |

**Deliberately not created this sprint** (per Master Plan phase order — listed so nobody accidentally scope-creeps into them):
- `xendit_events` (idempotency ledger) — Sprint 2 (Payments).
- Any `qr_orders` write path beyond `createQrOrder` — status advances to `PAID`/`IN_KITCHEN`/etc. are driven by the webhook (Sprint 2) and staff actions (Sprint 3+), not Sprint 1.

---

## 2. Document schemas

Schemas are the Master Plan §6.3 model, held to Sprint 1's actual scope (fields that don't yet have a writer are marked accordingly — they exist in the type from day one so the shape never needs a breaking migration later, but are `null`/absent until their owning sprint lands).

### 2.1 `qr_orders/{orderId}`

```
qr_orders/{orderId}
  # Identity
  id: string                      // = Firestore doc id
  businessUnitId: string          // BU-scoping, matches every other collection's pattern
  tableId: string                 // FK → qr_tables/{tableId}
  orderNumber: string             // via CounterService.getNextId('QR') → "QR-00001"

  # Items (reuses POSOrderItem shape — Master Plan A7/§6.3)
  items: Array<{
    menuItemId: string
    productName: string
    quantity: number
    unitPrice: number
    subtotal: number
    notes?: string
    category: string
  }>

  # Order meta
  customerName?: string
  orderType: 'DINE_IN'             // 'TAKEOUT' type-safe but unused (O3 assumes dine-in only for MVP)
  subtotal: number
  taxAmount: number                // 0 for Sprint 1 pending O5 (VAT display decision)
  totalAmount: number
  currency: 'PHP'

  # Fulfillment lifecycle — Sprint 1 only ever writes 'AWAITING_PAYMENT'
  status: 'AWAITING_PAYMENT'       // full union type declared now (see 2.1.1) for zero future migration
      | 'PAID' | 'IN_KITCHEN' | 'IN_BAR' | 'READY' | 'SERVED' | 'COMPLETED'
      | 'PAYMENT_FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED'

  # Payment lifecycle — fields exist, all null/absent until Sprint 2
  paymentStatus: 'UNPAID'          // Sprint 1 always writes 'UNPAID'
      | 'AWAITING_PAYMENT' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED'
  paymentReference?: string        // null this sprint (= orderId once Sprint 2 sets it)
  xenditPaymentSessionId?: string  // absent this sprint
  xenditPaymentRequestId?: string  // absent this sprint
  xenditPaymentId?: string         // absent this sprint
  xenditChannelCode?: string       // absent this sprint
  paidAt?: Timestamp               // absent this sprint

  # Reconciliation — absent until Sprint 3.5 work
  officialInvoiceNumber?: string
  officialInvoicePostedAt?: Timestamp
  officialInvoicePostedBy?: string

  # Audit
  createdAt: Timestamp             // serverTimestamp()
  updatedAt: Timestamp             // serverTimestamp()
```

**2.1.1 — why the full status union is declared now:** the Master Plan's data model (§6.3) is a single frozen type used by every phase. Declaring the full lifecycle enum in Sprint 1 (even though only `AWAITING_PAYMENT` is ever written this sprint) means Sprint 2's webhook code and Sprint 3's kitchen/bar code type-check against a contract that never needs a breaking change — exactly the "freeze shared types early" discipline the Master Plan calls for in §10 (Developer ownership, handoff point 1: "End of Phase 1 — menu API contract + `qr_orders` shape frozen").

### 2.2 `qr_tables/{tableId}`

```
qr_tables/{tableId}
  id: string
  businessUnitId: string
  tableNumber: string              // display value, e.g. "12" (matches existing mock's tableNumber)
  qrToken: string                  // opaque, unguessable token embedded in the printed QR's URL
  isActive: boolean                // admin can deactivate a table (e.g. removed/under repair) without deleting history
  createdAt: Timestamp
  updatedAt: Timestamp
```

**`qrToken` generation:** a cryptographically random token (e.g. 22-char base62), generated server-side at table-creation time — never derived from `tableNumber` or any guessable sequence, so a customer cannot enumerate other tables by editing the URL.

### 2.3 `counters/qr` (existing collection, new document — no schema change)

Reuses the existing `CounterDocument` shape (`value: number`, `prefix: string`, `lastUpdated: string`) already enforced by `firestore.rules` (`:632-647`) and implemented in `counter.service.ts`. Sprint 1 adds exactly one new document, `counters/qr`, via `CounterService.getNextId('QR')` — **no rule or service code change needed**, this is pure reuse per Master Plan A10.

---

## 3. Security rules

Per Master Plan §6.4 and the audit's confirmation (`PHASE_0.5_FIREBASE_AUDIT.md` §4): **the customer path never talks to Firestore directly.** All customer reads/writes are Cloud Function callables using the Admin SDK, which bypasses `firestore.rules` entirely. This means Sprint 1's `firestore.rules` changes are narrow and staff-only:

| Collection | Rule (staff-side only — customers never hit this file) |
|---|---|
| `qr_orders` | `allow read: if isSignedIn();` (staff can read for future kitchen/cashier views, even though Sprint 1 doesn't build those UIs yet) · `allow write: if false;` — **all writes go through `createQrOrder`** (Admin SDK), mirroring the existing `transactions` collection pattern (`firestore.rules:947-954`) exactly. No client, staff or customer, ever writes `qr_orders` directly — this is stricter than `pos_orders` (`:987-992`, which the audit flagged `[WARNING]` for allowing unvalidated `isSignedIn()` writes) precisely because that gap is what QR must not repeat (Master Plan A6, audit §4 "QR relevance"). |
| `qr_tables` | `allow read: if isSignedIn();` (admin table-management UI needs to list tables) · `allow write: if isSignedIn() && hasPermission('MENU_MANAGE_TABLES')` (or equivalent existing permission key — see Fred task 10.3) for the admin UI's create/edit/deactivate actions. **`qrToken` is never exposed to the read used by the public menu callable** — the callable resolves `qrToken → tableId` server-side and returns only `tableId`/`tableNumber` to the client, so the token itself is never round-tripped to the browser after the initial QR scan URL. |
| `counters` | No rule change — `counters/qr` is created under the *existing* rule block (`:632-647`), which already generically allows any signed-in caller (i.e., the callable's Admin SDK context) to create-at-1 and increment. |

**No changes to any existing rule.** In particular, Sprint 1 does **not** touch the three `|| true` bypasses, the PRF Stage-7 bypass, or `menu_items`/`pos_orders` rules — those are Gap Analysis §5 (Security Review) items, tracked separately, and out of this sprint's scope by design (touching them here would silently expand scope into P1-1 remediation, which has its own owner and gate).

**New callable added this sprint:** `getPublicMenu()` (`onCall`, no auth required — Cloud Functions callables can be invoked without Firebase Auth when the function itself doesn't require it). Returns a **sanitized projection** of `menu_items`: `name`, `category`, `sellingPrice`, `description`, `imageUrl`, `isAvailable` — explicitly never `cost`, `margin`, or recipe/BOM fields, per Master Plan §6.4's hard requirement. This callable reads `menu_items` via the Admin SDK (server-side), so it is unaffected by — and does not need to change — the existing `menu_items` rule.

---

## 4. Order lifecycle

Sprint 1 implements only the **first transition** of the full lifecycle; the rest is documented here so the frozen type (§2.1.1) and every downstream sprint agree on the same state machine from day one.

```
                    ┌─────────────────────┐
  customer submits  │                     │
  ───────────────►  │   AWAITING_PAYMENT  │  ◄── Sprint 1 stops here
   (createQrOrder)  │                     │
                    └──────────┬──────────┘
                               │  webhook: payment SUCCEEDED (Sprint 2)
                               ▼
                    ┌─────────────────────┐
                    │        PAID         │
                    └──────────┬──────────┘
                               │  staff: Start Preparing (Sprint 3+)
                               ▼
                 ┌──────────────────────────┐
                 │  IN_KITCHEN / IN_BAR     │
                 └──────────┬───────────────┘
                             │ staff: Mark Ready
                             ▼
                    ┌─────────────────────┐
                    │        READY        │
                    └──────────┬──────────┘
                               │ staff: Mark Served
                               ▼
                    ┌─────────────────────┐
                    │        SERVED       │
                    └──────────┬──────────┘
                               │ (Sprint 4/5: inventory-deduction trigger)
                               ▼
                    ┌─────────────────────┐
                    │      COMPLETED      │
                    └─────────────────────┘

  Side branches (any point before COMPLETED):
    AWAITING_PAYMENT ──(webhook: FAILED/EXPIRED)──► PAYMENT_FAILED / EXPIRED
    PAID and later   ──(staff/owner cancels)──────► CANCELLED
    PAID and later   ──(refund succeeds)──────────► REFUNDED
```

**Sprint 1's exact contract:**
1. Customer submits cart → `createQrOrder(tableId, items, customerName?)` callable runs.
2. Callable **re-prices server-side** from live `menu_items` data (never trusts client-submitted prices — closes a tampering vector the current mock UI doesn't need to worry about but a real callable must).
3. Callable writes the new `qr_orders` document (`status: 'AWAITING_PAYMENT'`, `paymentStatus: 'UNPAID'`) — the counter increment and order write happen inside a single `runTransaction` so order numbers cannot collide (Master Plan A10).

   > **⚠️ Amendment (2026-07-03, post-implementation reconciliation — remediation H3):** the **transactional inventory stock check is DEFERRED to Phase 5 (Inventory Integration)** and was **not** built in Sprint 1. The implementing task scoped Sprint 1 to "no inventory deduction," and a correct check requires the recursive BOM-explosion engine that lives in the inventory module (Phase 5). `createQrOrder` re-prices server-side and validates menu availability (`isActive`), and its transaction is structured with a marked extension point (`// TODO Phase 5`) where the `inventory_items` BOM stock check will slot in — inside the same transaction, before the write. Until then, oversell is possible; this is a Master Plan A11 **go-live blocker** tracked for Phase 5, harmless while nothing is deployed and no payment exists. The original text of this step (a Sprint-1 stock check) was aspirational and did not match delivery.
4. **The order is not visible to kitchen/bar/cashier in Sprint 1** — no staff UI is wired to `qr_orders` yet (that's Sprint 3+). This sprint's acceptance bar is data-correctness and stock-safety, not staff-facing visibility.
5. Nothing beyond `AWAITING_PAYMENT` is reachable in Sprint 1 — there is no payment callable yet, so orders will sit in `AWAITING_PAYMENT` until Sprint 2 ships. That's expected and acceptable for a persistence-only sprint; it is **not** a regression versus the current mock (which has no persistence at all).

**Explicitly not in Sprint 1:** the stock check above verifies availability but does **not** decrement/reserve stock permanently — Master Plan A11 and Phase 2's own acceptance criteria treat "reserve at submit, release on payment-failure/expiry" as a Sprint 2 concern once the payment lifecycle exists to drive the release. Sprint 1's transaction is read-and-validate only, to avoid holding stock reservations against orders that may never be paid.

---

## 5. Table lifecycle

Simpler than order lifecycle — tables are long-lived, low-churn admin objects, not per-transaction records.

```
  admin creates table  ──►  ACTIVE (isActive: true)
                              │
                              │  admin deactivates (table removed/under repair)
                              ▼
                            INACTIVE (isActive: false)
                              │
                              │  admin reactivates
                              ▼
                            ACTIVE
```

- **Creation:** admin table-management UI (Fred, this sprint) calls a callable (or, if the team decides a direct Firestore write is acceptable for this specific low-risk admin-only path, a rule-gated write under `hasPermission(...)` — **decide during sprint kickoff**, default assumption below is "callable" for consistency with A9's spirit, but tables aren't customer-facing writes so a rule-gated path is defensible; flagging as an explicit Fred/Elio decision point, not silently picking one).
- **`qrToken` is immutable once issued** — regenerating a token for an already-printed QR code would invalidate physical signage. If a token must be revoked (lost/compromised code), the correct action is **deactivate the table and create a new one with a fresh token**, not mutate the existing token in place. This preserves a clean audit trail (`tableId` history) and matches how `qr_orders.tableId` foreign-keys are expected to resolve.
- **No delete.** Tables are deactivated, never deleted, so historical `qr_orders.tableId` references never dangle. (Mirrors the "immutable audit trail" pattern the audit found across `stock_transactions`/`pos_sales`/etc. — §2 of the audit.)
- **Out of Sprint 1:** QR *code image* generation/printing UI. The schema and the admin CRUD for the `qr_tables` document are in scope; rendering an actual scannable QR image and a print layout is a small, separable follow-on task the plan defers to whichever sprint the team prefers (does not block order persistence).

---

## 6. Required indexes

New composite indexes needed for the query patterns Sprint 1's callable and (future, but designed-for-now) staff queue views will use. The audit already flagged (`PHASE_0.5_FIREBASE_AUDIT.md` §2, `[WARNING]`) that indexes are thin and QR will need its own — this section is that debt paid down for Sprint 1's actual queries.

| Collection | Fields (order matters) | Query it serves |
|---|---|---|
| `qr_orders` | `businessUnitId` ASC, `status` ASC, `createdAt` DESC | Future staff queue views (Sprint 3+) filtering by status within a BU — designed now so the frozen schema + index land together, even though no UI reads it yet this sprint. |
| `qr_orders` | `businessUnitId` ASC, `tableId` ASC, `createdAt` DESC | Look up a table's current/recent orders (used by the order-status customer screen once it goes live in Sprint 2). |
| `qr_tables` | `businessUnitId` ASC, `isActive` ASC | Admin table-management list view (active vs. inactive tables per BU). |

No index is needed purely for `createQrOrder` itself (it's a single-document write inside a transaction, plus point-reads of specific `inventory_items` by ID — no query). The two `qr_orders` indexes above are **added in Sprint 1** (so they're live before Sprint 2/3 code needs them — composite index build time is non-trivial and should not block a later sprint) even though Sprint 1's own UI doesn't query by them yet.

---

## 7. Migration strategy

There is **no existing data to migrate** — `qr_orders`/`qr_tables` are net-new collections with zero prior documents (confirmed absent in the Gap Analysis §3). "Migration" here means **rollout sequencing**, not data transformation:

1. **Deploy rules + indexes first, functions second, nothing customer-facing yet.** Composite indexes can take minutes to build; deploying them ahead of the functions that need them avoids a race where a callable ships before its index is ready.
2. **Ship `qr_tables` + the admin CRUD UI before `createQrOrder`.** A table must exist (with a real `qrToken`) before any order can reference a `tableId` — natural dependency order, not an arbitrary choice.
3. **`getPublicMenu()` ships independently and first.** It has no dependency on `qr_tables`/`qr_orders` at all (it only reads existing `menu_items`), so it can be built, deployed, and verified in isolation before the order-creation path exists — de-risks the sprint by proving the "customer-facing callable, sanitized read" pattern works before the higher-stakes transactional-write callable is attempted.
4. **The existing mock UI (`CustomerMenuView.tsx` et al.) is left untouched during Sprint 1.** Wiring the mock screens to the new real callables is explicitly a **Sprint 2 integration task**, not part of persistence work — this keeps Sprint 1's blast radius to backend-only and means the live customer-facing prototype (whatever URL it's shared at) keeps working throughout the sprint with zero risk of a half-wired regression.
5. **No feature flag needed.** Because the new collections have no readers yet (staff UIs aren't wired this sprint) and the existing mock UI isn't touched, there is nothing to toggle — the new backend ships "dark" (deployed but unused by any UI) until Sprint 2 flips the customer flow over to it.
6. **Rollback plan:** if a Sprint 1 deploy needs to be reverted, it is a pure function/rule/index rollback — no data backfill or cleanup is needed, since nothing wrote to these collections before Sprint 1 and the mock UI never depended on them.

---

## 8. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Starting before Gate A actually clears** | Critical | This entire plan is blocked on P0-1 (key rotation) and P0-2 (prod DB decision) per §0. Do not begin task 9.1/10.1 until both are confirmed closed by the repo owner — not just "in progress." |
| **Oversell via the stock-check transaction** | Med-High | Master Plan A11: the check-and-create must be one `runTransaction`, reading `inventory_items` stock and writing `qr_orders` atomically. A plain read-then-write (matching the audit's `[BLOCKER]`-flagged existing `pos-import.service.ts:617-789` pattern) would reintroduce the exact bug the audit called out — this must not be copied. |
| **`qr_orders` inheriting `pos_orders`' unvalidated-write weakness** | Med | Rule is `allow write: if false` (§3) from day one — stricter than `pos_orders`, by design, not an oversight. |
| **Client-submitted prices trusted at order-create time** | Med | `createQrOrder` re-fetches current `sellingPrice` from `menu_items` server-side and computes `subtotal`/`totalAmount` itself; it never accepts a client-supplied price as truth. |
| **`qrToken` guessability / table enumeration** | Med | Token generated server-side, cryptographically random, never sequential or derived from `tableNumber` (§2.2, §5). |
| **Composite index build lag blocking Sprint 2** | Low-Med | Indexes (§6) are deployed in Sprint 1 even though no Sprint 1 query needs them yet, specifically to absorb build time before Sprint 2/3 code depends on them. |
| **Scope creep into Phase 2's payment-adjacent work** (e.g., someone "just wires up" the checkout mock to a half-built payment path) | Med | §0 and the header explicitly scope Sprint 1 to persistence only; payment stays Sprint 2. Flag any PR touching Xendit/webhook code as out-of-scope for this sprint's review. |
| **Scope creep into P1-1 rules remediation** (e.g., "while we're in firestore.rules, let's fix the `\|\| true` bypasses too") | Low-Med | §3 explicitly excludes touching those blocks. That work has its own tracked owner (Gap Analysis §5) and its own gate (GATE B) — mixing it into this sprint's diff makes review harder and conflates two different risk profiles. |
| **`qr_tables` write path decision left open** (callable vs. rule-gated direct write, §5) | Low | Flagged explicitly as a kickoff-day decision between Elio/Fred rather than silently defaulting — low risk either way since it's an admin-only, non-customer-facing path, but should be a recorded decision, not an accident. |
| **Frozen-type churn** — if the full `qr_orders` status/payment union (§2.1) turns out wrong once Sprint 2 actually builds the webhook | Low-Med | This is precisely why Master Plan §10 calls out "freeze shared types early, then treat changes as a reviewed handoff" — any change to the union after Sprint 1 ships should go through that handoff discipline, not an ad-hoc edit. |

---

## 9. Elio tasks (Customer + Cloud Functions)

Per Master Plan §10's split-by-layer ownership. Sequenced; each task assumes the previous one in the list is done.

1. **Confirm Gate A is closed** (P0-1 keys rotated + purged from git history, P0-2 production DB decision documented) before writing any function code. If either is still open, stop and escalate — do not proceed on an assumption that it'll be resolved "in parallel."
2. **Draft and freeze the `qr_orders`/`qr_tables` shared types** (§2.1, §2.2) in the shared types file, co-reviewed with Fred before either of you builds against it (Master Plan §10 handoff point 1).
3. **Implement `getPublicMenu()`** (`onCall`, no-auth-required callable) — reads `menu_items`, returns the sanitized projection (§3), explicitly unit-tested to assert `cost`/`margin`/recipe fields are never present in the response shape (regression guard against the exact leak Master Plan §6.4 warns about).
4. **Implement the `qrToken → tableId` resolution path** used by whatever customer entry point replaces today's `/order/:tableId?` mock route — reads `qr_tables`, validates `isActive`, returns `tableId`/`tableNumber` only (never the token itself back to the client beyond the initial URL, §3).
5. **Implement `createQrOrder(tableId, items, customerName?)`** as an `onCall` callable:
   - Validates `tableId` resolves to an active table.
   - Re-prices every line from live `menu_items` (never trusts client prices).
   - Runs the stock-check-and-create inside one `runTransaction` against `inventory_items` (§4, §8) — reuses the BOM-explosion logic the audit confirmed reusable (`pos-import.service.ts:536-705`) for computing *what* to check, wrapped in a transaction for *how* to check it safely (the transaction wrapper is the net-new part; the BOM math is reuse).
   - Uses `CounterService.getNextId('QR')` for `orderNumber` (§1) — reuse, not reimplementation.
   - Writes `status: 'AWAITING_PAYMENT'`, `paymentStatus: 'UNPAID'`, `createdAt`/`updatedAt: serverTimestamp()`.
   - Returns the created `orderId`/`orderNumber` to the caller.
6. **Deploy the two new `qr_orders` indexes** (§6) ahead of/alongside the functions deploy, so they're warm before Sprint 2 needs them.
7. **Write the rule changes for `qr_orders`** (§3: read-if-signed-in, write-if-false) and get them reviewed alongside Fred's `qr_tables` rule (item 10.4) as a single rules-file PR, since both land in the same file.
8. **Hand off** to Fred at sprint end: the frozen `qr_orders` shape + the `createQrOrder` contract (inputs/outputs/error shape), matching Master Plan §10's "End of Phase 1 — menu API contract + `qr_orders` shape frozen" handoff point.

---

## 10. Fred tasks (Staff Views + Inventory/Reporting)

1. **Confirm Gate A is closed** — same check as Elio's task 9.1; either developer independently verifying this before starting is intentional redundancy on a critical-severity item, not wasted effort.
2. **Co-review the frozen `qr_orders`/`qr_tables` types** (Elio's task 9.2) — Fred's downstream stake is inventory (`inventory_items` linkage inside `items[]`) and the future kitchen/bar/cashier queues that will query `qr_orders` by the exact indexes in §6, so this review should specifically check that the frozen shape supports those future queries without another migration.
3. **Decide + build the `qr_tables` write path** (§5, §8 risk item): work out with Elio whether table create/deactivate goes through a callable or a rule-gated direct write, using the existing permission-matrix pattern (`hasPermission(...)`, mirroring how other admin-only collections are gated) — this is Fred's call to drive since it's a staff/admin UI concern, not a customer-facing one.
4. **Write the `qr_tables` Firestore rule** (§3: read-if-signed-in, write-if-permission) as part of the same rules PR as Elio's `qr_orders` rule.
5. **Build the admin table-management UI**: list existing `qr_tables` (using the `businessUnitId + isActive` index from §6), create a new table (triggers server-side `qrToken` generation per whichever path item 10.3 lands on), and deactivate/reactivate — no QR *image* rendering/printing required this sprint (§5, explicitly deferred).
6. **Verify the BOM-deduction reuse path Elio's stock-check depends on** — confirm with Elio that the `inventory_items` read shape `createQrOrder`'s transaction expects (item counts, unit conversions) matches what `pos-import.service.ts`'s existing BOM explosion actually produces, since Fred owns that logic's long-term home (it's slated to become the shared `InventoryDeductionService` in Phase 5, per Master Plan §10's ownership table) — Sprint 1 only needs read-and-validate, but the shape contract should already anticipate Phase 5's write-and-deduct use of the same data.
7. **No queue-view UI work this sprint** — Kitchen/Bar/Cashier wiring to live `qr_orders` data is explicitly Sprint 3+ (once `PAID` is a reachable status). Fred's Sprint 1 deliverable is table management + the shared-type/index review, not queue UI.
8. **Receive handoff** from Elio at sprint end (item 9.8) and confirm the `qr_orders` shape + `createQrOrder` contract are sufficient to start Sprint 3's kitchen/bar/cashier live-data wiring without another schema change.

---

*End of Sprint 1 plan. Documentation only — no code, configuration, Firestore rules, indexes, or Cloud Functions were created or modified in producing this document. Implementation begins only once Gate A (§0) is confirmed closed.*
