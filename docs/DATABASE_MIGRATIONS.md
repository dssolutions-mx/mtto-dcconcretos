# Database schema changes

Schema updates are applied on the **hosted Supabase** project using **Supabase MCP** (primary) and sometimes the **Supabase CLI** (`supabase/migrations/` when you generate migrations locally).

There is **no** top-level `migrations/` SQL folder anymore; legacy scripts live only under **`archive/legacy-db-migrations/`**. Deprecated **`/api/migrations/*`** Next.js routes were **removed** — do not reintroduce HTTP-driven DDL.

## Legacy SQL in the repo

Historical hand-maintained scripts live under **`archive/legacy-db-migrations/`** (`sql/` and `root/`). They are **not** replayed by CI or the app; use them only as reference or archaeology.

One-off dumps: **`archive/schema-dumps/`**.

## Types

Regenerate TypeScript types after schema changes:

```bash
npm run gen:db-types
```

Requires a [linked](https://supabase.com/docs/guides/cli/getting-started) Supabase project (`supabase link`).
