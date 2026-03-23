-- Exec / company-wide roles see all KPI rollup rows (matches ingresos-gastos “all plants” scope).
-- Without this, BU-scoped profiles still load all plants in compute but rollup SELECT returned
-- fewer rows → tryReadFromKpiRollup missed → every dashboard request ran full compute (~5s+).

CREATE POLICY "Company-wide roles read all KPI rollup rows"
  ON public.ingresos_gastos_kpi_plant_month
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND (
          pr.role::text IN (
            'GERENCIA_GENERAL',
            'GERENTE_MANTENIMIENTO',
            'AREA_ADMINISTRATIVA'
          )
          OR pr.business_role::text IN ('GERENTE_MANTENIMIENTO')
        )
    )
  );
