# HTML matrix (`#matriz`) ↔ app modules ↔ enforcement

**Companion source:** [source/roles-y-acciones-plataforma-v2.html](./source/roles-y-acciones-plataforma-v2.html) — anchor `#matriz`.  
**Policy:** Rows are interpreted with [01-POL-OPE-001-traceability.md](./01-POL-OPE-001-traceability.md) and [02-POL-OPE-002-traceability.md](./02-POL-OPE-002-traceability.md).  
**Code modules:** Keys from `ModulePermissions` in `lib/auth/role-permissions.ts`: `assets`, `maintenance`, `work_orders`, `purchases`, `inventory`, `personnel`, `checklists`, `reports`, `config`.

**Legend (from HTML):** ✔ = puede; — = no aplica; P = suplente/parcial; A = AUTO (sistema).

Columns below: **SOP ID** | **Row label (from matrix)** | **Primary POL refs** | **Module keys** | **Enforcement notes** | **Status**

---

## INCIDENCIAS

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-registrar-incidencia | Registrar incidencia | POL001 PAT orígenes; POL001 Checklist diario | `maintenance`, `checklists` | Incident creation UI/API | UNVERIFIED paths |
| SOP-MATRIX-ROW-ot-auto-desde-incidencia | OT auto-generada (desde incidencia) | POL001 PAT paso 1 | `work_orders` | System automation | UNVERIFIED |
| SOP-MATRIX-ROW-revisar-ot-cierre-oc | Revisar OT y decidir cierre/OC | POL001 PAT paso 2 | `work_orders`, `purchases` | Coordinator | UNVERIFIED |
| SOP-MATRIX-ROW-cerrar-ot-validacion | Cerrar OT (validación) | POL001 PAT paso 6 | `work_orders` | Coordinator + operador confirma | UNVERIFIED |

---

## ÓRDENES DE TRABAJO — PREVENTIVO

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-crear-ot-preventiva | Crear OT preventiva (manual) | POL001 Preventivo | `work_orders` | Coordinator | UNVERIFIED |
| SOP-MATRIX-ROW-programar-calendario-preventivo | Programar calendario preventivo | POL001 Preventivo | `maintenance` | | UNVERIFIED |
| SOP-MATRIX-ROW-recibir-alerta-umbral | Recibir alerta de umbral | POL001 Preventivo | `maintenance` | Notifications | UNVERIFIED |

---

## ÓRDENES DE COMPRA

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-crear-oc | Crear OC | POL002 OC; POL001 PAT | `purchases` | `workflow-policy.ts`, PO APIs | PARTIAL |
| SOP-MATRIX-ROW-autorizar-oc-nivel-1 | Autorizar OC Nivel 1 (técnica) | POL001/002 Gerente Mtto | `purchases` | `isTechnicalApproverRole` | PARTIAL |
| SOP-MATRIX-ROW-revisar-viabilidad-tipo-b | Revisar viabilidad (Tipo B) | POL002 Tipo B | `purchases` | Administración | PARTIAL |
| SOP-MATRIX-ROW-autorizar-oc-7k | Autorizar OC ≥$7k (Nivel 3) | POL001/002 GG | `purchases` | `isGMEscalatorRole` | PARTIAL |
| SOP-MATRIX-ROW-liberar-material-tipo-a | Liberar material (OC Tipo A aprobada) | POL002 Tipo A | `inventory`, `purchases` | Encargado | UNVERIFIED |
| SOP-MATRIX-ROW-procesar-pago-cxp | Procesar pago CxP | POL002 Administración | `purchases` | | UNVERIFIED |

---

## CHECKLIST

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-checklist-diario | Checklist diario (por equipo asignado) | POL001 Checklist diario | `checklists` | | UNVERIFIED |
| SOP-MATRIX-ROW-checklist-semanal | Checklist semanal | POL001 Checklist semanal | `checklists` | | UNVERIFIED |
| SOP-MATRIX-ROW-supervisar-checklist | Supervisar cumplimiento checklist | POL001 | `checklists` | | UNVERIFIED |

---

## DIÉSEL

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-registrar-diesel | Registrar carga de diésel | POL001 Diésel | `maintenance` or domain route | | UNVERIFIED |
| SOP-MATRIX-ROW-registrar-diesel-ninguno | Registrar si ninguno disponible | POL001 Diésel conciliación | — | Matrix shows em-dash for roles; special row for “cualquier usuario” | See HTML |
| SOP-MATRIX-ROW-cualquier-usuario-diesel | → Cualquier usuario que carga… (conciliación) | POL001 Diésel | — | HTML marks partial (p) across columns | Policy-only nuance |

---

## ACTIVOS — MOVIMIENTO

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-checklist-salida | Checklist de salida (antes de mover) | POL002 Movimiento físico | `assets` | | UNVERIFIED |
| SOP-MATRIX-ROW-checklist-recepcion | Checklist de recepción (al recibir) | POL002 | `assets` | | UNVERIFIED |
| SOP-MATRIX-ROW-notif-movimiento-activo | Recibir notificación de movimiento | POL002 GG notificaciones | `assets`, notifications | | UNVERIFIED |

---

## ACTIVOS — PERSONAL Y ASIGNACIÓN

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-asignacion-operador-equipo | Registrar asignación operador-equipo | POL002 asignación | `personnel`, `assets` | `app/api/asset-operators/*` | OK |
| SOP-MATRIX-ROW-notif-asignacion | Recibir notificación de asignación | POL002 | — | | UNVERIFIED |
| SOP-MATRIX-ROW-solicitar-alta-rh | Solicitar alta de usuario a RH | POL001 Alta | `personnel` | | UNVERIFIED |
| SOP-MATRIX-ROW-procesar-alta-baja | Procesar alta/baja de usuario | POL001/002 RRHH | `personnel` | `update-authorization`, operators API | PARTIAL |
| SOP-MATRIX-ROW-notif-gg-personal | Notificar G.General movimientos personal | POL002 RRHH | — | | UNVERIFIED |

---

## INVENTARIO

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-recibir-material | Recibir material (con remisión) | POL002 Almacén | `inventory` | | UNVERIFIED |
| SOP-MATRIX-ROW-entregar-material | Entregar material (con OC aprobada) | POL002 | `inventory`, `purchases` | | UNVERIFIED |
| SOP-MATRIX-ROW-firmar-recepcion-material | Firmar recepción de material | POL002 | `inventory` | | UNVERIFIED |
| SOP-MATRIX-ROW-conteo-ciclico | Conteo cíclico | POL002 Auditorías | `inventory` | | UNVERIFIED |

---

## CONCILIACIÓN

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-gestionar-conciliacion | Gestionar proceso de conciliación | POL001 Incidencias sistema | compliance + `personnel` | `compliance/sanctions`, disputes | PARTIAL |
| SOP-MATRIX-ROW-presentar-version-conciliacion | Presentar versión en conciliación | POL001 | compliance | | PARTIAL |
| SOP-MATRIX-ROW-emitir-resolucion-conciliacion | Emitir resolución de conciliación | POL001 RRHH | compliance | | PARTIAL |

---

## EJECUCIÓN DE INTERVENCIONES

| ID | Row | POL | Modules | Notes | Status |
|----|-----|-----|---------|-------|--------|
| SOP-MATRIX-ROW-ejecutar-intervencion | Ejecutar intervención (sobre OT aprobada) | POL001 PAT; POL001 Mecánicos | `work_orders`, `maintenance` | MECANICO | UNVERIFIED |
| SOP-MATRIX-ROW-registrar-evidencia-fotografica | Registrar evidencia fotográfica | POL001 Mecánicos | `work_orders` | Matrix shows Coordinator + Mechanic | UNVERIFIED |

---

## How to clear `UNVERIFIED`

For each row, add `app/...` or `app/api/...` paths after searching:

`rg -n "incident|incidencia|work_order|purchase_order|checklist|diesel|asset_operator|conciliación|sanction" app --glob "*.{ts,tsx}"`

Narrow per domain and paste evidence lines into [05-web-app-enforcement-inventory.md](./05-web-app-enforcement-inventory.md).
