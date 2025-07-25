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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Edit, Eye, FileText, Loader2, MoreHorizontal, Plus, Search, Trash, History } from "lucide-react"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DuplicateTemplateDialog } from "./duplicate-template-dialog"
import { useToast } from "@/components/ui/use-toast"

export function ChecklistTemplateList() {
  const { templates, loading, error, fetchTemplates, getTemplatesWithIntervals } = useChecklistTemplates()
  const [searchTerm, setSearchTerm] = useState("")
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Checklist | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<Checklist | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const filteredTemplates = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.equipment_models?.manufacturer || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.equipment_models?.name || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const dailyTemplates = filteredTemplates.filter(t => t.frequency === 'diario')
  const weeklyTemplates = filteredTemplates.filter(t => t.frequency === 'semanal')
  const monthlyTemplates = filteredTemplates.filter(t => t.frequency === 'mensual')
  const otherTemplates = filteredTemplates.filter(t => 
    t.frequency !== 'diario' && t.frequency !== 'semanal' && t.frequency !== 'mensual'
  )
  const intervalsTemplates = filteredTemplates.filter(t => t.interval_id !== null && t.interval_id !== undefined)

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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <p>Cargando plantillas de checklist...</p>
        </CardContent>
      </Card>
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

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="rounded-full bg-muted p-3 mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No hay plantillas disponibles</h3>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-4">
            Las plantillas de checklist te permiten definir inspecciones para diferentes equipos.
          </p>
          <Button asChild>
            <Link href="/checklists/crear">
              <Plus className="mr-2 h-4 w-4" />
              Crear nueva plantilla
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  function renderTemplateTable(templates: Checklist[]) {
    if (templates.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          No hay plantillas en esta categoría.
        </div>
      )
    }

    return (
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto border rounded-md">
        <Table className="w-full min-w-[800px]">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="min-w-[200px]">Nombre</TableHead>
              <TableHead className="min-w-[200px]">Modelo / Equipo</TableHead>
              <TableHead className="min-w-[150px]">Intervalo</TableHead>
              <TableHead className="min-w-[100px]">Secciones</TableHead>
              <TableHead className="min-w-[150px]">Fecha de creación</TableHead>
              <TableHead className="text-right w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">
                  {template.name}
                  {template.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate max-w-[250px]">
                      {template.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {template.equipment_models ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {template.equipment_models.name?.substring(0, 2) || 'EQ'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{template.equipment_models.name}</p>
                        <p className="text-xs text-muted-foreground">{template.equipment_models.manufacturer}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No asignado</span>
                  )}
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
                      <DropdownMenuItem asChild>
                        <Link href={`/checklists/programar?template=${template.id}`}>
                          <FileText className="mr-2 h-4 w-4" />
                          Programar checklist
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicar plantilla
                      </DropdownMenuItem>
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

  return (
    <>
      <Card>
        <CardHeader className="space-y-0">
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
            <CardTitle>Plantillas de Checklist</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar plantillas..."
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => fetchTemplates()} 
                title="Recargar plantillas"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
              </Button>
              <Button asChild>
                <Link href="/checklists/crear">
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Plantilla
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                Todas ({filteredTemplates.length})
              </TabsTrigger>
              <TabsTrigger value="diario">
                Diarios ({dailyTemplates.length})
              </TabsTrigger>
              <TabsTrigger value="semanal">
                Semanales ({weeklyTemplates.length})
              </TabsTrigger>
              <TabsTrigger value="mensual">
                Mensuales ({monthlyTemplates.length})
              </TabsTrigger>
              {otherTemplates.length > 0 && (
                <TabsTrigger value="other">
                  Otros ({otherTemplates.length})
                </TabsTrigger>
              )}
              {intervalsTemplates.length > 0 && (
                <TabsTrigger value="intervals">
                  Con intervalo ({intervalsTemplates.length})
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="all">
              {renderTemplateTable(filteredTemplates)}
            </TabsContent>
            
            <TabsContent value="diario">
              {renderTemplateTable(dailyTemplates)}
            </TabsContent>
            
            <TabsContent value="semanal">
              {renderTemplateTable(weeklyTemplates)}
            </TabsContent>
            
            <TabsContent value="mensual">
              {renderTemplateTable(monthlyTemplates)}
            </TabsContent>
            
            {otherTemplates.length > 0 && (
              <TabsContent value="other">
                {renderTemplateTable(otherTemplates)}
              </TabsContent>
            )}
            
            {intervalsTemplates.length > 0 && (
              <TabsContent value="intervals">
                {renderTemplateTable(intervalsTemplates)}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {filteredTemplates.length} de {templates.length} plantillas
          </div>
          {filteredTemplates.length > 0 && searchTerm && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSearchTerm("")}
            >
              Limpiar filtro
            </Button>
          )}
        </CardFooter>
      </Card>

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
