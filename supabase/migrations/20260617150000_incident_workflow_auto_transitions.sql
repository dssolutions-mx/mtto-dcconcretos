-- Phase 2: Auto-transitions on work order milestones
-- WO created → implicit acknowledge; planned_date → en_atencion; WO complete → cerrado

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

    -- Implicit acknowledge when department already routed the incident
    UPDATE public.incident_history ih
    SET
      acknowledged_at = COALESCE(ih.acknowledged_at, NEW.created_at),
      acknowledged_by_id = COALESCE(ih.acknowledged_by_id, NEW.requested_by)
    WHERE ih.id = v_incident_id
      AND ih.routing_department_id IS NOT NULL
      AND ih.acknowledged_at IS NULL;

    IF NEW.planned_date IS NOT NULL THEN
      UPDATE public.incident_history ih
      SET
        first_planned_at = LEAST(ih.first_planned_at, NEW.planned_date::timestamptz),
        pipeline_stage = CASE
          WHEN ih.pipeline_stage IN ('bandeja', 'asignado') THEN 'en_atencion'
          ELSE ih.pipeline_stage
        END
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
      SET
        first_planned_at = LEAST(ih.first_planned_at, NEW.planned_date::timestamptz),
        pipeline_stage = CASE
          WHEN ih.pipeline_stage IN ('bandeja', 'asignado') THEN 'en_atencion'
          ELSE ih.pipeline_stage
        END
      WHERE ih.id = v_incident_id
        AND (ih.first_planned_at IS NULL OR NEW.planned_date::timestamptz < ih.first_planned_at);
    END IF;

    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
      UPDATE public.incident_history ih
      SET first_assigned_at = LEAST(ih.first_assigned_at, NOW())
      WHERE ih.id = v_incident_id
        AND (ih.first_assigned_at IS NULL OR NOW() < ih.first_assigned_at);
    END IF;

    IF NEW.status = 'Completada'
       AND (OLD.status IS DISTINCT FROM NEW.status)
       AND NEW.incident_id IS NOT NULL THEN
      UPDATE public.incident_history ih
      SET pipeline_stage = 'cerrado'
      WHERE ih.id = NEW.incident_id
        AND ih.pipeline_stage <> 'cerrado'
        AND LOWER(ih.status) NOT IN ('resuelto', 'cerrado', 'resolved', 'closed');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_incident_response_milestones ON public.work_orders;
CREATE TRIGGER trg_sync_incident_response_milestones
  AFTER INSERT OR UPDATE OF planned_date, assigned_to, incident_id, status ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_incident_response_milestones();

-- Also set pipeline_stage cerrado when resolve_issues marks incident Resuelto
CREATE OR REPLACE FUNCTION public.resolve_issues_for_completed_work_order(p_work_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.checklist_issues
  SET
    resolved = true,
    resolution_date = COALESCE(resolution_date, now()),
    updated_at = now()
  WHERE work_order_id = p_work_order_id
    AND COALESCE(resolved, false) = false;

  UPDATE public.incident_history
  SET
    status = 'Resuelto',
    pipeline_stage = 'cerrado',
    updated_at = now()
  WHERE work_order_id = p_work_order_id
    AND status IN ('Abierto', 'Pendiente', 'En progreso');

  UPDATE public.incident_history ih
  SET
    status = 'Resuelto',
    pipeline_stage = 'cerrado',
    updated_at = now()
  FROM public.work_orders wo
  WHERE wo.id = p_work_order_id
    AND wo.incident_id = ih.id
    AND ih.status IN ('Abierto', 'Pendiente', 'En progreso');
END;
$$;

COMMENT ON FUNCTION public.sync_incident_response_milestones IS
  'Syncs incident milestones and pipeline_stage from linked work orders (Phase 2 auto-transitions).';
