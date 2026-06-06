"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Cloud,
  CloudOff,
} from "lucide-react"
import { initOfflineClient, offlineClient } from "@/lib/offline/offline-client"
import { subscribeSyncStats } from "@/lib/offline/sync-bridge"
import { useConnectivity } from "@/lib/offline/use-connectivity"
import type { SyncStats } from "@/lib/offline/types"

interface UnifiedOfflineStatusProps {
  className?: string
  showDetails?: boolean
  onSyncComplete?: () => void
}

export function UnifiedOfflineStatus({
  className = "",
  showDetails = true,
  onSyncComplete,
}: UnifiedOfflineStatusProps) {
  const connectivity = useConnectivity()
  const [stats, setStats] = useState<SyncStats>({ pending: 0, failed: 0, inFlight: 0 })
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    void initOfflineClient()
    return subscribeSyncStats((nextStats) => {
      setStats(nextStats)
      if (nextStats.inFlight === 0 && nextStats.pending === 0) {
        setIsSyncing(false)
      }
    })
  }, [])

  const isOnline = connectivity !== "offline"
  const isDegraded = connectivity === "degraded"
  const hasPending = stats.pending > 0 || stats.failed > 0

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await offlineClient.requestSync()
      onSyncComplete?.()
    } finally {
      setIsSyncing(false)
    }
  }

  if (!showDetails) {
    return (
      <Badge variant={isOnline ? "outline" : "secondary"} className="gap-1">
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3 text-green-600" />
            <span className="text-green-600">{isDegraded ? "Conexión lenta" : "En línea"}</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-orange-600" />
            <span className="text-orange-600">Sin conexión</span>
          </>
        )}
      </Badge>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Cloud className={`h-4 w-4 ${isDegraded ? "text-amber-600" : "text-green-600"}`} />
            ) : (
              <CloudOff className="h-4 w-4 text-orange-600" />
            )}
            <span className="text-sm font-medium">
              {isOnline
                ? isDegraded
                  ? "Conexión lenta — cambios guardados localmente"
                  : "En línea"
                : "Sin conexión — modo offline"}
            </span>
          </div>
          {hasPending && (
            <Badge variant="secondary">
              {stats.pending + stats.failed} pendiente{stats.pending + stats.failed === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        {hasPending && (
          <Alert className={isOnline ? "border-blue-200 bg-blue-50" : "border-orange-200 bg-orange-50"}>
            <AlertDescription className="text-xs space-y-2">
              {stats.pending > 0 && <div>{stats.pending} cambio(s) esperando sincronización</div>}
              {stats.failed > 0 && (
                <div className="flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.failed} con error de sincronización
                </div>
              )}
              {!isOnline && (
                <div className="text-orange-700">
                  Los datos se sincronizarán cuando recuperes la conexión
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {isSyncing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sincronizando...
          </div>
        )}

        {isOnline && hasPending && !isSyncing && (
          <Button variant="outline" size="sm" onClick={() => void handleSync()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Sincronizar ahora
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
