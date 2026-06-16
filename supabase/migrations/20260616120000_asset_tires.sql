-- Asset tire management: catalog, installations, readings, and lifecycle events.

-- ---------------------------------------------------------------------------
-- Catalog (inventory of individual tires)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text,
  brand text NOT NULL,
  model text,
  size text NOT NULL,
  condition text NOT NULL DEFAULT 'nueva'
    CHECK (condition IN ('nueva', 'renovada')),
  purchase_cost numeric(12, 2),
  purchase_date date,
  status text NOT NULL DEFAULT 'en_almacen'
    CHECK (status IN ('en_almacen', 'montada', 'baja')),
  min_tread_mm numeric(5, 2) NOT NULL DEFAULT 3.0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tires IS 'Catálogo de llantas individuales (inventario y ciclo de vida).';
COMMENT ON COLUMN public.tires.serial_number IS 'DOT / número de serie de la llanta.';
COMMENT ON COLUMN public.tires.min_tread_mm IS 'Umbral mínimo de profundidad de banda (mm) para alertas.';

CREATE INDEX IF NOT EXISTS idx_tires_status ON public.tires (status);
CREATE INDEX IF NOT EXISTS idx_tires_serial ON public.tires (serial_number) WHERE serial_number IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Installations (mount / dismount history per asset position)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_tire_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid NOT NULL REFERENCES public.tires(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  position_code text NOT NULL,
  position_label text NOT NULL,
  axle_number smallint,
  installed_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  km_at_install numeric(12, 2),
  hours_at_install numeric(12, 2),
  km_at_remove numeric(12, 2),
  hours_at_remove numeric(12, 2),
  installed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.asset_tire_installations IS 'Historial de montaje de llantas en activos y posiciones.';
COMMENT ON COLUMN public.asset_tire_installations.position_code IS 'Código de posición (ej. delantera_izq, trasera_der_exterior).';

CREATE INDEX IF NOT EXISTS idx_asset_tire_installations_asset
  ON public.asset_tire_installations (asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tire_installations_tire
  ON public.asset_tire_installations (tire_id);
CREATE INDEX IF NOT EXISTS idx_asset_tire_installations_active
  ON public.asset_tire_installations (asset_id)
  WHERE removed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Periodic readings (tread depth, pressure)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tire_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES public.asset_tire_installations(id) ON DELETE CASCADE,
  tire_id uuid NOT NULL REFERENCES public.tires(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  tread_depth_mm numeric(5, 2),
  pressure_psi numeric(6, 2),
  odometer_km numeric(12, 2),
  horometer_hours numeric(12, 2),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tire_readings IS 'Lecturas periódicas de profundidad de banda y presión.';

CREATE INDEX IF NOT EXISTS idx_tire_readings_installation
  ON public.tire_readings (installation_id, read_at DESC);
CREATE INDEX IF NOT EXISTS idx_tire_readings_asset
  ON public.tire_readings (asset_id, read_at DESC);

-- ---------------------------------------------------------------------------
-- Lifecycle events (rotation, repair, retread, disposal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tire_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_id uuid NOT NULL REFERENCES public.tires(id) ON DELETE CASCADE,
  installation_id uuid REFERENCES public.asset_tire_installations(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('montaje', 'desmontaje', 'rotacion', 'reparacion', 'renovado', 'baja')),
  event_at timestamptz NOT NULL DEFAULT now(),
  cost numeric(12, 2),
  from_position text,
  to_position text,
  odometer_km numeric(12, 2),
  horometer_hours numeric(12, 2),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tire_events IS 'Eventos del ciclo de vida de llantas (rotación, reparación, baja, etc.).';

CREATE INDEX IF NOT EXISTS idx_tire_events_tire ON public.tire_events (tire_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_tire_events_asset ON public.tire_events (asset_id, event_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.tires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_tire_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tire_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tire_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tires_select ON public.tires FOR SELECT TO authenticated USING (true);
CREATE POLICY tires_insert ON public.tires FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tires_update ON public.tires FOR UPDATE TO authenticated USING (true);

CREATE POLICY asset_tire_installations_select ON public.asset_tire_installations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY asset_tire_installations_insert ON public.asset_tire_installations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY asset_tire_installations_update ON public.asset_tire_installations
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY tire_readings_select ON public.tire_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY tire_readings_insert ON public.tire_readings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY tire_events_select ON public.tire_events FOR SELECT TO authenticated USING (true);
CREATE POLICY tire_events_insert ON public.tire_events FOR INSERT TO authenticated WITH CHECK (true);
