import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AssetDetails } from "@/components/preventive/asset-details"
import { MaintenanceHistory } from "@/components/preventive/maintenance-history"
import { MaintenanceChecklist } from "@/components/preventive/maintenance-checklist"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Wrench } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Detalles de Mantenimiento Preventivo | Sistema de Gestión de Mantenimiento",
  description: "Detalles del programa de mantenimiento preventivo",
}

export default function PreventiveMaintenanceDetailsPage({ params }: { params: { id: string } }) {
  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Programa de Mantenimiento Preventivo: ${params.id}`}
        text="Detalles del programa de mantenimiento preventivo y checklist asociado."
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/preventivo">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button>
            <Wrench className="mr-2 h-4 w-4" />
            Generar OT
          </Button>
        </div>
      </DashboardHeader>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <AssetDetails id={params.id} />
        </TabsContent>
        <TabsContent value="checklist">
          <MaintenanceChecklist id={params.id} />
        </TabsContent>
        <TabsContent value="history">
          <MaintenanceHistory id={params.id} />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}
