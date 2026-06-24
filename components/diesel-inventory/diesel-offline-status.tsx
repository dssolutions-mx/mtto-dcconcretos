"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle,
  Loader2,
  Database
} from "lucide-react"
import { initOfflineClient, offlineClient } from "@/lib/offline/offline-client"
import { subscribeSyncStats } from "@/lib/offline/sync-bridge"
import { useConnectivity } from "@/lib/offline/use-connectivity"

export function DieselOfflineStatus() {
  const connectivity = useConnectivity()
  const isOnline = connectivity !== "offline"
  const [isSyncing, setIsSyncing] = useState(false)
  const [v2Pending, setV2Pending] = useState(0)

  const loadSyncStatus = async () => {
    try {
      await initOfflineClient()
      const stats = await offlineClient.getDomainSyncStats("diesel")
      setV2Pending(stats.pending + stats.failed)
    } catch (error) {
      console.error('Error loading diesel sync status:', error)
    }
  }

  useEffect(() => {
    void loadSyncStatus()

    void initOfflineClient()
    const unsubscribe = subscribeSyncStats(() => {
      void loadSyncStatus()
    })
    const interval = setInterval(() => void loadSyncStatus(), 10000)
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const handleManualSync = async () => {
    try {
      setIsSyncing(true)
      const entries = await offlineClient.listDieselOutboxEntries()
      for (const entry of entries.filter((e) => e.status === "dead_letter")) {
        await offlineClient.retryDieselOutboxEntry(entry.id)
      }
      await offlineClient.requestSync()
    } catch (error) {
      console.error('Error syncing diesel data:', error)
    } finally {
      setIsSyncing(false)
      void loadSyncStatus()
    }
  }

  const totalPending = v2Pending

  if (totalPending === 0) {
    return (
      <Badge variant={isOnline ? "outline" : "secondary"} className="gap-1">
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3 text-green-600" />
            <span className="text-green-600">En línea</span>
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
    <Alert className={isOnline ? "border-blue-200 bg-blue-50" : "border-orange-200 bg-orange-50"}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-blue-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-orange-600" />
            )}
            <span className="font-semibold text-sm">
              {isOnline ? 'Sincronizando' : 'Datos pendientes de sincronización'}
            </span>
            <Badge variant="secondary" className="text-xs">
              {totalPending} {totalPending === 1 ? 'elemento' : 'elementos'}
            </Badge>
          </div>

          <AlertDescription className="text-xs space-y-2">
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3" />
              <span>
                {totalPending} movimiento(s) de diesel pendiente(s)
              </span>
            </div>

            {isSyncing && (
              <div className="space-y-1 mt-2">
                <div className="flex items-center gap-2 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Sincronizando...</span>
                </div>
                <Progress value={undefined} className="h-1" />
              </div>
            )}

            {!isOnline && (
              <div className="flex items-center gap-1 text-orange-700 mt-2">
                <AlertTriangle className="h-3 w-3" />
                <span>Los datos se sincronizarán cuando recuperes la conexión</span>
              </div>
            )}
          </AlertDescription>
        </div>

        {isOnline && !isSyncing && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => void handleManualSync()}
            className="ml-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Sincronizar
          </Button>
        )}
      </div>
    </Alert>
  )
}
