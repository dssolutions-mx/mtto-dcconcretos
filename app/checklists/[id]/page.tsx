'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ArrowLeft, 
  Edit, 
  History, 
  GitCompare, 
  Copy, 
  Calendar,
  Settings,
  Users,
  FileText,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { VersionComparison } from '@/components/checklists/version-comparison'
import { QATestingPanel } from '@/components/checklists/qa-testing-panel'

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

export default function ChecklistTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const templateId = resolvedParams.id
  const router = useRouter()
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQA, setShowQA] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        
        const { data, error } = await supabase
          .from('checklists')
          .select(`
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
          `)
          .eq('id', templateId)
          .single()

        if (error) throw error
        setTemplate(data as unknown as ChecklistTemplate)
      } catch (err: any) {
        setError(err.message)
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
      <DashboardShell>
        <DashboardHeader
          heading="Cargando plantilla..."
          text="Obteniendo detalles de la plantilla"
        >
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando plantilla...</span>
        </div>
      </DashboardShell>
    )
  }

  if (error || !template) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Error"
          text="No se pudo cargar la plantilla"
        >
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || "Plantilla no encontrada"}</AlertDescription>
        </Alert>
      </DashboardShell>
    )
  }

  const totalItems = template.checklist_sections.reduce(
    (total, section) => total + section.checklist_items.length,
    0
  )

  return (
    <DashboardShell>
      <DashboardHeader
        heading={template.name}
        text={template.description || "Plantilla de checklist para mantenimiento"}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <Button asChild>
            <Link href={`/checklists/${templateId}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </DashboardHeader>

      <div className="space-y-6">
        {/* Template Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Modelo de Equipo</dt>
                <dd className="text-lg">
                  {template.equipment_models ? (
                    <div>
                      <div className="font-medium">{template.equipment_models.name}</div>
                      <div className="text-sm text-muted-foreground">{template.equipment_models.manufacturer}</div>
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
                    {template.frequency === 'diario' 
                      ? 'Diario' 
                      : template.frequency === 'semanal' 
                        ? 'Semanal' 
                        : template.frequency === 'mensual' 
                          ? 'Mensual' 
                          : 'Personalizado'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Total de Ítems</dt>
                <dd className="text-lg font-bold text-blue-600">{totalItems}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Secciones</dt>
                <dd className="text-lg font-bold text-green-600">{template.checklist_sections.length}</dd>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="sections">Secciones</TabsTrigger>
            <TabsTrigger value="versions">Versiones</TabsTrigger>
            <TabsTrigger value="usage">Uso</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Resumen del Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total de secciones:</span>
                      <Badge variant="outline">{template.checklist_sections.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Total de ítems:</span>
                      <Badge variant="outline">{totalItems}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Ítems obligatorios:</span>
                      <Badge variant="outline">
                        {template.checklist_sections.reduce((total, section) => 
                          total + section.checklist_items.filter(item => item.required).length, 0
                        )}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Fecha de creación:</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(template.created_at).toLocaleDateString('es')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Acciones Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button asChild className="w-full justify-start">
                      <Link href={`/checklists/${templateId}/editar`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Template
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('versions')}
                    >
                      <History className="mr-2 h-4 w-4" />
                      Ver Historial de Versiones
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('versions')}
                    >
                      <GitCompare className="mr-2 h-4 w-4" />
                      Comparar Versiones
                    </Button>
                    <Button variant="outline" asChild className="w-full justify-start">
                      <Link href={`/checklists/programar?template=${templateId}`}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Programar Checklist
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sections" className="space-y-4">
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
                            <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{item.description}</span>
                                  {item.required && (
                                    <Badge variant="destructive" className="text-xs">Obligatorio</Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {item.item_type}
                                  </Badge>
                                </div>
                                {(item.expected_value || item.tolerance) && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {item.expected_value && `Valor esperado: ${item.expected_value}`}
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

          <TabsContent value="versions" className="space-y-4">
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
                <VersionComparison templateId={templateId} isOpen={true} onClose={() => {}} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
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
                  <p className="text-sm">Aquí podrás ver cuántas veces se ha usado esta plantilla</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuración Avanzada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowQA(true)}
                    className="w-full justify-start"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Ejecutar Pruebas de QA
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    <p>• Ejecuta pruebas de calidad en el sistema de versionado</p>
                    <p>• Verifica la integridad de los datos</p>
                    <p>• Valida la funcionalidad offline</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* QA Testing Panel */}
      <QATestingPanel isOpen={showQA} onClose={() => setShowQA(false)} />
    </DashboardShell>
  )
} 