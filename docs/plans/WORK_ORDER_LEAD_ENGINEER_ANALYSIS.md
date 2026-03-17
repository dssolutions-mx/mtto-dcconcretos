# Lead Engineer Maintenance Domain Analysis

*From a maintenance operations perspective: what the system does right, what it does wrong, and what to fix first. Based on real application behavior, CMMS standards (ISO 55000/14224), and the compiled context document.*

---

## 1. Cards on the Table: What’s Right vs. Wrong

### What the System Does RIGHT

- **Origin traceability** — Incident, checklist, and preventive origins are stored via FKs (`incident_id`, `checklist_id`, `maintenance_plan_id`). Audit trail is preserved.
- **Multiple creation paths** — Manual, preventive, checklist, and incident flows exist and function; auto-creation reduces manual data entry.
- **Corrective vs. preventive separation** — Type is correctly derived from origin.
- **Evidence at completion** — Completion photos and maintenance history are captured; technicians can document work done.
- **Parts schema** — `PurchaseOrderItem`-style structure supports PO generation when parts are populated.
- **Priority and recurrence logic** — Escalation, consolidation, and recurrence counts support chronic-failure analysis.
- **Filtering by origin, asset, technician** — Work orders can be filtered by tab, origin, type, and technician.
- **Lifecycle awareness** — Status flow (Planificado → En compra → En ejecución → Completado) is modeled.
- **PO linkage** — Purchase orders can be linked to work orders; “Generar OC” exists for WO-driven procurement.

### What the System Does WRONG (Blunt Assessment)

| Issue | Operational impact | Who complains |
|------|--------------------|----------------|
| **`plant_id` never set** | Reporting and cost allocation by plant are unreliable. Attribution falls back to asset’s current plant at report time, which can drift. | Plant managers, finance |
| **Checklist WOs arrive empty** | WOs from failed/flagged checklist items have no parts, cost, planned_date, or assignee. Coordinator must fill everything manually. | Maintenance coordinator |
| **Incident WOs arrive incomplete** | Same pattern: no planned_date, no assignee. Parts and cost come only when the incident has them. | Maintenance coordinator |
| **Creation evidence not transferred** | Photos from incident/checklist are not copied to `creation_photos`. Problem context is lost. | Supervisor, quality, audit |
| **`maintenance_plans.next_due` never updated on completion** | Preventive completion does not recalculate next due. Plans show stale dates; scheduling is misleading. | Planner, reliability engineer |
| **One-size-fits-all edit form** | Auto-created WOs (incident, checklist) need planned_date, assignee, parts—but the edit form doesn’t guide or prompt for these. | Maintenance coordinator |
| **No sort/filter by planned_date** | Cannot build “upcoming this week” or “overdue” views. Scheduling decisions rely on manual inspection. | Planner, coordinator |
| **WO supplier not passed to PO** | When the WO has `assigned_supplier_id`, PO creation does not prefill it. Extra steps for procurement. | Buyer, coordinator |
| **`suggested_supplier_id` unused** | Field exists but is never populated. Potential to support procurement is unused. | Procurement, lead engineer |

### What a Plant Manager or Maintenance Coordinator Would Say

> “We get a lot of work orders from incidents and checklists, but they’re half-empty. I can’t tell which ones need attention this week because I can’t sort by planned date. When we finish a preventive, the plan still shows the old next-due date. And when we create a PO from a WO that already has a supplier, we have to type it again. The system records the work, but it doesn’t help us plan or schedule.”

---

## 2. Scheduling “Like an Alert for Unavailable Assets”

### What the User Probably Means

- **Scheduling = alert for when work cannot be done** — If an asset is unavailable (down, in production, reserved), the system should surface that and prevent or flag scheduling conflicts.
- **Planned_date as a planning signal** — `planned_date` should drive visibility: “What’s due this week?”, “What’s overdue?”, “What can’t be done because the asset isn’t available?”

### What the System Currently Does

- `planned_date` is only set in the preventive flow.
- Incident and checklist WOs are created with `planned_date = null`.
- No filters or sort by `planned_date`.
- No alerts for upcoming or overdue work.
- No asset availability or unavailability checks before scheduling.

### What the System SHOULD Do (Operationally)

1. **Set `planned_date` early** — For incident WOs, use incident date as initial `planned_date`; for checklist, use checklist completion date. Planners can adjust later.
2. **Filter/sort by planned_date** — “Programadas esta semana”, “Vencidas”, “Sin programar”.
3. **Upcoming/overdue alerts** — UI or background job that highlights WOs with `planned_date` in the next N days or past due.
4. **Asset availability** — Before scheduling (or when changing `planned_date`), check asset status (operational, down, reserved). Warn or block scheduling on unavailable assets.
5. **Scheduling view** — A view ordered by `planned_date` plus asset for capacity and resource planning.

### Summary

**Current:** `planned_date` is optional and rarely set for corrective WOs; no scheduling-centric views or asset availability logic.

**Target:** `planned_date` is a first-class scheduling field; views and alerts use it; unavailable assets are considered when planning.

---

## 3. Auto-Created WO Lifecycle: Coordinator’s Step-by-Step

### Typical Flow (Corrective from Incident or Checklist)

| Step | Action | Current system support | Gap |
|------|--------|------------------------|-----|
| **1. Triage** | Decide urgency and initial priority | Priority often set from incident/checklist | OK; consolidation helps |
| **2. Plan** | Set when and who | Edit form has planned_date, assigned_to | No guidance; WOs arrive without these |
| **3. Schedule** | Pick date considering asset availability | No planned_date filter; no availability check | Cannot see “due this week”; no asset check |
| **4. Assign** | Assign technician | Edit form supports assigned_to | No prompts; no skill-based hints |
| **5. Parts** | Add parts or estimate cost | Edit form has required_parts | Checklist WOs arrive without parts; coordinator starts from zero |
| **6. PO** | Generate PO if parts needed | “Generar OC” exists | Checklist WOs often have no parts; PO lacks WO supplier prefill |
| **7. Execute** | Technician does the work | Completion flow works | OK |
| **8. Close** | Complete WO; update plan if preventive | Completion updates WO | Preventive: `maintenance_plans.next_due` not updated |

### Recommended Workflow Support

1. **Triage** — Inbox/tab for “Auto-created” (incident + checklist) with priority; optional recurrence indicator.
2. **Plan** — Edit form adapts by origin:
   - Incident/checklist: emphasize “planned_date”, “assigned_to”, “required_parts”.
   - Preventive: show plan context; keep existing flow.
3. **Schedule** — Filter “Sin programar” (null planned_date) and “Programadas” (with planned_date); sort by planned_date.
4. **Parts** — When possible, prefill from incident or from plan for preventive; for checklist, templates or catalog lookup.
5. **PO** — Prefill supplier from WO `assigned_supplier_id`; require parts or estimated cost before “Generar OC”.
6. **Completion** — For preventive WOs, update `maintenance_plans.next_due` via `update_maintenance_plan_after_completion` or equivalent.

---

## 4. PO Integration from Maintenance POV

### When Do We Need a PO?

- External parts (not from internal stock)
- External services (contractor, specialist)
- Any procurement above a threshold

### What WO Data Must Exist Before “Generar OC” Makes Sense?

| WO field | Required for PO? | Current state |
|----------|------------------|---------------|
| `required_parts` | Yes (or equivalent line items) | Checklist: null. Incident: from incident when present. Manual/preventive: from form. |
| `estimated_cost` or parts total | Yes (for budget/approval) | Checklist: null. Others: varies. |
| `asset_id` | Yes (routing, location) | Always set. |
| `plant_id` | Yes (cost center, RLS) | Never set on WO; PO falls back to asset’s plant. |
| `assigned_supplier_id` | No, but useful for prefill | WO can have it; PO form does not receive it. |

### What’s Missing?

1. **Checklist WOs** — No parts or cost at creation; “Generar OC” forces redirect to edit or manual PO entry.
2. **PO does not get WO supplier** — `assigned_supplier_id` is not passed to the PO creation flow; user re-enters supplier.
3. **`plant_id` on WO** — Not set; PO must infer plant from asset, which can be inconsistent.
4. **Pre-generate checklist** — Some checklist WOs may not need a PO; others do. The system cannot prefill parts from checklist item or asset template.

### Recommendation

- Require parts or `estimated_cost` before enabling “Generar OC” for WO-driven POs (or show a clear “Agregar partes primero” step).
- Pass `assigned_supplier_id` (and supplier name) from WO to PO creation via URL/search params or API.
- Set `plant_id` on WO from `asset.plant_id` at creation so PO and reports use consistent attribution.

---

## 5. Standards Alignment: Top 3 Gaps

### Gap 1: Feedback Loop for Preventive Maintenance (ISO 55001, Clause 10)

**Standard:** Improvement requires feedback from execution into planning.

**Current:** When a preventive WO is completed via the app, `maintenance_plans.next_due` is not updated. The `update_maintenance_plan_after_completion` RPC exists but is not called. Plans become stale.

**Impact:** Next preventive dates are wrong; risk of over- or under-maintenance; compliance and reliability reporting are compromised.

**Fix:** After completing a preventive WO, call logic equivalent to `update_maintenance_plan_after_completion` (or the DB `complete_work_order` path that updates plans) so `next_due` is recalculated from the completion date and interval.

---

### Gap 2: Structured Failure/Maintenance Data (ISO 14224)

**Standard:** Failure and maintenance records should follow Problem → Detection method → Part failed → Cause → Action → Consequence.

**Current:** Descriptions are free text. No structured detection method, cause codes, or failure mechanism. Evidence (e.g. creation photos) is not consistently captured or carried from incident/checklist to WO.

**Impact:** Hard to benchmark, analyze root causes, or exchange data with other systems.

**Fix:** (a) Map incident/checklist evidence into `creation_photos`; (b) Add optional structured fields (detection method, cause code) in a later phase; (c) Ensure creation evidence is preserved across all creation paths.

---

### Gap 3: Planned Date and Scheduling (CMMS Best Practice)

**Standard:** Use `planned_date` for scheduling and `due_date` (or equivalent) for compliance/SLA.

**Current:** `planned_date` is optional and usually null for corrective WOs. No filters or sort by planned_date. No alerts for upcoming/overdue work. No asset availability consideration.

**Impact:** Coordinators cannot plan by date; no “what’s due this week” view; scheduling conflicts and overdue work are hard to manage.

**Fix:** (a) Set initial `planned_date` for incident/checklist WOs (e.g. incident/checklist date); (b) Add filter and sort by `planned_date`; (c) Add upcoming/overdue alerts; (d) Optionally check asset availability when scheduling.

---

## 6. Prioritized Action Plan

### First: Fix Preventive Completion Feedback (1–2 days)

**What:** After completing a preventive WO, update `maintenance_plans.next_due` via `update_maintenance_plan_after_completion` or equivalent logic.

**Where:** `app/api/maintenance/work-completions/route.ts`

**Rationale:** Directly breaks the planning loop. Plant managers and planners rely on correct next-due dates. High impact, low risk, clear scope.

---

### Second: Set `plant_id` and Transfer Creation Evidence (1–2 days)

**What:**  
(a) Set `plant_id` from `asset.plant_id` in all four creation paths.  
(b) Map incident documents and checklist issue photos to `creation_photos` when creating WOs.

**Where:** Work order creation logic in each path; incident and checklist APIs.

**Rationale:** `plant_id` affects reporting, cost allocation, and PO attribution. Creation evidence supports quality, audit, and root-cause analysis. Both are foundational for trust in the system.

---

### Third: Make Auto-Created WOs Actionable (2–3 days)

**What:**  
(a) Set initial `planned_date` for incident (incident date) and checklist (completion date) WOs.  
(b) Add filter and sort by `planned_date` in the work orders list.  
(c) Add origin-aware guidance in the edit form (e.g. “Agregar fecha programada”, “Asignar técnico”) for auto-created WOs.

**Where:** Incident and checklist creation APIs; `useWorkOrderFilters.ts`; `work-order-edit-form.tsx`.

**Rationale:** Coordinators need to see what’s due and what’s unplanned. This enables a real scheduling workflow without large new features.

---

### Fourth: Pass WO Supplier to PO; Populate Parts for Checklist (2–3 days)

**What:**  
(a) When redirecting to “Generar OC”, pass `assigned_supplier_id` (or supplier name) so the PO form prefills the supplier.  
(b) For checklist WOs, explore templates or asset/checklist-item parts to prefill `required_parts` where feasible.

**Where:** `generar-oc` redirect; PO creation forms; checklist corrective WO generation.

**Rationale:** Reduces rework for procurement and makes “Generar OC” usable for more auto-created WOs.

---

### Later: Alerts, Asset Availability, `suggested_supplier_id`

- **Alerts:** UI or background job for upcoming/overdue WOs.
- **Asset availability:** Check asset status before scheduling; warn when asset is down or reserved.
- **`suggested_supplier_id`:** Use or remove; if used, populate from asset type, problem, or history and surface in WO details/PO flow.

---

## 7. Summary Table

| Priority | Action | Rationale |
|----------|--------|-----------|
| **1** | Update `maintenance_plans.next_due` on preventive completion | Fixes broken feedback loop; plans stay accurate |
| **2** | Set `plant_id` at WO creation; transfer creation evidence | Correct reporting and audit trail |
| **3** | Set `planned_date` for auto-created WOs; add filter/sort; edit-form guidance | Enables scheduling workflow |
| **4** | Pass WO supplier to PO; explore parts for checklist WOs | Reduces procurement friction |
| **5** | Alerts, asset availability, `suggested_supplier_id` | Further scheduling and procurement improvements |

---

*Document generated from compiled context, CMMS standards research, and application code analysis. Reflects maintenance operations perspective, not only technical refactoring.*
