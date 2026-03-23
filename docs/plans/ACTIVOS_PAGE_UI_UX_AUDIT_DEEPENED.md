# Activos Page UI/UX Audit — Deepened Plan

> **Deepened on:** 2026-03-11  
> **Focus:** UX, user flow, context, decisions, mobile version, layout  
> **Primary file:** [app/activos/page.tsx](../app/activos/page.tsx)  
> **Child components:** [components/assets/assets-list.tsx](../components/assets/assets-list.tsx)

---

## Enhancement Summary

### Key Improvements Added
1. **User personas and context** — Who uses this page, in what situations, and what decisions they make
2. **User flow analysis** — End-to-end journeys from entry to exit, with decision points
3. **Mobile UX gap analysis** — Comparison with mobile-optimized modules (Compras, Work Orders, Modelos)
4. **Layout and view hierarchy** — What users see first and how attention flows
5. **Field technician context** — Industry patterns for maintenance apps and mobile-first workflows
6. **Better visuals and mobile best practices** — Card design, touch targets, CMMS patterns, design system alignment

### New Considerations Discovered
- Activos page lacks `useIsMobile()` and mobile-specific patterns used elsewhere in the app
- No Pull-to-refresh (unlike Dashboard) despite asset data being critical for field context
- Filter bar and Quick Actions may cause horizontal scroll or wrap awkwardly on narrow viewports
- Asset cards are not clickable as a whole; only inner buttons navigate — inconsistent with Dashboard module cards
- Two data fetches (dashboard API + maintenance per-asset) create waterfall; perceived load may be slow on mobile networks

---

## 1. User Personas and Context

### Primary Users

| Persona | Role | Context | Typical Goals |
|---------|------|---------|---------------|
| **Maintenance supervisor** | Admin/Jefe de mantenimiento | Office or desk; monitors fleet health | See total assets, critical alerts, drill into overdue/upcoming |
| **Technician** | Operador/Técnico | Field, possibly on mobile near equipment | Quick lookup: find asset by ID, check maintenance status, log work |
| **Manager** | Gerencia | Office; periodic oversight | High-level KPIs, report access, new asset creation |

### Usage Context (When/Where/How)

- **Desktop:** Supervisors reviewing status, creating assets, running reports. Often multi-tab, alongside calendar/preventive schedules.
- **Mobile:** Technicians in plant/field with gloves, bright light, one-handed use. Need fast access to asset details and maintenance actions.
- **Tablet:** Possible middle ground — supervisors walking the floor, technicians with tablet for documentation.

### Decision Points on This Page

1. **"Do I have critical issues?"** → Critical Alerts card (currently only clickable summary card)
2. **"Which asset do I need?"** → Search + filters → Asset list
3. **"What action for this asset?"** → Ver / Mantenimiento / Historial on each card
4. **"Where do I go next?"** → Quick Actions (Calendario, Modelos, Reportes, Preventivo)
5. **"Create new asset?"** → Nuevo Activo (role-gated)

### Information Hierarchy (What Matters First)

| Priority | Content | Current Placement |
|----------|---------|------------------|
| P0 | Critical alerts count | Summary card #4 |
| P1 | Total/operational/maintenance counts | Summary cards 1–3 |
| P2 | Find specific asset | Search + filters |
| P3 | Asset cards with status + actions | Grid below |
| P4 | Quick Actions | Between summary and list |
| P5 | Header CTAs (Reportes, Nuevo Activo) | Top right |

**Observation:** Quick Actions sit between summary and list. On mobile, this may push the asset list below the fold. Consider reordering or collapsing Quick Actions on small screens.

---

## 2. User Flow Analysis

### Flow A: "Check Critical Issues" (Urgent Path)

```
Land on /activos → See summary cards → Critical Alerts card (N > 0) → Click card
→ window.location = /incidentes (full reload, no SPA navigation)
```

**Issues:**
- Full page reload; loses SPA feel
- Should use `<Link>` for client-side navigation
- No visual affordance that the card is clickable beyond hover (mobile: no hover)

### Flow B: "Find Asset by Name/ID" (Lookup Path)

```
Land on /activos → Scroll to search → Type in search → (optional) apply filters
→ Scan asset grid → Tap "Ver" on target asset → /activos/[id]
```

**Issues:**
- Search is below 4 summary cards + Quick Actions on mobile — significant scroll before search
- Filter selects (140px fixed width) can force horizontal scroll on narrow screens
- No debounce on search (minor, but can cause jank on fast typing)

### Flow C: "Register Maintenance" (Action Path)

```
Land on /activos → Find asset (search/filter) → Tap Wrench icon → /activos/[id]/mantenimiento
```

**Issues:**
- Wrench icon has no `aria-label`; screen readers get no context
- Icon-only button is small; touch target may be < 44px

### Flow D: "Quick Navigation" (Navigation Path)

```
Land on /activos → See Quick Actions → Tap Calendario / Modelos / etc. → Navigate away
```

**Issues:**
- Quick Actions wrap; on very narrow screens layout can be messy
- No grouping (e.g. "Mantenimiento" vs "Reportes"); flat list may overwhelm
- Conditional visibility based on `ui.shouldShowInNavigation` — some users see fewer buttons; consider consistency

---

## 3. Mobile UX Gap Analysis

### Comparison with Mobile-Optimized Modules

| Feature | Dashboard | Work Orders | Compras | Modelos | **Activos** |
|---------|-----------|-------------|---------|---------|-------------|
| `useIsMobile()` | Yes | Yes | Yes | Yes | **No** |
| Mobile-specific layout | 2x2 grid, compact cards | Cards vs table | Drawer, mobile layout | Cards vs table | **Single responsive grid only** |
| Pull-to-refresh | Yes | Yes | — | — | **No** |
| Touch feedback (`active:scale-95`) | Yes | Yes | — | — | **No** |
| Touch targets 44px+ | Yes | Yes | Yes | Yes | **Unverified** |
| Padding adaptive (p-4 vs p-6) | Yes | Yes | — | — | **Uses DashboardShell p-4 md:p-8** |
| Header actions responsive | Yes | — | Yes | Dropdown on mobile | **No; buttons may overflow** |

### Activos-Specific Mobile Issues

1. **Summary cards on mobile**
   - Current: `md:grid-cols-2 lg:grid-cols-4` → 1 col < 768px, 2 cols 768–1024px, 4 cols 1024px+
   - On 375px: 4 cards stack vertically → long scroll before Quick Actions and search
   - **Recommendation:** 2x2 grid on mobile (`grid-cols-2`) like Dashboard; reduce card padding

2. **Header buttons**
   - Reportes + Nuevo Activo in a row; on 320–375px may overflow or wrap awkwardly
   - **Recommendation:** Collapse to dropdown or icon-only on mobile; full labels on desktop

3. **Quick Actions**
   - `flex-wrap gap-2` → can wrap into multiple rows
   - **Recommendation:** On mobile, consider horizontal scroll or dropdown "More actions"
   - Or move Quick Actions below asset list (technicians care more about assets first)

4. **Search and filters**
   - Search input full-width on mobile ✓
   - Filters: two `Select` at 140px each = 280px + gaps → may not fit 320px
   - **Recommendation:** Stack filters vertically on mobile; or use a single "Filtros" sheet/drawer

5. **Asset cards**
   - Grid: `md:grid-cols-2 lg:grid-cols-3` → 1 col on mobile
   - Card has 3 action buttons (Ver, Wrench, History) — need 44px touch targets
   - **Recommendation:** Audit button sizes; consider making card itself tappable to go to detail (like Dashboard module cards)

6. **No Pull-to-refresh**
   - Technicians may want to refresh asset list after sync; Dashboard and Work Orders support this
   - **Recommendation:** Wrap page content in `PullToRefresh` when `useIsMobile()` is true

---

## 4. Layout and View Hierarchy

### Current DOM Order (Top to Bottom)

1. DashboardHeader (title + Reportes, Nuevo Activo)
2. Summary cards (4)
3. Quick Actions (title + 4–6 buttons)
4. Error alert (if any)
5. AssetsList:
   - Search + filters card
   - Asset grid OR empty state

### Above-the-Fold on Common Viewports

| Viewport | Approx. above fold | What user sees |
|----------|--------------------|----------------|
| 375×667 (iPhone SE) | ~600px | Header + 2 summary cards + start of Quick Actions |
| 768×1024 (iPad) | ~900px | Header + all 4 cards + Quick Actions + start of search |
| 1440×900 (desktop) | ~800px | Header + all 4 cards + Quick Actions + search/filters |

**Observation:** On mobile, search is below the fold. Primary use case (find asset) requires scrolling first. Consider sticky search or reordering.

### Visual Weight and Attention

- **Highest weight:** Summary numbers (bold, large)
- **Second:** Critical Alerts (red) when N > 0
- **Third:** Asset cards (name, status, hours)
- **Lower:** Quick Actions, muted filter labels
- **Lowest:** "Equipos registrados", "del total" — supporting copy

### Recommendation: Mobile View Hierarchy

1. **Sticky or high:** Search bar (for "find asset" primary task)
2. **Compact summary:** 2x2 KPI cards (or collapsible)
3. **Primary content:** Asset list (cards)
4. **Secondary:** Quick Actions as footer or overflow menu
5. **Header:** Simplified; Reportes/Nuevo in overflow on small screens

---

## 5. Industry Patterns (Field Technicians / CMMS)

### Research Insights

From CMMS and maintenance app best practices:

- **Asset lookup at point of work:** QR scan or fast search; technicians need asset details in seconds
- **Offline capability:** Field areas may have poor connectivity; consider caching asset list
- **Voice-to-text:** Hands-free note logging (future enhancement)
- **Progressive disclosure:** Overview first (status), details on tap
- **Color-coded status:** Green/amber/red is standard and well understood ✓ (current implementation aligns)
- **Work order integration:** Link from asset to work orders/incidents — Critical Alerts card does this

### Mobile-First Checklist for Activos

- [ ] Minimum 44px touch targets for all interactive elements
- [ ] Search accessible without scrolling (sticky or top)
- [ ] Pull-to-refresh for asset list
- [ ] `useIsMobile()` for layout branching
- [ ] Summary cards: 2x2 on mobile to reduce scroll
- [ ] Header actions: collapse to dropdown or icon-only on narrow screens
- [ ] Quick Actions: consider horizontal scroll or "More" menu on mobile
- [ ] Asset card: whole card tappable to detail (consistent with Dashboard)
- [ ] `aria-label` on icon-only buttons (Ver, Wrench, History)
- [ ] `prefers-reduced-motion` for activos section

---

## 6. Original Audit Sections (Preserved)

### Typography
- Generic system fonts; design system specifies San Francisco (SF Pro, SF Mono) per Apple HIG.
- Recommendation: Load design system fonts or choose a distinctive pairing.

### Color and Theme
- Hardcoded `text-green-600`, `text-amber-600`, `text-red-600` in summary cards and AssetsList badges.
- Recommendation: Use semantic theme tokens (e.g. destructive, chart colors).

### Interaction and Cursor
- Critical Alerts: use `<Link>` instead of `window.location.href`.
- Icon-only buttons: add `aria-label` for Ver, Mantenimiento, Historial.
- Consider making asset cards fully clickable.

### Motion and Animation
- No entrance animation; add staggered reveals optional.
- Add `prefers-reduced-motion` scope for activos (extend beyond checklist/compras modules).

### Accessibility
- Search input: add `aria-label`.
- Loading state: use `aria-live="polite"` or skeletons.
- Verify focus states on all interactives.

### Loading States
- Replace "..." in summary cards with `Skeleton` components.
- Align AssetsList loading spinner with design system.

---

## 7. Implementation Priority (Updated)

### Phase 1: Quick Wins (High Impact, Low Effort)
1. Replace `window.location.href` with `<Link href="/incidentes">` for Critical Alerts card
2. Add `aria-label` to search input and icon-only buttons (Ver, Wrench, History)
3. Add `prefers-reduced-motion` scope for activos wrapper

### Phase 2: Mobile Parity
4. Integrate `useIsMobile()` in activos page and AssetsList
5. Summary cards: 2x2 grid on mobile (`grid-cols-2` when isMobile)
6. Wrap content in `PullToRefresh` when mobile
7. Touch targets: ensure 44px minimum for buttons (audit Button sizes)
8. Header: responsive actions (dropdown or icon-only on narrow)

### Phase 3: Layout and Flow
9. Reorder or collapse Quick Actions on mobile (e.g. overflow "Más acciones")
10. Sticky search bar on mobile OR move search above summary
11. Make asset cards fully clickable → navigate to `/activos/[id]`
12. Filters: vertical stack or sheet on mobile

### Phase 4: Polish
13. Theme tokens for status colors
14. Skeleton loading for summary cards
15. Optional: staggered entrance animation
16. Optional: align typography with design system

---

## 8. Mermaid: User Flow Diagram

```mermaid
flowchart TD
    subgraph Entry [Entry Points]
        A[Sidebar: Activos]
        B[Direct URL /activos]
        C[Dashboard module card]
    end
    
    subgraph Page [Activos Page]
        D[Header + CTAs]
        E[Summary Cards]
        F[Quick Actions]
        G[Search + Filters]
        H[Asset List]
    end
    
    subgraph Decisions [User Decisions]
        D1{Critical alerts?}
        D2{Find asset?}
        D3{Register work?}
        D4{Quick nav?}
    end
    
    subgraph Exits [Exit Points]
        X1[/incidentes]
        X2[/activos/id]
        X3[/activos/id/mantenimiento]
        X4[Calendario/Modelos/etc]
    end
    
    A --> D
    B --> D
    C --> D
    
    D --> E
    E --> D1
    D1 -->|Yes, click card| X1
    
    E --> F
    F --> D4
    D4 --> X4
    
    E --> G
    G --> H
    H --> D2
    D2 -->|Tap Ver| X2
    H --> D3
    D3 -->|Tap Wrench| X3
```

---

## 9. Better Visuals and Mobile Best Practices (Research Deepening)

### 9.1 Card Design Best Practices (Mobile Dashboards)

**One KPI per card** — Research (Spaceberry, Uitop) shows higher adoption when dashboards limit to 3–6 core KPIs. Current activos page has 4 summary cards; structure is good. Improve by:

- **Add visual hierarchy within each card:** Primary number prominent, supporting copy smaller and muted. Current `text-2xl` vs `text-xs` is correct; ensure icon doesn’t compete.
- **Color-coded status signals:** Green (Operativos), amber (Mantenimiento/Reparación), red (Alertas). Use semantic theme tokens, not hardcoded hex.
- **Subtle separators and padding:** Design system specifies `--space-md` (16px), `--shadow-md`. Verify card padding is breathable; on mobile reduce to `p-4` instead of `p-6`.
- **Iconography:** Keep icons small (h-4 w-4) and muted; they support the number, not compete with it. ✓ (current implementation aligns)

**Card types for asset list:**
- **Text-based cards** (current): Name, ID, department, hours, location, maintenance status. Ensure clear hierarchy: name + status = primary, details = secondary.
- **Mixed cards (future):** Optional thumbnail or equipment type icon for faster scanning.

**Reference pattern from WorkOrderCard:**
```
CardHeader: Title + Badge (status)
CardContent: Icon + label rows (Package, User, Calendar)
CardFooter: Full-width buttons (Ver, Editar, Completar) with icons + text
```

### 9.2 Mobile-Specific Visual Rules

| Rule | Source | Application to Activos |
|------|--------|-------------------------|
| **44×44px touch targets** | Apple HIG, WCAG | Audit all buttons; icon-only Wrench/History need min 44px tap area |
| **Thumb-reach zones** | Uitop | Primary actions (Ver, Critical Alerts) in lower half of screen on mobile |
| **One KPI per card + optional sparkline** | Spaceberry | Summary cards OK; could add mini trend (e.g. "↑ 2 vs last week") later |
| **Card consistency** | Uitop | Same font styles, colors, spacing across all asset cards |
| **Clear distinction between content types** | Uitop | Use `space-y-3` or borders to separate sections within cards |
| **Readable in bright light** | Spaceberry | Test contrast; avoid `text-muted-foreground` for critical info |
| **Color + not color alone** | WCAG | Status badges need icon or text, not just color (AlertTriangle ✓) |

### 9.3 CMMS Industry Patterns (Field Technicians)

- **Technician-first:** Mobile focused on execution; desktop on configuration. Activos list is execution-oriented; ensure search and filters are fast and visible.
- **Reduced friction:** Fewer clicks, cleaner layouts. Make whole asset card tappable to detail (one tap vs tap-Ver).
- **Overdue/alert visibility:** Open work orders and overdue tasks should be "easily spotable at a glance." Critical Alerts card and overdue badges in list ✓; ensure they’re above the fold on mobile.
- **Consistent icons and labels:** Same icon for "maintenance" everywhere; same label for "Operativo" vs "Operational." Spanish labels are consistent ✓.
- **Offline awareness:** Consider "última actualización" indicator for when data was last synced.

### 9.4 Navigation and Micro-Interactions

- **Contextual actions attached to data:** Filter, search, Ver/Mantenimiento/Historial on each card ✓. Keep them visible, not hidden in overflow.
- **Gentle elevation on hover/tap:** Use `hover:shadow-md`, `active:scale-[0.98]` (avoid `scale-95` if it shifts layout). Design system: "Avoid scale transforms that shift layout."
- **Slide-up panels for filters:** On mobile, consider filter drawer instead of inline selects to save horizontal space.
- **Back navigation preserves state:** When returning from /activos/[id], scroll position and filters should persist. Consider `sessionStorage` or URL params for filters.

### 9.5 Design System Alignment (MantenPro)

| Token | Value | Usage in Activos |
|-------|-------|------------------|
| `--color-primary` | #0F172A | Headings, primary buttons |
| `--color-cta` | #0369A1 | Nuevo Activo, primary CTAs |
| `--shadow-md` | 0 4px 6px rgba(0,0,0,0.1) | Cards on hover |
| `--shadow-lg` | 0 10px 15px | Modals, Critical Alerts when N>0 |
| Button padding | 12px 24px | Ensure CTA buttons meet this |
| Border radius | 8px (buttons), 12px (cards) | Align Card with design system |
| Transitions | 200ms ease | All hover/focus states |

**Anti-patterns to avoid (from MASTER):**
- No emojis as icons ✓
- cursor-pointer on all clickables — Critical Alerts ✓; asset cards need decision
- No layout-shifting hovers — use `transition-shadow` not `scale`
- Transitions 150–300ms ✓
- Visible focus states — verify `focus-visible:ring-2`

### 9.6 Visual Hierarchy Checklist (Activos Page)

- [ ] **Header:** Title largest; subtitle muted. Reportes/Nuevo secondary.
- [ ] **Summary cards:** Number = hero (text-2xl font-bold); label = supporting (text-sm); icon = accent (muted).
- [ ] **Quick Actions:** Tertiary; less prominent than summary and list.
- [ ] **Search:** High prominence — consider sticky on mobile.
- [ ] **Asset cards:** Name + status badge = primary; department, hours, location = secondary; alerts = accent (red/amber).
- [ ] **Action buttons:** Ver = primary (full style); Wrench, History = secondary (outline, smaller).
- [ ] **Empty state:** Icon + headline + CTA; calming, not alarming.

### 9.7 Concrete Visual Improvements (Prioritized)

1. **Summary cards mobile:** 2x2 grid, reduced padding (`p-4`), tighter `space-y-0` in CardHeader.
2. **Critical Alerts emphasis:** When N > 0, add subtle red border or background tint (`border-l-4 border-destructive`) to draw attention.
3. **Asset card touch:** Add `active:scale-[0.99]` for tactile feedback; ensure 44px for icon buttons.
4. **Filter bar mobile:** Stack vertically OR use "Filtros" sheet with checkboxes.
5. **Loading skeletons:** Replace "..." with Skeleton components matching card structure.
6. **Theme tokens:** Replace `text-green-600` etc. with `text-chart-2` or extend theme (e.g. `--status-success`, `--status-warning`, `--status-critical`).

---

## 10. References

### Internal
- [MOBILE_DASHBOARD_IMPROVEMENTS.md](../archive/root-md/MOBILE_DASHBOARD_IMPROVEMENTS.md) — Patterns used in main dashboard
- [WORK_ORDERS_MOBILE_OPTIMIZATION.md](../archive/root-md/WORK_ORDERS_MOBILE_OPTIMIZATION.md) — Cards vs table, PullToRefresh, WorkOrderCard
- [MODELOS_MOBILE_OPTIMIZATION_SUMMARY.md](../archive/root-md/MODELOS_MOBILE_OPTIMIZATION_SUMMARY.md) — Responsive cards, touch targets
- [design-system/mantenpro/MASTER.md](../../design-system/mantenpro/MASTER.md) — Typography, colors, anti-patterns

### External Research
- [Dashboard UI: 4 Best Practices for Mobile Clarity](https://spaceberry.studio/blog/dashboard-ui-four-best-practices-for-mobile-clarity/) — Spaceberry Studio
- [Mobile Dashboard UI Components: Best Practices](https://uitop.design/blog/design/mobile-dashboard-ui-components/) — Uitop
- [CMMS UI UX Design - Adoption & Reliability](https://www.aufaitux.com/blog/cmms-ui-ux-design/) — Aufait UX
- [CMMS Mobile App Capabilities for Field Technicians](https://www.maintainnow.app/blog/cmms-mobile-app-capabilities-essential-features-for-field-technicians-1760127185271) — MaintainNow
