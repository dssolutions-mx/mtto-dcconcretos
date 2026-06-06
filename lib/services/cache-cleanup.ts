import { openDB, IDBPDatabase } from 'idb'
import { db as dexieDb } from '@/lib/offline/db'

interface ChecklistDB {
  'offline-checklists': {
    key: string
    value: {
      id: string
      data: any
      synced: boolean
      timestamp: number
      retryCount: number
      lastAttempt?: number
      error?: string
    }
  }
  'checklist-templates': {
    key: string
    value: {
      id: string
      template: any
      asset: any
      lastUpdated: number
    }
  }
  'checklist-schedules': {
    key: string
    value: {
      id: string
      schedules: any[]
      lastUpdated: number
      filters?: string
    }
  }
  'checklist-lists': {
    key: string
    value: {
      id: string
      templates: any[]
      lastUpdated: number
    }
  }
  'offline-photos': {
    key: string
    value: {
      id: string
      checklistId: string
      itemId: string
      file: Blob
      fileName: string
      uploaded: boolean
      uploadUrl?: string
      uploadError?: string
      retryCount: number
      timestamp: number
    }
  }
  'asset-data': {
    key: string
    value: {
      id: string
      assetData: any
      lastUpdated: number
    }
  }
  'unresolved-issues': {
    key: string
    value: {
      id: string
      tempChecklistId?: string
      checklistId: string
      assetId: string
      assetName: string
      issues: any[]
      timestamp: number
      synced: boolean
      workOrdersCreated: boolean
    }
  }
  'offline-work-orders': {
    key: string
    value: {
      id: string
      checklistId: string
      issues: any[]
      priority: string
      description: string
      timestamp: number
      synced: boolean
      retryCount: number
    }
  }
}

export class CacheCleanupService {
  private dbName = 'checklists-offline'
  private db: IDBPDatabase<ChecklistDB> | null = null

  async openDatabase() {
    if (this.db) return this.db
    
    try {
      this.db = await openDB<ChecklistDB>(this.dbName, 6)
      return this.db
    } catch (error) {
      console.error('Error opening database:', error)
      return null
    }
  }

  // Limpiar todos los checklists pendientes de sincronización
  async clearPendingSync() {
    try {
      const pending = await dexieDb.outbox
        .filter((entry) => entry.domain === 'checklist' && entry.status !== 'dead_letter')
        .toArray()
      await dexieDb.outbox.bulkDelete(pending.map((entry) => entry.id))
      return {
        success: true,
        cleared: pending.length,
        items: pending.map((item) => ({
          id: item.id,
          retryCount: item.attemptCount,
          error: item.lastError,
          timestamp: new Date(item.createdAt).toISOString(),
        })),
      }
    } catch (error) {
      console.error('Error clearing Dexie pending sync:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Limpiar fotos offline pendientes
  async clearPendingPhotos() {
    try {
      const pendingPhotos = await dexieDb.photos.filter((photo) => !photo.uploaded).toArray()
      await dexieDb.photos.bulkDelete(pendingPhotos.map((photo) => photo.id))
      return {
        success: true,
        cleared: pendingPhotos.length,
        photos: pendingPhotos.map((photo) => ({
          id: photo.id,
          checklistId: photo.checklistId,
          fileName: photo.fileName,
          retryCount: photo.retryCount,
        })),
      }
    } catch (error) {
      console.error('Error clearing Dexie pending photos:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Limpiar cache completo de templates y schedules
  async clearTemplateCache() {
    try {
      await dexieDb.cache_templates.clear()
      await dexieDb.cache_schedules.clear()
      return { success: true }
    } catch (error) {
      console.error('Error clearing Dexie template cache:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Limpieza completa de todo el cache
  async fullCacheCleanup() {
    console.log('🚨 Starting full cache cleanup...')
    
    const results = {
      pendingSync: await this.clearPendingSync(),
      pendingPhotos: await this.clearPendingPhotos(),
      templateCache: await this.clearTemplateCache()
    }
    
    console.log('✅ Full cache cleanup completed:', results)
    
    return results
  }

  // Obtener estadísticas del cache
  async getCacheStats() {
    try {
      const [outbox, photos, templates, schedules, drafts] = await Promise.all([
        dexieDb.outbox.toArray(),
        dexieDb.photos.toArray(),
        dexieDb.cache_templates.toArray(),
        dexieDb.cache_schedules.toArray(),
        dexieDb.drafts.toArray(),
      ])

      const checklistOutbox = outbox.filter((entry) => entry.domain === 'checklist')

      return {
        offlineChecklists: {
          total: checklistOutbox.length,
          pending: checklistOutbox.filter((item) => item.status === 'pending' || item.status === 'failed').length,
          synced: checklistOutbox.filter((item) => item.status === 'dead_letter').length,
          failed: checklistOutbox.filter((item) => item.attemptCount >= 5).length,
        },
        photos: {
          total: photos.length,
          pending: photos.filter((photo) => !photo.uploaded).length,
          uploaded: photos.filter((photo) => photo.uploaded).length,
          failed: photos.filter((photo) => photo.retryCount >= 5).length,
        },
        cache: {
          templates: templates.length,
          schedules: schedules.length,
          unresolvedIssues: 0,
          workOrders: 0,
          drafts: drafts.length,
        },
      }
    } catch (error) {
      console.error('Error getting Dexie cache stats:', error)
      return null
    }
  }

  // Cermar la base de datos
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// Exportar una instancia global
export const cacheCleanup = new CacheCleanupService()

// Función helper para uso desde consola del navegador
if (typeof window !== 'undefined') {
  (window as any).cleanChecklistCache = async () => {
    const results = await cacheCleanup.fullCacheCleanup()
    console.log('Cache cleanup results:', results)
    return results
  }
  
  (window as any).getChecklistCacheStats = async () => {
    const stats = await cacheCleanup.getCacheStats()
    console.log('Cache stats:', stats)
    return stats
  }
} 