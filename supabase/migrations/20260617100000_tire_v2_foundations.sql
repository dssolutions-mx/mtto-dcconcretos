-- Tire module v2 Sprint 0: layouts, fleet settings, onboarding progress.

-- ---------------------------------------------------------------------------
-- Layout per equipment model
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment_model_tire_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.equipment_models(id) ON DELETE CASCADE,
  template_key text NOT NULL DEFAULT 'truck_6x4',
  positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  svg_variant text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_model_tire_layouts_model_id_unique UNIQUE (model_id)
);

COMMENT ON TABLE public.equipment_model_tire_layouts IS
  'Layout de posiciones de llantas por modelo de equipo.';
COMMENT ON COLUMN public.equipment_model_tire_layouts.template_key IS
  'Plantilla base: truck_6x4, vehicle_4wheel, custom.';
COMMENT ON COLUMN public.equipment_model_tire_layouts.positions IS
  'Array JSON de posiciones; vacío usa la plantilla indicada en template_key.';
COMMENT ON COLUMN public.equipment_model_tire_layouts.svg_variant IS
  'Variante del diagrama SVG (v1, v2, etc.).';

CREATE INDEX IF NOT EXISTS idx_equipment_model_tire_layouts_model
  ON public.equipment_model_tire_layouts (model_id);

-- ---------------------------------------------------------------------------
-- Fleet-wide tire settings (global or per plant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tire_fleet_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid REFERENCES public.plants(id) ON DELETE CASCADE,
  id_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  checklist_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tire_fleet_settings_plant_id_unique UNIQUE (plant_id)
);

COMMENT ON TABLE public.tire_fleet_settings IS
  'Reglas de identificación, umbrales y defaults de checklist para llantas.';
COMMENT ON COLUMN public.tire_fleet_settings.plant_id IS
  'NULL = configuración global; UUID = override por planta.';
COMMENT ON COLUMN public.tire_fleet_settings.id_rules IS
  'Reglas DOT / prefijo interno / auto-generación.';
COMMENT ON COLUMN public.tire_fleet_settings.thresholds IS
  'Umbrales PSI, mm mínimo, días sin lectura, etc.';
COMMENT ON COLUMN public.tire_fleet_settings.checklist_defaults IS
  'Defaults reading_mode por categoría de activo.';

CREATE INDEX IF NOT EXISTS idx_tire_fleet_settings_plant
  ON public.tire_fleet_settings (plant_id)
  WHERE plant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Onboarding wizard progress per plant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tire_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid REFERENCES public.plants(id) ON DELETE CASCADE,
  step text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tire_onboarding_progress_plant_step_unique UNIQUE (plant_id, step)
);

COMMENT ON TABLE public.tire_onboarding_progress IS
  'Progreso del asistente de onboarding de llantas por planta.';
COMMENT ON COLUMN public.tire_onboarding_progress.step IS
  'Paso del wizard: scope, layouts, id_rules, inventory, pilot.';

CREATE INDEX IF NOT EXISTS idx_tire_onboarding_progress_plant
  ON public.tire_onboarding_progress (plant_id);

-- ---------------------------------------------------------------------------
-- Performance indexes (Sprint 0)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tires_plant_status
  ON public.tires (plant_id, status);

-- idx_asset_tire_installations_active already exists from asset_tires migration

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.equipment_model_tire_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tire_fleet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tire_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY equipment_model_tire_layouts_select ON public.equipment_model_tire_layouts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY equipment_model_tire_layouts_insert ON public.equipment_model_tire_layouts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY equipment_model_tire_layouts_update ON public.equipment_model_tire_layouts
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY equipment_model_tire_layouts_delete ON public.equipment_model_tire_layouts
  FOR DELETE TO authenticated USING (true);

CREATE POLICY tire_fleet_settings_select ON public.tire_fleet_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tire_fleet_settings_insert ON public.tire_fleet_settings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tire_fleet_settings_update ON public.tire_fleet_settings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY tire_onboarding_progress_select ON public.tire_onboarding_progress
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tire_onboarding_progress_insert ON public.tire_onboarding_progress
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tire_onboarding_progress_update ON public.tire_onboarding_progress
  FOR UPDATE TO authenticated USING (true);
