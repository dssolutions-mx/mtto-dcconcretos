import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { createBrowserClient } from '@supabase/ssr'

interface ChecklistDB extends DBSchema {
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
}

// Tipo para eventos del servicio offline
type OfflineServiceEvent = 'sync-start' | 'sync-complete' | 'sync-error' | 'connection-change' | 'stats-update'

class OfflineChecklistService {
  private db: Promise<IDBPDatabase<ChecklistDB>> | null = null
  private syncInProgress: boolean = false
  private onlineListener: (() => void) | null = null
  private isClient: boolean = false
  private eventListeners: Map<OfflineServiceEvent, Function[]> = new Map()
  private autoSyncTimer: NodeJS.Timeout | null = null
  private lastSyncAttempt: number = 0
  private minSyncInterval: number = 30000 // 30 segundos mínimo entre syncs
  
  constructor() {
    this.isClient = typeof window !== 'undefined'
    if (this.isClient) {
      this.initializeDB()
    }
  }

  private initializeDB() {
    if (!this.isClient || this.db) return
    
    this.db = openDB<ChecklistDB>('checklists-offline', 2, {
      upgrade(db, oldVersion) {
        // Crear stores si no existen
        if (!db.objectStoreNames.contains('offline-checklists')) {
          db.createObjectStore('offline-checklists', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('checklist-templates')) {
          db.createObjectStore('checklist-templates', { keyPath: 'id' })
        }
      }
    })
    
    // Inicializar listeners para conexión
    this.setupOnlineListener()
    this.setupAutoSync()
  }

  private async getDB(): Promise<IDBPDatabase<ChecklistDB> | null> {
    if (!this.isClient) return null
    if (!this.db) this.initializeDB()
    return this.db
  }
  
  // Sistema de eventos
  on(event: OfflineServiceEvent, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  off(event: OfflineServiceEvent, callback: Function) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: OfflineServiceEvent, data?: any) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }
  
  // Configurar listener para cuando vuelva la conexión
  private setupOnlineListener() {
    if (!this.isClient) return
    
    this.onlineListener = async () => {
      console.log('Conexión detectada, iniciando sincronización...')
      this.emit('connection-change', { online: true })
      
      // Esperar un poco antes de sincronizar para asegurar estabilidad de conexión
      setTimeout(() => {
        if (navigator.onLine) {
          this.syncAllWithThrottle()
        }
      }, 2000)
    }
    
    const offlineListener = () => {
      this.emit('connection-change', { online: false })
    }
    
    window.addEventListener('online', this.onlineListener)
    window.addEventListener('offline', offlineListener)
    
    // Cleanup anterior
    const cleanup = () => {
      window.removeEventListener('online', this.onlineListener!)
      window.removeEventListener('offline', offlineListener)
    }
    
    // Guardar la función de cleanup para uso posterior
    this.cleanup = cleanup
  }

  private cleanup: (() => void) | null = null

  // Configurar sincronización automática inteligente
  private setupAutoSync() {
    if (!this.isClient) return
    
    // Sync periódico más inteligente: cada 2 minutos si hay conexión y pendientes
    this.autoSyncTimer = setInterval(async () => {
      if (navigator.onLine && !this.syncInProgress) {
        const stats = await this.getSyncStats()
        if (stats.pending > 0) {
          await this.syncAllWithThrottle()
        }
      }
    }, 120000) // 2 minutos

    // También verificar cuando la página gana/pierde foco
    const handleVisibilityChange = () => {
      if (!document.hidden && navigator.onLine && !this.syncInProgress) {
        this.syncAllWithThrottle()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  // Sincronización con throttling para evitar spam
  private async syncAllWithThrottle() {
    const now = Date.now()
    if (now - this.lastSyncAttempt < this.minSyncInterval) {
      console.log('Sincronización throttled, muy pronto desde la última')
      return
    }

    this.lastSyncAttempt = now
    return this.syncAll()
  }
  
  // Guardar plantilla de checklist para uso offline
  async cacheChecklistTemplate(scheduleId: string, templateData: any, assetData: any) {
    const db = await this.getDB()
    if (!db) return
    
    await db.put('checklist-templates', {
      id: scheduleId,
      template: templateData,
      asset: assetData,
      lastUpdated: Date.now()
    })
  }
  
  // Obtener plantilla de checklist desde cache
  async getCachedChecklistTemplate(scheduleId: string) {
    const db = await this.getDB()
    if (!db) return null
    
    return await db.get('checklist-templates', scheduleId)
  }
  
  // Guardar un checklist completado offline con reintentos
  async saveOfflineChecklist(id: string, data: any) {
    const db = await this.getDB()
    if (!db) return
    
    await db.put('offline-checklists', {
      id,
      data,
      synced: false,
      timestamp: Date.now(),
      retryCount: 0,
      lastAttempt: undefined,
      error: undefined
    })
    
    // Emitir evento de actualización de stats
    this.emit('stats-update', await this.getSyncStats())
    
    // Intentar sincronizar inmediatamente si hay conexión
    if (this.isClient && navigator.onLine) {
      setTimeout(() => this.syncSingle(id), 1000)
    }
  }
  
  // Obtener todos los checklists pendientes de sincronización
  async getPendingSyncs() {
    const db = await this.getDB()
    if (!db) return []
    
    const all = await db.getAll('offline-checklists')
    return all.filter(item => !item.synced && item.retryCount < 5) // Máximo 5 reintentos
  }
  
  // Marcar un checklist como sincronizado
  async markAsSynced(id: string) {
    const db = await this.getDB()
    if (!db) return
    
    const item = await db.get('offline-checklists', id)
    if (item) {
      item.synced = true
      item.error = undefined
      await db.put('offline-checklists', item)
    }
  }
  
  // Incrementar contador de reintentos
  async incrementRetryCount(id: string, error?: string) {
    const db = await this.getDB()
    if (!db) return
    
    const item = await db.get('offline-checklists', id)
    if (item) {
      item.retryCount = (item.retryCount || 0) + 1
      item.lastAttempt = Date.now()
      item.error = error
      await db.put('offline-checklists', item)
    }
  }
  
  // Sincronizar un solo checklist con mejor manejo de errores
  async syncSingle(id: string): Promise<boolean> {
    try {
      const db = await this.getDB()
      if (!db) return false
      
      const item = await db.get('offline-checklists', id)
      
      if (!item || item.synced) return true
      
      // Verificar si no hemos reintentado demasiado recientemente
      if (item.lastAttempt && Date.now() - item.lastAttempt < 10000) {
        return false // Esperar 10 segundos entre reintentos
      }

      const response = await fetch(`/api/checklists/schedules/${item.data.scheduleId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item.data),
      })
      
      if (response.ok) {
        await this.markAsSynced(id)
        console.log(`✅ Checklist ${id} sincronizado exitosamente`)
        return true
      } else {
        const errorText = await response.text()
        const errorMessage = `HTTP ${response.status}: ${errorText}`
        
        if (response.status >= 400 && response.status < 500) {
          // Error del cliente, no reintentar más
          console.error(`❌ Error del cliente para checklist ${id}: ${errorMessage}`)
          await this.incrementRetryCount(id, errorMessage)
          return false
        } else {
          // Error del servidor, reintentar
          console.warn(`⚠️ Error del servidor para checklist ${id}: ${errorMessage}`)
          throw new Error(errorMessage)
        }
      }
    } catch (error: any) {
      console.error(`💥 Error sincronizando checklist ${id}:`, error)
      await this.incrementRetryCount(id, error.message)
      return false
    }
  }
  
  // Sincronizar todos los checklists pendientes con reintentos y mejor feedback
  async syncPendingWithRetry() {
    if (this.syncInProgress) return
    
    this.syncInProgress = true
    this.emit('sync-start')
    
    try {
      const pending = await this.getPendingSyncs()
      let successCount = 0
      let errorCount = 0
      
      for (const item of pending) {
        if (item.retryCount < 5) {
          const success = await this.syncSingle(item.id)
          if (success) {
            successCount++
          } else {
            errorCount++
            // Esperar un poco entre errores para no sobrecargar
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }
      
      // Emitir evento de stats actualizado
      this.emit('stats-update', await this.getSyncStats())
      
      return { success: successCount, errors: errorCount }
    } finally {
      this.syncInProgress = false
    }
  }
  
  // Sincronizar todos los checklists pendientes
  async syncAll() {
    if (!this.isClient || !navigator.onLine) {
      console.log('Sin conexión, sincronización cancelada')
      this.emit('sync-error', { message: 'Sin conexión a internet' })
      return { success: false, message: 'Sin conexión a internet' }
    }
    
    try {
      const result = await this.syncPendingWithRetry()
      
      const pending = await this.getPendingSyncs()
      const failed = pending.filter(item => item.retryCount >= 5)
      
      const syncResult = {
        success: pending.length === 0,
        synced: result?.success || 0,
        failed: failed.length,
        errors: result?.errors || 0,
        results: pending
      }
      
      this.emit('sync-complete', syncResult)
      
      return syncResult
    } catch (error: any) {
      this.emit('sync-error', { message: error.message, error })
      throw error
    }
  }
  
  // Comprobar si hay elementos pendientes de sincronización
  async hasPendingSyncs() {
    const pending = await this.getPendingSyncs()
    return pending.length > 0
  }
  
  // Obtener estadísticas de sincronización
  async getSyncStats() {
    const db = await this.getDB()
    if (!db) return { total: 0, synced: 0, pending: 0, failed: 0 }
    
    const all = await db.getAll('offline-checklists')
    
    const stats = {
      total: all.length,
      synced: all.filter(item => item.synced).length,
      pending: all.filter(item => !item.synced && item.retryCount < 5).length,
      failed: all.filter(item => !item.synced && item.retryCount >= 5).length
    }

    // Emitir evento de actualización
    this.emit('stats-update', stats)
    
    return stats
  }
  
  // Obtener detalles de elementos con errores
  async getFailedItems() {
    const db = await this.getDB()
    if (!db) return []
    
    const all = await db.getAll('offline-checklists')
    return all.filter(item => !item.synced && item.retryCount >= 5)
  }

  // Reintentar un elemento fallido específico
  async retryFailed(id: string) {
    const db = await this.getDB()
    if (!db) return false
    
    const item = await db.get('offline-checklists', id)
    if (item && !item.synced) {
      // Resetear contador de reintentos
      item.retryCount = 0
      item.error = undefined
      item.lastAttempt = undefined
      await db.put('offline-checklists', item)
      
      // Intentar sincronizar
      return this.syncSingle(id)
    }
    
    return false
  }
  
  // Limpiar datos antiguos (más de 30 días)
  async cleanOldData() {
    const db = await this.getDB()
    if (!db) return
    
    const all = await db.getAll('offline-checklists')
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    let cleaned = 0
    
    for (const item of all) {
      if (item.synced && item.timestamp < thirtyDaysAgo) {
        await db.delete('offline-checklists', item.id)
        cleaned++
      }
    }
    
    // También limpiar plantillas antiguas
    const templates = await db.getAll('checklist-templates')
    for (const template of templates) {
      if (template.lastUpdated < thirtyDaysAgo) {
        await db.delete('checklist-templates', template.id)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Limpieza automática: ${cleaned} elementos antiguos eliminados`)
      this.emit('stats-update', await this.getSyncStats())
    }
    
    return cleaned
  }
  
  // Destruir el servicio y limpiar listeners
  destroy() {
    if (this.cleanup) {
      this.cleanup()
    }
    
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer)
    }
    
    this.eventListeners.clear()
  }
}

export const offlineChecklistService = new OfflineChecklistService() 