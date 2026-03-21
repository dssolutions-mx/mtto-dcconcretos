# Deep Dive: Role Model & Encargado → Coordinador Transition

> **Actualización (app):** `ENCARGADO_MANTENIMIENTO` está en `LEGACY_DB_ROLES` y en `lib/auth/role-permissions.ts` con permisos alineados a Coordinador hasta migración de filas; la etiqueta de UI indica “(deprecado)”.

**Date:** 2026-03-10  
**Scope:** DB and app alignment after Encargado de Mantenimiento → Coordinador de Mantenimiento rename

---

## 1. Role Model (`lib/auth/role-model.ts`) — Purpose and Function

The `role-model.ts` file is the **central role taxonomy and mapping layer** for the application. It was added per POL-OPE-001/002 to support the transition from legacy DB roles to a cleaner business-role model.

### Main Responsibilities

| Function | Purpose |
|----------|---------|
| **LEGACY_DB_ROLES** | All valid values for `profiles.role` (DB enum `user_role`) |
| **FUTURE_BUSINESS_ROLES** | Canonical business roles (target model) |
| **LEGACY_ROLE_TO_BUSINESS_ROLE** | Maps legacy DB roles to semantic business roles |
| **FUTURE_ROLE_TO_LEGACY_ROLE** | Maps business roles back to DB enum for persistence |
| **BUSINESS_ROLE_SCOPE** | Scope per business role: `global`, `business_unit`, `plant` |
| **resolveBusinessRole()** | Given any role string, returns the effective business role |
| **normalizeRoleForPersistence()** | Ensures correct `role` + `business_role` when saving |

### Encargado → Coordinador Design

- **ENCARGADO_MANTENIMIENTO** and **JEFE_PLANTA** both map to **COORDINADOR_MANTENIMIENTO**.
- **COORDINADOR_MANTENIMIENTO** is the new DB enum value; Encargado was deprecated/renamed.
- New users should be assigned `COORDINADOR_MANTENIMIENTO`; the app treats Encargado as legacy for backward compatibility.

---

## 2. Current Database State

### `user_role` enum

Both legacy and new roles exist in the enum:

```
AREA_ADMINISTRATIVA, AUXILIAR_COMPRAS, COORDINADOR_MANTENIMIENTO, DOSIFICADOR,
EJECUTIVO, ENCARGADO_ALMACEN, ENCARGADO_MANTENIMIENTO, GERENCIA_GENERAL,
GERENTE_MANTENIMIENTO, JEFE_PLANTA, JEFE_UNIDAD_NEGOCIO, MECANICO, OPERADOR,
RECURSOS_HUMANOS, VISUALIZADOR
```

### Profile Distribution (mantenimiento project)

| role | count |
|------|-------|
| JEFE_PLANTA | 4 |
| COORDINADOR_MANTENIMIENTO | 2 |
| ENCARGADO_MANTENIMIENTO | 0 |

No profiles currently have `ENCARGADO_MANTENIMIENTO`. All "coordinador-level" users are either `COORDINADOR_MANTENIMIENTO` or `JEFE_PLANTA`.

### RLS Policies

- **Diesel tables** (20260310): Use `COORDINADOR_MANTENIMIENTO`; `ENCARGADO_MANTENIMIENTO` removed.
- **profiles** ("Profiles hierarchical administration"): Still references `ENCARGADO_MANTENIMIENTO` in some branches; may need `COORDINADOR_MANTENIMIENTO` added.
- Other tables (checklists, inventory, etc.): Most include both ENCARGADO and COORDINADOR for compatibility.

---

## 3. Application Gaps and Inconsistencies

### 3.1 Role Guards (`components/auth/role-guard.tsx`)

| Guard | Issue |
|-------|--------|
| **MaintenanceManagerGuard** | Only allows `profile.role === 'ENCARGADO_MANTENIMIENTO'` — **blocks COORDINADOR_MANTENIMIENTO** |
| **PlantManagerGuard** | Only allows `JEFE_PLANTA` — does not include COORDINADOR |
| **MaintenanceTeamGuard** | Includes both ENCARGADO and COORDINADOR |
| **PurchasingTeamGuard** | Includes both ENCARGADO and COORDINADOR |

**Recommendation:**  
- `MaintenanceManagerGuard` should allow `COORDINADOR_MANTENIMIENTO` (and optionally keep `ENCARGADO_MANTENIMIENTO` for legacy).  
- Consider whether `PlantManagerGuard` should treat `COORDINADOR_MANTENIMIENTO` with plant scope as equivalent to JEFE_PLANTA for that plant.

### 3.2 Dashboard Cards (`app/(dashboard)/dashboard/page.tsx`)

- **ENCARGADO_MANTENIMIENTO** card: "Panel de Mantenimiento" — shown only when `profile?.role === 'ENCARGADO_MANTENIMIENTO'`
- **JEFE_PLANTA** card: "Panel de Jefe de Planta" — shown only when `profile?.role === 'JEFE_PLANTA'`
- **COORDINADOR_MANTENIMIENTO** has no dedicated card.

Users with `COORDINADOR_MANTENIMIENTO` see neither card, even though they are equivalent to Encargado in the business model.

**Recommendation:** Add a COORDINADOR card or fold COORDINADOR into the ENCARGADO card condition, e.g.:

```tsx
{['ENCARGADO_MANTENIMIENTO', 'COORDINADOR_MANTENIMIENTO'].includes(profile?.role || '') && (
```

### 3.3 Role Selection UIs

| Location | Current state |
|----------|---------------|
| `create-operator-dialog.tsx` | Offers both ENCARGADO_MANTENIMIENTO ("Coordinador Mant. (Legacy)") and COORDINADOR_MANTENIMIENTO |
| `user-registration-tool.tsx` | Offers ENCARGADO_MANTENIMIENTO as "Coordinador de Mantenimiento" |
| `auth-form.tsx` | Has COORDINADOR_MANTENIMIENTO and JEFE_PLANTA; no ENCARGADO |
| `personnel-management-page.tsx` | Filter includes "Encargados Mant. (Legacy)" |
| `credentials/employee-credentials-manager.tsx` | Has JEFE_PLANTA and COORDINADOR; no ENCARGADO |

**Recommendation:**  
- Standardize on `COORDINADOR_MANTENIMIENTO` for new users.  
- Hide or clearly deprecate `ENCARGADO_MANTENIMIENTO` in creation UIs.  
- Keep Encargado in filters/labels where needed for existing legacy profiles.

### 3.4 API Allowlists

Several API routes still use `ENCARGADO_MANTENIMIENTO` in allowlists; most also include `COORDINADOR_MANTENIMIENTO`:

- `app/api/assets/[id]/plant-assignment/route.ts` — has ENCARGADO but not COORDINADOR
- `app/api/plants/[id]/route.ts`, `app/api/plants/route.ts` — use JEFE_PLANTA, no COORDINADOR
- `app/api/compliance/incidents/[id]/dispute/route.ts` — JEFE_PLANTA, no COORDINADOR
- Others (checklists, auth/register, etc.) — generally include both

**Recommendation:** Add `COORDINADOR_MANTENIMIENTO` to any allowlist that includes `ENCARGADO_MANTENIMIENTO` or `JEFE_PLANTA`, to ensure parity.

### 3.5 Warehouse Responsibility (`lib/auth/warehouse-responsibility.ts`)

- **ENCARGADO_MANTENIMIENTO**: `canReleaseInventory`, `canReceiveInventory` = true; `canAdjustInventory` = false
- **COORDINADOR_MANTENIMIENTO**: all three = false
- **JEFE_PLANTA**: `canReleaseInventory`, `canReceiveInventory` = true; `canAdjustInventory` = false

Per POL-OPE-002, Coordinador is intended to create POs but not have warehouse operational duties. If the desired behavior is for Coordinador to match Encargado/Jefe Planta for warehouse, update `COORDINADOR_MANTENIMIENTO` to match; otherwise keep as-is and document the policy.

---

## 4. Permission Alignment (role-permissions.ts)

COORDINADOR_MANTENIMIENTO correctly inherits from ENCARGADO_MANTENIMIENTO:

```ts
COORDINADOR_MANTENIMIENTO: {
  permissions: LEGACY_ROLE_PERMISSIONS.ENCARGADO_MANTENIMIENTO.permissions,
  authorizationLimit: LEGACY_ROLE_PERMISSIONS.ENCARGADO_MANTENIMIENTO.authorizationLimit,
  scope: 'plant',
}
```

- purchases: `read_write`
- inventory: `read_write`
- maintenance: `full`
- work_orders: `full`
- authorizationLimit: $0 (Gerente aprueba)

This aligns with the described process and policies.

---

## 5. Migration 20260306 — business_role Backfill

```sql
when role in ('ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA') then 'COORDINADOR_MANTENIMIENTO'
```

- Sets `business_role = 'COORDINADOR_MANTENIMIENTO'` for ENCARGADO and JEFE_PLANTA.
- Does not explicitly handle `role = 'COORDINADOR_MANTENIMIENTO'`; it falls through to `else business_role`.

For profiles already created with `COORDINADOR_MANTENIMIENTO`, `business_role` may remain NULL if not set elsewhere. A small backfill would ensure consistency:

```sql
UPDATE profiles SET business_role = 'COORDINADOR_MANTENIMIENTO', role_scope = 'plant'
WHERE role = 'COORDINADOR_MANTENIMIENTO' AND (business_role IS NULL OR business_role != 'COORDINADOR_MANTENIMIENTO');
```

---

## 6. Summary of Recommended Changes

### High Priority

1. **role-guard.tsx**
   - `MaintenanceManagerGuard`: Allow `COORDINADOR_MANTENIMIENTO` (and optionally keep ENCARGADO for legacy).

2. **dashboard/page.tsx**
   - Show the maintenance panel for both `ENCARGADO_MANTENIMIENTO` and `COORDINADOR_MANTENIMIENTO`.

3. **API allowlists**
   - Add `COORDINADOR_MANTENIMIENTO` wherever `ENCARGADO_MANTENIMIENTO` or `JEFE_PLANTA` is used for maintenance/plant/compliance access.

### Medium Priority

4. **business_role backfill**
   - Migration for `role = 'COORDINADOR_MANTENIMIENTO'` to set `business_role` and `role_scope`.

5. **RLS — profiles**
   - Review "Profiles hierarchical administration" and ensure `COORDINADOR_MANTENIMIENTO` has equivalent access to ENCARGADO.

6. **Role selection UIs**
   - Prefer `COORDINADOR_MANTENIMIENTO`; deprecate or hide `ENCARGADO_MANTENIMIENTO` in creation flows.

### Policy / Design Decision

7. **warehouse-responsibility.ts**
   - Confirm whether COORDINADOR should have release/receive inventory permissions like Encargado/Jefe Planta, or remain restricted per current design.

---

## 7. Role Resolution Flow

```
profile.role (DB)
    ↓
resolveBusinessRole() / LEGACY_ROLE_TO_BUSINESS_ROLE
    ↓
ENCARGADO_MANTENIMIENTO  →  COORDINADOR_MANTENIMIENTO
JEFE_PLANTA              →  COORDINADOR_MANTENIMIENTO
COORDINADOR_MANTENIMIENTO →  COORDINADOR_MANTENIMIENTO
    ↓
permissionRoleKey = profile.business_role || profile.role
    ↓
hasModuleAccess(permissionRoleKey, 'purchases') etc.
    ↓
ROLE_PERMISSIONS[COORDINADOR_MANTENIMIENTO].permissions
```

The app uses `business_role` when present; otherwise it falls back to `role`. Both ENCARGADO and COORDINADOR resolve to the same business role, so permission logic is already unified. The remaining issues are mainly guards, UI cards, and API allowlists still checking only the raw `role` value.
