import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { createBrowserClient } from '@supabase/ssr'

interface DieselDB extends DBSchema {
  'offline-diesel-transactions': {
    key: string
    value: {
      id: string
      transactionData: any
      synced: boolean
      timestamp: number
      retryCount: number
      lastAttempt?: number
      error?: string
    }
  }
  'offline-diesel-photos': {
    key: string
    value: {
      id: string
      transactionId: string
      evidenceType: string
      category: string
      file: Blob
      fileName: string
      uploaded: boolean
      uploadUrl?: string
      uploadError?: string
      retryCount: number
      timestamp: number
    }
  }
  'diesel-warehouses-cache': {
    key: string
    value: {
      id: string
      warehouseData: any
      lastUpdated: number
    }
  }
  'diesel-assets-cache': {
    key: string
    value: {
      id: string
      assetData: any[]
      lastUpdated: number
    }
  }
}

type OfflineDieselEvent = 'sync-start' | 'sync-complete' | 'sync-error' | 'connection-change'

class OfflineDieselService {
  private db: Promise<IDBPDatabase<DieselDB>> | null = null
  private syncInProgress: boolean = false
  private onlineListener: (() => void) | null = null
  private isClient: boolean = false
  private eventListeners: Map<OfflineDieselEvent, Function[]> = new Map()
  private autoSyncTimer: NodeJS.Timeout | null = null
  private lastSyncAttempt: number = 0
  private minSyncInterval: number = 30000 // 30 seconds minimum between syncs

  constructor() {
    this.isClient = typeof window !== 'undefined'

    if (this.isClient) {
      try {
        this.initializeDB()
        this.setupOnlineListener()
        this.setupAutoSync()
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Offline diesel service initialization warning:', error)
        }
      }
    }
  }

  private initializeDB() {
    if (!this.isClient || this.db) return

    this.db = openDB<DieselDB>('diesel-offline', 1, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`🔄 Upgrading Diesel IndexedDB from version ${oldVersion} to ${newVersion}`)

        if (!db.objectStoreNames.contains('offline-diesel-transactions')) {
          console.log('📦 Creating offline-diesel-transactions store')
          db.createObjectStore('offline-diesel-transactions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('offline-diesel-photos')) {
          console.log('📦 Creating offline-diesel-photos store')
          db.createObjectStore('offline-diesel-photos', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('diesel-warehouses-cache')) {
          console.log('📦 Creating diesel-warehouses-cache store')
          db.createObjectStore('diesel-warehouses-cache', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('diesel-assets-cache')) {
          console.log('📦 Creating diesel-assets-cache store')
          db.createObjectStore('diesel-assets-cache', { keyPath: 'id' })
        }

        console.log('✅ Diesel IndexedDB upgrade complete')
      }
    })
  }

  private setupOnlineListener() {
    if (!this.isClient) return

    this.onlineListener = () => {
      console.log('🌐 Connection restored - attempting diesel sync')
      this.emitEvent('connection-change', navigator.onLine)
      if (navigator.onLine) {
        setTimeout(() => this.syncAllPending(), 1000)
      }
    }

    window.addEventListener('online', this.onlineListener)
  }

  private setupAutoSync() {
    if (!this.isClient) return

    this.autoSyncTimer = setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        const timeSinceLastSync = Date.now() - this.lastSyncAttempt
        if (timeSinceLastSync >= this.minSyncInterval) {
          this.syncAllPending()
        }
      }
    }, 60000) // Check every minute
  }

  private async getDB(): Promise<IDBPDatabase<DieselDB> | null> {
    if (!this.db) return null
    try {
      return await this.db
    } catch (error) {
      console.error('Error accessing diesel IndexedDB:', error)
      return null
    }
  }

  // Event management
  on(event: OfflineDieselEvent, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  off(event: OfflineDieselEvent, callback: Function) {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emitEvent(event: OfflineDieselEvent, data?: any) {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in ${event} listener:`, error)
      }
    })
  }

  // Save diesel transaction offline
  async saveTransactionOffline(transactionData: any): Promise<string> {
    const db = await this.getDB()
    if (!db) throw new Error('IndexedDB not available')

    const id = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    await db.put('offline-diesel-transactions', {
      id,
      transactionData,
      synced: false,
      timestamp: Date.now(),
      retryCount: 0
    })

    console.log('💾 Diesel transaction saved offline:', id)
    return id
  }

  // Save diesel evidence photo offline
  async savePhotoOffline(
    transactionId: string,
    file: Blob,
    evidenceType: string,
    category: string
  ): Promise<string> {
    const db = await this.getDB()
    if (!db) throw new Error('IndexedDB not available')

    const id = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const fileName = `diesel-${evidenceType}-${Date.now()}.jpg`

    await db.put('offline-diesel-photos', {
      id,
      transactionId,
      evidenceType,
      category,
      file,
      fileName,
      uploaded: false,
      retryCount: 0,
      timestamp: Date.now()
    })

    console.log('📸 Diesel photo saved offline:', id)
    return id
  }

  // Get pending transactions count
  async getPendingCount(): Promise<number> {
    const db = await this.getDB()
    if (!db) return 0

    const transactions = await db.getAll('offline-diesel-transactions')
    const photos = await db.getAll('offline-diesel-photos')

    const pendingTransactions = transactions.filter(t => !t.synced).length
    const pendingPhotos = photos.filter(p => !p.uploaded).length

    return pendingTransactions + pendingPhotos
  }

  // Get sync status
  async getSyncStatus() {
    const db = await this.getDB()
    if (!db) {
      return {
        transactions: [],
        photos: [],
        total: 0,
        syncing: false
      }
    }

    const transactions = await db.getAll('offline-diesel-transactions')
    const photos = await db.getAll('offline-diesel-photos')

    const pendingTransactions = transactions.filter(t => !t.synced)
    const pendingPhotos = photos.filter(p => !p.uploaded)

    return {
      transactions: pendingTransactions,
      photos: pendingPhotos,
      total: pendingTransactions.length + pendingPhotos.length,
      syncing: this.syncInProgress
    }
  }

  // Sync all pending transactions and photos
  async syncAllPending(): Promise<void> {
    if (this.syncInProgress) {
      console.log('⏸️ Diesel sync already in progress')
      return
    }

    if (!navigator.onLine) {
      console.log('📴 Offline - skipping diesel sync')
      return
    }

    const db = await this.getDB()
    if (!db) {
      console.error('❌ Diesel IndexedDB not available for sync')
      return
    }

    this.syncInProgress = true
    this.lastSyncAttempt = Date.now()
    this.emitEvent('sync-start')

    try {
      // Sync photos first
      const photos = await db.getAll('offline-diesel-photos')
      const pendingPhotos = photos.filter(p => !p.uploaded)

      for (const photo of pendingPhotos) {
        try {
          await this.syncPhoto(photo)
        } catch (error) {
          console.error(`Error syncing diesel photo ${photo.id}:`, error)
          // Update retry count
          await db.put('offline-diesel-photos', {
            ...photo,
            retryCount: photo.retryCount + 1,
            uploadError: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Sync transactions
      const transactions = await db.getAll('offline-diesel-transactions')
      const pendingTransactions = transactions.filter(t => !t.synced)

      for (const transaction of pendingTransactions) {
        try {
          await this.syncTransaction(transaction)
        } catch (error) {
          console.error(`Error syncing diesel transaction ${transaction.id}:`, error)
          // Update retry count
          await db.put('offline-diesel-transactions', {
            ...transaction,
            retryCount: transaction.retryCount + 1,
            lastAttempt: Date.now(),
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      this.emitEvent('sync-complete', { success: true })
      console.log('✅ Diesel sync complete')
    } catch (error) {
      console.error('❌ Diesel sync error:', error)
      this.emitEvent('sync-error', error)
    } finally {
      this.syncInProgress = false
    }
  }

  private async syncPhoto(photo: any): Promise<void> {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const db = await this.getDB()
    if (!db) throw new Error('IndexedDB not available')

    try {
      // Upload photo to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('diesel-evidence')
        .upload(photo.fileName, photo.file, {
          cacheControl: '3600',
          upsert: true // Allow overwriting to handle duplicates gracefully
        })

      if (uploadError) {
        console.error('Diesel photo upload error:', uploadError)
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('diesel-evidence')
        .getPublicUrl(photo.fileName)

      // Update photo with upload URL
      await db.put('offline-diesel-photos', {
        ...photo,
        uploaded: true,
        uploadUrl: publicUrl
      })

      console.log('📸 Diesel photo synced:', photo.id)
    } catch (error: any) {
      console.error('Diesel photo sync failed:', error)
      // If upload fails due to duplicate, try with a new unique filename
      if (error.message?.includes('already exists') || error.statusCode === 400) {
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substr(2, 9)
        const fileExt = photo.fileName.split('.').pop()
        const retryFileName = `diesel_${timestamp}_${randomId}.${fileExt}`
        
        const { data: retryData, error: retryError } = await supabase.storage
          .from('diesel-evidence')
          .upload(retryFileName, photo.file, {
            cacheControl: '3600',
            upsert: true
          })

        if (retryError) {
          throw retryError
        }

        const { data: { publicUrl: retryUrl } } = supabase.storage
          .from('diesel-evidence')
          .getPublicUrl(retryFileName)

        await db.put('offline-diesel-photos', {
          ...photo,
          uploaded: true,
          uploadUrl: retryUrl,
          fileName: retryFileName
        })

        console.log('📸 Diesel photo synced with retry:', photo.id)
      } else {
        throw error
      }
    }
  }

  private async syncTransaction(transaction: any): Promise<void> {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const db = await this.getDB()
    if (!db) throw new Error('IndexedDB not available')

    // Get associated photos
    const photos = await db.getAll('offline-diesel-photos')
    const transactionPhotos = photos.filter(p => p.transactionId === transaction.id && p.uploaded)

    // Update transaction data with uploaded photo URLs
    const updatedTransactionData = {
      ...transaction.transactionData,
      photos: transactionPhotos.map(p => ({
        url: p.uploadUrl,
        evidence_type: p.evidenceType,
        category: p.category
      }))
    }

    // Insert transaction into Supabase
    const { data, error } = await supabase
      .from('diesel_transactions')
      .insert([updatedTransactionData])
      .select()
      .single()

    if (error) throw error

    // Insert evidence records
    for (const photo of transactionPhotos) {
      await supabase.from('diesel_evidence').insert({
        transaction_id: data.id,
        evidence_type: photo.evidenceType,
        category: photo.category,
        photo_url: photo.uploadUrl,
        created_by: updatedTransactionData.created_by
      })
    }

    // Mark as synced
    await db.put('offline-diesel-transactions', {
      ...transaction,
      synced: true
    })

    // Clean up synced photos
    for (const photo of transactionPhotos) {
      await db.delete('offline-diesel-photos', photo.id)
    }

    console.log('💾 Diesel transaction synced:', transaction.id)
  }

  // Cache warehouse data
  async cacheWarehouse(warehouseId: string, warehouseData: any): Promise<void> {
    const db = await this.getDB()
    if (!db) return

    await db.put('diesel-warehouses-cache', {
      id: warehouseId,
      warehouseData,
      lastUpdated: Date.now()
    })

    console.log('💾 Warehouse cached:', warehouseId)
  }

  // Get cached warehouse
  async getCachedWarehouse(warehouseId: string): Promise<any | null> {
    const db = await this.getDB()
    if (!db) return null

    const cached = await db.get('diesel-warehouses-cache', warehouseId)
    if (!cached) return null

    // Return cache if less than 1 hour old
    const age = Date.now() - cached.lastUpdated
    if (age > 3600000) return null // 1 hour

    return cached.warehouseData
  }

  // Cache assets
  async cacheAssets(plantId: string, assets: any[]): Promise<void> {
    const db = await this.getDB()
    if (!db) return

    await db.put('diesel-assets-cache', {
      id: plantId,
      assetData: assets,
      lastUpdated: Date.now()
    })

    console.log('💾 Assets cached for plant:', plantId)
  }

  // Get cached assets
  async getCachedAssets(plantId: string): Promise<any[] | null> {
    const db = await this.getDB()
    if (!db) return null

    const cached = await db.get('diesel-assets-cache', plantId)
    if (!cached) return null

    // Return cache if less than 1 hour old
    const age = Date.now() - cached.lastUpdated
    if (age > 3600000) return null // 1 hour

    return cached.assetData
  }

  // Cleanup - remove old synced transactions
  async cleanup(): Promise<void> {
    const db = await this.getDB()
    if (!db) return

    const transactions = await db.getAll('offline-diesel-transactions')
    const photos = await db.getAll('offline-diesel-photos')

    // Remove transactions synced more than 7 days ago
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    for (const transaction of transactions) {
      if (transaction.synced && transaction.timestamp < sevenDaysAgo) {
        await db.delete('offline-diesel-transactions', transaction.id)
      }
    }

    // Remove uploaded photos more than 7 days old
    for (const photo of photos) {
      if (photo.uploaded && photo.timestamp < sevenDaysAgo) {
        await db.delete('offline-diesel-photos', photo.id)
      }
    }

    console.log('🧹 Diesel offline cleanup complete')
  }

  // Destroy service
  destroy() {
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener)
    }
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer)
    }
    this.eventListeners.clear()
  }
}

// Singleton instance
let offlineDieselServiceInstance: OfflineDieselService | null = null

export function getOfflineDieselService(): OfflineDieselService {
  if (!offlineDieselServiceInstance) {
    offlineDieselServiceInstance = new OfflineDieselService()
  }
  return offlineDieselServiceInstance
}

export default OfflineDieselService

