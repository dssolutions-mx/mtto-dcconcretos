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
    }
  }
}

class OfflineChecklistService {
  private db: Promise<IDBPDatabase<ChecklistDB>>
  
  constructor() {
    this.db = openDB<ChecklistDB>('checklists-offline', 1, {
      upgrade(db) {
        db.createObjectStore('offline-checklists', { keyPath: 'id' })
      }
    })
  }
  
  // Guardar un checklist completado offline
  async saveOfflineChecklist(id: string, data: any) {
    const db = await this.db
    await db.put('offline-checklists', {
      id,
      data,
      synced: false,
      timestamp: Date.now()
    })
  }
  
  // Obtener todos los checklists pendientes de sincronización
  async getPendingSyncs() {
    const db = await this.db
    const all = await db.getAll('offline-checklists')
    return all.filter(item => !item.synced)
  }
  
  // Marcar un checklist como sincronizado
  async markAsSynced(id: string) {
    const db = await this.db
    const item = await db.get('offline-checklists', id)
    if (item) {
      item.synced = true
      await db.put('offline-checklists', item)
    }
  }
  
  // Sincronizar todos los checklists pendientes
  async syncAll() {
    const pending = await this.getPendingSyncs()
    const results = []
    
    for (const item of pending) {
      try {
        const response = await fetch(`/api/checklists/schedules/${item.data.scheduleId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item.data),
        })
        
        const result = await response.json()
        
        if (response.ok) {
          await this.markAsSynced(item.id)
          results.push({ id: item.id, success: true, result })
        } else {
          results.push({ id: item.id, success: false, error: result.error })
        }
      } catch (error) {
        results.push({ id: item.id, success: false, error: 'Error de conexión' })
      }
    }
    
    return results
  }
  
  // Comprobar si hay elementos pendientes de sincronización
  async hasPendingSyncs() {
    const pending = await this.getPendingSyncs()
    return pending.length > 0
  }
  
  // Limpiar datos antiguos (más de 30 días)
  async cleanOldData() {
    const db = await this.db
    const all = await db.getAll('offline-checklists')
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    
    for (const item of all) {
      if (item.synced && item.timestamp < thirtyDaysAgo) {
        await db.delete('offline-checklists', item.id)
      }
    }
  }
}

export const offlineChecklistService = new OfflineChecklistService() 