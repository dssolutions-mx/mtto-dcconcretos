# Role terminology ↔ database ↔ business role mapping

**Verified against:** [`lib/auth/role-model.ts`](../../../lib/auth/role-model.ts) at git `f71dd87f008ac869c10ca07afce2c3eeb7e89a41`.

## `Database["public"]["Enums"]["user_role"]` (generated types)

**Source:** `types/supabase-types.ts` — `Enums.user_role` union (verified in repo).

Values (order as in generated file):

`GERENCIA_GENERAL`, `JEFE_UNIDAD_NEGOCIO`, `ENCARGADO_MANTENIMIENTO`, `JEFE_PLANTA`, `DOSIFICADOR`, `OPERADOR`, `AUXILIAR_COMPRAS`, `AREA_ADMINISTRATIVA`, `EJECUTIVO`, `VISUALIZADOR`, `ENCARGADO_ALMACEN`, `GERENTE_MANTENIMIENTO`, `COORDINADOR_MANTENIMIENTO`, `MECANICO`, `RECURSOS_HUMANOS`

`profiles.role` uses this enum in `types/supabase-types.ts` → `profiles.Row.role`.

## `LEGACY_DB_ROLES` (app constant)

**Source:** `lib/auth/role-model.ts` — `ORIGINAL_DB_ROLES` + `NEW_DB_ROLES` = `LEGACY_DB_ROLES`.

**ORIGINAL_DB_ROLES:** `GERENCIA_GENERAL`, `JEFE_UNIDAD_NEGOCIO`, `ENCARGADO_MANTENIMIENTO`, `AREA_ADMINISTRATIVA`, `JEFE_PLANTA`, `AUXILIAR_COMPRAS`, `DOSIFICADOR`, `OPERADOR`, `VISUALIZADOR`, `EJECUTIVO`, `ENCARGADO_ALMACEN`

**NEW_DB_ROLES:** `GERENTE_MANTENIMIENTO`, `COORDINADOR_MANTENIMIENTO`, `MECANICO`, `RECURSOS_HUMANOS`

## `FUTURE_BUSINESS_ROLES` (semantic / workflow)

**Source:** `lib/auth/role-model.ts`

`GERENCIA_GENERAL`, `GERENTE_MANTENIMIENTO`, `JEFE_UNIDAD_NEGOCIO`, `JEFE_PLANTA`, `COORDINADOR_MANTENIMIENTO`, `AREA_ADMINISTRATIVA`, `AUXILIAR_COMPRAS`, `ENCARGADO_ALMACEN`, `OPERADOR`, `MECANICO`, `VISUALIZADOR`, `EJECUTIVO`, `RECURSOS_HUMANOS`

Note: There is **no** separate `DOSIFICADOR` in `FUTURE_BUSINESS_ROLES`; see mapping below.

## `LEGACY_ROLE_TO_BUSINESS_ROLE`

**Source:** `lib/auth/role-model.ts` (verbatim mapping).

| `profile.role` (LegacyDbRole) | Maps to `FutureBusinessRole` |
|-------------------------------|------------------------------|
| GERENCIA_GENERAL | GERENCIA_GENERAL |
| JEFE_UNIDAD_NEGOCIO | JEFE_UNIDAD_NEGOCIO |
| ENCARGADO_MANTENIMIENTO | COORDINADOR_MANTENIMIENTO |
| AREA_ADMINISTRATIVA | AREA_ADMINISTRATIVA |
| JEFE_PLANTA | JEFE_PLANTA |
| AUXILIAR_COMPRAS | AUXILIAR_COMPRAS |
| DOSIFICADOR | OPERADOR |
| OPERADOR | OPERADOR |
| VISUALIZADOR | VISUALIZADOR |
| EJECUTIVO | EJECUTIVO |
| ENCARGADO_ALMACEN | ENCARGADO_ALMACEN |
| GERENTE_MANTENIMIENTO | GERENTE_MANTENIMIENTO |
| COORDINADOR_MANTENIMIENTO | COORDINADOR_MANTENIMIENTO |
| MECANICO | MECANICO |
| RECURSOS_HUMANOS | RECURSOS_HUMANOS |

**Comment in source:** *ENCARGADO_MANTENIMIENTO (deprecated enum) maps to COORDINADOR for workflow scope; permissions stay keyed by profile.role.*

## `ROLES_PINNED_TO_PROFILE_ROLE_FOR_PERMISSIONS`

**Source:** `lib/auth/role-model.ts` — `effectiveRoleForPermissions()` uses `profile.role` for:

- `JEFE_UNIDAD_NEGOCIO`
- `JEFE_PLANTA`
- `ENCARGADO_MANTENIMIENTO`
- `DOSIFICADOR`

All other legacy roles use `business_role || role` for permission checks per that function.

## Policy label → app role (engineering default)

This table links **POL-OPE-001 / POL-OPE-002** Spanish labels to **stored `profiles.role`** values. Where policy bundles two jobs (e.g. Dosificadores / Operadores), both DB roles are listed.

| Policy label (POL) | Typical `profiles.role` | `business_role` / resolved workflow | POL refs |
|--------------------|-------------------------|-------------------------------------|----------|
| Gerente General | GERENCIA_GENERAL | GERENCIA_GENERAL | POL001 Estructura; POL002 Roles |
| Gerente de Mantenimiento | GERENTE_MANTENIMIENTO | GERENTE_MANTENIMIENTO | POL001; POL002 |
| Coordinador de Mantenimiento / Coordinador de Mtto | COORDINADOR_MANTENIMIENTO or ENCARGADO_MANTENIMIENTO (deprecated) | COORDINADOR_MANTENIMIENTO when resolved | POL001; POL002 |
| Mecánicos / Auxiliares | MECANICO | MECANICO | POL001; POL002 (mecánico in flows) |
| Jefe de Unidad de Negocio | JEFE_UNIDAD_NEGOCIO | JEFE_UNIDAD_NEGOCIO | POL001; POL002 |
| Jefe de Planta | JEFE_PLANTA | JEFE_PLANTA | POL001; POL002 |

### Multi-plant Jefe de Planta (“Jefe de Plantas”)

**Same SOP row and `ModulePermissions` as a single-plant Jefe de Planta** (`JEFE_PLANTA` only — not `JEFE_UNIDAD_NEGOCIO`). **Scope** is the **union of plants** stored in `profile_managed_plants` plus the primary `profiles.plant_id` (see SQL helper `profile_scoped_plant_ids` and the `user_plants_expanded` view for the client). UI may show “Jefe de Planta” with two plants listed, or “Jefe de Plantas” when the user has more than one plant in scope; that is a product/HR copy choice, not a different DB role.
| Dosificadores / Operadores | DOSIFICADOR or OPERADOR | OPERADOR when resolved from either | POL001; POL002 |
| Administración | AREA_ADMINISTRATIVA | AREA_ADMINISTRATIVA | POL001; POL002 |
| Encargado de Almacén | ENCARGADO_ALMACEN | ENCARGADO_ALMACEN | POL002 |
| RRHH | RECURSOS_HUMANOS | RECURSOS_HUMANOS | POL001; POL002 |

## APP-ONLY roles (no dedicated row in POL role tables)

These exist in **DB enum** and **permission matrix** but are **not** named as rows in the POL-OPE-001 “Estructura del Departamento” table or POL-OPE-002 “Roles” table:

| `profiles.role` | Note |
|-----------------|------|
| AUXILIAR_COMPRAS | In `LEGACY_ROLE_PERMISSIONS` / modules; POL text refers to “Administración” and purchasing processes but not this exact title. |
| VISUALIZADOR | Read-oriented role in app. |
| EJECUTIVO | Described in `BUSINESS_ROLE_SCOPE` as legacy ejecutivo. |

Treat feature requirements for these as **product/contract** decisions aligned with stakeholders, not as direct POL row imports.

## Display names

**Source:** `LEGACY_ROLE_LABELS` and `FUTURE_ROLE_LABELS` in `lib/auth/role-model.ts` — used by `getRoleDisplayName()`.

## Workflow helpers (verified)

**Source:** `lib/auth/role-model.ts`

- `isTechnicalApproverRole` → `GERENTE_MANTENIMIENTO` only (comment: Nivel 1 OC).  
- `isViabilityReviewerRole` → `AREA_ADMINISTRATIVA`.  
- `isGMEscalatorRole` → `GERENCIA_GENERAL`.  
- `isRHOwnerRole` → `RECURSOS_HUMANOS`.
