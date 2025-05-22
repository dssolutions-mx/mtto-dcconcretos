import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOfflineDetection } from "@/lib/hooks/useOfflineDetection";
import { useOfflineAssets } from "@/lib/hooks/useOfflineAssets";

export function OfflineAssetsIndicator() {
  const isOffline = useOfflineDetection();
  const { pendingAssets, syncPendingAssets } = useOfflineAssets();
  
  return (
    <div className="space-y-4">
      {pendingAssets > 0 && (
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            onClick={() => syncPendingAssets()}
            disabled={isOffline}
          >
            Sincronizar ({pendingAssets}) activos
          </Button>
        </div>
      )}
      
      {isOffline && (
        <Alert variant="destructive" className="bg-yellow-50 border-yellow-200">
          <AlertDescription className="flex items-center text-yellow-800">
            <AlertCircle className="h-4 w-4 mr-2" />
            Trabajando sin conexión. Los cambios se guardarán localmente y se sincronizarán cuando vuelva la conexión.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
} 