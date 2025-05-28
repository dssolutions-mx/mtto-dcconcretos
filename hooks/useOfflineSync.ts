"use client"

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

// Importación dinámica del servicio offline
let offlineChecklistService: any = null

interface SyncStats {
  total: number
  synced: number
  pending: number
  failed: number
}

interface UseOfflineSyncReturn {
  isOnline: boolean | undefined
  isSyncing: boolean
  syncStats: SyncStats
  lastSyncTime: Date | null
  sync: () => Promise<void>
  hasPendingSyncs: boolean
  isLoading: boolean
}

export function useOfflineSync(): UseOfflineSyncReturn {
  // Inicializar como undefined para evitar problemas de hidratación
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStats, setSyncStats] = useState<SyncStats>({
    total: 0,
    synced: 0,
    pending: 0,
    failed: 0
  })
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Inicializar servicio offline
  useEffect(() => {
    if (typeof window === 'undefined') return

    const initService = async () => {
      try {
        if (!offlineChecklistService) {
          const module = await import('@/lib/services/offline-checklist-service')
          offlineChecklistService = module.offlineChecklistService
        }

        // Estado inicial - establecer solo cuando estamos en el cliente
        setIsOnline(navigator.onLine)

        // Configurar listeners del servicio
        const handleSyncStart = () => {
          setIsSyncing(true)
        }

        const handleSyncComplete = (result: any) => {
          setIsSyncing(false)
          setLastSyncTime(new Date())
          
          if (result.synced > 0) {
            toast.success(`✅ ${result.synced} checklist${result.synced > 1 ? 's' : ''} sincronizado${result.synced > 1 ? 's' : ''}`)
          }
          
          if (result.failed > 0) {
            toast.warning(`⚠️ ${result.failed} checklist${result.failed > 1 ? 's' : ''} con errores`)
          }
        }

        const handleSyncError = (error: any) => {
          setIsSyncing(false)
          toast.error(`Error en sincronización: ${error.message}`)
        }

        const handleConnectionChange = (data: { online: boolean }) => {
          setIsOnline(data.online)
          if (data.online) {
            toast.success("🌐 Conexión restaurada")
          } else {
            toast.warning("📶 Sin conexión - Modo offline activo")
          }
        }

        const handleStatsUpdate = (stats: SyncStats) => {
          setSyncStats(stats)
        }

        // Registrar listeners
        offlineChecklistService.on('sync-start', handleSyncStart)
        offlineChecklistService.on('sync-complete', handleSyncComplete)
        offlineChecklistService.on('sync-error', handleSyncError)
        offlineChecklistService.on('connection-change', handleConnectionChange)
        offlineChecklistService.on('stats-update', handleStatsUpdate)

        // Cargar stats iniciales
        const initialStats = await offlineChecklistService.getSyncStats()
        setSyncStats(initialStats)
        
        setIsLoading(false)

        return () => {
          // Cleanup listeners
          offlineChecklistService.off('sync-start', handleSyncStart)
          offlineChecklistService.off('sync-complete', handleSyncComplete)
          offlineChecklistService.off('sync-error', handleSyncError)
          offlineChecklistService.off('connection-change', handleConnectionChange)
          offlineChecklistService.off('stats-update', handleStatsUpdate)
        }
      } catch (error) {
        console.error('Error initializing offline service:', error)
        setIsLoading(false)
      }
    }

    const cleanup = initService()

    // Listeners para eventos del navegador
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      cleanup?.then(fn => fn?.())
    }
  }, [])

  // Función para sincronizar manualmente
  const sync = useCallback(async () => {
    if (!offlineChecklistService || isOnline === false || isSyncing) {
      if (isOnline === false) {
        toast.warning("Sin conexión - No se puede sincronizar")
      }
      return
    }

    try {
      await offlineChecklistService.syncAll()
    } catch (error) {
      console.error('Manual sync error:', error)
    }
  }, [isOnline, isSyncing])

  return {
    isOnline,
    isSyncing,
    syncStats,
    lastSyncTime,
    sync,
    hasPendingSyncs: syncStats.pending > 0,
    isLoading
  }
} 