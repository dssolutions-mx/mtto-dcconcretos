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
}

// Tipo para eventos del servicio offline
type OfflineServiceEvent = 'sync-start' | 'sync-complete' | 'sync-error' | 'connection-change' | 'stats-update' | 'cache-update' | 'photo-upload' | 'photo-sync'

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
      // Add error handling for browser extension issues
      try {
        this.initializeDB()
        this.setupOnlineListener()
        this.setupAutoSync()
      } catch (error) {
        // Silently handle extension-related errors
        if (process.env.NODE_ENV === 'development') {
          console.warn('Offline service initialization warning:', error)
        }
      }
    }
  }

  // Force database upgrade - useful for development
  async forceDBUpgrade() {
    if (!this.isClient) return false
    
    try {
      // Close existing connection
      if (this.db) {
        const currentDB = await this.db
        currentDB.close()
      }
      
      // Delete the database to force recreation
      await new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase('checklists-offline')
        deleteRequest.onsuccess = () => resolve(undefined)
        deleteRequest.onerror = () => reject(deleteRequest.error)
        deleteRequest.onblocked = () => {
          console.warn('Database deletion blocked - please close other tabs')
          reject(new Error('Database deletion blocked'))
        }
      })
      
      console.log('🗑️ Old database deleted, forcing recreation...')
      
      // Reinitialize
      this.db = null
      this.initializeDB()
      
      return true
    } catch (error) {
      console.error('Error forcing database upgrade:', error)
      return false
    }
  }

  private initializeDB() {
    if (!this.isClient || this.db) return
    
    this.db = openDB<ChecklistDB>('checklists-offline', 5, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`🔄 Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`)
        
        // Crear stores básicos (versiones 1-4)
        if (!db.objectStoreNames.contains('offline-checklists')) {
          console.log('📦 Creating offline-checklists store')
          db.createObjectStore('offline-checklists', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('checklist-templates')) {
          console.log('📦 Creating checklist-templates store')
          db.createObjectStore('checklist-templates', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('checklist-schedules')) {
          console.log('📦 Creating checklist-schedules store')
          db.createObjectStore('checklist-schedules', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('checklist-lists')) {
          console.log('📦 Creating checklist-lists store')
          db.createObjectStore('checklist-lists', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('offline-photos')) {
          console.log('📦 Creating offline-photos store')
          db.createObjectStore('offline-photos', { keyPath: 'id' })
        }
        
        // Nuevo store para versión 5: asset data cache
        if (!db.objectStoreNames.contains('asset-data')) {
          console.log('📦 Creating asset-data store (v5)')
          db.createObjectStore('asset-data', { keyPath: 'id' })
        }
        
        console.log(`✅ IndexedDB upgrade completed to version ${newVersion}`)
      },
      blocked() {
        console.warn('IndexedDB upgrade blocked by another tab/window')
      },
      blocking() {
        console.warn('This tab is blocking IndexedDB upgrade in another tab')
      }
    })
    
    // Configurar listeners después de que la base de datos esté lista
    this.db.then(() => {
      this.setupOnlineListener()
      this.setupAutoSync()
      console.log('IndexedDB successfully initialized')
    }).catch(error => {
      console.error('Failed to initialize IndexedDB:', error)
    })
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
  
  // Cachear lista de schedules pendientes
  async cacheChecklistSchedules(schedules: any[], filters: string = 'pendiente') {
    const db = await this.getDB()
    if (!db) return

    await db.put('checklist-schedules', {
      id: `schedules-${filters}`,
      schedules,
      lastUpdated: Date.now(),
      filters
    })

    this.emit('cache-update', { type: 'schedules', count: schedules.length })
    if (process.env.NODE_ENV === 'development') {
      console.log(`📋 Cacheados ${schedules.length} schedules con filtro: ${filters}`)
    }
  }

  // Obtener schedules desde cache
  async getCachedChecklistSchedules(filters: string = 'pendiente') {
    const db = await this.getDB()
    if (!db) return null

    const cached = await db.get('checklist-schedules', `schedules-${filters}`)
    
    // Verificar si el cache no es muy antiguo (máximo 2 horas)
    if (cached && Date.now() - cached.lastUpdated < 2 * 60 * 60 * 1000) {
      return cached.schedules
    }

    return null
  }

  // Cachear lista de templates
  async cacheChecklistTemplates(templates: any[]) {
    const db = await this.getDB()
    if (!db) return

    await db.put('checklist-lists', {
      id: 'templates',
      templates,
      lastUpdated: Date.now()
    })

    this.emit('cache-update', { type: 'templates', count: templates.length })
    if (process.env.NODE_ENV === 'development') {
      console.log(`📝 Cacheados ${templates.length} templates`)
    }
  }

  // Obtener templates desde cache
  async getCachedChecklistTemplates() {
    const db = await this.getDB()
    if (!db) return null

    const cached = await db.get('checklist-lists', 'templates')
    
    // Verificar si el cache no es muy antiguo (máximo 4 horas)
    if (cached && Date.now() - cached.lastUpdated < 4 * 60 * 60 * 1000) {
      return cached.templates
    }

    return null
  }

  // Cache proactivo de checklist completo al acceder
  async proactivelyCacheChecklist(scheduleId: string) {
    if (!navigator.onLine) return

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from('checklist_schedules')
        .select(`
          *,
          checklists (
            *,
            checklist_sections (
              *,
              checklist_items (*)
            ),
            equipment_models (
              id, 
              name, 
              manufacturer
            )
          ),
          assets (
            id,
            name,
            asset_id,
            location
          )
        `)
        .eq('id', scheduleId)
        .single()

      if (!error && data) {
        await this.cacheChecklistTemplate(scheduleId, data, data.assets)
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 Cache proactivo completado para checklist ${scheduleId}`)
        }
        return true
      }
    } catch (error) {
      console.error('Error en cache proactivo:', error)
    }

    return false
  }

  // Cache masivo de checklists pendientes (para preparar modo offline)
  async massiveCachePreparation() {
    if (!navigator.onLine) return

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Obtener todos los checklists pendientes
      const { data: schedules, error } = await supabase
        .from('checklist_schedules')
        .select(`
          *,
          checklists (
            *,
            checklist_sections (
              *,
              checklist_items (*)
            ),
            equipment_models (
              id, 
              name, 
              manufacturer
            )
          ),
          assets (
            id,
            name,
            asset_id,
            location
          )
        `)
        .eq('status', 'pendiente')
        .limit(20) // Limitar a 20 para no sobrecargar

      if (!error && schedules) {
        let cached = 0
        for (const schedule of schedules) {
          await this.cacheChecklistTemplate(schedule.id, schedule, schedule.assets)
          cached++
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`🏗️ Preparación masiva completada: ${cached} checklists cacheados`)
        }
        this.emit('cache-update', { type: 'massive', count: cached })
        return cached
      }
    } catch (error) {
      console.error('Error en preparación masiva:', error)
    }

    return 0
  }

  // Verificar disponibilidad offline de un checklist
  async isChecklistAvailableOffline(scheduleId: string) {
    const cached = await this.getCachedChecklistTemplate(scheduleId)
    return cached !== null
  }

  // Obtener lista de checklists disponibles offline
  async getAvailableOfflineChecklists() {
    const db = await this.getDB()
    if (!db) return []

    const cached = await db.getAll('checklist-templates')
    return cached.map(item => ({
      id: item.id,
      template: item.template,
      asset: item.asset,
      lastUpdated: item.lastUpdated,
      isRecent: Date.now() - item.lastUpdated < 24 * 60 * 60 * 1000 // Menos de 24 horas
    }))
  }
  
  // Guardar plantilla de checklist para uso offline
  async cacheChecklistTemplate(scheduleId: string, templateData: any, assetData: any) {
    const db = await this.getDB()
    if (!db) return
    
    // Ensure we cache the template with version information
    const templateToCache = {
      ...templateData,
      // If template has version info, preserve it; otherwise add compatibility
      template_version_id: templateData.template_version_id || null,
      version_compatible: true, // Mark as compatible with versioning system
      cache_timestamp: Date.now()
    }
    
    await db.put('checklist-templates', {
      id: scheduleId,
      template: templateToCache,
      asset: assetData,
      lastUpdated: Date.now()
    })
    
    // Log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Cached checklist template with version compatibility:', {
        scheduleId,
        hasVersionId: !!templateData.template_version_id,
        templateName: templateData.checklists?.name || templateData.name
      })
    }
  }
  
  // Enhanced function to get cached template with version awareness
  async getCachedChecklistTemplateVersioned(scheduleId: string) {
    const cached = await this.getCachedChecklistTemplate(scheduleId)
    if (!cached) return null

    // Check if this cached template is compatible with versioning
    const template = cached.template
    
    // Add version compatibility if missing
    if (!template.version_compatible) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Upgrading cached template for version compatibility:', scheduleId)
      }
      template.version_compatible = true
      template.template_version_id = template.template_version_id || null
      
      // Re-cache with updated compatibility
      await this.cacheChecklistTemplate(scheduleId, template, cached.asset)
    }

    return cached
  }

  // Function to handle offline completion with versioning
  async saveOfflineChecklistVersioned(id: string, data: any, templateVersionId?: string) {
    const db = await this.getDB()
    if (!db) return
    
    // Enhance the data with version information
    const enhancedData = {
      ...data,
      template_version_id: templateVersionId || data.template_version_id || null,
      version_aware: true, // Mark as version-aware completion
      offline_completion: true
    }
    
    await db.put('offline-checklists', {
      id,
      data: enhancedData,
      synced: false,
      timestamp: Date.now(),
      retryCount: 0,
      lastAttempt: undefined,
      error: undefined
    })
    
    console.log('💾 Saved offline checklist with version awareness:', {
      id,
      templateVersionId: enhancedData.template_version_id,
      hasVersionInfo: !!enhancedData.template_version_id
    })
    
    // Emitir evento de actualización de stats
    this.emit('stats-update', await this.getSyncStats())
    
    // Intentar sincronizar inmediatamente si hay conexión
    if (this.isClient && navigator.onLine) {
      setTimeout(() => this.syncSingleVersioned(id), 1000)
    }
  }

  // Enhanced sync function that handles versioning
  async syncSingleVersioned(id: string) {
    const db = await this.getDB()
    if (!db) return false
    
    try {
      const item = await db.get('offline-checklists', id)
      if (!item || item.synced) return true
      
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      // Use the versioned completion function if available
      const functionName = item.data.version_aware 
        ? 'mark_checklist_as_completed_versioned'
        : 'mark_checklist_as_completed'
      
      console.log(`🔄 Syncing checklist ${id} using ${functionName}`)
      
      let result
      if (functionName === 'mark_checklist_as_completed_versioned') {
        // Use new versioned function
        const { data, error } = await supabase.rpc(functionName, {
          p_schedule_id: item.data.schedule_id,
          p_completed_items: item.data.completed_items,
          p_technician: item.data.technician,
          p_notes: item.data.notes || null,
          p_signature_data: item.data.signature_data || null
        })
        result = { data, error }
      } else {
        // Use legacy function for backward compatibility
        const { data, error } = await supabase.rpc(functionName, {
          p_schedule_id: item.data.schedule_id,
          p_completed_items: item.data.completed_items,
          p_technician: item.data.technician,
          p_notes: item.data.notes || null
        })
        result = { data, error }
      }

      if (result.error) {
        await this.incrementRetryCount(id, result.error.message)
        this.emit('sync-error', { id, error: result.error })
        return false
      }

      await this.markAsSynced(id)
      this.emit('sync-complete', { id, result: result.data })
      console.log(`✅ Successfully synced checklist ${id}`)
      
      return true
    } catch (error) {
      console.error(`❌ Error syncing checklist ${id}:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.incrementRetryCount(id, errorMessage)
      this.emit('sync-error', { id, error })
      return false
    }
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
      setTimeout(() => this.syncSingleVersioned(id), 1000)
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
          const success = await this.syncSingleVersioned(item.id)
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
  
  // Obtener estadísticas de sincronización con fotos
  async getSyncStats() {
    try {
      const db = await this.getDB()
      if (!db) return { 
        total: 0, 
        synced: 0, 
        pending: 0, 
        failed: 0, 
        photos: { total: 0, uploaded: 0, pending: 0, failed: 0 } 
      }
      
      // Verificar que todos los object stores existan antes de accederlos
      const storeNames = db.objectStoreNames
      if (!storeNames.contains('offline-checklists') || !storeNames.contains('offline-photos')) {
        console.warn('Database not fully initialized, returning empty stats')
        return { 
          total: 0, 
          synced: 0, 
          pending: 0, 
          failed: 0, 
          photos: { total: 0, uploaded: 0, pending: 0, failed: 0 } 
        }
      }
      
      const all = await db.getAll('offline-checklists')
      const allPhotos = await db.getAll('offline-photos')
      
      const stats = {
        total: all.length,
        synced: all.filter(item => item.synced).length,
        pending: all.filter(item => !item.synced && item.retryCount < 5).length,
        failed: all.filter(item => !item.synced && item.retryCount >= 5).length,
        photos: {
          total: allPhotos.length,
          uploaded: allPhotos.filter(photo => photo.uploaded).length,
          pending: allPhotos.filter(photo => !photo.uploaded && photo.retryCount < 5).length,
          failed: allPhotos.filter(photo => !photo.uploaded && photo.retryCount >= 5).length
        }
      }

      // Emitir evento de actualización
      this.emit('stats-update', stats)
      
      return stats
    } catch (error) {
      console.error('Error getting sync stats:', error)
      return { 
        total: 0, 
        synced: 0, 
        pending: 0, 
        failed: 0, 
        photos: { total: 0, uploaded: 0, pending: 0, failed: 0 } 
      }
    }
  }
  
  // Sincronizar todos los checklists pendientes incluyendo fotos
  async syncAll() {
    if (!this.isClient || !navigator.onLine) {
      console.log('Sin conexión, sincronización cancelada')
      this.emit('sync-error', { message: 'Sin conexión a internet' })
      return { success: false, message: 'Sin conexión a internet' }
    }
    
    try {
      // Primero sincronizar todas las fotos pendientes
      console.log('🔄 Iniciando sincronización de fotos...')
      const photoResult = await this.uploadAllPendingPhotos()
      console.log(`📸 Fotos sincronizadas: ${photoResult.success} exitosas, ${photoResult.errors} errores`)
      
      // Luego sincronizar checklists
      console.log('🔄 Iniciando sincronización de checklists...')
      const result = await this.syncPendingWithRetry()
      
      const pending = await this.getPendingSyncs()
      const failed = pending.filter(item => item.retryCount >= 5)
      
      const syncResult = {
        success: pending.length === 0,
        synced: result?.success || 0,
        failed: failed.length,
        errors: result?.errors || 0,
        photosSynced: photoResult.success,
        photosErrors: photoResult.errors,
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
      return this.syncSingleVersioned(id)
    }
    
    return false
  }
  
  // Cache asset data for offline use
  async cacheAssetData(assetId: string, assetData: any) {
    try {
      const db = await this.getDB()
      if (!db) {
        console.warn('📦 Cannot cache asset data: database not available')
        return
      }

      // Check if the object store exists
      if (!db.objectStoreNames.contains('asset-data')) {
        console.error('📦 Asset data store not found - database may need upgrade')
        return
      }

      await db.put('asset-data', {
        id: assetId,
        assetData,
        lastUpdated: Date.now()
      })

      console.log('📦 Asset data cached:', assetId)
    } catch (error) {
      console.error('📦 Error caching asset data:', error)
      // Don't throw - this is a cache operation that shouldn't break the main flow
    }
  }

  // Get cached asset data
  async getCachedAssetData(assetId: string) {
    try {
      const db = await this.getDB()
      if (!db) {
        console.warn('📦 Cannot get cached asset data: database not available')
        return null
      }

      // Check if the object store exists
      if (!db.objectStoreNames.contains('asset-data')) {
        console.warn('📦 Asset data store not found - returning null')
        return null
      }

      const cached = await db.get('asset-data', assetId)
      if (!cached) {
        console.log('📦 No cached data found for asset:', assetId)
        return null
      }

      // Check if cache is still fresh (4 hours)
      const maxAge = 4 * 60 * 60 * 1000 // 4 horas
      if (Date.now() - cached.lastUpdated > maxAge) {
        console.log('🗂️ Asset cache expired for:', assetId)
        return null
      }

      console.log('📦 Asset data retrieved from cache:', assetId)
      return cached.assetData
    } catch (error) {
      console.error('📦 Error getting cached asset data:', error)
      return null
    }
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

    // Limpiar schedules cache antiguo
    const schedules = await db.getAll('checklist-schedules')
    for (const schedule of schedules) {
      if (schedule.lastUpdated < thirtyDaysAgo) {
        await db.delete('checklist-schedules', schedule.id)
        cleaned++
      }
    }

    // Limpiar templates cache antiguo
    const lists = await db.getAll('checklist-lists')
    for (const list of lists) {
      if (list.lastUpdated < thirtyDaysAgo) {
        await db.delete('checklist-lists', list.id)
        cleaned++
      }
    }

    // Limpiar asset data cache antiguo
    const assets = await db.getAll('asset-data')
    for (const asset of assets) {
      if (asset.lastUpdated < thirtyDaysAgo) {
        await db.delete('asset-data', asset.id)
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

  // Guardar una foto offline
  async savePhotoOffline(checklistId: string, itemId: string, file: File): Promise<string> {
    const db = await this.getDB()
    if (!db) throw new Error('Database not available')
    
    const photoId = `photo-${checklistId}-${itemId}-${Date.now()}`
    
    await db.put('offline-photos', {
      id: photoId,
      checklistId,
      itemId,
      file: file,
      fileName: file.name,
      uploaded: false,
      retryCount: 0,
      timestamp: Date.now()
    })
    
    this.emit('photo-upload', { photoId, checklistId, itemId })
    
    // Intentar subir inmediatamente si hay conexión
    if (this.isClient && navigator.onLine) {
      setTimeout(() => this.uploadPendingPhoto(photoId), 1000)
    }
    
    return photoId
  }
  
  // Obtener fotos pendientes de subida para un checklist
  async getPendingPhotos(checklistId?: string) {
    const db = await this.getDB()
    if (!db) return []
    
    const allPhotos = await db.getAll('offline-photos')
    
    return allPhotos.filter(photo => 
      !photo.uploaded && 
      photo.retryCount < 5 &&
      (!checklistId || photo.checklistId === checklistId)
    )
  }
  
  // Subir una foto específica
  async uploadPendingPhoto(photoId: string): Promise<boolean> {
    try {
      const db = await this.getDB()
      if (!db) return false
      
      const photo = await db.get('offline-photos', photoId)
      if (!photo || photo.uploaded) return true
      
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      // Generar nombre único para el archivo
      const fileName = `checklist_${photo.checklistId}_item_${photo.itemId}_${Date.now()}.${photo.fileName.split('.').pop()}`
      
      const { error: uploadError } = await supabase.storage
        .from('checklist-photos')
        .upload(fileName, photo.file)
      
      if (uploadError) {
        console.error('Error uploading photo:', uploadError)
        photo.retryCount = (photo.retryCount || 0) + 1
        photo.uploadError = uploadError.message
        await db.put('offline-photos', photo)
        return false
      }
      
      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('checklist-photos')
        .getPublicUrl(fileName)
      
      // Marcar como subida exitosamente
      photo.uploaded = true
      photo.uploadUrl = urlData.publicUrl
      photo.uploadError = undefined
      await db.put('offline-photos', photo)
      
      this.emit('photo-sync', { photoId, url: urlData.publicUrl })
      
      console.log(`✅ Photo ${photoId} uploaded successfully`)
      return true
      
    } catch (error: any) {
      console.error(`💥 Error uploading photo ${photoId}:`, error)
      
      const db = await this.getDB()
      if (db) {
        const photo = await db.get('offline-photos', photoId)
        if (photo) {
          photo.retryCount = (photo.retryCount || 0) + 1
          photo.uploadError = error.message
          await db.put('offline-photos', photo)
        }
      }
      
      return false
    }
  }
  
  // Subir todas las fotos pendientes
  async uploadAllPendingPhotos(): Promise<{ success: number, errors: number }> {
    const pendingPhotos = await this.getPendingPhotos()
    let successCount = 0
    let errorCount = 0
    
    for (const photo of pendingPhotos) {
      const success = await this.uploadPendingPhoto(photo.id)
      if (success) {
        successCount++
      } else {
        errorCount++
        // Esperar un poco entre subidas fallidas
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    return { success: successCount, errors: errorCount }
  }
  
  // Obtener URL de foto (subida o local)
  async getPhotoUrl(photoId: string): Promise<string | null> {
    const db = await this.getDB()
    if (!db) return null
    
    const photo = await db.get('offline-photos', photoId)
    if (!photo) return null
    
    if (photo.uploaded && photo.uploadUrl) {
      return photo.uploadUrl
    }
    
    // Crear URL blob para vista previa local
    return URL.createObjectURL(photo.file)
  }

  // Verificar si la base de datos está completamente inicializada
  async isDatabaseReady(): Promise<boolean> {
    try {
      const db = await this.getDB()
      if (!db) return false
      
      const storeNames = db.objectStoreNames
      
      return storeNames.contains('offline-checklists') &&
             storeNames.contains('checklist-templates') &&
             storeNames.contains('checklist-schedules') &&
             storeNames.contains('checklist-lists') &&
             storeNames.contains('offline-photos')
    } catch (error) {
      console.error('Error checking database readiness:', error)
      return false
    }
  }

  // Esperar hasta que la base de datos esté lista
  async waitForDatabase(maxWaitMs = 5000): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.isDatabaseReady()) {
        return true
      }
      
      // Esperar 100ms antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.warn('Database initialization timeout')
    return false
  }
}

export const offlineChecklistService = new OfflineChecklistService() 