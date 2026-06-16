# Flujo: agenda de trabajos y tiempos de atención por incidencias

## Flujo actual (pre-agenda)

1. **Detección** — checklist o reporte manual crea fila en `incident_history`.
2. **Triage** — `/incidentes` agrupa por activo e hilo canónico (`canonical_issue_key`).
3. **OT** — coordinador genera OT vía RPC `generate_work_order_from_incident` (dedup si ya hay OT Pendiente).
4. **Programación** — históricamente manual en editar OT (`planned_date`, `assigned_to`); muchas OT auto-creadas quedaban sin fecha.
5. **Cierre** — al completar OT, trigger marca incidente `Resuelto`.

## Cambios de esta iteración

| Pieza | Ubicación | Qué hace |
|-------|-----------|----------|
| Migración | `supabase/migrations/20260616120000_incident_response_times_agenda.sql` | Columnas de hitos + triggers + vista `incident_response_metrics` |
| Agenda semanal | `/ordenes/agenda` | OTs con `planned_date` por día y técnico; panel “sin programar” |
| Hoja mecánico | `/ordenes/agenda/hoja` | Vista imprimible por técnico y semana |
| API agenda | `GET /api/work-orders/agenda` | Lista programados + pendientes de fecha |
| API programar | `PATCH /api/work-orders/[id]/schedule` | Asigna técnico/fecha; pasa OT a `Programada` |
| Post-OT | `ScheduleWorkOrderDialog` en detalle de incidente | Prompt al generar OT desde incidente |
| Métricas UI | Detalle de incidente | Muestra horas a OT / programación / cierre |

## Modelo de tiempos de atención

- `first_wo_created_at` — primer vínculo OT
- `first_planned_at` — primera `planned_date` en OT vinculada
- `first_assigned_at` — primer `assigned_to` en OT vinculada
- `resolved_at` — status Resuelto
- `target_response_hours` — meta default 48h (reporte → programado)

Vista `incident_response_metrics` expone KPIs para reportes.

## Integración con producción (fase posterior)

El ERP de cotizaciones (`COTIZADOR_SUPABASE_URL`) ya alimenta reportes gerenciales de m³.
Para no sacar de servicio unidades en producción al programar:

1. Consultar ventanas de baja demanda / sin despacho por `asset_id` + `plant_id`.
2. Sugerir `planned_date` en agenda cuando la unidad no tenga orden activa en planta.
3. Hook propuesto: `lib/agenda/production-availability.ts` (no implementado en este slice).

## Criterios de aceptación cubiertos

- [x] Modelo de agenda sobre `work_orders.planned_date` + `assigned_to`
- [x] UI calendario semanal con asignación a mecánico
- [x] Hoja de trabajo del mecánico (imprimible)
- [x] Captura de tiempos de atención (schema + UI en detalle)
- [x] Migraciones SQL sin aplicar
- [x] Gancho producción documentado
