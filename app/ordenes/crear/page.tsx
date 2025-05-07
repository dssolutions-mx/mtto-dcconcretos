import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { WorkOrderForm } from "@/components/work-orders/work-order-form"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Crear Orden de Trabajo | Sistema de Gestión de Mantenimiento",
  description: "Crear una nueva orden de trabajo",
}

export default function CreateWorkOrderPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Crear Orden de Trabajo"
        text="Crea una nueva orden de trabajo para mantenimiento preventivo o correctivo."
      >
        <Button variant="outline" asChild>
          <Link href="/ordenes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <WorkOrderForm />
    </DashboardShell>
  )
}
