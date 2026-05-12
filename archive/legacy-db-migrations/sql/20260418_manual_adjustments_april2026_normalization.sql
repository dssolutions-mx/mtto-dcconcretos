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

-- P004P nómina rows wrongly linked to Planta 4 (P004) due to plant code prefix match in import mapping.
-- Executed 2026-04-18: move three April 2026 nomina adjustments from P004 → P004P.
-- UPDATE manual_financial_adjustments SET plant_id = (SELECT id FROM plants WHERE code = 'P004P' LIMIT 1), updated_at = now()
--   WHERE period_month = '2026-04-01' AND category = 'nomina'
--   AND plant_id = (SELECT id FROM plants WHERE code = 'P004' LIMIT 1)
--   AND id IN (
--     '782a941b-e28d-409e-be02-99847cbb118e',
--     '154de15d-b465-4e74-b7cc-f11648a73e9f',
--     'c9c78df4-4eb0-4af9-8599-ca863c3b7b7c'
--   );
