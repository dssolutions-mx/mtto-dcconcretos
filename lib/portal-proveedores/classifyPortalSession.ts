import type { SupabaseClient } from "@supabase/supabase-js"

export type PortalSessionClassification = {
  hasStaffProfile: boolean
  hasPortalMembership: boolean
  portalStatus: "pending" | "active" | "suspended" | null
}

/** Classifies an authenticated user as staff, portal supplier, or both. */
export async function classifyPortalSession(
  supabase: SupabaseClient,
  userId: string
): Promise<PortalSessionClassification> {
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("id").eq("id", userId).maybeSingle(),
    supabase
      .from("supplier_portal_users")
      .select("status")
      .eq("auth_user_id", userId)
      .maybeSingle(),
  ])

  const portalStatus = membership?.status as PortalSessionClassification["portalStatus"] | undefined

  return {
    hasStaffProfile: Boolean(profile?.id),
    hasPortalMembership: Boolean(membership),
    portalStatus: portalStatus ?? null,
  }
}
