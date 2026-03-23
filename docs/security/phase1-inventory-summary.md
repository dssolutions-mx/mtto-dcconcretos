# Phase 1 — AppSec Inventory Summary

**Assessment target:** maintenance-dashboard  
**Date:** 2025-03-13  
**Environment:** Production

---

## Inventory Summary

### Application Overview

Maintenance-dashboard is a Next.js application for managing industrial maintenance operations: assets, preventive/corrective work orders, checklists, purchase orders, diesel inventory, compliance, and personnel. It uses Supabase as backend (PostgreSQL + Auth + Storage) and a Zustand-based auth layer for role-based access control. The app handles PII (user profiles), financial data (purchase orders), and operational data (work orders, diesel transactions, checklists).

### Stack

- **Runtime:** Node.js (version not pinned in package.json; typical LTS)
- **Package manager:** npm (package-lock.json present)
- **Framework:** Next.js 16.0.10 (App Router)
- **Rendering:** Hybrid (SSR + client components)
- **Language:** TypeScript ^5 (`strict: true` in tsconfig.json; `ignoreBuildErrors: true` in next.config — weakens type safety)
- **Database:** Supabase PostgreSQL (direct client; no ORM)
- **Auth:** Supabase Auth + Zustand store (`use-auth-zustand`, `auth-slice`); role-based permissions
- **Deployment:** Vercel (indicated by `@vercel/analytics`; no vercel.json found)

### Entry Points

| Path/File | Type | Auth Required | Notes |
|-----------|------|--------------|-------|
| `app/api/**/route.ts` | REST API | Varies | 167+ route files; many rely on RLS, some explicit `getUser()` |
| `app/(auth)/login/page.tsx` | Page | No | Login page |
| `app/auth/callback/route.ts` | Route | No | OAuth callback |
| `app/auth/confirm/route.ts` | Route | No | Email confirmation |
| `app/auth/reset-password/page.tsx` | Page | No | Password reset |
| `app/api/auth/register/route.ts` | API | No | User registration |
| `app/api/purchase-order-actions/process/route.ts` | API | Token (JWT) | Email approval link; token-based, no session |
| `app/api/maintenance/work-orders/route.ts` | API | **None when SERVICE_ROLE used** | Critical: uses service_role, no auth when env set |
| `app/api/fix-duplicate-ids/route.ts` | API | Yes (getUser) | Calls exec_sql/execute_sql RPC |
| ~~`app/api/migrations/*`~~ | — | — | **Removed (2026):** no HTTP migration routes; use MCP/CLI — [DATABASE_MIGRATIONS.md](../DATABASE_MIGRATIONS.md) |
| `app/api/assets/[id]/completed-checklists/route.ts` | API | RLS only | No explicit getUser |
| `app/api/models/[id]/maintenance-intervals/route.ts` | API | RLS only | No explicit getUser |
| `app/api/suppliers/route.ts` | API | RLS only | No explicit getUser |
| `supabase/functions/*` | Edge Functions | Service role | 7 functions: reports, notifications |

### Trust Boundaries

- **Internet → Application:** All `/api/*` routes and pages are public-facing; auth enforced per-route or via RLS. No root `middleware.ts` for global auth redirects.
- **User → Application:** Authenticated users access via Supabase session (cookies); Zustand store syncs profile and roles. RLS policies scope data by `auth.uid()` and organizational hierarchy (plant_id, business_unit_id).
- **Admin → Application:** Roles like GERENCIA_GENERAL, JEFE_PLANTA; elevated paths via role checks in `useAuthZustand` and `RoleGuard`.
- **Application → Supabase:**
  - `createClient` (browser) and `createClient` (supabase-server): use `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookies → subject to RLS.
  - `createServiceClient` in `app/api/maintenance/work-orders/route.ts`: uses `SUPABASE_SERVICE_ROLE_KEY` → bypasses RLS.
  - `createAdminClient` (lib/supabase-admin.ts): uses `SUPABASE_SERVICE_ROLE_KEY`.
  - Scripts (`sync_missing_employees.mjs`, `sync_missing_employees.ts`): use service_role (CLI, not exposed).
- **Application → Third-Party APIs:** SendGrid (email), Vercel Analytics. Supabase Edge Functions use SendGrid for purchase order approval emails.
- **CI/CD → Production:** No `.github/workflows` found; deployment assumed Vercel-managed.

### Data Classification

| Data Type | Example | Sensitivity | Location |
|-----------|---------|-------------|----------|
| Credentials | Passwords, reset tokens | Critical | Supabase Auth |
| Session tokens | JWTs, cookies | Critical | Browser, headers |
| API keys | SUPABASE_SERVICE_ROLE_KEY | Critical | Env (scripts, maintenance/work-orders) |
| PII | Names, emails, phone | High | profiles |
| Financial | POs, quotations, payments | High | purchase_orders, additional_expenses |
| Operational | Work orders, diesel txns | High | work_orders, diesel_transactions |
| Business | Assets, checklists | Medium–High | assets, completed_checklists |
| Public | Plants, business units | Low | plants, business_units |

**Regulatory context:** Email + user profiles suggest potential GDPR scope. Purchase orders and financial data suggest internal controls focus; no direct payment card handling detected.

### ASVS Level Recommendation

**Recommended Level:** L2 (Standard)

**Rationale:** The application handles PII (profiles, contact info), financial data (purchase orders, expenses), and operational data where breach would harm users and business. It is an authenticated Supabase app with role hierarchy and RLS. L2 is the appropriate target for this maintenance/operations SaaS. L3 would apply if handling payments, medical records, or critical infrastructure directly.

### Open Questions

1. Is `exec_sql` / `execute_sql` present in the database? Migration routes depend on it; if present, any caller with DB access could execute arbitrary SQL.
2. Which API routes are intentionally public (e.g., purchase-order-actions/process with token)?
3. Is there a root middleware elsewhere (e.g., in a different branch or framework version) for auth redirects?
4. Are Supabase Edge Functions invoked by cron only, or are any exposed to external callers?
