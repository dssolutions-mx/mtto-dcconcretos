'use client';

import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { EquipmentModelList } from "@/components/models/equipment-model-list"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useEquipmentModels } from '@/hooks/useSupabase';
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function EquipmentModelsPage() {
  const { models, loading, error, refetch } = useEquipmentModels();
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Modelos de Equipos"
        text="Gestiona los modelos de equipos y sus especificaciones de mantenimiento recomendadas por el fabricante."
      >
        <Button asChild>
          <Link href="/modelos/crear">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Modelo
          </Link>
        </Button>
      </DashboardHeader>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>Error al cargar los modelos: {error.message}</AlertDescription>
        </Alert>
      )}
      <EquipmentModelList models={models} isLoading={loading} onRefresh={refetch} />
    </DashboardShell>
  )
}
