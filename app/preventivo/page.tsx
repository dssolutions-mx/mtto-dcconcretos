'use client';

import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PreventiveMaintenanceList } from "@/components/preventive/preventive-maintenance-list"
import { Plus, FileDown } from "lucide-react"
import { useUpcomingMaintenance } from '@/hooks/useSupabase';
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function PreventiveMaintenancePage() {
  const { plans, loading, error, refetch } = useUpcomingMaintenance();
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Mantenimiento Preventivo"
        text="Gestiona los programas de mantenimiento preventivo basados en horas de operación y checklists."
      >
        <div className="flex gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Programa
          </Button>
        </div>
      </DashboardHeader>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>Error al cargar los planes de mantenimiento: {error.message}</AlertDescription>
        </Alert>
      )}
      <PreventiveMaintenanceList plans={plans} isLoading={loading} onRefresh={refetch} />
    </DashboardShell>
  )
}
