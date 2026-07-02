# TNG QR Ordering — Executive Decision Record

> **Status:** Approved in principle — 2026-07-02
> **Audience:** Owners, stakeholders, management, non-technical readers
> **Technical source of truth:** [`docs/QR_ORDERING_MASTER_PLAN.md`](QR_ORDERING_MASTER_PLAN.md). This record is the short, plain-language summary; the master plan holds the full detail.

---

## Decision

**We will build QR Ordering as a new module inside the existing TNG system — not as a separate application.**

Customers will scan a QR code at their table, order and pay from their phone (via Xendit), and their paid order will flow straight to the kitchen/bar. TNG will handle operations, ordering, payment, kitchen workflow, inventory, reporting, and reconciliation. **The existing registered POS remains the official invoice/receipt issuer** — TNG does not issue official BIR receipts in this first version.

---

## Alternatives considered

**Option 1 — A separate QR ordering application.** A brand-new, standalone app with its own menu, inventory, users, and reporting.

**Option 2 — QR Ordering inside TNG (SELECTED).** Add QR ordering as a new module in the system we already run.

**Why we chose Option 2.** A detailed review of TNG showed the hard, expensive parts already exist and work today: inventory with automatic stock deduction from recipes, menu and costing management, staff roles and permissions, live real-time updates, and reporting foundations. Option 1 would rebuild all of that from scratch, then force us to keep two systems in sync (double the data, double the maintenance, conflicting numbers). Option 2 reuses what we have, keeps one source of truth, is faster to launch, and is cheaper to run.

---

## Benefits

**Operational** — Faster table turnover; customers order and pay themselves; fewer manual order-entry errors; payment is confirmed before the kitchen starts cooking; kitchen and bar get a live queue.

**Technical** — Reuses proven inventory, menu, roles, real-time, and reporting components; one codebase and one database instead of two; a clean, auditable trail linking each payment to its official receipt.

**Financial** — Lower build cost (less to build from scratch); lower ongoing cost (one system to maintain); online payment collected up front; better visibility of sales and stock; no change to our BIR compliance posture.

---

## Risks

| Risk | Mitigation |
|---|---|
| Online payment handling must be exactly right (no double charges, no missed confirmations) | Payment is confirmed by a secure server-to-server message from Xendit, processed once, with strict validation. |
| Opening a customer-facing surface could expose internal data | Customers never touch the database directly; all access goes through controlled server functions; cost/margin data is never sent to phones. |
| Selling an item that just went out of stock | Stock is checked at the moment of ordering, before payment is taken. |
| A paid order not matched to its official receipt | A cashier screen lists any paid order still missing its official invoice number; the day cannot be closed until all are matched. |
| Scope creep into official invoicing | Hard boundary: TNG does not issue BIR receipts in MVP; the registered POS remains the issuer. |

---

## Approved direction (one-page architecture summary)

```
Customer (phone, no login)
  → Scan table QR → Browse menu → Add to cart → Pay via Xendit
        │
        ▼
  Payment confirmed by Xendit webhook (the trusted signal)
        │
        ▼
  Order released to Kitchen / Bar queue (live updates)
        │
        ├─► Inventory: ingredients deducted automatically on completion
        ├─► Reporting: operational sales captured
        │
        ▼
  Existing registered POS issues the OFFICIAL invoice/receipt
        │
        ▼
  Cashier posts the official invoice number back into TNG → reconciled
```

**TNG owns:** operations, ordering, payment, kitchen workflow, reporting, inventory integration, reconciliation.
**The registered POS owns:** official invoice generation and official receipt issuance.

---

## MVP scope (included)

- QR scan → browse menu → cart → **pay online via Xendit** (GCash, Maya, QRPH, card).
- Webhook-confirmed payment releases the order to the kitchen/bar.
- Kitchen, bar, and cashier workflow screens.
- Automatic inventory deduction and operational sales reporting.
- Manual reconciliation: cashier posts the official invoice number from the registered POS.
- Dine-in (table-based) ordering.

## Explicitly out of scope

- **Official BIR invoice/receipt generation by TNG** — stays with the registered POS.
- **Automated POS synchronization** — deferred to Phase 7 (see below).
- Menu add-ons/sizes (modifiers), loyalty programs, customer accounts, delivery, tipping, split bills, discounts/promos.
- A native mobile app for customers — the first version runs in the phone's web browser.

---

## Future phase — Phase 7: POS Synchronization (deferred)

Later, we plan to **automatically push completed sales into the registered POS** so staff no longer re-enter them by hand, and to pull the official invoice number back automatically. This is intentionally **after** the first launch because automating official (fiscal) receipts carries compliance risk we want to get right, and because it depends on identifying the registered POS's integration method. Until then, the manual cashier step covers reconciliation safely.

---

## Next steps

**Architecture Validation Sprint** (short, before any building):
1. Owner + accountant confirm the BIR boundary and the overall approach.
2. Begin Xendit merchant account setup early (it has lead time).
3. **Firebase audit** — fully map the current data, permissions, and reusable services so nothing is assumed before build (Phase 0.5 in the master plan).
4. Resolve the open questions listed in the master plan (e.g., is kitchen-ticket printing needed at launch; dine-in only?).

Once validation passes, development proceeds per the phased roadmap in the master plan. Estimated to a pilot-ready first version with two developers working in parallel: **~5 weeks (optimistic) / ~7 weeks (realistic) / ~10 weeks (conservative)**.

---

# Slack Communication Package

> Copy-paste ready. One message per channel. Keep or trim as needed.

## `#general`

> **📣 New: QR Ordering is coming to TNG**
> Customers will soon scan a QR at their table, order and pay on their phone (GCash/Maya/QRPH/card via Xendit), and their paid order will go straight to the kitchen/bar. We're building this **inside TNG** (not a separate app) so it reuses our existing inventory, menu, and reporting. Important: **TNG will not issue official receipts** — our existing registered POS still does that, exactly as today. More detail in `#project-status` and `#decisions`.

## `#project-status`

> **TNG QR Ordering — approved, kicking off validation**
> Direction is approved. Target flow: scan QR → order → pay via Xendit → payment confirmed → kitchen/bar → inventory + reporting → registered POS issues the official receipt → cashier posts the invoice number back for reconciliation.
> **Now:** Architecture Validation Sprint — owner/accountant sign-off, start Xendit account setup, and a Firebase audit (Phase 0.5) before any code.
> **Estimate (2 devs in parallel):** ~5 wks optimistic / ~7 wks realistic / ~10 wks conservative.
> Full plan: `docs/QR_ORDERING_MASTER_PLAN.md`.

## `#requirements`

> **QR Ordering — MVP requirements (summary)**
> **In:** dine-in QR ordering; menu browse + cart; online payment via Xendit; webhook-confirmed payment releases to kitchen/bar; kitchen/bar/cashier screens; automatic inventory deduction; operational reporting; manual reconciliation (cashier posts the official invoice number).
> **Out (MVP):** TNG-issued BIR receipts (registered POS keeps that); automated POS sync (Phase 7); menu add-ons/sizes; loyalty; delivery; native app.
> **Open questions:** which registered POS is the official issuer? printer/kitchen-ticket printing at launch? dine-in only? session-expiry handling? VAT display on checkout? Details in the master plan (Section 3.2).

## `#decisions`

> **Decision: build QR Ordering inside TNG (not a separate app).**
> Why: the expensive foundations (inventory + auto stock deduction, menu/costing, roles, live updates, reporting) already exist — reusing them is faster, cheaper, and keeps one source of truth. A separate app would duplicate everything and force constant syncing.
> **Boundary:** TNG handles operations/ordering/payment/kitchen/reporting/inventory/reconciliation. The registered POS remains the official invoice + receipt issuer. TNG does **not** issue BIR receipts in MVP.
> **Deferred:** automated POS sync = Phase 7, after launch, due to compliance risk. Record: `docs/TNG_QR_ORDERING_DECISION_RECORD.md`.
