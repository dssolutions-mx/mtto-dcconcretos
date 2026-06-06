"use client"

import { useEffect, useState } from "react"
import { getOfflineExecutionUrl, offlineClient } from "@/lib/offline/offline-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function OfflineFallbackPage() {
  const [schedules, setSchedules] = useState<Array<{ id: string; label: string }> | null>(null)

  useEffect(() => {
    offlineClient
      .getAvailableOfflineChecklists()
      .then((items) =>
        setSchedules(
          items.map((item) => {
            const t = item.template as {
              checklists?: { name?: string }
            }
            const a = item.asset as { name?: string } | null
            return {
              id: item.id,
              label: a?.name ?? t?.checklists?.name ?? item.id,
            }
          })
        )
      )
      .catch(() => setSchedules([]))
  }, [])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Sin conexión</CardTitle>
          <CardDescription>
            Esta página no está en caché. Si descargó checklists, puede abrirlos desde el listado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedules === null ? (
            <p className="text-sm text-muted-foreground">Buscando checklists guardados…</p>
          ) : schedules.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Checklists descargados ({schedules.length})</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {schedules.slice(0, 10).map((schedule) => (
                  <li key={schedule.id}>
                    <a
                      href={getOfflineExecutionUrl(schedule.id)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {schedule.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay checklists descargados. Con conexión, use «Preparar offline» en checklists.
            </p>
          )}
          <Button asChild className="w-full min-h-[44px]">
            <a href="/checklists">Ir a checklists</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
