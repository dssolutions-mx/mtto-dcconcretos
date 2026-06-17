export type SupplierPortalMembershipStatus = "pending" | "active" | "suspended"

export type SupplierPortalMembershipRow = {
  id: string
  auth_user_id: string
  rfc: string
  mtto_supplier_id: string | null
  cotizador_group_id: string | null
  status: SupplierPortalMembershipStatus
  invited_by: string | null
  invited_at: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export type SupplierPortalContext = {
  membershipId: string
  rfc: string
  status: SupplierPortalMembershipStatus
  mttoSupplierId: string | null
  cotizadorGroupId: string | null
  supplierName: string | null
}

export type ResolveSupplierPortalFailure = { ok: false; status: number; message: string }
export type ResolveSupplierPortalSuccess = { ok: true; ctx: SupplierPortalContext }
export type ResolveSupplierPortalResult =
  | ResolveSupplierPortalSuccess
  | ResolveSupplierPortalFailure
