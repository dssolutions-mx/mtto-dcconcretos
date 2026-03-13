# Phase 4 — Configuration & Secrets Review

**Assessment target:** maintenance-dashboard  
**Date:** 2025-03-13  
**Input:** Phase 1 Inventory

---

## Configuration & Secrets Review Findings

### Critical Findings (Immediate Action Required)

**[CONFIG-001]: Unauthenticated test-email API Uses service_role and Bypasses RLS**
- **Severity:** Critical
- **OWASP:** A05 Security Misconfiguration, A01 Broken Access Control
- **Location:** `app/api/notifications/test-email/route.ts`
- **Issue:** GET endpoint has no `getUser()` or `getSession()` check. Uses `SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY` as `dataKey` for direct REST calls to Supabase. When service_role is set, any unauthenticated caller can: (1) fetch purchase orders and asset movement history (bypassing RLS), (2) trigger Edge Functions to send emails.
- **Risk:** Data exfiltration of purchase orders and asset movements; email bombing/spam; abuse of notification system.
- **Fix:** Add `getUser()` check; return 401 when unauthenticated. Restrict to admin/dev role (e.g., GERENCIA_GENERAL or env-gated for development only). Consider removing or moving to internal tooling; do not expose in production.

---

### High Findings

**[CONFIG-002]: Security Headers Not Configured**
- **Severity:** High
- **OWASP:** A05 Security Misconfiguration
- **Location:** `next.config.mjs`
- **Issue:** No `headers()` configuration. Missing: Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- **Risk:** XSS, clickjacking, MIME sniffing, protocol downgrade attacks; reduced defense-in-depth.
- **Fix:** Add security headers to next.config:
```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      ],
    },
  ]
}
```
Consider CSP (start restrictive, loosen as needed).

**[CONFIG-003]: No Rate Limiting on Auth or API**
- **Severity:** High
- **OWASP:** A05 Security Misconfiguration
- **Location:** Application-wide
- **Issue:** No `@upstash/ratelimit`, `rate-limiter-flexible`, or similar. Login, registration, password reset, and general API routes are not rate-limited.
- **Risk:** Brute-force attacks on credentials; DoS via request flooding; abuse of expensive endpoints.
- **Fix:** Add rate limiting middleware for `/api/auth/*` (login, register, reset) and optionally for sensitive API routes. Use Vercel Edge middleware or a library like `@upstash/ratelimit`.

---

### Medium Findings

**[CONFIG-004]: next.config — images.unoptimized: true**
- **Severity:** Medium
- **OWASP:** A05 Security Misconfiguration
- **Location:** `next.config.mjs`
- **Issue:** Image optimization is disabled. Combined with broad `remotePatterns` (if ever added), this could increase DoS surface (per Next.js advisory GHSA-9g9p-9gw9-jx7f). Current config does not set `remotePatterns`, so impact is limited to lack of optimization.
- **Risk:** Larger images, slower load; if remote patterns are added later without care, DoS risk.
- **Fix:** Re-enable image optimization when feasible; if keeping unoptimized, document reason and avoid adding broad remote patterns.

**[CONFIG-005]: Hardcoded Test Email in Source**
- **Severity:** Medium
- **OWASP:** A05 Security Misconfiguration
- **Location:** `app/api/notifications/test-email/route.ts` line 3
- **Issue:** `const TEST_EMAIL = 'juan.aguirre@dssolutions-mx.com'` is hardcoded.
- **Risk:** PII in source control; test emails always go to this address.
- **Fix:** Use `process.env.TEST_EMAIL` or similar; ensure env is not committed.

**[CONFIG-006]: No Root middleware.ts for Auth**
- **Severity:** Medium
- **OWASP:** A05 Security Misconfiguration
- **Location:** Project root (no `middleware.ts`)
- **Issue:** No Next.js middleware for session refresh or global auth redirects. Auth is enforced per-route; some routes may be missed.
- **Risk:** Inconsistent protection; unauthenticated access to pages that should be protected if developers forget to add checks.
- **Fix:** Add `middleware.ts` at project root for Supabase session refresh (per `@supabase/ssr` docs). Optionally redirect unauthenticated users from protected paths to login.

---

### Low / Informational Findings

**[CONFIG-007]: .env Files Correctly Gitignored**
- **Severity:** Informational
- **Location:** `.gitignore`
- **Issue:** `.env*` is listed; no `.env` files found in repo.
- **Status:** Good practice.

**[CONFIG-008]: SERVICE_ROLE_KEY Not in Client Code**
- **Severity:** Informational
- **Location:** Components, pages
- **Issue:** `SUPABASE_SERVICE_ROLE_KEY` is used only in: `lib/supabase-admin.ts`, `app/api/maintenance/work-orders/route.ts`, `app/api/notifications/test-email/route.ts`, scripts, and Supabase Edge Functions. No usage in `components/` or client-rendered pages.
- **Status:** Correct; service_role is server-side only. The issues are (1) work-orders uses it without auth, (2) test-email is unauthenticated.

**[CONFIG-009]: Loose Version Pinning**
- **Severity:** Low
- **Location:** `package.json`
- **Issue:** `"latest"` used for @hookform/resolvers, @radix-ui/react-avatar, date-fns, react-day-picker, react-hook-form, zod.
- **Risk:** Non-deterministic installs; supply-chain drift.
- **Fix:** Pin to specific versions.

---

### Configuration Hygiene Summary

| Area | Status | Notes |
|------|--------|-------|
| .env committed | OK Not committed | .env* in .gitignore |
| SERVICE_ROLE_KEY client-safe | OK Server-only | Never in components |
| Security headers | Missing | Add to next.config |
| Rate limiting | Missing | Add for auth + sensitive API |
| CORS configured | N/A | Next.js same-origin by default |
| Docker non-root | N/A | No Dockerfile found |
| CI secrets | N/A | No .github/workflows |
| test-email auth | Critical | Unauthenticated, uses service_role |
