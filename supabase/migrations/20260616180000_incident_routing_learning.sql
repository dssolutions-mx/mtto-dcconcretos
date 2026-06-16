-- Incident routing learning: capture manual decisions and promote patterns into rules.

-- ---------------------------------------------------------------------------
-- Extend rules with learning metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.incident_routing_rules
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.incident_routing_rules
  DROP CONSTRAINT IF EXISTS incident_routing_rules_source_check;

ALTER TABLE public.incident_routing_rules
  ADD CONSTRAINT incident_routing_rules_source_check
  CHECK (source IN ('manual', 'learned'));

ALTER TABLE public.incident_routing_rules
  ADD COLUMN IF NOT EXISTS pattern_key text;

ALTER TABLE public.incident_routing_rules
  ADD COLUMN IF NOT EXISTS sample_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.incident_routing_rules
  ADD COLUMN IF NOT EXISTS confidence numeric(5, 4) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_routing_rules_pattern_key
  ON public.incident_routing_rules (pattern_key)
  WHERE pattern_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Training signals from human routing decisions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.incident_routing_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incident_history(id) ON DELETE CASCADE,
  plant_id uuid REFERENCES public.plants(id) ON DELETE SET NULL,
  incident_type text NOT NULL,
  incident_impact text,
  description_keyword text,
  chosen_department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  chosen_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  previous_rule_id uuid REFERENCES public.incident_routing_rules(id) ON DELETE SET NULL,
  signal_kind text NOT NULL DEFAULT 'manual_assign'
    CHECK (signal_kind IN ('manual_assign', 'correction', 'confirm')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_routing_signals_created
  ON public.incident_routing_signals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_routing_signals_pattern
  ON public.incident_routing_signals (
    plant_id,
    lower(incident_type),
    lower(coalesce(incident_impact, '')),
    lower(coalesce(description_keyword, '')),
    chosen_department_id
  );

ALTER TABLE public.incident_routing_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY incident_routing_signals_select ON public.incident_routing_signals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY incident_routing_signals_insert ON public.incident_routing_signals
  FOR INSERT TO authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.extract_incident_routing_keyword(p_description text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
  v_pos int;
BEGIN
  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RETURN NULL;
  END IF;

  v_text := btrim(p_description);
  v_pos := position(' - ' in v_text);
  IF v_pos > 0 THEN
    v_text := btrim(substring(v_text from 1 for v_pos - 1));
  END IF;

  v_text := regexp_replace(v_text, '\s+', ' ', 'g');
  v_text := lower(btrim(v_text));

  IF length(v_text) < 4 THEN
    RETURN NULL;
  END IF;

  RETURN left(v_text, 120);
END;
$$;

CREATE OR REPLACE FUNCTION public.build_incident_routing_pattern_key(
  p_plant_id uuid,
  p_incident_type text,
  p_incident_impact text,
  p_description_keyword text,
  p_department_id uuid
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN concat_ws(
    '|',
    coalesce(p_plant_id::text, '*'),
    lower(coalesce(p_incident_type, '')),
    lower(coalesce(nullif(btrim(p_incident_impact), ''), '*')),
    lower(coalesce(nullif(btrim(p_description_keyword), ''), '*')),
    p_department_id::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.routing_rule_specificity(r public.incident_routing_rules)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    (CASE WHEN r.plant_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN r.match_incident_type IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN r.match_impact IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN r.match_description_contains IS NOT NULL THEN 2 ELSE 0 END);
$$;

-- Prefer specific + high-confidence learned rules over broad manual rules.
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
  v_keyword text;
BEGIN
  v_keyword := public.extract_incident_routing_keyword(p_incident.description);

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
      OR (
        v_keyword IS NOT NULL
        AND lower(r.match_description_contains) = v_keyword
      )
    )
  ORDER BY
    public.routing_rule_specificity(r) DESC,
    r.confidence DESC,
    r.sample_count DESC,
    r.priority ASC,
    r.created_at ASC
  LIMIT 1;

  RETURN v_rule;
END;
$$;

-- ---------------------------------------------------------------------------
-- Record human decision + refresh learned rules
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_incident_routing_signal(
  p_incident_id uuid,
  p_chosen_department_id uuid,
  p_chosen_assignee_id uuid DEFAULT NULL,
  p_previous_department_id uuid DEFAULT NULL,
  p_previous_rule_id uuid DEFAULT NULL,
  p_signal_kind text DEFAULT 'manual_assign',
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident public.incident_history;
  v_plant_id uuid;
  v_keyword text;
  v_signal_id uuid;
  v_kind text;
BEGIN
  SELECT ih.*
  INTO v_incident
  FROM public.incident_history ih
  WHERE ih.id = p_incident_id;

  IF NOT FOUND OR p_chosen_department_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.plant_id INTO v_plant_id
  FROM public.assets a
  WHERE a.id = v_incident.asset_id;

  v_keyword := public.extract_incident_routing_keyword(v_incident.description);

  v_kind := coalesce(nullif(btrim(p_signal_kind), ''), 'manual_assign');
  IF v_kind NOT IN ('manual_assign', 'correction', 'confirm') THEN
    v_kind := 'manual_assign';
  END IF;

  IF p_previous_department_id IS NOT NULL
     AND p_previous_department_id = p_chosen_department_id
     AND v_kind = 'manual_assign' THEN
    v_kind := 'confirm';
  ELSIF p_previous_department_id IS NOT NULL
        AND p_previous_department_id IS DISTINCT FROM p_chosen_department_id THEN
    v_kind := 'correction';
  END IF;

  INSERT INTO public.incident_routing_signals (
    incident_id,
    plant_id,
    incident_type,
    incident_impact,
    description_keyword,
    chosen_department_id,
    chosen_assignee_id,
    previous_department_id,
    previous_rule_id,
    signal_kind,
    created_by
  ) VALUES (
    p_incident_id,
    v_plant_id,
    v_incident.type,
    v_incident.impact,
    v_keyword,
    p_chosen_department_id,
    p_chosen_assignee_id,
    p_previous_department_id,
    p_previous_rule_id,
    v_kind,
    p_created_by
  )
  RETURNING id INTO v_signal_id;

  PERFORM public.refresh_learned_incident_routing_rules();

  RETURN v_signal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_learned_incident_routing_rules(
  p_min_samples integer DEFAULT 3,
  p_min_confidence numeric DEFAULT 0.75
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted integer := 0;
  rec record;
  v_pattern_key text;
  v_rule_name text;
  v_priority integer;
  v_existing uuid;
BEGIN
  FOR rec IN
    WITH recent AS (
      SELECT *
      FROM public.incident_routing_signals
      WHERE created_at >= now() - interval '180 days'
    ),
    grouped AS (
      SELECT
        plant_id,
        lower(incident_type) AS incident_type,
        lower(coalesce(nullif(btrim(incident_impact), ''), '')) AS incident_impact,
        lower(coalesce(nullif(btrim(description_keyword), ''), '')) AS description_keyword,
        chosen_department_id,
        mode() WITHIN GROUP (ORDER BY chosen_assignee_id) AS suggested_assignee_id,
        count(*) AS sample_count,
        count(*) FILTER (WHERE signal_kind = 'correction') AS correction_count,
        count(*) FILTER (WHERE signal_kind = 'confirm') AS confirm_count
      FROM recent
      GROUP BY 1, 2, 3, 4, 5
      HAVING count(*) >= p_min_samples
    ),
    scored AS (
      SELECT
        g.*,
        round(
          least(
            1.0,
            (g.sample_count::numeric / (g.sample_count + greatest(g.correction_count, 1)))
            + (g.confirm_count::numeric * 0.05)
          ),
          4
        ) AS confidence
      FROM grouped g
    )
    SELECT *
    FROM scored
    WHERE confidence >= p_min_confidence
  LOOP
    v_pattern_key := public.build_incident_routing_pattern_key(
      rec.plant_id,
      rec.incident_type,
      nullif(rec.incident_impact, ''),
      nullif(rec.description_keyword, ''),
      rec.chosen_department_id
    );

    SELECT id INTO v_existing
    FROM public.incident_routing_rules
    WHERE pattern_key = v_pattern_key;

    v_rule_name := 'Aprendida: ' ||
      initcap(rec.incident_type) ||
      CASE
        WHEN rec.description_keyword <> '' THEN ' · ' || left(rec.description_keyword, 40)
        ELSE ''
      END;

    v_priority := greatest(
      10,
      80 - floor(rec.confidence * 40)::integer - least(rec.sample_count, 20)
    );

    IF v_existing IS NOT NULL THEN
      UPDATE public.incident_routing_rules
      SET
        name = v_rule_name,
        is_active = true,
        priority = v_priority,
        plant_id = rec.plant_id,
        match_incident_type = rec.incident_type,
        match_impact = nullif(rec.incident_impact, ''),
        match_description_contains = nullif(rec.description_keyword, ''),
        target_department_id = rec.chosen_department_id,
        default_assignee_id = rec.suggested_assignee_id,
        sample_count = rec.sample_count,
        confidence = rec.confidence,
        source = 'learned',
        updated_at = now()
      WHERE id = v_existing;
    ELSE
      INSERT INTO public.incident_routing_rules (
        name,
        description,
        priority,
        is_active,
        plant_id,
        match_incident_type,
        match_impact,
        match_description_contains,
        target_department_id,
        default_assignee_id,
        target_response_hours,
        source,
        pattern_key,
        sample_count,
        confidence
      ) VALUES (
        v_rule_name,
        'Regla generada automáticamente a partir de decisiones humanas repetidas.',
        v_priority,
        true,
        rec.plant_id,
        rec.incident_type,
        nullif(rec.incident_impact, ''),
        nullif(rec.description_keyword, ''),
        rec.chosen_department_id,
        rec.suggested_assignee_id,
        24,
        'learned',
        v_pattern_key,
        rec.sample_count,
        rec.confidence
      );
    END IF;

    v_promoted := v_promoted + 1;
  END LOOP;

  RETURN v_promoted;
END;
$$;
