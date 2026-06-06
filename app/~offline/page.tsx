"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { offlineChecklistService } from "@/lib/services/offline-checklist-service"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type CachedSchedule = {
  id: string
  asset?: { name?: string }
  template?: { name?: string }
}

export default function OfflineFallbackPage() {
  const [schedules, setSchedules] = useState<CachedSchedule[] | null>(null)

  useEffect(() => {
    offlineChecklistService
      .getCachedChecklistSchedules("pendiente")
      .then((cached) => setSchedules(cached ?? []))
      .catch(() => setSchedules([]))
  }, [])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Sin conexión</CardTitle>
          <CardDescription>
            No hay conexión a internet. Las páginas visitadas recientemente pueden seguir
            disponibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedules === null ? (
            <p className="text-sm text-muted-foreground">Buscando checklists guardados...</p>
          ) : schedules.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Checklists en caché ({schedules.length})</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                {schedules.slice(0, 10).map((schedule) => (
                  <li key={schedule.id}>
                    {schedule.asset?.name ?? schedule.template?.name ?? schedule.id}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay checklists en caché. Visite checklists con conexión para preparar el modo
              offline.
            </p>
          )}
          <Button asChild className="w-full">
            <Link href="/checklists">Ir a checklists</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
