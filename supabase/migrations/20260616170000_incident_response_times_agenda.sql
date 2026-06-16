-- Incident response-time tracking and agenda support.
-- Populates milestone timestamps on incident_history from linked work_orders.

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS first_wo_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_planned_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS target_response_hours integer DEFAULT 48;

COMMENT ON COLUMN public.incident_history.first_wo_created_at IS
  'First time a work order was linked to this incident.';
COMMENT ON COLUMN public.incident_history.first_planned_at IS
  'First time a linked work order received a planned_date.';
COMMENT ON COLUMN public.incident_history.first_assigned_at IS
  'First time a linked work order received assigned_to.';
COMMENT ON COLUMN public.incident_history.resolved_at IS
  'When the incident was marked Resuelto.';
COMMENT ON COLUMN public.incident_history.target_response_hours IS
  'Target hours from report to planned_date (default 48h).';

-- Backfill from existing work_orders
UPDATE public.incident_history ih
SET
  first_wo_created_at = sub.wo_created_at,
  first_planned_at = sub.first_planned,
  first_assigned_at = sub.first_assigned
FROM (
  SELECT
    wo.incident_id,
    MIN(wo.created_at) AS wo_created_at,
    MIN(wo.planned_date) FILTER (WHERE wo.planned_date IS NOT NULL) AS first_planned,
    MIN(wo.created_at) FILTER (WHERE wo.assigned_to IS NOT NULL) AS first_assigned
  FROM public.work_orders wo
  WHERE wo.incident_id IS NOT NULL
  GROUP BY wo.incident_id
) sub
WHERE ih.id = sub.incident_id
  AND ih.first_wo_created_at IS NULL;

UPDATE public.incident_history
SET resolved_at = COALESCE(updated_at, created_at)
WHERE LOWER(status) IN ('resuelto', 'cerrado', 'resolved', 'closed')
  AND resolved_at IS NULL;

-- Sync milestones when work_orders change
CREATE OR REPLACE FUNCTION public.sync_incident_response_milestones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident_id uuid;
BEGIN
  v_incident_id := COALESCE(NEW.incident_id, OLD.incident_id);
  IF v_incident_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE public.incident_history ih
    SET first_wo_created_at = LEAST(ih.first_wo_created_at, NEW.created_at)
    WHERE ih.id = v_incident_id
      AND (ih.first_wo_created_at IS NULL OR NEW.created_at < ih.first_wo_created_at);

    IF NEW.planned_date IS NOT NULL THEN
      UPDATE public.incident_history ih
      SET first_planned_at = LEAST(ih.first_planned_at, NEW.planned_date::timestamptz)
      WHERE ih.id = v_incident_id
        AND (ih.first_planned_at IS NULL OR NEW.planned_date::timestamptz < ih.first_planned_at);
    END IF;

    IF NEW.assigned_to IS NOT NULL THEN
      UPDATE public.incident_history ih
      SET first_assigned_at = LEAST(ih.first_assigned_at, NEW.created_at)
      WHERE ih.id = v_incident_id
        AND (ih.first_assigned_at IS NULL OR NEW.created_at < ih.first_assigned_at);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.planned_date IS NOT NULL AND (OLD.planned_date IS DISTINCT FROM NEW.planned_date) THEN
      UPDATE public.incident_history ih
      SET first_planned_at = LEAST(ih.first_planned_at, NEW.planned_date::timestamptz)
      WHERE ih.id = v_incident_id
        AND (ih.first_planned_at IS NULL OR NEW.planned_date::timestamptz < ih.first_planned_at);
    END IF;

    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
      UPDATE public.incident_history ih
      SET first_assigned_at = LEAST(ih.first_assigned_at, NOW())
      WHERE ih.id = v_incident_id
        AND (ih.first_assigned_at IS NULL OR NOW() < ih.first_assigned_at);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_incident_response_milestones ON public.work_orders;
CREATE TRIGGER trg_sync_incident_response_milestones
  AFTER INSERT OR UPDATE OF planned_date, assigned_to, incident_id ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_incident_response_milestones();

-- Set resolved_at when incident status changes to resolved
CREATE OR REPLACE FUNCTION public.sync_incident_resolved_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF LOWER(NEW.status) IN ('resuelto', 'cerrado', 'resolved', 'closed')
     AND (OLD.status IS NULL OR LOWER(OLD.status) NOT IN ('resuelto', 'cerrado', 'resolved', 'closed')) THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, NOW());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_incident_resolved_at ON public.incident_history;
CREATE TRIGGER trg_sync_incident_resolved_at
  BEFORE UPDATE OF status ON public.incident_history
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_incident_resolved_at();

-- Reporting view
CREATE OR REPLACE VIEW public.incident_response_metrics AS
SELECT
  ih.id AS incident_id,
  ih.asset_id,
  ih.status,
  ih.created_at AS reported_at,
  ih.first_wo_created_at,
  ih.first_planned_at,
  ih.first_assigned_at,
  ih.resolved_at,
  ih.target_response_hours,
  ROUND(
    EXTRACT(EPOCH FROM (ih.first_wo_created_at - ih.created_at)) / 3600.0,
    1
  ) AS hours_to_work_order,
  ROUND(
    EXTRACT(EPOCH FROM (ih.first_planned_at - ih.created_at)) / 3600.0,
    1
  ) AS hours_to_schedule,
  ROUND(
    EXTRACT(EPOCH FROM (ih.resolved_at - ih.created_at)) / 3600.0,
    1
  ) AS hours_to_resolve,
  CASE
    WHEN ih.first_planned_at IS NOT NULL AND ih.target_response_hours IS NOT NULL THEN
      ih.first_planned_at <= ih.created_at + (ih.target_response_hours || ' hours')::interval
    ELSE NULL
  END AS met_schedule_target
FROM public.incident_history ih
WHERE ih.merged_into_id IS NULL;

COMMENT ON VIEW public.incident_response_metrics IS
  'Derived response-time KPIs per incident for agenda and SLA reporting.';
