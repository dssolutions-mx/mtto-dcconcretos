import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { EquipmentModelDetails } from "@/components/models/equipment-model-details"
import { ArrowLeft, Edit } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"

export const revalidate = 3600 // Revalidate this page every hour

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = await createClient()
  const { data: model } = await supabase
    .from('equipment_models')
    .select('name, manufacturer')
    .eq('id', params.id)
    .single()
    
  if (!model) {
    return {
      title: "Modelo no encontrado | Sistema de Gestión de Mantenimiento",
      description: "El modelo de equipo solicitado no existe",
    }
  }
  
  return {
    title: `${model.manufacturer} ${model.name} | Sistema de Gestión de Mantenimiento`,
    description: `Detalles del modelo de equipo ${model.manufacturer} ${model.name} y sus especificaciones de mantenimiento`,
  }
}

export default async function EquipmentModelDetailsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: model } = await supabase
    .from('equipment_models')
    .select('name, manufacturer')
    .eq('id', params.id)
    .single()
    
  if (!model) {
    notFound()
  }
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading={`${model.manufacturer} ${model.name}`}
        text="Detalles del modelo de equipo y sus especificaciones de mantenimiento recomendadas por el fabricante."
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/modelos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/modelos/${params.id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </DashboardHeader>
      <EquipmentModelDetails id={params.id} />
    </DashboardShell>
  )
}
