# Incident SLA program — progress ledger

Programa continuo para convertir el tablero SLA en una capacidad operativa real (no solo reporteo).

## Estado general

| Fase | Estado | Repo |
|------|--------|------|
| 0 — Base organizacional | ☑ Completo | `mtto-dcconcretos` |
| 1 — Workflow (claim/ack/assign + bandeja) | ☑ Completo | `mtto-dcconcretos` |
| 2 — Auto-transiciones + bulk routing | ☑ Completo | `mtto-dcconcretos` |
| 3 — Notificaciones in-app | ☑ Completo | `mtto-dcconcretos` |
| 4 — Dashboard SLA con readiness | ☑ Completo | `mtto-dcconcretos` |

## Migraciones (aplicar en staging/prod — humano)

1. `20260617130000_incident_sla_compliance.sql`
2. `20260617140000_incident_sla_org_foundation.sql`
3. `20260617150000_incident_workflow_auto_transitions.sql`
4. `20260617160000_incident_notifications.sql`

## Fase 0 — Base organizacional

- `department_memberships` + RLS + backfill desde `profiles.departamento`
- `acknowledged_at` / `acknowledged_by_id`
- APIs: membresías, org-foundation, claim, acknowledge
- UI: `/gestion/departamentos`, tab **Base SLA**

## Fase 1 — Workflow operativo

- Filtro **Mi bandeja** (`inbox=mine`) por defecto en Bandeja
- Botones **Tomar** / **Acusar** en fila de tabla
- Bulk **Asignarme** y clasificación por departamento
- `assignee_id=me` y `unassigned=true` en API routed

## Fase 2 — Auto-transiciones

- WO creada → acuse implícito si ya hay departamento
- `planned_date` → etapa `en_atencion`
- WO `Completada` → etapa `cerrado` + status Resuelto
- **Auto-clasificar** seleccionados vía reglas (`POST /api/incidents/routed`)

## Fase 3 — Notificaciones

- Tabla `incident_notifications` + API GET/PATCH
- Campana en pipeline de incidencias
- Eventos: asignación, claim, acknowledge (supervisor)

## Fase 4 — Dashboard SLA

- Banner de readiness (&lt;50% = preview) en `/reportes/incidentes-sla`
- Widgets operativos en tab Tablero (sin clasificar, sin responsable, sin acuse, SLA)
- Drill-down **Siguiente acción** en tabla de incumplimientos

## PR

- Draft: https://github.com/dssolutions-mx/mtto-dcconcretos/pull/29 (rama `agent/dc-mantenimiento-sla-tablero`)
