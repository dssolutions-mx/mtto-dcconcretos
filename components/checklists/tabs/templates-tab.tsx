"use client"

import { useState, useEffect } from "react"
import { useChecklistTemplates, type Checklist } from "@/hooks/useChecklists"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Edit, Eye, FileText, Loader2, MoreHorizontal, Plus, Search, Trash, History, Calendar } from "lucide-react"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DuplicateTemplateDialog } from "../duplicate-template-dialog"
import { useToast } from "@/components/ui/use-toast"
import { EquipmentModel } from "@/types"

interface TemplatesTabProps {
  model: EquipmentModel
}

export function TemplatesTab({ model }: TemplatesTabProps) {
  const { templates, loading, error, fetchTemplates } = useChecklistTemplates()
  const [searchTerm, setSearchTerm] = useState("")
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Checklist | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<Checklist | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  // Filter templates by model
  const modelTemplates = templates.filter(template => template.model_id === model.id)

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates, model.id])

  const filteredTemplates = modelTemplates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const dailyTemplates = filteredTemplates.filter(t => t.frequency === 'diario')
  const weeklyTemplates = filteredTemplates.filter(t => t.frequency === 'semanal')
  const monthlyTemplates = filteredTemplates.filter(t => t.frequency === 'mensual')
  const intervalTemplates = filteredTemplates.filter(t => t.interval_id !== null && t.interval_id !== undefined)
  const otherTemplates = filteredTemplates.filter(t => 
    t.frequency !== 'diario' && t.frequency !== 'semanal' && t.frequency !== 'mensual' &&
    (t.interval_id === null || t.interval_id === undefined)
  )

  const handleDuplicate = (template: Checklist) => {
    setSelectedTemplate(template)
    setDuplicateDialogOpen(true)
  }

  const handleDuplicateSuccess = () => {
    fetchTemplates() // Refresh the templates list
  }

  const handleDelete = (template: Checklist) => {
    setTemplateToDelete(template)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!templateToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/checklists/templates/${templateToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar la plantilla')
      }

      toast({
        title: "Plantilla eliminada",
        description: result.message || `La plantilla "${templateToDelete.name}" ha sido eliminada exitosamente`,
        variant: "default"
      })

      fetchTemplates() // Refresh the templates list
      setDeleteDialogOpen(false)
      setTemplateToDelete(null)

    } catch (error) {
      console.error('Error deleting template:', error)
      toast({
        title: "Error al eliminar",
        description: error instanceof Error ? error.message : "No se pudo eliminar la plantilla",
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const cancelDelete = () => {
    setDeleteDialogOpen(false)
    setTemplateToDelete(null)
  }

  function renderTemplateTable(templates: Checklist[], title: string) {
    if (templates.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No hay plantillas {title.toLowerCase()}</p>
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Frecuencia/Intervalo</TableHead>
              <TableHead>Secciones</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha de creación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{template.name}</p>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-[250px]">
                        {template.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {template.maintenance_intervals ? (
                    <Badge variant="secondary">
                      {template.maintenance_intervals.name} ({template.maintenance_intervals.interval_value} horas)
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      {template.frequency === 'diario' 
                        ? 'Diario' 
                        : template.frequency === 'semanal' 
                          ? 'Semanal' 
                          : template.frequency === 'mensual' 
                            ? 'Mensual' 
                            : 'Personalizado'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {template.checklist_sections?.length || 0} secciones
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    Activa
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(template.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Acciones</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href={`/checklists/${template.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalles
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/checklists/${template.id}/editar`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar plantilla
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/checklists/${template.id}?tab=versions`}>
                          <History className="mr-2 h-4 w-4" />
                          Ver versiones
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/checklists/programar?template=${template.id}`}>
                          <Calendar className="mr-2 h-4 w-4" />
                          Programar checklist
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicar plantilla
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => handleDelete(template)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p>Cargando plantillas para {model.name}...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="bg-red-50 text-red-800 p-4 rounded-md">
            <p className="font-medium">Error al cargar plantillas</p>
            <p className="text-sm">{error}</p>
            <Button onClick={() => fetchTemplates()} variant="outline" className="mt-4">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (modelTemplates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-muted p-3 mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No hay plantillas para este modelo</h3>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-4">
            Crea la primera plantilla de checklist para el modelo {model.name}.
          </p>
          <Button asChild>
            <Link href={`/checklists/crear?model=${model.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primera plantilla
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header with search and actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">
              Plantillas para {model.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {modelTemplates.length} plantillas disponibles
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar plantillas..."
                className="pl-8 w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button asChild>
              <Link href={`/checklists/crear?model=${model.id}`}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Plantilla
              </Link>
            </Button>
          </div>
        </div>

        {/* Templates organized by frequency/interval */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">
              Todas ({filteredTemplates.length})
            </TabsTrigger>
            {dailyTemplates.length > 0 && (
              <TabsTrigger value="diario">
                Diarias ({dailyTemplates.length})
              </TabsTrigger>
            )}
            {weeklyTemplates.length > 0 && (
              <TabsTrigger value="semanal">
                Semanales ({weeklyTemplates.length})
              </TabsTrigger>
            )}
            {monthlyTemplates.length > 0 && (
              <TabsTrigger value="mensual">
                Mensuales ({monthlyTemplates.length})
              </TabsTrigger>
            )}
            {intervalTemplates.length > 0 && (
              <TabsTrigger value="intervals">
                Por horas ({intervalTemplates.length})
              </TabsTrigger>
            )}
            {otherTemplates.length > 0 && (
              <TabsTrigger value="other">
                Otras ({otherTemplates.length})
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Todas las plantillas</CardTitle>
                <CardDescription>
                  Todas las plantillas de checklist para {model.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderTemplateTable(filteredTemplates, "en total")}
              </CardContent>
            </Card>
          </TabsContent>
          
          {dailyTemplates.length > 0 && (
            <TabsContent value="diario" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Plantillas diarias</CardTitle>
                  <CardDescription>
                    Checklists que se ejecutan diariamente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderTemplateTable(dailyTemplates, "diarias")}
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          {weeklyTemplates.length > 0 && (
            <TabsContent value="semanal" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Plantillas semanales</CardTitle>
                  <CardDescription>
                    Checklists que se ejecutan semanalmente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderTemplateTable(weeklyTemplates, "semanales")}
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          {monthlyTemplates.length > 0 && (
            <TabsContent value="mensual" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Plantillas mensuales</CardTitle>
                  <CardDescription>
                    Checklists que se ejecutan mensualmente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderTemplateTable(monthlyTemplates, "mensuales")}
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          {intervalTemplates.length > 0 && (
            <TabsContent value="intervals" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Plantillas por intervalo de horas</CardTitle>
                  <CardDescription>
                    Checklists que se ejecutan basados en horas de operación
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderTemplateTable(intervalTemplates, "por horas")}
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          {otherTemplates.length > 0 && (
            <TabsContent value="other" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Otras plantillas</CardTitle>
                  <CardDescription>
                    Plantillas con frecuencias personalizadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderTemplateTable(otherTemplates, "personalizadas")}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Summary */}
        {filteredTemplates.length > 0 && (
          <div className="text-sm text-muted-foreground text-center py-4 border-t">
            Mostrando {filteredTemplates.length} de {modelTemplates.length} plantillas para {model.name}
          </div>
        )}
      </div>

      <DuplicateTemplateDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        template={selectedTemplate}
        onSuccess={handleDuplicateSuccess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla de checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la plantilla "{templateToDelete?.name}".
              {"\n\n"}
              <strong>⚠️ Importante:</strong> Esta operación también eliminará:
              <ul className="list-disc pl-5 mt-2">
                <li>Todos los checklists programados pendientes de esta plantilla</li>
                <li>Todas las secciones e ítems de la plantilla</li>
                <li>Las versiones guardadas de la plantilla</li>
                <li>Los problemas/issues pendientes asociados con la plantilla</li>
              </ul>
              {"\n"}
              <strong>Nota:</strong> Las plantillas con historial de checklists completados no se pueden eliminar para preservar el registro de auditoría.
              {"\n\n"}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete} disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash className="mr-2 h-4 w-4" />
                  Eliminar plantilla
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 