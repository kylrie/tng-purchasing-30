# QR Menu — Category Hierarchy Evaluation

**Status:** Evaluation only — no implementation.
**Scope:** Customer QR menu (`CustomerMenuView.tsx`) category navigation.
**Question:** Replace the current flat category pills with a two-level Food / Drinks hierarchy?

---

## 0. The data reality (why this matters)

The proposed hierarchy must be judged against the actual menu, not an imagined one. Mapping today's 16 mock items into the proposed Level‑2 subcategories:

| L1 | L2 (proposed) | Items today | Count |
|----|---------------|-------------|-------|
| Food | Appetizers | Lumpiang Shanghai, Calamares, Tokwa't Baboy | 3 |
| Food | Mains | Sisig, Lechon Kawali, Chicken Inasal, Pancit Canton, Kare‑Kare | 5 |
| Food | Desserts | Halo‑Halo, Leche Flan, Turon | 3 |
| Drinks | Soft Drinks | Iced Tea (House Blend) | **1** |
| Drinks | Fresh Juice | Fresh Buko Juice | **1** |
| Drinks | Cocktails | Classic Mojito, Mango Rum Daiquiri | 2 |
| Drinks | Beer | San Miguel Pale Pilsen | **1** |
| Drinks | Coffee | — | **0** |

**Key finding:** the split doubles the category count (5 → 8 subcategories + 2 group headers) while the drink side fragments into 1‑item and empty buckets. A navigation system that makes users tap into a "Coffee" tab with nothing in it, or a "Beer" tab with one item, is slower and more disappointing than the flat list it replaces. The hierarchy is designed for a menu that doesn't exist yet.

This single fact drives the recommendation more than any abstract UX principle.

---

## 1. UX comparison — flat vs hierarchical

### Current: flat (6 pills)
`All · Appetizers · Mains · Beverages · Cocktails · Desserts` in one horizontal scroll row.

**Strengths**
- One decision, one tap. Everything reachable from a single visible row.
- Zero empty states — every pill has items.
- Matches menu scale. 16 items across 5 groups is trivially scannable; a customer can thumb the whole grid in seconds.
- Cheap to render, nothing collapses/expands.

**Weaknesses**
- "Beverages" lumps soft drinks, juice, and beer together — mild ambiguity.
- Flat rows stop scaling somewhere around 8–10 pills (the row becomes a long swipe with no grouping cue).

### Proposed: two-level (Food / Drinks → subcategories)

**Strengths**
- Clear mental model at scale — Food vs Drinks is the split people already hold in their heads.
- Granular drink types (Coffee, Beer) become findable *once each holds several items*.
- Supports a larger menu (30+ items) without an unwieldy single pill row.

**Weaknesses (at current scale)**
- **Extra tap tax.** Reaching a Main goes from 1 tap to 2 (Food → Mains). For a menu this small, drill-down is pure friction.
- **Empty / thin subcategories.** Coffee (0), Beer (1), Soft Drinks (1), Fresh Juice (1). Four of five drink buckets are near-empty. Empty tabs read as "broken" to customers outdoors who won't investigate.
- **Loss of overview.** The flat grid lets you see Mains next to Desserts. A strict hierarchy hides siblings behind a group toggle.
- **Data-model change required.** `category: string` becomes group + subcategory (either a new `group` field or a category→group lookup). Not free, and out of scope until the nav is decided.

### Verdict of the comparison
Hierarchy is the right structure **for a bigger menu**. At 16 items — and especially with the drink data as sparse as it is — it adds taps and empty states without a payoff. The organizational benefit customers actually want (Food clearly separated from Drinks) can be delivered *without* forcing a drill-down.

---

## 2. Mobile wireframes (375px)

### A — Flat (current, for reference)
```
┌─────────────────────────────────┐
│ 🍴 TNG Main            🛒        │
│    Table 12                      │
├─────────────────────────────────┤
│ 🔍  Search the menu…             │
├─────────────────────────────────┤
│ [All] Appetizers Mains Bever…  → │  one scroll row
├─────────────────────────────────┤
│ ┌────────┐ ┌────────┐            │
│ │ [img]  │ │ [img]  │            │
│ │ Sisig  │ │ Lechon │            │
│ │ ₱285 ⊕ │ │ ₱420 ⊕ │            │
│ └────────┘ └────────┘            │
└─────────────────────────────────┘
```

### B1 — Two-tier pills (literal hierarchy)
```
├─────────────────────────────────┤
│  ┌────────┐  ┌────────┐          │  L1 segmented
│  │  Food  │  │ Drinks │          │
│  └────────┘  └────────┘          │
│ [All] Soft Juice Cocktails Beer… →│  L2 swaps per L1
├─────────────────────────────────┤
│  (Drinks selected → Coffee tab   │
│   shows an empty state)          │
```
> Exposes the empty-subcategory problem directly. Not recommended as-is.

### B2 — Airbnb-style group toggle + icon sub-row
```
├─────────────────────────────────┤
│   ● Food            ○ Drinks     │  coarse group toggle
├─────────────────────────────────┤
│   🥟        🍖        🍮         │  L2 icon scroll (Airbnb row)
│  Appet.    Mains    Desserts   → │
│  ▁▁▁▁▁                           │  active underline
├─────────────────────────────────┤
│ ┌────────┐ ┌────────┐            │
│ │ Lumpia │ │ Calama.│            │
│ └────────┘ └────────┘            │
```

### C — Recommended hybrid: grouped filter + jump chips + sticky sections
```
├─────────────────────────────────┤
│ [ All ][ Food ][ Drinks ]        │  coarse filter (sticky)
│ Appetizers Mains Desserts Soft…→ │  jump chips (scroll to section)
├─────────────────────────────────┤
│ ── Appetizers ─────────────────  │  sticky section header
│ ┌────────┐ ┌────────┐            │
│ │ Lumpia │ │ Calama.│            │
│ └────────┘ └────────┘            │
│ ── Mains ──────────────────────  │
│ ┌────────┐ ┌────────┐            │
│ │ Sisig  │ │ Lechon │            │
│ └────────┘ └────────┘            │
│ ── Desserts ───────────────────  │
│  …                               │
│ ── Drinks · Soft Drinks ───────  │
│  …                               │
└─────────────────────────────────┘
```
> `Food` / `Drinks` acts as a *filter*, not a drill-down. Sub-labels appear as sticky headers in the scroll and as jump chips. No empty tabs — a group with no items simply doesn't render a header. One-tap access preserved; grouping delivered.

---

## 3. Airbnb-inspired category navigation proposal

Airbnb's category bar is worth borrowing selectively, not literally. What it actually does:

1. **One horizontally-scrolling row** of icon + short label, always visible.
2. **A thin active underline** (not a filled pill) — quiet, high-contrast, survives sunlight.
3. **A separate coarse control** (Airbnb: the "Filters" button) that sits *beside* the row rather than nesting inside it.
4. **Content stays a single continuous scroll** — categories re-filter in place; they don't push you into a sub-page.

Translated to a two-level food menu (the **C** wireframe):

- **Coarse level = a light segmented filter** `All · Food · Drinks`, pinned with the search bar. This is the Airbnb "Filters" analogue: it narrows the field without a page change.
- **Fine level = the Airbnb scroll row** of subcategory chips (optionally with the clean line-icons already in the design), with an underline active state. Tapping a chip smooth-scrolls to that section rather than swapping the whole view.
- **Sticky section headers** (`Mains`, `Drinks · Cocktails`) give the hierarchy visual weight in the content itself — the customer *sees* the two-level structure while scrolling, without paying a tap for it.
- **Empty groups vanish** — no "Coffee (0)" tab ever renders.

This keeps the premium, outdoor-legible feel of the current light theme, reads as "organized menu," and scales cleanly to a 40-item menu later by simply having more sections — the interaction never changes.

---

## 4. Recommendation

**Do not adopt a strict two-level drill-down now. Adopt the grouped-hybrid (wireframe C) instead.**

Rationale:
1. **The drink data can't support it.** Four of five proposed Drinks subcategories hold 0–1 items. Drill-down would ship empty tabs on day one.
2. **The menu is too small to earn a second tap.** At 16 items, flat-with-grouping is faster than hierarchy for every task.
3. **The hybrid delivers the real goal** — Food clearly separated from Drinks, granular labels visible — with zero tap tax and no empty states.
4. **It's a smaller change.** Add a `group` mapping (Food/Drinks) and render sticky section headers + a 3-way filter. No per-view swapping, no empty-state design work.

### Phased path
- **Now:** Implement wireframe **C** — `All / Food / Drinks` segmented filter + sticky grouped sections + jump chips. Keep every category one tap away.
- **Keep the taxonomy ready:** Introduce the finer drink labels (Soft Drinks, Fresh Juice, Beer, Coffee, Cocktails) as *sub-section headers* now, so the data gets tagged correctly even though navigation stays flat-grouped.
- **Promote to full two-level drill-down later, when a threshold is crossed** — suggested trigger: **>6 items in a group's subcategories on average, or >30 total items, or ≥3 items in at least 4 drink subcategories.** At that point B2 (Airbnb toggle + icon sub-row) becomes worth the tap.

### Data-model note (for whenever implementation is greenlit)
Whichever direction: `PublicMenuItem.category` (flat string) needs to become **group + subcategory**. Cleanest options:
- Add `group: 'Food' | 'Drinks'` alongside the existing `category` (now the subcategory), **or**
- Keep `category` and derive `group` from a `CATEGORY_GROUP` lookup map.
The lookup-map approach is less invasive and reversible — preferred for the hybrid.

---

*Companion docs: `QR_UI_GUIDE.md` (§2.1 category pills), `QR_SCREEN_SPEC.md` (§1 menu).*
