-- Diesel analytics: warehouse-scored asset rollups and monthly series.
-- RLS on underlying diesel_transactions applies when querying these views (security invoker).

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

GRANT SELECT ON public.diesel_asset_consumption_by_warehouse TO anon, authenticated, service_role;
GRANT SELECT ON public.diesel_monthly_consumption_by_asset TO anon, authenticated, service_role;

-- Date-filtered aggregates (SECURITY INVOKER → RLS on diesel_transactions applies)

CREATE OR REPLACE FUNCTION public.diesel_analytics_overview_totals(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_plant_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_consumption',
      coalesce(
        sum(
          CASE
            WHEN dt.transaction_type = 'consumption' AND NOT dt.is_transfer
              THEN dt.quantity_liters
            ELSE 0::numeric
          END
        ),
        0::numeric
      ),
    'total_entries',
      coalesce(
        sum(
          CASE
            WHEN dt.transaction_type = 'entry' AND NOT dt.is_transfer
              THEN dt.quantity_liters
            ELSE 0::numeric
          END
        ),
        0::numeric
      ),
    'total_transfer_consumption_liters',
      coalesce(
        sum(
          CASE
            WHEN dt.transaction_type = 'consumption' AND dt.is_transfer
              THEN dt.quantity_liters
            ELSE 0::numeric
          END
        ),
        0::numeric
      ),
    'consumption_transaction_count',
      coalesce(
        sum(
          CASE
            WHEN dt.transaction_type = 'consumption' AND NOT dt.is_transfer THEN 1
            ELSE 0
          END
        )::bigint,
        0::bigint
      )
  )
  FROM public.diesel_transactions dt
  JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
  JOIN public.diesel_products dp ON dp.id = dt.product_id
  WHERE dp.product_type = 'diesel'
    AND w.product_type = 'diesel'
    AND (p_from IS NULL OR dt.transaction_date >= p_from)
    AND (p_to IS NULL OR dt.transaction_date <= p_to)
    AND (p_plant_ids IS NULL OR w.plant_id = ANY (p_plant_ids));
$$;

CREATE OR REPLACE FUNCTION public.diesel_analytics_warehouse_period(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_plant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  warehouse_id uuid,
  warehouse_name text,
  plant_id uuid,
  plant_name text,
  consumption_liters numeric,
  entry_liters numeric,
  net_flow numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    w.id,
    w.name,
    w.plant_id,
    p.name,
    coalesce(
      sum(
        CASE
          WHEN dt.transaction_type = 'consumption' AND NOT dt.is_transfer
            THEN dt.quantity_liters
          ELSE 0::numeric
        END
      ),
      0::numeric
    ),
    coalesce(
      sum(
        CASE
          WHEN dt.transaction_type = 'entry' AND NOT dt.is_transfer
            THEN dt.quantity_liters
          ELSE 0::numeric
        END
      ),
      0::numeric
    ),
    coalesce(
      sum(
        CASE
          WHEN dt.transaction_type = 'entry' AND NOT dt.is_transfer
            THEN dt.quantity_liters
          WHEN dt.transaction_type = 'consumption' AND NOT dt.is_transfer
            THEN -dt.quantity_liters
          WHEN dt.transaction_type = 'adjustment_positive' AND NOT dt.is_transfer
            THEN dt.quantity_liters
          WHEN dt.transaction_type = 'adjustment_negative' AND NOT dt.is_transfer
            THEN -dt.quantity_liters
          WHEN dt.transaction_type = 'adjustment' THEN dt.quantity_liters
          ELSE 0::numeric
        END
      ),
      0::numeric
    )
  FROM public.diesel_transactions dt
  JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
  JOIN public.plants p ON p.id = w.plant_id
  JOIN public.diesel_products dp ON dp.id = dt.product_id
  WHERE dp.product_type = 'diesel'
    AND w.product_type = 'diesel'
    AND (p_from IS NULL OR dt.transaction_date >= p_from)
    AND (p_to IS NULL OR dt.transaction_date <= p_to)
    AND (p_plant_ids IS NULL OR w.plant_id = ANY (p_plant_ids))
  GROUP BY w.id, w.name, w.plant_id, p.name;
$$;

CREATE OR REPLACE FUNCTION public.diesel_analytics_assets_in_period(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_warehouse_id uuid DEFAULT NULL,
  p_plant_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  warehouse_id uuid,
  warehouse_name text,
  plant_id uuid,
  plant_name text,
  asset_id uuid,
  asset_name text,
  asset_code text,
  exception_asset_name text,
  asset_category text,
  transaction_count bigint,
  total_consumption numeric,
  avg_consumption_per_transaction numeric,
  first_consumption timestamptz,
  last_consumption timestamptz,
  sum_hours_consumed numeric,
  sum_km_consumed numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    w.id,
    w.name,
    w.plant_id,
    pl.name,
    dt.asset_id,
    a.name,
    a.asset_id,
    dt.exception_asset_name,
    dt.asset_category,
    count(*)::bigint,
    coalesce(sum(dt.quantity_liters), 0::numeric),
    avg(dt.quantity_liters),
    min(dt.transaction_date),
    max(dt.transaction_date),
    coalesce(sum(dt.hours_consumed), 0::numeric),
    coalesce(sum(dt.kilometers_consumed), 0::numeric)
  FROM public.diesel_transactions dt
  JOIN public.diesel_warehouses w ON w.id = dt.warehouse_id
  JOIN public.plants pl ON pl.id = w.plant_id
  JOIN public.diesel_products dp ON dp.id = dt.product_id
  LEFT JOIN public.assets a ON a.id = dt.asset_id
  WHERE dt.transaction_type = 'consumption'
    AND NOT dt.is_transfer
    AND dp.product_type = 'diesel'
    AND w.product_type = 'diesel'
    AND (p_from IS NULL OR dt.transaction_date >= p_from)
    AND (p_to IS NULL OR dt.transaction_date <= p_to)
    AND (p_warehouse_id IS NULL OR dt.warehouse_id = p_warehouse_id)
    AND (p_plant_ids IS NULL OR w.plant_id = ANY (p_plant_ids))
  GROUP BY
    w.id,
    w.name,
    w.plant_id,
    pl.name,
    dt.asset_id,
    a.name,
    a.asset_id,
    dt.exception_asset_name,
    dt.asset_category;
$$;

GRANT EXECUTE ON FUNCTION public.diesel_analytics_overview_totals(timestamptz, timestamptz, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.diesel_analytics_warehouse_period(timestamptz, timestamptz, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.diesel_analytics_assets_in_period(timestamptz, timestamptz, uuid, uuid[]) TO authenticated, service_role;
