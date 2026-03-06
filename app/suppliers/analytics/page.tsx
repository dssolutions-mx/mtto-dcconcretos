import { Button } from "@/components/ui/button"
import { SupplierAnalyticsDashboard } from "@/components/suppliers/SupplierAnalyticsDashboard"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function SuppliersAnalyticsPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/suppliers">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análisis de Proveedores</h1>
          <p className="text-muted-foreground">
            Métricas detalladas de rendimiento y análisis de proveedores
          </p>
        </div>
      </div>

      <SupplierAnalyticsDashboard />
    </div>
  )
}
