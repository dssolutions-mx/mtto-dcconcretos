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

class OfflineChecklistService {
  private db: Promise<IDBPDatabase<ChecklistDB>> | null = null
  private syncInProgress: boolean = false
  private onlineListener: (() => void) | null = null
  private isClient: boolean = false
  
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
  }

  private async getDB(): Promise<IDBPDatabase<ChecklistDB> | null> {
    if (!this.isClient) return null
    if (!this.db) this.initializeDB()
    return this.db
  }
  
  // Configurar listener para cuando vuelva la conexión
  private setupOnlineListener() {
    if (!this.isClient) return
    
    this.onlineListener = () => {
      console.log('Conexión detectada, iniciando sincronización...')
      this.syncAll()
    }
    
    window.addEventListener('online', this.onlineListener)
    
    // También verificar periódicamente si hay conexión
    setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.syncPendingWithRetry()
      }
    }, 30000) // Cada 30 segundos
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
      retryCount: 0
    })
    
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
      await db.put('offline-checklists', item)
    }
  }
  
  // Incrementar contador de reintentos
  async incrementRetryCount(id: string) {
    const db = await this.getDB()
    if (!db) return
    
    const item = await db.get('offline-checklists', id)
    if (item) {
      item.retryCount = (item.retryCount || 0) + 1
      await db.put('offline-checklists', item)
    }
  }
  
  // Sincronizar un solo checklist
  async syncSingle(id: string): Promise<boolean> {
    try {
      const db = await this.getDB()
      if (!db) return false
      
      const item = await db.get('offline-checklists', id)
      
      if (!item || item.synced) return true
      
      const response = await fetch(`/api/checklists/schedules/${item.data.scheduleId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item.data),
      })
      
      if (response.ok) {
        await this.markAsSynced(id)
        return true
      } else if (response.status >= 400 && response.status < 500) {
        // Error del cliente, no reintentar
        console.error(`Error ${response.status} al sincronizar checklist ${id}`)
        await this.incrementRetryCount(id)
        return false
      } else {
        // Error del servidor, reintentar
        throw new Error(`Server error ${response.status}`)
      }
    } catch (error) {
      console.error(`Error sincronizando checklist ${id}:`, error)
      await this.incrementRetryCount(id)
      return false
    }
  }
  
  // Sincronizar todos los checklists pendientes con reintentos
  async syncPendingWithRetry() {
    if (this.syncInProgress) return
    
    this.syncInProgress = true
    const pending = await this.getPendingSyncs()
    
    for (const item of pending) {
      if (item.retryCount < 5) {
        const success = await this.syncSingle(item.id)
        if (!success) {
          // Esperar antes de continuar con el siguiente
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }
    
    this.syncInProgress = false
  }
  
  // Sincronizar todos los checklists pendientes
  async syncAll() {
    if (!this.isClient || !navigator.onLine) {
      console.log('Sin conexión, sincronización cancelada')
      return { success: false, message: 'Sin conexión a internet' }
    }
    
    await this.syncPendingWithRetry()
    
    const pending = await this.getPendingSyncs()
    const failed = pending.filter(item => item.retryCount >= 5)
    
    return {
      success: pending.length === failed.length,
      synced: pending.length - failed.length,
      failed: failed.length,
      results: pending
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
    
    return {
      total: all.length,
      synced: all.filter(item => item.synced).length,
      pending: all.filter(item => !item.synced && item.retryCount < 5).length,
      failed: all.filter(item => !item.synced && item.retryCount >= 5).length
    }
  }
  
  // Limpiar datos antiguos (más de 30 días)
  async cleanOldData() {
    const db = await this.getDB()
    if (!db) return
    
    const all = await db.getAll('offline-checklists')
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    
    for (const item of all) {
      if (item.synced && item.timestamp < thirtyDaysAgo) {
        await db.delete('offline-checklists', item.id)
      }
    }
    
    // También limpiar plantillas antiguas
    const templates = await db.getAll('checklist-templates')
    for (const template of templates) {
      if (template.lastUpdated < thirtyDaysAgo) {
        await db.delete('checklist-templates', template.id)
      }
    }
  }
  
  // Destruir el servicio y limpiar listeners
  destroy() {
    if (this.isClient && this.onlineListener) {
      window.removeEventListener('online', this.onlineListener)
    }
  }
}

export const offlineChecklistService = new OfflineChecklistService() 