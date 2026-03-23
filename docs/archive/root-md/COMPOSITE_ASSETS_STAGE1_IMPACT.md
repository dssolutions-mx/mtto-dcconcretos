## Stage 1 Impact Assessment: Composite Assets

### Scope
Stage 1 introduces database fields and a relationship table for composite assets. No UI changes are shipped in Stage 1, but we must identify all areas that will read/write asset data or will soon need awareness of composites.

### Affected Areas (Read/Write to `assets` or depend on asset identity)

- Pages
  - `app/activos/page.tsx` (assets list)
  - `app/activos/[id]/page.tsx` (asset detail)
  - `app/activos/[id]/incidentes/page.tsx` (asset incidents)
  - `app/checklists/assets/[id]/page.tsx` (asset checklists detail)
  - `app/checklists/assets/page.tsx` (asset checklists dashboard)
  - `app/preventivo/[id]/page.tsx` (preventive maintenance details)
  - `app/activos/[id]/mantenimiento/*` (creation flows, if present)

- API Routes
  - `app/api/assets/route.ts` (list/create)
  - `app/api/assets/[id]/route.ts` (get/update/delete)
  - `app/api/assets/[id]/dashboard/route.ts` (consolidated asset data)
  - `app/api/checklists/schedules/route.ts` and `from-maintenance/route.ts` (schedule creation)
  - `app/api/checklists/assets-dashboard/route.ts` (asset summary)
  - `app/api/incidents/route.ts` (if asset-linked)
  - `app/api/maintenance/work-completions/route.ts` (updates readings)

- Hooks/Services
  - `hooks/useSupabase.ts` (`useAsset`, `useAssets`, `useMaintenanceHistory`, etc.)
  - `lib/api.ts` (maintenanceApi.completeMaintenance updates readings)
  - `lib/services/checklist-to-workorder-service.ts`
  - `lib/services/offline-checklist-service.ts`
  - `lib/services/offline-asset-service.ts`

- Components
  - `components/assets/asset-history.tsx`
  - `components/checklists/*` (schedules, completion, dashboards)
  - `components/preventive/*` (maintenance history/schedules)
  - `components/work-orders/*` (work order creation/views)

### Data Model Updates (now in DB)
- `assets`
  - `is_composite boolean default false`
  - `component_assets uuid[] default '{}'`
  - `composite_type text`
  - `primary_component_id uuid references assets(id)`
- `asset_composite_relationships` (RLS enabled)
  - `composite_asset_id uuid references assets(id)`
  - `component_asset_id uuid references assets(id)`
  - lifecycle fields: `attachment_date`, `detachment_date`, `status`

### TypeScript Types
- Regenerate Supabase types: ensure `assets` includes new fields and `asset_composite_relationships` table is present.
- Update local `types/supabase.ts` or `lib/database.types.ts` usages if needed.

### Read/Write Behavior Considerations
- Reading assets:
  - Stage 1: no change required; readers can ignore composite fields
  - Stage 2+: readers may aggregate component data when `is_composite` is true
- Updating `current_hours` / `current_kilometers`:
  - Stage 1: no sync logic yet (backend to be added in Stage 2)
  - Ensure API endpoints won’t break when arrays/columns exist
- Incidents/Issues:
  - Stage 1: unchanged behavior
  - Stage 2: cascade to components/composite

### Risks
- Queries selecting `SELECT * FROM assets` now return extra fields; ensure serialization tolerates unknown fields
- Any tight JSON schema expectations in the frontend should not break due to new fields

### Next Steps (Stage 1 deliverables)
- [x] DB migration applied with RLS
- [ ] Supabase TypeScript types refreshed and wired in
- [ ] Scaffold new API routes namespace for composite ops (skeleton only):
  - `POST /api/assets/composites` (create composite)
  - `GET /api/assets/composites/[id]` (fetch composite with components)
  - `PUT /api/assets/composites/[id]` (attach/detach components)
  - `DELETE /api/assets/composites/[id]` (optional)

### Validation Checklist
- Columns exist and are defaulted
- RLS policies compile and allow reads/writes within plant/business-unit scope
- No existing pages crash with the added fields
