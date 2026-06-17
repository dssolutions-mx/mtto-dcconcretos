import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  ResolveSupplierPortalResult,
  SupplierPortalMembershipRow,
} from "./types"

async function loadSupplierName(
  supabase: SupabaseClient,
  supplierId: string | null
): Promise<string | null> {
  if (!supplierId) return null
  const { data } = await supabase
    .from("suppliers")
    .select("name, business_name")
    .eq("id", supplierId)
    .maybeSingle()
  if (!data) return null
  return data.business_name || data.name || null
}

export async function resolvePortalContext(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolveSupplierPortalResult> {
  const { data, error } = await supabase
    .from("supplier_portal_users")
    .select(
      "id, auth_user_id, rfc, mtto_supplier_id, cotizador_group_id, status, invited_by, invited_at, accepted_at, created_at, updated_at"
    )
    .eq("auth_user_id", userId)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, message: error.message }
  }

  const row = data as unknown as SupplierPortalMembershipRow | null
  if (!row) {
    return {
      ok: false,
      status: 403,
      message: "No tiene acceso al portal de proveedores.",
    }
  }

  if (row.status === "suspended") {
    return {
      ok: false,
      status: 403,
      message: "Su acceso al portal fue suspendido. Contacte a compras.",
    }
  }

  if (row.status !== "active") {
    return {
      ok: false,
      status: 403,
      message:
        row.status === "pending"
          ? "Su cuenta del portal está pendiente de activación. Contacte a compras."
          : "Su cuenta del portal no está activa.",
    }
  }

  const supplierName = await loadSupplierName(supabase, row.mtto_supplier_id)

  return {
    ok: true,
    ctx: {
      membershipId: row.id,
      rfc: row.rfc,
      status: row.status,
      mttoSupplierId: row.mtto_supplier_id,
      cotizadorGroupId: row.cotizador_group_id,
      supplierName,
    },
  }
}
