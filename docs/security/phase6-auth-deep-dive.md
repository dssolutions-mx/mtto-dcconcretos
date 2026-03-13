# Phase 6 — Auth and Authorization Deep-Dive

**Assessment target:** maintenance-dashboard  
**Date:** 2025-03-13  
**Input:** Phase 1–5 outputs, ASVS L2

---

## Auth & Authorization Review Findings

### 1. Authentication Patterns

**getUser() vs getSession():**
- Most protected routes use `supabase.auth.getUser()` (correct)
- **Exceptions using getSession():** migrations/generate-purchase-order, maintenance/work-completions, maintenance/generate-adjustment-po, maintenance/work-orders/[id]/additional-expenses, migrations/add-completion-fields
- **Fallback to getSession() when getUser() fails:** storage/upload, authorization/summary (mobile session recovery)
- **Risk:** getSession() can be influenced by client; ASVS V2.1.1 recommends getUser() for server-side auth decisions

**Routes with No Auth Check:**
- `app/api/maintenance/work-orders` (when service_role used)
- `app/api/notifications/test-email`
- `app/api/checklists/cleanup-schedules`
- `app/api/suppliers` GET

---

### 2. Session and Token Security

- **Supabase Auth:** Uses `@supabase/ssr` with cookie-based sessions. Supabase sets HttpOnly, Secure, SameSite cookies by default.
- **Zustand store:** Holds `user`, `profile`, `session` for UI; server-side APIs use Supabase client with cookies, not Zustand.
- **Role source:** Roles come from `profiles` table (DB), not JWT claims. Server loads profile via `loadActorContext()` — correct pattern.
- **user_metadata:** If used for authorization, it is user-editable; app correctly uses `profiles` from DB.

---

### 3. Authorization Architecture

**Role Model:**
- Hierarchical: GERENCIA_GENERAL (global), JEFE_UNIDAD_NEGOCIO (BU), JEFE_PLANTA/COORDINADOR (plant)
- Legacy mapping: JEFE_PLANTA → COORDINADOR_MANTENIMIENTO
- Authorization helpers: `canDeleteUsers`, `canUpdateUserAuthorization`, `checkScopeOverBusinessUnit`, `checkScopeOverPlant`, `checkTechnicalApprovalAuthority`, `checkRHOwnershipAuthority`

**Server-Side Enforcement:**
- `loadActorContext(supabase, user.id)` loads profile and builds ActorContext
- Routes that need admin checks use `canDeleteUsers(actor)`, `canUpdateUserAuthorization(actor)`
- **Gap:** fix-duplicate-ids and migration routes have getUser() but no role check

---

### 4. RLS Coverage

**Observed RLS migrations:**
- work_orders, checklist_schedules, checklist_template_versions, inventory_*, compliance_*, sanctions, profiles (implied from docs)
- Hierarchical policies: "Users can view X for their plants", "Supervisors manage X in accessible plants"
- service_role bypasses RLS (by design); must not be used without compensating auth

**Concerns:**
- maintenance/work-orders route uses service_role with no auth
- test-email uses service_role with no auth
- exec_sql/execute_sql RPCs (if present) likely bypass RLS

---

### 5. MFA and Password Policy

- **MFA:** No evidence of MFA in codebase. Supabase supports TOTP; check Supabase project settings.
- **NIST 800-63 AAL2:** For PII/financial data, MFA is recommended. ASVS L2 suggests MFA for sensitive operations.
- **Password:** Delegated to Supabase; no custom handling. Supabase defaults (min 6 chars) may be below NIST/ASVS recommendations — verify in Supabase dashboard.

---

### 6. Auth Deep-Dive Summary

| Area | Status | Notes |
|------|--------|-------|
| getUser() usage | Partial | Most routes use it; some use getSession() |
| Role from DB | Yes | Profiles table, not JWT |
| Admin checks | Partial | users/delete, authorization/summary; fix-duplicate-ids and migrations lack |
| RLS enabled | Yes | On critical tables |
| service_role exposure | Critical | work-orders, test-email |
| MFA | Unknown | Check Supabase dashboard |
| Session cookies | OK | Supabase default HttpOnly/Secure |

---

### 7. Recommendations

**Immediate:**
- Fix work-orders and test-email auth (no service_role without auth)
- Replace getSession() with getUser() in migration and maintenance routes

**Short-term:**
- Add `canUpdateUserAuthorization` (or admin check) to fix-duplicate-ids and migration routes
- Enable MFA for admin roles in Supabase
- Review Supabase password policy (min length ≥12 for ASVS L2)

**Ongoing:**
- Audit all routes for consistent getUser() usage
- Document which routes require which roles
