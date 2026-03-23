-- Switch KPI rollup cron to Supabase’s standard pattern: Vault + Edge Function → Next.js
-- (replaces reading app_settings in call_refresh_ingresos_kpi_rollup).
--
-- 1) Vault (SQL Editor — same secrets as other pg_cron → Edge jobs; skip if already present):
--    select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--    select vault.create_secret('YOUR_ANON_KEY', 'anon_key');
--
-- 2) Deploy Edge Function: refresh-ingresos-kpi-rollup (repo: supabase/functions/refresh-ingresos-kpi-rollup)
--
-- 3) Edge Function secrets (Dashboard → Edge Functions → refresh-ingresos-kpi-rollup → Secrets):
--    INGRESOS_KPI_REFRESH_TARGET_URL  = https://<your-app-host>/api/internal/refresh-ingresos-kpi-rollup
--    INGRESOS_KPI_REFRESH_TARGET_BEARER = same as CRON_SECRET on the Next.js app

CREATE OR REPLACE FUNCTION public.call_refresh_ingresos_kpi_rollup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_anon text;
  v_request_id bigint;
BEGIN
  SELECT ds.decrypted_secret INTO v_base
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'project_url'
  LIMIT 1;

  SELECT ds.decrypted_secret INTO v_anon
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'anon_key'
  LIMIT 1;

  IF v_base IS NULL OR trim(v_base) = '' THEN
    RAISE WARNING 'Vault secret ''project_url'' missing; create it (see migration header ingresos_kpi_rollup_via_edge_function)';
    RETURN;
  END IF;

  IF v_anon IS NULL OR trim(v_anon) = '' THEN
    RAISE WARNING 'Vault secret ''anon_key'' missing; create it (see migration header ingresos_kpi_rollup_via_edge_function)';
    RETURN;
  END IF;

  v_request_id := net.http_post(
    url := rtrim(trim(v_base), '/') || '/functions/v1/refresh-ingresos-kpi-rollup',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || trim(v_anon)
    ),
    timeout_milliseconds := 120000
  );

  RAISE LOG 'ingresos_kpi_rollup: edge function invoke enqueued, request_id=%', v_request_id;
END;
$$;

COMMENT ON FUNCTION public.call_refresh_ingresos_kpi_rollup() IS
  'pg_cron: POST Edge Function refresh-ingresos-kpi-rollup (Vault: project_url, anon_key). Edge forwards to Next.js using Edge secrets.';
