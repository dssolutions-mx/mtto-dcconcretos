-- PR4: per-asset fabrication year (optional follow-up to retire per-year catalog rows)
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS fabrication_year smallint;

COMMENT ON COLUMN public.assets.fabrication_year IS 'Year of manufacture for the physical unit; when null, use equipment_models.year_introduced';
