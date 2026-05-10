-- Asset diesel efficiency: category bands, monthly facts, SQL bucket views, optional previous-meter trigger.

-- ---------------------------------------------------------------------------
-- 1) Category bands (configurable; versioned for alert foundation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment_category_efficiency_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL,
  display_name text NOT NULL,
  reference_liters_per_hour numeric(10, 2) NOT NULL,
  band_comfort_min numeric(10, 2),
  band_comfort_max numeric(10, 2),
  band_watch_above numeric(10, 2),
  band_severe_above numeric(10, 2),
  version text NOT NULL DEFAULT '2026-05-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_key, version)
);

COMMENT ON TABLE public.equipment_category_efficiency_bands IS
  'Reference L/h bands by equipment_models.category (lowercase key); used for efficiency tiers and future alerts.';

INSERT INTO public.equipment_category_efficiency_bands (
  category_key,
  display_name,
  reference_liters_per_hour,
  band_comfort_min,
  band_comfort_max,
  band_watch_above,
  band_severe_above,
  version
)
VALUES
  (
    'mezcladora de concreto',
    'Mezcladora de concreto',
    8.0,
    6.0,
    12.0,
    15.0,
    15.0,
    '2026-05-v1'
  ),
  (
    'camion',
    'Camión',
    12.0,
    8.0,
    20.0,
    25.0,
    28.0,
    '2026-05-v1'
  )
ON CONFLICT (category_key, version) DO NOTHING;

ALTER TABLE public.equipment_category_efficiency_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipment_category_efficiency_bands_select_authenticated" ON public.equipment_category_efficiency_bands;
CREATE POLICY "equipment_category_efficiency_bands_select_authenticated"
  ON public.equipment_category_efficiency_bands
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.equipment_category_efficiency_bands TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Monthly efficiency facts (app backfill + API; alert foundation columns)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_diesel_efficiency_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets (id) ON DELETE CASCADE,
  plant_id uuid REFERENCES public.plants (id) ON DELETE SET NULL,
  year_month text NOT NULL,
  total_liters numeric(14, 2) NOT NULL DEFAULT 0,
  hours_merged numeric(14, 4) NOT NULL DEFAULT 0,
  hours_sum_raw numeric(14, 4) NOT NULL DEFAULT 0,
  hours_trusted numeric(14, 4) NOT NULL DEFAULT 0,
  kilometers_sum_raw numeric(14, 4) NOT NULL DEFAULT 0,
  liters_per_hour_trusted numeric(14, 6),
  liters_per_km numeric(14, 6),
  concrete_m3 numeric(14, 4),
  liters_per_m3 numeric(14, 6),
  equipment_category text,
  quality_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  anomaly_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  thresholds_version text NOT NULL DEFAULT '2026-05-v1',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, year_month)
);

CREATE INDEX IF NOT EXISTS asset_diesel_efficiency_monthly_year_month_idx
  ON public.asset_diesel_efficiency_monthly (year_month);

CREATE INDEX IF NOT EXISTS asset_diesel_efficiency_monthly_plant_idx
  ON public.asset_diesel_efficiency_monthly (plant_id);

COMMENT ON TABLE public.asset_diesel_efficiency_monthly IS
  'Monthly diesel efficiency per asset (trusted hours = merged-first policy in app). quality_flags / anomaly_flags for UI and future notifier.';

ALTER TABLE public.asset_diesel_efficiency_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_diesel_efficiency_monthly_select_scoped" ON public.asset_diesel_efficiency_monthly;
CREATE POLICY "asset_diesel_efficiency_monthly_select_scoped"
  ON public.asset_diesel_efficiency_monthly
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.plant_id IS NULL
        AND profiles.business_unit_id IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.plants pl ON pl.business_unit_id = p.business_unit_id
      WHERE p.id = auth.uid()
        AND p.plant_id IS NULL
        AND p.business_unit_id IS NOT NULL
        AND asset_diesel_efficiency_monthly.plant_id = pl.id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.plant_id = asset_diesel_efficiency_monthly.plant_id
    )
    OR asset_diesel_efficiency_monthly.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "asset_diesel_efficiency_monthly_write_service" ON public.asset_diesel_efficiency_monthly;
CREATE POLICY "asset_diesel_efficiency_monthly_write_service"
  ON public.asset_diesel_efficiency_monthly
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_diesel_efficiency_monthly TO service_role;
GRANT SELECT ON public.asset_diesel_efficiency_monthly TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) SQL bucket views (sum-of-interval denominators; diagnostic vs merged in app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.diesel_efficiency_bucket_monthly_mex AS
SELECT
  date_trunc(
    'month',
    dt.transaction_date AT TIME ZONE 'America/Mexico_City'
  )::date AS bucket_month,
  dt.asset_id,
  w.plant_id,
  coalesce(sum(dt.quantity_liters), 0)::numeric(14, 2) AS total_liters,
  coalesce(sum(dt.hours_consumed), 0)::numeric(14, 4) AS sum_hours_consumed,
  coalesce(sum(dt.kilometers_consumed), 0)::numeric(14, 4) AS sum_km_consumed,
  count(*)::bigint AS transaction_count,
  CASE
    WHEN coalesce(sum(dt.hours_consumed), 0) > 0
      THEN (coalesce(sum(dt.quantity_liters), 0)::numeric / sum(dt.hours_consumed)::numeric)
    ELSE NULL::numeric
  END AS liters_per_sum_hour,
  CASE
    WHEN coalesce(sum(dt.kilometers_consumed), 0) > 0
      THEN (coalesce(sum(dt.quantity_liters), 0)::numeric / sum(dt.kilometers_consumed)::numeric)
    ELSE NULL::numeric
  END AS liters_per_sum_km
FROM public.diesel_transactions dt
JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
JOIN public.diesel_products dp ON dp.id = dt.product_id
WHERE dt.transaction_type = 'consumption'
  AND dt.is_transfer = false
  AND dp.product_type = 'diesel'
  AND w.product_type = 'diesel'
  AND dt.asset_id IS NOT NULL
GROUP BY
  date_trunc('month', dt.transaction_date AT TIME ZONE 'America/Mexico_City'),
  dt.asset_id,
  w.plant_id;

COMMENT ON VIEW public.diesel_efficiency_bucket_monthly_mex IS
  'Monthly diesel liters and sum(hours_consumed) efficiency (Mexico_City calendar month). Denominator is raw row sums, not merged horometer hours.';

CREATE OR REPLACE VIEW public.diesel_efficiency_bucket_weekly_mex AS
SELECT
  date_trunc(
    'week',
    dt.transaction_date AT TIME ZONE 'America/Mexico_City'
  )::date AS bucket_week,
  dt.asset_id,
  w.plant_id,
  coalesce(sum(dt.quantity_liters), 0)::numeric(14, 2) AS total_liters,
  coalesce(sum(dt.hours_consumed), 0)::numeric(14, 4) AS sum_hours_consumed,
  coalesce(sum(dt.kilometers_consumed), 0)::numeric(14, 4) AS sum_km_consumed,
  count(*)::bigint AS transaction_count,
  CASE
    WHEN coalesce(sum(dt.hours_consumed), 0) > 0
      THEN (coalesce(sum(dt.quantity_liters), 0)::numeric / sum(dt.hours_consumed)::numeric)
    ELSE NULL::numeric
  END AS liters_per_sum_hour,
  CASE
    WHEN coalesce(sum(dt.kilometers_consumed), 0) > 0
      THEN (coalesce(sum(dt.quantity_liters), 0)::numeric / sum(dt.kilometers_consumed)::numeric)
    ELSE NULL::numeric
  END AS liters_per_sum_km
FROM public.diesel_transactions dt
JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
JOIN public.diesel_products dp ON dp.id = dt.product_id
WHERE dt.transaction_type = 'consumption'
  AND dt.is_transfer = false
  AND dp.product_type = 'diesel'
  AND w.product_type = 'diesel'
  AND dt.asset_id IS NOT NULL
GROUP BY
  date_trunc('week', dt.transaction_date AT TIME ZONE 'America/Mexico_City'),
  dt.asset_id,
  w.plant_id;

CREATE OR REPLACE VIEW public.diesel_efficiency_bucket_daily_mex AS
SELECT
  (dt.transaction_date AT TIME ZONE 'America/Mexico_City')::date AS bucket_day,
  dt.asset_id,
  w.plant_id,
  coalesce(sum(dt.quantity_liters), 0)::numeric(14, 2) AS total_liters,
  coalesce(sum(dt.hours_consumed), 0)::numeric(14, 4) AS sum_hours_consumed,
  coalesce(sum(dt.kilometers_consumed), 0)::numeric(14, 4) AS sum_km_consumed,
  count(*)::bigint AS transaction_count,
  CASE
    WHEN coalesce(sum(dt.hours_consumed), 0) > 0
      THEN (coalesce(sum(dt.quantity_liters), 0)::numeric / sum(dt.hours_consumed)::numeric)
    ELSE NULL::numeric
  END AS liters_per_sum_hour,
  CASE
    WHEN coalesce(sum(dt.kilometers_consumed), 0) > 0
      THEN (coalesce(sum(dt.quantity_liters), 0)::numeric / sum(dt.kilometers_consumed)::numeric)
    ELSE NULL::numeric
  END AS liters_per_sum_km
FROM public.diesel_transactions dt
JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
JOIN public.diesel_products dp ON dp.id = dt.product_id
WHERE dt.transaction_type = 'consumption'
  AND dt.is_transfer = false
  AND dp.product_type = 'diesel'
  AND w.product_type = 'diesel'
  AND dt.asset_id IS NOT NULL
GROUP BY
  (dt.transaction_date AT TIME ZONE 'America/Mexico_City')::date,
  dt.asset_id,
  w.plant_id;

ALTER VIEW public.diesel_efficiency_bucket_monthly_mex SET (security_invoker = true);
ALTER VIEW public.diesel_efficiency_bucket_weekly_mex SET (security_invoker = true);
ALTER VIEW public.diesel_efficiency_bucket_daily_mex SET (security_invoker = true);

GRANT SELECT ON public.diesel_efficiency_bucket_monthly_mex TO authenticated, service_role;
GRANT SELECT ON public.diesel_efficiency_bucket_weekly_mex TO authenticated, service_role;
GRANT SELECT ON public.diesel_efficiency_bucket_daily_mex TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) BEFORE INSERT: backfill previous_horometer/km when null (strictly prior calendar date)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.diesel_transactions_set_previous_meters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev numeric;
  v_prev_km numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF NEW.transaction_type IS DISTINCT FROM 'consumption'::text OR NEW.asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.previous_horometer IS NULL AND NEW.horometer_reading IS NOT NULL THEN
    SELECT dt.horometer_reading INTO v_prev
    FROM public.diesel_transactions dt
    INNER JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
    INNER JOIN public.diesel_products dp ON dp.id = dt.product_id
    WHERE dt.asset_id = NEW.asset_id
      AND dt.transaction_type = 'consumption'
      AND dt.is_transfer = false
      AND dp.product_type = 'diesel'
      AND w.product_type = 'diesel'
      AND dt.horometer_reading IS NOT NULL
      AND (dt.transaction_date AT TIME ZONE 'America/Mexico_City')::date
        < (NEW.transaction_date AT TIME ZONE 'America/Mexico_City')::date
    ORDER BY dt.transaction_date DESC, dt.created_at DESC NULLS LAST
    LIMIT 1;
    IF v_prev IS NOT NULL THEN
      NEW.previous_horometer := v_prev;
    END IF;
  END IF;

  IF NEW.previous_kilometer IS NULL AND NEW.kilometer_reading IS NOT NULL THEN
    SELECT dt.kilometer_reading INTO v_prev_km
    FROM public.diesel_transactions dt
    INNER JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
    INNER JOIN public.diesel_products dp ON dp.id = dt.product_id
    WHERE dt.asset_id = NEW.asset_id
      AND dt.transaction_type = 'consumption'
      AND dt.is_transfer = false
      AND dp.product_type = 'diesel'
      AND w.product_type = 'diesel'
      AND dt.kilometer_reading IS NOT NULL
      AND (dt.transaction_date AT TIME ZONE 'America/Mexico_City')::date
        < (NEW.transaction_date AT TIME ZONE 'America/Mexico_City')::date
    ORDER BY dt.transaction_date DESC, dt.created_at DESC NULLS LAST
    LIMIT 1;
    IF v_prev_km IS NOT NULL THEN
      NEW.previous_kilometer := v_prev_km;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diesel_tx_prev_meters ON public.diesel_transactions;
CREATE TRIGGER trg_diesel_tx_prev_meters
  BEFORE INSERT ON public.diesel_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.diesel_transactions_set_previous_meters();

COMMENT ON FUNCTION public.diesel_transactions_set_previous_meters() IS
  'When previous_horometer/kilometer are null, stamps from last diesel consumption reading on a prior calendar day (Mexico_City).';

GRANT EXECUTE ON FUNCTION public.diesel_transactions_set_previous_meters() TO authenticated, service_role;
