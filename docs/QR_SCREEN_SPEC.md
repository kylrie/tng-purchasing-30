# QR Ordering — Screen Specifications

> **Screen-by-screen functional spec + ASCII wireframes** for the QR Ordering module. Companion to [`QR_UI_GUIDE.md`](QR_UI_GUIDE.md) (visual language) and [`QR_ORDERING_MASTER_PLAN.md`](QR_ORDERING_MASTER_PLAN.md) (architecture, data model, phases). Documentation only — no code, no components.

| Field | Value |
|---|---|
| **Created** | 2026-07-02 |
| **Screens** | 8 (5 customer, 3 staff) |
| **Data source** | All customer data flows through Cloud Function callables (sanitized); staff screens use authenticated Firestore reads + `onSnapshot` |

**Theme key:** 🌑 = premium dark glass (customer, mirrors POS) · 🏢 = ERP slate inside `Layout` (staff)

---

## 1. Customer Menu 🌑

| # | Attribute | Spec |
|---|---|---|
| 1 | **Purpose** | Entry point after QR scan. Browse the menu for this business unit, see prices/availability, start adding items. |
| 2 | **User** | Dine-in customer on their own phone. **No login.** Session bound to table via signed QR token. |
| 3 | **Data required** | Resolved table (`qr_tables`: tableNumber, businessUnitId); sanitized menu via `getPublicMenu()` — name, category, `sellingPrice`, `imageUrl`, `isAvailable`, description. **Never** cost/margin/recipe. Cart count (client state). |
| 4 | **Actions** | Browse/scroll; filter by category; search; tap item → Product Details; quick-add (+) to cart; open cart drawer. |
| 5 | **Components reused** | POS `ProductGrid` pattern (2-col card grid, category badge, stock pill, out-of-stock overlay); POS category pill tabs; POS search bar; cart badge button. |
| 6 | **Mobile layout** | Sticky header (table # + cart badge) → search → horizontal category strip → 2-col card grid → floating cart bar when cart > 0. |
| 7 | **Tablet layout** | Same structure, grid expands `grid-cols-3 lg:grid-cols-4`; category strip fits without scroll. |
| 8 | **Empty state** | Category with no items: centered `UtensilsCrossed` icon + "Nothing in this category yet." Whole menu empty: "Menu is being updated — please ask our staff." |
| 9 | **Error state** | Invalid/expired QR token: full-screen card "This QR code isn't active. Please ask staff for help." (no retry loop). Network fail: inline banner + Retry button. |
| 10 | **Loading state** | Skeleton cards (pulsing glass rectangles, 6-up) while `getPublicMenu()` resolves; spinner only on token resolution. |

```
┌─────────────────────────────┐
│ 🍽 TNG · Table 12      🛒(2)│  ← sticky header + cart badge
├─────────────────────────────┤
│ 🔍 Search menu…             │
├─────────────────────────────┤
│ (ALL)(MAINS)(DRINKS)(DESSE→ │  ← scrollable category pills
├─────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ │
│ │  [image]  │ │  [image]  │ │
│ │ Sisig     │ │ Iced Tea  │ │
│ │ MAINS     │ │ DRINKS    │ │
│ │ ₱285  (+) │ │ ₱95   (+) │ │
│ └───────────┘ └───────────┘ │
│ ┌───────────┐ ┌───────────┐ │
│ │  [image]  │ │ ▓SOLD OUT▓│ │
│ │ Lechon KW │ │ Halo-Halo │ │
│ │ ₱420  (+) │ │ ₱150      │ │
│ └───────────┘ └───────────┘ │
├─────────────────────────────┤
│ ▶ View Cart · 2 items · ₱380│  ← floating cart bar
└─────────────────────────────┘
```

---

## 2. Product Details 🌑

| # | Attribute | Spec |
|---|---|---|
| 1 | **Purpose** | Show one item in full (image, description, price) and let the customer choose quantity + notes before adding. |
| 2 | **User** | Customer (no login). |
| 3 | **Data required** | Single sanitized menu item (name, description, price, image, category, `isAvailable`); current cart qty for this item. |
| 4 | **Actions** | Adjust quantity (− / +); optional free-text note ("no onions", char-limited); Add to Cart; back/close. |
| 5 | **Components reused** | Bottom-sheet modal pattern (`items-end sm:items-center`); qty stepper from `CartPane` (`bg-black/40 rounded-xl`); primary CTA button; glass card. |
| 6 | **Mobile layout** | Bottom sheet sliding over the menu (~85% height): image top, name/price, description, qty stepper, note field, full-width Add CTA pinned bottom. |
| 7 | **Tablet layout** | Centered modal `max-w-[500px]`; image left / details right in a 2-col arrangement if landscape. |
| 8 | **Empty state** | n/a (always has an item) — missing image falls back to category icon placeholder. |
| 9 | **Error state** | Item became unavailable since menu load: disable CTA, show `bg-red-500/90` "Just sold out" pill; note field over limit → `text-xs text-red-400` counter. |
| 10 | **Loading state** | Instant open from cached menu data; image lazy-loads with blurred placeholder. |

```
┌─────────────────────────────┐
│            ────             │  ← drag handle
│ ┌─────────────────────────┐ │
│ │        [ image ]        │ │
│ └─────────────────────────┘ │
│ Sisig                 ₱285  │
│ MAINS                       │
│ Sizzling pork, egg, chili…  │
│                             │
│ Notes (optional)            │
│ ┌─────────────────────────┐ │
│ │ no onions please        │ │
│ └─────────────────────────┘ │
│                             │
│   ┌───┐   2   ┌───┐         │
│   │ − │       │ + │         │
│   └───┘       └───┘         │
├─────────────────────────────┤
│ [   Add to Cart · ₱570    ] │  ← pinned CTA
└─────────────────────────────┘
```

---

## 3. Cart 🌑

| # | Attribute | Spec |
|---|---|---|
| 1 | **Purpose** | Review the full order, adjust quantities, see the server-authoritative total, proceed to payment. |
| 2 | **User** | Customer (no login). |
| 3 | **Data required** | Cart lines (client state: itemId, name, qty, unitPrice, note); computed subtotal/total (display only — server recomputes at submit); table #. |
| 4 | **Actions** | Change qty (− / +); remove line (`Trash2`); clear cart; edit note (reopens Product Details); "Proceed to Pay" → creates order server-side (`createQrOrder()`) then Checkout. |
| 5 | **Components reused** | `CartPane` structure (header icon badge, item rows `bg-white/[0.02] rounded-[1.25rem]`, qty stepper, totals footer, sweep-hover CTA); bottom-sheet drawer. |
| 6 | **Mobile layout** | Bottom sheet `rounded-t-[2rem]`: header → scrollable line items → pinned footer (subtotal, total gradient text, CTA). |
| 7 | **Tablet layout** | Right-side panel `md:w-[400px]` (exactly like POS `CartPane`) beside the menu grid. |
| 8 | **Empty state** | Centered `ShoppingCart` icon (48px, 50% opacity) + "Your cart is empty" + "Browse menu" link; CTA hidden. |
| 9 | **Error state** | Stock check fails at submit (item just sold out): highlight offending line `bg-red-500/10`, message "Halo-Halo is no longer available — remove it to continue." Network fail on submit: banner + retry (idempotent). |
| 10 | **Loading state** | CTA becomes spinner + "Placing order…" (disabled) during `createQrOrder()`; lines stay visible. |

```
┌─────────────────────────────┐
│ 🛒 Your Order — Table 12  ✕ │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Sisig            ₱570   │ │
│ │ "no onions"             │ │
│ │ [−] 2 [+]           🗑  │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Iced Tea         ₱95    │ │
│ │ [−] 1 [+]           🗑  │ │
│ └─────────────────────────┘ │
│                             │
├─────────────────────────────┤
│ Subtotal            ₱665    │
│ TOTAL               ₱665    │  ← gradient bold
│ [    Proceed to Pay ▸    ]  │
└─────────────────────────────┘
```

---

## 4. Checkout 🌑

| # | Attribute | Spec |
|---|---|---|
| 1 | **Purpose** | Confirm the total and hand off to Xendit hosted checkout. TNG never collects card/e-wallet credentials itself. |
| 2 | **User** | Customer (no login). Order already exists server-side as `AWAITING_PAYMENT`. |
| 3 | **Data required** | Order (orderNumber, total, currency PHP); Xendit `payment_link_url` from `createXenditSession()`; available channels (GCash/Maya/QRPH/Card). |
| 4 | **Actions** | (Optional) pre-select channel; **Pay Now** → redirect to Xendit; cancel → back to cart (order voidable while unpaid). |
| 5 | **Components reused** | `CheckoutModal` pattern — big total card (`bg-black/40 rounded-[2rem]`, `text-6xl font-black` gradient amount), payment-method cards (active: `bg-indigo-500/10 border-indigo-500/50 scale-[1.02]`), sweep-hover CTA. |
| 6 | **Mobile layout** | Full-screen: order # → total card → 2×2 channel grid → Pay Now CTA pinned bottom → "Payments processed securely by Xendit" microcopy. |
| 7 | **Tablet layout** | Centered card `max-w-[500px]`; channels as 4-col row. |
| 8 | **Empty state** | n/a — screen unreachable without an order. |
| 9 | **Error state** | Session creation fails: card "Couldn't start payment — try again" + retry (new idempotency key). Session expired (30 min): "Payment window expired" + "Try again" (fresh session). |
| 10 | **Loading state** | Pay Now → spinner + "Opening secure payment…" until redirect; whole card `opacity-50` disabled. |

```
┌─────────────────────────────┐
│ ✕            CHECKOUT       │
│ Order #QR-0042 · Table 12   │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │       TOTAL DUE         │ │
│ │       ₱  665            │ │  ← text-6xl gradient
│ └─────────────────────────┘ │
│                             │
│ ┌──────────┐ ┌──────────┐   │
│ │  GCash   │ │   Maya   │   │
│ └──────────┘ └──────────┘   │
│ ┌──────────┐ ┌──────────┐   │
│ │   QRPH   │ │   Card   │   │
│ └──────────┘ └──────────┘   │
│                             │
│ [       Pay Now ▸        ]  │
│ 🔒 Secured by Xendit        │
└─────────────────────────────┘
```

---

## 5. Order Status 🌑

| # | Attribute | Spec |
|---|---|---|
| 1 | **Purpose** | Live view of the order after payment: confirm payment landed (webhook), then track kitchen progress to Served. |
| 2 | **User** | Customer (no login); access scoped to their own order (order token held client-side). |
| 3 | **Data required** | Own `qr_orders` doc via `subscribeToDocument`: orderNumber, table, items summary, `status`, `paymentStatus`, `paidAt`. |
| 4 | **Actions** | Watch (primary); "Order more" → back to menu (same table session); help hint ("ask staff"). No self-cancel post-payment in MVP. |
| 5 | **Components reused** | Status-badge palette (UI guide §1); `animate-pulse-slow` for current step; glass cards; `CheckCircle2`/`Clock`/`ChefHat` icons; real-time `onSnapshot`. |
| 6 | **Mobile layout** | Header card (order # + big status badge) → vertical stepper → collapsed items summary → "Order more" button. |
| 7 | **Tablet layout** | Two columns: stepper left, items summary right. |
| 8 | **Empty state** | n/a — reached only with an order; unknown order token → friendly "We can't find this order" card. |
| 9 | **Error state** | Payment failed/expired: red step + "Payment didn't go through" + **Try payment again** (new session). Listener drop: "Reconnecting…" banner, auto-resubscribe. |
| 10 | **Loading state** | **"Confirming payment…"** pulsing state between redirect-back and webhook confirmation (critical for QRPH/e-wallet async settle — never show success from redirect alone). |

```
┌─────────────────────────────┐
│ Order #QR-0042 · Table 12   │
│        ● IN KITCHEN         │  ← big status badge
├─────────────────────────────┤
│  ✔ Payment confirmed 7:41p  │
│  ✔ Order received           │
│  ◉ Preparing your food…     │  ← pulsing
│  ○ Ready                    │
│  ○ Served                   │
├─────────────────────────────┤
│ ▸ 2× Sisig, 1× Iced Tea     │
│                      ₱665   │
├─────────────────────────────┤
│ [      Order More +      ]  │
└─────────────────────────────┘
```

---

## 6. Kitchen Queue 🏢

| # | Attribute | Spec |
|---|---|---|
| 1 | **Purpose** | Live queue of paid food orders for kitchen staff: see what to cook, in what order, and advance status. |
| 2 | **User** | Kitchen staff (authenticated, role-gated via existing permission matrix). Wall tablet or terminal, inside `Layout`. |
| 3 | **Data required** | `subscribeToCollection('qr_orders', [status in PAID, IN_KITCHEN, READY], BU-scoped)`; per order: order #, table, items+qty+notes (food categories), `paidAt` (for elapsed timer). |
| 4 | **Actions** | **Start** (PAID→IN_KITCHEN); **Mark Ready** (→READY); **Served** (→SERVED, or cashier does it); item-level checkoff (optional); sound/flash on new order. |
| 5 | **Components reused** | `Layout` shell; `Card`; status badges; elapsed-time `Clock` (amber→red thresholds, `animate-pulse-slow`); empty-state pattern (`ChefHat`); purple primary buttons. |
| 6 | **Mobile layout** | Single scrollable column, newest paid at top; action buttons full-width per card. |
| 7 | **Tablet layout** | 3 lanes `md:grid-cols-3`: **NEW / PREPARING / READY**; cards move lanes as status advances. |
| 8 | **Empty state** | Centered `ChefHat` (48px, 50% opacity) + "No active orders — new paid orders appear here automatically." |
| 9 | **Error state** | Status-update write fails: card shakes (`animate-shake`) + toast "Couldn't update — retry"; listener drop: header banner "Reconnecting…" (queue stays visible, stale-marked). |
| 10 | **Loading state** | Purple spinner + "Loading queue…" on first subscribe only; after that, real-time (no refresh spinners). |

```
┌──────────────────────────────────────────────────────────┐
│ TNG · Kitchen Queue                    [BU: Main] [🔔][☾] │
├──────────────────┬──────────────────┬────────────────────┤
│ NEW (2)          │ PREPARING (1)    │ READY (1)          │
│ ┌──────────────┐ │ ┌──────────────┐ │ ┌──────────────┐   │
│ │ #QR-0042 T12 │ │ │ #QR-0040 T05 │ │ │ #QR-0039 T02 │   │
│ │ ⏱ 0:45       │ │ │ ⏱ 6:12 ⚠     │ │ │ ⏱ 1:03       │   │
│ │ 2× Sisig     │ │ │ 1× Lechon KW │ │ │ 3× Pancit    │   │
│ │  "no onions" │ │ │ 1× Rice      │ │ │              │   │
│ │ [  START  ]  │ │ │ [MARK READY] │ │ │ [  SERVED  ] │   │
│ └──────────────┘ │ └──────────────┘ │ └──────────────┘   │
│ ┌──────────────┐ │                  │                    │
│ │ #QR-0043 T07 │ │                  │                    │
│ │ …            │ │                  │                    │
└──────────────────┴──────────────────┴────────────────────┘
```

---

## 7. Bar Queue 🏢

| # | Attribute | Spec |
|---|---|---|
| 1 | **Purpose** | Same as Kitchen Queue but filtered to drink items (Beverages/Cocktails categories), so the bar works its own line. |
| 2 | **User** | Bar staff (authenticated, role-gated). |
| 3 | **Data required** | Same subscription as kitchen, **filtered client-side to drink-category lines**; orders with both food+drinks appear in both queues showing only their own lines (with a "🍽 +food in kitchen" hint). |
| 4 | **Actions** | Start / Mark Ready per order's drink lines; same lane flow. An order is customer-READY only when *both* queues finish (status logic per master plan; UI shows "waiting on kitchen" tag when bar is done first). |
| 5 | **Components reused** | Identical to Kitchen Queue (same component set, different filter + accent — use amber "Bar" department badge from Inventory pattern). |
| 6 | **Mobile layout** | Single column, same as kitchen. |
| 7 | **Tablet layout** | Same 3-lane kanban; header labeled **Bar Queue** with amber badge. |
| 8 | **Empty state** | `Wine`/`CupSoda` icon + "No drink orders right now." |
| 9 | **Error state** | Same as Kitchen Queue. |
| 10 | **Loading state** | Same as Kitchen Queue. |

```
┌──────────────────────────────────────────────────────────┐
│ TNG · Bar Queue  [BAR]                 [BU: Main] [🔔][☾] │
├──────────────────┬──────────────────┬────────────────────┤
│ NEW (1)          │ PREPARING (1)    │ READY (0)          │
│ ┌──────────────┐ │ ┌──────────────┐ │                    │
│ │ #QR-0042 T12 │ │ │ #QR-0041 T09 │ │    (empty lane)    │
│ │ ⏱ 0:45       │ │ │ ⏱ 2:30       │ │                    │
│ │ 1× Iced Tea  │ │ │ 2× Mojito    │ │                    │
│ │ 🍽 +food in   │ │ │ [MARK READY] │ │                    │
│ │   kitchen    │ │ └──────────────┘ │                    │
│ │ [  START  ]  │ │                  │                    │
│ └──────────────┘ │                  │                    │
└──────────────────┴──────────────────┴────────────────────┘
```

---

## 8. Cashier Reconciliation 🏢

| # | Attribute | Spec |
|---|---|---|
| 1 | **Purpose** | Match every paid QR order to the official BIR receipt issued by the registered POS: cashier posts `officialInvoiceNumber` back into TNG. The day cannot close with unreconciled paid orders. |
| 2 | **User** | Cashier / manager (authenticated, role-gated; posting is audit-stamped who/when). |
| 3 | **Data required** | `qr_orders` where `paymentStatus == PAID` (BU + date scoped): order #, table, total, channel badge, `xenditPaymentId`, status, `officialInvoiceNumber` (nullable), refund fields; KPI aggregates (paid today, unreconciled count, refunded). |
| 4 | **Actions** | Enter/edit official invoice # (inline edit or small modal — audit-stamped); filter chips (All / Unreconciled / Refunded); search by order #/table; mark Served/Completed if kitchen didn't; view payment detail; **day-close blocked banner** while unreconciled > 0. Refund initiation is manager-gated (separate approval, per anti-theft controls). |
| 5 | **Components reused** | `Layout`; `DashboardCard` KPI strip (progress ring on reconciliation %); Inventory table pattern (`rounded-xl`, hover rows, `overflow-x-auto`); inline-edit cell (`border-cyan-500`, Enter=save/Esc=cancel); pill filter tabs; status badges; bulk-bar pattern for the day-close banner. |
| 6 | **Mobile layout** | KPI cards 2×2 → filter chips → table with horizontal scroll (Order #, Total, Status, Invoice # kept leftmost). |
| 7 | **Tablet layout** | KPI 4-across → full table; inline edit directly in the Invoice # column. |
| 8 | **Empty state** | All reconciled: green `CheckCircle2` + "All paid orders reconciled 🎉" (banner turns green, day-close unblocked). No orders today: `Receipt` icon + "No QR sales yet today." |
| 9 | **Error state** | Save fails: cell reverts + red toast "Couldn't save — retry"; duplicate invoice # warning (`text-amber-400`, confirm to override, logged); listener drop: "Reconnecting…" banner. |
| 10 | **Loading state** | Skeleton rows (5) + pulsing KPI cards on first load; inline save shows tiny spinner in-cell. |

```
┌───────────────────────────────────────────────────────────────┐
│ TNG · Cashier Reconciliation           [BU: Main] [🔔][☾]     │
├───────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│ │Paid ₱12k│ │Unrecon 3│ │Refund 1 │ │ ◔ 78%   │  ← KPI cards  │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│ ⚠ 3 paid orders unreconciled — day-close blocked              │
├───────────────────────────────────────────────────────────────┤
│ (ALL) (UNRECONCILED) (REFUNDED)        🔍 order # / table     │
├───────────────────────────────────────────────────────────────┤
│ Order#   Table  Total   Pay     Xendit ID   Status   Invoice# │
│ QR-0042  T12    ₱665   [GCash]  py-a1b2…   SERVED   [______ ] │← amber row
│ QR-0041  T09    ₱780   [QRPH ]  py-c3d4…   SERVED   OR-10231  │
│ QR-0040  T05    ₱420   [Card ]  py-e5f6…   COMPLETE OR-10230  │
│ QR-0039  T02    ₱310   [Maya ]  py-g7h8…   REFUNDED    —      │
└───────────────────────────────────────────────────────────────┘
```

---

## Cross-screen notes

- **Totals are server-computed everywhere** — customer screens display, never calculate authoritatively (anti-tamper).
- **Payment truth = webhook.** No customer screen ever claims "paid" from a redirect; only the `paymentStatus` field flipped by the Xendit webhook (master plan A3).
- **Real-time via existing `onSnapshot` wrappers** (`firestore.service.ts`) — status, kitchen, bar, and reconciliation all live-update; no polling, no manual refresh.
- **All customer data is sanitized** through callables; staff screens are role-gated through the existing permission matrix.
- **Hit targets ≥ 44px**, status = icon + text (not color alone), safe-area insets respected.

*Spec only — no code, components, or source files were created or modified.*
