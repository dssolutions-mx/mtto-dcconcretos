"use client"

import { useState, useEffect } from "react"
import { useEquipmentModels } from "@/hooks/useSupabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Search, 
  Plus, 
  Factory, 
  FileText, 
  Users, 
  BarChart3, 
  Loader2,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import { EquipmentModel } from "@/types"
import { ModelOverviewTab } from "./tabs/model-overview-tab"
import { TemplatesTab } from "./tabs/templates-tab"
import { AssetsTab } from "./tabs/assets-tab"
import { AnalyticsTab } from "./tabs/analytics-tab"

interface ModelTemplatesNavigatorProps {
  className?: string
}

export function ModelTemplatesNavigator({ className }: ModelTemplatesNavigatorProps) {
  const { models, loading, error, refetch } = useEquipmentModels()
  const [selectedModel, setSelectedModel] = useState<EquipmentModel | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  // Auto-select first model when models load
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0])
    }
  }, [models, selectedModel])

  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <p>Cargando modelos y plantillas...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="bg-red-50 text-red-800 p-4 rounded-md">
            <p className="font-medium">Error al cargar modelos</p>
            <p className="text-sm">{error.message}</p>
            <Button onClick={() => refetch()} variant="outline" className="mt-4">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (models.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Factory className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No hay modelos de equipos</h3>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-4">
            Primero necesitas crear modelos de equipos para poder gestionar sus plantillas de checklist.
          </p>
          <Button asChild>
            <Link href="/modelos/crear">
              <Plus className="mr-2 h-4 w-4" />
              Crear modelo de equipo
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-4 gap-6 ${className}`}>
      {/* Model Selection Sidebar */}
      <Card className="lg:col-span-1">
        <CardHeader className="space-y-0 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Modelos</CardTitle>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => refetch()}
              title="Actualizar modelos"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Selecciona un modelo para gestionar sus plantillas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar modelos..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Models List */}
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-2">
              {filteredModels.map((model) => (
                <div
                  key={model.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${selectedModel?.id === model.id 
                      ? 'bg-primary/10 border-primary' 
                      : 'hover:bg-muted/50 border-border'
                    }
                  `}
                  onClick={() => setSelectedModel(model)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {model.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{model.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {model.manufacturer}
                    </p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {model.category}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {filteredModels.length === 0 && searchTerm && (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No se encontraron modelos</p>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSearchTerm("")}
                className="mt-2"
              >
                Limpiar búsqueda
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Details and Management */}
      <div className="lg:col-span-3">
        {selectedModel ? (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {selectedModel.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">{selectedModel.name}</CardTitle>
                    <CardDescription className="text-base">
                      {selectedModel.manufacturer} • {selectedModel.category}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/modelos/${selectedModel.id}`}>
                      Ver detalles del modelo
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/checklists/crear?model=${selectedModel.id}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nueva plantilla
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="px-6 pt-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Resumen</span>
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Plantillas</span>
                    </TabsTrigger>
                    <TabsTrigger value="assets" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span className="hidden sm:inline">Activos</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Análisis</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="p-6">
                  <TabsContent value="overview" className="mt-0">
                    <ModelOverviewTab model={selectedModel} />
                  </TabsContent>

                  <TabsContent value="templates" className="mt-0">
                    <TemplatesTab model={selectedModel} />
                  </TabsContent>

                  <TabsContent value="assets" className="mt-0">
                    <AssetsTab model={selectedModel} />
                  </TabsContent>

                  <TabsContent value="analytics" className="mt-0">
                    <AnalyticsTab model={selectedModel} />
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="rounded-full bg-muted p-3 mb-4">
                <Factory className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Selecciona un modelo</h3>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Elige un modelo de la lista para gestionar sus plantillas de checklist y activos.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 