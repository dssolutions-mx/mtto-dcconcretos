# Roles, PO, and RLS Migration — Rollback Guide

> Date: 2026-03-06
> Plan: `docs/plans/2026-03-06-roles-po-rls-migration.md`

---

## Rollback Boundaries

Each section below identifies the rollback point and the SQL/code action needed.

---

## 1. Workflow Engine Cutover

**What changed:** `advance-workflow/[id]/route.ts` now uses `workflow-policy.ts` for four-path routing and has a viability gate for Paths C/D.

**Rollback condition:** Workflow is broken for any PO type.

**Rollback action:**

Roll back to the commit before Task 4 was merged (see `git log`). The file to revert is:
```
app/api/purchase-orders/advance-workflow/[id]/route.ts
```

No DB migration rollback needed — the app-layer change is the only gate.

---

## 2. Inventory Assignment Enforcement

**What changed:**
- `lib/auth/warehouse-responsibility.ts` — legacy fallback now includes new roles
- `lib/inventory/warehouse-authority.ts` — checks `warehouse_responsibilities` table
- API routes gated with `canUserReleaseInventory`, `canUserReceiveInventory`, `canUserAdjustInventory`
- `migrations/sql/20260306_refactor_inventory_rls_warehouse_authority.sql` — RLS uses `user_has_warehouse_permission`

**Rollback condition:** Legitimate users with `ENCARGADO_ALMACEN` or legacy roles cannot perform inventory operations.

**Rollback action (app layer):**

Revert `lib/auth/warehouse-responsibility.ts` to remove the four new role entries (GERENTE_MANTENIMIENTO, COORDINADOR_MANTENIMIENTO, MECANICO, RECURSOS_HUMANOS).

**Rollback action (DB layer):**

To revert RLS policies to legacy role membership checks:
```sql
-- Drop the helper function and restore simple role-based policies
DROP FUNCTION IF EXISTS public.user_has_warehouse_permission(uuid, uuid, text);

-- Restore the original policies from migrations/sql/20250125_006_create_inventory_rls.sql
-- (re-apply that migration after dropping the refactored policies)
```

---

## 3. RH Ownership Routes

**What changed:** These routes now call `loadActorContext` + `canManageComplianceSanctions`/`canManageAssetOperators`/`canReviewComplianceDispute` instead of hardcoded `allowedRoles` arrays:
- `app/api/compliance/sanctions/route.ts`
- `app/api/compliance/sanctions/[id]/route.ts`
- `app/api/compliance/incidents/[id]/dispute/review/route.ts`
- `app/api/asset-operators/route.ts`
- `app/api/asset-operators/transfer/route.ts`

**Rollback condition:** Users with `GERENCIA_GENERAL`, `JEFE_UNIDAD_NEGOCIO`, `AREA_ADMINISTRATIVA` lose access to sanctions/compliance management.

**Rollback action:**

Revert the affected route files to their previous versions from git:
```bash
git show HEAD~1:app/api/compliance/sanctions/route.ts > app/api/compliance/sanctions/route.ts
# repeat for each file
```

Note: `RECURSOS_HUMANOS` will lose access under rollback — coordinate with operations team.

---

## 4. SQL Migration Rollback Boundaries

**Migrations that can be rolled back (no destructive data loss):**

| Migration | Safe to Rollback? | Notes |
|-----------|------------------|-------|
| `20260306_add_profiles_business_role_scope.sql` | Yes | Adds columns; DROP COLUMN if needed |
| `20260306_add_purchase_order_routing_columns.sql` | Yes | Adds columns; DROP COLUMN if needed |
| `20260306_refactor_inventory_rls_warehouse_authority.sql` | Yes | Replaces function; re-run original |
| `add_new_roles_to_user_role_enum` | **NO** | PostgreSQL enums cannot remove values once added |

**Critical note on enum rollback:**

`GERENTE_MANTENIMIENTO`, `COORDINADOR_MANTENIMIENTO`, `MECANICO`, and `RECURSOS_HUMANOS` were added to the `public.user_role` enum via `ALTER TYPE ... ADD VALUE`. These **cannot be removed from a live Postgres enum**.

If a full rollback is required:
1. Create a replacement enum without the new values
2. Migrate all columns to the new enum
3. Drop the old enum
4. This is disruptive and requires maintenance window

**Recommended approach:** Instead of removing enum values, keep them in DB but revert app-layer code to ignore them.

---

## 5. Types Rollback

**What changed:** `types/supabase-types.ts` updated to include new enum values.

**Rollback action:**

Remove the four new entries from the `user_role` union type and Constants array:
```
GERENTE_MANTENIMIENTO
COORDINADOR_MANTENIMIENTO
MECANICO
RECURSOS_HUMANOS
```

This is safe and does not require a DB change.

---

## Quick Rollback Commands

```bash
# Revert specific files to last commit
git checkout HEAD -- app/api/purchase-orders/advance-workflow/[id]/route.ts
git checkout HEAD -- lib/auth/warehouse-responsibility.ts
git checkout HEAD -- app/api/compliance/sanctions/route.ts
# etc.

# Verify build still passes
npm run build
```

---

## Contact / Decision Authority

Rollback decisions require sign-off from the engineering lead. Do not revert DB migrations without explicit approval.
