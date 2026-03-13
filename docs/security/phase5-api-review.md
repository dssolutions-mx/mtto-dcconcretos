# Phase 5 — API Security Review

**Assessment target:** maintenance-dashboard  
**Date:** 2025-03-13  
**Input:** Phase 1 Inventory, Phase 2 Static, Phase 4 Config

---

## API Security Review Findings

### OWASP API Security Top 10 (2023) Mapping

---

### 1. Broken Object Level Authorization (API1:2023)

**[API-001]: maintenance/work-orders — No BOLA, No Auth**
- **Severity:** Critical
- **Location:** `app/api/maintenance/work-orders/route.ts`
- **Issue:** POST accepts `asset_id` from body; when service_role is used, no user check. Any caller can create work orders for any asset.
- **Fix:** Require auth; verify user has access to the asset (via RLS or explicit check). Do not use service_role without compensating auth.

**[API-002]: test-email — Unauthenticated Data Access**
- **Severity:** Critical
- **Location:** `app/api/notifications/test-email/route.ts`
- **Issue:** GET with no auth; uses service_role to fetch purchase_orders and asset_assignment_history.
- **Fix:** Add getUser(); restrict to admin; consider removing from production.

**[API-003]: purchase-orders/[id] — BOLA Relies on RLS**
- **Severity:** Low (if RLS is correct)
- **Location:** `app/api/purchase-orders/[id]/route.ts`
- **Issue:** GET/PATCH use anon client; RLS should scope by org. No explicit server-side ownership check beyond RLS.
- **Fix:** RLS policies must correctly restrict access. Add integration tests for IDOR.

**[API-004]: suppliers GET — No Auth**
- **Severity:** Medium
- **Location:** `app/api/suppliers/route.ts`
- **Issue:** GET has no getUser(); relies on RLS. If RLS allows anon read, suppliers list is public.
- **Fix:** Add explicit getUser() if intended to be protected; verify RLS.

---

### 2. Broken Authentication (API2:2023)

See Phase 2 (STATIC-001, STATIC-002, STATIC-003, STATIC-004) and Phase 4 (CONFIG-001). Key gaps:
- maintenance/work-orders: no auth when service_role used
- test-email: no auth
- cleanup-schedules: no auth
- Several routes use getSession() fallback

---

### 3. Broken Object Property Level Authorization (API3:2023)

**[API-005]: suppliers POST — Mass Assignment**
- **Severity:** High
- **Location:** `app/api/suppliers/route.ts` (lines 140–148)
- **Issue:** `insert({ ...body, specialties, industry, created_by, status })` — body is spread directly. Client could send `created_by`, `status`, `id`, or other columns. Overwrites of `created_by` and `status` are explicit, but other body fields pass through.
- **Fix:** Use an allowlist: `const { name, supplier_type, industry, ... } = body` and insert only allowed fields.

**[API-006]: suppliers PUT — Mass Assignment**
- **Severity:** Medium
- **Location:** `app/api/suppliers/[id]/route.ts` (lines 81, 124–126)
- **Issue:** `normalized = { ...body }` then `update({ ...normalized, updated_by })` — full body spread. Could update `created_by`, `id`, `certifications`, etc.
- **Fix:** Allowlist updatable fields; build update object explicitly.

**[API-007]: purchase-orders PATCH — Good Pattern**
- **Location:** `app/api/purchase-orders/[id]/route.ts`
- **Note:** Uses explicit `editableFields` allowlist. Good pattern to replicate.

---

### 4. Unrestricted Resource Consumption (API4:2023)

**[API-008]: No Rate Limiting**
- **Severity:** High
- **Location:** Application-wide
- **Issue:** No rate limiting on auth (login, register, reset) or API.
- **Fix:** Add rate limiting (see CONFIG-003).

**[API-009]: suppliers — Unbounded limit/offset**
- **Severity:** Medium
- **Location:** `app/api/suppliers/route.ts` (lines 21–22, 31)
- **Issue:** `limit = parseInt(searchParams.get('limit') || '50')` — no max cap. Client can pass `limit=999999`.
- **Fix:** Cap limit: `Math.min(parseInt(limit) || 50, 200)`.

**[API-010]: storage/upload — Size Validated**
- **Location:** `app/api/storage/upload/route.ts`
- **Note:** 10MB max, file type allowlist. Good.

---

### 5. Broken Function Level Authorization (API5:2023)

**[API-011]: fix-duplicate-ids — No Role Check**
- **Severity:** High
- **Location:** `app/api/fix-duplicate-ids/route.ts`
- **Issue:** Any authenticated user can call. Should be admin-only.
- **Fix:** Add `canUpdateUserAuthorization` or equivalent; return 403 for non-admins.

**[API-012]: Migration Routes — Should Be Admin-Only**
- **Severity:** High
- **Location:** `app/api/migrations/*`
- **Issue:** Several migration routes (execute-id-fix, create-asset-operators-table, etc.) have getUser() but no admin role check.
- **Fix:** Restrict to admin; or remove from production and run via CLI/CI only.

---

### 6. API Summary Table

| Endpoint | Auth | BOLA | Mass Assign | Rate Limit | Notes |
|----------|------|------|-------------|------------|-------|
| maintenance/work-orders POST | No (when service_role) | Fails | Controlled | No | Critical |
| notifications/test-email GET | No | N/A | N/A | No | Critical |
| fix-duplicate-ids POST | Yes | N/A | N/A | No | No role check |
| checklists/cleanup-schedules POST | No | RLS | N/A | No | Destructive |
| suppliers POST | Yes | N/A | Yes | No | ...body |
| suppliers PUT | Yes | created_by | Yes | No | ...normalized |
| purchase-orders/[id] PATCH | Yes | RLS | No (allowlist) | No | Good pattern |
| users/[id] DELETE | Yes | canDeleteUsers | N/A | No | Good |

---

### Recommendations

**Immediate:**
- Fix maintenance/work-orders auth (STATIC-001)
- Fix test-email auth (CONFIG-001)
- Add role check to fix-duplicate-ids

**Short-term:**
- Allowlist for suppliers POST/PUT
- Add rate limiting
- Cap limit/offset on list endpoints
- Restrict migration routes to admin or remove from API

**Ongoing:**
- Audit all [id] routes for BOLA
- Add integration tests for IDOR scenarios
