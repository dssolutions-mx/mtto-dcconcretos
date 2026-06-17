import type { SupabaseClient } from "@supabase/supabase-js"
import type { SupplierPortalContext } from "./types"

export type SupplierPortalProfile = {
  email: string | null
  rfc: string
  status: string
  supplierName: string | null
  contactName: string | null
  contactPhone: string | null
  notificationEmail: string | null
  supplier: {
    businessName: string | null
    taxId: string | null
    address: string | null
    city: string | null
    state: string | null
    postalCode: string | null
    contactPerson: string | null
    phone: string | null
    email: string | null
    paymentTerms: string | null
  } | null
}

export type UpdatePortalProfileInput = {
  contactName?: string | null
  contactPhone?: string | null
  notificationEmail?: string | null
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function loadPortalProfile(
  supabase: SupabaseClient,
  userId: string,
  email: string | undefined,
  ctx: SupplierPortalContext
): Promise<SupplierPortalProfile> {
  const { data: membership } = await supabase
    .from("supplier_portal_users")
    .select("contact_name, contact_phone, notification_email, status, rfc")
    .eq("auth_user_id", userId)
    .maybeSingle()

  let supplier: SupplierPortalProfile["supplier"] = null
  if (ctx.mttoSupplierId) {
    const { data } = await supabase
      .from("suppliers")
      .select(
        "business_name, name, tax_id, address, city, state, postal_code, contact_person, phone, email, payment_terms"
      )
      .eq("id", ctx.mttoSupplierId)
      .maybeSingle()

    if (data) {
      supplier = {
        businessName: data.business_name || data.name || null,
        taxId: data.tax_id,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postal_code,
        contactPerson: data.contact_person,
        phone: data.phone,
        email: data.email,
        paymentTerms: data.payment_terms,
      }
    }
  }

  return {
    email: email ?? null,
    rfc: membership?.rfc ?? ctx.rfc,
    status: membership?.status ?? ctx.status,
    supplierName: ctx.supplierName,
    contactName: membership?.contact_name ?? null,
    contactPhone: membership?.contact_phone ?? null,
    notificationEmail: membership?.notification_email ?? null,
    supplier,
  }
}

export async function updatePortalProfile(
  supabase: SupabaseClient,
  userId: string,
  input: UpdatePortalProfileInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const notificationEmail = trimOrNull(input.notificationEmail)
  if (notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
    return { ok: false, message: "El correo de notificaciones no es válido." }
  }

  const { error } = await supabase
    .from("supplier_portal_users")
    .update({
      contact_name: trimOrNull(input.contactName),
      contact_phone: trimOrNull(input.contactPhone),
      notification_email: notificationEmail,
    })
    .eq("auth_user_id", userId)

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
}
