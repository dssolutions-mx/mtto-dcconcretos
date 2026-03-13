# Phase 7 — Threat Model and Risk Register

**Assessment target:** maintenance-dashboard  
**Date:** 2025-03-13  
**Input:** Phases 1–6

---

## Assets

| Asset | Confidentiality | Integrity | Availability |
|-------|-----------------|-----------|-------------|
| Session tokens / JWTs | Critical | Critical | High |
| SUPABASE_SERVICE_ROLE_KEY | Critical | Critical | High |
| User PII (profiles) | High | High | Medium |
| Purchase orders, financial data | Critical | Critical | High |
| Work orders, checklists, assets | Medium–High | High | High |
| Diesel inventory transactions | Medium–High | High | High |
| Application availability | N/A | N/A | Critical |

---

## Actors

| Actor | Trust | Access | Motivation |
|-------|-------|--------|------------|
| Anonymous | None | maintenance/work-orders, test-email, public pages | DoS, data access, spam |
| Authenticated user | Low–Med | Own data, RLS-scoped | IDOR, privilege escalation |
| Admin (GERENCIA_GENERAL) | High | User mgmt, migrations | Insider threat |
| Attacker with exec_sql | None | Full DB if function exists | Exfiltration, sabotage |

---

## STRIDE Threat Scenarios

### S — Spoofing

| ID | Scenario | Likelihood | Impact | Risk | Finding |
|----|----------|------------|--------|------|---------|
| S1 | Anonymous caller creates work orders (no auth on work-orders when service_role) | High | Medium | **High** | STATIC-001 |
| S2 | Anonymous caller accesses test-email, fetches POs and asset history | High | High | **Critical** | CONFIG-001 |
| S3 | getSession() fallback allows weaker auth verification | Medium | Medium | Medium | STATIC-002 |

### T — Tampering

| ID | Scenario | Likelihood | Impact | Risk | Finding |
|----|----------|------------|--------|------|---------|
| T1 | exec_sql RPC executes arbitrary SQL if present | High | Critical | **Critical** | STATIC-005 |
| T2 | suppliers POST/PUT mass assignment (e.g., created_by, status) | Medium | Medium | Medium | API-005, API-006 |
| T3 | purchaseOrderId path traversal in storage/upload | Low | Medium | Low | STATIC-008 |

### R — Repudiation

| ID | Scenario | Likelihood | Impact | Risk | Finding |
|----|----------|------------|--------|------|---------|
| R1 | No auth logging; hard to trace who performed sensitive actions | Medium | Low | Low | — |

### I — Information Disclosure

| ID | Scenario | Likelihood | Impact | Risk | Finding |
|----|----------|------------|--------|------|---------|
| I1 | test-email returns purchase orders and asset movement data to unauthenticated caller | High | High | **Critical** | CONFIG-001 |
| I2 | Supabase error details returned to client (table/column names) | Medium | Low | Low | STATIC-010 |
| I3 | Hardcoded test email (PII) in source | Low | Low | Low | CONFIG-005 |

### D — Denial of Service

| ID | Scenario | Likelihood | Impact | Risk | Finding |
|----|----------|------------|--------|------|---------|
| D1 | No rate limiting — brute force on login, flooding of API | High | Medium | **High** | CONFIG-003 |
| D2 | suppliers limit=999999 unbounded | Medium | Low | Low | API-009 |
| D3 | Next.js, xlsx, minimatch ReDoS (dependency) | Medium | Medium | Medium | Phase 3 |

### E — Elevation of Privilege

| ID | Scenario | Likelihood | Impact | Risk | Finding |
|----|----------|------------|--------|------|---------|
| E1 | Any authenticated user runs fix-duplicate-ids (exec_sql) | High | Critical | **Critical** | STATIC-006 |
| E2 | cleanup-schedules: unauthenticated or wrong-scoped user deletes schedules | Medium | High | **High** | STATIC-004 |
| E3 | authorization/summary user_id — IDOR if canManageAuthorization bug | Low | Medium | Low | STATIC-007 |

---

## Risk Register (Prioritized)

| Rank | Risk | Scenario | Severity | Remediation |
|------|------|----------|----------|-------------|
| 1 | test-email unauthenticated, uses service_role | I1, S2 | Critical | Add getUser(); restrict to admin; remove from prod |
| 2 | exec_sql / fix-duplicate-ids | T1, E1 | Critical | Remove exec_sql from API; restrict fix-duplicate-ids to admin |
| 3 | maintenance/work-orders no auth when service_role | S1 | High | Require auth; avoid service_role or add compensating auth |
| 4 | No rate limiting | D1 | High | Add rate limiting for auth and API |
| 5 | getSession() fallback | S3 | Medium | Use getUser() only |
| 6 | cleanup-schedules no auth | E2 | High | Add getUser(); verify RLS |
| 7 | Security headers missing | — | High | Add headers to next.config |
| 8 | suppliers mass assignment | T2 | Medium | Allowlist insert/update fields |
| 9 | fix-duplicate-ids no role check | E1 | High | Add canUpdateUserAuthorization |
| 10 | Next.js, xlsx vulnerabilities | D3 | High | Upgrade next; replace/restrict xlsx |

---

## Threat Model Summary

- **Critical:** 2 (test-email, exec_sql)
- **High:** 5 (work-orders, rate limiting, cleanup-schedules, headers, fix-duplicate-ids)
- **Medium:** 3
- **Low:** 4

**Top 3 Priorities:**
1. Secure test-email endpoint
2. Eliminate or severely restrict exec_sql; lock down fix-duplicate-ids
3. Fix maintenance/work-orders auth
