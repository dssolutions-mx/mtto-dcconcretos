"use client"

import { Suspense, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Database, Upload, Settings, Fuel } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Import actual components
import { ImportTab } from "@/components/diesel-inventory/tabs/ImportTab"
import { MappingTab } from "@/components/diesel-inventory/tabs/MappingTab"
import { ProcessingTab } from "@/components/diesel-inventory/tabs/ProcessingTab"

function DieselInventoryContent() {
  const [activeTab, setActiveTab] = useState("import")

  const DieselImportTab = () => (
    <ImportTab 
      onProceedToMapping={() => setActiveTab("mapping")}
      onProceedToProcessing={() => setActiveTab("processing")}
    />
  )

  const AssetMappingTab = () => (
    <MappingTab
      onBackToImport={() => setActiveTab("import")}
      onProceedToProcessing={() => setActiveTab("processing")}
    />
  )

  const ProcessingStatusTab = () => (
    <ProcessingTab
      onBackToMapping={() => setActiveTab("mapping")}
      onComplete={() => {
        // Could redirect or show success
        console.log('Processing completed!')
      }}
    />
  )
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Control de Diesel - Migración"
        text="Sistema de migración para datos de inventario de diesel desde sistema legacy"
      >
        <Badge variant="secondary" className="ml-2">
          <AlertCircle className="mr-1 h-3 w-3" />
          Dev Only
        </Badge>
      </DashboardHeader>
      
      {/* Development Warning */}
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Herramienta de Desarrollo</AlertTitle>
        <AlertDescription>
          Este módulo está diseñado para migrar datos del sistema legacy. 
          Una vez completada la migración, se convertirá en el sistema principal de control de diesel.
        </AlertDescription>
      </Alert>

      {/* System Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-orange-500" />
            Información del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">3</div>
              <div className="text-sm text-muted-foreground">Categorías de Activos</div>
              <div className="text-xs text-center mt-1">Formales, Excepciones, Generales</div>
            </div>
            <div className="flex flex-col items-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">∞</div>
              <div className="text-sm text-muted-foreground">Registros Históricos</div>
              <div className="text-xs text-center mt-1">Sin pérdida de datos</div>
            </div>
            <div className="flex flex-col items-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">+</div>
              <div className="text-sm text-muted-foreground">Mapeo Automático</div>
              <div className="text-xs text-center mt-1">Con resolución manual</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Migration Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Mapear
          </TabsTrigger>
          <TabsTrigger value="processing" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Procesar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <DieselImportTab />
        </TabsContent>

        <TabsContent value="mapping">
          <AssetMappingTab />
        </TabsContent>

        <TabsContent value="processing">
          <ProcessingStatusTab />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}

export default function DieselInventoryPage() {
  return (
    <Suspense fallback={
      <DashboardShell>
        <DashboardHeader
          heading="Control de Diesel"
          text="Cargando sistema de migración..."
        />
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardShell>
    }>
      <DieselInventoryContent />
    </Suspense>
  )
}
