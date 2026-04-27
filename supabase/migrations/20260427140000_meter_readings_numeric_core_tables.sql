-- Store horómetro / odómetro readings with decimals (numeric(12,2)).
-- Tables: diesel_transactions (readings + generated deltas), completed_checklists, assets.

DROP VIEW IF EXISTS public.active_assets_without_recent_inspection;

DROP VIEW IF EXISTS public.diesel_asset_consumption_summary;
DROP VIEW IF EXISTS public.diesel_asset_consumption_by_warehouse;
DROP VIEW IF EXISTS public.diesel_monthly_consumption_by_asset;

ALTER TABLE public.diesel_transactions
  DROP COLUMN IF EXISTS hours_consumed,
  DROP COLUMN IF EXISTS kilometers_consumed;

ALTER TABLE public.diesel_transactions
  ALTER COLUMN horometer_reading TYPE numeric(12,2) USING horometer_reading::numeric(12,2),
  ALTER COLUMN kilometer_reading TYPE numeric(12,2) USING kilometer_reading::numeric(12,2),
  ALTER COLUMN previous_horometer TYPE numeric(12,2) USING previous_horometer::numeric(12,2),
  ALTER COLUMN previous_kilometer TYPE numeric(12,2) USING previous_kilometer::numeric(12,2);

ALTER TABLE public.diesel_transactions
  ADD COLUMN hours_consumed numeric(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN horometer_reading IS NOT NULL AND previous_horometer IS NOT NULL
        THEN (horometer_reading - previous_horometer)
      ELSE NULL::numeric
    END
  ) STORED;

ALTER TABLE public.diesel_transactions
  ADD COLUMN kilometers_consumed numeric(12,2) GENERATED ALWAYS AS (
    CASE
      WHEN kilometer_reading IS NOT NULL AND previous_kilometer IS NOT NULL
        THEN (kilometer_reading - previous_kilometer)
      ELSE NULL::numeric
    END
  ) STORED;

ALTER TABLE public.completed_checklists
  ALTER COLUMN equipment_hours_reading TYPE numeric(12,2) USING equipment_hours_reading::numeric(12,2),
  ALTER COLUMN equipment_kilometers_reading TYPE numeric(12,2) USING equipment_kilometers_reading::numeric(12,2),
  ALTER COLUMN previous_hours TYPE numeric(12,2) USING previous_hours::numeric(12,2),
  ALTER COLUMN previous_kilometers TYPE numeric(12,2) USING previous_kilometers::numeric(12,2);

DROP TRIGGER IF EXISTS trigger_sync_composite_readings ON public.assets;

ALTER TABLE public.assets
  ALTER COLUMN initial_hours TYPE numeric(12,2) USING initial_hours::numeric(12,2),
  ALTER COLUMN current_hours TYPE numeric(12,2) USING current_hours::numeric(12,2),
  ALTER COLUMN initial_kilometers TYPE numeric(12,2) USING initial_kilometers::numeric(12,2),
  ALTER COLUMN current_kilometers TYPE numeric(12,2) USING current_kilometers::numeric(12,2);

CREATE TRIGGER trigger_sync_composite_readings
  AFTER UPDATE OF current_hours, current_kilometers ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_composite_readings();

-- Restore diesel views that referenced generated columns (same logic as before; columns are now numeric).
CREATE OR REPLACE VIEW public.diesel_asset_consumption_summary AS
WITH asset_consumption AS (
  SELECT
    dt.asset_id,
    a.name AS asset_name,
    a.asset_id AS asset_code,
    dt.exception_asset_name,
    dt.asset_category,
    p.name AS plant_name,
    count(*)::bigint AS transaction_count,
    sum(dt.quantity_liters)::numeric AS total_consumption,
    avg(dt.quantity_liters)::numeric AS avg_consumption_per_transaction,
    min(dt.transaction_date) AS first_consumption,
    max(dt.transaction_date) AS last_consumption,
    avg(
      CASE
        WHEN dt.hours_consumed IS NOT NULL AND dt.hours_consumed > 0
          THEN dt.quantity_liters::numeric / dt.hours_consumed::numeric
        ELSE NULL::numeric
      END
    ) AS avg_liters_per_hour,
    avg(
      CASE
        WHEN dt.kilometers_consumed IS NOT NULL AND dt.kilometers_consumed > 0
          THEN dt.quantity_liters::numeric / dt.kilometers_consumed::numeric
        ELSE NULL::numeric
      END
    ) AS avg_liters_per_km,
    sum(
      CASE
        WHEN dt.transaction_date >= (now() - interval '30 days') THEN dt.quantity_liters
        ELSE 0::numeric
      END
    ) AS consumption_last_30_days,
    count(
      CASE
        WHEN dt.transaction_date >= (now() - interval '30 days') THEN 1
        ELSE NULL::integer
      END
    )::bigint AS transactions_last_30_days
  FROM public.diesel_transactions dt
  LEFT JOIN public.assets a ON dt.asset_id = a.id
  LEFT JOIN public.diesel_warehouses w ON dt.warehouse_id = w.id
  LEFT JOIN public.plants p ON w.plant_id = p.id
  WHERE dt.transaction_type = 'consumption'
    AND dt.is_transfer = false
  GROUP BY dt.asset_id, a.name, a.asset_id, dt.exception_asset_name, dt.asset_category, p.name
)
SELECT
  ac.asset_id,
  ac.asset_name,
  ac.asset_code,
  ac.exception_asset_name,
  ac.asset_category,
  ac.plant_name,
  ac.transaction_count,
  ac.total_consumption,
  ac.avg_consumption_per_transaction,
  ac.first_consumption,
  ac.last_consumption,
  ac.avg_liters_per_hour,
  ac.avg_liters_per_km,
  ac.consumption_last_30_days,
  ac.transactions_last_30_days,
  CASE
    WHEN ac.last_consumption >= (now() - interval '7 days') THEN 'Active'::text
    WHEN ac.last_consumption >= (now() - interval '30 days') THEN 'Recent'::text
    WHEN ac.last_consumption >= (now() - interval '90 days') THEN 'Inactive'::text
    ELSE 'Dormant'::text
  END AS activity_status
FROM asset_consumption ac
ORDER BY ac.total_consumption DESC NULLS LAST;

COMMENT ON VIEW public.diesel_asset_consumption_summary IS
  'Per-asset diesel consumption rollup (rebuilt after numeric meter columns).';

CREATE OR REPLACE VIEW public.diesel_asset_consumption_by_warehouse AS
SELECT
  dt.warehouse_id,
  w.name AS warehouse_name,
  w.plant_id,
  p.name AS plant_name,
  dt.asset_id,
  a.name AS asset_name,
  a.asset_id AS asset_code,
  dt.exception_asset_name,
  dt.asset_category,
  dp.product_type,
  count(*)::bigint AS transaction_count,
  coalesce(sum(dt.quantity_liters), 0)::numeric AS total_consumption,
  avg(dt.quantity_liters)::numeric AS avg_consumption_per_transaction,
  min(dt.transaction_date) AS first_consumption,
  max(dt.transaction_date) AS last_consumption,
  avg(
    CASE
      WHEN dt.hours_consumed IS NOT NULL AND dt.hours_consumed > 0
        THEN (dt.quantity_liters::numeric / dt.hours_consumed::numeric)
      ELSE NULL::numeric
    END
  ) AS avg_liters_per_hour_tx,
  avg(
    CASE
      WHEN dt.kilometers_consumed IS NOT NULL AND dt.kilometers_consumed > 0
        THEN (dt.quantity_liters::numeric / dt.kilometers_consumed::numeric)
      ELSE NULL::numeric
    END
  ) AS avg_liters_per_km_tx,
  sum(
    CASE
      WHEN dt.transaction_date >= (now() - interval '30 days') THEN dt.quantity_liters
      ELSE 0::numeric
    END
  ) AS consumption_last_30_days,
  count(
    CASE
      WHEN dt.transaction_date >= (now() - interval '30 days') THEN 1
      ELSE NULL::integer
    END
  )::bigint AS transactions_last_30_days
FROM public.diesel_transactions dt
JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
JOIN public.plants p ON p.id = w.plant_id
LEFT JOIN public.assets a ON a.id = dt.asset_id
JOIN public.diesel_products dp ON dp.id = dt.product_id
WHERE dt.transaction_type = 'consumption'
  AND dt.is_transfer = false
  AND dp.product_type = 'diesel'
  AND w.product_type = 'diesel'
GROUP BY
  dt.warehouse_id,
  w.name,
  w.plant_id,
  p.name,
  dt.asset_id,
  a.name,
  a.asset_id,
  dt.exception_asset_name,
  dt.asset_category,
  dp.product_type;

COMMENT ON VIEW public.diesel_asset_consumption_by_warehouse IS
  'Per-warehouse diesel consumption aggregates by formal asset or exception name (plant via warehouse).';

CREATE OR REPLACE VIEW public.diesel_monthly_consumption_by_asset AS
SELECT
  dt.warehouse_id,
  w.name AS warehouse_name,
  w.plant_id,
  to_char(
    (date_trunc('month', dt.transaction_date AT TIME ZONE 'America/Mexico_City')),
    'YYYY-MM'
  ) AS year_month,
  dt.asset_id,
  dt.exception_asset_name,
  dt.asset_category,
  count(*)::bigint AS transaction_count,
  coalesce(sum(dt.quantity_liters), 0)::numeric AS total_liters,
  coalesce(sum(dt.hours_consumed), 0)::numeric AS total_hours_consumed,
  coalesce(sum(dt.kilometers_consumed), 0)::numeric AS total_km_consumed,
  min(dt.transaction_date) AS period_first_tx,
  max(dt.transaction_date) AS period_last_tx
FROM public.diesel_transactions dt
JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
JOIN public.diesel_products dp ON dp.id = dt.product_id
WHERE dt.transaction_type = 'consumption'
  AND dt.is_transfer = false
  AND dp.product_type = 'diesel'
  AND w.product_type = 'diesel'
GROUP BY
  dt.warehouse_id,
  w.name,
  w.plant_id,
  to_char(
    (date_trunc('month', dt.transaction_date AT TIME ZONE 'America/Mexico_City')),
    'YYYY-MM'
  ),
  dt.asset_id,
  dt.exception_asset_name,
  dt.asset_category;

COMMENT ON VIEW public.diesel_monthly_consumption_by_asset IS
  'Monthly diesel consumption per warehouse and asset dimension (formal asset_id or exception name).';

GRANT SELECT ON public.diesel_asset_consumption_summary TO anon, authenticated, service_role;
GRANT SELECT ON public.diesel_asset_consumption_by_warehouse TO anon, authenticated, service_role;
GRANT SELECT ON public.diesel_monthly_consumption_by_asset TO anon, authenticated, service_role;

-- Restored after numeric columns on assets (view selects initial/current hours and km).
CREATE OR REPLACE VIEW public.active_assets_without_recent_inspection AS
SELECT
  a.id,
  a.asset_id,
  a.name,
  a.model_id,
  a.serial_number,
  a.location,
  a.department,
  a.purchase_date,
  a.installation_date,
  a.initial_hours,
  a.current_hours,
  a.initial_kilometers,
  a.current_kilometers,
  a.status,
  a.notes,
  a.warranty_expiration,
  a.is_new,
  a.purchase_cost,
  a.registration_info,
  a.insurance_policy,
  a.insurance_start_date,
  a.insurance_end_date,
  a.photos,
  a.insurance_documents,
  a.last_maintenance_date,
  a.created_by,
  a.created_at,
  a.updated_at,
  a.updated_by,
  a.last_inspection_date,
  em.name AS model_name,
  em.manufacturer,
  COALESCE(cc.last_inspection, a.last_inspection_date, a.last_maintenance_date) AS last_inspection,
  EXTRACT(day FROM (now() - COALESCE(cc.last_inspection, a.last_inspection_date, a.last_maintenance_date)))
    AS days_since_last_inspection
FROM assets a
JOIN equipment_models em ON a.model_id = em.id
LEFT JOIN (
  SELECT completed_checklists.asset_id, max(completed_checklists.completion_date) AS last_inspection
  FROM completed_checklists
  GROUP BY completed_checklists.asset_id
) cc ON a.id = cc.asset_id
WHERE a.status = 'activo'::text
  AND (
    COALESCE(cc.last_inspection, a.last_inspection_date, a.last_maintenance_date) IS NULL
    OR EXTRACT(day FROM (now() - COALESCE(cc.last_inspection, a.last_inspection_date, a.last_maintenance_date))) > 30::numeric
  );

COMMENT ON VIEW public.active_assets_without_recent_inspection IS
  'Assets activos sin inspección reciente (rebuilt after numeric meter columns).';

GRANT ALL ON TABLE public.active_assets_without_recent_inspection TO anon, authenticated, service_role;