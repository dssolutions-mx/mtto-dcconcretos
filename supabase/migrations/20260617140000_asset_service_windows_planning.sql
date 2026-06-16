-- Asset service windows: canonical planned downtime linking OTs, asset status, and ops comms.
-- Inspired by cotizador scheduling (orders.delivery_date/time, muestras.fecha_programada_ensayo_ts).

-- ---------------------------------------------------------------------------
-- Service windows (planned unit downtime)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.asset_service_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  plant_id uuid REFERENCES public.plants(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  planning_status text NOT NULL DEFAULT 'draft'
    CHECK (planning_status IN ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  reason text CHECK (reason IN ('corrective', 'preventive', 'inspection', 'other')),
  notes text,
  ops_notified_at timestamptz,
  ops_acknowledged_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_service_windows_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_asset_service_windows_asset_starts
  ON public.asset_service_windows (asset_id, starts_at)
  WHERE planning_status NOT IN ('cancelled', 'completed');

CREATE INDEX IF NOT EXISTS idx_asset_service_windows_wo
  ON public.asset_service_windows (work_order_id)
  WHERE work_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asset_service_windows_plant_starts
  ON public.asset_service_windows (plant_id, starts_at)
  WHERE planning_status IN ('confirmed', 'in_progress');

-- ---------------------------------------------------------------------------
-- Asset status audit trail
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.asset_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  source_type text NOT NULL
    CHECK (source_type IN ('manual', 'work_order_scheduled', 'work_order_completed', 'service_window', 'system')),
  source_id uuid,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_status_events_asset
  ON public.asset_status_events (asset_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Ops notification queue (pattern: quality_notification_queue in cotizador)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.maintenance_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL
    CHECK (notification_type IN ('ops_service_window', 'technician_digest', 'sla_breach')),
  recipient_role text,
  recipient_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  plant_id uuid REFERENCES public.plants(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_send_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maint_notif_queue_pending
  ON public.maintenance_notification_queue (scheduled_send_at)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Work order time windows
-- ---------------------------------------------------------------------------

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS planned_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS planned_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_window_id uuid REFERENCES public.asset_service_windows(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Helpers: log status change
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_asset_status_event(
  p_asset_id uuid,
  p_previous_status text,
  p_new_status text,
  p_source_type text,
  p_source_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_previous_status IS NOT DISTINCT FROM p_new_status THEN
    RETURN;
  END IF;

  INSERT INTO public.asset_status_events (
    asset_id, previous_status, new_status, source_type, source_id, notes, created_by
  ) VALUES (
    p_asset_id, p_previous_status, p_new_status, p_source_type, p_source_id, p_notes, p_created_by
  );

  UPDATE public.assets
  SET status = p_new_status, updated_at = now()
  WHERE id = p_asset_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Apply asset status when service window is confirmed
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.on_service_window_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text;
BEGIN
  SELECT status INTO v_prev FROM public.assets WHERE id = NEW.asset_id;

  IF NEW.planning_status = 'confirmed' AND (OLD.planning_status IS DISTINCT FROM 'confirmed') THEN
    PERFORM public.log_asset_status_event(
      NEW.asset_id, v_prev, 'maintenance', 'service_window', NEW.id,
      'Ventana de servicio confirmada', NEW.created_by
    );
  ELSIF NEW.planning_status IN ('completed', 'cancelled')
    AND OLD.planning_status NOT IN ('completed', 'cancelled') THEN
    -- Restore operational only if no other active windows or open WOs on asset
    IF NOT EXISTS (
      SELECT 1 FROM public.asset_service_windows sw
      WHERE sw.asset_id = NEW.asset_id
        AND sw.id <> NEW.id
        AND sw.planning_status IN ('confirmed', 'in_progress')
    ) AND NOT EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.asset_id = NEW.asset_id
        AND wo.status IN ('Pendiente', 'Programada', 'Esperando repuestos')
        AND (wo.id IS DISTINCT FROM NEW.work_order_id)
    ) THEN
      PERFORM public.log_asset_status_event(
        NEW.asset_id, v_prev, 'operational', 'service_window', NEW.id,
        'Ventana de servicio cerrada', NEW.created_by
      );
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_window_status ON public.asset_service_windows;
CREATE TRIGGER trg_service_window_status
  BEFORE UPDATE OF planning_status ON public.asset_service_windows
  FOR EACH ROW
  EXECUTE FUNCTION public.on_service_window_status_change();

-- Confirmed windows inserted directly (schedule flow) must also flip asset status
CREATE OR REPLACE FUNCTION public.on_service_window_insert_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text;
BEGIN
  IF NEW.planning_status = 'confirmed' THEN
    SELECT status INTO v_prev FROM public.assets WHERE id = NEW.asset_id;
    PERFORM public.log_asset_status_event(
      NEW.asset_id, v_prev, 'maintenance', 'service_window', NEW.id,
      'Ventana de servicio confirmada', NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_window_insert_confirmed ON public.asset_service_windows;
CREATE TRIGGER trg_service_window_insert_confirmed
  AFTER INSERT ON public.asset_service_windows
  FOR EACH ROW
  WHEN (NEW.planning_status = 'confirmed')
  EXECUTE FUNCTION public.on_service_window_insert_confirmed();

-- ---------------------------------------------------------------------------
-- Row level security (authenticated maintenance roles)
-- ---------------------------------------------------------------------------

ALTER TABLE public.asset_service_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_service_windows_select ON public.asset_service_windows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY asset_service_windows_insert ON public.asset_service_windows
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY asset_service_windows_update ON public.asset_service_windows
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY asset_status_events_select ON public.asset_status_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY asset_status_events_insert ON public.asset_status_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY maint_notif_queue_select ON public.maintenance_notification_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY maint_notif_queue_insert ON public.maintenance_notification_queue
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY maint_notif_queue_update ON public.maintenance_notification_queue
  FOR UPDATE TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Planning calendar view (service windows + work orders)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.planning_calendar_events AS
SELECT
  sw.id AS event_id,
  'service_window'::text AS event_type,
  sw.asset_id,
  sw.work_order_id,
  sw.plant_id,
  sw.starts_at,
  sw.ends_at,
  sw.planning_status AS status,
  sw.reason,
  sw.ops_notified_at,
  a.asset_id AS asset_code,
  a.name AS asset_name,
  a.status AS asset_status,
  wo.order_id AS work_order_label,
  wo.assigned_to AS technician_id
FROM public.asset_service_windows sw
JOIN public.assets a ON a.id = sw.asset_id
LEFT JOIN public.work_orders wo ON wo.id = sw.work_order_id
WHERE sw.planning_status NOT IN ('cancelled')

UNION ALL

SELECT
  wo.id AS event_id,
  'work_order'::text AS event_type,
  wo.asset_id,
  wo.id AS work_order_id,
  wo.plant_id,
  COALESCE(wo.planned_start_at, wo.planned_date::timestamptz) AS starts_at,
  COALESCE(
    wo.planned_end_at,
    COALESCE(wo.planned_start_at, wo.planned_date::timestamptz)
      + (COALESCE(wo.estimated_duration, 4) || ' hours')::interval
  ) AS ends_at,
  wo.status,
  NULL::text AS reason,
  NULL::timestamptz AS ops_notified_at,
  a.asset_id AS asset_code,
  a.name AS asset_name,
  a.status AS asset_status,
  wo.order_id AS work_order_label,
  wo.assigned_to AS technician_id
FROM public.work_orders wo
JOIN public.assets a ON a.id = wo.asset_id
WHERE wo.planned_date IS NOT NULL
  AND wo.status IN ('Pendiente', 'Programada', 'Esperando repuestos')
  AND wo.service_window_id IS NULL;

COMMENT ON VIEW public.planning_calendar_events IS
  'Unified planning calendar: service windows and standalone scheduled work orders.';
