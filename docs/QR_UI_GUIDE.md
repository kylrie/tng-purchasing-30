# QR Ordering — UI Style Guide

> **Design-language reference** for the QR Ordering module. It **reuses the existing TNG design system** wherever possible so new screens feel native. Documentation only — no implementation. Class strings below are guidance drawn from existing code, not new components.

| Field | Value |
|---|---|
| **Created** | 2026-07-02 |
| **Basis** | Read-only review of `src/features/{menu,pos,dashboard,inventory}`, `src/shared/components`, `Layout.tsx`, `index.css` |
| **Companion docs** | [`QR_ORDERING_MASTER_PLAN.md`](QR_ORDERING_MASTER_PLAN.md) |

---

## 0. Two themes, two audiences

TNG already ships **two coexisting visual languages**. Use each where it fits:

| Theme | Where it lives today | Use in QR for |
|---|---|---|
| **Premium dark glass** (`#0a0a0f`/`#020203`, indigo→purple, heavy `backdrop-blur-3xl`) | POS `ProductGrid`, `CartPane`, `CheckoutModal` | **Customer-facing** screens: menu, cart, checkout, order status |
| **ERP slate** (purple/cyan on `slate-50`/`slate-900`, light+dark, `rounded-xl` tables) | `Layout` shell, Inventory, Menu Engineering, Dashboard | **Staff-facing** screens: kitchen/bar queue, cashier reconciliation (they sit inside the ERP `Layout`) |

**Rule of thumb:** if a customer sees it on their phone → premium dark glass (mirror POS). If a staff member sees it inside the ERP → slate + `Layout` shell.

---

## 1. Design tokens (reuse as-is)

**Colors**
- Primary: `purple-500/600/700` · Accent: `cyan-400/500` · Base: `slate-50` (light) / `slate-900` (dark)
- Customer/transaction accent: `indigo-500/600` (matches POS)
- Semantic: success `green/emerald-500` · warning `amber/orange-500` · error `red-500` · info `blue-500`
- Signature gradient: `bg-gradient-to-r from-purple-500 to-cyan-500` (ERP) / `from-indigo-600 to-purple-600` (POS)

**Typography** — system font stack; labels `text-sm font-medium`; section heads `text-xs uppercase tracking-wide text-slate-500`; big totals `text-4xl–6xl font-black`; gradient text `bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400`.

**Shape & depth** — cards `rounded-xl` (or `rounded-[1.25rem]`/`[2rem]` for premium), inputs `rounded-lg`, pills `rounded-full`; glass `backdrop-blur-xl`/`3xl` + `border-white/[0.05]` (dark) or `border-slate-200 dark:border-slate-700`.

**Motion** — `transition-all duration-300 ease-out`; hover lift `-translate-y-1`/`scale-[1.03]`; press `scale-[0.98]`; disabled `opacity-50 cursor-not-allowed`.

**Icons** — `lucide-react`. Suggested QR set: `QrCode`, `UtensilsCrossed`, `ShoppingCart`, `Plus`/`Minus`, `Trash2`, `CreditCard`, `Wallet`, `Clock`, `ChefHat`, `CheckCircle2`, `Receipt`.

**Components to reuse** — `Card`, `Layout` (staff screens), `DashboardCard` (kitchen/cashier KPIs), status-badge pattern (`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`), modal shell (`fixed inset-0 bg-black/60 backdrop-blur-sm`), loading spinner (`border-t-purple-500 animate-spin`), empty-state (centered lucide icon + muted text).

**Status badge palette (reuse across QR order states)**
| State | Classes |
|---|---|
| Awaiting payment | `bg-amber-500/20 text-amber-400` |
| Paid / new | `bg-indigo-500/20 text-indigo-300` |
| In kitchen / in bar | `bg-blue-500/20 text-blue-400` |
| Ready | `bg-cyan-500/20 text-cyan-300` |
| Served / completed | `bg-emerald-500/20 text-emerald-400` |
| Cancelled / failed | `bg-red-500/20 text-red-400` |
| Refunded | `bg-slate-500/20 text-slate-300` |

---

## 2. Customer screens (premium dark glass — mirror POS)

### 2.1 Customer menu screen
Model on POS `ProductGrid.tsx`.
- **Shell:** full-screen `bg-[#0a0a0f]` with ambient blur orbs (`blur-[150px]` indigo/purple). Sticky top bar showing **table number** + cart button with item-count badge.
- **Product grid:** `grid grid-cols-2 lg:grid-cols-3 gap-4` (phones stay 2-up). Each item card: glass `bg-white/[0.03] border border-white/[0.05] rounded-[1.25rem]`, top gradient accent line, hover `-translate-y-1`.
  - Card content: optional image, **name** (`line-clamp-2`), **price** (bold), category badge + availability pill (reuse POS stock-pill; out-of-stock → dim + `bg-red-500/90` overlay, add-to-cart disabled).
  - Add button: circular `+` (`w-9 h-9 rounded-full bg-indigo-600`).
- **Sanitized data only** — never render cost/margin/recipe fields (per master plan security note).

### 2.2 Category navigation
Reuse the POS category-tab pattern.
- Horizontal scroll strip under the header: `flex gap-2 overflow-x-auto pb-2`.
- Tab: `px-5 py-2.5 rounded-full text-xs font-bold uppercase whitespace-nowrap`.
  - Active: `bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-purple-500/20`.
  - Inactive: `bg-white/[0.03] text-slate-400`.
- Optional sticky section headers as the list scrolls (categories = existing menu categories: Appetizers, Mains, Beverages, Cocktails…).

### 2.3 Cart drawer
Model on `CartPane.tsx`, but as a **bottom sheet on mobile** (`items-end sm:items-center`).
- **Container:** `bg-[#0a0a0f]/90 backdrop-blur-3xl border-t border-white/[0.05] rounded-t-[2rem]` (slide-up).
- **Header:** cart icon badge (`p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20`) + "Your Order" + "Clear".
- **Item rows:** `p-4 bg-white/[0.02] rounded-[1.25rem] border border-white/[0.05]`; row 1 = name / line subtotal; row 2 = qty stepper (`flex items-center bg-black/40 rounded-xl p-1`, `−`/`+` `w-8 h-8`) + `Trash2`.
- **Empty state:** centered `ShoppingCart` icon + "Your cart is empty".
- **Footer:** subtotal (regular) + **Total** (large gradient text) + full-width CTA `py-5 rounded-[1.5rem] bg-indigo-600` → "Proceed to Pay".

### 2.4 Checkout screen
Model on `CheckoutModal.tsx`.
- **Total display:** big card `bg-black/40 rounded-[2rem] py-8`, label "TOTAL DUE" + amount `text-6xl font-black` gradient, `₱` in `text-3xl text-indigo-400/50`.
- **Payment methods:** grid of channel cards (GCash / Maya / QRPH / Card) — reuse the 3-col payment-method selector; active card `bg-indigo-500/10 border-indigo-500/50 scale-[1.02]` + glow. (These map to Xendit hosted checkout; TNG's screen just launches it.)
- **CTA:** full-width `py-5` "Pay Now" with hover sweep; on tap → redirect to Xendit `payment_link_url`.
- **After redirect back:** show a neutral "thank you / order received" state — **not** a payment confirmation (payment is confirmed by webhook, per master plan A3).

### 2.5 Order status screen
New pattern; use premium glass + real-time (`onSnapshot` on the customer's own order).
- **Stepper** (vertical on mobile): `Awaiting payment → Paid → In kitchen → Ready → Served`. Completed steps `text-emerald-400` with `CheckCircle2`; current step pulses (`animate-pulse-slow`); future steps muted.
- **Header card:** order number (from `CounterService`), table number, big current-status badge (Section 1 palette).
- **Async payments (QRPH/e-wallet):** show a "Confirming payment…" state with spinner until the webhook flips it to Paid (never assume success from the redirect).
- **Live updates:** status changes arrive via `FirestoreService.subscribeToDocument` — no manual refresh.

---

## 3. Staff screens (ERP slate — inside `Layout`)

Wrap both in the existing `Layout` shell so they inherit sidebar, header, theme toggle, and business-unit selector.

### 3.1 Kitchen / bar queue screen
Optimize for glanceability on a wall-mounted tablet.
- **Layout:** column/kanban of order cards, `grid grid-cols-1 md:grid-cols-3 gap-4` (or lanes: New / Preparing / Ready). Live via `subscribeToCollection('qr_orders', …, [where('status','in',['PAID','IN_KITCHEN'])])`.
- **Order card:** `Card` glass, header = table # + order # + elapsed timer (`Clock`, turns amber then red past thresholds — reuse `animate-pulse-slow` for urgency). Body = item list with qty; bar filters to Beverages/Cocktails categories.
- **Actions:** big primary buttons `Start` → `Mark Ready` → `Served` (`bg-purple-500 hover:bg-purple-600 rounded-lg`); status badge top-right (Section 1).
- **Empty state:** centered `ChefHat` + "No active orders". Loading = purple spinner.
- **Mobile:** lanes collapse to a single scrollable column; toolbar wraps.

### 3.2 Cashier reconciliation screen
Model on Inventory table + form patterns.
- **KPI strip:** `DashboardCard`s — Paid today, Awaiting reconciliation, Refunded, Unreconciled count (with progress ring). Grid `grid-cols-2 md:grid-cols-4 gap-4`.
- **Table:** `bg-white dark:bg-slate-800/50 border rounded-xl overflow-hidden` → header `bg-slate-50 dark:bg-slate-800/80` → rows `hover:bg-slate-50 dark:hover:bg-slate-700/30`. Columns: Order # · Table · Total · Payment (channel badge) · `xenditPaymentId` · Status · **Official Invoice #** · Action.
- **Reconcile action:** inline-edit cell (reuse Inventory inline-edit: `border border-cyan-500`, Enter to save) **or** a small modal to enter `officialInvoiceNumber`; on save, audit-stamp who/when.
- **Highlight rows** needing action: paid-but-unreconciled → subtle `bg-amber-50 dark:bg-amber-500/10`. Filter chips: All / Unreconciled / Refunded (reuse pill tabs).
- **Guardrail (from anti-theft controls):** a persistent "N paid orders unreconciled" banner (`bg-purple-50 dark:bg-purple-500/20 border rounded-xl`) — day-close blocked until zero.
- **Mobile:** table gets `overflow-x-auto`; primary column (Order # + Total + status) stays visible.

---

## 4. Cross-screen conventions

- **Forms/modals:** `fixed inset-0 bg-black/60 backdrop-blur-sm` → `Card` container, header with icon + title + `X`, `space-y-6` body, footer Cancel/Confirm. Inputs `w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500`; errors `text-xs text-red-400`.
- **Loading:** `w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin`.
- **Empty states:** centered muted lucide icon (`size={48} opacity-50`) + one line.
- **Money:** always `₱`, server-computed (never client-editable) — matches anti-theft "server-authoritative pricing".
- **Accessibility:** hit targets ≥ 44px (steppers, add buttons); status conveyed by **icon + text**, not color alone; respect safe-area insets on phones.
- **Real-time everywhere:** customer status and staff queues use the existing `onSnapshot` wrappers; no polling.

---

## 5. Reuse checklist

| QR screen | Reuse from |
|---|---|
| Customer menu | POS `ProductGrid` (grid, cards, category tabs, stock pill) |
| Category nav | POS category-tab pattern (`rounded-full` pills, gradient active) |
| Cart drawer | POS `CartPane` (item rows, qty stepper, totals, CTA) |
| Checkout | POS `CheckoutModal` (big total, payment-method cards) |
| Order status | Premium glass + `subscribeToDocument` + status-badge palette |
| Kitchen/bar queue | `Layout` + `Card` + `subscribeToCollection` + urgency timer |
| Cashier reconciliation | `Layout` + Inventory table/inline-edit + `DashboardCard` KPIs + badges |

*Design guide only — no components were created. Implementation follows the master-plan phases and gates.*
