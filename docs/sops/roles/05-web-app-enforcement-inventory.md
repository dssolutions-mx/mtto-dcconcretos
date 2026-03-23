# Web app enforcement inventory

## Methodology (required)

1. **Enumerate routes:**  
   - `find app -name 'page.tsx'` — **131** files at pack generation (`f71dd87`).  
   - `find app/api -name 'route.ts'` — **148** files at pack generation.

2. **Per `ModulePermissions` key** (from `lib/auth/role-permissions.ts`): maintain a table with columns:  
   `Route or API` | `Enforcement` | `Verified file` | `POL / SOP ref` | `Status`

3. **Status values:**  
   - `OK` — inspected; file path listed.  
   - `PARTIAL` — some checks exist; not all mutations covered.  
   - `GAP` — policy expectation not found in listed files.  
   - `UNVERIFIED` — not yet searched; include suggested `rg` pattern.

4. **Server actor pattern:** `rg "loadActorContext" app/api lib` — files **verified** at pack generation:

   - `app/api/purchase-orders/approval-context/route.ts`  
   - `app/api/purchase-orders/advance-workflow/[id]/route.ts`  
   - `app/api/asset-operators/transfer/route.ts`  
   - `app/api/asset-operators/route.ts`  
   - `app/api/users/deactivate/route.ts`  
   - `app/api/users/[id]/route.ts`  
   - `app/api/users/update-authorization/route.ts`  
   - `app/api/authorization/summary/route.ts`  
   - `app/api/authorization/limits/route.ts`  
   - `app/api/operators/register/route.ts`  
   - `app/api/operators/register/[id]/route.ts`  
   - `app/api/compliance/sanctions/route.ts`  
   - `app/api/compliance/sanctions/[id]/route.ts`  
   - `app/api/compliance/incidents/[id]/dispute/review/route.ts`  
   - `app/api/hr/checklist-compliance/route.ts`  
   - `app/api/hr/cleanliness-reports/route.ts` (GET: `getUser` + `loadActorContext` + `canAccessRHReporting`)  
   - `lib/auth/server-authorization.ts` (definition)

5. **Client permission helpers:** `rg "hasModuleAccess|hasWriteAccess|RoleGuard" components hooks app` — **verified** hits include:  
   `lib/auth/role-permissions.ts`, `hooks/use-auth-zustand.ts`, `components/auth/role-guard.tsx`, `app/gestion/credenciales/page.tsx`, `app/credencial/page.tsx`, `components/credentials/employee-credentials-manager.tsx`.

6. **App route map (authenticated):** `ROUTE_MODULE_RULES` in `lib/auth/role-permissions.ts` uses longest-prefix matching; **`canAccessRoute` denies by default** for dashboard paths not listed (public/auth routes remain explicitly allowed). `components/auth/role-provider.tsx` uses **`effectiveRoleForPermissions(profile)`** for redirects, aligned with `useAuthZustand` module checks. Canonical personal URL: **`/gestion/personal`** (`next.config.mjs` redirects `/personal` and `/organizacion/personal`).

7. **Client mirrors for RH UI:** `lib/auth/client-authorization.ts` — `canAccessRHReportingNav`, `canRegisterOperatorsClient`, `canManageUserAuthorizationClient` (use with sidebar and pages).

**UNVERIFIED:** Full per-page `page.tsx` audit against each module — run:  
`rg "hasModuleAccess\\(|hasWriteAccess\\(|RoleGuard" app --glob "*.tsx"` and map results into this doc in a follow-up edit.

**Manual QA:** Role-based checklist for personnel/RH after hardening — [08-hr-rbac-manual-qa.md](./08-hr-rbac-manual-qa.md).

---

## Module: `assets`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| (nav + pages) | `ModulePermissions.assets` via sidebar / guards | `components/sidebar.tsx` | POL002 Movimientos | UNVERIFIED per-route |
| Asset operators API | `loadActorContext` | `app/api/asset-operators/route.ts`, `transfer/route.ts` | POL002 asignación | PARTIAL |

---

## Module: `maintenance`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| Dashboard / maintenance UI | Client profile + nav | `components/sidebar.tsx`, `hooks/use-auth-zustand.ts` | POL001 PAT / Preventivo | UNVERIFIED per-route |

---

## Module: `work_orders`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| Work order flows | Mixed API + UI | UNVERIFIED | POL001 OT | UNVERIFIED |

---

## Module: `purchases`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| PO workflow advance | `loadActorContext` | `app/api/purchase-orders/advance-workflow/[id]/route.ts` | POL001/002 OC | PARTIAL |
| PO approval context | `loadActorContext` | `app/api/purchase-orders/approval-context/route.ts` | POL002 Tipo A/B | PARTIAL |
| Policy rules in code | Workflow constants | `lib/purchase-orders/workflow-policy.ts` | POL001/002 montos | OK |

---

## Module: `inventory`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| Inventory APIs | RLS + route auth (per discovery report) | See [04-database-profiles-rls-and-tables.md](./04-database-profiles-rls-and-tables.md) | POL002 Almacén | UNVERIFIED per-route |

---

## Module: `personnel`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| User update authorization | `loadActorContext` + role checks | `app/api/users/update-authorization/route.ts` | POL001 Alta | PARTIAL |
| User deactivate | `loadActorContext` | `app/api/users/deactivate/route.ts` | POL001/002 | PARTIAL |
| Operators register GET | `loadActorContext` + `canViewOperatorsList`; JUN/JP **scoped** list (Supabase filters + `operatorRowVisibleToJun` in code path) | `app/api/operators/register/route.ts` | POL001 alta / asignación | OK (scoped); RLS per live project — **re-verify** |
| Operators register POST | `canCreateOperators`; RH/GG unscoped; JUN/JP **role allowlist** + `validateJunJpCreatePlacement` (`lib/auth/operator-scope.ts`) | `app/api/operators/register/route.ts` | POL001 alta | OK (scoped); audit via `notas_rh` line |
| Operators register PATCH | Full field update: RH+GG (`canUpdateOperators`); JUN/JP: **placement-only** (`canUpdateOperatorPlacement` + `validateJunJpPatchPlacement`) | `app/api/operators/register/[id]/route.ts` | POL002 asignación | PARTIAL — confirm matrix rows for “procesar alta/baja” |
| Personal UI | `RoleGuard module="personnel"` | `app/gestion/personal/page.tsx`, `app/(dashboard)/personal/page.tsx`, `app/(dashboard)/organizacion/personal/page.tsx` | — | OK |

### Operators API matrix (JUN / JP / RH / GG)

| Actor | GET list | POST create | PATCH |
|-------|----------|-------------|--------|
| **GERENCIA_GENERAL** | All (subject to query) | Yes, broad roles | Full update |
| **RECURSOS_HUMANOS** | All | Yes, broad roles | Full update |
| **JEFE_UNIDAD_NEGOCIO** | Scoped: BU + plants in BU + unassigned (`operatorRowVisibleToJun`) | Yes: `OPERADOR`, `DOSIFICADOR`, `MECANICO` only; BU/plant must match actor | Placement only |
| **JEFE_PLANTA** | Scoped: `plant_id` | Yes: same role allowlist; plant locked to actor | Placement only; UI also restricts drag for unassigned non-operador roles |

**RLS:** If `profiles` RLS is off or permissive (see [07-gaps-drift-and-open-questions.md](./07-gaps-drift-and-open-questions.md)), treat **route + `loadActorContext`** as authoritative for these APIs.

---

## Module: `checklists`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| HR checklist compliance | `loadActorContext` | `app/api/hr/checklist-compliance/route.ts` | POL001 Checklists | PARTIAL |

---

## HR reporting (limpieza / cumplimiento UI + API)

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| Cleanliness reports GET | `getUser` + `loadActorContext` + `canAccessRHReporting` | `app/api/hr/cleanliness-reports/route.ts` | POL002 RH reporting | OK (entry gate); POST paths — confirm same pattern if exposed |
| RH pages | `RHReportingGuard` (`canAccessRHReportingNav`) | `app/rh/limpieza/page.tsx`, `app/rh/cumplimiento-checklists/page.tsx` | — | OK |
| Sidebar RH block | `canAccessRHReportingNav` | `components/sidebar.tsx` | — | OK |

---

## Module: `reports`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| (report routes) | UNVERIFIED | — | KPIs | UNVERIFIED — `rg "loadActorContext" app/api/reports` |

---

## Module: `config`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| Credentials / gestión | `hasModuleAccess` / role checks | `app/gestion/credenciales/page.tsx`, `components/credentials/employee-credentials-manager.tsx` | — | PARTIAL |

---

## Compliance / conciliation (cross-module)

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| Sanctions | `loadActorContext` | `app/api/compliance/sanctions/route.ts`, `[id]/route.ts` | POL001 conciliación | PARTIAL |
| Dispute review | `loadActorContext` | `app/api/compliance/incidents/[id]/dispute/review/route.ts` | POL001 conciliación | PARTIAL |

---

## Authorization summary / limits

| Route or API | Enforcement | Verified file | Status |
|--------------|-------------|---------------|--------|
| Authorization summary | `loadActorContext` (or related) | `app/api/authorization/summary/route.ts` | PARTIAL |
| Authorization limits | `loadActorContext` | `app/api/authorization/limits/route.ts` | PARTIAL |
