/**
 * Padrón de proveedores — who may create/edit/verify supplier rows.
 * Must stay aligned with RLS in supabase/migrations/*suppliers_padron_governance.sql
 */

import type { Database } from "@/types/supabase-types"

export type UserRole = Database["public"]["Enums"]["user_role"] | string | null | undefined

/** Gerencia, Gerente Mtto, Administración, Coordinador, Encargado — full padrón (any BU) */
const NON_JEFE_PADRON_ROLES: ReadonlySet<string> = new Set([
  "GERENCIA_GENERAL",
  "GERENTE_MANTENIMIENTO",
  "AREA_ADMINISTRATIVA",
  "COORDINADOR_MANTENIMIENTO",
  "ENCARGADO_MANTENIMIENTO",
])

export function isNonJefePadronEditorRole(role: UserRole): boolean {
  if (!role) return false
  return NON_JEFE_PADRON_ROLES.has(role)
}

/**
 * Jefe de UN: may read full padrón; may write a supplier that belongs to their BU, is global, or in junction.
 */
export function jefeMayWriteSupplier(
  role: UserRole,
  jefeBusinessUnitId: string | null | undefined,
  supplier: {
    business_unit_id?: string | null
    serves_all_business_units?: boolean | null
  },
  junctionBusinessUnitIds: string[]
): boolean {
  if (role !== "JEFE_UNIDAD_NEGOCIO" || !jefeBusinessUnitId) return false
  if (supplier.serves_all_business_units) return true
  if (supplier.business_unit_id && supplier.business_unit_id === jefeBusinessUnitId) return true
  return junctionBusinessUnitIds.includes(jefeBusinessUnitId)
}

/**
 * Jefe: may create a new supplier for their own BU, or a company-wide row (serves_all = true when allowed).
 */
export function jefeMayCreateSupplier(
  role: UserRole,
  jefeBusinessUnitId: string | null | undefined,
  input: { business_unit_id?: string | null; serves_all_business_units?: boolean | null }
): boolean {
  if (role !== "JEFE_UNIDAD_NEGOCIO" || !jefeBusinessUnitId) return false
  if (input.serves_all_business_units) return true
  return !!input.business_unit_id && input.business_unit_id === jefeBusinessUnitId
}

/**
 * Can write an existing supplier (mirrors public.supplier_may_write in DB).
 */
export function canWriteSupplier(
  userId: string,
  userRole: UserRole,
  userBusinessUnitId: string | null | undefined,
  supplier: {
    id: string
    created_by: string | null
    business_unit_id?: string | null
    serves_all_business_units?: boolean | null
  },
  junctionBusinessUnitIds: string[] = []
): boolean {
  if (supplier.created_by && supplier.created_by === userId) return true
  if (isNonJefePadronEditorRole(userRole)) return true
  if (
    jefeMayWriteSupplier(userRole, userBusinessUnitId, supplier, junctionBusinessUnitIds)
  ) {
    return true
  }
  return false
}

/**
 * Can create a supplier (mirrors public.supplier_insert_allowed).
 */
export function canCreateSupplier(
  userRole: UserRole,
  userBusinessUnitId: string | null | undefined,
  input: { business_unit_id?: string | null; serves_all_business_units?: boolean | null }
): boolean {
  if (isNonJefePadronEditorRole(userRole)) return true
  return jefeMayCreateSupplier(userRole, userBusinessUnitId, input)
}

/**
 * Jefe: may only add/remove the junction row for their own BU. Non-jefe: any BU. (mirrors jefe_may_write_supplier_bu)
 */
export function canWriteBusinessUnitJunction(
  userRole: UserRole,
  userBusinessUnitId: string | null | undefined,
  supplier: {
    business_unit_id?: string | null
    serves_all_business_units?: boolean | null
  },
  junctionSoFar: string[],
  buIdToWrite: string
): boolean {
  if (isNonJefePadronEditorRole(userRole)) return true
  if (userRole !== "JEFE_UNIDAD_NEGOCIO" || !userBusinessUnitId) return false
  if (!jefeMayWriteSupplier(userRole, userBusinessUnitId, supplier, junctionSoFar)) {
    return false
  }
  return buIdToWrite === userBusinessUnitId
}

/** Puede ver padrón completo (/suppliers) y panel de verificación. */
export function isSupplierPadronViewer(role: UserRole): boolean {
  return isNonJefePadronEditorRole(role) || role === "JEFE_UNIDAD_NEGOCIO"
}
