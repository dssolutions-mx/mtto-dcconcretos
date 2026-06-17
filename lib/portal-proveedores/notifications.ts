import type { SupabaseClient } from "@supabase/supabase-js"

export type PortalNotificationType =
  | "portal_invoice_received"
  | "portal_invoice_approved"
  | "portal_invoice_paid"
  | "portal_invoice_partial_payment"
  | "portal_invoice_void"
  | "portal_payment_received"

export type PortalNotificationRow = {
  id: string
  user_id: string | null
  title: string
  message: string
  type: string
  related_entity: string | null
  entity_id: string | null
  status: string | null
  priority: string | null
  read_at: string | null
  created_at: string | null
}

type CreatePortalNotificationInput = {
  userId: string
  title: string
  message: string
  type: PortalNotificationType
  relatedEntity?: string
  entityId?: string
  priority?: "low" | "medium" | "high"
}

export async function createPortalNotification(
  supabase: SupabaseClient,
  input: CreatePortalNotificationInput
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    title: input.title,
    message: input.message,
    type: input.type,
    related_entity: input.relatedEntity ?? null,
    entity_id: input.entityId ?? null,
    status: "unread",
    priority: input.priority ?? "medium",
  })

  if (error) {
    console.error("createPortalNotification", error)
  }
}

export async function listPortalNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<PortalNotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, user_id, title, message, type, related_entity, entity_id, status, priority, read_at, created_at"
    )
    .eq("user_id", userId)
    .like("type", "portal_%")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PortalNotificationRow[]
}

export async function countUnreadPortalNotifications(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .like("type", "portal_%")
    .eq("status", "unread")

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function markPortalNotificationRead(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      status: "read",
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .like("type", "portal_%")
    .select("id")

  if (error) {
    throw new Error(error.message)
  }

  return (data?.length ?? 0) > 0
}
