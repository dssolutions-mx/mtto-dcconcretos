/**
 * Set REPORTS_VERBOSE=1 (or true) to enable heavy diagnostic logging for
 * gerencial / ingresos-gastos / FIFO paths. Default off — faster and quieter.
 *
 * Dashboard KPI totals use SWR client-side deduping (`useDashboardMaintenanceCost`).
 * Cache tag `ingresos-gastos-report` (`lib/reports/ingresos-gastos-cache.ts`) is revalidated
 * after manual financial adjustments mutate; wire it to `unstable_cache` when adding server cache.
 *
 * Phase D — `ingresos_gastos_kpi_plant_month` (see `lib/reports/ingresos-gastos-kpi-rollup.ts`):
 * - INGRESOS_GASTOS_KPI_ROLLUP_READ — rollup read is ON by default; set 0/false/off to disable.
 * - INGRESOS_GASTOS_KPI_ROLLUP_MAX_AGE_SECONDS — max snapshot age (default 90000 ≈ 25h for daily cron).
 * - INGRESOS_GASTOS_KPI_ROLLUP_CRON_SECRET or CRON_SECRET — Bearer / x-ingresos-kpi-secret for
 *   GET|POST /api/internal/refresh-ingresos-kpi-rollup (also needs SUPABASE_SERVICE_ROLE_KEY).
 *   Schedule: pg_cron → call_refresh_ingresos_kpi_rollup() → Edge Function
 *   `refresh-ingresos-kpi-rollup` → POST that route. Vault: `project_url`, `anon_key` (Supabase
 *   docs: Scheduling Edge Functions). Edge secrets: INGRESOS_KPI_REFRESH_TARGET_URL,
 *   INGRESOS_KPI_REFRESH_TARGET_BEARER (= CRON_SECRET on Next.js).
 */
export const reportsVerbose =
  process.env.REPORTS_VERBOSE === '1' || process.env.REPORTS_VERBOSE === 'true'
