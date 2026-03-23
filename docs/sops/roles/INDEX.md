# Roles, policies, and enforcement — master index

**Pack version:** 1  
**Policies:** [../policies/VERSIONS.md](../policies/VERSIONS.md)  
**Companion HTML (matrix / anchors):** [source/roles-y-acciones-plataforma-v2.html](./source/roles-y-acciones-plataforma-v2.html)

| Doc | Purpose |
|-----|---------|
| [00-sources-and-conventions.md](./00-sources-and-conventions.md) | Citations, no-speculation rule, threshold inventory, suplencias POL001↔POL002 |
| [01-POL-OPE-001-traceability.md](./01-POL-OPE-001-traceability.md) | POL-OPE-001 section IDs (`POL001-*`) |
| [02-POL-OPE-002-traceability.md](./02-POL-OPE-002-traceability.md) | POL-OPE-002 section IDs (`POL002-*`) |
| [03-role-terminology-and-db-mapping.md](./03-role-terminology-and-db-mapping.md) | Spanish labels ↔ `profiles.role` ↔ `business_role` mapping |
| [04-database-profiles-rls-and-tables.md](./04-database-profiles-rls-and-tables.md) | `profiles` columns, enum, RLS notes |
| [05-web-app-enforcement-inventory.md](./05-web-app-enforcement-inventory.md) | Module → routes/APIs → `loadActorContext` list |
| [06-html-matrix-to-code-matrix.md](./06-html-matrix-to-code-matrix.md) | Each `#matriz` row → `SOP-MATRIX-ROW-*` |
| [07-gaps-drift-and-open-questions.md](./07-gaps-drift-and-open-questions.md) | Conflicts and UNVERIFIED items |
| [role-sop-index.yaml](./role-sop-index.yaml) | Machine-readable index |

---

## SOP-FLOW-* (internal)

| ID | Description | POL primary | HTML anchor (if useful) |
|----|-------------|-------------|-------------------------|
| SOP-FLOW-INC | Correctivo PAT (incidencia → OT → OC) | POL001 `## Correctivo — Protocolo PAT` | `#incidentes` |
| SOP-FLOW-PREV | Preventivo | POL001 `## Preventivo` | `#preventivo` |
| SOP-FLOW-OC | Órdenes de compra (Tipo A/B, montos) | POL002 `## Órdenes de Compra`; POL001 PAT | `#oc` |
| SOP-FLOW-CHK-D | Checklist diario | POL001 `### Diario` | `#checklist` |
| SOP-FLOW-CHK-W | Checklist semanal | POL001 `### Semanal` | `#checklist` |
| SOP-FLOW-DIE | Diésel | POL001 `## Diésel` | `#diesel` |
| SOP-FLOW-AST-MOV | Movimiento físico de activos | POL002 `## Movimientos de Activos` | `#activos` |
| SOP-FLOW-AST-ASG | Asignación operador–equipo | POL002 asignación; POL001 Alta | `#activos`, `#personal` |
| SOP-FLOW-CON | Incidencias de sistema y conciliación | POL001 `## Incidencias de Sistema` | `#conciliacion` |
| SOP-FLOW-WA | WhatsApp formalización | POL001 `## Grupo WhatsApp` | — |

---

## SOP-ROLE-* (internal)

| ID | Policy names | `profiles.role` values (typical) | HTML companion |
|----|--------------|----------------------------------|----------------|
| SOP-ROLE-GG | Gerente General | `GERENCIA_GENERAL` | `#r-gg` |
| SOP-ROLE-GM | Gerente de Mantenimiento | `GERENTE_MANTENIMIENTO` | `#r-gm` |
| SOP-ROLE-COORD | Coordinador de Mantenimiento | `COORDINADOR_MANTENIMIENTO`, `ENCARGADO_MANTENIMIENTO` | `#r-coord` |
| SOP-ROLE-JUN | Jefe de Unidad de Negocio | `JEFE_UNIDAD_NEGOCIO` | `#r-jun` |
| SOP-ROLE-JP | Jefe de Planta | `JEFE_PLANTA` | `#r-jp` |
| SOP-ROLE-DOS | Dosificador / Operador | `DOSIFICADOR`, `OPERADOR` | `#r-dos` |
| SOP-ROLE-MEC | Mecánico | `MECANICO` | `#r-mec` |
| SOP-ROLE-ALM | Encargado de Almacén | `ENCARGADO_ALMACEN` | `#r-alm` |
| SOP-ROLE-ADM | Administración | `AREA_ADMINISTRATIVA` | `#r-adm` |
| SOP-ROLE-RH | RRHH | `RECURSOS_HUMANOS` | `#r-rh` |

---

## `ModulePermissions` → policy

**Source:** `lib/auth/role-permissions.ts`

| Module key | POL-OPE-001 sections | POL-OPE-002 sections |
|------------|----------------------|----------------------|
| `assets` | PAT (activo linkage), KPIs indirect | Movimientos de Activos, Alcance activos |
| `maintenance` | Preventivo, PAT, Diésel, Servicios externos | (supporting) |
| `work_orders` | PAT, Preventivo, Mecánicos | OC + OT linkage |
| `purchases` | PAT, OC steps, reembolsos | Órdenes de Compra, Tipo A/B |
| `inventory` | (reabastecimiento sin OT) | Administración de Almacén, Obsoleto, Garantía |
| `personnel` | Alta usuarios, asignación | Asignación personal, RRHH |
| `checklists` | Checklists diario/semanal | (supervisión JP/JUN) |
| `reports` | KPIs | KPIs |
| `config` | Vigencia / changes (GG) | — |

---

## When policy changes (checklist)

1. Update canonical markdown under [../policies/](../policies/).  
2. Bump [../policies/VERSIONS.md](../policies/VERSIONS.md) and POL headers.  
3. Refresh [01](./01-POL-OPE-001-traceability.md) / [02](./02-POL-OPE-002-traceability.md) section extracts.  
4. Diff HTML companion matrix; update [06](./06-html-matrix-to-code-matrix.md).  
5. Reconcile `lib/auth/role-permissions.ts` and `lib/purchase-orders/workflow-policy.ts` if rules changed.  
6. Re-run route audit methodology in [05](./05-web-app-enforcement-inventory.md).  
7. Update `role-sop-index.yaml` `pack_version` / `policies[].version`.  
8. Log new conflicts in [07](./07-gaps-drift-and-open-questions.md).

---

## Quick answer: quién crea OC (policy)

**POL-OPE-002** (`## Órdenes de Compra`): *Las OC las genera SOLO el Coordinador o Gerente de Mantenimiento.*  
**Code alignment:** `COORDINADOR_MANTENIMIENTO` creates; `isTechnicalApproverRole` = `GERENTE_MANTENIMIENTO` for Nivel 1 — see `lib/auth/role-model.ts` and `lib/purchase-orders/workflow-policy.ts`.
