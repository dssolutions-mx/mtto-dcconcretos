"use client"

import { useState, useEffect, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ArrowLeft,
  Edit,
  History,
  Calendar,
  Users,
  FileText,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { VersionComparison } from "@/components/checklists/version-comparison"
import { BreadcrumbSetter } from "@/components/navigation/breadcrumb-setter"

interface ChecklistTemplate {
  id: string
  name: string
  description: string | null
  frequency: string | null
  hours_interval: number | null
  model_id: string | null
  interval_id: string | null
  created_at: string
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
  equipment_models?: {
    id: string
    name: string
    manufacturer: string
  } | null
  checklist_sections: Array<{
    id: string
    title: string
    order_index: number
    checklist_items: Array<{
      id: string
      description: string
      required: boolean
      order_index: number
      item_type: string
      expected_value: string | null
      tolerance: string | null
    }>
  }>
}

const VALID_TABS = ["overview", "sections", "versions", "usage"] as const

export default function ChecklistTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const templateId = resolvedParams.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams?.get("tab")
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("overview")

  const modelId = template?.equipment_models?.id ?? template?.model_id
  const modelParam = modelId ? `?model=${modelId}` : ""
  const backUrl = modelParam ? `/checklists/plantillas?model=${modelId}` : "/checklists/plantillas"

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", value)
    router.replace(url.pathname + url.search, { scroll: false })
  }

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setLoading(true)
        const supabase = createClient()

        const { data, error } = await supabase
          .from("checklists")
          .select(
            `
            *,
            equipment_models (
              id,
              name,
              manufacturer
            ),
            checklist_sections (
              id,
              title,
              order_index,
              checklist_items (
                id,
                description,
                required,
                order_index,
                item_type,
                expected_value,
                tolerance
              )
            )
          `
          )
          .eq("id", templateId)
          .single()

        if (error) throw error
        setTemplate(data as unknown as ChecklistTemplate)
      } catch (err: unknown) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    if (templateId) {
      fetchTemplate()
    }
  }, [templateId])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Cargando plantilla...</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !template) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Error</CardTitle>
            <Button variant="outline" asChild>
              <Link href={backUrl}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || "Plantilla no encontrada"}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const totalItems = template.checklist_sections.reduce(
    (total, section) => total + section.checklist_items.length,
    0
  )

  return (
    <>
      <BreadcrumbSetter
        items={[
          { label: "Operaciones", href: "#" },
          { label: "Checklists", href: "/checklists" },
          { label: "Plantillas", href: "/checklists/plantillas" },
          { label: template.equipment_models?.name ?? "Modelo", href: `/checklists/plantillas?model=${modelId}` },
          { label: template.name, href: `/checklists/plantillas/${templateId}` },
        ]}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{template.name}</CardTitle>
              <CardDescription>
                {template.description || "Plantilla de checklist para mantenimiento"}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" asChild>
                <Link href={backUrl}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/checklists/programar?template=${templateId}`}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Programar
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/checklists/plantillas/${templateId}/editar${modelParam ? modelParam : ""}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Template Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 rounded-lg bg-muted/50">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Modelo de Equipo</dt>
              <dd className="text-lg">
                {template.equipment_models ? (
                  <div>
                    <div className="font-medium">{template.equipment_models.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {template.equipment_models.manufacturer}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">No asignado</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Frecuencia</dt>
              <dd className="text-lg">
                <Badge variant="outline">
                  {template.frequency === "diario"
                    ? "Diario"
                    : template.frequency === "semanal"
                      ? "Semanal"
                      : template.frequency === "mensual"
                        ? "Mensual"
                        : "Personalizado"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Total de Ítems</dt>
              <dd className="text-lg font-bold text-blue-600">{totalItems}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Secciones</dt>
              <dd className="text-lg font-bold text-green-600">
                {template.checklist_sections.length}
              </dd>
            </div>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="overview">Vista General</TabsTrigger>
              <TabsTrigger value="sections">Secciones</TabsTrigger>
              <TabsTrigger value="versions">Versiones</TabsTrigger>
              <TabsTrigger value="usage">Uso</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Resumen del Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">Secciones</span>
                      <span className="text-lg font-semibold">{template.checklist_sections.length}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">Total de ítems</span>
                      <span className="text-lg font-semibold">{totalItems}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">Ítems obligatorios</span>
                      <span className="text-lg font-semibold">
                        {template.checklist_sections.reduce(
                          (total, section) =>
                            total +
                            section.checklist_items.filter((item) => item.required).length,
                          0
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">Fecha de creación</span>
                      <span className="text-sm">
                        {new Date(template.created_at).toLocaleDateString("es")}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sections" className="space-y-4 mt-6">
              <div className="space-y-4">
                {template.checklist_sections
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((section) => (
                    <Card key={section.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                        <CardDescription>
                          {section.checklist_items.length} ítems en esta sección
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {section.checklist_items
                            .sort((a, b) => a.order_index - b.order_index)
                            .map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 p-3 border rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{item.description}</span>
                                    {item.required && (
                                      <Badge variant="destructive" className="text-xs">
                                        Obligatorio
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                      {item.item_type}
                                    </Badge>
                                  </div>
                                  {(item.expected_value || item.tolerance) && (
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {item.expected_value &&
                                        `Valor esperado: ${item.expected_value}`}
                                      {item.tolerance && ` (Tolerancia: ${item.tolerance})`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="versions" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Gestión de Versiones
                  </CardTitle>
                  <CardDescription>
                    Visualiza y compara diferentes versiones de esta plantilla
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VersionComparison templateId={templateId} isOpen={true} onClose={() => {}} embedded />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="usage" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Estadísticas de Uso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-muted-foreground py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <p>Estadísticas de uso proximamente</p>
                    <p className="text-sm">
                      Aquí podrás ver cuántas veces se ha usado esta plantilla
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </>
  )
}
