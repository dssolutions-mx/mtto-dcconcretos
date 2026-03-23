---
name: repo-structure-hygiene
description: >-
  Places new files in the correct maintenance-dashboard directories and avoids
  repo root clutter. Use when adding CSV, PDF, Excel, SQL, markdown docs, email
  HTML, scripts, MCP payloads, screenshots, or when the user asks where to put a
  file, to organize the repository, or to keep the tree clean.
---

# Repository structure hygiene (MantenPro / maintenance-dashboard)

## When to read this skill

- User adds or asks where to put: data exports, policies, long-form docs, one-off SQL, email HTML, automation scripts, screenshots, JSON payloads.
- User says: organize repo, clean root, “where should this live”, avoid clutter.

## Golden rules

1. **Repository root** stays limited to: app config (`package.json`, `tsconfig`, `next.config`, `tailwind`, `eslint`, `playwright`, `components.json`), `README.md`, `CHANGELOG.md`, and top-level app folders (`app/`, `components/`, `lib/`, `public/`, `supabase/`, etc.). No new loose CSV/PDF/XLSX/PNG at root.
2. **Executable product code** lives under `app/`, `components/`, `lib/`, `hooks/`, `supabase/functions/`, etc.—not under `archive/`.
3. **Generated or run outputs** are gitignored when regenerable (`test-results/`, `scripts/out/`, `.next/`).

## Where new files go

| Kind of file | Location | Notes |
|--------------|----------|--------|
| Active product docs, runbooks, ADRs | `docs/` | Curated plans: `docs/plans/`. Operational: `docs/DATABASE_MIGRATIONS.md`, workflow source-of-truth files. |
| Old / narrative / implementation writeups | `docs/archive/root-md/` | Do not resurrect long markdown at repo root. |
| Milestone status snapshots (optional batch) | `docs/archive/root-historical/` | Rare; prefer `root-md` for bulk. |
| Legacy hand-SQL (reference only) | `archive/legacy-db-migrations/` | `sql/` + `root/`; not applied by CI. |
| Schema / one-off SQL dumps | `archive/schema-dumps/` | |
| CSV, Excel imports, sync samples | `archive/data/csv/`, `archive/data/spreadsheets/`, `archive/data/csv/sync-outputs/` | Never commit huge dumps unless intentional. |
| PDFs, policy scans, brochures | `archive/documents/pdfs/` | |
| Placeholder images, doc screenshots | `archive/media/` | Real app assets: `public/`. |
| Standalone snippets (e.g. brand reference JS) | `archive/snippets/` | Not imported by Next build unless explicitly wired. |
| Email HTML (generated or hand-edited) | `docs/email-templates/` | Generator scripts: `scripts/email/`. |
| Runnable TS/Node utilities | `scripts/` | Group by domain: `scripts/email/`, `scripts/mcp/` for payloads. |
| Cursor / MCP JSON payloads | `scripts/mcp/` | Not at repo root. |
| Supabase CLI migrations (when used) | `supabase/migrations/` | Primary live migration path alongside MCP. |

## Anti-patterns (do not do)

- New **`app/api/migrations/*`** or HTTP endpoints that run DDL (`exec_sql`, etc.) — use Supabase MCP or CLI; see `docs/DATABASE_MIGRATIONS.md`.
- Dropping **charts, `.docx`, `.pptx`, `.json` report artifacts** next to `app/api/reports/**/route.ts` — keep route trees to code only; put deliverables under `archive/` or `docs/` (see opportunities below).
- **Playwright / sync outputs** in git — use ignored dirs (`test-results/`, `scripts/out/`).

## If unsure

Prefer **`archive/`** for anything that is not imported by the app and **`docs/`** for anything humans read for the long term. When still unsure, ask once: “Is this shipped to users, or reference/archive?”

## Maintainer opportunities (periodic cleanup)

- **`app/api/reports/`** mixes many `route.ts` files with PNG/JSON/DOCX/PPTX/MD — high-value cleanup: move artifacts to e.g. `archive/reports/q4-2025/` and leave only API code under `app/api/reports/`.
- **`proxy.ts` at repo root** is intentional for Next.js 16; do not move without aligning `next` config.
- **`design-system/`** at root is documentation; OK to keep or later fold under `docs/design-system/` if desired—coordinate links.

## Cross-links

- [`docs/archive/INDEX.md`](../archive/INDEX.md) — archived markdown index.
- [`archive/README.md`](../../../archive/README.md) — archive layout.
- [`README.md`](../../../README.md) — Documentation section.
