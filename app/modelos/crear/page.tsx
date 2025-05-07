import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { EquipmentModelForm } from "@/components/models/equipment-model-form"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Crear Modelo de Equipo | Sistema de Gestión de Mantenimiento",
  description: "Crear un nuevo modelo de equipo con sus especificaciones de mantenimiento",
}

export default function CreateEquipmentModelPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Crear Modelo de Equipo"
        text="Define un nuevo modelo de equipo con sus especificaciones de mantenimiento recomendadas por el fabricante."
      >
        <Button variant="outline" asChild>
          <Link href="/modelos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <EquipmentModelForm />
    </DashboardShell>
  )
}
