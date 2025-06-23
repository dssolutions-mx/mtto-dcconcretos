import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { createBrowserClient } from '@supabase/ssr'

interface AssetDB extends DBSchema {
  'offline-assets': {
    key: string
    value: {
      id: string
      data: any
      photos: Array<{
        id: string,
        file: any,
        preview: string,
        category: string
      }>
      documents: Array<{
        id: string,
        file: any,
        name: string
      }>
      synced: boolean
      timestamp: number
    }
  }
}

class OfflineAssetService {
  private db: Promise<IDBPDatabase<AssetDB>> | null = null
  private isClient = typeof window !== 'undefined'
  
  constructor() {
    if (this.isClient) {
      this.db = openDB<AssetDB>('assets-offline', 1, {
        upgrade(db) {
          db.createObjectStore('offline-assets', { keyPath: 'id' })
        }
      })
    }
  }

  private async getDB(): Promise<IDBPDatabase<AssetDB> | null> {
    if (!this.isClient || !this.db) return null
    return await this.db
  }
  
    // Guardar un activo offline
  async saveOfflineAsset(id: string, data: any, photos: Array<any> = [], documents: Array<any> = []) {
    const db = await this.getDB()
    if (!db) return
    await db.put('offline-assets', {
      id,
      data,
      photos,
      documents,
      synced: false,
      timestamp: Date.now()
    })
  }

  // Obtener todos los activos pendientes de sincronización
  async getPendingSyncs() {
    const db = await this.getDB()
    if (!db) return []
    const all = await db.getAll('offline-assets')
    return all.filter(item => !item.synced)
  }

  // Marcar un activo como sincronizado
  async markAsSynced(id: string) {
    const db = await this.getDB()
    if (!db) return
    const item = await db.get('offline-assets', id)
    if (item) {
      item.synced = true
      await db.put('offline-assets', item)
    }
  }
  
  // Sincronizar todos los activos pendientes
  async syncAll() {
    const pending = await this.getPendingSyncs()
    const results = []
    
    for (const item of pending) {
      try {
        // Upload photos first
        const photoUrls: string[] = []
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        
        // Upload photos
        for (const photo of item.photos) {
          // Create safe filename
          const safeId = item.data.assetId.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
          const safeFileName = photo.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
          const fileName = `${safeId}/${Date.now()}-${photo.category}-${safeFileName}`
          
          try {
            // Convert Blob back to File
            const photoFile = new File([photo.file], safeFileName, { type: photo.file.type })
            
            const { data: uploadData, error } = await supabase.storage
              .from("asset-photos")
              .upload(fileName, photoFile, {
                contentType: photo.file.type,
                upsert: false,
              })
              
            if (!error) {
              const { data: publicUrlData } = supabase.storage
                .from("asset-photos")
                .getPublicUrl(fileName)
              
              photoUrls.push(publicUrlData.publicUrl)
            }
          } catch (err) {
            console.error("Error uploading photo:", err)
          }
        }
        
        // Upload documents if any
        const documentUrls: string[] = []
        for (const doc of item.documents) {
          const safeId = item.data.assetId.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
          const safeFileName = doc.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
          const fileName = `${safeId}/${Date.now()}-${safeFileName}`
          
          try {
            // Convert Blob back to File
            const docFile = new File([doc.file], safeFileName, { type: doc.file.type })
            
            const { data: uploadData, error } = await supabase.storage
              .from("asset-documents")
              .upload(fileName, docFile, {
                contentType: doc.file.type,
                upsert: false,
              })
              
            if (!error) {
              const { data: publicUrlData } = supabase.storage
                .from("asset-documents")
                .getPublicUrl(fileName)
              
              documentUrls.push(publicUrlData.publicUrl)
            }
          } catch (err) {
            console.error("Error uploading document:", err)
          }
        }
        
        // Prepare the asset data with the uploaded files
        const assetDataToSave = {
          ...item.data,
          photos: photoUrls,
          insurance_documents: documentUrls,
        }
        
        // Register the asset
        const response = await fetch('/api/assets/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(assetDataToSave),
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

  // Obtener todos los activos guardados offline
  async getAllAssets() {
    const db = await this.getDB()
    if (!db) return []
    return await db.getAll('offline-assets')
  }

  // Limpiar datos antiguos (más de 30 días)
  async cleanOldData() {
    const db = await this.getDB()
    if (!db) return
    const all = await db.getAll('offline-assets')
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

    for (const item of all) {
      if (item.synced && item.timestamp < thirtyDaysAgo) {
        await db.delete('offline-assets', item.id)
      }
    }
  }
}

export const offlineAssetService = new OfflineAssetService() 