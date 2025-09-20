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

class SimplePhotoService {
  private isClient = typeof window !== 'undefined'
  private photos = new Map<string, any>()
  private uploadQueue: string[] = []
  private isProcessing = false
  
  constructor() {
    if (this.isClient) {
      this.startUploadProcessor()
      
      // Listen for online events
      window.addEventListener('online', () => {
        setTimeout(() => this.processUploadQueue(), 1000)
      })
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
      const photoId = `photo_${checklistId}_${itemId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Compress image and generate preview
      const { compressed, preview, metadata } = await this.compressImage(file, options)
      
      // Store in memory
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
      
      this.photos.set(photoId, photoData)
      
      // Add to upload queue if online
      if (navigator.onLine && options.immediate !== false) {
        this.uploadQueue.push(photoId)
        this.processUploadQueue()
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

  // Start background upload processor
  private startUploadProcessor() {
    if (!this.isClient) return
    
    setInterval(() => {
      if (navigator.onLine && !this.isProcessing) {
        this.processUploadQueue()
      }
    }, 5000) // Check every 5 seconds
  }

  // Process upload queue
  private async processUploadQueue() {
    if (this.isProcessing || this.uploadQueue.length === 0) return
    
    this.isProcessing = true
    
    try {
      // Process one photo at a time to avoid overwhelming the server
      const photoId = this.uploadQueue.shift()
      if (!photoId) return
      
      const photo = this.photos.get(photoId)
      if (!photo || photo.uploaded) return
      
      this.emitUploadEvent(photoId, 'uploading')
      
      try {
        const uploadResult = await this.uploadPhotoToServer(photo)
        
        if (uploadResult.success) {
          // Mark as uploaded
          photo.uploaded = true
          photo.uploadUrl = uploadResult.url
          this.photos.set(photoId, photo)
          
          // Emit success event
          this.emitUploadEvent(photoId, 'uploaded', uploadResult.url)
        } else {
          throw new Error(uploadResult.error || 'Upload failed')
        }
      } catch (error) {
        // Handle upload failure
        photo.uploadAttempts++
        photo.uploadError = error instanceof Error ? error.message : 'Unknown error'
        this.photos.set(photoId, photo)
        
        if (photo.uploadAttempts < 3) {
          // Retry with exponential backoff
          setTimeout(() => {
            this.uploadQueue.push(photoId)
          }, Math.pow(2, photo.uploadAttempts) * 1000)
        } else {
          this.emitUploadEvent(photoId, 'failed', undefined, error instanceof Error ? error.message : 'Max retries exceeded')
        }
      }
    } finally {
      this.isProcessing = false
      
      // Continue processing if there are more items
      if (this.uploadQueue.length > 0) {
        setTimeout(() => this.processUploadQueue(), 1000)
      }
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

  // Get photo by ID with current status
  async getPhoto(photoId: string): Promise<PhotoUploadResult | null> {
    const photo = this.photos.get(photoId)
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

  // Delete photo
  async deletePhoto(photoId: string): Promise<boolean> {
    try {
      this.photos.delete(photoId)
      
      // Remove from upload queue
      const index = this.uploadQueue.indexOf(photoId)
      if (index > -1) {
        this.uploadQueue.splice(index, 1)
      }
      
      this.emitUploadEvent(photoId, 'deleted')
      return true
    } catch (error) {
      console.error('Error deleting photo:', error)
      return false
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
    this.photos.forEach((photo, photoId) => {
      if (!photo.uploaded && photo.uploadAttempts >= 3) {
        // Reset attempts and re-queue
        photo.uploadAttempts = 0
        photo.uploadError = undefined
        this.photos.set(photoId, photo)
        this.uploadQueue.push(photoId)
      }
    })
    
    this.processUploadQueue()
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
    const photos = Array.from(this.photos.values())
    
    return {
      total: photos.length,
      uploaded: photos.filter(p => p.uploaded).length,
      pending: photos.filter(p => !p.uploaded && p.uploadAttempts < 3).length,
      failed: photos.filter(p => !p.uploaded && p.uploadAttempts >= 3).length,
      totalSize: photos.reduce((sum, p) => sum + p.fileSize, 0),
      compressedSize: photos.reduce((sum, p) => sum + p.compressedSize, 0)
    }
  }
}

export const simplePhotoService = new SimplePhotoService() 