-- Trusted km for L/km: merged odómetro + checklist curve (app), parallel to hours_merged / hours_trusted.

ALTER TABLE public.asset_diesel_efficiency_monthly
  ADD COLUMN IF NOT EXISTS kilometers_merged numeric(14, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kilometers_trusted numeric(14, 4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.asset_diesel_efficiency_monthly.kilometers_merged IS
  'Km from merged diesel + checklist odómetro curve inside the Mexico_City calendar month (prorated at edges).';

COMMENT ON COLUMN public.asset_diesel_efficiency_monthly.kilometers_trusted IS
  'Denominator for liters_per_km: merged km when that curve is positive in-window, else sum(kilometers_consumed) on consumption rows.';

COMMENT ON COLUMN public.asset_diesel_efficiency_monthly.liters_per_km IS
  'total_liters / kilometers_trusted (merged-first km policy; kilometers_sum_raw remains raw tx sum for diagnostics).';

COMMENT ON COLUMN public.asset_diesel_efficiency_monthly.kilometers_sum_raw IS
  'Sum of diesel_transactions.kilometers_consumed in the month (raw row deltas; may diverge from kilometers_trusted).';
