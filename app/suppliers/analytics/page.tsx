"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SupplierAnalyticsDashboard } from "@/components/suppliers/SupplierAnalyticsDashboard"
import { ArrowLeft } from "lucide-react"

export default function SuppliersAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y' | 'all'>('1y')
  const [supplierType, setSupplierType] = useState<string>('all')

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Análisis de Proveedores</h1>
            <p className="text-muted-foreground">
              Métricas detalladas de rendimiento y análisis de proveedores
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="90d">90 días</SelectItem>
              <SelectItem value="1y">1 año</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierType} onValueChange={setSupplierType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
              <SelectItem value="distributor">Distribuidor</SelectItem>
              <SelectItem value="manufacturer">Fabricante</SelectItem>
              <SelectItem value="service_provider">Servicios</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <SupplierAnalyticsDashboard
        timeRange={timeRange}
        supplierType={supplierType}
      />
    </div>
  )
}
