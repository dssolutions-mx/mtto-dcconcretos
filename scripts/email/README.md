# Email & snapshot scripts

- **`generate-manager-snapshot-email.ts`** — builds `docs/email-templates/maintenance-manager-department-snapshot.html` from Supabase (`npm run email:manager-snapshot`).
- **`calculateMaintenanceSummary.ts`** — shared query/metrics helper for that generator (logic mirrors `supabase/functions/maintenance-alerts-schedule` where noted in comments).
