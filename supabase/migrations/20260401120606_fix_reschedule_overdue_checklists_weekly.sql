-- Fix weekly branch: (current_date - scheduled_day) is integer days in PostgreSQL,
-- not an interval — extract(epoch from integer) fails at runtime.
CREATE OR REPLACE FUNCTION public.reschedule_overdue_checklists() RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_row record;
  v_next_day date;
  v_moved_count integer := 0;
  v_days integer;
BEGIN
  FOR v_row IN
    SELECT cs.id, cs.template_id, cs.asset_id, cs.scheduled_day, c.frequency
    FROM public.checklist_schedules cs
    JOIN public.checklists c ON c.id = cs.template_id
    WHERE cs.status = 'pendiente'
      AND cs.scheduled_day < CURRENT_DATE
  LOOP
    CASE v_row.frequency
      WHEN 'diario' THEN
        v_next_day := public.next_valid_daily_date(CURRENT_DATE);
      WHEN 'semanal' THEN
        v_days := CURRENT_DATE - v_row.scheduled_day;
        v_next_day := v_row.scheduled_day + ((v_days / 7) + 1) * 7;
      WHEN 'mensual' THEN
        v_next_day := (date_trunc('month', CURRENT_DATE) + interval '1 month')::date;
      WHEN 'trimestral' THEN
        v_next_day := (date_trunc('quarter', CURRENT_DATE) + interval '3 months')::date;
      ELSE
        v_next_day := CURRENT_DATE;
    END CASE;

    IF NOT public.check_existing_schedule(v_row.template_id, v_row.asset_id, v_next_day) THEN
      UPDATE public.checklist_schedules
      SET
        scheduled_day = v_next_day,
        scheduled_date = v_next_day::timestamp,
        updated_at = now()
      WHERE id = v_row.id;
      v_moved_count := v_moved_count + 1;
    END IF;
  END LOOP;

  RETURN v_moved_count;
END;
$$;
