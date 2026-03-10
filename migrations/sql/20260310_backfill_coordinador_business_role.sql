-- Backfill business_role and role_scope for COORDINADOR_MANTENIMIENTO profiles
-- Migration 20260306 adds business_role for ENCARGADO and JEFE_PLANTA but not for COORDINADOR.
-- This ensures COORDINADOR_MANTENIMIENTO profiles have consistent role resolution.
-- Migration: 20260310_backfill_coordinador_business_role

UPDATE public.profiles
SET
  business_role = 'COORDINADOR_MANTENIMIENTO',
  role_scope = COALESCE(role_scope, 'plant')
WHERE role = 'COORDINADOR_MANTENIMIENTO'
  AND (business_role IS NULL OR business_role != 'COORDINADOR_MANTENIMIENTO');
