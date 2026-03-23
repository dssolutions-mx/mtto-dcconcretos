-- Add GERENTE_MANTENIMIENTO and COORDINADOR_MANTENIMIENTO to checklist_template_versions RLS
-- Fixes: Gerente de Mantenimiento cannot register/complete checklists due to missing role in policy
-- See: RLS Checklist and Gerente de Mantenimiento Access Fix plan

DROP POLICY IF EXISTS "Checklist template versions hierarchical access" ON public.checklist_template_versions;

CREATE POLICY "Checklist template versions hierarchical access" ON public.checklist_template_versions
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = ANY (ARRAY[
        'GERENCIA_GENERAL'::public.user_role,
        'JEFE_UNIDAD_NEGOCIO'::public.user_role,
        'ENCARGADO_MANTENIMIENTO'::public.user_role,
        'JEFE_PLANTA'::public.user_role,
        'DOSIFICADOR'::public.user_role,
        'EJECUTIVO'::public.user_role,
        'VISUALIZADOR'::public.user_role,
        'GERENTE_MANTENIMIENTO'::public.user_role,
        'COORDINADOR_MANTENIMIENTO'::public.user_role
      ])
      AND p.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = ANY (ARRAY[
        'GERENCIA_GENERAL'::public.user_role,
        'JEFE_UNIDAD_NEGOCIO'::public.user_role,
        'ENCARGADO_MANTENIMIENTO'::public.user_role,
        'EJECUTIVO'::public.user_role,
        'GERENTE_MANTENIMIENTO'::public.user_role,
        'COORDINADOR_MANTENIMIENTO'::public.user_role
      ])
      AND p.status = 'active'
  )
);
