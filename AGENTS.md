# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Maintenance Dashboard ("Sistema de Mantenimiento") — an industrial maintenance management system built with **Next.js 16 (App Router, Turbopack)**, **Supabase** (hosted PostgreSQL, Auth, Storage), **TypeScript**, and **shadcn/ui**. The UI is in Spanish.

### Environment & secrets

- All data lives in a **hosted Supabase project** — there is no local database.
- Required env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must be present in `.env.local` or injected as environment variables. Optional: `COTIZADOR_SUPABASE_URL` and `COTIZADOR_SUPABASE_SERVICE_ROLE_KEY` for gerencial reports integration.
- The update script creates `.env.local` from injected secrets automatically.

### Package manager

**npm** with `legacy-peer-deps=true` (see `.npmrc`). Lockfile is `package-lock.json`.

### Common commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000) |
| Build | `npm run build` (uses `next build`; `typescript.ignoreBuildErrors` is enabled) |
| Lint | `npm run lint` (ESLint 9; pre-existing warnings/errors in the codebase) |
| E2E tests | `npm run test:e2e` (Playwright; run `npm run test:e2e:install` first to install browsers) |

### Gotchas

- **No `.env.example`** exists in the repo. Secrets must come from environment injection or the Supabase dashboard.
- **Auth redirects**: The root `/` redirects to `/login` for unauthenticated users (via `proxy.ts`, not `middleware.ts`).
- **`typescript.ignoreBuildErrors: true`** in `next.config.mjs` — the build will succeed even with TS errors.
- **ESLint exits with code 1** due to pre-existing errors in the codebase (~2258 errors, ~1209 warnings). This is normal and does not indicate a setup problem.
- The project uses **Next.js 16** with the `proxy.ts` pattern (not `middleware.ts`) for route protection and auth session management.
- Supabase Edge Functions (under `supabase/functions/`) are deployed to Supabase cloud; they are not needed for local development.
