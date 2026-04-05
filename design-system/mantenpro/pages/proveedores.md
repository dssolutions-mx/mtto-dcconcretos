# Proveedores Page Overrides

> **PROJECT:** MantenPro  
> **Page Type:** Supplier registry and verification (B2B procurement master data)

> Rules in this file **override** the Master file (`design-system/MASTER.md`) where noted. For all other rules, refer to the Master.

---

## Layout

- **Shell:** Use `DashboardShell` + `DashboardHeader` for desktop; sticky compact subheader on mobile (title + link to analytics).
- **Primary list:** KPI strip → filters → table/cards; avoid duplicating H1 inside list components (header lives on the page).
- **Detail:** Full route `/suppliers/[id]` for expediente, metrics, and verification panel—not only a modal.

## Spacing and loading

- **Padding:** Align with other dashboard modules: `px-4 py-6` / `md:px-6 md:py-8` via `DashboardShell`.
- **Loading:** Prefer `Skeleton` for initial list load; avoid full-page spinner-only states.
- **Mobile FAB:** Single primary “Agregar proveedor” FAB (`sky-700`), `md:hidden`, safe-area bottom inset.

## Verification / control

- **Checklist:** Show pass/fail per rule (RFC, fiscal doc, bank, contacts, certifications, activity) before certifying.
- **Audit:** Status changes that go through verification should append to `supplier_verification_events` via API/RPC.

## Database (remote schema notes)

Verified against production Postgres (Supabase MCP). Migration: `supabase/migrations/20260404120000_supplier_verification_events.sql`.

| Object | Purpose |
|--------|---------|
| `suppliers.verified_at` | Last time the supplier was certified (`active_certified`); denormalized from events. |
| `suppliers.verified_by` | FK → `profiles.id` for who last certified. |
| `supplier_verification_events` | Append-only audit: `supplier_id`, `actor_id`, `action`, `notes`, `checklist_snapshot`, `created_at`. FKs: `supplier_id` → `suppliers` (CASCADE), `actor_id` → `profiles`. |
| `apply_supplier_verification_event(...)` | `SECURITY DEFINER` RPC: inserts one event row, updates `suppliers.status` / `verified_*` in one transaction; `authenticated` may execute. |
| RLS on `supplier_verification_events` | `SELECT` for `authenticated`; `INSERT` only when `auth.uid() = actor_id`. |

## Filters

- **Search:** `inputMode="search"`; debounced query to `/api/suppliers`.
- **KPI chips:** “Con problemas” maps to suspended + blacklisted via `issues=1` on the API.
