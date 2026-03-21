-- Align profiles.business_role with POL-OPE-001/002: JUN is not Gerente de Mantenimiento;
-- Jefe de Planta is not Coordinador de Mantenimiento.
-- Safe to re-run (idempotent condition).

UPDATE public.profiles
SET business_role = 'JEFE_UNIDAD_NEGOCIO'
WHERE role = 'JEFE_UNIDAD_NEGOCIO'
  AND (business_role IS DISTINCT FROM 'JEFE_UNIDAD_NEGOCIO');

UPDATE public.profiles
SET business_role = 'JEFE_PLANTA'
WHERE role = 'JEFE_PLANTA'
  AND (business_role IS DISTINCT FROM 'JEFE_PLANTA');
