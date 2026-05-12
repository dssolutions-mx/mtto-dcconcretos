-- Reference: April 2026 manual_financial_adjustments normalization (mantenimiento).
-- Scope: period_month = '2026-04-01'
-- Executed 2026-04-18 via Supabase MCP. Not a CI migration.

-- Typography (department)
-- UPDATE manual_financial_adjustments SET department = 'PRODUCCIÓN', updated_at = now()
--   WHERE period_month = '2026-04-01' AND department = 'PRODUCCION';
-- UPDATE manual_financial_adjustments SET department = 'ADMINISTRACIÓN', updated_at = now()
--   WHERE period_month = '2026-04-01' AND department = 'ADMINISTRACION';

-- Semantic aliases (department)
-- UPDATE manual_financial_adjustments SET department = 'RECURSOS HUMANOS', updated_at = now()
--   WHERE period_month = '2026-04-01' AND department = 'RH';
-- UPDATE manual_financial_adjustments SET department = 'MANTENIMIENTO', updated_at = now()
--   WHERE period_month = '2026-04-01' AND department = 'MTTO';
-- UPDATE manual_financial_adjustments SET department = 'COMERCIAL', updated_at = now()
--   WHERE period_month = '2026-04-01' AND department = 'VENTAS';
-- UPDATE manual_financial_adjustments SET department = 'ADMINISTRACIÓN', updated_at = now()
--   WHERE period_month = '2026-04-01' AND department = 'GENERAL';

-- Nómina gerencia with null department (if any)
-- UPDATE manual_financial_adjustments SET department = 'GERENCIA', updated_at = now()
--   WHERE period_month = '2026-04-01' AND department IS NULL AND category = 'nomina'
--   AND lower(trim(description)) = 'nomina gerencia';
