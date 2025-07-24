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
  'unresolved-issues': {
    key: string
    value: {
      id: string
      tempChecklistId?: string // For offline checklists
      checklistId: string
      assetId: string
      assetName: string
      issues: Array<{
        id: string
        description: string
        notes: string
        photo: string | null
        status: "flag" | "fail"
        sectionTitle?: string
        sectionType?: string
      }>
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
      asset_id?: string
      timestamp: number
      synced: boolean
      retryCount: number
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
    
    this.db = openDB<ChecklistDB>('checklists-offline', 6, {
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
        
        // Store para versión 5: asset data cache
        if (!db.objectStoreNames.contains('asset-data')) {
          console.log('📦 Creating asset-data store (v5)')
          db.createObjectStore('asset-data', { keyPath: 'id' })
        }
        
        // Nuevos stores para versión 6: unresolved issues and offline work orders
        if (!db.objectStoreNames.contains('unresolved-issues')) {
          console.log('📦 Creating unresolved-issues store (v6)')
          db.createObjectStore('unresolved-issues', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('offline-work-orders')) {
          console.log('📦 Creating offline-work-orders store (v6)')
          db.createObjectStore('offline-work-orders', { keyPath: 'id' })
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
      
      const dbClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      // Use the current endpoint instead of RPC functions to avoid session issues
      console.log(`🔄 Syncing checklist ${id} using API endpoint`)
      
      // Prepare submission data matching the API endpoint structure
      const submissionData = {
        completed_items: item.data.completed_items,
        technician: item.data.technician,
        notes: item.data.notes || null,
        signature: item.data.signature_data || null,
        hours_reading: item.data.hours_reading || null,
        kilometers_reading: item.data.kilometers_reading || null,
        evidence_data: item.data.evidence_data || {}
      }
      
      console.log(`📤 Sending submission data for ${id}:`, submissionData)
      
      // Use fetch with authentication headers from Zustand auth store
      const { authStore } = await import('@/store')
      const authState = authStore.getState()
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      // Add auth header if we have a session from Zustand store
      if (authState.session?.access_token) {
        headers['Authorization'] = `Bearer ${authState.session.access_token}`
        console.log('🔐 Using Zustand auth token for checklist sync')
      } else {
        console.warn('⚠️ No auth token available in Zustand store for checklist sync')
      }
      
      const response = await fetch(`/api/checklists/schedules/${item.data.schedule_id}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify(submissionData)
      })
      
      let result
      if (response.ok) {
        const data = await response.json()
        result = { data, error: null }
        
        // Check if this was a duplicate prevention response
        if (data.data?.is_duplicate_prevented) {
          console.log(`✅ Duplicate prevented for checklist ${id} - treating as successful sync:`, {
            originalCompletionDate: data.data.original_completion_date,
            timeDifference: data.data.time_difference_minutes
          })
        }
      } else {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }
        result = { data: null, error: errorData }
        console.error(`❌ API Error for checklist ${id}:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
      }

      if (result.error) {
        console.error(`❌ Sync error for checklist ${id}:`, result.error)
        
        // Check if it's a 404 or authentication error - if so, clean up the item
        if (result.error.message?.includes('404') || 
            result.error.message?.includes('not found') ||
            result.error.error?.includes('not found') ||
            result.error.message?.includes('unauthorized') ||
            result.error.error?.includes('Checklist programado no encontrado') ||
            result.error.message?.includes('undefined')) {
          console.warn(`🧹 Cleaning up invalid checklist data: ${id}`)
          await this.markAsSynced(id) // Mark as synced to remove from retry queue
          
          // Trigger automatic cleanup of similar corrupted data
          setTimeout(() => {
            this.cleanCorruptedData().then(cleaned => {
              if (cleaned.indexedDB > 0 || cleaned.localStorage > 0) {
                console.log(`🧹 Auto-cleanup triggered: removed ${cleaned.indexedDB + cleaned.localStorage} corrupted items`)
              }
            })
          }, 1000)
          
          return true // Consider this a "success" to avoid infinite retries
        }
        
        await this.incrementRetryCount(id, result.error.message || JSON.stringify(result.error))
        this.emit('sync-error', { id, error: result.error })
        return false
      }

      await this.markAsSynced(id)
      
      // If this was an offline checklist and we got a completed_id back, update any pending work orders
      console.log('🔍 Checking for ID mapping conditions:', {
        hasCompletedId: !!result.data?.completed_id,
        completedId: result.data?.completed_id,
        hasOfflineId: !!item.data?.completed_checklist_id,
        offlineId: item.data?.completed_checklist_id,
        scheduleId: item.data?.schedule_id,
        offlineChecklistId: id
      })
      
      if (result.data?.completed_id) {
        let offlineChecklistId = item.data?.completed_checklist_id
        
        // If no explicit completed_checklist_id, derive it from the offline checklist ID
        if (!offlineChecklistId && id.startsWith('checklist-')) {
          // Try to extract from the offline checklist record ID
          const scheduleMatch = id.match(/checklist-([a-f0-9-]+)-\d+/)
          if (scheduleMatch) {
            offlineChecklistId = `checklist-offline-${scheduleMatch[1]}-${item.timestamp}`
            console.log(`🔍 Derived offline checklist ID: ${offlineChecklistId}`)
          }
        }
        
        // Also try to map using the current offline checklist ID pattern if it matches
        if (!offlineChecklistId && id.includes('checklist-')) {
          // Check if this ID follows the offline pattern
          const offlinePattern = /checklist-([a-f0-9-]+)-(\d+)/
          const match = id.match(offlinePattern)
          if (match) {
            offlineChecklistId = `checklist-offline-${match[1]}-${match[2]}`
            console.log(`🔍 Pattern-derived offline checklist ID: ${offlineChecklistId}`)
          }
        }
        
        if (offlineChecklistId) {
          console.log(`🔄 Mapping offline completed checklist ID: ${offlineChecklistId} -> ${result.data.completed_id}`)
          await this.updateWorkOrderChecklistIds(offlineChecklistId, result.data.completed_id)
        } else {
          console.warn(`⚠️ No offline checklist ID found for mapping, offline ID: ${id}`)
          
          // Fallback: try to map using the schedule ID pattern
          if (item.data?.schedule_id) {
            const fallbackOfflineId = `checklist-offline-${item.data.schedule_id}-${item.timestamp}`
            console.log(`🔄 Fallback mapping using schedule ID: ${fallbackOfflineId} -> ${result.data.completed_id}`)
            await this.updateWorkOrderChecklistIds(fallbackOfflineId, result.data.completed_id)
          }
        }
      }
      
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
    
    // Validate data before saving to prevent corruption
    if (!data || !data.schedule_id || data.schedule_id === 'undefined') {
      console.error('❌ Attempted to save offline checklist with invalid schedule_id:', {
        id,
        scheduleId: data?.schedule_id,
        hasData: !!data
      })
      throw new Error('Invalid schedule_id: cannot save offline checklist without valid schedule ID')
    }
    
    if (!data.completed_items || !Array.isArray(data.completed_items) || data.completed_items.length === 0) {
      console.error('❌ Attempted to save offline checklist with invalid completed_items:', {
        id,
        hasCompletedItems: !!data.completed_items,
        completedItemsCount: Array.isArray(data.completed_items) ? data.completed_items.length : 0
      })
      throw new Error('Invalid completed_items: cannot save offline checklist without completed items')
    }
    
    if (!data.technician || typeof data.technician !== 'string') {
      console.error('❌ Attempted to save offline checklist with invalid technician:', {
        id,
        technician: data.technician,
        hasValidTechnician: typeof data.technician === 'string'
      })
      throw new Error('Invalid technician: cannot save offline checklist without valid technician name')
    }
    
    console.log('✅ Saving valid offline checklist:', {
      id,
      scheduleId: data.schedule_id,
      technician: data.technician,
      completedItemsCount: data.completed_items.length
    })
    
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
      
      // Luego sincronizar checklists ANTES que las órdenes de trabajo
      console.log('🔄 Iniciando sincronización de checklists...')
      const result = await this.syncPendingWithRetry()
      
      // Esperar un momento para que las actualizaciones de IDs se propaguen
      console.log('⏱️ Esperando propagación de checklists completados...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Finally sync offline work orders AFTER checklists are synced
      console.log('🔄 Iniciando sincronización de órdenes de trabajo...')
      const workOrderResult = await this.syncOfflineWorkOrders()
      console.log(`🔧 Órdenes de trabajo sincronizadas: ${workOrderResult.success} exitosas, ${workOrderResult.errors} errores`)
      
      const pending = await this.getPendingSyncs()
      const failed = pending.filter(item => item.retryCount >= 5)
      
      const syncResult = {
        success: pending.length === 0,
        synced: result?.success || 0,
        failed: failed.length,
        errors: result?.errors || 0,
        photosSynced: photoResult.success,
        photosErrors: photoResult.errors,
        workOrdersSynced: workOrderResult.success,
        workOrdersErrors: workOrderResult.errors,
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

  // Clean up invalid/corrupted data
  async cleanCorruptedData() {
    const db = await this.getDB()
    if (!db) return { indexedDB: 0, localStorage: 0 }

    let cleaned = 0

    try {
      // Clean checklists with invalid data
      const allChecklists = await db.getAll('offline-checklists')
      console.log(`🔍 Checking ${allChecklists.length} offline checklists for corruption`)
      
      const invalidChecklists = allChecklists.filter(item => {
        const isInvalid = !item.data || 
                         !item.data.schedule_id || 
                         item.data.schedule_id === 'undefined' ||
                         !item.data.completed_items ||
                         !Array.isArray(item.data.completed_items) ||
                         item.data.completed_items.length === 0
        
        if (isInvalid) {
          console.log(`❌ Found corrupted checklist:`, {
            id: item.id,
            hasData: !!item.data,
            scheduleId: item.data?.schedule_id,
            hasCompletedItems: !!item.data?.completed_items,
            completedItemsCount: Array.isArray(item.data?.completed_items) ? item.data.completed_items.length : 0,
            timestamp: new Date(item.timestamp).toISOString()
          })
        }
        
        return isInvalid
      })

      for (const item of invalidChecklists) {
        await db.delete('offline-checklists', item.id)
        cleaned++
      }

      // Clean work orders with invalid data
      const allWorkOrders = await db.getAll('offline-work-orders')
      console.log(`🔍 Checking ${allWorkOrders.length} offline work orders for corruption`)
      
      const invalidWorkOrders = allWorkOrders.filter(wo => {
        // Check if this references a schedule ID instead of a completed checklist ID
        // Schedule IDs are typically UUIDs (36 chars with dashes), completed checklist IDs start with 'checklist-'
        const isScheduleIdInsteadOfChecklistId = wo.checklistId && 
          wo.checklistId.includes('-') && 
          wo.checklistId.length === 36 &&
          !wo.checklistId.startsWith('checklist-')
        
        const isInvalid = !wo.checklistId || 
                         wo.checklistId === 'undefined' ||
                         isScheduleIdInsteadOfChecklistId ||
                         !wo.issues || 
                         !Array.isArray(wo.issues) ||
                         wo.issues.length === 0 ||
                         !wo.asset_id ||
                         wo.asset_id === 'undefined'
        
        if (isInvalid) {
          console.log(`❌ Found corrupted work order:`, {
            id: wo.id,
            checklistId: wo.checklistId,
            hasIssues: !!wo.issues,
            issuesCount: Array.isArray(wo.issues) ? wo.issues.length : 0,
            assetId: wo.asset_id,
            isScheduleId: isScheduleIdInsteadOfChecklistId,
            timestamp: new Date(wo.timestamp).toISOString()
          })
        }
        
        return isInvalid
      })

      for (const workOrder of invalidWorkOrders) {
        await db.delete('offline-work-orders', workOrder.id)
        cleaned++
      }

      // Clean orphaned photos
      const allPhotos = await db.getAll('offline-photos')
      const orphanedPhotos = allPhotos.filter(photo => 
        !photo.checklistId || !photo.itemId
      )

      for (const photo of orphanedPhotos) {
        await db.delete('offline-photos', photo.id)
        cleaned++
      }

      console.log(`🧹 Cleaned ${cleaned} corrupted IndexedDB items`)
      
      // Also clean localStorage corrupted data
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith('offline-work-orders-') || 
        key.startsWith('checklist-draft-') ||
        key.startsWith('unresolved-issues-')
      )

      let localStorageCleaned = 0
      for (const key of keys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          
          // Check for corrupted work orders
          if (key.startsWith('offline-work-orders-')) {
            // Check if this references a schedule ID instead of a completed checklist ID
            const isScheduleIdInsteadOfChecklistId = data.checklist_id && 
              data.checklist_id.includes('-') && 
              data.checklist_id.length === 36 &&
              !data.checklist_id.startsWith('checklist-')
            
            const isInvalid = !data || 
                             !data.checklist_id || 
                             data.checklist_id === 'undefined' ||
                             isScheduleIdInsteadOfChecklistId ||
                             !data.items_with_issues || 
                             !Array.isArray(data.items_with_issues) ||
                             data.items_with_issues.length === 0 ||
                             !data.asset_id ||
                             data.asset_id === 'undefined'
            
            if (isInvalid) {
              console.log(`❌ Removing corrupted localStorage work order:`, {
                key,
                checklistId: data?.checklist_id,
                hasItems: !!data?.items_with_issues,
                itemsCount: Array.isArray(data?.items_with_issues) ? data.items_with_issues.length : 0,
                assetId: data?.asset_id,
                isScheduleId: isScheduleIdInsteadOfChecklistId
              })
              localStorage.removeItem(key)
              localStorageCleaned++
              continue
            }
          }
          
          // Check for empty or corrupted data
          if (!data || Object.keys(data).length === 0) {
            localStorage.removeItem(key)
            localStorageCleaned++
          }
        } catch (error) {
          // Remove corrupted JSON data
          console.log(`❌ Removing corrupted localStorage item:`, key, error)
          localStorage.removeItem(key)
          localStorageCleaned++
        }
      }

      console.log(`🧹 Cleaned ${localStorageCleaned} corrupted localStorage items`)
      
      this.emit('cache-update', { 
        cleaned: true, 
        indexedDB: cleaned, 
        localStorage: localStorageCleaned 
      })
      
      return { indexedDB: cleaned, localStorage: localStorageCleaned }
      
    } catch (error) {
      console.error('Error cleaning corrupted data:', error)
      return { indexedDB: 0, localStorage: 0 }
    }
  }

  // Update work orders that reference an offline checklist ID to use the real completed checklist ID
  async updateWorkOrderChecklistIds(offlineChecklistId: string, completedChecklistId: string) {
    const db = await this.getDB()
    if (!db) return

    try {
      // Save the ID mapping for future reference
      const mappingKey = `checklist-id-mapping-${offlineChecklistId}`
      localStorage.setItem(mappingKey, completedChecklistId)
      console.log(`💾 Saved checklist ID mapping: ${offlineChecklistId} -> ${completedChecklistId}`)

      // Update IndexedDB work orders
      const allWorkOrders = await db.getAll('offline-work-orders')
      let updated = 0

      for (const workOrder of allWorkOrders) {
        if (workOrder.checklistId === offlineChecklistId) {
          console.log(`🔄 Updating work order ${workOrder.id}: ${offlineChecklistId} -> ${completedChecklistId}`)
          
          const updatedWorkOrder = {
            ...workOrder,
            checklistId: completedChecklistId
          }
          
          await db.put('offline-work-orders', updatedWorkOrder)
          updated++
        }
      }

      // Update localStorage work orders
      const keys = Object.keys(localStorage).filter(key => key.startsWith('offline-work-orders-'))
      
      for (const key of keys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          
          if (data.checklist_id === offlineChecklistId) {
            console.log(`🔄 Updating localStorage work order ${key}: ${offlineChecklistId} -> ${completedChecklistId}`)
            
            const updatedData = {
              ...data,
              checklist_id: completedChecklistId
            }
            
            localStorage.setItem(key, JSON.stringify(updatedData))
            updated++
          }
        } catch (error) {
          console.error(`❌ Error updating localStorage work order ${key}:`, error)
        }
      }

      if (updated > 0) {
        console.log(`✅ Updated ${updated} work orders to reference completed checklist ${completedChecklistId}`)
      }
    } catch (error) {
      console.error('❌ Error updating work order checklist IDs:', error)
    }
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

  // =====================================================
  // UNRESOLVED ISSUES MANAGEMENT
  // =====================================================

  // Save unresolved issues from a completed checklist
  async saveUnresolvedIssues(
    checklistId: string, 
    issues: any[], 
    assetData: { id: string, name: string },
    tempChecklistId?: string
  ) {
    const db = await this.getDB()
    if (!db) return

    const unresolvedId = `issues-${checklistId}-${Date.now()}`
    
    await db.put('unresolved-issues', {
      id: unresolvedId,
      tempChecklistId,
      checklistId,
      assetId: assetData.id,
      assetName: assetData.name,
      issues,
      timestamp: Date.now(),
      synced: false,
      workOrdersCreated: false
    })

    console.log('💾 Saved unresolved issues:', {
      unresolvedId,
      checklistId,
      tempChecklistId,
      issueCount: issues.length
    })

    this.emit('stats-update', await this.getSyncStats())
  }

  // Get all unresolved issues (offline-first)
  async getUnresolvedIssues(): Promise<any[]> {
    const db = await this.getDB()
    if (!db) return []

    const issues = await db.getAll('unresolved-issues')
    
    // Sort by timestamp (newest first)
    return issues
      .filter(issue => !issue.workOrdersCreated)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(issue => ({
        id: issue.id,
        checklistId: issue.checklistId,
        tempChecklistId: issue.tempChecklistId,
        assetId: issue.assetId,
        assetName: issue.assetName,
        issueCount: issue.issues.length,
        timestamp: issue.timestamp,
        synced: issue.synced
      }))
  }

  // Get detailed unresolved issues by ID
  async getUnresolvedIssueDetails(unresolvedId: string) {
    const db = await this.getDB()
    if (!db) return null

    return await db.get('unresolved-issues', unresolvedId)
  }

  // Mark unresolved issues as resolved (work orders created)
  async markIssuesResolved(unresolvedId: string) {
    const db = await this.getDB()
    if (!db) return

    const issue = await db.get('unresolved-issues', unresolvedId)
    if (issue) {
      issue.workOrdersCreated = true
      await db.put('unresolved-issues', issue)
    }
  }

  // Remove unresolved issues (dismissed)
  async removeUnresolvedIssues(unresolvedId: string) {
    const db = await this.getDB()
    if (!db) return

    await db.delete('unresolved-issues', unresolvedId)
    this.emit('stats-update', await this.getSyncStats())
  }

  // Update checklist ID when offline checklist syncs
  async updateUnresolvedIssuesChecklistId(tempChecklistId: string, realChecklistId: string) {
    const db = await this.getDB()
    if (!db) return

    const allIssues = await db.getAll('unresolved-issues')
    const matchingIssues = allIssues.filter(issue => issue.tempChecklistId === tempChecklistId)

    for (const issue of matchingIssues) {
      issue.checklistId = realChecklistId
      issue.tempChecklistId = undefined
      issue.synced = true
      await db.put('unresolved-issues', issue)
    }

    if (matchingIssues.length > 0) {
      console.log(`🔄 Updated ${matchingIssues.length} unresolved issues with real checklist ID: ${realChecklistId}`)
    }
  }

  // =====================================================
  // OFFLINE WORK ORDERS MANAGEMENT
  // =====================================================

  // Save work order data for offline creation
  async saveOfflineWorkOrder(workOrderData: {
    checklistId: string
    issues: any[]
    priority: string
    description: string
    asset_id?: string
  }) {
    const db = await this.getDB()
    if (!db) return

    // Validate data before saving to prevent corruption
    if (!workOrderData.checklistId || workOrderData.checklistId === 'undefined') {
      console.error('❌ Attempted to save offline work order with invalid checklistId:', {
        checklistId: workOrderData.checklistId,
        hasChecklistId: !!workOrderData.checklistId
      })
      throw new Error('Invalid checklistId: cannot save offline work order without valid checklist ID')
    }
    
    if (!workOrderData.issues || !Array.isArray(workOrderData.issues) || workOrderData.issues.length === 0) {
      console.error('❌ Attempted to save offline work order with invalid issues:', {
        hasIssues: !!workOrderData.issues,
        issuesCount: Array.isArray(workOrderData.issues) ? workOrderData.issues.length : 0
      })
      throw new Error('Invalid issues: cannot save offline work order without issues')
    }
    
    if (!workOrderData.asset_id || workOrderData.asset_id === 'undefined') {
      console.error('❌ Attempted to save offline work order with invalid asset_id:', {
        assetId: workOrderData.asset_id,
        hasAssetId: !!workOrderData.asset_id
      })
      throw new Error('Invalid asset_id: cannot save offline work order without valid asset ID')
    }

    const workOrderId = `wo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log('✅ Saving valid offline work order:', {
      id: workOrderId,
      checklistId: workOrderData.checklistId,
      issuesCount: workOrderData.issues.length,
      assetId: workOrderData.asset_id,
      priority: workOrderData.priority
    })
    
    await db.put('offline-work-orders', {
      id: workOrderId,
      ...workOrderData,
      timestamp: Date.now(),
      synced: false,
      retryCount: 0
    })

    console.log('💾 Saved offline work order:', workOrderId)
    this.emit('stats-update', await this.getSyncStats())
    
    return workOrderId
  }

  // Get pending offline work orders
  async getPendingWorkOrders() {
    const db = await this.getDB()
    if (!db) return []

    const workOrders = await db.getAll('offline-work-orders')
    return workOrders.filter(wo => !wo.synced && wo.retryCount < 5)
  }

  // Sync offline work orders when connection is restored
  async syncOfflineWorkOrders() {
    if (!navigator.onLine) return { success: 0, errors: 0 }

    let success = 0
    let errors = 0

    // Sync work orders from IndexedDB (created via saveOfflineWorkOrder method)
    const pending = await this.getPendingWorkOrders()
    
    for (const workOrder of pending) {
      try {
        // Validate offline work order data structure
        if (!workOrder.checklistId || !workOrder.issues || workOrder.issues.length === 0) {
          console.warn(`⚠️ Invalid offline work order data, cleaning up: ${workOrder.id}`, {
            hasChecklistId: !!workOrder.checklistId,
            hasIssues: !!workOrder.issues,
            issuesLength: workOrder.issues?.length || 0
          })
          
          // Remove invalid work order
          await this.markWorkOrderSynced(workOrder.id)
          errors++
          continue
        }
        
        // Extract asset_id from workOrder or from the first issue if available FIRST
        let asset_id = workOrder.asset_id
        if (!asset_id && workOrder.issues && workOrder.issues.length > 0) {
          // Try to extract from checklist data if available
          asset_id = workOrder.issues[0]?.asset_id
        }
        
        if (!asset_id) {
          console.error('❌ No asset_id found for offline work order:', workOrder.id)
          // Mark as synced to prevent infinite retries
          await this.markWorkOrderSynced(workOrder.id)
          errors++
          continue
        }

        // Resolve the checklist ID - check if it's an offline ID that needs mapping
        let checklistId = workOrder.checklistId
        
        // If it's an offline checklist ID, try to find the corresponding completed checklist ID
        if (checklistId.startsWith('checklist-offline-')) {
          console.log(`🔍 Attempting to resolve offline checklist ID: ${checklistId}`)
          
          // Check if we have a mapping in localStorage
          const mappingKey = `checklist-id-mapping-${checklistId}`
          const mappedId = localStorage.getItem(mappingKey)
          
          if (mappedId) {
            console.log(`✅ Found mapped checklist ID: ${checklistId} -> ${mappedId}`)
            checklistId = mappedId
            
            // Update the work order with the resolved ID
            workOrder.checklistId = checklistId
            const db = await this.getDB()
            if (db) {
              await db.put('offline-work-orders', workOrder)
            }
          } else {
            console.warn(`⚠️ No mapping found for offline checklist ID: ${checklistId}`)
            
            // ENHANCED RECOVERY: Try to find a recently completed checklist using smart matching
            const offlineIdMatch = checklistId.match(/checklist-offline-([a-f0-9-]+)-(\d+)/)
            if (offlineIdMatch) {
              const scheduleId = offlineIdMatch[1]
              const timestamp = parseInt(offlineIdMatch[2])
              const offlineDate = new Date(timestamp)
              
              console.log(`🔍 Enhanced recovery for offline checklist:`, {
                scheduleId,
                timestamp,
                offlineDate: offlineDate.toISOString()
              })
              
              // Try to find completed checklist within 10 minutes of the offline timestamp
              try {
                const { authStore: authStore2 } = await import('@/store')
                const authState2 = authStore2.getState()
                
                const supabase = createBrowserClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                )
                
                if (authState2.session?.access_token) {
                  await supabase.auth.setSession({
                    access_token: authState2.session.access_token,
                    refresh_token: authState2.session.refresh_token
                  })
                }
                
                // Get schedule info first
                const { data: scheduleData } = await supabase
                  .from('checklist_schedules')
                  .select('template_id, asset_id')
                  .eq('id', scheduleId)
                  .single()
                
                if (scheduleData) {
                  // Look for completed checklists within 10 minutes of offline timestamp
                  const timeWindow = 10 * 60 * 1000 // 10 minutes in milliseconds
                  const startTime = new Date(timestamp - timeWindow).toISOString()
                  const endTime = new Date(timestamp + timeWindow).toISOString()
                  
                  const { data: nearbyCompletions } = await supabase
                    .from('completed_checklists')
                    .select('id, completion_date, technician')
                    .eq('checklist_id', scheduleData.template_id)
                    .eq('asset_id', scheduleData.asset_id)
                    .gte('completion_date', startTime)
                    .lte('completion_date', endTime)
                    .order('completion_date', { ascending: true })
                  
                  if (nearbyCompletions && nearbyCompletions.length > 0) {
                    const matchedCompletion = nearbyCompletions[0]
                    console.log(`🎯 SMART RECOVERY SUCCESS: Found matching completion:`, {
                      completedId: matchedCompletion.id,
                      completionDate: matchedCompletion.completion_date,
                      technician: matchedCompletion.technician,
                      timeDiffMinutes: Math.abs(new Date(matchedCompletion.completion_date).getTime() - timestamp) / (1000 * 60)
                    })
                    
                    // Create the missing mapping
                    checklistId = matchedCompletion.id
                    localStorage.setItem(mappingKey, checklistId)
                    console.log(`💾 Created recovered mapping: ${checklistId}`)
                    
                    // Update the work order
                    workOrder.checklistId = checklistId
                    const db = await this.getDB()
                    if (db) {
                      await db.put('offline-work-orders', workOrder)
                    }
                  }
                }
              } catch (smartRecoveryError) {
                console.error('❌ Smart recovery failed:', smartRecoveryError)
              }
              
              // Fallback to original schedule-based lookup if smart recovery didn't work
              if (checklistId.startsWith('checklist-offline-')) {
                console.log(`🔍 Falling back to schedule-based lookup for: ${scheduleId}`)
                console.log(`🔍 Trying to find completed checklist for schedule: ${scheduleId}`)
                
                // Query the API to find completed checklists for this schedule
                try {
                // Create authenticated request using Zustand auth store
                const { authStore: authStore1 } = await import('@/store')
                const authState1 = authStore1.getState()
                
                if (!authState1.session?.access_token) {
                  console.warn(`⚠️ No authenticated session in Zustand store - skipping schedule lookup`)
                } else {
                  const response = await fetch(`/api/checklists/schedules/${scheduleId}/completed-checklist`, {
                    headers: {
                      'Authorization': `Bearer ${authState1.session.access_token}`,
                      'Content-Type': 'application/json'
                    }
                  })
                  console.log(`📡 API response status: ${response.status} ${response.statusText}`)
                  
                  if (response.ok) {
                    const completedData = await response.json()
                    console.log(`📡 API response data:`, completedData)
                    
                    if (completedData.completed_checklist_id) {
                      checklistId = completedData.completed_checklist_id
                      console.log(`✅ Found completed checklist via schedule: ${scheduleId} -> ${checklistId}`)
                      
                      // Save this mapping for future use
                      localStorage.setItem(mappingKey, checklistId)
                      
                      // Update the work order
                      workOrder.checklistId = checklistId
                      const db = await this.getDB()
                      if (db) {
                        await db.put('offline-work-orders', workOrder)
                      }
                    } else {
                      console.warn(`⚠️ API response did not contain completed_checklist_id for schedule: ${scheduleId}`)
                    }
                  } else {
                    const errorText = await response.text()
                    console.error(`❌ API call failed: ${response.status} ${response.statusText}`)
                    console.error(`❌ API error response: ${errorText}`)
                  }
                }
              } catch (error) {
                console.error('❌ Error querying for completed checklist:', error)
              }
            }
            }
            
            // If we still don't have a valid ID, try direct database lookup as last resort
            if (checklistId.startsWith('checklist-offline-')) {
              console.log(`🔍 Trying direct database lookup for offline checklist: ${checklistId}`)
              
              try {
                // Try to find any recently completed checklist for this schedule using authenticated client
                const { authStore: authStore3 } = await import('@/store')
                const authState3 = authStore3.getState()
                
                // Create authenticated Supabase client
                const supabase = createBrowserClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                )
                
                // Set auth context if available
                if (authState3.session?.access_token) {
                  await supabase.auth.setSession({
                    access_token: authState3.session.access_token,
                    refresh_token: authState3.session.refresh_token
                  })
                }
                
                const { data: recentChecklists, error: recentError } = await supabase
                  .from('completed_checklists')
                  .select('id, completion_date')
                  .eq('asset_id', asset_id)
                  .order('completion_date', { ascending: false })
                  .limit(5)
                
                if (!recentError && recentChecklists && recentChecklists.length > 0) {
                  // Use the most recent completed checklist
                  const recentId = recentChecklists[0].id
                  console.log(`✅ Found recent completed checklist via direct lookup: ${recentId}`)
                  
                  checklistId = recentId
                  
                  // Save this mapping for future use
                  localStorage.setItem(mappingKey, checklistId)
                  
                  // Update the work order
                  workOrder.checklistId = checklistId
                  const db = await this.getDB()
                  if (db) {
                    await db.put('offline-work-orders', workOrder)
                  }
                } else {
                  console.warn(`⚠️ Cannot resolve offline checklist ID, skipping work order: ${workOrder.id}`)
                  await this.incrementWorkOrderRetryCount(workOrder.id)
                  errors++
                  continue
                }
              } catch (directLookupError) {
                console.error('❌ Direct database lookup failed:', directLookupError)
                console.warn(`⚠️ Cannot resolve offline checklist ID, skipping work order: ${workOrder.id}`)
                await this.incrementWorkOrderRetryCount(workOrder.id)
                errors++
                continue
              }
            }
          }
        }

        // Match the API endpoint's expected data structure
        const requestData = {
          checklist_id: checklistId, // Use the resolved checklist ID (might be mapped from schedule ID)
          items_with_issues: workOrder.issues,
          priority: workOrder.priority,
          description: workOrder.description,
          asset_id: asset_id,
          enable_smart_deduplication: true, // Enable for offline sync to prevent duplicates
          consolidation_window_days: 30,
          consolidation_choices: {}, // Default to consolidate similar issues
          offline_created: true,
          allow_manual_override: false // Don't require user intervention for offline sync
        }

        console.log('🔄 Syncing offline work order (IndexedDB):', {
          id: workOrder.id,
          checklistId: workOrder.checklistId,
          issuesCount: workOrder.issues?.length || 0,
          asset_id: asset_id
        })

        const response = await fetch('/api/checklists/generate-corrective-work-order-enhanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        })

        if (response.ok) {
          const result = await response.json()
          console.log('✅ Offline work order synced successfully (IndexedDB):', result)
          await this.markWorkOrderSynced(workOrder.id)
          success++
        } else {
          const errorText = await response.text()
          console.error('❌ Failed to sync offline work order (IndexedDB):', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            workOrderId: workOrder.id
          })
          
          // If it's a 404 or checklist not found error, clean up this work order
          if (response.status === 404 || 
              errorText.includes('Checklist no encontrado') ||
              errorText.includes('not found')) {
            console.warn(`🧹 Cleaning up invalid work order: ${workOrder.id}`)
            await this.markWorkOrderSynced(workOrder.id) // Remove from retry queue
            
            // Trigger automatic cleanup
            setTimeout(() => {
              this.cleanCorruptedData().then(cleaned => {
                if (cleaned.indexedDB > 0 || cleaned.localStorage > 0) {
                  console.log(`🧹 Work order auto-cleanup triggered: removed ${cleaned.indexedDB + cleaned.localStorage} corrupted items`)
                }
              })
            }, 1000)
          } else {
            await this.incrementWorkOrderRetryCount(workOrder.id)
          }
          errors++
        }
      } catch (error) {
        console.error('❌ Error syncing offline work order (IndexedDB):', error)
        await this.incrementWorkOrderRetryCount(workOrder.id)
        errors++
      }
    }

    // Also sync work orders from localStorage (created via CorrectiveWorkOrderDialog)
    const localStorageResults = await this.syncLocalStorageWorkOrders()
    success += localStorageResults.success
    errors += localStorageResults.errors

    if (success > 0 || errors > 0) {
      console.log(`🔄 Work order sync completed: ${success} success, ${errors} errors`)
      this.emit('stats-update', await this.getSyncStats())
    }

    return { success, errors }
  }

  // Sync work orders stored in localStorage (from CorrectiveWorkOrderDialog)
  async syncLocalStorageWorkOrders() {
    if (!navigator.onLine) return { success: 0, errors: 0 }

    let success = 0
    let errors = 0

    // Get all work orders from IndexedDB to check for duplicates and avoid double processing
    const db = await this.getDB()
    let processedWorkOrders: Set<string> = new Set()
    
    if (db) {
      try {
        const dbWorkOrders = await db.getAll('offline-work-orders')
        // Track processed work orders by their checklist_id and asset_id combination
        dbWorkOrders.forEach(wo => {
          if (wo.checklistId && wo.asset_id) {
            processedWorkOrders.add(`${wo.checklistId}-${wo.asset_id}`)
          }
        })
        console.log(`📊 Found ${processedWorkOrders.size} work orders already processed by IndexedDB`)
      } catch (error) {
        console.warn('Could not get IndexedDB work orders for deduplication:', error)
      }
    }

    // Find all localStorage keys that contain offline work orders
    const keys = Object.keys(localStorage).filter(key => key.startsWith('offline-work-orders-'))
    
    for (const key of keys) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}')
        
        if (!data.checklist_id || !data.items_with_issues || !data.asset_id) {
          console.warn('⚠️ Incomplete offline work order data in localStorage:', key)
          localStorage.removeItem(key) // Clean up incomplete data
          continue
        }

        // Check if this work order was already processed by IndexedDB to avoid duplicates
        const workOrderKey = `${data.checklist_id}-${data.asset_id}`
        if (processedWorkOrders.has(workOrderKey)) {
          console.log(`⚠️ Skipping localStorage work order - already processed by IndexedDB: ${key}`)
          localStorage.removeItem(key) // Clean up duplicate data
          success++ // Count as success since it was already processed
          continue
        }

        // Resolve the checklist ID - check if it's an offline ID that needs mapping  
        let checklistId = data.checklist_id
        
        // If it's an offline checklist ID, try to find the corresponding completed checklist ID
        if (checklistId.startsWith('checklist-offline-')) {
          console.log(`🔍 Attempting to resolve offline checklist ID: ${checklistId}`)
          
          // Check if we have a mapping in localStorage
          const mappingKey = `checklist-id-mapping-${checklistId}`
          const mappedId = localStorage.getItem(mappingKey)
          
          if (mappedId) {
            console.log(`✅ Found mapped checklist ID: ${checklistId} -> ${mappedId}`)
            checklistId = mappedId
            
            // Update the localStorage data with the resolved ID
            const updatedData = { ...data, checklist_id: checklistId }
            localStorage.setItem(key, JSON.stringify(updatedData))
          } else {
            console.warn(`⚠️ No mapping found for offline checklist ID: ${checklistId}`)
            
            // Try to find a recently completed checklist for the same schedule
            const scheduleIdMatch = checklistId.match(/checklist-offline-([a-f0-9-]+)-\d+/)
            if (scheduleIdMatch) {
              const scheduleId = scheduleIdMatch[1]
              console.log(`🔍 Trying to find completed checklist for schedule: ${scheduleId}`)
              
              // Query the API to find completed checklists for this schedule
              try {
                // Create authenticated request using Zustand auth store
                const { authStore: authStore2 } = await import('@/store')
                const authState2 = authStore2.getState()
                
                if (!authState2.session?.access_token) {
                  console.warn(`⚠️ No authenticated session in Zustand store for localStorage API call - skipping schedule lookup`)
                } else {
                  const response = await fetch(`/api/checklists/schedules/${scheduleId}/completed-checklist`, {
                    headers: {
                      'Authorization': `Bearer ${authState2.session.access_token}`,
                      'Content-Type': 'application/json'
                    }
                  })
                  
                  if (response.ok) {
                    const completedData = await response.json()
                    if (completedData.completed_checklist_id) {
                      checklistId = completedData.completed_checklist_id
                      console.log(`✅ Found completed checklist via schedule: ${scheduleId} -> ${checklistId}`)
                      
                      // Save this mapping for future use
                      localStorage.setItem(mappingKey, checklistId)
                      
                      // Update the localStorage data
                      const updatedData = { ...data, checklist_id: checklistId }
                      localStorage.setItem(key, JSON.stringify(updatedData))
                    }
                  } else {
                    const errorText = await response.text()
                    console.error(`❌ localStorage API call failed: ${response.status} ${response.statusText}`)
                    console.error(`❌ localStorage API error: ${errorText}`)
                  }
                }
              } catch (error) {
                console.error('❌ Error querying for completed checklist:', error)
              }
            }
            
            // If we still don't have a valid ID, try direct database lookup as last resort
            if (checklistId.startsWith('checklist-offline-')) {
              console.log(`🔍 Trying direct database lookup for localStorage offline checklist: ${checklistId}`)
              
              try {
                // Try to find any recently completed checklist for this asset using authenticated client
                const { authStore: authStore4 } = await import('@/store')
                const authState4 = authStore4.getState()
                
                // Create authenticated Supabase client
                const supabase = createBrowserClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                )
                
                // Set auth context if available
                if (authState4.session?.access_token) {
                  await supabase.auth.setSession({
                    access_token: authState4.session.access_token,
                    refresh_token: authState4.session.refresh_token
                  })
                }
                
                const { data: recentChecklists, error: recentError } = await supabase
                  .from('completed_checklists')
                  .select('id, completion_date')
                  .eq('asset_id', data.asset_id)
                  .order('completion_date', { ascending: false })
                  .limit(5)
                
                if (!recentError && recentChecklists && recentChecklists.length > 0) {
                  // Use the most recent completed checklist
                  const recentId = recentChecklists[0].id
                  console.log(`✅ Found recent completed checklist via direct lookup: ${recentId}`)
                  
                  checklistId = recentId
                  
                  // Save this mapping for future use
                  localStorage.setItem(mappingKey, checklistId)
                  
                  // Update the localStorage data
                  const updatedData = { ...data, checklist_id: checklistId }
                  localStorage.setItem(key, JSON.stringify(updatedData))
                } else {
                  console.warn(`⚠️ Cannot resolve offline checklist ID, skipping localStorage work order: ${key}`)
                  errors++
                  continue
                }
              } catch (directLookupError) {
                console.error('❌ Direct database lookup failed:', directLookupError)
                console.warn(`⚠️ Cannot resolve offline checklist ID, skipping localStorage work order: ${key}`)
                errors++
                continue
              }
            }
          }
        }

        console.log('🔄 Syncing offline work order (localStorage):', {
          key,
          originalChecklistId: data.checklist_id,
          resolvedChecklistId: checklistId,
          issuesCount: data.items_with_issues?.length || 0,
          asset_id: data.asset_id
        })

        // Check connectivity before attempting the request
        if (!navigator.onLine) {
          console.warn(`📱 Device offline - skipping localStorage work order sync: ${key}`)
          errors++
          continue
        }

        const response = await fetch('/api/checklists/generate-corrective-work-order-enhanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            checklist_id: checklistId, // Use the resolved checklist ID
            enable_smart_deduplication: true, // Enable deduplication for localStorage sync too
            allow_manual_override: false, // Don't require user intervention
            offline_created: true
          })
        })

        if (response.ok) {
          const result = await response.json()
          console.log('✅ Offline work order synced successfully (localStorage):', result)
          localStorage.removeItem(key) // Clean up after successful sync
          success++
        } else {
          const errorText = await response.text()
          console.error('❌ Failed to sync offline work order (localStorage):', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            key: key
          })
          
          // If it's a 404 or checklist not found error, clean up this work order
          if (response.status === 404 || 
              errorText.includes('Checklist no encontrado') ||
              errorText.includes('not found')) {
            console.warn(`🧹 Cleaning up invalid localStorage work order: ${key}`)
            localStorage.removeItem(key) // Remove corrupted data
          }
          
          errors++
        }
      } catch (error) {
        console.error('❌ Error syncing offline work order (localStorage):', error)
        
        // Don't remove data for network errors - keep for retry
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          console.warn(`🌐 Network error during localStorage sync - will retry later: ${key}`)
        } else {
          console.warn(`🧹 Non-network error - cleaning up localStorage work order: ${key}`)
          localStorage.removeItem(key) // Only clean up non-network errors
        }
        
        errors++
      }
    }

    return { success, errors }
  }

  // Mark offline work order as synced
  async markWorkOrderSynced(workOrderId: string) {
    const db = await this.getDB()
    if (!db) return

    const workOrder = await db.get('offline-work-orders', workOrderId)
    if (workOrder) {
      workOrder.synced = true
      await db.put('offline-work-orders', workOrder)
    }
  }

  // Increment retry count for failed work order sync
  async incrementWorkOrderRetryCount(workOrderId: string) {
    const db = await this.getDB()
    if (!db) return

    const workOrder = await db.get('offline-work-orders', workOrderId)
    if (workOrder) {
      workOrder.retryCount = (workOrder.retryCount || 0) + 1
      await db.put('offline-work-orders', workOrder)
    }
  }
}

export const offlineChecklistService = new OfflineChecklistService() 