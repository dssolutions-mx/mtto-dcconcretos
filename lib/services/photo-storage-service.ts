import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface PhotoData {
  id: string
  checklistId: string
  itemId: string
  sectionId?: string
  category?: string
  originalFile: Blob
  compressedFile: Blob
  preview: string // base64 data URL
  fileName: string
  fileSize: number
  compressedSize: number
  timestamp: number
  uploaded: boolean
  uploadUrl?: string
  uploadAttempts: number
  lastUploadAttempt?: number
  uploadError?: string
  metadata: {
    width?: number
    height?: number
    type: string
    quality: number
  }
}

interface QueueData {
  photoId: string
  priority: number
  retryCount: number
  nextRetry: number
}

interface PhotoDB extends DBSchema {
  photos: {
    key: string
    value: PhotoData
    indexes: { [key: string]: any }
  }
  'upload-queue': {
    key: string
    value: QueueData
    indexes: { [key: string]: any }
  }
}

export interface PhotoUploadResult {
  id: string
  preview: string
  status: 'stored' | 'uploading' | 'uploaded' | 'failed'
  progress?: number
  error?: string
  url?: string
}

export interface PhotoUploadOptions {
  quality?: number
  maxWidth?: number
  maxHeight?: number
  immediate?: boolean
  category?: string
}

class PhotoStorageService {
  private db: Promise<IDBPDatabase<PhotoDB>> | null = null
  private uploadWorker: Worker | null = null
  private isClient = typeof window !== 'undefined'
  
  constructor() {
    if (this.isClient) {
      this.initializeDB()
      this.startUploadWorker()
    }
  }

  private initializeDB() {
    if (!this.isClient || this.db) return
    
    this.db = openDB<PhotoDB>('photo-storage', 1, {
      upgrade(db) {
        // Photos store
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { keyPath: 'id' })
          photoStore.createIndex('checklistId', 'checklistId', { unique: false })
          photoStore.createIndex('uploaded', 'uploaded', { unique: false })
          photoStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
        
        // Upload queue store
        if (!db.objectStoreNames.contains('upload-queue')) {
          const queueStore = db.createObjectStore('upload-queue', { keyPath: 'photoId' })
          queueStore.createIndex('priority', 'priority', { unique: false })
          queueStore.createIndex('nextRetry', 'nextRetry', { unique: false })
        }
      }
    })
  }

  private async getDB(): Promise<IDBPDatabase<PhotoDB> | null> {
    if (!this.isClient || !this.db) return null
    try {
      return await this.db
    } catch (error) {
      console.error('Error accessing photo database:', error)
      return null
    }
  }

  // Compress image and generate preview
  private async compressImage(
    file: File, 
    options: PhotoUploadOptions = {}
  ): Promise<{
    compressed: Blob
    preview: string
    metadata: any
  }> {
    const {
      quality = 0.8,
      maxWidth = 1920,
      maxHeight = 1080
    } = options

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width *= ratio
          height *= ratio
        }
        
        canvas.width = width
        canvas.height = height
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height)
        
        // Generate preview (small base64)
        const previewCanvas = document.createElement('canvas')
        const previewCtx = previewCanvas.getContext('2d')
        previewCanvas.width = 200
        previewCanvas.height = (200 * height) / width
        
        previewCtx?.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height)
        const preview = previewCanvas.toDataURL('image/jpeg', 0.7)
        
        // Convert main canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }
            
            resolve({
              compressed: blob,
              preview,
              metadata: {
                width,
                height,
                type: blob.type,
                quality
              }
            })
          },
          'image/jpeg',
          quality
        )
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  // Store photo locally with immediate preview
  async storePhoto(
    checklistId: string,
    itemId: string,
    file: File,
    options: PhotoUploadOptions = {}
  ): Promise<PhotoUploadResult> {
    try {
      const db = await this.getDB()
      if (!db) throw new Error('Database not available')

      const photoId = `photo_${checklistId}_${itemId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Compress image and generate preview
      const { compressed, preview, metadata } = await this.compressImage(file, options)
      
      // Store in IndexedDB
      const photoData = {
        id: photoId,
        checklistId,
        itemId,
        sectionId: options.category,
        category: options.category,
        originalFile: file,
        compressedFile: compressed,
        preview,
        fileName: file.name,
        fileSize: file.size,
        compressedSize: compressed.size,
        timestamp: Date.now(),
        uploaded: false,
        uploadAttempts: 0,
        metadata
      }
      
      await db.put('photos', photoData)
      
      // Add to upload queue if online
      if (navigator.onLine && options.immediate !== false) {
        await this.queueForUpload(photoId, 1) // High priority
      }
      
      return {
        id: photoId,
        preview,
        status: navigator.onLine ? 'uploading' : 'stored'
      }
    } catch (error) {
      console.error('Error storing photo:', error)
      throw error
    }
  }

  // Queue photo for upload
  private async queueForUpload(photoId: string, priority: number = 1) {
    const db = await this.getDB()
    if (!db) return
    
    await db.put('upload-queue', {
      photoId,
      priority,
      retryCount: 0,
      nextRetry: Date.now()
    })
    
    // Trigger upload worker
    this.triggerUpload()
  }

  // Start background upload worker
  private startUploadWorker() {
    if (!this.isClient) return
    
    // Use a simple interval-based worker instead of Web Worker for better compatibility
    setInterval(() => {
      if (navigator.onLine) {
        this.processUploadQueue()
      }
    }, 5000) // Check every 5 seconds
    
    // Listen for online events
    window.addEventListener('online', () => {
      setTimeout(() => this.processUploadQueue(), 1000)
    })
  }

  // Process upload queue
  private async processUploadQueue() {
    const db = await this.getDB()
    if (!db) return
    
    try {
      // Get pending uploads sorted by priority
      const queueItems = await db.getAllFromIndex('upload-queue', 'priority')
      const now = Date.now()
      
      for (const queueItem of queueItems.slice(0, 3)) { // Process max 3 at a time
        if (queueItem.nextRetry > now) continue
        
        const photo = await db.get('photos', queueItem.photoId)
        if (!photo || photo.uploaded) {
          // Clean up queue
          await db.delete('upload-queue', queueItem.photoId)
          continue
        }
        
        try {
          const uploadResult = await this.uploadPhotoToServer(photo)
          
          if (uploadResult.success) {
            // Mark as uploaded
            photo.uploaded = true
            photo.uploadUrl = uploadResult.url
            await db.put('photos', photo)
            await db.delete('upload-queue', queueItem.photoId)
            
            // Emit success event
            this.emitUploadEvent(photo.id, 'uploaded', uploadResult.url)
          } else {
            throw new Error(uploadResult.error || 'Upload failed')
          }
        } catch (error) {
          // Handle upload failure
          photo.uploadAttempts++
          photo.lastUploadAttempt = now
          photo.uploadError = error instanceof Error ? error.message : 'Unknown error'
          await db.put('photos', photo)
          
          // Update queue with exponential backoff
          queueItem.retryCount++
          queueItem.nextRetry = now + Math.pow(2, queueItem.retryCount) * 1000 * 60 // Exponential backoff
          
          if (queueItem.retryCount < 5) {
            await db.put('upload-queue', queueItem)
          } else {
            await db.delete('upload-queue', queueItem.photoId)
            this.emitUploadEvent(photo.id, 'failed', undefined, error instanceof Error ? error.message : 'Max retries exceeded')
          }
        }
      }
    } catch (error) {
      console.error('Error processing upload queue:', error)
    }
  }

  // Upload photo to server
  private async uploadPhotoToServer(photo: any): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const formData = new FormData()
      formData.append('file', photo.compressedFile, photo.fileName)
      formData.append('bucket', 'checklist-photos')
      
      // Use mobile session recovery for better mobile handling
      let response: Response
      
      // Check if we're in a browser environment and can use the mobile session recovery
      if (typeof window !== 'undefined') {
        try {
          // Dynamic import of standalone helper to avoid hooks outside components
          const { fetchWithSessionRecoveryStandalone } = await import('@/hooks/use-mobile-session-recovery')
          response = await fetchWithSessionRecoveryStandalone('/api/storage/upload', {
            method: 'POST',
            body: formData
          })
        } catch (error) {
          // Fallback to regular fetch if helper is not available
          console.log('Mobile session recovery helper not available, using regular fetch')
          response = await fetch('/api/storage/upload', {
            method: 'POST',
            body: formData
          })
        }
      } else {
        // Server-side fallback
        response = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData
        })
      }
      
      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorData}`)
      }
      
      const result = await response.json()
      return { success: true, url: result.url }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown upload error' 
      }
    }
  }

  // Trigger immediate upload attempt
  private triggerUpload() {
    // Debounce to prevent excessive calls
    clearTimeout(this.uploadTimeout)
    this.uploadTimeout = setTimeout(() => {
      this.processUploadQueue()
    }, 1000)
  }
  private uploadTimeout: NodeJS.Timeout | undefined

  // Get photo by ID with current status
  async getPhoto(photoId: string): Promise<PhotoUploadResult | null> {
    const db = await this.getDB()
    if (!db) return null
    
    const photo = await db.get('photos', photoId)
    if (!photo) return null
    
    return {
      id: photo.id,
      preview: photo.preview,
      status: photo.uploaded ? 'uploaded' : 
              photo.uploadAttempts > 0 ? 'uploading' : 'stored',
      url: photo.uploadUrl,
      error: photo.uploadError
    }
  }

  // Get all photos for a checklist
  async getChecklistPhotos(checklistId: string): Promise<PhotoUploadResult[]> {
    const db = await this.getDB()
    if (!db) return []
    
    const photos = await db.getAllFromIndex('photos', 'checklistId', checklistId)
    
    return photos.map(photo => ({
      id: photo.id,
      preview: photo.preview,
      status: photo.uploaded ? 'uploaded' : 
              photo.uploadAttempts > 0 ? 'uploading' : 'stored',
      url: photo.uploadUrl,
      error: photo.uploadError
    }))
  }

  // Delete photo
  async deletePhoto(photoId: string): Promise<boolean> {
    const db = await this.getDB()
    if (!db) return false
    
    try {
      await db.delete('photos', photoId)
      await db.delete('upload-queue', photoId)
      this.emitUploadEvent(photoId, 'deleted')
      return true
    } catch (error) {
      console.error('Error deleting photo:', error)
      return false
    }
  }

  // Get upload statistics
  async getUploadStats(): Promise<{
    total: number
    uploaded: number
    pending: number
    failed: number
    totalSize: number
    compressedSize: number
  }> {
    const db = await this.getDB()
    if (!db) return { total: 0, uploaded: 0, pending: 0, failed: 0, totalSize: 0, compressedSize: 0 }
    
    const photos = await db.getAll('photos')
    
    return {
      total: photos.length,
      uploaded: photos.filter(p => p.uploaded).length,
      pending: photos.filter(p => !p.uploaded && p.uploadAttempts < 5).length,
      failed: photos.filter(p => !p.uploaded && p.uploadAttempts >= 5).length,
      totalSize: photos.reduce((sum, p) => sum + p.fileSize, 0),
      compressedSize: photos.reduce((sum, p) => sum + p.compressedSize, 0)
    }
  }

  // Event emission for status updates
  private emitUploadEvent(photoId: string, status: string, url?: string, error?: string) {
    if (this.isClient) {
      window.dispatchEvent(new CustomEvent('photo-upload-status', {
        detail: { photoId, status, url, error }
      }))
    }
  }

  // Force retry all failed uploads
  async retryFailedUploads(): Promise<void> {
    const db = await this.getDB()
    if (!db) return
    
    const failedPhotos = await db.getAllFromIndex('photos', 'uploaded', false)
    
    for (const photo of failedPhotos) {
      if (photo.uploadAttempts >= 5) {
        // Reset attempts and re-queue
        photo.uploadAttempts = 0
        photo.uploadError = undefined
        await db.put('photos', photo)
        await this.queueForUpload(photo.id, 2) // Lower priority
      }
    }
    
    this.triggerUpload()
  }

  // Clean up old photos (older than 7 days and uploaded)
  async cleanupOldPhotos(): Promise<number> {
    const db = await this.getDB()
    if (!db) return 0
    
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    const oldPhotos = await db.getAll('photos')
    
    let cleaned = 0
    for (const photo of oldPhotos) {
      if (photo.uploaded && photo.timestamp < weekAgo) {
        await db.delete('photos', photo.id)
        cleaned++
      }
    }
    
    return cleaned
  }
}

export const photoStorageService = new PhotoStorageService() 