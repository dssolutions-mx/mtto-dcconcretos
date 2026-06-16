-- Incident department routing: rules engine, pipeline stages, assignment traceability.
-- Does not mutate existing incident workflow; adds routing metadata on incident_history.

-- ---------------------------------------------------------------------------
-- Routing rules (configurable, priority-ordered)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.incident_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  plant_id uuid REFERENCES public.plants(id) ON DELETE CASCADE,
  match_incident_type text,
  match_impact text,
  match_description_contains text,
  target_department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  default_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_response_hours integer NOT NULL DEFAULT 24,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incident_routing_rules_priority_nonneg CHECK (priority >= 0),
  CONSTRAINT incident_routing_rules_response_hours_pos CHECK (target_response_hours > 0)
);

CREATE INDEX IF NOT EXISTS idx_incident_routing_rules_active_priority
  ON public.incident_routing_rules (is_active, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_incident_routing_rules_department
  ON public.incident_routing_rules (target_department_id);

-- ---------------------------------------------------------------------------
-- Incident routing columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS routing_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS assigned_to_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'bandeja';

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS target_response_hours integer;

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS routed_at timestamptz;

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS routing_rule_id uuid REFERENCES public.incident_routing_rules(id) ON DELETE SET NULL;

ALTER TABLE public.incident_history
  DROP CONSTRAINT IF EXISTS incident_history_pipeline_stage_check;

ALTER TABLE public.incident_history
  ADD CONSTRAINT incident_history_pipeline_stage_check
  CHECK (pipeline_stage IN ('bandeja', 'asignado', 'en_atencion', 'esperando', 'cerrado'));

CREATE INDEX IF NOT EXISTS idx_incident_history_routing_department_open
  ON public.incident_history (routing_department_id, pipeline_stage)
  WHERE status IN ('Abierto', 'Pendiente', 'En progreso', 'open', 'pending', 'in progress');

CREATE INDEX IF NOT EXISTS idx_incident_history_assigned_open
  ON public.incident_history (assigned_to_id, pipeline_stage)
  WHERE status IN ('Abierto', 'Pendiente', 'En progreso', 'open', 'pending', 'in progress');

-- ---------------------------------------------------------------------------
-- Assignment audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.incident_assignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incident_history(id) ON DELETE CASCADE,
  from_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  to_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  from_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  from_pipeline_stage text,
  to_pipeline_stage text,
  reason text,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_assignment_log_incident
  ON public.incident_assignment_log (incident_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Rule matching + apply (used by trigger and backfill)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_incident_routing_rule(
  p_incident public.incident_history,
  p_plant_id uuid DEFAULT NULL
)
RETURNS public.incident_routing_rules
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rule public.incident_routing_rules;
BEGIN
  SELECT r.*
  INTO v_rule
  FROM public.incident_routing_rules r
  WHERE r.is_active IS TRUE
    AND (r.plant_id IS NULL OR r.plant_id = p_plant_id)
    AND (r.match_incident_type IS NULL OR lower(r.match_incident_type) = lower(p_incident.type))
    AND (r.match_impact IS NULL OR lower(r.match_impact) = lower(coalesce(p_incident.impact, '')))
    AND (
      r.match_description_contains IS NULL
      OR p_incident.description ILIKE '%' || r.match_description_contains || '%'
    )
  ORDER BY r.priority ASC, r.created_at ASC
  LIMIT 1;

  RETURN v_rule;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_incident_routing(p_incident_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident public.incident_history;
  v_rule public.incident_routing_rules;
  v_plant_id uuid;
  v_assignee uuid;
BEGIN
  SELECT ih.*
  INTO v_incident
  FROM public.incident_history ih
  WHERE ih.id = p_incident_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_incident.routing_department_id IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT a.plant_id
  INTO v_plant_id
  FROM public.assets a
  WHERE a.id = v_incident.asset_id;

  v_rule := public.match_incident_routing_rule(v_incident, v_plant_id);

  IF v_rule.id IS NULL THEN
    RETURN;
  END IF;

  v_assignee := coalesce(
    v_rule.default_assignee_id,
    (SELECT d.supervisor_id FROM public.departments d WHERE d.id = v_rule.target_department_id)
  );

  UPDATE public.incident_history ih
  SET
    routing_department_id = v_rule.target_department_id,
    assigned_to_id = v_assignee,
    routing_rule_id = v_rule.id,
    target_response_hours = v_rule.target_response_hours,
    routed_at = now(),
    assigned_at = CASE WHEN v_assignee IS NOT NULL THEN now() ELSE NULL END,
    pipeline_stage = CASE WHEN v_assignee IS NOT NULL THEN 'asignado' ELSE 'bandeja' END,
    updated_at = now()
  WHERE ih.id = p_incident_id;

  INSERT INTO public.incident_assignment_log (
    incident_id,
    to_department_id,
    to_assignee_id,
    to_pipeline_stage,
    reason
  ) VALUES (
    p_incident_id,
    v_rule.target_department_id,
    v_assignee,
    CASE WHEN v_assignee IS NOT NULL THEN 'asignado' ELSE 'bandeja' END,
    'Ruteo automático: ' || v_rule.name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_apply_incident_routing_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_incident_routing(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incident_history_apply_routing ON public.incident_history;

CREATE TRIGGER incident_history_apply_routing
  AFTER INSERT ON public.incident_history
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_apply_incident_routing_on_insert();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.incident_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_assignment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY incident_routing_rules_select ON public.incident_routing_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY incident_routing_rules_insert ON public.incident_routing_rules
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY incident_routing_rules_update ON public.incident_routing_rules
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY incident_routing_rules_delete ON public.incident_routing_rules
  FOR DELETE TO authenticated USING (true);

CREATE POLICY incident_assignment_log_select ON public.incident_assignment_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY incident_assignment_log_insert ON public.incident_assignment_log
  FOR INSERT TO authenticated WITH CHECK (true);
