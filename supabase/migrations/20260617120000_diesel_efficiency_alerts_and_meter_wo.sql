-- Diesel efficiency: actionable alert follow-ups + work-order attribution on meter timeline.

-- ---------------------------------------------------------------------------
-- 1) Alert follow-ups (acknowledge / assign / resolve per asset-month-kind)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diesel_efficiency_alert_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets (id) ON DELETE CASCADE,
  year_month text NOT NULL,
  alert_kind text NOT NULL CHECK (
    alert_kind IN (
      'efficiency_severe',
      'efficiency_watch',
      'breakpoint_mom',
      'consumption_pattern',
      'data_quality'
    )
  ),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, year_month, alert_kind)
);

CREATE INDEX IF NOT EXISTS diesel_efficiency_alert_followups_year_month_idx
  ON public.diesel_efficiency_alert_followups (year_month);

COMMENT ON TABLE public.diesel_efficiency_alert_followups IS
  'Seguimiento accionable de alertas del reporte de eficiencia diésel por activo/mes/tipo.';

ALTER TABLE public.diesel_efficiency_alert_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diesel_efficiency_alert_followups_select_scoped"
  ON public.diesel_efficiency_alert_followups;
CREATE POLICY "diesel_efficiency_alert_followups_select_scoped"
  ON public.diesel_efficiency_alert_followups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = diesel_efficiency_alert_followups.asset_id
        AND (
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
              AND a.plant_id = pl.id
          )
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.plant_id = a.plant_id
          )
          OR a.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "diesel_efficiency_alert_followups_write_scoped"
  ON public.diesel_efficiency_alert_followups;
CREATE POLICY "diesel_efficiency_alert_followups_write_scoped"
  ON public.diesel_efficiency_alert_followups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = diesel_efficiency_alert_followups.asset_id
        AND (
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
              AND a.plant_id = pl.id
          )
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.plant_id = a.plant_id
          )
          OR a.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.assets a
      WHERE a.id = diesel_efficiency_alert_followups.asset_id
        AND (
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
              AND a.plant_id = pl.id
          )
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.plant_id = a.plant_id
          )
          OR a.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "diesel_efficiency_alert_followups_write_service"
  ON public.diesel_efficiency_alert_followups;
CREATE POLICY "diesel_efficiency_alert_followups_write_service"
  ON public.diesel_efficiency_alert_followups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diesel_efficiency_alert_followups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diesel_efficiency_alert_followups TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Extend meter timeline with OT / service-order links from diesel rows
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.asset_meter_reading_events;

CREATE VIEW public.asset_meter_reading_events
WITH (security_invoker = true) AS
SELECT
  'diesel_consumption'::text AS source_kind,
  dt.id AS source_id,
  dt.asset_id,
  dt.transaction_date AS event_at,
  coalesce(dt.created_at, dt.transaction_date) AS recorded_at,
  dt.horometer_reading AS hours_reading,
  dt.kilometer_reading AS km_reading,
  dt.previous_horometer AS previous_hours,
  dt.previous_kilometer AS previous_km,
  dt.hours_consumed,
  dt.kilometers_consumed AS km_consumed,
  dt.quantity_liters,
  dt.warehouse_id,
  dt.exception_asset_name,
  dt.plant_id,
  dt.created_by AS actor_user_id,
  dt.work_order_id,
  dt.service_order_id,
  'diesel_transaction'::text AS row_source
FROM public.diesel_transactions dt
JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
JOIN public.diesel_products dp ON dp.id = dt.product_id
WHERE dt.transaction_type = 'consumption'
  AND NOT dt.is_transfer
  AND dp.product_type = 'diesel'
  AND w.product_type = 'diesel'
  AND (dt.horometer_reading IS NOT NULL OR dt.kilometer_reading IS NOT NULL)

UNION ALL

SELECT
  'checklist_completion'::text AS source_kind,
  cc.id AS source_id,
  cc.asset_id,
  coalesce(
    cc.reading_timestamp,
    ((cc.completion_date AT TIME ZONE 'UTC')::date + interval '12 hours') AT TIME ZONE 'UTC'
  ) AS event_at,
  coalesce(cc.created_at, cc.completion_date) AS recorded_at,
  cc.equipment_hours_reading AS hours_reading,
  cc.equipment_kilometers_reading AS km_reading,
  cc.previous_hours,
  cc.previous_kilometers,
  NULL::numeric AS hours_consumed,
  NULL::numeric AS km_consumed,
  NULL::numeric AS quantity_liters,
  NULL::uuid AS warehouse_id,
  NULL::text AS exception_asset_name,
  a.plant_id,
  coalesce(cc.created_by, cc.updated_by) AS actor_user_id,
  NULL::uuid AS work_order_id,
  NULL::uuid AS service_order_id,
  'completed_checklist'::text AS row_source
FROM public.completed_checklists cc
LEFT JOIN public.assets a ON a.id = cc.asset_id
WHERE cc.equipment_hours_reading IS NOT NULL
   OR cc.equipment_kilometers_reading IS NOT NULL

UNION ALL

SELECT
  'asset_field_audit'::text AS source_kind,
  al.id AS source_id,
  al.asset_id,
  al.created_at AS event_at,
  al.created_at AS recorded_at,
  CASE
    WHEN al.field = 'current_hours'
      THEN CASE
        WHEN nullif(trim(al.after_value), '') IS NULL THEN NULL::numeric
        ELSE nullif(trim(al.after_value), '')::numeric
      END
    ELSE NULL::numeric
  END AS hours_reading,
  CASE
    WHEN al.field = 'current_kilometers'
      THEN CASE
        WHEN nullif(trim(al.after_value), '') IS NULL THEN NULL::numeric
        ELSE nullif(trim(al.after_value), '')::numeric
      END
    ELSE NULL::numeric
  END AS km_reading,
  CASE
    WHEN al.field = 'current_hours'
      THEN CASE
        WHEN nullif(trim(al.before_value), '') IS NULL THEN NULL::numeric
        ELSE nullif(trim(al.before_value), '')::numeric
      END
    ELSE NULL::numeric
  END AS previous_hours,
  CASE
    WHEN al.field = 'current_kilometers'
      THEN CASE
        WHEN nullif(trim(al.before_value), '') IS NULL THEN NULL::numeric
        ELSE nullif(trim(al.before_value), '')::numeric
      END
    ELSE NULL::numeric
  END AS previous_km,
  NULL::numeric AS hours_consumed,
  NULL::numeric AS km_consumed,
  NULL::numeric AS quantity_liters,
  NULL::uuid AS warehouse_id,
  NULL::text AS exception_asset_name,
  a.plant_id,
  al.user_id AS actor_user_id,
  NULL::uuid AS work_order_id,
  NULL::uuid AS service_order_id,
  coalesce(al.source, 'fleet_audit')::text AS row_source
FROM public.assets_audit_log al
LEFT JOIN public.assets a ON a.id = al.asset_id
WHERE al.field IN ('current_hours', 'current_kilometers');

COMMENT ON VIEW public.asset_meter_reading_events IS
  'Raw union of diesel consumption meter readings (incl. work_order_id/service_order_id), '
  'checklist equipment readings, and assets_audit_log rows for current_hours/current_kilometers.';
