-- Backfill business_role for GERENTE_MANTENIMIENTO profiles
-- Ensures role resolution is consistent for the new role model (POL-OPE-001/002)
-- See: lib/auth/role-model.ts, app/api/purchase-orders/approval-context

UPDATE public.profiles
SET
  business_role = 'GERENTE_MANTENIMIENTO',
  role_scope = COALESCE(role_scope, 'global')
WHERE role = 'GERENTE_MANTENIMIENTO'
  AND (business_role IS NULL OR business_role != 'GERENTE_MANTENIMIENTO');
