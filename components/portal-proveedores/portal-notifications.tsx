"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { PortalNotificationRow } from "@/lib/portal-proveedores/notifications"

function formatWhen(iso: string | null): string {
  if (!iso) return ""
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function PortalNotifications() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<PortalNotificationRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/portal-proveedores/notifications")
      if (!res.ok) return
      const data = (await res.json()) as {
        notifications: PortalNotificationRow[]
        unread_count: number
      }
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unread_count ?? 0)
    } catch (error) {
      console.error("PortalNotifications", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
    const interval = window.setInterval(() => {
      void loadNotifications()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [loadNotifications])

  async function markRead(notificationId: string) {
    try {
      const res = await fetch("/api/portal-proveedores/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: notificationId }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { unread_count: number }
      setUnreadCount(data.unread_count ?? 0)
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, status: "read", read_at: new Date().toISOString() }
            : n
        )
      )
    } catch (error) {
      console.error("markRead", error)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notificaciones, ${unreadCount} sin leer`
              : "Notificaciones"
          }
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 ? (
            <Badge
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Cargando…</p>
        ) : notifications.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No tiene notificaciones por ahora.
          </p>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex cursor-default flex-col items-start gap-1 whitespace-normal py-2"
              onSelect={(event) => {
                event.preventDefault()
                if (notification.status === "unread") {
                  void markRead(notification.id)
                }
              }}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="font-medium leading-snug">{notification.title}</span>
                {notification.status === "unread" ? (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">{notification.message}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatWhen(notification.created_at)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
