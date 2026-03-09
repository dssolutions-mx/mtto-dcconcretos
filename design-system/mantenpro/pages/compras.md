# Compras Page Overrides

> **PROJECT:** MantenPro
> **Page Type:** B2B Procurement Dashboard (Mobile-First)

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Mobile-first:** Content order: PO list → filters → collapsible info (user capabilities, accounts payable).
- **Primary focus:** Purchase order cards above the fold; reduce vertical stacking.
- **FAB:** Single primary action "Nueva Orden" as floating action button; secondary actions in overflow or collapsible sheet.
- **Max width:** Standard dashboard (no special constraint).

### Spacing Overrides

- **Mobile padding:** `p-4` (16px) for shell; `p-4` for cards.
- **Card gaps:** `space-y-5` (20px) between PO cards for breathing room.
- **Touch gaps:** `gap-2` (8px) minimum between adjacent touch targets.

### Typography Overrides

- **Input size:** 16px minimum to prevent iOS zoom on focus.
- **Amount:** `text-lg font-semibold` for prominence on cards.

### Color Overrides

- **Primary CTA:** `sky-700` (#0369A1) for FAB and primary buttons.
- **Status badges:** Semantic colors — yellow (pending), green (approved), blue (in progress), purple (total), orange (urgent/overdue).
- **Trust & Authority:** Badges with `bg-slate-100`, `bg-blue-50` for credentials; no playful colors.

### Component Overrides

- **Loading:** Use `Skeleton` for list/cards; no spinner for content.
- **Filters:** Sheet (not inline) for mobile; `inputmode="search"` for search.
- **Pull-to-refresh:** Consider `overscroll-behavior: contain` where accidental refresh is problematic.

### Touch & Accessibility

- **Touch targets:** `min-h-[44px] min-w-[44px]` for all tappable elements.
- **Viewport:** `min-h-dvh` or `min-h-screen`; avoid `100vh` on mobile.
- **Focus:** Visible focus ring on all interactive elements.

---

## Page-Specific Components

- `ComprasMobileInfoDrawer`: Sheet with user capabilities, accounts payable summary, enhanced PO info.
- `ComprasMobileHeader`: Compact header + FAB for mobile.

---

## Anti-Patterns (Compras-Specific)

- Avoid: 2x3 or 2x2 grid of filter tabs — use horizontal scroll instead.
- Avoid: Full user capabilities card expanded by default on mobile.
- Avoid: Long currency strings without truncation (`$999,999,999.99` → abbreviate or ellipsis).
- Avoid: Right-aligned badges that break left-aligned flow (e.g. "Requiere Cotización: Sí").
