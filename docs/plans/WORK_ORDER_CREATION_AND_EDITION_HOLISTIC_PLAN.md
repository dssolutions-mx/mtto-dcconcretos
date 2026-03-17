# Work Order Creation and Edition – Holistic Plan (Implementation-Ready)

*Detailed, phase-by-phase plan with subagent assignments. Focus: creation and edit process only. Recurrence is already present in the work orders list—excluded from this plan.*

---

## Scope and Exclusions

**In scope:**
- Work order **creation** (Standalone WorkOrderForm, NewMaintenancePage, checklist API, incident API)
- Work order **edit** (WorkOrderEditForm)
- Data integrity (plant_id, creation_photos, maintenance_plans.next_due)

**Out of scope:**
- Recurrence badge (already in list; WorkOrdersSummaryRibbon, recurrentes filter)
- Scheduling filters/sort by planned_date (list feature; separate from creation/edit)
- Supplier on WO → PO prefill (de-prioritized)

---

## User Corrections (Reference)

| # | Correction | Implication |
|---|------------|-------------|
| 1 | Technicians are third-party; assigned_to often = coordinator | No certification; keep simple |
| 2 | Supplier on WO doesn't make sense; PO is the doc | De-prioritize supplier prefill |
| 3 | Preventive = interval tasks (required_tasks), not "checklist" | Use required_tasks terminology |
| 4 | Incident WOs never have required_parts at creation | Don't expect; add in edit after diagnosis |
| 5 | Incident planned_date = coordinator's job in edit | No auto-set at creation |
| 6 | Deduplication/priority escalation exists | Document only; no new UI |

---

# PHASE 1: Data Integrity (Backend)

*Estimated: 2–3 days. Four subagents run in parallel.*

---

## Phase 1.1: Update maintenance_plans.next_due on Preventive Completion

### Objective
When a preventive WO is completed via the app, recalculate and update `maintenance_plans.next_due` so schedule data stays correct.

### Files
- `app/api/maintenance/work-completions/route.ts` (primary)
- `complete_schema.sql` lines 7260–7289 (`update_maintenance_plan_after_completion`)

### Current Behavior
1. Route updates `work_orders` (status, completed_at, completion_photos, used_parts).
2. Creates `maintenance_history` when `maintenanceHistoryData` provided.
3. Does **not** call `update_maintenance_plan_after_completion`.

### Target Behavior
After successful WO update, when `existingOrder` has `maintenance_plan_id`:
1. Fetch the maintenance plan: `maintenance_plans.id`, `asset_id`, `interval_value`.
2. Call RPC: `supabase.rpc('update_maintenance_plan_after_completion', { p_asset_id, p_interval_value, p_completion_date })` with `asset_id`, `interval_value`, and completion date.
3. If RPC fails, log but do not fail the main completion (graceful degradation).

### Implementation Steps
1. Expand initial `work_orders` select to include `maintenance_plan_id`: `.select("id, status, asset_id, maintenance_plan_id, ...")`.
2. After the WO update succeeds (around line 217), add:
   ```typescript
   if (existingOrder.maintenance_plan_id && existingOrder.asset_id) {
     const { data: plan } = await supabase.from('maintenance_plans').select('asset_id, interval_value').eq('id', existingOrder.maintenance_plan_id).single();
     if (plan?.asset_id != null && plan?.interval_value != null) {
       await supabase.rpc('update_maintenance_plan_after_completion', {
         p_asset_id: plan.asset_id,
         p_interval_value: plan.interval_value,
         p_completion_date: new Date().toISOString()
       });
     }
   }
   ```
3. Wrap in try/catch; log errors; do not throw.

### Acceptance Criteria
- [ ] Completing a preventive WO with `maintenance_plan_id` triggers `update_maintenance_plan_after_completion`.
- [ ] `maintenance_plans.next_due` is updated to the next cycle date.
- [ ] Non-preventive or WO without plan: no RPC call; no error.
- [ ] RPC failure does not roll back the WO completion.

### Subagent 1.1 Prompt

```
TASK: Implement update_maintenance_plan_after_completion call in work-completions API.

SCOPE: app/api/maintenance/work-completions/route.ts

REQUIREMENTS:
1. After work order update succeeds, check if wo has maintenance_plan_id and asset_id.
2. Fetch maintenance_plan (asset_id, interval_value) by id.
3. Call supabase.rpc('update_maintenance_plan_after_completion', { p_asset_id, p_interval_value, p_completion_date }).
4. Use completion date from the request (completionData.completion_date or new Date()).
5. Wrap RPC call in try/catch; log errors; never throw.
6. Expand initial work_orders select to include maintenance_plan_id.

REFERENCE: complete_schema.sql lines 7260-7289 for function signature.

OUTPUT: Implement the change. Run npm run build to verify. Return summary of changes.
```

---

## Phase 1.2: Set plant_id at Work Order Creation (All Four Paths)

### Objective
Set `plant_id` from the selected asset's `plant_id` in every creation path so reporting and PO attribution use consistent data.

### Paths and Files

| Path | File | Insert location |
|------|------|-----------------|
| Standalone | `components/work-orders/work-order-form.tsx` | `handleSubmit`, workOrderData object ~line 479 |
| Preventive | `app/activos/[id]/mantenimiento/nuevo/page.tsx` | `workOrderData` ~line 480 |
| Checklist API | `app/api/checklists/generate-corrective-work-order-enhanced/route.ts` | Insert object ~line 456 |
| Incident | DB function `generate_work_order_from_incident` | Requires migration or API post-update |

### Implementation Steps

**1. WorkOrderForm**
- Before insert, fetch asset's plant_id if not already in state: `assets` has `plant_id` in some selects; verify. If missing, add to assets fetch: `.select("id, name, asset_id, plant_id")`.
- In workOrderData: `plant_id: selectedAssetPlantId || assets.find(a=>a.id===formData.asset_id)?.plant_id || null`
- Ensure `selectedAssetPlantId` is set when asset changes (already done in handleAssetChange).

**2. NewMaintenancePage**
- Asset comes from `useAsset(assetId)`; check if it includes plant_id.
- Add `plant_id: asset?.plant_id ?? null` to workOrderData.

**3. Checklist API**
- Request already has `asset_id`. Before insert, fetch: `const { data: asset } = await supabase.from('assets').select('plant_id').eq('id', asset_id).single()`.
- Add `plant_id: asset?.plant_id ?? null` to insert object.

**4. Incident**
- Option A: Add migration to alter `generate_work_order_from_incident` to set plant_id from incident's asset. Option B: Post-insert update in API route. Recommend Option B for now: after RPC returns, fetch WO and asset, update WO with plant_id if null.

### Acceptance Criteria
- [ ] Standalone form: plant_id set when asset has plant_id.
- [ ] Preventive form: plant_id set from asset.
- [ ] Checklist API: plant_id set from asset.
- [ ] Incident: plant_id set (via API post-update or DB migration).

### Subagent 1.2 Prompt

```
TASK: Set plant_id at work order creation in all four paths.

FILES:
1. components/work-orders/work-order-form.tsx - add plant_id to workOrderData (use selectedAssetPlantId or fetch from assets)
2. app/activos/[id]/mantenimiento/nuevo/page.tsx - add plant_id: asset?.plant_id to workOrderData
3. app/api/checklists/generate-corrective-work-order-enhanced/route.ts - fetch asset plant_id before insert; add to insert object
4. app/api/work-orders/generate-from-incident/route.ts - after RPC success, fetch WO and asset, update work_orders set plant_id = asset.plant_id where id = workOrderId

REQUIREMENTS:
- plant_id must come from asset.plant_id
- If asset has no plant_id, leave work_orders.plant_id null
- Do not break existing inserts

OUTPUT: Implement all four. Run npm run build. Return summary.
```

---

## Phase 1.3: Map Incident Documents to work_orders.creation_photos

### Objective
When a WO is created from an incident, copy incident `documents` (URLs) into WO `creation_photos` for audit and context.

### Current State
- `incident_history.documents`: JSONB array of URLs (from EvidenceUpload).
- `work_orders.creation_photos`: JSONB array of `{ url, description, category, uploaded_at }`.
- `generate_work_order_from_incident` (DB) does not set creation_photos.

### Approach
Post-creation update in API route. After RPC returns workOrderId:
1. Fetch incident by id (from request body).
2. Read `documents` (array of URLs or objects).
3. Map to creation_photos format: `documents.map(d => typeof d === 'string' ? { url: d, description: '', category: 'incident', uploaded_at: new Date().toISOString() } : { url: d.url, description: d.description || '', category: d.category || 'incident', uploaded_at: d.uploaded_at || new Date().toISOString() })`.
4. Update work_orders: `{ creation_photos: mappedPhotos }` where id = workOrderId.

### File
- `app/api/work-orders/generate-from-incident/route.ts`

### Acceptance Criteria
- [ ] Incident with documents produces WO with creation_photos populated.
- [ ] WO details evidence section shows incident photos.
- [ ] Incident with no documents: WO creation_photos remains empty array.

### Subagent 1.3 Prompt

```
TASK: Map incident_history.documents to work_orders.creation_photos when creating WO from incident.

FILE: app/api/work-orders/generate-from-incident/route.ts

FLOW:
1. After RPC returns workOrderId successfully
2. Fetch incident: supabase.from('incident_history').select('documents').eq('id', incident_id).single()
3. If documents exists and is non-empty array, map to creation_photos format: [{ url, description: '', category: 'incident', uploaded_at }]
4. Handle both string URLs and object format
5. Update work_orders: .update({ creation_photos: mapped }).eq('id', workOrderId)

REFERENCE: work_orders.creation_photos expects [{ url, description, category, uploaded_at }]

OUTPUT: Implement. Test with incident that has documents. Return summary.
```

---

## Phase 1.4: Map Checklist Issue Photos to work_orders.creation_photos

### Objective
When a corrective WO is created from a checklist issue, include the issue's photo in WO `creation_photos`.

### Current State
- `items_with_issues` has `photo` or `photo_url` per item.
- API insert does not set creation_photos.
- Issue object: `{ id, description, notes, status, photo_url?, photo? }`.

### Implementation
In `generate-corrective-work-order-enhanced` route, when creating a **new** WO (not consolidating):
1. Build creation_photos array from issues: for each issue with `photo_url || photo`, add `{ url, description: issue.description || '', category: 'checklist', uploaded_at: new Date().toISOString() }`.
2. Add `creation_photos: creationPhotosArray` to the insert object (line ~456).

For **consolidation**, optionally append new issue photos to existing WO's creation_photos (lower priority).

### File
- `app/api/checklists/generate-corrective-work-order-enhanced/route.ts`

### Acceptance Criteria
- [ ] New WO from checklist with issue photos has creation_photos populated.
- [ ] WO details evidence section shows checklist issue photos.
- [ ] Issues with no photo: creation_photos = [] or omit.

### Subagent 1.4 Prompt

```
TASK: Add creation_photos to checklist-origin work orders from issue photos.

FILE: app/api/checklists/generate-corrective-work-order-enhanced/route.ts

CONTEXT: When creating NEW work order (not consolidating), around line 456. Each issue can have photo_url or photo.

REQUIREMENTS:
1. Before insert, build creation_photos array from items_with_issues
2. For each issue with (issue.photo_url || issue.photo): add { url, description: issue.description, category: 'checklist', uploaded_at }
3. Add creation_photos to insert object
4. Handle both photo and photo_url (API expects photo_url; dialog may send photo)

OUTPUT: Implement. Run build. Return summary.
```

---

## Phase 1 Completion Checklist
- [ ] Subagent 1.1 complete: next_due updated on preventive completion
- [ ] Subagent 1.2 complete: plant_id set in all four creation paths
- [ ] Subagent 1.3 complete: incident documents → creation_photos
- [ ] Subagent 1.4 complete: checklist issue photos → creation_photos
- [ ] Full regression: create WO via each path, complete preventive, verify data

---

# PHASE 2: Edit Form – Origin-Aware Guidance

*Estimated: 2–3 days. Two subagents: one for logic, one for UI.*

---

## Phase 2.1: Origin-Aware Edit Form Logic

### Objective
Detect auto-created WOs (incident_id or checklist_id) and compute a "planificación pendiente" checklist for the coordinator.

### Files
- `components/work-orders/work-order-edit-form.tsx`
- `app/ordenes/[id]/editar/page.tsx` (passes workOrder prop)

### Logic
- `isAutoCreated = !!(workOrder.incident_id || workOrder.checklist_id)`.
- `planningGaps = []`: if `isAutoCreated` and `!planned_date` → push `{ id: 'planned_date', label: 'Fecha programada para revisión', done: false }`; if `!assigned_to` → push `{ id: 'assigned_to', label: 'Asignar técnico', done: false }`; if `!required_parts?.length` → push `{ id: 'required_parts', label: 'Agregar repuestos (si aplica)', done: false }`.
- Expose `planningGaps` and `isAutoCreated` for the UI.

### Subagent 2.1 Prompt

```
TASK: Add origin-aware planning gap logic to WorkOrderEditForm.

FILE: components/work-orders/work-order-edit-form.tsx

REQUIREMENTS:
1. Compute isAutoCreated = !!(workOrder.incident_id || workOrder.checklist_id)
2. Compute planningGaps: array of { id, label, done }
   - planned_date: 'Fecha programada para revisión' when null
   - assigned_to: 'Asignar técnico' when null  
   - required_parts: 'Agregar repuestos (si aplica)' when empty (optional for incident; coordinator decides)
3. Mark done=true when the field is now populated (compare to formData)
4. Export or use planningGaps in the same component for Phase 2.2

OUTPUT: Add the logic. Do not change existing form layout yet.
```

---

## Phase 2.2: Origin-Aware Edit Form UI

### Objective
Show a "Completar planificación" band for auto-created WOs with checklist of pending items.

### Design
- Above the first card, when `isAutoCreated && planningGaps.length > 0`:
- Compact Alert or Card: "Completar planificación para esta orden"
- List of items: checkmark when done, empty circle when pending. Each item links focus to the relevant field (e.g. clicking "Fecha programada" scrolls/focuses planned_date).
- Use `pb-2 px-4 pt-4` compact styling. Background: muted (e.g. `bg-muted/50`).

### File
- `components/work-orders/work-order-edit-form.tsx`

### Acceptance Criteria
- [ ] Auto-created WO shows "Completar planificación" band.
- [ ] Manual/preventive WO does not show the band.
- [ ] Checklist items update (done/pending) as user fills fields.
- [ ] Band hides when all gaps are filled.

### Subagent 2.2 Prompt

```
TASK: Add "Completar planificación" band UI to WorkOrderEditForm for auto-created WOs.

FILE: components/work-orders/work-order-edit-form.tsx

REQUIREMENTS:
1. Use planningGaps and isAutoCreated from Phase 2.1
2. When isAutoCreated && planningGaps.some(g => !g.done), render a band above the first Card
3. Band content: "Completar planificación para esta orden" + list of planningGaps
4. Each item: Check icon if done, Circle if pending; label from planningGap
5. Style: Alert or Card, compact (pb-2 px-4 pt-4), bg-muted/50
6. Follow Apple HIG: clarity, deference, feedback
7. Use Lucide icons: Check, Circle

OUTPUT: Implement. Ensure band does not show for manual/preventive WOs.
```

---

## Phase 2 Completion Checklist
- [ ] Subagent 2.1: planning gap logic
- [ ] Subagent 2.2: "Completar planificación" band UI
- [ ] Test: Edit incident WO, edit checklist WO, edit manual WO

---

# PHASE 3: Creation Form – Structure and Terminology

*Estimated: 3–4 days. Three subagents.*

---

## Phase 3.1: WorkOrderForm – Section Order and Terminology

### Objective
Align WorkOrderForm with the details view structure and unified terminology.

### Target Section Order
1. **Context band** (when asset selected): asset_id, location, current hours
2. **Resumen de la orden**: type, priority, description (Problema reportado)
3. **Programación**: planned_date
4. **Asignación y recursos**: assigned_to, estimated_duration, checklist toggle
5. **Repuestos requeridos**
6. **Evidencia de Creación**

### Terminology Changes
| Current | Target |
|---------|--------|
| Información General | Resumen de la orden |
| Descripción / Título | Problema reportado |
| Evidencia Inicial | Evidencia de Creación |

### Card Styling
- `CardHeader className="pb-2 px-4 pt-4"`
- `CardTitle className="text-base"`
- `CardDescription className="text-xs"`

### File
- `components/work-orders/work-order-form.tsx`

### Subagent 3.1 Prompt

```
TASK: Reorder sections and unify terminology in WorkOrderForm.

FILE: components/work-orders/work-order-form.tsx

REQUIREMENTS:
1. Section order: (1) Asset/context when selected, (2) Resumen: type, priority, description, (3) Programación: planned_date, (4) Asignación: assigned_to, estimated_duration, checklist, (5) Repuestos, (6) Evidencia de Creación
2. Rename: "Información General" → "Resumen de la orden"; "Descripción / Título" → "Problema reportado"; "Evidencia Inicial" → "Evidencia de Creación"
3. Add lightweight context band when asset selected: show asset_id, location (from assets), current_hours if available. Use a small Card or div with compact styling.
4. Apply compact card styling: CardHeader pb-2 px-4 pt-4, CardTitle text-base, CardDescription text-xs
5. Put description/Problema reportado FIRST in Resumen, then type and priority
6. Remove console.log in handleSubmit and handlePartSelect
7. Ensure asset fetch includes plant_id, location, current_hours for context band

OUTPUT: Implement. Run build. Return summary.
```

---

## Phase 3.2: NewMaintenancePage – Technician Select and Terminology

### Objective
Replace free-text "Técnico Propuesto" with Select of profiles; align terminology with WorkOrderForm.

### Files
- `app/activos/[id]/mantenimiento/nuevo/page.tsx`

### Changes
1. Replace `proposedTechnician` (Input) with `assigned_to` (Select of profiles from supabase).
2. Fetch profiles: `supabase.from('profiles').select('*').order('nombre')`.
3. Store `assigned_to` as UUID in workOrderData; remove proposedTechnician.
4. Terminology: "Evidencia de Creación" or "Documentación de planificación" for planning documents (align with plan).
5. Compact card styling where applicable.

### Subagent 3.2 Prompt

```
TASK: Replace proposedTechnician with assigned_to Select and align terminology in NewMaintenancePage.

FILE: app/activos/[id]/mantenimiento/nuevo/page.tsx

REQUIREMENTS:
1. Add state: assigned_to (string | null) instead of proposedTechnician
2. Fetch profiles from supabase; render Select with "No asignar" + profiles (nombre apellido)
3. workOrderData.assigned_to = assigned_to (user id)
4. Remove proposedTechnician from state and UI
5. Validate: plannedDate, workDescription required; assigned_to can be empty
6. Terminology: use "Evidencia de Creación" for planningDocuments label
7. Apply compact Card styling to match WorkOrderForm (pb-2 px-4 pt-4, text-base, text-xs)

OUTPUT: Implement. Run build. Return summary.
```

---

## Phase 3.3: Edit Form – Section Order and Styling

### Objective
Align edit form section order and styling with creation form and details view.

### Target Section Order
1. Resumen de la orden: type, priority, description, asset
2. Programación: planned_date
3. Asignación: assigned_to, estimated_duration, status
4. Repuestos requeridos
5. Evidencia de Creación

### File
- `components/work-orders/work-order-edit-form.tsx`

### Subagent 3.3 Prompt

```
TASK: Reorder sections and apply compact styling to WorkOrderEditForm.

FILE: components/work-orders/work-order-edit-form.tsx

REQUIREMENTS:
1. Section order: (1) Resumen: type, priority, description, asset, (2) Programación: planned_date, (3) Asignación: assigned_to, estimated_duration, status, checklist, (4) Repuestos, (5) Evidencia de Creación
2. Rename "Información general" → "Resumen de la orden"; "Evidencia de creación" → "Evidencia de Creación"
3. Put description/Problema reportado first in Resumen, then type and priority
4. Compact styling: CardHeader pb-2 px-4 pt-4, CardTitle text-base, CardDescription text-xs
5. Hover states on buttons: transition-colors duration-200
6. cursor-pointer on all clickable elements
7. Integration with Phase 2.2 band: ensure "Completar planificación" band appears above Resumen when applicable

OUTPUT: Implement. Run build. Return summary.
```

---

## Phase 3 Completion Checklist
- [ ] Subagent 3.1: WorkOrderForm reorder and terminology
- [ ] Subagent 3.2: NewMaintenancePage technician Select
- [ ] Subagent 3.3: Edit form reorder and styling
- [ ] Visual consistency across create and edit

---

# PHASE 4: Polish and Validation

*Estimated: 1–2 days. One subagent.*

---

## Phase 4.1: Validation and UX Polish

### Objective
Add validation, improve feedback, ensure accessibility.

### Tasks
1. **WorkOrderForm**: For preventive type, warn if planned_date is empty (Alert or inline hint).
2. **WorkOrderForm**: Validate estimated_duration (min 0, step 0.5, reasonable max e.g. 999).
3. **Edit form**: Inline validation errors for required fields.
4. **All forms**: Ensure Label associations (htmlFor), aria-labels on icon-only buttons.
5. **prefers-reduced-motion**: Avoid or shorten non-essential animations.

### Subagent 4.1 Prompt

```
TASK: Add validation and UX polish to WorkOrderForm and WorkOrderEditForm.

FILES: work-order-form.tsx, work-order-edit-form.tsx

REQUIREMENTS:
1. WorkOrderForm: When type is Preventive and planned_date is empty, show Alert or inline hint "Se recomienda programar fecha para preventivas"
2. WorkOrderForm: estimated_duration input: min=0, step=0.5, max=999
3. Edit form: Show inline validation when description empty on submit
4. All forms: Verify every Input/Select/Textarea has Label with htmlFor; icon buttons have aria-label
5. Remove any animation that could trigger motion sensitivity; or add prefers-reduced-motion:reduce media query
6. Focus: Ensure first field gets focus on mount where appropriate

OUTPUT: Implement. Run build and lint. Return summary.
```

---

# Execution Summary

| Phase | Subagents | Estimated |
|-------|-----------|-----------|
| 1 | 1.1, 1.2, 1.3, 1.4 (parallel) | 2–3 days |
| 2 | 2.1, 2.2 (2.2 depends on 2.1) | 2–3 days |
| 3 | 3.1, 3.2, 3.3 (parallel) | 3–4 days |
| 4 | 4.1 | 1–2 days |

**Total:** ~8–12 days with parallel subagent execution.

---

# Reference: Key Files

| Purpose | Path |
|---------|------|
| Standalone creation | `components/work-orders/work-order-form.tsx` |
| Preventive creation | `app/activos/[id]/mantenimiento/nuevo/page.tsx` |
| Edit form | `components/work-orders/work-order-edit-form.tsx` |
| Checklist WO API | `app/api/checklists/generate-corrective-work-order-enhanced/route.ts` |
| Incident WO API | `app/api/work-orders/generate-from-incident/route.ts` |
| Completion API | `app/api/maintenance/work-completions/route.ts` |
| Details styling reference | `components/work-orders/details/work-order-general-info-card.tsx` |

---

# Reference: Compact Card Styling

```tsx
<Card>
  <CardHeader className="pb-2 px-4 pt-4">
    <CardTitle className="text-base">Resumen de la orden</CardTitle>
    <CardDescription className="text-xs">Descripción opcional</CardDescription>
  </CardHeader>
  <CardContent className="px-4 pb-4 pt-0 space-y-3">
    {/* content */}
  </CardContent>
</Card>
```

---

*Plan version: 2.0. Implementation-ready with subagent prompts.*
