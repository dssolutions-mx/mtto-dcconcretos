-- Internal tire identifier (auto-generated from fleet id_rules)

ALTER TABLE public.tires
  ADD COLUMN IF NOT EXISTS internal_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tires_internal_code_unique
  ON public.tires (internal_code)
  WHERE internal_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tires_internal_code_plant
  ON public.tires (plant_id, internal_code)
  WHERE internal_code IS NOT NULL;

COMMENT ON COLUMN public.tires.internal_code IS
  'Identificador interno de flota (auto-generado según tire_fleet_settings.id_rules).';
