# Incidents Triage Information Architecture

> **Purpose**: Define the final roles of asset detail, incidents inbox, incident review, and work-order execution surfaces. Aligns with the Incidents Triage Realignment plan.

---

## Surface Roles

| Surface | Role | Primary Action |
|--------|------|----------------|
| **Asset Detail** (`/activos/[id]`) | Operations hub for a single asset. Health, maintenance due, work in progress, and inspection context. | Crear OT, Reportar Incidente |
| **Incidents Inbox** (`/incidentes`) | Triage and monitoring. Answers "what happened and does it already have an OT?" | Ver (to incident review), Ver OT / Generar OT |
| **Incident Review** (`/incidentes/[id]`) | First-class review surface for one incident. Evidence, summary, linked OT/OC. | Ver OT, Generar OT |
| **Asset Incidents** (`/activos/[id]/incidentes`) | Asset-scoped incident workspace. Reporting and local review for one asset. | Nuevo Incidente, Ver Detalles (to review) |
| **Work Orders** (`/ordenes`) | Canonical execution queue. Planification, approval, assignment. | Nueva OT, Ver OT |
| **Purchase Orders** (`/compras`) | Procurement workflow downstream of work orders. | Nueva Orden, Aprobar |

## Navigation Rules

- **Ver** (from global incidents list) → `/incidentes/[id]` (incident review)
- **Ver OT** (when incident has linked work order) → `/ordenes/[work_order_id]`
- **Generar OT** (when incident has no linked work order) → API call, then Ver OT
- **Desde incidente** (from work order list) → `/incidentes/[incident_id]` (incident review)
- **Ver todos** (from asset incidents tab) → `/activos/[id]/incidentes`
- **Reportar Incidente** → `/activos/[id]/incidentes` (asset-scoped) or via asset detail actions

## Data Flow

```
Incident (incident_history)
  ├── asset_id → Asset
  ├── work_order_id → Work Order (nullable)
  └── documents → Evidence

Work Order (work_orders)
  ├── incident_id → Incident (nullable)
  ├── asset_id → Asset
  └── purchase_order_id → Purchase Order (nullable)
```

## Principle

Incidents are **detection/intake records** that escalate into work orders. Work orders are the **canonical execution object**. The incidents page is a triage inbox, not a parallel management system.
