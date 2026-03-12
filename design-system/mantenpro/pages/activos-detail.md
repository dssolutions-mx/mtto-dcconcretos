# Activos Detail Page Overrides

> **PROJECT:** MantenPro
> **Page Type:** Asset Hub / Main Revision Tool (Industrial, Data-Centric)

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Aesthetic Direction

- **Tone:** Industrial / Fleet Operations — Trust & Authority. Bold numbers, clear status semantics.
- **Focus:** "What needs attention now" over "everything at once." Scannable, authoritative.
- **Layout:** Primary metric (Horas Operación) larger; Tareas Pendientes highlighted when > 0.

### Color Roles (Extended from MASTER)

| Role | Hex | Usage |
|------|-----|-------|
| Primary | `#0F172A` | Headings, primary text |
| CTA | `#0369A1` | Primary actions (Nueva Orden) |
| Critical | `#DC2626` | Overdue, destructive alerts |
| Warning | `#D97706` | Upcoming/urgent, pending |
| OK | `#059669` | Completed, healthy, no issues |
| Muted | `#475569` | Secondary text, labels |

**Rule:** Never rely on color alone. Use text + icon + color for status.

### Typography Overrides

- **Asset name:** Display font, `text-xl md:text-2xl` (1.5–2rem), `font-bold`
- **KPIs:** Numbers `text-2xl md:text-3xl`, labels `text-xs sm:text-sm text-muted-foreground`
- **Card titles:** `font-medium`, icon `h-5 w-5` consistent
- **Body:** `text-sm` for dense lists, `leading-relaxed` for readability

**Font pairing:** SF Pro Display (headings) + SF Pro Text (body) per MASTER. No Fira.

### Spacing Overrides

- **KPI grouping:** `gap-3 md:gap-6` between KPI items; `mb-4 md:mb-6` before actions
- **Section padding:** `--space-lg` (24px) for cards; `--space-2xl` (48px) between major sections
- **Card density:** Controlled; avoid cramming; use progressive disclosure for long content

### Component Overrides

- **Critical alerts:** Above tabs, always visible when relevant. Icon + text + optional link. Staggered reveal on load.
- **Action hierarchy:** Primary = Nueva Orden (high contrast); Secondary = Incident, OT, Reporte, Editar (outline); Tertiary = Crear Activo Compuesto (less prominent or dropdown)
- **Cards:** `rounded-xl` (12px), `shadow-md`; hover `transition-colors duration-200` (no layout shift)
- **Overdue cards:** Left border accent `border-l-4 border-l-red-500`, `bg-red-50`

### Motion & Effects

- **Staggered reveal:** Header → KPIs → Tabs (animation-delay: 0, 75ms, 150ms)
- **Alert pulse:** Subtle for overdue count; `@media (prefers-reduced-motion: reduce)` → no animation
- **Tab switch:** Smooth content transition (opacity/fade)
- **Hover:** `cursor-pointer`, `transition-colors duration-200`; no scale that shifts layout

### Empty States

- **Pattern:** Icon + headline (1 line) + description (1–2 lines) + primary CTA
- **Example (Documentación):** "No hay documentos disponibles" / "Los documentos técnicos se asocian al modelo." + "Ver documentación del modelo"

### Responsive Breakpoints

- **375px:** Single column; KPIs 2x2 grid; actions wrap or dropdown; tabs horizontally scrollable
- **768px:** 2-column where applicable
- **1024px+:** Full 3-column tab content

### Breadcrumb

- **Last segment:** Use asset ID or short name (e.g. `C7H 360HP - SITRAK`), NEVER raw UUID
- **Full ID:** Tooltip if needed for power users

---

## Anti-Patterns (Activos Detail Specific)

- Avoid: Raw UUID in breadcrumb
- Avoid: Six equally-weighted action buttons
- Avoid: Long maintenance descriptions without progressive disclosure (use "Ver más" / expand)
- Avoid: Critical alerts buried inside tab content
- Avoid: Hover transforms that cause layout shift (e.g. scale)
