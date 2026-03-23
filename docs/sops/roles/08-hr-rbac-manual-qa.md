# Manual QA — HR / personnel RBAC (post–HR hardening)

Run after deploy or before release. Use non-production first.

## Preconditions

- Four test accounts: **RH**, **GG**, **JUN** (with `business_unit_id`), **JP** (with `plant_id`), plus one **COORDINADOR** or **OPERADOR** without personnel admin.

## Route and nav

| Step | Actor | Action | Expected |
|------|--------|--------|----------|
| 1 | OPERADOR | Open `/gestion/personal` | Blocked or redirected (`RoleProvider` + default-deny routes). |
| 2 | RH | Open `/rh/limpieza`, `/rh/cumplimiento-checklists` | Pages load. |
| 3 | OPERADOR | Open `/rh/limpieza` | Guard blocks or redirect. |
| 4 | Any | Hit `/personal` or `/organizacion/personal` | Redirect to `/gestion/personal`. |

## Operators API

| Step | Actor | Action | Expected |
|------|--------|--------|----------|
| 5 | JUN | GET `/api/operators/register` | 200; only BU-scoped rows (+ unassigned in BU per rules). |
| 6 | JP | GET `/api/operators/register` | 200; only same `plant_id`. |
| 7 | COORDINADOR | GET `/api/operators/register` | 403 or empty per `canViewOperatorsList`. |
| 8 | JP | POST register with `role: OPERADOR`, correct plant | 201. |
| 9 | JP | POST register with `role: GERENCIA_GENERAL` | 403 / validation error. |
| 10 | JUN | POST register with wrong `business_unit_id` | 403 / validation error. |

## UI smoke

| Step | Actor | Action | Expected |
|------|--------|--------|----------|
| 11 | RH | Dashboard `/dashboard/rh` | Hub links to personal, autorizaciones, credenciales, RH reports, conciliación. |
| 12 | JUN | Dashboard hero shortcuts | Personal, registrar, asignaciones, operador→activo visible. |
| 13 | RH | `UserRegistrationTool` success | No password in toast; copy/handoff pattern. |

Record failures with role, URL, and response body.

## Automated (scope helpers)

```bash
npx tsx --test lib/auth/operator-scope.test.ts
```
