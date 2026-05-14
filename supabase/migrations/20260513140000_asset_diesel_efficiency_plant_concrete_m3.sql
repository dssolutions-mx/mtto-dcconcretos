-- Plant-level Cotizador concrete m³ per calendar month (sum by maintenance plant_id).
-- After deploy, run POST /api/reports/asset-diesel-efficiency with recompute for months to backfill.

ALTER TABLE public.asset_diesel_efficiency_monthly
  ADD COLUMN IF NOT EXISTS plant_concrete_m3 numeric(14, 4);

COMMENT ON COLUMN public.asset_diesel_efficiency_monthly.plant_concrete_m3 IS
  'Total concrete m³ from Cotizador sales in this calendar month for the asset''s home MantenPro plant_id (sum of weekly sales rows grouped by mapped Cotizador→maintenance plant; not prorated per asset).';
