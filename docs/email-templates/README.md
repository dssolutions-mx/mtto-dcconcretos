# Email HTML templates

Static HTML used for maintenance / operations emails (e.g. manager department snapshot).

- Regenerate **`maintenance-manager-department-snapshot.html`** from live data:  
  `npm run email:manager-snapshot`  
  (runs [`scripts/email/generate-manager-snapshot-email.ts`](../../scripts/email/generate-manager-snapshot-email.ts)).

Do not confuse with Supabase Auth templates (hosted in the Supabase dashboard).
