import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { SupplierAnalyticsDashboard } from "@/components/suppliers/SupplierAnalyticsDashboard"

export default function SuppliersAnalyticsPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/suppliers">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Link>
          </Button>
        </div>
        <DashboardHeader
          heading="Análisis de Proveedores"
          text="Métricas detalladas de rendimiento y análisis de proveedores"
          id="suppliers-analytics-header"
        />
      </div>

      <SupplierAnalyticsDashboard />
    </DashboardShell>
  )
}
