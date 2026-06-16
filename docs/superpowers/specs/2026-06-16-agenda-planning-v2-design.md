# Agenda Planning v2 — Design Spec

**Date:** 2026-06-16  
**Status:** Implemented  
**Routes:** `/ordenes/agenda` (coordinador), `/ordenes/agenda/hoja` (mecánico)

## Problem

Coordinadores planifican la semana de mantenimiento sin visibilidad de:

1. Si los insumos del día están disponibles en inventario.
2. Qué producción de concreto está programada en las plantas donde operan los activos de la agenda.

Los mecánicos necesitan una hoja simple — “orden del día” — con sus OTs, insumos por OT, y contexto de producción/remisiones de su unidad.

## Solution Overview

| Actor | Vista | Datos |
|-------|-------|-------|
| Coordinador | Agenda semanal + panel del día | Kit consolidado + pedidos Cotizador por planta |
| Mecánico | Hoja imprimible | OTs del día + insumos + producción/remisiones |

## APIs

### `GET /api/integrations/cotizador/orders`

**Auth:** required  
**Query:** `from`, `to` (YYYY-MM-DD), `plantIds` (comma-separated MantenPro or Cotizador UUIDs), optional `include_pump=true`

**Source:** Cotizador `orders` + `order_items` + `plants` + `clients`

**Filters:**

- `delivery_date` between `from` and `to`
- `order_status IN ('created', 'validated')`
- Optional plant filter (MantenPro IDs mapped via plant `code`)

**Pump handling:**

- Lines with `product_type` matching `/pump|bombeo|bomba/i` are flagged `is_pump_only: true`
- Pump-only lines excluded by default
- Orders whose items are exclusively pump service are excluded entirely

**Response fields per line:** `order_number`, `delivery_date`, `delivery_time`, `construction_site`, `client_name`, `plant_id`, `plant_name`, `product_type`, `volume`, `concrete_volume_delivered`, `order_status`, `order_id`, `is_pump_only`

### `GET /api/work-orders/agenda/daily-kit`

**Auth:** required  
**Query:** `date` (required), `technicianId` (optional)

**Sources:**

- `work_orders` scheduled on `date` with active statuses
- `required_parts` JSONB on each WO
- `required_tasks[].parts` from preventive plans

**Inventory:** `StockService.checkMultiplePartsAvailability` per asset plant

**Response:**

- `kit[]` — consolidated parts with `sufficient` flags
- `by_work_order[]` — per-OT breakdown
- `plant_ids[]` — for Cotizador order lookup
- `summary` — counts (total, sufficient, insufficient, unknown)

## UI

### Coordinador — `work-agenda-board.tsx`

- Week grid with selectable day (ring highlight)
- `AgendaDayDetailPanel` below grid:
  - Kit de insumos del día (stock badges)
  - Producción del día (Cotizador orders filtered by plants from scheduled assets)
  - “Imprimir kit del día”

### Mecánico — `mechanic-work-sheet.tsx`

- Defaults: `from=to=today`, `technician=logged-in profile.id`
- Per-day sections with OT table
- Insumos listed under each OT
- Plant production summary + remisiones per unit (`/api/integrations/cotizador/remisiones`)
- Print-friendly layout preserved

## Shared Libraries

| Module | Purpose |
|--------|---------|
| `lib/agenda/cotizador-plant-map.ts` | MantenPro ↔ Cotizador plant mapping |
| `lib/agenda/cotizador-orders.ts` | Pump detection + order flattening |
| `lib/agenda/aggregate-daily-kit.ts` | Parts extraction + consolidation |

## Environment

Requires `COTIZADOR_SUPABASE_URL` and `COTIZADOR_SUPABASE_SERVICE_ROLE_KEY` for production data. APIs return empty arrays with `configured: false` when unset.

## Manual Test Plan

1. Log in as coordinador → `/ordenes/agenda`
2. Select a day with scheduled WOs → verify kit table and stock badges
3. Verify producción table (or “no configurada” message without Cotizador env)
4. Click “Imprimir kit del día”
5. Open hoja de trabajo → defaults to today + current user
6. Verify insumos under each OT and remisiones when asset has deliveries
7. Print preview on hoja

## Known Limitations

- Parts without `part_id` show “Sin catálogo” — no stock check
- Cross-plant duplicate parts use best available stock across plants (not reservation-aware)
- `concrete_volume_delivered` depends on Cotizador `order_items` column presence

## Navigation & Workflows (2026-06-16)

### Sidebar — Trabajos

| Ruta | Etiqueta | Rol típico |
|------|----------|------------|
| `/ordenes` | Órdenes de Trabajo | Coordinador, gerencia |
| `/ordenes/agenda` | Agenda semanal | Coordinador |
| `/ordenes/agenda/hoja` | Orden del día | Mecánico |
| `/ordenes/planificacion` | Planificación | Coordinador |
| `/ordenes/campanas` | Campañas | Coordinador |
| `/incidentes` | Incidentes | Mantenimiento |
| `/incidentes/pipeline` | Pipeline de incidencias | Coordinador |

Otros módulos recientes en sidebar: **Llantas** (`/activos/llantas`). Nómina / centro de mando: **Reportes → Centro de mando** (`/reportes/gerencial/analisis-costos`).

### Planificación rápida (modal)

`PlanWorkOrderDialog` — desde agenda (tarjetas sin programar o del día) o lista `/ordenes` (acción **Programar**):

- Resumen OT (número, activo, descripción)
- `planned_date`, `assigned_to`, `status`, `priority`
- `PATCH /api/work-orders/[id]/schedule`

### Lista de OTs

- Banner **Sin programar** con enlace a agenda
- Filtro **Programación**: con fecha / sin programar
- Columna **Programada**

### Flujo mecánico (hoja)

En `/ordenes/agenda/hoja` (no impresión):

- **Iniciar** → `PATCH /api/work-orders/[id]/status` (`En ejecución`)
- **Completar** → `MechanicCompleteDialog` (modal de campo):
  - Tareas requeridas (checkbox obligatorio si existen)
  - Repuestos con cantidad usada (desde `required_parts` o ítems de OC)
  - Lectura horas/km para preventivos con plan
  - Horas de trabajo + notas
  - Evidencia fotográfica opcional (`EvidenceUpload`, contexto `completion`)
  - Validación alineada con `POST /api/maintenance/work-completions`
- **Formulario completo** → `/ordenes/[id]/completar` (gastos adicionales, ajuste OC, absorción preventiva avanzada)

### Compras — navegación post-aprobación (2026-06-16)

**Decisión:** CFDI, comprobantes y CxP no son entradas primarias del sidebar. El flujo principal es **desde cada OC** (`/compras/[id]`).

| Acceso | Dónde |
|--------|--------|
| Sidebar Compras | Solo **Órdenes de Compra** (+ inventario, diesel, proveedores) |
| Detalle OC | `PoProcurementNavCard`: anclas `#po-comprobantes`, `#po-factura-cfdi`, enlace CxP `?po=` |
| Rutas profundas | `/compras/comprobantes?po=`, `/compras/cuentas-por-pagar?po=` (sin nav lateral) |
| Panel global | `/compras/procurement` para coordinación administrativa |

Se eliminaron del sidebar: **Comprobantes (CFDI)** y **Cuentas por pagar** como ítems hermanos de Órdenes de Compra.
