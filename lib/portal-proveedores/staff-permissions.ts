import type { Database } from "@/types/supabase-types"
import { isNonJefePadronEditorRole } from "@/lib/auth/supplier-padron-permissions"

export type StaffRole = Database["public"]["Enums"]["user_role"] | string | null | undefined

const PROCUREMENT_INVITE_ROLES = new Set(["AUXILIAR_COMPRAS"])

/** Staff que puede invitar proveedores al portal (API staff-only). */
export function canInviteSupplierPortal(role: StaffRole): boolean {
  if (!role) return false
  if (isNonJefePadronEditorRole(role)) return true
  if (PROCUREMENT_INVITE_ROLES.has(role)) return true
  return role === "JEFE_UNIDAD_NEGOCIO"
}
