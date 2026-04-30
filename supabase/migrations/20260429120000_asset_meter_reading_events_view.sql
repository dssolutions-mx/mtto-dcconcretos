-- Raw unified timeline: diesel consumption meter rows, checklist equipment readings,
-- and fleet audit rows for current_hours / current_kilometers. SECURITY INVOKER so
-- underlying table RLS applies. Aggregated "hours worked" capping stays in app (v1).

CREATE OR REPLACE VIEW public.asset_meter_reading_events
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
  coalesce(al.source, 'fleet_audit')::text AS row_source
FROM public.assets_audit_log al
LEFT JOIN public.assets a ON a.id = al.asset_id
WHERE al.field IN ('current_hours', 'current_kilometers');

COMMENT ON VIEW public.asset_meter_reading_events IS
  'Raw union of diesel consumption meter readings, checklist equipment readings, and '
  'assets_audit_log rows for current_hours/current_kilometers. Use event_at for operational '
  'ordering and recorded_at for ingestion order. Not a substitute for merged/capped hours logic.';

GRANT SELECT ON public.asset_meter_reading_events TO anon, authenticated, service_role;

-- Log meter field changes on assets when not already logged by app (bulk-update logs manually;
-- we skip duplicate by only inserting from trigger — app bulk-update stops logging these fields).

CREATE OR REPLACE FUNCTION public.trg_log_asset_meter_to_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  v_user := coalesce(NEW.updated_by, auth.uid());
  IF NEW.current_hours IS DISTINCT FROM OLD.current_hours THEN
    IF v_user IS NOT NULL THEN
      INSERT INTO public.assets_audit_log (asset_id, user_id, field, before_value, after_value, source)
      VALUES (
        NEW.id,
        v_user,
        'current_hours',
        CASE WHEN OLD.current_hours IS NULL THEN NULL ELSE trim(to_char(OLD.current_hours, 'FM999999990.09')) END,
        CASE WHEN NEW.current_hours IS NULL THEN NULL ELSE trim(to_char(NEW.current_hours, 'FM999999990.09')) END,
        'db_trigger_asset_meter'
      );
    END IF;
  END IF;

  IF NEW.current_kilometers IS DISTINCT FROM OLD.current_kilometers THEN
    IF v_user IS NOT NULL THEN
      INSERT INTO public.assets_audit_log (asset_id, user_id, field, before_value, after_value, source)
      VALUES (
        NEW.id,
        v_user,
        'current_kilometers',
        CASE WHEN OLD.current_kilometers IS NULL THEN NULL ELSE trim(to_char(OLD.current_kilometers, 'FM999999990.09')) END,
        CASE WHEN NEW.current_kilometers IS NULL THEN NULL ELSE trim(to_char(NEW.current_kilometers, 'FM999999990.09')) END,
        'db_trigger_asset_meter'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assets_meter_audit ON public.assets;
CREATE TRIGGER trg_assets_meter_audit
  AFTER UPDATE OF current_hours, current_kilometers ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_asset_meter_to_audit_log();

COMMENT ON FUNCTION public.trg_log_asset_meter_to_audit_log() IS
  'Append-only assets_audit_log rows for current_hours/current_kilometers changes; uses updated_by or auth.uid().';

GRANT EXECUTE ON FUNCTION public.trg_log_asset_meter_to_audit_log() TO authenticated, service_role;
