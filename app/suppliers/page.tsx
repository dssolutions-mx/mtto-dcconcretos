"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SupplierRegistry } from "@/components/suppliers/SupplierRegistry"
import { SupplierAnalyticsDashboard } from "@/components/suppliers/SupplierAnalyticsDashboard"
import { Supplier } from "@/types/suppliers"
import { Users, BarChart3, Search, Plus } from "lucide-react"

export default function SuppliersPage() {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [activeTab, setActiveTab] = useState("registry")

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Proveedores</h1>
          <p className="text-muted-foreground">
            Administra el padrón de proveedores y analiza su rendimiento
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Search className="w-4 h-4 mr-2" />
            Buscar Proveedor
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Agregar Proveedor
          </Button>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="registry" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Padrón de Proveedores
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Análisis y Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="space-y-4">
          <SupplierRegistry
            onSupplierSelect={(supplier) => {
              setSelectedSupplier(supplier)
              setActiveTab("analytics")
            }}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <SupplierAnalyticsDashboard
            timeRange="1y"
            supplierType="all"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
