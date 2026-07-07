# QR Ordering — Order Release Service

> **Status:** Implemented as **dormant** infrastructure (Sprint 2). No Xendit, no webhook, no trigger, no deployment. Nothing invokes it yet — it exists so the future Xendit webhook can release paid orders safely with zero new design work.
> **Date:** 2026-07-03
> **Related:** [`QR_XENDIT_IMPLEMENTATION_PLAN.md`](QR_XENDIT_IMPLEMENTATION_PLAN.md) §2 (webhook flow) · [`QR_ORDERING_MASTER_PLAN.md`](QR_ORDERING_MASTER_PLAN.md) §6.4 / A3 / §7.4.

---

## 1. What "release" means

A QR order is created at `AWAITING_PAYMENT` / `UNPAID` and is **not** work for the kitchen or bar. **Release** is the moment a *paid* order becomes fulfillment work. Per Master Plan A3, the kitchen/bar release **only** on confirmed payment — never on a browser redirect.

This service is the single, server-side chokepoint that performs that release, so the release rule lives in exactly one tested place instead of being reinvented inside the webhook.

## 2. Why it's separate from "mark paid"

Marking an order `PAID` (the payment fact) and **releasing** it (the fulfillment fact) are kept distinct so that:

- **Exactly-once fulfillment.** `released: true` is a one-way, idempotent guard. Xendit retries webhooks ~6× and can deliver duplicates/out-of-order; releasing an already-released order is a safe no-op, so a kitchen ticket is created exactly once (Master Plan §7.4).
- **Auditability.** The release records *what* authorized it and *when* — independent of the raw payment record.
- **Future flexibility.** A paid order could later be held (fraud check, stock hold) before release without changing the payment model.

## 3. Files

| File | Role |
|---|---|
| `functions/src/qr/releaseLogic.ts` | **Pure** decision + patch builder. No I/O, no firebase-admin (mirrors `orderLogic.ts`). |
| `functions/src/qr/releaseOrder.ts` | The **release service** — `releaseQrOrder(db, orderId, options)`, transactional. **Dormant: not exported from `index.ts`**, so it is not deployed as any function and nothing calls it yet. |
| `functions/src/qr/__tests__/releaseLogic.test.ts` | Pure-logic unit tests. |
| `functions/src/qr/__tests__/releaseOrder.test.ts` | Service integration tests (FakeFirestore). |
| `src/features/qr-ordering/types/qrOrder.types.ts` | `QrOrder` gains the release fields (declared, dormant). |

## 4. Release eligibility (pure)

`evaluateReleaseEligibility(order)` returns `{ eligible: true }` or `{ eligible: false, reason }`. An order is eligible iff **all** hold:

1. **Valid order** — it exists and has a recognizable shape (a `status` or `paymentStatus`). Otherwise `ORDER_NOT_FOUND` / `INVALID_ORDER`.
2. **PAID** — `paymentStatus === 'PAID'` (authoritative), falling back to `status === 'PAID'` when `paymentStatus` is absent. Otherwise `NOT_PAID`.
3. **Not already released** — `released !== true`. Otherwise `ALREADY_RELEASED`.

| Reason | Meaning |
|---|---|
| `ORDER_NOT_FOUND` | No such order. |
| `INVALID_ORDER` | Present but not a recognizable order. |
| `NOT_PAID` | Payment has not cleared — never released. |
| `ALREADY_RELEASED` | Released before — idempotent no-op. |

## 5. Release metadata + audit fields

Written server-side onto `qr_orders/{id}` by the service (all optional / dormant until release happens):

**Metadata**
- `released: boolean` — whether the order has been released.
- `releasedAt: Timestamp` — when (server timestamp).
- `releaseSource: 'XENDIT_WEBHOOK' | 'MANUAL' | 'SYSTEM'` — what authorized it.

**Audit**
- `releasedBy?: string` — uid / system id that performed the release.
- `releaseEventId?: string` — authorizing event id (e.g. the Xendit `payment_id`) — dormant now; lets a release be traced back to the exact payment event.

The patch **does not change `status`** — the kitchen/bar boards already surface PAID orders, and this task must not modify that UI. Release adds metadata + audit only.

## 6. Service contract

```
releaseQrOrder(db, orderId, { source, releasedBy?, releaseEventId? })
  → { released: true, orderId }
  | { released: false, orderId, reason }
```

- Reads the order and applies the patch **atomically in one transaction**, so two concurrent callers cannot both release (the loser sees `released: true` on retry and no-ops).
- **Never throws** for a normal ineligible outcome — returns `{ released: false, reason }` so the caller (webhook) can log and still acknowledge idempotently.

## 7. Security posture

- **Server-only / no attack surface.** Not a callable or HTTP function; not exported from `index.ts`; not deployed. Only server code (the future webhook handler) can import and call it. Clients cannot reach it.
- **Clients cannot self-release.** `qr_orders` is `write: if false` in `firestore.rules`; `released` and the audit fields are only writable via the Admin SDK. No rules change needed.
- **PAID-gated.** An unpaid order can never be released, so nothing reaches the kitchen without cleared payment.
- **Idempotent / one-way.** Prevents duplicate fulfillment even under webhook retries/races.
- **Caller-supplied audit only.** `source` / `releasedBy` / `releaseEventId` are set by the trusting server caller, never by client input.

## 8. How the future Xendit webhook will use it (not built here)

Inside `xenditWebhook` (Phase 3), **after** verifying the `x-callback-token`, matching the order by `reference_id`, and asserting `status == SUCCEEDED && amount == total && currency == PHP`, and setting the payment fields to PAID:

```
await releaseQrOrder(qrDb, orderId, {
  source: 'XENDIT_WEBHOOK',
  releaseEventId: paymentId,   // Xendit payment_id
});
```

The one-way `released` guard, combined with the `xendit_events` idempotency ledger, gives exactly-once release. See the Xendit plan §2/§5.

## 9. Dormancy checklist (this task)

- ✅ Release logic + service implemented and unit/integration tested.
- ✅ `released`/audit fields declared on the order type.
- ❌ Not exported from `index.ts` (not deployed, nothing calls it).
- ❌ No Xendit, no webhook, no callable, no trigger.
- ❌ Kitchen/bar UI untouched (still keys off `PAID`, unchanged).
- ❌ No inventory deduction, no POS sync, no deployment.

---

*Documentation for dormant infrastructure. Behavior stays inert until the payment layer (Xendit webhook) is built and wired to call `releaseQrOrder`.*
