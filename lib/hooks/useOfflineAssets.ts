import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { initOfflineClient, offlineClient } from '@/lib/offline/offline-client';

export function useOfflineAssets() {
  const [pendingAssets, setPendingAssets] = useState(0);
  
  const checkPendingAssets = useCallback(async () => {
    try {
      await initOfflineClient();
      const stats = await offlineClient.getDomainSyncStats('asset');
      setPendingAssets(stats.pending + stats.failed);
      return stats.pending + stats.failed;
    } catch (error) {
      console.error("Error checking pending assets:", error);
      return 0;
    }
  }, []);
  
  const syncPendingAssets = useCallback(async () => {
    if (!navigator.onLine) return [];

    try {
      await initOfflineClient();
      toast("Sincronizando activos guardados sin conexión...");
      await offlineClient.requestSync();
      await checkPendingAssets();
      return [];
    } catch (error) {
      console.error("Error syncing assets:", error);
      toast.error("No se pudieron sincronizar los activos guardados sin conexión.");
      return [];
    }
  }, [checkPendingAssets]);
  
  const saveAssetOffline = useCallback(async (assetData: any, photos: any[] = [], documents: any[] = []) => {
    try {
      await initOfflineClient();

      const offlinePhotos = photos
        .filter((photo) => photo.file instanceof Blob)
        .map((photo) => ({
          file: photo.file as Blob,
          category: photo.category ?? 'general',
          fileName: photo.file?.name,
        }));

      const offlineDocuments = documents
        .filter((doc) => doc.file instanceof Blob)
        .map((doc) => ({
          file: doc.file as Blob,
          name: doc.name ?? doc.file?.name ?? 'document',
        }));

      await offlineClient.enqueueAssetCreate(assetData, offlinePhotos, offlineDocuments);
      await checkPendingAssets();
      toast("Activo guardado sin conexión. Se sincronizará automáticamente cuando se restablezca la conexión a Internet.");
      return true;
    } catch (error) {
      console.error("Error saving asset offline:", error);
      toast.error("No se pudo guardar el activo sin conexión.");
      return false;
    }
  }, [checkPendingAssets]);
  
  useEffect(() => {
    checkPendingAssets();
    
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
