-- Checklist template executor roles: who may complete schedules from this template.
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS executor_roles text[]
  DEFAULT ARRAY[
    'OPERADOR',
    'MECANICO',
    'DOSIFICADOR',
    'JEFE_PLANTA',
    'COORDINADOR_MANTENIMIENTO',
    'GERENTE_MANTENIMIENTO'
  ]::text[];

COMMENT ON COLUMN public.checklists.executor_roles IS
  'Roles allowed to complete schedules generated from this checklist template.';

-- PLANTA templates: only dosificador and jefe de planta execute plant-control checklists.
UPDATE public.checklists c
SET executor_roles = ARRAY['DOSIFICADOR', 'JEFE_PLANTA']::text[]
FROM public.equipment_models em
WHERE c.model_id = em.id
  AND (
    c.model_id = '2c7bcf18-8a9c-4c9b-b85f-702ee0177896'::uuid
    OR em.maintenance_unit = 'none'
  );
