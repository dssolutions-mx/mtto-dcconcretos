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
  CheckCircle, 
  AlertTriangle,
  Loader2,
  Database
} from "lucide-react"
import { getOfflineDieselService } from "@/lib/services/offline-diesel-service"

export function DieselOfflineStatus() {
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Load sync status
    loadSyncStatus()
    
    // Set up event listeners
    const service = getOfflineDieselService()
    
    const handleSyncStart = () => {
      setIsSyncing(true)
    }
    
    const handleSyncComplete = () => {
      setIsSyncing(false)
      loadSyncStatus()
    }
    
    const handleSyncError = () => {
      setIsSyncing(false)
      loadSyncStatus()
    }
    
    service.on('sync-start', handleSyncStart)
    service.on('sync-complete', handleSyncComplete)
    service.on('sync-error', handleSyncError)
    
    // Refresh status every 10 seconds
    const interval = setInterval(loadSyncStatus, 10000)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      service.off('sync-start', handleSyncStart)
      service.off('sync-complete', handleSyncComplete)
      service.off('sync-error', handleSyncError)
      clearInterval(interval)
    }
  }, [])

  const loadSyncStatus = async () => {
    try {
      const service = getOfflineDieselService()
      const status = await service.getSyncStatus()
      setSyncStatus(status)
    } catch (error) {
      console.error('Error loading diesel sync status:', error)
    }
  }

  const handleManualSync = async () => {
    try {
      setIsSyncing(true)
      const service = getOfflineDieselService()
      await service.syncAllPending()
    } catch (error) {
      console.error('Error syncing diesel data:', error)
    } finally {
      setIsSyncing(false)
      loadSyncStatus()
    }
  }

  if (!syncStatus || syncStatus.total === 0) {
    // No pending data - show simple online/offline status
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

  // Show detailed sync status when there's pending data
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
              {syncStatus.total} {syncStatus.total === 1 ? 'elemento' : 'elementos'}
            </Badge>
          </div>

          <AlertDescription className="text-xs space-y-2">
            {syncStatus.transactions.length > 0 && (
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3" />
                <span>
                  {syncStatus.transactions.length} {syncStatus.transactions.length === 1 ? 'transacción' : 'transacciones'}
                </span>
              </div>
            )}
            {syncStatus.photos.length > 0 && (
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3" />
                <span>
                  {syncStatus.photos.length} {syncStatus.photos.length === 1 ? 'foto' : 'fotos'}
                </span>
              </div>
            )}

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
            onClick={handleManualSync}
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

