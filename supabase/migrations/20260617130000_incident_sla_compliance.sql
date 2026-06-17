-- SLA compliance dashboard: configurable targets + enriched compliance view.
-- Extends incident_response_metrics with routing dimensions and breach flags.

-- ---------------------------------------------------------------------------
-- SLA target policies (type / department / impact / plant)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.incident_sla_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  plant_id uuid REFERENCES public.plants(id) ON DELETE CASCADE,
  match_incident_type text,
  match_impact text,
  match_department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  target_ack_hours integer NOT NULL DEFAULT 24,
  target_schedule_hours integer NOT NULL DEFAULT 48,
  target_resolve_hours integer NOT NULL DEFAULT 168,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_sla_targets_priority_nonneg CHECK (priority >= 0),
  CONSTRAINT incident_sla_targets_ack_pos CHECK (target_ack_hours > 0),
  CONSTRAINT incident_sla_targets_schedule_pos CHECK (target_schedule_hours > 0),
  CONSTRAINT incident_sla_targets_resolve_pos CHECK (target_resolve_hours > 0)
);

CREATE INDEX IF NOT EXISTS idx_incident_sla_targets_active_priority
  ON public.incident_sla_targets (is_active, priority, created_at);

COMMENT ON TABLE public.incident_sla_targets IS
  'Configurable SLA targets by incident type, impact, department, and plant.';

-- Seed defaults mirroring common routing-rule targets (MTTA 24h, schedule 48h, resolve 7d).
INSERT INTO public.incident_sla_targets (name, priority, match_impact, target_ack_hours, target_schedule_hours, target_resolve_hours)
SELECT * FROM (VALUES
  ('Impacto alto', 10, 'Alto', 8, 24, 72),
  ('Impacto medio', 20, 'Medio', 24, 48, 120),
  ('Impacto bajo', 30, 'Bajo', 48, 72, 168),
  ('Predeterminado', 1000, NULL::text, 24, 48, 168)
) AS seed(name, priority, match_impact, target_ack_hours, target_schedule_hours, target_resolve_hours)
WHERE NOT EXISTS (SELECT 1 FROM public.incident_sla_targets LIMIT 1);

-- ---------------------------------------------------------------------------
-- Compliance view (MTTA / MTTR / schedule + routing SLA)
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
    EXTRACT(EPOCH FROM (COALESCE(ih.first_wo_created_at, ih.routed_at) - ih.created_at)) / 3600.0,
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
    WHEN COALESCE(ih.first_wo_created_at, ih.routed_at) IS NULL THEN NULL
    ELSE ROUND(
      EXTRACT(
        EPOCH FROM (
          COALESCE(ih.first_wo_created_at, ih.routed_at) - ih.created_at
        )
      ) / 3600.0,
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
    WHEN LOWER(COALESCE(ih.status, '')) IN ('resuelto', 'cerrado', 'resolved', 'closed') THEN
      EXTRACT(EPOCH FROM (COALESCE(ih.resolved_at, ih.routed_at) - ih.routed_at)) / 3600.0
        > ih.target_response_hours
    ELSE
      EXTRACT(EPOCH FROM (NOW() - ih.routed_at)) / 3600.0 > ih.target_response_hours
  END AS routing_sla_breached
FROM public.incident_history ih
JOIN public.assets a ON a.id = ih.asset_id
LEFT JOIN public.departments d ON d.id = ih.routing_department_id
WHERE ih.merged_into_id IS NULL;

COMMENT ON VIEW public.incident_sla_compliance IS
  'Per-incident SLA compliance with MTTA (ack), schedule, MTTR (resolve), and routing breach flags.';
