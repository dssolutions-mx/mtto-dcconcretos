-- Fleet flota: audit log, field verification, trust policies, saved views, asset_conflicts view

-- ---------------------------------------------------------------------------
-- assets_audit_log: append-only history for fleet edits (API-side inserts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assets_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  field text NOT NULL,
  before_value text,
  after_value text,
  source text NOT NULL DEFAULT 'fleet_ui',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_audit_log_asset_id ON public.assets_audit_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_audit_log_created_at ON public.assets_audit_log(created_at DESC);

COMMENT ON TABLE public.assets_audit_log IS 'Audit trail for asset field changes from fleet UI and bulk operations';

ALTER TABLE public.assets_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_audit_log_select_authenticated" ON public.assets_audit_log;
DROP POLICY IF EXISTS "assets_audit_log_insert_own_user" ON public.assets_audit_log;

CREATE POLICY "assets_audit_log_select_authenticated"
  ON public.assets_audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "assets_audit_log_insert_own_user"
  ON public.assets_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- asset_field_verifications: latest verification per (asset_id, field)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_field_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  field text NOT NULL,
  verified_by uuid NOT NULL REFERENCES public.profiles(id),
  verified_at timestamptz NOT NULL DEFAULT now(),
  value_hash text,
  UNIQUE (asset_id, field)
);

CREATE INDEX IF NOT EXISTS idx_asset_field_verifications_asset_id ON public.asset_field_verifications(asset_id);

COMMENT ON TABLE public.asset_field_verifications IS 'User confirmation of field values for trust scoring';

ALTER TABLE public.asset_field_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_field_verifications_select_authenticated" ON public.asset_field_verifications;
DROP POLICY IF EXISTS "asset_field_verifications_upsert_own" ON public.asset_field_verifications;

CREATE POLICY "asset_field_verifications_select_authenticated"
  ON public.asset_field_verifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "asset_field_verifications_upsert_own"
  ON public.asset_field_verifications FOR ALL TO authenticated
  USING (auth.uid() = verified_by)
  WITH CHECK (auth.uid() = verified_by);

-- ---------------------------------------------------------------------------
-- trust_field_policies: decay windows (NULL window_days = never decays)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trust_field_policies (
  field text PRIMARY KEY,
  window_days integer,
  severity text NOT NULL DEFAULT 'medium'
);

INSERT INTO public.trust_field_policies (field, window_days, severity) VALUES
  ('current_hours', 30, 'medium'),
  ('current_kilometers', 30, 'medium'),
  ('serial_number', NULL, 'high'),
  ('insurance_end_date', 365, 'low'),
  ('plant_id', 180, 'medium'),
  ('status', 30, 'medium'),
  ('model_id', NULL, 'high'),
  ('default', 90, 'medium')
ON CONFLICT (field) DO NOTHING;

COMMENT ON TABLE public.trust_field_policies IS 'Per-field trust decay windows for fleet verification UX';

ALTER TABLE public.trust_field_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trust_field_policies_select_authenticated" ON public.trust_field_policies;
CREATE POLICY "trust_field_policies_select_authenticated"
  ON public.trust_field_policies FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- user_saved_views
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'personal',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_views_user_id ON public.user_saved_views(user_id);

COMMENT ON TABLE public.user_saved_views IS 'Saved fleet tree lens/filter/density preferences';

ALTER TABLE public.user_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_saved_views_select" ON public.user_saved_views;
DROP POLICY IF EXISTS "user_saved_views_write" ON public.user_saved_views;

CREATE POLICY "user_saved_views_select"
  ON public.user_saved_views FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_shared = true);

CREATE POLICY "user_saved_views_write"
  ON public.user_saved_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_saved_views_update_own"
  ON public.user_saved_views FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_saved_views_delete_own"
  ON public.user_saved_views FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- asset_conflicts view (detection for Pendientes + APIs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.asset_conflicts AS
-- duplicate human-readable asset_id (should be rare if not unique in DB)
SELECT
  'duplicate_asset_id'::text AS conflict_type,
  'high'::text AS severity,
  a.id::uuid AS asset_id,
  NULL::uuid AS equipment_model_id,
  jsonb_build_object('asset_id', a.asset_id, 'count', cnt.c) AS payload,
  'asset_id duplicado'::text AS detail
FROM public.assets a
INNER JOIN (
  SELECT asset_id, count(*)::bigint AS c
  FROM public.assets
  GROUP BY asset_id
  HAVING count(*) > 1
) cnt ON cnt.asset_id = a.asset_id

UNION ALL

-- duplicate serial (non-null, non-empty)
SELECT
  'duplicate_serial'::text,
  'high'::text,
  a.id,
  NULL::uuid,
  jsonb_build_object('serial_number', a.serial_number),
  'numero de serie duplicado'::text
FROM public.assets a
INNER JOIN (
  SELECT serial_number
  FROM public.assets
  WHERE serial_number IS NOT NULL AND trim(serial_number) <> ''
  GROUP BY serial_number
  HAVING count(*) > 1
) d ON trim(lower(a.serial_number)) = trim(lower(d.serial_number))

UNION ALL

-- department belongs to different plant than asset
SELECT
  'department_plant_mismatch'::text,
  'medium'::text,
  a.id,
  NULL::uuid,
  jsonb_build_object(
    'asset_plant_id', a.plant_id,
    'department_plant_id', d.plant_id,
    'department_id', a.department_id
  ),
  'departamento no corresponde a la planta del activo'::text
FROM public.assets a
INNER JOIN public.departments d ON d.id = a.department_id
WHERE a.department_id IS NOT NULL
  AND a.plant_id IS NOT NULL
  AND d.plant_id IS NOT NULL
  AND a.plant_id <> d.plant_id

UNION ALL

-- model year after installation year
SELECT
  'model_year_after_install'::text,
  'medium'::text,
  a.id,
  em.id,
  jsonb_build_object(
    'year_introduced', em.year_introduced,
    'installation_year', EXTRACT(YEAR FROM a.installation_date)::int
  ),
  'año del modelo posterior al año de instalacion'::text
FROM public.assets a
INNER JOIN public.equipment_models em ON em.id = a.model_id
WHERE a.installation_date IS NOT NULL
  AND em.year_introduced IS NOT NULL
  AND em.year_introduced > EXTRACT(YEAR FROM a.installation_date)::int

UNION ALL

-- hours regression (most recent reading lower than the immediately older reading)
SELECT
  'hours_regression'::text,
  'high'::text,
  w.asset_id,
  NULL::uuid,
  jsonb_build_object('hours', w.hours, 'older_hours', w.older_adjacent_hours, 'date', w.date),
  'lectura de horas menor a la anterior'::text
FROM (
  SELECT
    asset_id,
    date,
    hours,
    LAG(hours) OVER (PARTITION BY asset_id ORDER BY date DESC) AS older_adjacent_hours
  FROM public.maintenance_history
  WHERE hours IS NOT NULL
) w
WHERE w.older_adjacent_hours IS NOT NULL
  AND w.hours < w.older_adjacent_hours;

COMMENT ON VIEW public.asset_conflicts IS 'Union of detectable data conflicts for fleet Pendientes panel';

-- Grant read on view (views use invoker security in PG)
GRANT SELECT ON public.asset_conflicts TO authenticated;
