# Phase 2 — Static Code Review

**Assessment target:** maintenance-dashboard  
**Date:** 2025-03-13  
**Input:** Phase 1 Inventory, ASVS L2

---

## Findings

### 1. Authentication & Session Management

**[STATIC-001]: Unauthenticated Work Order Creation (Service Role Bypass)**
- **Severity:** Critical
- **OWASP:** A01 — Broken Access Control
- **ASVS:** V4.1.1
- **Location:** `app/api/maintenance/work-orders/route.ts` (lines 6–68)
- **Evidence:** When `SUPABASE_SERVICE_ROLE_KEY` is set, the route uses `createServiceClient()` which passes empty cookies `getAll() { return [] }`. Thus `supabase.auth.getUser()` always returns `{ user: null }`. The route proceeds to insert work orders without verifying the caller's identity. Any unauthenticated POST to `/api/maintenance/work-orders` can create work orders.
- **Impact:** Unauthenticated attackers can create arbitrary work orders in the system, polluting data and potentially affecting operations.
- **Remediation:** Always verify authentication before allowing work order creation. If service_role is needed for a specific operational reason, require a separate mechanism (e.g., internal API key or server-to-server auth). Prefer using the anon-key client with cookies so RLS applies, and add explicit `getUser()` check that returns 401 when user is null.

**[STATIC-002]: getSession() Fallback Weakens Auth Verification**
- **Severity:** High
- **OWASP:** A07 — Identification and Authentication Failures
- **ASVS:** V2.1.1
- **Location:** `app/api/storage/upload/route.ts` (lines 24–31), `app/api/authorization/summary/route.ts` (lines 25–31)
- **Evidence:** When `getUser()` fails with "Auth session missing", the code falls back to `getSession()`. Supabase docs indicate `getSession()` can be influenced by client-side session storage and is less reliable for server-side verification than `getUser()`.
- **Impact:** In edge cases, an attacker could potentially exploit the getSession fallback to bypass proper auth verification.
- **Remediation:** Prefer `getUser()` only. If mobile session recovery is required, use Supabase's recommended refresh flow rather than trusting getSession() for auth decisions.

**[STATIC-003]: Migration Routes Use getSession() Instead of getUser()**
- **Severity:** Medium
- **OWASP:** A07 — Identification and Authentication Failures
- **ASVS:** V2.1.1
- **Location:** `app/api/maintenance/work-completions/route.ts`, `app/api/maintenance/generate-adjustment-po/route.ts`, `app/api/maintenance/work-orders/[id]/additional-expenses/route.ts` *(historical: `app/api/migrations/*` removed in 2026)*
- **Evidence:** These routes use `getSession()` rather than `getUser()` for auth verification.
- **Impact:** Session can be forged client-side; server-side verification is weaker.
- **Remediation:** Replace with `getUser()` and return 401 when user is null.

**[STATIC-004]: No Auth Check on Destructive Cleanup Route**
- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **ASVS:** V4.1.1
- **Location:** `app/api/checklists/cleanup-schedules/route.ts`
- **Evidence:** Route performs DELETE operations on `checklist_schedules` and other tables with no `getUser()` or `getSession()` check. Relies entirely on RLS.
- **Impact:** If RLS is misconfigured or has a gap, unauthenticated or wrong-scoped users could trigger mass deletion of schedules.
- **Remediation:** Add explicit `getUser()` check at the start; return 401 when unauthenticated. Ensure RLS policies restrict cleanup to authorized roles.

---

### 2. Authorization & Access Control

**[STATIC-005]: exec_sql / execute_sql — Arbitrary SQL Execution**
- **Severity:** Critical (if exec_sql exists in DB)
- **OWASP:** A03 — Injection
- **ASVS:** V5.1.3
- **Location:** `app/api/fix-duplicate-ids/route.ts` (lines 72–79) if present; *(historical migration HTTP routes under `app/api/migrations/` were removed in 2026)*
- **Evidence:** Routes call `supabase.rpc('exec_sql', { sql: fixFunctionSql })` or `execute_sql` with raw SQL strings. If these functions exist and are callable by the anon/authenticated role, any authenticated user with access to fix-duplicate-ids could execute arbitrary SQL.
- **Impact:** Full database compromise: data exfiltration, modification, or deletion; privilege escalation.
- **Remediation:** Remove or restrict `exec_sql`/`execute_sql` to superuser only. Migrations should run via Supabase CLI or migration pipeline, not through API routes. If admin operations must stay in API, use narrow, parameterized RPCs, not raw SQL passthrough.

**[STATIC-006]: fix-duplicate-ids Accessible to Any Authenticated User**
- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **ASVS:** V4.4.1
- **Location:** `app/api/fix-duplicate-ids/route.ts`
- **Evidence:** Route checks `getUser()` but does not verify admin or privileged role. Any authenticated user can trigger the fix.
- **Impact:** Non-admin users can run destructive data-fix logic; if exec_sql is used, full DB access.
- **Remediation:** Restrict to admin/ops roles (e.g., GERENCIA_GENERAL or a dedicated migration role). Add `canUpdateUserAuthorization` or equivalent role check.

**[STATIC-007]: authorization/summary — user_id Query Param (IDOR Risk)**
- **Severity:** Medium (mitigated by canManageAuthorization)
- **OWASP:** A01 — Broken Access Control
- **ASVS:** V4.1.3
- **Location:** `app/api/authorization/summary/route.ts` (lines 11, 68)
- **Evidence:** `effectiveUserId = canManageAuthorization ? userId : user.id` — when user has `canManageAuthorization`, they can query any user_id. The gate is correct; risk is if `canUpdateUserAuthorization` has bugs or is overly permissive.
- **Impact:** If gate is wrong, horizontal privilege escalation (view others' auth limits).
- **Remediation:** Audit `canUpdateUserAuthorization`; ensure it restricts to appropriate roles. Add tests for IDOR prevention.

---

### 3. Input Validation & Injection

**[STATIC-008]: storage/upload — purchaseOrderId Not Validated**
- **Severity:** Medium
- **OWASP:** A03 — Injection, A05 — Security Misconfiguration
- **ASVS:** V5.1.1
- **Location:** `app/api/storage/upload/route.ts` (lines 56, 103–106)
- **Evidence:** `purchaseOrderId` from formData is used in path `purchase-orders/${purchaseOrderId}/${timestamp}_${randomString}.${fileExt}`. No UUID validation or path traversal check.
- **Impact:** Malicious `purchaseOrderId` (e.g., `../other-bucket/`) could cause path traversal; or invalid IDs could create orphaned folders.
- **Remediation:** Validate `purchaseOrderId` as UUID format; reject if invalid. Ensure storage bucket policies prevent path traversal.

**[STATIC-009]: work-orders — Request Body Spread Without Allowlist**
- **Severity:** Low
- **OWASP:** A04 — Insecure Design (Mass Assignment)
- **ASVS:** V5.4.4
- **Location:** `app/api/maintenance/work-orders/route.ts` (lines 24–25, 84–96)
- **Evidence:** Only `asset_id`, `description` are validated; other fields (`type`, `issues`, `checklist_id`, `creation_photos`) are used from request. Insert object is explicitly constructed, so mass assignment is limited. Lower risk.
- **Impact:** Minor — unexpected fields in `issues` could affect `fullDescription` or `issue_items`; validate structure.
- **Remediation:** Validate `issues` as array of `{ description, notes }` with Zod; sanitize string lengths.

---

### 4. Error Handling & Information Disclosure

**[STATIC-010]: Supabase/Error Details Returned to Client**
- **Severity:** Medium
- **OWASP:** A09 — Security Logging and Monitoring Failures
- **ASVS:** V7.2.1
- **Location:** Multiple routes (e.g., `app/api/storage/upload/route.ts` lines 127, 173; `app/api/assets/composites/[id]/route.ts`; `app/api/diesel/recalculate-balance/route.ts`)
- **Evidence:** Error responses include `error.message`, `insertError.details`, or `details: insertError` which can expose table names, column names, or query hints.
- **Impact:** Information disclosure aids attackers in understanding schema and crafting attacks.
- **Remediation:** Log full error server-side; return generic messages to clients (e.g., "Error al subir archivo" without DB details). Avoid returning `error.details` or raw Supabase error objects.

**[STATIC-011]: next.config — ignoreBuildErrors: true**
- **Severity:** Low
- **OWASP:** A05 — Security Misconfiguration
- **Location:** `next.config.mjs`
- **Evidence:** `typescript: { ignoreBuildErrors: true }` suppresses type errors at build.
- **Impact:** Type safety is weakened; security-relevant type errors may be missed.
- **Remediation:** Re-enable build errors; fix type issues incrementally.

---

### 5. Frontend (XSS, TypeScript)

**[STATIC-012]: dangerouslySetInnerHTML Usage**
- **Severity:** Low
- **OWASP:** A03 — Injection
- **ASVS:** V5.2.3
- **Location:** `components/ui/chart.tsx` (line 81), `components/work-orders/work-order-print-document.tsx` (line 125)
- **Evidence:** Chart uses `dangerouslySetInnerHTML` for CSS variables (theme colors from THEMES constant — not user input). Print document uses for inline styles. Both appear to use static/controlled data.
- **Impact:** Low if no user input reaches these; verify no user-controlled data is ever interpolated.
- **Remediation:** Confirm no user content flows into these; if user content is ever added, sanitize with DOMPurify.

---

### 6. RLS and service_role Usage

**[STATIC-013]: createAdminClient (service_role) Used in User Management**
- **Severity:** Medium (by design, but must be protected)
- **OWASP:** A01 — Broken Access Control
- **Location:** `app/api/users/[id]/route.ts`, `app/api/users/deactivate/route.ts`, `app/api/assets/[id]/plant-assignment/route.ts`, `app/api/operators/register/route.ts`
- **Evidence:** `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for admin operations (delete user, deactivate, etc.).
- **Impact:** These routes must enforce admin-only access server-side. If they rely only on client-supplied data or weak checks, privilege escalation is possible.
- **Remediation:** Verify each route has explicit admin/role check (e.g., GERENCIA_GENERAL) before using admin client. Never expose admin client to non-admin callers.

---

### 7. API Routes Without Explicit Auth

The following routes do not call `getUser()` or `getSession()` and rely on RLS only. RLS may block unauthenticated requests (no `auth.uid()`), but explicit checks improve defense-in-depth:

- `app/api/suppliers/route.ts` GET — no getUser (POST has it)
- `app/api/assets/[id]/completed-checklists/route.ts`
- `app/api/models/[id]/maintenance-intervals/route.ts`
- `app/api/checklists/cleanup-schedules/route.ts` (destructive)

**Remediation:** Add `getUser()` at the start of protected handlers; return 401 when user is null.

---

## Static Review Summary

| ID | Severity | Category | Title |
|----|----------|----------|-------|
| STATIC-001 | Critical | A01 | Unauthenticated Work Order Creation (Service Role Bypass) |
| STATIC-002 | High | A07 | getSession() Fallback Weakens Auth Verification |
| STATIC-003 | Medium | A07 | Migration Routes Use getSession() Instead of getUser() |
| STATIC-004 | High | A01 | No Auth Check on Destructive Cleanup Route |
| STATIC-005 | Critical | A03 | exec_sql / execute_sql — Arbitrary SQL Execution Risk |
| STATIC-006 | High | A01 | fix-duplicate-ids Accessible to Any Authenticated User |
| STATIC-007 | Medium | A01 | authorization/summary user_id Query Param (IDOR Risk) |
| STATIC-008 | Medium | A03 | storage/upload purchaseOrderId Not Validated |
| STATIC-009 | Low | A04 | work-orders Request Body Validation |
| STATIC-010 | Medium | A09 | Supabase/Error Details Returned to Client |
| STATIC-011 | Low | A05 | next.config ignoreBuildErrors |
| STATIC-012 | Low | A03 | dangerouslySetInnerHTML Usage |
| STATIC-013 | Medium | A01 | createAdminClient Must Be Protected |

**Total findings:** 13 (Critical: 2, High: 3, Medium: 5, Low: 3)
