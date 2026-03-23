-- Schedule KPI rollup refresh via Supabase pg_cron (company standard).
-- Superseded function logic: see 20260326130000_ingresos_kpi_rollup_via_edge_function.sql
-- (Vault + Edge Function → Next.js; no app_settings).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.call_refresh_ingresos_kpi_rollup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT value INTO v_url FROM public.app_settings WHERE key = 'ingresos_kpi_rollup_refresh_url';
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'ingresos_kpi_rollup_refresh_secret';

  IF v_url IS NULL OR trim(v_url) = '' THEN
    RAISE WARNING 'ingresos_kpi_rollup_refresh_url not set; skipping KPI rollup refresh';
    RETURN;
  END IF;

  IF v_secret IS NULL OR trim(v_secret) = '' THEN
    RAISE WARNING 'ingresos_kpi_rollup_refresh_secret not set; skipping KPI rollup refresh';
    RETURN;
  END IF;

  v_request_id := net.http_post(
    trim(v_url),
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || trim(v_secret)
    ),
    120000
  );

  RAISE LOG 'ingresos_kpi_rollup_refresh enqueued request_id=%', v_request_id;
END;
$$;

COMMENT ON FUNCTION public.call_refresh_ingresos_kpi_rollup() IS
  'pg_cron target (legacy app_settings). Replaced by Vault+Edge in migration 20260326130000.';

-- Idempotent: replace job if re-run
DO $$
DECLARE
  jid integer;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'refresh-ingresos-kpi-rollup' LIMIT 1;
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- Daily 12:00 UTC (adjust in SQL Editor if needed)
SELECT cron.schedule(
  'refresh-ingresos-kpi-rollup',
  '0 12 * * *',
  $$SELECT public.call_refresh_ingresos_kpi_rollup();$$
);
