import type { Metadata } from "next"
import { Suspense } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { WorkOrdersList } from "@/components/work-orders/work-orders-list"
import { WorkOrderCreateButton } from "@/components/work-orders/work-order-create-button"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Órdenes de Trabajo | Sistema de Gestión de Mantenimiento",
  description: "Gestión de órdenes de trabajo",
}

export default function WorkOrdersPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Órdenes de Trabajo"
        text="Planificación, aprobación y asignación de trabajos"
        id="ordenes-header"
      >
        <WorkOrderCreateButton />
      </DashboardHeader>
      <Suspense fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      }>
        <WorkOrdersList />
      </Suspense>
    </DashboardShell>
  )
}
