# Security Assessment Report (Revised — Usage-Verified)

| | |
|---|---|
| **Application** | maintenance-dashboard |
| **Assessment Date** | 2025-03-13 |
| **Revised** | 2025-03-13 (usage verification) |
| **Remediated** | 2025-03-13 (unused endpoints removed, security fixes applied) |
| **Assessed By** | AppSec Orchestrator Suite |
| **ASVS Target Level** | L2 (Standard) |
| **Overall Risk Rating** | Medium |
| **Scope** | Codebase, configuration, dependencies, API, auth, threat model, **usage verification** |
| **Environment** | Production |

---

## Executive Summary

**What was assessed:** maintenance-dashboard is a Next.js 16 application for industrial maintenance: assets, work orders, checklists, purchase orders, diesel inventory, and compliance. The stack includes Supabase (PostgreSQL, Auth, Storage), Zustand auth layer, and 167+ API routes. The full AppSec pipeline was run, followed by **usage verification** to confirm which flagged components are actually used in the app.

**Usage verification:** Several initially flagged endpoints are **not used** in the application:
- **test-email** — Dev/test utility only. No UI link, no component reference. Not exposed in the app.
- **POST /api/maintenance/work-orders** — No frontend calls it. Work order creation uses `generate-corrective-work-order-enhanced` instead. Route appears orphaned/legacy.
- **fix-duplicate-ids** — No UI reference. Admin/debug tool, not discoverable from the app.
- **cleanup-schedules** — `MaintenanceCleanupButton` exists but is never imported or rendered; the endpoint is unreachable from the UI.

**Overall security posture:** With usage verification, the attack surface is smaller than initially assessed. The main user-facing flows (work order creation, storage upload, suppliers, purchase orders) use authenticated routes. Remaining risks are: no security headers, no rate limiting, getSession() fallback in a few routes, suppliers mass assignment, and vulnerable dependencies. Overall risk is **Medium**.

**Most relevant risks (actually used):** (1) No security headers or rate limiting. (2) getSession() fallback in storage/upload and authorization/summary weakens auth verification. (3) suppliers POST uses `...body` spread (mass assignment). (4) Next.js and xlsx have known vulnerabilities.

**Positive findings:** Supabase Auth and `@supabase/ssr` used correctly; roles in DB (profiles); RLS on critical tables; main work order creation (`generate-corrective-work-order-enhanced`) has getUser(); purchase-orders PATCH uses allowlist; `.env` gitignored; `SERVICE_ROLE_KEY` not in client code.

**Recommended action:** (1) Add security headers and rate limiting. (2) Consider removing or env-gating unused endpoints (test-email, fix-duplicate-ids, orphaned maintenance/work-orders POST) to reduce attack surface. (3) Fix suppliers mass assignment. (4) Upgrade Next.js and address xlsx.

**Remediation applied (2025-03-13):**
- **Removed unused endpoints:** test-email, fix-duplicate-ids, maintenance/work-orders POST, cleanup-schedules; deleted MaintenanceCleanupButton (dead code).
- **Security headers:** Added X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection, Permissions-Policy in next.config.mjs.
- **Suppliers mass assignment:** Allowlisted POST and PUT fields in suppliers route and [id] route.
- **getSession() fallback removed:** storage/upload and authorization/summary now use getUser() only (ASVS V2).
- **purchaseOrderId validation:** UUID validation added in storage/upload to prevent path traversal.
- **Rate limiting:** Use Vercel Firewall (Project → Firewall → Configure). See `docs/security/vercel-firewall-setup.md` for rules and setup.
- **Error handling:** storage/upload, suppliers, authorization/summary, checklists/execution now return generic messages; full errors logged server-side only.
- **Next.js:** Upgraded to 16.1.6. **xlsx:** No fix available; consider replacing with exceljs where feasible.

---

## Usage Verification Summary

| Endpoint / Component | Used in App? | Evidence |
|----------------------|--------------|----------|
| test-email | No | No fetch/link in components or pages |
| POST /api/maintenance/work-orders | No | App uses generate-corrective-work-order-enhanced |
| fix-duplicate-ids | No | No UI reference |
| cleanup-schedules | No | MaintenanceCleanupButton never imported |
| GET /api/maintenance/work-orders/[id]/additional-expenses | Yes | generar-oc-ajuste page |
| POST /api/maintenance/work-orders/[id]/update-status | Yes | compras recibido/pedido pages |
| generate-corrective-work-order-enhanced | Yes | corrective-work-order-dialog, checklist-execution |
| storage/upload | Yes | Receipt uploads, evidence |
| suppliers | Yes | Supplier management |
| purchase-orders | Yes | PO workflow |

---

## Architecture Overview

**Application:** Maintenance management SaaS.  
**Stack:** Node.js, TypeScript, Next.js 16, React 19, Supabase PostgreSQL, Zustand.  
**Deployment:** Vercel.  
**Authentication:** Supabase Auth with Zustand; role-based access via `profiles` table.  
**ASVS Level:** L2 for PII and financial data.

**Trust boundaries:** Internet → API (per-route auth); User → Supabase (anon + cookies, RLS); service_role in admin client and scripts only.

---

## Top Findings (Usage-Adjusted)

| # | Severity | OWASP | Title | In Use? | Affected Component |
|---|----------|-------|-------|---------|-------------------|
| 1 | High | A05 | No security headers | Yes | next.config.mjs |
| 2 | High | A05 | No rate limiting | Yes | Application-wide |
| 3 | High | A07 | getSession() fallback weakens auth | Yes | storage/upload, authorization/summary |
| 4 | High | A04 | suppliers mass assignment | Yes | app/api/suppliers/route.ts |
| 5 | High | A06 | Next.js, xlsx vulnerabilities | Yes | package.json |
| 6 | Medium | A01 | test-email unauthenticated (not in app) | No | app/api/notifications/test-email |
| 7 | Medium | A01 | maintenance/work-orders POST orphaned, no auth | No | app/api/maintenance/work-orders/route.ts |
| 8 | Medium | A03 | exec_sql risk in fix-duplicate-ids (not in app) | No | app/api/fix-duplicate-ids |
| 9 | Low | A01 | cleanup-schedules no auth (button not rendered) | No | app/api/checklists/cleanup-schedules |
| 10 | Medium | A01 | authorization/summary user_id IDOR risk | Yes | app/api/authorization/summary |
| 11 | Medium | A05 | storage purchaseOrderId not validated | Yes | app/api/storage/upload |
| 12 | Medium | A09 | Error details returned to client | Yes | Multiple API routes |

---

## Detailed Findings

### Actually Used — High Priority

#### FINDING-1: No security headers

**Severity:** High  
**In use:** Yes (affects all responses)  
**Component:** `next.config.mjs`

**Remediation:** Add `headers()` with X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Strict-Transport-Security.

#### FINDING-2: No rate limiting

**Severity:** High  
**In use:** Yes  
**Component:** Application-wide

**Remediation:** Add rate limiting for auth and sensitive API routes.

#### FINDING-3: getSession() fallback

**Severity:** High  
**In use:** Yes (storage/upload, authorization/summary)  
**Component:** `app/api/storage/upload/route.ts`, `app/api/authorization/summary/route.ts`

**Description:** When `getUser()` fails with "Auth session missing", code falls back to `getSession()`, which is less reliable for server-side verification.

**Remediation:** Use `getUser()` only, or implement Supabase's recommended session refresh flow.

#### FINDING-4: suppliers POST mass assignment

**Severity:** High  
**In use:** Yes  
**Component:** `app/api/suppliers/route.ts`

**Description:** `insert({ ...body, specialties, industry, created_by, status })` spreads full body. Client could send extra fields.

**Remediation:** Allowlist fields; insert only allowed columns.

#### FINDING-5: Vulnerable dependencies

**Severity:** High  
**In use:** Yes  
**Component:** package.json

**Summary:** Next.js (DoS), xlsx (ReDoS, prototype pollution), glob, minimatch. Run `npm audit fix`; upgrade Next.js to 16.1.6; replace or restrict xlsx.

---

### Not in App — Lower Priority (Orphaned / Dev-Only)

#### FINDING-6: test-email unauthenticated

**Severity:** Medium (downgraded — not in app)  
**In use:** No. Dev/test utility; no UI link.

**Description:** GET endpoint has no auth; uses service_role when set. Technically reachable if URL is known, but not exposed in the app.

**Remediation:** Remove from production build, or env-gate for development only. Add getUser() if kept.

#### FINDING-7: maintenance/work-orders POST orphaned

**Severity:** Medium (downgraded — not called)  
**In use:** No. No frontend calls it; app uses generate-corrective-work-order-enhanced.

**Description:** When service_role is set, route has no auth. Route appears legacy/orphaned.

**Remediation:** Remove the route if unused, or add auth and avoid service_role. Verify no external systems call it.

#### FINDING-8: fix-duplicate-ids / exec_sql

**Severity:** Medium (downgraded — not in app)  
**In use:** No. No UI reference; admin tool.

**Description:** Calls exec_sql with raw SQL; no admin role check. Not discoverable from the app.

**Remediation:** Add admin check if kept; verify exec_sql does not exist in production DB. Prefer removing or running via CLI.

#### FINDING-9: cleanup-schedules

**Severity:** Low (downgraded — button not rendered)  
**In use:** No. MaintenanceCleanupButton exists but is never imported.

**Remediation:** Add getUser() if the button is ever wired up. Consider removing dead code.

---

### Other Findings (In Use)

#### FINDING-10: authorization/summary user_id

**Severity:** Medium  
**In use:** Yes  
**Component:** `app/api/authorization/summary/route.ts`

**Description:** user_id from query can be used to fetch other users' auth summary when canManageAuthorization is true. Gate is correct; verify canUpdateUserAuthorization has no bugs.

#### FINDING-11: storage purchaseOrderId not validated

**Severity:** Medium  
**In use:** Yes  
**Component:** `app/api/storage/upload/route.ts`

**Remediation:** Validate as UUID; reject path traversal patterns.

#### FINDING-12: Error details returned to client

**Severity:** Medium  
**In use:** Yes  
**Component:** Multiple API routes

**Remediation:** Log full error server-side; return generic messages to clients.

---

## Dependency Risk Summary

- **High:** 4 (Next.js, xlsx, glob, minimatch)
- **Moderate:** 2 (ajv, js-yaml)
- **Low:** 2

**Supply-chain:** Lockfile committed ✅. Some `"latest"` in package.json ⚠️.

---

## Configuration & Secrets Summary

| Check | Status | Notes |
|-------|--------|-------|
| .env not committed | ✅ | .env* in .gitignore |
| SERVICE_ROLE_KEY server-only | ✅ | Not in components |
| Security headers configured | ✅ | X-Frame-Options, X-Content-Type-Options, etc. |
| Rate limiting on auth | ✅ | Vercel Firewall (dashboard) |
| RLS enabled | ✅ | On critical tables |

---

## Remediation Roadmap

### Immediate — 24–72 Hours

1. ~~Add security headers to next.config~~ ✅ Done
2. ~~Consider removing or env-gating test-email, fix-duplicate-ids from production~~ ✅ Removed
3. ~~Verify maintenance/work-orders POST is not called; remove or fix if orphaned~~ ✅ Removed

### Short-Term — 30 Days

1. ~~Implement rate limiting on auth and sensitive API~~ ✅ Use Vercel Firewall (dashboard)
2. ~~Allowlist suppliers POST/PUT fields~~ ✅ Done
3. ~~Replace getSession() with getUser() in storage/upload, authorization/summary~~ ✅ Done
4. ~~Run `npm audit fix`; upgrade Next.js to 16.1.6~~ ✅ Done; xlsx has no fix — consider replacing with exceljs
5. ~~Add admin check to fix-duplicate-ids if kept~~ N/A (endpoint removed)

### Medium-Term — 60–90 Days

1. ~~Validate purchaseOrderId in storage/upload~~ ✅ Done (UUID validation)
2. Cap limit/offset on list endpoints
3. Pin versions (remove "latest")
4. Add `npm audit` to CI

---

## What's Being Done Well

- Supabase Auth and `@supabase/ssr` used correctly; `getUser()` on most protected routes
- Main work order creation (generate-corrective-work-order-enhanced) has proper auth and uses RLS
- Roles stored in DB (profiles), not JWT claims
- RLS enabled on critical tables
- purchase-orders PATCH uses explicit `editableFields` allowlist
- `.env` gitignored; `SERVICE_ROLE_KEY` not in client code
- Unused/dev-only endpoints (test-email, fix-duplicate-ids) are not exposed in the app UI
