import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { EquipmentModelDetails } from "@/components/models/equipment-model-details"
import { ArrowLeft, Edit, Copy, Trash2, MoreVertical } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import { use } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const revalidate = 3600 // Revalidate this page every hour

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
        {/* Mobile-friendly action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" asChild className="sm:w-auto w-full">
            <Link href="/modelos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          
          {/* Desktop actions */}
          <div className="hidden sm:flex gap-2">
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
          
          {/* Mobile dropdown menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full">
                  <MoreVertical className="mr-2 h-4 w-4" />
                  Acciones
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Acciones del Modelo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/modelos/${id}/editar`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar Modelo
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/modelos/${id}/copiar`}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Modelo
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="text-destructive">
                  <Link href={`/modelos/${id}/eliminar`}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar Modelo
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </DashboardHeader>
      <EquipmentModelDetails id={id} />
    </DashboardShell>
  )
}
