"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Clock, WifiOff, CheckCircle } from "lucide-react"
import { offlineClient } from "@/lib/offline/offline-client"

interface OfflineChecklistItem {
  id: string
  template: {
    id?: string
    status?: string
    scheduled_date?: string
    scheduled_day?: string
    checklists?: {
      name?: string
      frequency?: string
    }
  }
  asset: {
    name?: string
    asset_id?: string
    location?: string
    plants?: { name?: string }
  } | null
  lastUpdated: number
  isRecent: boolean
}

interface OfflineChecklistListProps {
  className?: string
}

export function OfflineChecklistList({ className = "" }: OfflineChecklistListProps) {
  const [availableChecklists, setAvailableChecklists] = useState<OfflineChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadAvailableChecklists = useCallback(async () => {
    try {
      setLoading(true)
      const available = await offlineClient.getAvailableOfflineChecklists()
      setAvailableChecklists(available as OfflineChecklistItem[])
    } catch (error) {
      console.error("Error loading available offline checklists:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAvailableChecklists()
  }, [loadAvailableChecklists])

  const openChecklist = (scheduleId: string) => {
    // Full document navigation so the service worker serves cached HTML (client Link needs RSC cache).
    window.location.assign(`/checklists/ejecutar/${scheduleId}`)
  }

  const formatLastUpdate = (timestamp: number) => {
    const diffHours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60))
    if (diffHours < 1) return "Hace menos de 1 hora"
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`
    const diffDays = Math.floor(diffHours / 24)
    return `Hace ${diffDays} día${diffDays > 1 ? "s" : ""}`
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5" />
            Checklists disponibles offline
          </CardTitle>
          <CardDescription>Cargando checklists descargados…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (availableChecklists.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5" />
            Checklists disponibles offline
          </CardTitle>
          <CardDescription>No hay checklists descargados para usar sin conexión</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium mb-2">Sin checklists offline</p>
            <p className="text-sm text-muted-foreground mb-4">
              Cuando vuelva la conexión, use &quot;Preparar offline&quot; en esta página antes de
              salir a una zona sin señal.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WifiOff className="h-5 w-5" />
          Checklists disponibles offline
          <Badge variant="secondary">{availableChecklists.length}</Badge>
        </CardTitle>
        <CardDescription>Seleccione un checklist para ejecutarlo sin conexión</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {availableChecklists.map((item) => {
            const checklist = item.template
            const asset = item.asset

            return (
              <Card
                key={item.id}
                className="border-blue-200 cursor-pointer hover:bg-muted/50 transition-colors"
                role="button"
                tabIndex={0}
                onClick={() => openChecklist(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    openChecklist(item.id)
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="font-semibold truncate">
                          {checklist.checklists?.name || "Checklist sin nombre"}
                        </h4>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {checklist.checklists?.frequency || "N/A"}
                        </Badge>
                        {item.isRecent && (
                          <Badge variant="default" className="text-xs bg-green-600 shrink-0">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Reciente
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 mb-3">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          {asset?.name || "Sin activo asignado"}
                        </p>
                        {asset?.asset_id && (
                          <p className="text-xs text-muted-foreground">
                            ID: {asset.asset_id}
                            {(asset.plants?.name || asset.location) &&
                              ` • ${asset.plants?.name || asset.location}`}
                          </p>
                        )}
                        {checklist.scheduled_date && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Programado:{" "}
                            {new Date(
                              checklist.scheduled_day || checklist.scheduled_date
                            ).toLocaleDateString("es")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Descargado: {formatLastUpdate(item.lastUpdated)}</span>
                        {!item.isRecent && (
                          <Badge variant="outline" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Datos antiguos
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button size="sm" className="shrink-0 min-h-[44px]" type="button">
                      Ejecutar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
