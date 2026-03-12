# Work Orders Page UI/UX - Deep Analysis & Improvement Plan

## Executive Summary

The work orders page is underutilized because it fails to surface the **context** that matters: **asset, origin, recurrence, and urgency**. Users naturally go to asset details first because that page answers "What's wrong with THIS asset?" — the work orders list answers "Here are all WOs" without helping prioritize or trace back. This plan addresses the full lifecycle, origin types, recurrence tracking, and asset-centric mental model.

---

## Part 1: Deep Understanding

### 1.1 Purpose of a Work Order

A work order is the **actionable unit** for maintenance. It tracks:
- **What** needs to be done (description, required tasks, parts)
- **Where** (asset)
- **Status** through lifecycle: Planificado → En compra → En ejecución → Completado
- **Who** (assigned technician, requester)
- **Cost** (estimated, actual via PO, additional expenses)

### 1.2 Work Order Origins (4 Distinct Sources)

| Origin | Trigger | work_order fields | User-visible today? |
|--------|---------|-------------------|---------------------|
| **Manual Incident** | IncidentRegistrationDialog (Falla, Accidente, Alerta) | `incident_id`, type=corrective | "Desde incidente" badge only |
| **Checklist Issue** | Checklist execution fail/flag → generate-corrective-work-order-enhanced | `checklist_id`, type=corrective | No |
| **Preventive** | Maintenance schedules, intervals | `maintenance_plan_id`, type=preventive | Implied by type badge |
| **Ad-hoc** | WorkOrderForm, manual create | None of above | No |

**Key insight:** The list shows "Desde incidente" when `incident_id` exists, but **checklist-origin** WOs (often the majority in operational settings) have no origin indicator. Users cannot tell if a WO came from a failed checklist item vs. a manually reported incident.

### 1.3 Recurrence & Escalation (Critical Gap)

The system implements **smart deduplication** for checklist issues:
- Same issue (fingerprint match) on same asset → **consolidate** into existing WO instead of creating new one
- `escalation_count`, `related_issues_count`, `issue_history`, `original_priority` track this
- Priority auto-escalates: 3+ recurrences (fail) → Emergencia; 2+ → Alta; flags escalate more slowly
- Description appended with `"🔄 ISSUE RECURRENTE - Ocurrencia #N"`

**Problem:** None of this is visible in the work orders list. Chronic/recurring issues look identical to first-time issues. Technicians and managers cannot prioritize "problem assets" or "repeated failures."

### 1.4 Asset Centrality

- Every WO has `asset_id` — **asset_id is the main identifier** (not `name`); use it as the primary label in lists, filters, and chips.
- User mental model: **"What's wrong with THIS asset?"** not "Show me all WOs globally"
- Asset detail page ([StatusMaintenanceTab](components/assets/activos-detail/tabs/status-maintenance-tab.tsx)) provides:
  - Próximos Mantenimientos (urgency)
  - Trabajos realizados (history)
  - Trabajos planificados (WOs for this asset)
  - "Ver todas las OT" → `/ordenes?assetId=X&asset=Name`

The work orders list receives `?assetId=` and filters, but:
- Asset is column 2 in a dense table; not the primary visual anchor
- No "group by asset" or "asset-first" view
- No quick jump from WO list back to asset

### 1.5 Incident vs. Checklist Terminology

- **incident_history**: Manual incidents (Falla, Alerta, Accidente) — stored per asset at `/activos/[id]/incidentes`
- **checklist_issues**: Fail/flag items from checklist execution — linked via `checklist_issues.work_order_id`
- **EntityRelations** for incident links to `/incidentes` (global page) — should link to `/activos/{assetId}/incidentes` when incident is asset-scoped

For checklist-origin WOs, the "source" is the checklist execution, not incident_history. The work-order-incident-pattern rule states: *each incident (failed/flagged checklist item) creates its own corrective work order* — so "incident" in that rule means checklist_issues, not incident_history. The naming is overloaded.

### 1.6 Data Currently Fetched vs. Available

**work-orders-list.tsx** selects:
```sql
*, asset:assets (id, name, asset_id)
```

**Available but NOT fetched for list:**
- `escalation_count`, `related_issues_count`, `issue_history`, `original_priority`
- `checklist_id`, `maintenance_plan_id` (for origin)
- `last_escalation_date`
- `plant_id` (for plant filter)

---

## Part 2: Improvement Plan (Revised)

### Phase 1: Summary Ribbon & Metrics

Same as before — at-a-glance counts by status. Add optional **"Recurrentes"** segment: count of WOs with `escalation_count > 0` (or `related_issues_count > 1`). This surfaces chronic issues immediately.

### Phase 2: Origin Badges & Recurrence Indicators

**2.1 Origin badge**
- `incident_id` → "Desde incidente" (link to `/activos/{assetId}/incidentes`)
- `checklist_id` → "Desde checklist" (link to checklist execution or issues)
- `maintenance_plan_id` + type=preventive → "Preventivo programado"
- None → "Manual / Ad-hoc"

**2.2 Recurrence indicator**
- When `escalation_count > 0` or `related_issues_count > 1`: show badge "Recurrente (N)" with distinct color (e.g., orange/amber)
- Tooltip or expand: "Este problema se ha repetido N veces"

**2.3 Data fetch update**
- Extend work orders query to include: `escalation_count`, `related_issues_count`, `checklist_id`, `maintenance_plan_id`

### Phase 3: Urgency & Overdue

- **Overdue:** `planned_date < today` and `status !== Completed` → red left border or badge "Vencida"
- **Upcoming:** `planned_date` within next 7 days → amber "Próxima"
- Sort option: "Por urgencia" (overdue first, then by planned_date, then by priority)

### Phase 4: Asset-Centric Layout & Filters

**4.1 Asset as primary anchor**
- Desktop: Make asset column first or visually dominant (e.g., asset name + asset_id as row header)
- Card/row: Asset block at top; "Ver activo" link prominent
- Optional view: "Agrupar por activo" — collapse/expand by asset

**4.2 Filters**
- Asset select (from assets in result set or full list)
- Technician
- Date range (planned_date)
- **Origin** filter: Todos | Incidente | Checklist | Preventivo | Manual
- **Recurrentes solo** toggle

**4.3 URL chip**
- When `?assetId=` present: "Filtrado por: [Asset Name]" with clear

### Phase 5: Richer List UX

**5.1 Desktop**
- Row click → `/ordenes/{id}`
- Add column: Origen (badge)
- Add column or inline: Recurrencia (when > 1)
- Add column: Urgencia (Vencida | Próxima | —)

**5.2 Mobile**
- WorkOrderCard: Origin badge, recurrence badge, urgency stripe (left border)
- Full card click → detail
- "Ver activo" always visible

**5.3 Empty states**
- Tab-specific + guidance + CTA

### Phase 6: EntityRelations & Incident Link Fix

- When `incident_id` and `asset_id` known: link to `/activos/{assetId}/incidentes` not `/incidentes`
- When `checklist_id`: add "Ver checklist" chip in EntityRelations

### Phase 7: Work Order Detail Page — Recurrence Section

The detail page ([app/ordenes/[id]/page.tsx](app/ordenes/[id]/page.tsx)) does not show:
- `escalation_count`, `related_issues_count`
- `issue_history` summary
- "Este problema ha recurrido N veces"

Add an **"Historial de recurrencias"** card when `related_issues_count > 1`, showing a condensed timeline from `issue_history` if available.

---

## Part 3: Implementation Order

1. **Filter system foundation** — `useWorkOrderFilters` hook + URL sync + `applyWorkOrderFilters` function
2. **Data layer** — Extend work orders query with origin + recurrence fields
3. **WorkOrdersFilterBar** — Full filter bar (desktop + mobile) with chips, following Compras pattern
4. **Origin badges** — Show in list (desktop + mobile)
5. **Recurrence indicator** — Badge when escalation/recurrence
6. **Summary ribbon** — Including optional Recurrentes count
7. **Urgency/overdue** — Visual + sort
8. **Asset prominence** — Layout adjustments
9. **Grouping toggle** — Optional "Agrupar por activo"
10. **EntityRelations fix** — Incident → asset incidentes
11. **Detail page** — Recurrence section

---

## Part 4: Files to Modify

| File | Changes |
|------|---------|
| `hooks/useWorkOrderFilters.ts` | New — filter state, URL sync, `applyWorkOrderFilters` logic |
| `components/work-orders/WorkOrdersFilterBar.tsx` | New — filter UI (desktop + mobile), chips, following ComprasFilterBar pattern |
| `components/work-orders/work-orders-list.tsx` | Use filter hook, query extension, origin badges, recurrence, urgency, summary ribbon |
| `components/work-orders/WorkOrdersSummaryRibbon.tsx` | New — metrics + Recurrentes |
| `app/ordenes/page.tsx` | Header, mobile sticky |
| `app/ordenes/[id]/page.tsx` | Recurrence section, EntityRelations incident link |
| `components/navigation/entity-relations.tsx` | Accept assetId for incident link to `/activos/{assetId}/incidentes` |

---

## Part 5: Filter System Design (Detailed)

Filters must be designed as a first-class system, not an afterthought. The Compras page ([ComprasFilterBar](components/compras/ComprasFilterBar.tsx)) provides a reference pattern; Work Orders should follow and extend it consistently.

### 5.1 Filter State Architecture

**Single source of truth:** Use a `useWorkOrderFilters` hook or equivalent that manages all filter state in one place and syncs bidirectionally with URL when appropriate.

| Filter | Type | URL param | Default | Options source |
|--------|------|-----------|---------|----------------|
| ** Tab (status)** | Segment control | `tab` | `all` | Static (all, pending, approved, inprogress, completed) |
| **searchTerm** | Text | — (or `q` if persisted) | `""` | User input |
| **assetId** | Select | `assetId` | `""` | Derived from work orders |
| **assetName** | — | `asset` | — | Used for display chip only; assetId is canonical |
| **technicianId** | Select | `tech` | `""` | From technicians map |
| **typeFilter** | Select | `type` | `all` | Static (all, preventive, corrective) |
| **originFilter** | Select | `origin` | `all` | Static (all, incident, checklist, preventive, manual) |
| **recurrentesOnly** | Toggle | `recurrentes` | `false` | Boolean |
| **fromDate** | Date | `from` | — | User picker |
| **toDate** | Date | `to` | — | User picker |
| **groupByAsset** | Toggle | `group` | `false` | Boolean |

**URL sync strategy:**
- **Always in URL:** `assetId`, `asset` (name for chip display), `tab` — enables deep links from asset page and shareable views
- **Optional in URL:** `type`, `origin`, `tech`, `from`, `to`, `recurrentes`, `group` — add when non-default so URLs stay short when simple
- **Never in URL:** `searchTerm` — transient; or use `q` with debounce if we want search to persist on refresh

**On mount:** Read URL params and initialize filter state. When user changes filters, update URL via `router.replace` (not push, to avoid cluttering history for every filter tweak).

### 5.1.1 Tab (Status) Filter — Lifecycle Alignment

Only 2 operational tabs. Config: `lib/work-order-status-tabs.ts`.

| Tab id | Label | Statuses |
|--------|-------|----------|
| `all` | Todas | (no filter) |
| `pending` | Pendientes | Pendiente, Cotizada, Aprobada, En ejecución, Esperando Partes |
| `completed` | Completadas | Completada |

**"En ejecución" is never used** in practice — folded into Pendientes. No separate Aprobadas tab. URL: `?tab=approved` or `?tab=inprogress` redirect to `pending`.

### 5.1.2 Richer List Context — "Qué se hará"

- **Mobile cards**: "Qué se hará" label, description (line-clamp-3), tasks/parts count when available
- **Desktop table**: "Descripción / Qué se hará" column with truncated text + tasks/parts summary

### 5.1.3 Prioridad (not Urgencia)

- **Urgencia column removed** — that concept does not exist; use **Prioridad** which already exists
- Sort option: "Por prioridad" (sorts by Crítica, Alta, Media, Baja) — no "Por urgencia"

### 5.1.4 Apple HIG Layout

- **Clarity**: Single segmented control (Todas | Pendientes | Completadas), no ribbon + tabs duplication
- **Deference**: Content-first; search prominent, filters in popover; subtle table styling
- **Progressive disclosure**: Desktop toolbar = Search + Filtros button (all filters inside popover)
- **Touch targets**: 44pt minimum for interactive elements (buttons, segments)
- **Typography**: 15px body, 13px captions; SF Pro / -apple-system per design system
- **Spacing**: Generous gaps (space-y-6), rounded corners (10px)

### 5.2 Filter Composition Logic

All filters combine with **AND** logic:
```
filtered = workOrders
  .filter(byTab)
  .filter(byType)
  .filter(byAssetId)
  .filter(byTechnician)
  .filter(byOrigin)
  .filter(byRecurrentes)
  .filter(byDateRange)
  .filter(bySearchTerm)
```

Order of application does not affect result (all AND). Filter logic must live in one place — e.g. a `applyWorkOrderFilters(orders, filters)` function — for testability and consistency.

### 5.3 Filter Bar Layout (Following Compras Pattern)

**Desktop:**
- Row 1: Search input | Asset select | Technician select | Type select | Date range (Desde/Hasta) | Filtros popover (Origin, Recurrentes, Group toggle) | Clear-all when active
- Row 2 (when hasActiveFilters): FilterChipsSection with removable chips per filter

**Mobile:**
- Search input + Filtros button (opens Sheet or Popover with all filters)
- FilterChipsSection below when active

**Filter options derivation:**
- **Asset:** `useMemo` from work orders → unique `asset_id` with label `asset_id || name`
- **Technician:** From `technicians` map → `{ id, label: nombre apellido }`
- **Type, Origin:** Static arrays

### 5.4 Filter Chips (Active Filters Display)

- When any filter (except search) is non-default: show FilterChipsSection
- Each chip: `[Label: Value] [X]` — click X removes that filter
- "Limpiar todo" button in popover and optionally inline
- Chips use same styling as Compras (`bg-sky-100`, etc.) for consistency
- `aria-label` on each clear button

### 5.5 Empty State & Filter Feedback

- **No results:** "No se encontraron órdenes con estos filtros." + [Limpiar filtros] button
- **Results count:** "Mostrando X de Y órdenes" (X = filtered, Y = total before filters or tab)
- **Active filter count:** Badge on Filtros button when any secondary filter is applied

### 5.6 Edge Cases

1. **assetId from URL but asset not in loaded data:** Still filter by assetId (strict); chip shows assetId or "Activo filtrado" if name unknown
2. **Invalid date range (from > to):** Swap automatically or show validation message
3. **Tab + filters:** Tab is a filter; combined with others. When tab="completed" and assetId=X, show completed WOs for that asset
4. **Group by asset + asset filter:** When both, only one asset = one group. Fine.
5. **Repeated URL navigation:** `router.replace` with same params = no-op; avoid unnecessary re-renders

### 5.7 Persistence (Optional, Post-MVP)

- **localStorage:** Persist last used filters (except search) keyed by `work-orders-filters`
- **On mount:** If no URL params, optionally restore from localStorage
- **Scope:** Low priority; URL params are sufficient for shareable state

### 5.8 Accessibility

- All filter inputs have `aria-label` or associated `<label>`
- Filter button: `aria-expanded`, `aria-controls` when popover
- "Limpiar filtros": `aria-label="Limpiar todos los filtros"`
- Screen reader: "Filtros aplicados: 3" when chips shown
- Keyboard: Popover traps focus; Escape closes

### 5.9 Implementation Checklist

- [ ] `useWorkOrderFilters` hook with state + URL sync
- [ ] `applyWorkOrderFilters(orders, filters)` pure function
- [ ] WorkOrdersFilterBar component (desktop + mobile layouts)
- [ ] FilterChipsSection with individual clear + clear all
- [ ] Filter options derived from work orders + technicians
- [ ] Empty state with "Limpiar filtros" CTA
- [ ] Active filter count badge
- [ ] aria-labels throughout

---

## Part 6: Anti-Patterns to Avoid

- Do not overload "incident" — distinguish incident_history vs. checklist_issues in UI labels
- Do not fetch issue_history full JSON for list — use escalation_count, related_issues_count only
- Do not add complexity without user value — e.g., "group by asset" is optional, not mandatory for MVP
- Do not scatter filter logic — keep in one `applyWorkOrderFilters` function
- Do not skip URL sync for shareable filters (assetId, tab) — breaks deep links from asset page
- Do not forget FilterChipsSection — users need to see and clear active filters at a glance

---

## Verification Checklist

**Filters & URL:**
- [ ] Filters sync to URL (assetId, tab, type, etc.); shareable links work
- [ ] Deep link from asset page (`/ordenes?assetId=X`) applies filter correctly
- [ ] Filter chips show active filters; individual clear and "Limpiar todo" work
- [ ] Empty state when filters return no results shows "Limpiar filtros" CTA
- [ ] Active filter count badge on Filtros button

**Content:**
- [ ] Origin badge shows correct source (incident, checklist, preventive, manual)
- [ ] Recurrence badge visible when escalation_count > 0 or related_issues_count > 1
- [ ] Overdue WOs visually distinct
- [ ] Incident link goes to `/activos/{assetId}/incidentes` when applicable
- [ ] Detail page shows recurrence history when relevant

**General:**
- [ ] All existing functionality (delete, refresh, tabs) preserved
- [ ] Mobile: filter popover, touch targets, no horizontal scroll
