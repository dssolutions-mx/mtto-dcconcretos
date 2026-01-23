import type { Metadata } from "next"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { WorkOrdersList } from "@/components/work-orders/work-orders-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Órdenes de Trabajo | Sistema de Gestión de Mantenimiento",
  description: "Gestión de órdenes de trabajo",
}

export default function WorkOrdersPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Órdenes de Trabajo"
        text="Gestiona las órdenes de trabajo para mantenimientos preventivos, correctivos y reclamos de garantía."
        id="ordenes-header"
      >
        <Button asChild>
          <Link href="/ordenes/crear">
            <Plus className="mr-2 h-4 w-4" />
            Nueva OT
          </Link>
        </Button>
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
