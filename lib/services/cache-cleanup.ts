import { openDB, IDBPDatabase } from 'idb'

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
  private dbName = 'maintenance-checklists-offline'
  private db: IDBPDatabase<ChecklistDB> | null = null

  async openDatabase() {
    if (this.db) return this.db
    
    try {
      this.db = await openDB<ChecklistDB>(this.dbName, 1)
      return this.db
    } catch (error) {
      console.error('Error opening database:', error)
      return null
    }
  }

  // Limpiar todos los checklists pendientes de sincronización
  async clearPendingSync() {
    const db = await this.openDatabase()
    if (!db) return { success: false, error: 'Cannot open database' }

    try {
      const tx = db.transaction('offline-checklists', 'readwrite')
      const store = tx.objectStore('offline-checklists')
      
      // Obtener todos los elementos
      const allItems = await store.getAll()
      
      // Filtrar solo los no sincronizados
      const pendingItems = allItems.filter(item => !item.synced)
      
      console.log(`🧹 Found ${pendingItems.length} pending sync items to clear`)
      
      // Eliminar elementos pendientes
      for (const item of pendingItems) {
        await store.delete(item.id)
        console.log(`❌ Deleted pending sync item: ${item.id}`)
      }
      
      await tx.done
      
      return { 
        success: true, 
        cleared: pendingItems.length,
        items: pendingItems.map(item => ({
          id: item.id,
          retryCount: item.retryCount,
          error: item.error,
          timestamp: new Date(item.timestamp).toISOString()
        }))
      }
    } catch (error) {
      console.error('Error clearing pending sync:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Limpiar fotos offline pendientes
  async clearPendingPhotos() {
    const db = await this.openDatabase()
    if (!db) return { success: false, error: 'Cannot open database' }

    try {
      const tx = db.transaction('offline-photos', 'readwrite')
      const store = tx.objectStore('offline-photos')
      
      const allPhotos = await store.getAll()
      const pendingPhotos = allPhotos.filter(photo => !photo.uploaded)
      
      console.log(`📸 Found ${pendingPhotos.length} pending photos to clear`)
      
      for (const photo of pendingPhotos) {
        await store.delete(photo.id)
        console.log(`❌ Deleted pending photo: ${photo.id}`)
      }
      
      await tx.done
      
      return { 
        success: true, 
        cleared: pendingPhotos.length,
        photos: pendingPhotos.map(photo => ({
          id: photo.id,
          checklistId: photo.checklistId,
          fileName: photo.fileName,
          retryCount: photo.retryCount
        }))
      }
    } catch (error) {
      console.error('Error clearing pending photos:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Limpiar cache completo de templates y schedules
  async clearTemplateCache() {
    const db = await this.openDatabase()
    if (!db) return { success: false, error: 'Cannot open database' }

    try {
      const tx = db.transaction(['checklist-templates', 'checklist-schedules', 'checklist-lists'], 'readwrite')
      
      const templatesStore = tx.objectStore('checklist-templates')
      const schedulesStore = tx.objectStore('checklist-schedules')
      const listsStore = tx.objectStore('checklist-lists')
      
      await templatesStore.clear()
      await schedulesStore.clear()
      await listsStore.clear()
      
      await tx.done
      
      console.log('🧹 Cleared all template cache')
      
      return { success: true }
    } catch (error) {
      console.error('Error clearing template cache:', error)
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
    const db = await this.openDatabase()
    if (!db) return null

    try {
      const [
        offlineChecklists,
        photos,
        templates,
        schedules,
        unresolvedIssues,
        workOrders
      ] = await Promise.all([
        db.getAll('offline-checklists'),
        db.getAll('offline-photos'),
        db.getAll('checklist-templates'),
        db.getAll('checklist-schedules'),
        db.getAll('unresolved-issues'),
        db.getAll('offline-work-orders')
      ])

      return {
        offlineChecklists: {
          total: offlineChecklists.length,
          pending: offlineChecklists.filter(item => !item.synced).length,
          synced: offlineChecklists.filter(item => item.synced).length,
          failed: offlineChecklists.filter(item => item.retryCount >= 5).length
        },
        photos: {
          total: photos.length,
          pending: photos.filter(photo => !photo.uploaded).length,
          uploaded: photos.filter(photo => photo.uploaded).length,
          failed: photos.filter(photo => photo.retryCount >= 5).length
        },
        cache: {
          templates: templates.length,
          schedules: schedules.length,
          unresolvedIssues: unresolvedIssues.length,
          workOrders: workOrders.length
        }
      }
    } catch (error) {
      console.error('Error getting cache stats:', error)
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