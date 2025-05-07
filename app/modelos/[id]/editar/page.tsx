import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { EquipmentModelEditForm } from "@/components/models/equipment-model-edit-form"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"

export const revalidate = 60 // Revalidate this page every minute

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
      description: "No se pudo encontrar el modelo solicitado",
    }
  }

  return {
    title: `Editar ${model.name} | Sistema de Gestión de Mantenimiento`,
    description: `Editar el modelo ${model.name} de ${model.manufacturer}`,
  }
}

export default async function EditEquipmentModelPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: model } = await supabase
    .from('equipment_models')
    .select('id')
    .eq('id', params.id)
    .single()

  if (!model) {
    notFound()
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Editar Modelo de Equipo"
        text="Modifica la información y especificaciones técnicas de este modelo de equipo."
      >
        <Button variant="outline" asChild>
          <Link href={`/modelos/${params.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <EquipmentModelEditForm modelId={params.id} />
    </DashboardShell>
  )
} 