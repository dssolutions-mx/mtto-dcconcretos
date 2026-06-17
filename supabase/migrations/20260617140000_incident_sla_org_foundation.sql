-- Phase 0: Org foundation for incident SLA workflow.
-- 1) Complete canonical department seed (MANT missing on some plants)
-- 2) department_memberships junction (profiles ↔ routing departments)
-- 3) acknowledged_at / acknowledged_by_id on incidents
-- 4) Idempotent backfill from legacy profiles.departamento text

-- ---------------------------------------------------------------------------
-- 1) Complete MANT seed on every plant (seed migration only added OPER/RH/CAL)
-- ---------------------------------------------------------------------------
INSERT INTO public.departments (plant_id, code, name)
SELECT p.id, 'MANT', 'Mantenimiento'
FROM public.plants p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.departments d
  WHERE d.plant_id = p.id
    AND lower(d.code) IN ('mant', 'mtto', 'mantenimiento')
);

-- ---------------------------------------------------------------------------
-- 2) Department memberships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.department_memberships (
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'supervisor', 'backup')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'backfill_text', 'supervisor_seed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  PRIMARY KEY (profile_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_department_memberships_department
  ON public.department_memberships (department_id);

CREATE INDEX IF NOT EXISTS idx_department_memberships_profile
  ON public.department_memberships (profile_id);

COMMENT ON TABLE public.department_memberships IS
  'Links profiles to plant-scoped routing departments for incident assignment and SLA ownership.';

ALTER TABLE public.department_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "department_memberships_select"
  ON public.department_memberships
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "department_memberships_insert"
  ON public.department_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role,
          'RECURSOS_HUMANOS'::user_role,
          'EJECUTIVO'::user_role,
          'AREA_ADMINISTRATIVA'::user_role,
          'JEFE_UNIDAD_NEGOCIO'::user_role
        ])
    )
  );

CREATE POLICY "department_memberships_delete"
  ON public.department_memberships
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role,
          'RECURSOS_HUMANOS'::user_role,
          'EJECUTIVO'::user_role,
          'AREA_ADMINISTRATIVA'::user_role,
          'JEFE_UNIDAD_NEGOCIO'::user_role
        ])
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Explicit acknowledge milestone on incidents
-- ---------------------------------------------------------------------------
ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.incident_history.acknowledged_at IS
  'When the routing department took knowledge of the incident (MTTA anchor).';
COMMENT ON COLUMN public.incident_history.acknowledged_by_id IS
  'Profile who acknowledged receipt on behalf of the department.';

CREATE INDEX IF NOT EXISTS idx_incident_history_unack_open
  ON public.incident_history (routing_department_id, acknowledged_at)
  WHERE acknowledged_at IS NULL
    AND merged_into_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4) Backfill memberships from legacy profiles.departamento (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_departamento_matches_department(
  p_departamento text,
  p_dept_code text,
  p_dept_name text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_dept text;
  v_code text;
  v_name text;
BEGIN
  IF p_departamento IS NULL OR btrim(p_departamento) = '' THEN
    RETURN false;
  END IF;

  v_dept := lower(translate(btrim(p_departamento), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'));
  v_code := lower(translate(btrim(p_dept_code), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'));
  v_name := lower(translate(btrim(p_dept_name), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'));

  IF v_dept = v_code OR v_dept = v_name THEN
    RETURN true;
  END IF;

  -- Mantenimiento
  IF v_code IN ('mant', 'mtto') OR v_name LIKE '%mantenimiento%' THEN
    RETURN v_dept LIKE '%mantenimiento%' OR v_dept IN ('mtto', 'mant');
  END IF;

  -- Operaciones / Producción
  IF v_code IN ('oper', 'ops', 'prod') OR v_name LIKE '%operacion%' OR v_name LIKE '%produccion%' OR v_name LIKE '%producción%' THEN
    RETURN v_dept LIKE '%produccion%' OR v_dept LIKE '%producción%' OR v_dept LIKE '%operacion%' OR v_dept LIKE '%operaciones%';
  END IF;

  -- RH
  IF v_code IN ('rh', 'rrhh') OR v_name LIKE '%recursos humanos%' THEN
    RETURN v_dept LIKE '%recursos humanos%' OR v_dept IN ('rh', 'rrhh');
  END IF;

  -- Calidad
  IF v_code IN ('cal', 'qc') OR v_name LIKE '%calidad%' THEN
    RETURN v_dept LIKE '%calidad%' OR v_dept IN ('cal', 'qc');
  END IF;

  RETURN v_dept LIKE '%' || v_name || '%' OR v_name LIKE '%' || v_dept || '%';
END;
$$;

-- Backfill: active profiles with plant_id → matching department on same plant
INSERT INTO public.department_memberships (profile_id, department_id, role, source)
SELECT DISTINCT p.id, d.id, 'member', 'backfill_text'
FROM public.profiles p
JOIN public.departments d ON d.plant_id = p.plant_id
WHERE p.is_active = true
  AND p.plant_id IS NOT NULL
  AND p.departamento IS NOT NULL
  AND public.profile_departamento_matches_department(p.departamento, d.code, d.name)
ON CONFLICT (profile_id, department_id) DO NOTHING;

-- Supervisors: seed membership when supervisor_id is set
INSERT INTO public.department_memberships (profile_id, department_id, role, source)
SELECT d.supervisor_id, d.id, 'supervisor', 'supervisor_seed'
FROM public.departments d
WHERE d.supervisor_id IS NOT NULL
ON CONFLICT (profile_id, department_id) DO UPDATE
  SET role = EXCLUDED.role
  WHERE department_memberships.role <> 'supervisor';

-- ---------------------------------------------------------------------------
-- 5) Refresh SLA compliance view to prefer acknowledged_at for MTTA
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.incident_sla_compliance AS
SELECT
  ih.id AS incident_id,
  ih.type AS incident_type,
  ih.impact,
  ih.status,
  ih.created_at AS reported_at,
  ih.routing_department_id,
  ih.assigned_to_id,
  ih.acknowledged_at,
  ih.acknowledged_by_id,
  ih.routing_rule_id,
  ih.pipeline_stage,
  ih.routed_at,
  ih.assigned_at,
  ih.target_response_hours,
  ih.first_wo_created_at,
  ih.first_planned_at,
  ih.first_assigned_at,
  ih.resolved_at,
  a.id AS asset_id,
  a.plant_id,
  d.name AS department_name,
  d.code AS department_code,
  ROUND(
    EXTRACT(EPOCH FROM (
      COALESCE(ih.acknowledged_at, ih.first_wo_created_at, ih.routed_at) - ih.created_at
    )) / 3600.0,
    1
  ) AS hours_to_acknowledge,
  ROUND(
    EXTRACT(EPOCH FROM (ih.first_planned_at - ih.created_at)) / 3600.0,
    1
  ) AS hours_to_schedule,
  ROUND(
    EXTRACT(EPOCH FROM (ih.resolved_at - ih.created_at)) / 3600.0,
    1
  ) AS hours_to_resolve,
  COALESCE(
    (
      SELECT st.target_ack_hours
      FROM public.incident_sla_targets st
      WHERE st.is_active
        AND (st.plant_id IS NULL OR st.plant_id = a.plant_id)
        AND (st.match_incident_type IS NULL OR st.match_incident_type = ih.type)
        AND (st.match_impact IS NULL OR st.match_impact = ih.impact)
        AND (st.match_department_id IS NULL OR st.match_department_id = ih.routing_department_id)
      ORDER BY st.priority ASC, st.created_at ASC
      LIMIT 1
    ),
    24
  ) AS sla_target_ack_hours,
  COALESCE(
    (
      SELECT st.target_schedule_hours
      FROM public.incident_sla_targets st
      WHERE st.is_active
        AND (st.plant_id IS NULL OR st.plant_id = a.plant_id)
        AND (st.match_incident_type IS NULL OR st.match_incident_type = ih.type)
        AND (st.match_impact IS NULL OR st.match_impact = ih.impact)
        AND (st.match_department_id IS NULL OR st.match_department_id = ih.routing_department_id)
      ORDER BY st.priority ASC, st.created_at ASC
      LIMIT 1
    ),
    COALESCE(ih.target_response_hours, 48)
  ) AS sla_target_schedule_hours,
  COALESCE(
    (
      SELECT st.target_resolve_hours
      FROM public.incident_sla_targets st
      WHERE st.is_active
        AND (st.plant_id IS NULL OR st.plant_id = a.plant_id)
        AND (st.match_incident_type IS NULL OR st.match_incident_type = ih.type)
        AND (st.match_impact IS NULL OR st.match_impact = ih.impact)
        AND (st.match_department_id IS NULL OR st.match_department_id = ih.routing_department_id)
      ORDER BY st.priority ASC, st.created_at ASC
      LIMIT 1
    ),
    168
  ) AS sla_target_resolve_hours,
  CASE
    WHEN COALESCE(ih.acknowledged_at, ih.first_wo_created_at, ih.routed_at) IS NULL THEN NULL
    ELSE ROUND(
      EXTRACT(EPOCH FROM (
        COALESCE(ih.acknowledged_at, ih.first_wo_created_at, ih.routed_at) - ih.created_at
      )) / 3600.0,
      1
    ) <= COALESCE(
      (
        SELECT st.target_ack_hours
        FROM public.incident_sla_targets st
        WHERE st.is_active
          AND (st.plant_id IS NULL OR st.plant_id = a.plant_id)
          AND (st.match_incident_type IS NULL OR st.match_incident_type = ih.type)
          AND (st.match_impact IS NULL OR st.match_impact = ih.impact)
          AND (st.match_department_id IS NULL OR st.match_department_id = ih.routing_department_id)
        ORDER BY st.priority ASC, st.created_at ASC
        LIMIT 1
      ),
      24
    )
  END AS met_ack_target,
  CASE
    WHEN ih.first_planned_at IS NULL THEN NULL
    ELSE ih.first_planned_at <= ih.created_at + (
      COALESCE(
        (
          SELECT (st.target_schedule_hours || ' hours')::interval
          FROM public.incident_sla_targets st
          WHERE st.is_active
            AND (st.plant_id IS NULL OR st.plant_id = a.plant_id)
            AND (st.match_incident_type IS NULL OR st.match_incident_type = ih.type)
            AND (st.match_impact IS NULL OR st.match_impact = ih.impact)
            AND (st.match_department_id IS NULL OR st.match_department_id = ih.routing_department_id)
          ORDER BY st.priority ASC, st.created_at ASC
          LIMIT 1
        ),
        (COALESCE(ih.target_response_hours, 48) || ' hours')::interval
      )
    )
  END AS met_schedule_target,
  CASE
    WHEN ih.resolved_at IS NULL THEN NULL
    ELSE ROUND(
      EXTRACT(EPOCH FROM (ih.resolved_at - ih.created_at)) / 3600.0,
      1
    ) <= COALESCE(
      (
        SELECT st.target_resolve_hours
        FROM public.incident_sla_targets st
        WHERE st.is_active
          AND (st.plant_id IS NULL OR st.plant_id = a.plant_id)
          AND (st.match_incident_type IS NULL OR st.match_incident_type = ih.type)
          AND (st.match_impact IS NULL OR st.match_impact = ih.impact)
          AND (st.match_department_id IS NULL OR st.match_department_id = ih.routing_department_id)
        ORDER BY st.priority ASC, st.created_at ASC
        LIMIT 1
      ),
      168
    )
  END AS met_resolve_target,
  CASE
    WHEN ih.routed_at IS NULL OR ih.target_response_hours IS NULL THEN NULL
    WHEN lower(COALESCE(ih.status, '')) IN ('resuelto', 'cerrado', 'resolved', 'closed') THEN
      EXTRACT(EPOCH FROM (COALESCE(ih.resolved_at, ih.routed_at) - ih.routed_at)) / 3600.0
        > ih.target_response_hours
    ELSE
      EXTRACT(EPOCH FROM (NOW() - ih.routed_at)) / 3600.0 > ih.target_response_hours
  END AS routing_sla_breached
FROM public.incident_history ih
JOIN public.assets a ON a.id = ih.asset_id
LEFT JOIN public.departments d ON d.id = ih.routing_department_id
WHERE ih.merged_into_id IS NULL;
