import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { EquipmentModelEditForm } from "@/components/models/equipment-model-edit-form"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import { use } from "react"

export const revalidate = 60 // Revalidate this page every minute

export async function generateMetadata(
  { params }: { params: any }
): Promise<Metadata> {
  // Properly await the params
  params = await Promise.resolve(params)
  const id = params.id

  const supabase = await createClient()
  const { data: model } = await supabase
    .from('equipment_models')
    .select('name, manufacturer')
    .eq('id', id)
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

export default function EditEquipmentModelPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  return <EditEquipmentModelPageContent id={id} />;
}

async function EditEquipmentModelPageContent({ id }: { id: string }) {
  const supabase = await createClient()
  const { data: model } = await supabase
    .from('equipment_models')
    .select('id')
    .eq('id', id)
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
          <Link href={`/modelos/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <EquipmentModelEditForm modelId={id} />
    </DashboardShell>
  )
} 