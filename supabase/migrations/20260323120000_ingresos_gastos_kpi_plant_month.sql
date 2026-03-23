-- Snapshot table for costsOnly + skipPreviousMonth ingresos-gastos KPI (per plant, per month).
-- Populated by a privileged job; read via RLS aligned with diesel_transactions visibility.

CREATE TABLE IF NOT EXISTS public.ingresos_gastos_kpi_plant_month (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  plant_id uuid NOT NULL REFERENCES public.plants (id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  compute_version integer NOT NULL DEFAULT 1,
  CONSTRAINT ingresos_gastos_kpi_plant_month_period_first_of_month CHECK (EXTRACT(day FROM period_month) = 1),
  CONSTRAINT ingresos_gastos_kpi_plant_month_unique_period_plant UNIQUE (period_month, plant_id)
);

CREATE INDEX IF NOT EXISTS idx_ingresos_gastos_kpi_plant_month_period
  ON public.ingresos_gastos_kpi_plant_month (period_month);

CREATE INDEX IF NOT EXISTS idx_ingresos_gastos_kpi_plant_month_plant
  ON public.ingresos_gastos_kpi_plant_month (plant_id);

COMMENT ON TABLE public.ingresos_gastos_kpi_plant_month IS
  'Cached per-plant rows for dashboard ingresos-gastos KPI path (costsOnly). Filled by service-role refresh; JSON matches API plant row shape.';

ALTER TABLE public.ingresos_gastos_kpi_plant_month ENABLE ROW LEVEL SECURITY;

-- Authenticated users: same plant visibility as diesel_transactions SELECT (20251001 pattern).
CREATE POLICY "Users read KPI rollup for accessible plants"
  ON public.ingresos_gastos_kpi_plant_month
  FOR SELECT
  TO authenticated
  USING (
    plant_id IN (
      SELECT p.id
      FROM public.plants p
      INNER JOIN public.profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = auth.uid()
    )
    OR plant_id IN (
      SELECT plant_id FROM public.profiles WHERE id = auth.uid() AND plant_id IS NOT NULL
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated; service role bypasses RLS.
