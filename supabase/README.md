# Supabase (live database)

This project does **not** use a local Supabase stack for day-to-day work. The **production** project (`mantenimiento`, ref `txapndpstzcspgxlybll`) is the database of record.

## Migrations

- SQL under `supabase/migrations/` documents the **intended** schema changes and is what we review in git.
- **Applying** changes means running that SQL against the **live** project (Supabase Dashboard SQL editor, Supabase MCP `apply_migration`, or CLI linked to the remote project—not `supabase start`).
- Hosted migration history may use **different version timestamps** than local filenames. That is expected here: what matters is that the live database has the objects and policies the app needs, not that version strings match one-to-one.

## TypeScript types

After schema changes on live, refresh generated types (requires CLI logged in and `supabase link` to this project):

`npm run gen:db-types`

That overwrites `types/supabase-types.ts` from the linked remote schema so `createClient<Database>()` and `.from('…')` stay in sync for autocomplete.

## Verification

After a migration, confirm the app and APIs work against live data (e.g. fleet routes, RLS behavior), then run `gen:db-types` when tables or columns changed.
