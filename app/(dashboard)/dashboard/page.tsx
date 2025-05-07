"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Overview } from "@/components/dashboard/overview"
import { ProviderPerformance } from "@/components/dashboard/provider-performance"
import { MaintenanceCalendar } from "@/components/dashboard/maintenance-calendar"
import { RecentOrders } from "@/components/dashboard/recent-orders"
import { WarrantyAlerts } from "@/components/dashboard/warranty-alerts"

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="analisis">Análisis</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
          <TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Overview />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <ProviderPerformance className="col-span-4" />
            <MaintenanceCalendar className="col-span-3" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <RecentOrders className="col-span-4" />
            <WarrantyAlerts className="col-span-3" />
          </div>
        </TabsContent>
        <TabsContent value="analisis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="col-span-4">
              <h3 className="text-xl font-semibold mb-4">Análisis de Mantenimiento</h3>
              <p>Contenido del análisis de mantenimiento...</p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="reportes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="col-span-4">
              <h3 className="text-xl font-semibold mb-4">Reportes de Mantenimiento</h3>
              <p>Contenido de los reportes de mantenimiento...</p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="notificaciones" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="col-span-4">
              <h3 className="text-xl font-semibold mb-4">Notificaciones</h3>
              <p>Contenido de las notificaciones...</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
