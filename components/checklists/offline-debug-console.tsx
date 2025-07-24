"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Terminal, 
  Trash2, 
  RefreshCw, 
  Database, 
  Wifi, 
  WifiOff,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle2
} from "lucide-react"
import { toast } from "sonner"
import { useOfflineSync } from "@/hooks/useOfflineSync"

// Import offline service
let offlineChecklistService: any = null

interface SyncStats {
  pendingChecklists: number
  pendingPhotos: number
  pendingWorkOrders: number
  failedItems: number
  totalCacheSize: number
}

export function OfflineDebugConsole() {
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastCleanup, setLastCleanup] = useState<{ indexedDB: number, localStorage: number } | null>(null)
  const { isOnline } = useOfflineSync()

  // Initialize offline service
  useEffect(() => {
    if (typeof window !== 'undefined' && !offlineChecklistService) {
      import('@/lib/services/offline-checklist-service').then(module => {
        offlineChecklistService = module.offlineChecklistService
        loadSyncStats()
      })
    } else if (offlineChecklistService) {
      loadSyncStats()
    }
  }, [])

  const loadSyncStats = async () => {
    if (!offlineChecklistService) return

    try {
      const stats = await offlineChecklistService.getSyncStats()
      setSyncStats(stats)
    } catch (error) {
      console.error('Error loading sync stats:', error)
    }
  }

  const handleCleanupCorruptedData = async () => {
    setIsProcessing(true)
    
    try {
      if (!offlineChecklistService) {
        throw new Error('Offline service not available')
      }

      const result = await offlineChecklistService.cleanCorruptedData()
      setLastCleanup(result)

      const totalCleaned = result.indexedDB + result.localStorage
      
      if (totalCleaned > 0) {
        toast.success(`🧹 Limpieza completada`, {
          description: `Se eliminaron ${totalCleaned} elementos corruptos (${result.indexedDB} IndexedDB, ${result.localStorage} localStorage)`,
          duration: 5000
        })
      } else {
        toast.info("✨ No se encontraron datos corruptos", {
          description: "El cache está limpio",
          duration: 3000
        })
      }

      // Reload stats after cleanup
      await loadSyncStats()
      
    } catch (error) {
      console.error('Error during cleanup:', error)
      toast.error("Error durante la limpieza", {
        description: error instanceof Error ? error.message : "Error desconocido",
        duration: 5000
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleForceSync = async () => {
    setIsProcessing(true)
    
    try {
      if (!offlineChecklistService) {
        throw new Error('Offline service not available')
      }

      toast.info("🔄 Iniciando sincronización forzada...", {
        duration: 3000
      })

      const result = await offlineChecklistService.syncAll()
      
      toast.success("✅ Sincronización completada", {
        description: `Checklists: ${result.checklistsSuccess}/${result.checklistsTotal}, Work Orders: ${result.workOrdersSuccess}/${result.workOrdersTotal}`,
        duration: 5000
      })

      // Reload stats after sync
      await loadSyncStats()
      
    } catch (error) {
      console.error('Error during sync:', error)
      toast.error("Error durante la sincronización", {
        description: error instanceof Error ? error.message : "Error desconocido",
        duration: 5000
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearAllCache = async () => {
    if (!confirm("⚠️ ¿Está seguro de que desea limpiar TODA la cache offline? Esta acción no se puede deshacer.")) {
      return
    }

    setIsProcessing(true)
    
    try {
      if (!offlineChecklistService) {
        throw new Error('Offline service not available')
      }

      // Clean all offline data
      await offlineChecklistService.cleanOldData()
      
      // Also clean localStorage items
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith('offline-') || 
        key.startsWith('checklist-') || 
        key.startsWith('work-orders-') ||
        key.startsWith('unresolved-issues-')
      )
      
      keys.forEach(key => localStorage.removeItem(key))

      toast.success("🗑️ Cache limpiada completamente", {
        description: `Se eliminaron ${keys.length} elementos de localStorage`,
        duration: 5000
      })

      // Reload stats
      await loadSyncStats()
      
    } catch (error) {
      console.error('Error clearing cache:', error)
      toast.error("Error limpiando cache", {
        description: error instanceof Error ? error.message : "Error desconocido",
        duration: 5000
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusColor = (count: number) => {
    if (count === 0) return "text-green-600"
    if (count < 5) return "text-yellow-600"
    return "text-red-600"
  }

  const getStatusIcon = (count: number) => {
    if (count === 0) return <CheckCircle2 className="h-4 w-4 text-green-600" />
    if (count < 5) return <Clock className="h-4 w-4 text-yellow-600" />
    return <AlertTriangle className="h-4 w-4 text-red-600" />
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Consola de Debug Offline
          <div className="flex items-center gap-1 ml-auto">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <Badge variant="outline" className="text-green-600 border-green-300">
                  Online
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-orange-500" />
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  Offline
                </Badge>
              </>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          Herramientas para debugging y mantenimiento del cache offline
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sync Statistics */}
        {syncStats && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Estadísticas de Cache
            </h4>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Checklists pendientes:</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(syncStats.pendingChecklists)}
                  <span className={getStatusColor(syncStats.pendingChecklists)}>
                    {syncStats.pendingChecklists}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Fotos pendientes:</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(syncStats.pendingPhotos)}
                  <span className={getStatusColor(syncStats.pendingPhotos)}>
                    {syncStats.pendingPhotos}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Work Orders offline:</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(syncStats.pendingWorkOrders)}
                  <span className={getStatusColor(syncStats.pendingWorkOrders)}>
                    {syncStats.pendingWorkOrders}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Items fallidos:</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(syncStats.failedItems)}
                  <span className={getStatusColor(syncStats.failedItems)}>
                    {syncStats.failedItems}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
              <HardDrive className="h-3 w-3 inline mr-1" />
              Tamaño total del cache: ~{Math.round(syncStats.totalCacheSize / 1024)} KB
            </div>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="space-y-3">
          <h4 className="font-medium">Acciones de Mantenimiento</h4>
          
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              onClick={handleCleanupCorruptedData}
              disabled={isProcessing}
              className="justify-start"
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Limpiar Datos Corruptos
              {lastCleanup && (
                <Badge variant="secondary" className="ml-auto">
                  {lastCleanup.indexedDB + lastCleanup.localStorage}
                </Badge>
              )}
            </Button>
            
            {isOnline && (
              <Button
                variant="outline"
                onClick={handleForceSync}
                disabled={isProcessing}
                className="justify-start"
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Forzar Sincronización
              </Button>
            )}
            
            <Button
              variant="destructive"
              onClick={handleClearAllCache}
              disabled={isProcessing}
              className="justify-start"
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Limpiar Toda la Cache
            </Button>
          </div>
        </div>

        <Separator />

        {/* Console Commands */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Comandos de Consola</h4>
          <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono">
            <div>// Comandos disponibles en la consola del navegador:</div>
            <div className="mt-1 space-y-1">
              <div>cleanCorruptedData() // Limpiar datos corruptos</div>
              <div>offlineChecklistService.syncAll() // Sincronizar todo</div>
              <div>offlineChecklistService.getSyncStats() // Ver estadísticas</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 