"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Loader2, 
  Check, 
  AlertTriangle,
  Cloud,
  CloudOff,
  Smartphone
} from "lucide-react"
import { useOfflineSync } from "@/hooks/useOfflineSync"

interface OfflineStatusProps {
  className?: string
  showDetails?: boolean
  onSyncComplete?: () => void
}

export function OfflineStatus({ className = "", showDetails = true, onSyncComplete }: OfflineStatusProps) {
  const { 
    isOnline, 
    isSyncing, 
    syncStats, 
    lastSyncTime, 
    sync, 
    hasPendingSyncs,
    isLoading 
  } = useOfflineSync()

  const handleSync = async () => {
    await sync()
    onSyncComplete?.()
  }

  const formatLastSync = () => {
    if (!lastSyncTime) return "Nunca"
    
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - lastSyncTime.getTime()) / 60000)
    
    if (diffMinutes < 1) return "Hace un momento"
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `Hace ${diffHours}h`
    
    return lastSyncTime.toLocaleDateString()
  }

  // Mostrar loading inicial
  if (isLoading) {
    return showDetails ? (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Inicializando servicio offline...</span>
          </div>
        </CardContent>
      </Card>
    ) : (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  // Versión compacta para móviles
  const CompactStatus = () => (
    <div className="flex items-center gap-2">
      {isOnline ? (
        <div className="flex items-center gap-1">
          <Cloud className="h-4 w-4 text-green-600" />
          <span className="text-xs text-green-600 font-medium hidden sm:inline">Online</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <CloudOff className="h-4 w-4 text-orange-600" />
          <span className="text-xs text-orange-600 font-medium hidden sm:inline">Offline</span>
        </div>
      )}
      
      {hasPendingSyncs && (
        <Badge variant="outline" className="text-xs px-1 py-0">
          {syncStats.pending}
        </Badge>
      )}
      
      {hasPendingSyncs && isOnline && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSync}
          disabled={isSyncing}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  )

  // Versión detallada para desktop
  const DetailedStatus = () => (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Estado de conexión */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <div className="flex items-center gap-1">
                    <Wifi className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-600">Conectado</span>
                  </div>
                  <div className="hidden sm:block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <WifiOff className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-600">Sin conexión</span>
                  </div>
                  <div className="hidden sm:block w-2 h-2 bg-orange-500 rounded-full" />
                </>
              )}
            </div>
            
            {/* Badges de estado */}
            <div className="flex flex-wrap gap-1">
              {syncStats.pending > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Smartphone className="h-3 w-3 mr-1" />
                  {syncStats.pending} pendiente{syncStats.pending > 1 ? 's' : ''}
                </Badge>
              )}
              
              {syncStats.failed > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {syncStats.failed} error{syncStats.failed > 1 ? 'es' : ''}
                </Badge>
              )}
              
              {!hasPendingSyncs && syncStats.total > 0 && (
                <Badge variant="default" className="text-xs bg-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Todo sincronizado
                </Badge>
              )}
            </div>
          </div>
          
          {/* Controles y estado */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-muted-foreground">
            {lastSyncTime && (
              <span className="hidden lg:inline">
                Última sync: {formatLastSync()}
              </span>
            )}
            
            {hasPendingSyncs && isOnline && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full sm:w-auto"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronizar ahora
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Mensaje de estado para móviles */}
        {!isOnline && (
          <Alert className="mt-3 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Modo offline activo.</span>
              <span className="block sm:inline sm:ml-1">
                Los checklists se guardarán localmente y se sincronizarán cuando vuelva la conexión.
              </span>
            </AlertDescription>
          </Alert>
        )}
        
        {hasPendingSyncs && isOnline && (
          <Alert className="mt-3 border-blue-200 bg-blue-50">
            <RefreshCw className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Sincronización disponible.</span>
              <span className="block sm:inline sm:ml-1">
                Hay {syncStats.pending} checklist{syncStats.pending > 1 ? 's' : ''} esperando sincronización.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Información de errores para debugging */}
        {syncStats.failed > 0 && (
          <Alert className="mt-3 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Errores de sincronización.</span>
              <span className="block sm:inline sm:ml-1">
                {syncStats.failed} checklist{syncStats.failed > 1 ? 's' : ''} no se pudieron sincronizar. 
                Los reintentos automáticos continuarán.
              </span>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )

  if (!showDetails) {
    return <CompactStatus />
  }

  return <DetailedStatus />
} 