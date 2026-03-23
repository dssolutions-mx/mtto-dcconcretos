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
   - `lib/auth/server-authorization.ts` (definition)

5. **Client permission helpers:** `rg "hasModuleAccess|hasWriteAccess|RoleGuard" components hooks app` — **verified** hits include:  
   `lib/auth/role-permissions.ts`, `hooks/use-auth-zustand.ts`, `components/auth/role-guard.tsx`, `app/gestion/credenciales/page.tsx`, `app/credencial/page.tsx`, `components/credentials/employee-credentials-manager.tsx`.

**UNVERIFIED:** Full per-page `page.tsx` audit against each module — run:  
`rg "hasModuleAccess\\(|hasWriteAccess\\(|RoleGuard" app --glob "*.tsx"` and map results into this doc in a follow-up edit.

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
| Operators register | `loadActorContext` | `app/api/operators/register/route.ts`, `[id]/route.ts` | POL002 asignación | PARTIAL |

---

## Module: `checklists`

| Route or API | Enforcement | Verified file | POL / SOP | Status |
|--------------|-------------|---------------|-----------|--------|
| HR checklist compliance | `loadActorContext` | `app/api/hr/checklist-compliance/route.ts` | POL001 Checklists | PARTIAL |

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
