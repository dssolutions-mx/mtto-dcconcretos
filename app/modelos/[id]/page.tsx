import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { EquipmentModelDetails } from "@/components/models/equipment-model-details"
import { ArrowLeft, Edit, Copy, Trash2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import { use } from "react"

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

export default function EquipmentModelDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  return <EquipmentModelDetailsPageContent id={id} />;
}

// Create an async server component for the content
async function EquipmentModelDetailsPageContent({ id }: { id: string }) {
  const supabase = await createClient()
  const { data: model } = await supabase
    .from('equipment_models')
    .select('name, manufacturer')
    .eq('id', id)
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
            <Link href={`/modelos/${id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/modelos/${id}/copiar`}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Link>
          </Button>
          <Button variant="destructive" asChild>
            <Link href={`/modelos/${id}/eliminar`}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Link>
          </Button>
        </div>
      </DashboardHeader>
      <EquipmentModelDetails id={id} />
    </DashboardShell>
  )
}
