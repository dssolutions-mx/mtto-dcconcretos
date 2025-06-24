'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, RefreshCw, Database, AlertTriangle } from 'lucide-react'
import { cacheCleanup } from '@/lib/services/cache-cleanup'
import { toast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CacheStats {
  offlineChecklists: {
    total: number
    pending: number
    synced: number
    failed: number
  }
  photos: {
    total: number
    pending: number
    uploaded: number
    failed: number
  }
  cache: {
    templates: number
    schedules: number
    unresolvedIssues: number
    workOrders: number
  }
}

export function CacheCleanupButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [showStats, setShowStats] = useState(false)

  const loadStats = async () => {
    try {
      const cacheStats = await cacheCleanup.getCacheStats()
      setStats(cacheStats)
      setShowStats(true)
    } catch (error) {
      console.error('Error loading cache stats:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas del cache",
        variant: "destructive"
      })
    }
  }

  const handleCleanup = async () => {
    setIsLoading(true)
    try {
      const results = await cacheCleanup.fullCacheCleanup()
      
      let message = "Cache limpiado exitosamente"
      let details = []
      
      if (results.pendingSync.success) {
        details.push(`${results.pendingSync.cleared} checklists pendientes eliminados`)
      }
      
      if (results.pendingPhotos.success) {
        details.push(`${results.pendingPhotos.cleared} fotos pendientes eliminadas`)
      }
      
      if (results.templateCache.success) {
        details.push("Cache de templates limpiado")
      }
      
      toast({
        title: "✅ Limpieza completada",
        description: details.length > 0 ? details.join(", ") : message,
      })
      
      // Recargar estadísticas
      await loadStats()
      
      // Recomendar recargar la página
      toast({
        title: "💡 Recomendación",
        description: "Recarga la página para aplicar los cambios completamente",
      })
      
    } catch (error) {
      console.error('Error during cleanup:', error)
      toast({
        title: "Error",
        description: "Hubo un problema al limpiar el cache",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearPendingOnly = async () => {
    setIsLoading(true)
    try {
      const result = await cacheCleanup.clearPendingSync()
      
      if (result.success) {
        toast({
          title: "✅ Limpieza de pendientes completada",
          description: `${result.cleared} elementos pendientes eliminados`,
        })
        
        // Recargar estadísticas
        await loadStats()
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudieron limpiar los elementos pendientes",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error clearing pending sync:', error)
      toast({
        title: "Error",
        description: "Hubo un problema al limpiar los elementos pendientes",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={loadStats}
          disabled={isLoading}
        >
          <Database className="h-4 w-4 mr-2" />
          Ver estadísticas del cache
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleClearPendingOnly}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Limpiar pendientes
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpiar todo el cache
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Limpiar cache completo
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará todos los datos del cache local incluyendo:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Checklists pendientes de sincronización</li>
                  <li>Fotos sin subir</li>
                  <li>Templates en cache</li>
                  <li>Schedules guardados</li>
                </ul>
                <p className="mt-2 font-medium text-orange-600">
                  ⚠️ Los datos no sincronizados se perderán permanentemente.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCleanup}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sí, limpiar todo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {showStats && stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estadísticas del Cache</CardTitle>
            <CardDescription>
              Estado actual del almacenamiento local offline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Checklists Offline</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-mono">{stats.offlineChecklists.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pendientes:</span>
                    <span className="font-mono text-orange-600">{stats.offlineChecklists.pending}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sincronizados:</span>
                    <span className="font-mono text-green-600">{stats.offlineChecklists.synced}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fallidos:</span>
                    <span className="font-mono text-red-600">{stats.offlineChecklists.failed}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Fotos</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-mono">{stats.photos.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pendientes:</span>
                    <span className="font-mono text-orange-600">{stats.photos.pending}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subidas:</span>
                    <span className="font-mono text-green-600">{stats.photos.uploaded}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fallidas:</span>
                    <span className="font-mono text-red-600">{stats.photos.failed}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Cache</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Templates:</span>
                    <span className="font-mono">{stats.cache.templates}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Schedules:</span>
                    <span className="font-mono">{stats.cache.schedules}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Issues sin resolver:</span>
                    <span className="font-mono">{stats.cache.unresolvedIssues}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Work Orders:</span>
                    <span className="font-mono">{stats.cache.workOrders}</span>
                  </div>
                </div>
              </div>
            </div>

            {(stats.offlineChecklists.pending > 0 || stats.photos.pending > 0) && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Elementos pendientes de sincronización</span>
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  Hay {stats.offlineChecklists.pending} checklists y {stats.photos.pending} fotos esperando sincronización.
                  Si estos elementos están causando problemas, puedes limpiarlos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
} 