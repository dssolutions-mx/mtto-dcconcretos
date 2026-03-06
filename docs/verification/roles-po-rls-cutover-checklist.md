# Roles, PO, and RLS Migration — Cutover Checklist

> Status: **READY FOR CUTOVER**
> Date: 2026-03-06
> Plan: `docs/plans/2026-03-06-roles-po-rls-migration.md`

---

## Pre-Cutover: DB Enum

- [ ] `GERENTE_MANTENIMIENTO` present in `public.user_role` enum
- [ ] `COORDINADOR_MANTENIMIENTO` present in `public.user_role` enum
- [ ] `MECANICO` present in `public.user_role` enum
- [ ] `RECURSOS_HUMANOS` present in `public.user_role` enum

Verify with:
```sql
SELECT unnest(enum_range(NULL::public.user_role))::text AS role ORDER BY role;
```

---

## 1. Four PO Approval Paths

### Path A — Inventory Use, Preventive (`work_order_inventory` + preventive OT)
- [ ] Technical approval by `GERENTE_MANTENIMIENTO` advances directly to warehouse release
- [ ] Administration step is skipped
- [ ] GM step is skipped regardless of amount

### Path B — Inventory Use, Corrective (`work_order_inventory` + corrective OT)
- [ ] Technical approval by `GERENTE_MANTENIMIENTO`
- [ ] Administration step is skipped
- [ ] Amount >= $7,000 MXN -> escalates to GM; below goes directly to warehouse

### Path C — Inventory Restock (`inventory_restock`)
- [ ] Technical approval by `GERENTE_MANTENIMIENTO`
- [ ] Administration viability review is required
- [ ] Payment condition (cash/credit) displayed prominently to Administration
- [ ] Amount >= $7,000 MXN -> escalates to GM after viability
- [ ] GM cannot approve before Administration sets viability (expect HTTP 403)

### Path D — External Cash / Mixed
- [ ] Technical approval by `GERENTE_MANTENIMIENTO`
- [ ] Administration viability review is required
- [ ] Preventive OT: after viability -> CxP, no GM escalation
- [ ] Corrective OT: after viability -> GM if >= $7,000 MXN, else CxP

---

## 2. Viability UI

- [ ] `WorkflowStatusDisplay` shows "Condicion de Pago" (cash/credit) clearly for Paths C and D
- [ ] "Gerente de Mantenimiento" label is displayed (not "Jefe de Unidad de Negocio")
- [ ] Viability status block updates after Administration records their decision

---

## 3. Email Approvals

- [ ] PO creation triggers notification to `GERENTE_MANTENIMIENTO` only
- [ ] Email approval action links work via process and direct-action routes
- [ ] Administration viability email sent when PO reaches viability step
- [ ] GM escalation email sent only when amount threshold is crossed

---

## 4. Warehouse Assignment Enforcement

- [ ] `ENCARGADO_ALMACEN` can release, receive, and adjust inventory
- [ ] `GERENTE_MANTENIMIENTO` can release, receive, and adjust (fallback authority)
- [ ] `COORDINADOR_MANTENIMIENTO` cannot release, receive, or adjust
- [ ] `MECANICO` cannot release, receive, or adjust
- [ ] `fulfill-from-inventory` route returns 403 for unauthorized roles
- [ ] `receive-to-inventory` route returns 403 for unauthorized roles
- [ ] `inventory/stock/adjust` route returns 403 for unauthorized roles
- [ ] Explicit `warehouse_responsibilities` row overrides role-based fallback

---

## 5. RH Ownership Flows

- [ ] `POST /api/operators/register` — only RECURSOS_HUMANOS or GERENCIA_GENERAL
- [ ] `PUT /api/users/update-authorization` — only RH or GM
- [ ] `POST /api/users/deactivate` — only RH or GM
- [ ] `DELETE /api/users/[id]` — only RH or GM
- [ ] `POST /api/asset-operators` — only RH or GM
- [ ] `PUT /api/asset-operators` — only RH or GM
- [ ] `DELETE /api/asset-operators` — only RH or GM
- [ ] `POST /api/asset-operators/transfer` — only RH or GM
- [ ] `POST /api/compliance/sanctions` — only RH or GM
- [ ] `PATCH /api/compliance/sanctions/[id]` — only RH or GM
- [ ] `POST /api/compliance/incidents/[id]/dispute/review` — only RH or GM
- [ ] `GET /api/hr/checklist-compliance` — only RH or GM

---

## 6. No RLS on profiles

- [ ] `profiles` table has NO RLS policies enabled

Verify:
```sql
SELECT policyname FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public';
-- Expected: 0 rows
```

---

## 7. Build

- [ ] `npm run build` exits 0

---

## Sign-off

| Check | Owner | Date | Pass/Fail |
|-------|-------|------|-----------|
| DB enum values | DevOps | | |
| Four PO paths | QA | | |
| Email approvals | QA | | |
| Warehouse enforcement | QA | | |
| RH ownership | QA | | |
| profiles no-RLS | DevOps | | |
| Build | CI | | |
