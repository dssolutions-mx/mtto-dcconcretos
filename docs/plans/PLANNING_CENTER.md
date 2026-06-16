# Centro de planificación — modelo wholesome

## Concepto central: ventana de servicio (`asset_service_windows`)

La unidad de planificación que conecta mantenimiento y operaciones no es solo `planned_date` en la OT, sino una **ventana de servicio** explícita:

| Campo | Rol |
|-------|-----|
| `starts_at` / `ends_at` | Bloque de tiempo en que la unidad está fuera de operación |
| `planning_status` | `draft` → `confirmed` → `in_progress` → `completed` / `cancelled` |
| `work_order_id` | OT que motiva el servicio |
| `ops_notified_at` | Cuándo se avisó a operaciones |

Al confirmar una ventana:
1. `assets.status` → `maintenance` (vía trigger + `asset_status_events`)
2. Se encola notificación a `JEFE_PLANTA`, `COORDINADOR_MANTENIMIENTO`, `GERENTE_MANTENIMIENTO`
3. La OT recibe `planned_start_at`, `planned_end_at`, `service_window_id`

## Tres capas de disponibilidad

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ assets.status       │     │ asset_service_       │     │ Cotizador remisiones │
│ operational/        │  +  │ windows (planned)    │  +  │ (production commits) │
│ maintenance/repair  │     │                      │     │                      │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
         │                            │                            │
         └────────────────────────────┴────────────────────────────┘
                              availability check
                         GET /api/planning/availability
```

`lib/agenda/production-availability.ts` consulta remisiones por `unidad` (vía `asset_id` + `asset_name_mappings`) y sugiere slots (madrugada, noche, día libre).

## UI: `/ordenes/agenda` — Centro de planificación

Tres pestañas:
- **Semana (mecánicos)** — agenda semanal existente + badges de estado de activo
- **Por activo** — línea de tiempo por unidad con ventanas de servicio y OTs
- **Sin programar** — cola con botón Programar → diálogo completo

### Diálogo de programación

- Fecha + hora + duración
- Check de disponibilidad vs producción en vivo
- Slots sugeridos
- Checkbox notificar operaciones
- Override manual si hay conflicto

## APIs

| Ruta | Función |
|------|---------|
| `GET /api/planning/service-windows` | Calendario unificado (`planning_calendar_events`) |
| `POST /api/planning/service-windows` | Crear ventana |
| `PATCH /api/planning/service-windows` | Confirmar / cambiar estado |
| `GET /api/planning/availability` | Conflicto producción + ventanas solapadas |
| `POST /api/planning/notify-operations` | Re-enviar aviso ops |
| `PATCH /api/work-orders/[id]/schedule` | Programar OT + ventana + notificación |

## Migraciones (no aplicar en agente)

1. `20260616120000_incident_response_times_agenda.sql` — tiempos de atención
2. `20260617140000_asset_service_windows_planning.sql` — ventanas, auditoría, cola, vista

## Notificaciones

- Cola: `maintenance_notification_queue` (patrón `quality_notification_queue` en cotizador)
- Edge function: `maintenance-ops-service-window-notification` — procesa cola y envía SendGrid

## Próximos pasos (post-merge)

1. Aplicar migraciones en Supabase
2. Cron cada 5–15 min para edge function de cola
3. Vista día con timeline horario (estilo `EnsayosDayView` en cotizador)
4. Sincronizar alias `compliance_unit_aliases` ↔ `asset_name_mappings`
5. Dashboard ops: unidades en servicio hoy / mañana
