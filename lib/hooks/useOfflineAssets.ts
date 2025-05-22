import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { offlineAssetService } from '@/lib/services/offline-asset-service';

export function useOfflineAssets() {
  const [pendingAssets, setPendingAssets] = useState(0);
  
  // Check for pending assets
  const checkPendingAssets = useCallback(async () => {
    try {
      const pendingAssets = await offlineAssetService.getPendingSyncs();
      setPendingAssets(pendingAssets.length);
      return pendingAssets.length;
    } catch (error) {
      console.error("Error checking pending assets:", error);
      return 0;
    }
  }, []);
  
  // Sync pending assets
  const syncPendingAssets = useCallback(async () => {
    if (navigator.onLine) {
      try {
        toast("Sincronizando activos guardados sin conexión...");
        
        const results = await offlineAssetService.syncAll();
        
        // Count successful and failed syncs
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        if (successful > 0) {
          toast(`${successful} activo(s) sincronizado(s) correctamente.`);
        }
        
        if (failed > 0) {
          toast.error(`${failed} activo(s) no pudieron sincronizarse.`);
        }
        
        // Update pending assets count
        checkPendingAssets();
        return results;
      } catch (error) {
        console.error("Error syncing assets:", error);
        toast.error("No se pudieron sincronizar los activos guardados sin conexión.");
        return [];
      }
    }
    return [];
  }, [checkPendingAssets]);
  
  // Save asset offline
  const saveAssetOffline = useCallback(async (assetData: any, photos: any[] = [], documents: any[] = []) => {
    try {
      // Generate temporary ID for offline storage
      const offlineId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Process photos if needed
      const offlinePhotos = await Promise.all(photos.map(async (photo, index) => {
        // If we have a File object, make sure we can store preview properly
        const photoData = {
          id: `photo-${index}`,
          file: photo.file,
          preview: photo.preview,
          category: photo.category
        };
        
        return photoData;
      }));
      
      // Save asset data offline
      await offlineAssetService.saveOfflineAsset(
        offlineId,
        assetData,
        offlinePhotos,
        documents
      );
      
      // Update the pending assets count
      checkPendingAssets();
      
      toast("Activo guardado sin conexión. Se sincronizará automáticamente cuando se restablezca la conexión a Internet.");
      
      return true;
    } catch (error) {
      console.error("Error saving asset offline:", error);
      toast.error("No se pudo guardar el activo sin conexión.");
      return false;
    }
  }, [checkPendingAssets]);
  
  // Check for pending assets on mount
  useEffect(() => {
    checkPendingAssets();
    
    // Set up listener for online event to try sync
    const handleOnline = () => {
      syncPendingAssets();
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [checkPendingAssets, syncPendingAssets]);
  
  return {
    pendingAssets,
    syncPendingAssets,
    saveAssetOffline,
    checkPendingAssets
  };
} 