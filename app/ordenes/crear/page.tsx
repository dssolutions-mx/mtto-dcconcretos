import type { Metadata } from "next"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { WorkOrderForm } from "@/components/work-orders/work-order-form"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Crear Orden de Trabajo | Sistema de Gestión de Mantenimiento",
  description: "Crear una orden de trabajo correctiva. Para mantenimiento preventivo, vaya al activo → Mantenimiento → Programar.",
}

export default function CreateWorkOrderPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Crear Orden de Trabajo"
        text="Orden correctiva manual. Para preventivo: Activos → seleccione activo → Mantenimiento → Programar."
      >
        <Button variant="outline" asChild>
          <Link href="/ordenes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <Suspense fallback={
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      }>
        <WorkOrderForm />
      </Suspense>
    </DashboardShell>
  )
}
