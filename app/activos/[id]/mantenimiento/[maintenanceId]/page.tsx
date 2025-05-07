'use client';

import { MaintenanceDetails } from "@/components/assets/maintenance-details"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

interface MaintenancePageProps {
  params: {
    id: string
    maintenanceId: string
  }
}

export default function MaintenancePage({ params }: MaintenancePageProps) {
  const { id, maintenanceId } = params;
  
  const [maintenance, setMaintenance] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  // Fetch maintenance data on the client side
  useEffect(() => {
    async function fetchMaintenanceData() {
      try {
        setLoading(true);
        // Use the browser client
        const supabase = createClient();
        
        const { data, error: fetchError } = await supabase
          .from("maintenance_history")
          .select("*")
          .eq("id", maintenanceId)
          .eq("asset_id", id)
          .single();

        if (fetchError || !data) {
          throw new Error("No se encontró el registro de mantenimiento");
        }
        
        setMaintenance(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    fetchMaintenanceData();
  }, [id, maintenanceId]);

  const handleBack = () => {
    router.back();
  };

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
          <h2 className="text-lg font-medium mb-2">Error al cargar el mantenimiento</h2>
          <p>{error.message}</p>
          <button 
            className="mt-4 bg-red-100 hover:bg-red-200 text-red-800 font-medium py-2 px-4 rounded"
            onClick={handleBack}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <MaintenanceDetails
        maintenance={maintenance}
        onBack={handleBack}
      />
    </div>
  )
}
