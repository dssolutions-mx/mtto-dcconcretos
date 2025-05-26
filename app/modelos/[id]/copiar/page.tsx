import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { EquipmentModelCopyForm } from "@/components/models/equipment-model-copy-form"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import { use } from "react"

export const revalidate = 0 // Do not cache this page

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
    title: `Copiar ${model.name} | Sistema de Gestión de Mantenimiento`,
    description: `Crear una copia del modelo ${model.name} de ${model.manufacturer} con su plan de mantenimiento`,
  }
}

export default function CopyEquipmentModelPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  return <CopyEquipmentModelPageContent id={id} />;
}

async function CopyEquipmentModelPageContent({ id }: { id: string }) {
  const supabase = await createClient()
  const { data: model } = await supabase
    .from('equipment_models')
    .select('id, name, manufacturer')
    .eq('id', id)
    .single()

  if (!model) {
    notFound()
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Copiar Modelo: ${model.manufacturer} ${model.name}`}
        text="Crea una copia de este modelo con su plan de mantenimiento. Puedes modificar los detalles para adaptarlo a una variante o nuevo año del modelo."
      >
        <Button variant="outline" asChild>
          <Link href={`/modelos/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <EquipmentModelCopyForm sourceModelId={id} />
    </DashboardShell>
  )
} 