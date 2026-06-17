import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import {
  countUnreadPortalNotifications,
  listPortalNotifications,
  markPortalNotificationRead,
} from "@/lib/portal-proveedores/notifications"
import { requirePortalSession } from "@/lib/portal-proveedores/requirePortalSession"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ error: session.message }, { status: session.status })
    }

    const admin = createAdminClient()
    const [notifications, unreadCount] = await Promise.all([
      listPortalNotifications(admin, session.userId),
      countUnreadPortalNotifications(admin, session.userId),
    ])

    return NextResponse.json({ notifications, unread_count: unreadCount })
  } catch (error) {
    console.error("GET /api/portal-proveedores/notifications", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ error: session.message }, { status: session.status })
    }

    const body = (await request.json()) as { notification_id?: string }
    const notificationId = body.notification_id?.trim()
    if (!notificationId) {
      return NextResponse.json(
        { error: "notification_id es requerido" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const updated = await markPortalNotificationRead(
      admin,
      session.userId,
      notificationId
    )

    if (!updated) {
      return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 })
    }

    const unreadCount = await countUnreadPortalNotifications(admin, session.userId)
    return NextResponse.json({ success: true, unread_count: unreadCount })
  } catch (error) {
    console.error("PATCH /api/portal-proveedores/notifications", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
