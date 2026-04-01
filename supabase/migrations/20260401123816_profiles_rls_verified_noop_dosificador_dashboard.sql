-- Verified against production DB (mantenimiento) via Supabase MCP before applying (2026-04-01):
-- - Policy "Profiles hierarchical access" on public.profiles (SELECT, authenticated)
--   already allows same-plant peer reads when the viewer has plant_id set
--   (EXISTS ... profiles.plant_id = viewer.plant_id). DOSIFICADOR/OPERADOR names in
--   asset_operators_full joins are covered.
-- - checklist_schedules / asset_operators: existing "via assets" policies are present.
-- No additional RLS policy is required for the dosificador plant-daily-readiness API.
--
-- Applied remotely as no-op (SELECT 1) so migration history documents verification.

SELECT 1;
