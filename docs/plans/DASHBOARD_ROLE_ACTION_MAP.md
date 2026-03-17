# Dashboard Role Action Map

> Policy-aligned action hierarchy per role. Encargado de Almacén is a flag only—no dedicated dashboard. Coordinadores own PO status and recently approved POs.

---

## Role Corrections (Locked In)

- **ENCARGADO_ALMACEN** — Flag in roles only. No dedicated dashboard. Warehouse/release duties are not surfaced as a separate receiver.
- **Coordinadores de Mantenimiento** — Primary care for: recently approved POs, status of their purchase orders, their OTs, checklist compliance.
- **Formalizar WhatsApp** — Removed from Coordinador. Not useful.

---

## Role Action Hierarchy

Each dashboard: **Action strip → Role shortcuts → Context → Secondary modules**.

| Role | Hero Strip | Shortcuts |
|------|------------|-----------|
| **Gerente de Mantenimiento** | N órdenes esperan tu validación técnica → [Validar] | Incidentes activos, Equipos fuera de servicio, Plan preventivo |
| **Coordinador de Mantenimiento** | N OTs activas / N OCs recién aprobadas o en trámite → [Ver mis órdenes] | Crear OT+OC, Checklists de mi zona, Supervisar mecánicos |
| **Jefe de Planta** | N operadores sin checklist hoy → [Ver cumplimiento] | Asignación operador-activo, Solicitar usuario RH, Autorizar anomalía |
| **Operador / Dosificador** | N checklists para hoy → [Ejecutar] | Registrar diésel, Reportar incidencia |
| **Mecánico** | N OTs asignadas → [Ver OTs] | Subir evidencia, Completar OT |
| **Administración** | N OCs esperan revisión de viabilidad → [Revisar] | CxP, Padrón proveedores |
| **Gerencia General** | N OCs ≥$7k esperan aprobación → [Aprobar] | Reportes, Configuración |
| **Recursos Humanos** | N incidencias en conciliación → [Conciliar] | Usuarios, Movimientos de personal |
| **Jefe de Unidad de Negocio** | Overview de mi unidad | Servicios pendientes, Cumplimiento checklist/diésel |

---

## Coordinador de Mantenimiento: PO Focus

Coordinadores create OTs and OCs. They need to:

- See **status of their purchase orders** (pendiente validación, en viabilidad, aprobada, recibida)
- See **recently approved POs** — their OCs that just got technical approval and are moving to viability or CxP
- Quick access to create OT+OC
- Checklist compliance for their zone
- Mechanic supervision

**Not included:** Formalizar WhatsApp, Encargado de Almacén release queue.
