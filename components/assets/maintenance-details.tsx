"use client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Calendar, CheckCircle2, Clock, FileText, Printer, User, Wrench, Settings, Save, X, Plus, Edit, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"

interface MaintenanceDetailsProps {
  maintenance: any
  asset?: any
  maintenancePlan?: any
  onBack: () => void
  isEditMode?: boolean
  onSave?: (updatedMaintenance: any) => Promise<void>
  onCancelEdit?: () => void
  saving?: boolean
}

interface MaintenancePart {
  name: string
  partNumber?: string
  quantity: number
  cost?: string
}

export function MaintenanceDetails({ 
  maintenance, 
  asset, 
  maintenancePlan, 
  onBack, 
  isEditMode = false,
  onSave,
  onCancelEdit,
  saving = false
}: MaintenanceDetailsProps) {
  const [editedMaintenance, setEditedMaintenance] = useState(maintenance)
  const [isPartDialogOpen, setIsPartDialogOpen] = useState(false)
  const [currentPart, setCurrentPart] = useState<MaintenancePart | null>(null)
  const [isEditingPart, setIsEditingPart] = useState(false)
  const { toast } = useToast()

  // Update editedMaintenance when maintenance prop changes
  useEffect(() => {
    setEditedMaintenance(maintenance)
  }, [maintenance])

  // Formatear la fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, "PPP", { locale: es })
  }

  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, "yyyy-MM-dd")
  }

  const handleSave = async () => {
    if (!onSave) return
    
    try {
      await onSave(editedMaintenance)
      toast({
        title: "Éxito",
        description: "Mantenimiento actualizado correctamente",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el mantenimiento. Inténtalo de nuevo.",
      })
    }
  }

  const addPart = () => {
    setCurrentPart({ name: "", partNumber: "", quantity: 1, cost: "" })
    setIsEditingPart(false)
    setIsPartDialogOpen(true)
  }

  const editPart = (part: MaintenancePart, index: number) => {
    setCurrentPart({ ...part, index } as any)
    setIsEditingPart(true)
    setIsPartDialogOpen(true)
  }

  const savePart = () => {
    if (!currentPart) return

    const parts = [...(editedMaintenance.parts || [])]
    
    if (isEditingPart && 'index' in currentPart) {
      parts[(currentPart as any).index] = currentPart
    } else {
      parts.push(currentPart)
    }

    setEditedMaintenance({ ...editedMaintenance, parts })
    setIsPartDialogOpen(false)
    setCurrentPart(null)
  }

  const removePart = (index: number) => {
    const parts = [...(editedMaintenance.parts || [])]
    parts.splice(index, 1)
    setEditedMaintenance({ ...editedMaintenance, parts })
  }

  const displayMaintenance = isEditMode ? editedMaintenance : maintenance

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isEditMode ? "Editar Mantenimiento" : "Detalles del Mantenimiento"}
          </h2>
          <p className="text-muted-foreground">{displayMaintenance.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <Button variant="outline" onClick={onCancelEdit} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
            </>
          )}
        </div>
      </div>

      {maintenancePlan && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Checkpoint de Mantenimiento
              <Badge 
                variant="outline" 
                className="ml-2 whitespace-nowrap"
              >
                {maintenancePlan.type}
                {maintenancePlan.interval_value && ` ${maintenancePlan.interval_value}h`}
              </Badge>
            </CardTitle>
            <CardDescription>
              Este mantenimiento fue registrado como parte del plan de mantenimiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-md border p-3 space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Nombre del Checkpoint</div>
                <div className="font-medium">{maintenancePlan.description}</div>
              </div>
              
              <div className="bg-white rounded-md border p-3 space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Frecuencia</div>
                <div className="font-medium">
                  {maintenancePlan.interval_value && `Cada ${maintenancePlan.interval_value} horas`}
                </div>
              </div>
              
              <div className="bg-white rounded-md border p-3 space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Equipo</div>
                <div className="font-medium">
                  {asset?.name} ({asset?.asset_id})
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Información General</CardTitle>
            <CardDescription>Detalles generales del mantenimiento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Fecha</h4>
                {isEditMode ? (
                  <Input
                    type="date"
                    value={formatDateForInput(editedMaintenance.date)}
                    onChange={(e) => setEditedMaintenance({ ...editedMaintenance, date: e.target.value })}
                  />
                ) : (
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span>{formatDate(displayMaintenance.date)}</span>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Tipo</h4>
                {isEditMode ? (
                  <Select 
                    value={editedMaintenance.type} 
                    onValueChange={(value) => setEditedMaintenance({ ...editedMaintenance, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Preventivo">Preventivo</SelectItem>
                      <SelectItem value="Correctivo">Correctivo</SelectItem>
                      <SelectItem value="Predictivo">Predictivo</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={displayMaintenance.type === "Preventivo" ? "default" : "secondary"}>
                    {displayMaintenance.type}
                  </Badge>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Horas del Equipo</h4>
                {isEditMode ? (
                  <Input
                    type="number"
                    value={editedMaintenance.hours || ""}
                    onChange={(e) => setEditedMaintenance({ ...editedMaintenance, hours: e.target.value })}
                    placeholder="Horas"
                  />
                ) : (
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span>{displayMaintenance.hours} horas</span>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Técnico</h4>
                {isEditMode ? (
                  <Input
                    value={editedMaintenance.technician || ""}
                    onChange={(e) => setEditedMaintenance({ ...editedMaintenance, technician: e.target.value })}
                    placeholder="Nombre del técnico"
                  />
                ) : (
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-1 text-muted-foreground" />
                    <span>{displayMaintenance.technician}</span>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Horas de Trabajo</h4>
                {isEditMode ? (
                  <Input
                    type="number"
                    step="0.5"
                    value={editedMaintenance.labor_hours || ""}
                    onChange={(e) => setEditedMaintenance({ ...editedMaintenance, labor_hours: e.target.value })}
                    placeholder="Horas de trabajo"
                  />
                ) : (
                  <span>{displayMaintenance.labor_hours || '-'} horas</span>
                )}
              </div>
              {displayMaintenance.work_order && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Orden de Trabajo</h4>
                  {isEditMode ? (
                    <Input
                      value={editedMaintenance.work_order || ""}
                      onChange={(e) => setEditedMaintenance({ ...editedMaintenance, work_order: e.target.value })}
                      placeholder="Número de orden"
                    />
                  ) : (
                    <span>{displayMaintenance.work_order}</span>
                  )}
                </div>
              )}
              {!displayMaintenance.work_order && !isEditMode && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Estado</h4>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    Completado
                  </Badge>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Descripción</h4>
              {isEditMode ? (
                <Textarea
                  value={editedMaintenance.description || ""}
                  onChange={(e) => setEditedMaintenance({ ...editedMaintenance, description: e.target.value })}
                  placeholder="Descripción del mantenimiento"
                  rows={3}
                />
              ) : (
                <p className="text-sm">{displayMaintenance.description}</p>
              )}
            </div>

            {(displayMaintenance.findings || isEditMode) && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Hallazgos</h4>
                {isEditMode ? (
                  <Textarea
                    value={editedMaintenance.findings || ""}
                    onChange={(e) => setEditedMaintenance({ ...editedMaintenance, findings: e.target.value })}
                    placeholder="Hallazgos durante el mantenimiento"
                    rows={3}
                  />
                ) : (
                  <p className="text-sm">{displayMaintenance.findings}</p>
                )}
              </div>
            )}

            {(displayMaintenance.actions || isEditMode) && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Acciones Realizadas</h4>
                {isEditMode ? (
                  <Textarea
                    value={editedMaintenance.actions || ""}
                    onChange={(e) => setEditedMaintenance({ ...editedMaintenance, actions: e.target.value })}
                    placeholder="Acciones realizadas durante el mantenimiento"
                    rows={3}
                  />
                ) : (
                  <p className="text-sm">{displayMaintenance.actions}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen de Costos</CardTitle>
            <CardDescription>Costos asociados al mantenimiento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Costo de Repuestos</span>
                <span className="font-medium">
                  $
                  {displayMaintenance.parts
                    ? displayMaintenance.parts.reduce(
                        (total: number, part: any) => total + part.quantity * (parseFloat(part.cost) || 0),
                        0,
                      )
                    : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Costo de Mano de Obra</span>
                {isEditMode ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={editedMaintenance.labor_cost || ""}
                    onChange={(e) => setEditedMaintenance({ ...editedMaintenance, labor_cost: e.target.value })}
                    placeholder="0.00"
                    className="w-24 text-right"
                  />
                ) : (
                  <span className="font-medium">${displayMaintenance.labor_cost || 0}</span>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Costo Total</span>
                {isEditMode ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={editedMaintenance.total_cost || ""}
                    onChange={(e) => setEditedMaintenance({ ...editedMaintenance, total_cost: e.target.value })}
                    placeholder="0.00"
                    className="w-32 text-right font-bold"
                  />
                ) : (
                  <span className="font-bold">${displayMaintenance.total_cost || 0}</span>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Generar Reporte
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Tabs defaultValue="parts">
        <TabsList>
          <TabsTrigger value="parts">Repuestos Utilizados</TabsTrigger>
          <TabsTrigger value="tasks">Tareas Completadas</TabsTrigger>
        </TabsList>
        <TabsContent value="parts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Repuestos Utilizados</CardTitle>
                  <CardDescription>Repuestos utilizados durante el mantenimiento</CardDescription>
                </div>
                {isEditMode && (
                  <Button onClick={addPart} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Repuesto
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {displayMaintenance.parts && displayMaintenance.parts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repuesto</TableHead>
                      <TableHead>Número de Parte</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Costo Unitario</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      {isEditMode && <TableHead className="text-center">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayMaintenance.parts.map((part: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{part.name}</TableCell>
                        <TableCell>{part.partNumber || '-'}</TableCell>
                        <TableCell className="text-center">{part.quantity}</TableCell>
                        <TableCell className="text-right">${part.cost || 0}</TableCell>
                        <TableCell className="text-right">${((parseFloat(part.cost) || 0) * part.quantity).toFixed(2)}</TableCell>
                        {isEditMode && (
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editPart(part, index)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removePart(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay repuestos registrados para este mantenimiento.
                  {isEditMode && (
                    <div className="mt-4">
                      <Button onClick={addPart} variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Primer Repuesto
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tareas Completadas</CardTitle>
              <CardDescription>Tareas completadas durante el mantenimiento</CardDescription>
            </CardHeader>
            <CardContent>
              {maintenancePlan?.maintenance_tasks && maintenancePlan.maintenance_tasks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarea</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenancePlan.maintenance_tasks.map((task: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{task.description}</TableCell>
                        <TableCell>{task.type || '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Completado
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                  No hay tareas registradas para este mantenimiento.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for adding/editing parts */}
      <Dialog open={isPartDialogOpen} onOpenChange={setIsPartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditingPart ? "Editar Repuesto" : "Agregar Repuesto"}</DialogTitle>
            <DialogDescription>
              {isEditingPart ? "Modifica los detalles del repuesto" : "Ingresa los detalles del nuevo repuesto"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partName">Nombre del Repuesto</Label>
              <Input
                id="partName"
                value={currentPart?.name || ""}
                onChange={(e) => setCurrentPart(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Ej: Filtro de aceite"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partNumber">Número de Parte (Opcional)</Label>
              <Input
                id="partNumber"
                value={currentPart?.partNumber || ""}
                onChange={(e) => setCurrentPart(prev => prev ? { ...prev, partNumber: e.target.value } : null)}
                placeholder="Ej: ABC-123"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partQuantity">Cantidad</Label>
                <Input
                  id="partQuantity"
                  type="number"
                  min="1"
                  value={currentPart?.quantity || 1}
                  onChange={(e) => setCurrentPart(prev => prev ? { ...prev, quantity: parseInt(e.target.value) || 1 } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partCost">Costo Unitario</Label>
                <Input
                  id="partCost"
                  type="number"
                  step="0.01"
                  value={currentPart?.cost || ""}
                  onChange={(e) => setCurrentPart(prev => prev ? { ...prev, cost: e.target.value } : null)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPartDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={savePart} disabled={!currentPart?.name}>
              {isEditingPart ? "Actualizar" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
