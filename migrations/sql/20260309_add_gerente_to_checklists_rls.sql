-- Add GERENTE_MANTENIMIENTO and COORDINADOR_MANTENIMIENTO to checklists table RLS
-- Ensures maintenance managers can access checklist templates for completion flow
-- Complements: 20260309_add_gerente_to_checklist_template_versions_rls.sql

DROP POLICY IF EXISTS "Checklist templates access control" ON public.checklists;

CREATE POLICY "Checklist templates access control" ON public.checklists
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
