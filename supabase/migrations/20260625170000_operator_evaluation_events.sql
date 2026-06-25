-- Task 5: denormalized operator evaluation event log for RH reporting and future Cotizador sync.

CREATE TABLE public.operator_evaluation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  operator_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text NOT NULL CHECK (event_type IN (
    'punctuality',
    'cleanliness_weekly',
    'cleanliness_closure',
    'security_talk'
  )),
  event_date date NOT NULL,
  period_year int,
  period_month int,
  status text NOT NULL,
  source_schedule_id uuid REFERENCES public.checklist_schedules(id),
  source_completion_id uuid REFERENCES public.completed_checklists(id),
  section_id uuid,
  reason text,
  evidence jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_operator_eval_events_plant_period
  ON public.operator_evaluation_events(plant_id, period_year, period_month);

CREATE INDEX idx_operator_eval_events_operator
  ON public.operator_evaluation_events(operator_id, event_date);

CREATE UNIQUE INDEX uq_operator_eval_events_completion_operator_type
  ON public.operator_evaluation_events(source_completion_id, operator_id, event_type)
  WHERE source_completion_id IS NOT NULL;

COMMENT ON TABLE public.operator_evaluation_events IS
  'Denormalized log of operator bonus-evaluation decisions (punctuality, weekly cleanliness, monthly closure, security talks).';

ALTER TABLE public.operator_evaluation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY operator_evaluation_events_select ON public.operator_evaluation_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY operator_evaluation_events_insert ON public.operator_evaluation_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY operator_evaluation_events_update ON public.operator_evaluation_events
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY operator_evaluation_events_delete ON public.operator_evaluation_events
  FOR DELETE TO authenticated USING (true);
