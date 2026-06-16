-- Prevent duplicate active tire installations at the database level.

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_tire_one_active_per_tire
  ON public.asset_tire_installations (tire_id)
  WHERE removed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_tire_one_active_per_position
  ON public.asset_tire_installations (asset_id, position_code)
  WHERE removed_at IS NULL;
