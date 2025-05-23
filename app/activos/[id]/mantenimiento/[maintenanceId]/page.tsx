'use client';

import { MaintenanceDetails } from "@/components/assets/maintenance-details"
import { useRouter } from "next/navigation"
import { useEffect, useState, use } from "react"
import { createClient } from "@/lib/supabase"
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Edit } from "lucide-react";
import Link from "next/link";

interface MaintenancePageProps {
  params: Promise<{
    id: string
    maintenanceId: string
  }>
}

export default function MaintenancePage({ params }: MaintenancePageProps) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const { id, maintenanceId } = resolvedParams;
  
  const [maintenance, setMaintenance] = useState<any>(null);
  const [asset, setAsset] = useState<any>(null);
  const [maintenancePlan, setMaintenancePlan] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const router = useRouter();

  // Fetch maintenance data on the client side
  useEffect(() => {
    async function fetchMaintenanceData() {
      try {
        setLoading(true);
        // Use the browser client
        const supabase = createClient();
        
        // Fetch maintenance record
        const { data: maintenanceData, error: maintenanceError } = await supabase
          .from("maintenance_history")
          .select("*")
          .eq("id", maintenanceId)
          .eq("asset_id", id)
          .single();

        if (maintenanceError || !maintenanceData) {
          throw new Error("No se encontró el registro de mantenimiento");
        }
        
        // Ensure parts is always an array to prevent "reduce is not a function" error
        const processedData = {
          ...maintenanceData,
          parts: Array.isArray(maintenanceData.parts) ? maintenanceData.parts : 
                 (typeof maintenanceData.parts === 'string' ? JSON.parse(maintenanceData.parts) : [])
        };
        
        setMaintenance(processedData);
        
        // Fetch asset data
        const { data: assetData, error: assetError } = await supabase
          .from("assets")
          .select("*")
          .eq("id", id)
          .single();
          
        if (assetError) {
          console.error("Error al cargar datos del activo:", assetError);
        } else {
          setAsset(assetData);
        }
        
        // If maintenance has a plan ID, fetch the plan details
        if (maintenanceData.maintenance_plan_id) {
          const { data: planData, error: planError } = await supabase
            .from("maintenance_intervals")
            .select("*")
            .eq("id", maintenanceData.maintenance_plan_id)
            .single();
            
          if (planError) {
            console.error("Error al cargar plan de mantenimiento:", planError);
          } else {
            setMaintenancePlan(planData);
          }
        }
        
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

  const handleSave = async (updatedMaintenance: any) => {
    setSaving(true);
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from("maintenance_history")
        .update({
          date: updatedMaintenance.date,
          type: updatedMaintenance.type,
          hours: updatedMaintenance.hours,
          description: updatedMaintenance.description,
          findings: updatedMaintenance.findings,
          actions: updatedMaintenance.actions,
          technician: updatedMaintenance.technician,
          labor_hours: updatedMaintenance.labor_hours,
          labor_cost: updatedMaintenance.labor_cost,
          total_cost: updatedMaintenance.total_cost,
          work_order: updatedMaintenance.work_order,
          parts: updatedMaintenance.parts,
        })
        .eq("id", maintenanceId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update local state with the saved data
      setMaintenance({
        ...data,
        parts: Array.isArray(data.parts) ? data.parts : 
               (typeof data.parts === 'string' ? JSON.parse(data.parts) : [])
      });
      setIsEditMode(false);
    } catch (err) {
      console.error("Error al guardar:", err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Error al cargar mantenimiento"
          text="No se pudo encontrar el registro solicitado"
        >
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        
        <Card>
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Cargando detalles de mantenimiento"
          text="Por favor espere mientras se cargan los datos"
        >
          <Button variant="outline" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando...
          </Button>
        </DashboardHeader>
        
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Mantenimiento: ${asset?.name || ''}`}
        text={`Detalles del mantenimiento realizado el ${maintenance?.date || ''}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/activos/${id}/mantenimiento`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Plan
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/activos/${id}`}>
              Ver Activo
            </Link>
          </Button>
          {!isEditMode && (
            <Button variant="outline" onClick={() => setIsEditMode(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </DashboardHeader>
      
      <MaintenanceDetails
        maintenance={maintenance}
        asset={asset}
        maintenancePlan={maintenancePlan}
        onBack={handleBack}
        isEditMode={isEditMode}
        onSave={handleSave}
        onCancelEdit={() => setIsEditMode(false)}
        saving={saving}
      />
    </DashboardShell>
  )
}
