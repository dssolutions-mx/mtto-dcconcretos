# Incident SLA program — progress ledger

Programa continuo para convertir el tablero SLA en una capacidad operativa real (no solo reporteo).

## Estado general

| Fase | Estado | Repo |
|------|--------|------|
| 0 — Base organizacional | ▶ En progreso (esta corrida) | `mtto-dcconcretos` |
| 1 — Workflow (claim/ack/assign) | ▶ Parcial (API + panel detalle) | `mtto-dcconcretos` |
| 2 — Bandeja operativa (mi bandeja, bulk assignee) | ☐ Pendiente | `mtto-dcconcretos` |
| 3 — Notificaciones (acuse, breach, escalación) | ☐ Pendiente | `mtto-dcconcretos` |
| 4 — Dashboard SLA con datos confiables | ☑ Scaffold (PR #29) | `mtto-dcconcretos` |

## Diagnóstico en vivo (2026-06-17)

Datos reales en producción al iniciar Phase 0:

- **519** incidencias abiertas; **2** ruteadas; **0** asignadas; **0** con acuse explícito
- **0/31** departamentos con `supervisor_id`
- `profiles.departamento` es texto libre (PRODUCCIÓN, CALIDAD, …) sin FK a `departments`
- Seed canónico omitía **MANT** en plantas nuevas (DIACE, Pitahaya)

## Fase 0 — Entregables (esta corrida)

- [x] Migración `20260617140000_incident_sla_org_foundation.sql`
  - `department_memberships` + RLS
  - `acknowledged_at` / `acknowledged_by_id`
  - Seed MANT faltante
  - Backfill idempotente desde `profiles.departamento`
  - Vista `incident_sla_compliance` prioriza `acknowledged_at` para MTTA
- [x] APIs: membresías, miembros por dept, org-foundation diagnostics, claim, acknowledge
- [x] UI: `/gestion/departamentos`, tab **Base SLA** en pipeline, panel con acuse/tomar
- [x] Assignee picker filtrado por membresía (fallback texto legado pre-migración)

## Próximo sprint (Phase 1 — cold start)

1. Aplicar migraciones `20260617130000` + `20260617140000` en staging/prod (humano)
2. RH: asignar supervisores por planta/depto en `/gestion/departamentos`
3. Bandeja: botones **Tomar** / **Acusar** en fila (no solo detalle)
4. Filtro **Mi bandeja** (`assigned_to_id=me`) por defecto para técnicos
5. Bulk backfill routing: clasificar backlog de 519 abiertas (script o acción masiva supervisada)

## Decisiones

- **Membresía explícita** (`department_memberships`) reemplaza la dependencia de texto libre; el texto legado solo alimenta backfill.
- **Acuse ≠ asignación**: el departamento puede acusar recibo sin tomar ownership; claim asigna y acusa.
- **Dashboard SLA** permanece en preview hasta que >50% de abiertas tengan dept + (acuse o assignee).

## PRs

- Draft: https://github.com/dssolutions-mx/mtto-dcconcretos/pull/29 (rama `agent/dc-mantenimiento-sla-tablero`)
