"use client"

import { useState } from "react"
import { CheckCircle2, ClipboardList, DollarSign, LinkIcon, Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DateInput } from "@/components/ui/date-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface MaintenanceHistoryPart {
  name: string
  partNumber?: string
  quantity: number
  cost?: string
}

interface MaintenanceHistoryRecord {
  date: Date
  type: string
  hours?: string
  description: string
  findings?: string
  actions?: string
  technician: string
  laborHours?: string
  laborCost?: string
  cost?: string
  workOrder?: string
  parts?: MaintenanceHistoryPart[]
  maintenancePlanId?: string
  completedTasks?: Record<string, boolean>
}

interface MaintenanceHistoryTabProps {
  isNewEquipment: boolean
  maintenanceHistory: MaintenanceHistoryRecord[]
  onAddMaintenanceHistory: () => void
  onRemoveMaintenanceHistory: (index: number) => void
  onEditMaintenanceHistory: (index: number) => void
  historyDate: Date | undefined
  setHistoryDate: (date: Date | undefined) => void
  historyType: string
  setHistoryType: (type: string) => void
  historyDescription: string
  setHistoryDescription: (description: string) => void
  historyTechnician: string
  setHistoryTechnician: (technician: string) => void
  historyCost: string
  setHistoryCost: (cost: string) => void
  editingHistoryIndex: number | null
  historyHours?: string
  setHistoryHours?: (hours: string) => void
  historyFindings?: string
  setHistoryFindings?: (findings: string) => void
  historyActions?: string
  setHistoryActions?: (actions: string) => void
  historyLaborHours?: string
  setHistoryLaborHours?: (hours: string) => void
  historyLaborCost?: string
  setHistoryLaborCost?: (cost: string) => void
  historyWorkOrder?: string
  setHistoryWorkOrder?: (workOrder: string) => void
  historyParts?: MaintenanceHistoryPart[]
  setHistoryParts?: (parts: MaintenanceHistoryPart[]) => void
  selectedMaintenancePlan?: any
  setSelectedMaintenancePlan?: (plan: any) => void
  completedTasks?: Record<string, boolean>
  setCompletedTasks?: (tasks: Record<string, boolean>) => void
  maintenanceSchedule?: any[]
  onAddDetailedMaintenanceHistory?: () => void
  onOpenPartDialog?: () => void
  onOpenLinkMaintenancePlanDialog?: () => void
}

export function MaintenanceHistoryTab({
  isNewEquipment,
  maintenanceHistory,
  onAddMaintenanceHistory,
  onRemoveMaintenanceHistory,
  onEditMaintenanceHistory,
  historyDate,
  setHistoryDate,
  historyType,
  setHistoryType,
  historyDescription,
  setHistoryDescription,
  historyTechnician,
  setHistoryTechnician,
  historyCost,
  setHistoryCost,
  editingHistoryIndex,
  historyHours,
  setHistoryHours,
  historyFindings,
  setHistoryFindings,
  historyActions,
  setHistoryActions,
  historyLaborHours,
  setHistoryLaborHours,
  historyLaborCost,
  setHistoryLaborCost,
  historyWorkOrder,
  setHistoryWorkOrder,
  historyParts = [],
  setHistoryParts,
  selectedMaintenancePlan,
  setSelectedMaintenancePlan,
  completedTasks = {},
  setCompletedTasks,
  maintenanceSchedule = [],
  onAddDetailedMaintenanceHistory,
  onOpenPartDialog,
  onOpenLinkMaintenancePlanDialog,
}: MaintenanceHistoryTabProps) {
  const removePart = (index: number) => {
    if (setHistoryParts) {
      const newParts = [...historyParts]
      newParts.splice(index, 1)
      setHistoryParts(newParts)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Mantenimiento</CardTitle>
        <CardDescription>
          {isNewEquipment
            ? "Este es un equipo nuevo sin historial de mantenimiento previo"
            : "Registre el historial de mantenimiento previo del activo"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isNewEquipment && (
          <div className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Registro Básico</TabsTrigger>
                <TabsTrigger value="detailed">Registro Detallado</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <DateInput
                      value={historyDate}
                      onChange={setHistoryDate}
                      placeholder="dd/mm/aaaa"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Mantenimiento</Label>
                    <Select onValueChange={setHistoryType} value={historyType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preventive">Preventivo</SelectItem>
                        <SelectItem value="corrective">Correctivo</SelectItem>
                        <SelectItem value="predictive">Predictivo</SelectItem>
                        <SelectItem value="overhaul">Overhaul</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    placeholder="Describa el mantenimiento realizado"
                    value={historyDescription}
                    onChange={(e) => setHistoryDescription(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Técnico</Label>
                    <Input
                      placeholder="Nombre del técnico"
                      value={historyTechnician}
                      onChange={(e) => setHistoryTechnician(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Costo</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="0.00"
                        className="pl-8"
                        value={historyCost}
                        onChange={(e) => setHistoryCost(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={onAddMaintenanceHistory}
                  className="mt-4"
                  disabled={!historyDate || !historyType || !historyDescription || !historyTechnician}
                >
                  <Plus className="mr-2 h-4 w-4" /> {editingHistoryIndex !== null ? "Actualizar" : "Agregar"}{" "}
                  Registro
                </Button>
              </TabsContent>

              <TabsContent value="detailed" className="space-y-4 pt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">Detalles del Mantenimiento</CardTitle>
                      {selectedMaintenancePlan ? (
                        <Badge className="flex items-center gap-1 bg-green-100 text-green-800 hover:bg-green-200">
                          <LinkIcon className="h-3 w-3" />
                          Plan: {selectedMaintenancePlan.name}
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onOpenLinkMaintenancePlanDialog}
                          className="text-xs"
                        >
                          <LinkIcon className="mr-1 h-3 w-3" />
                          Vincular a Plan
                        </Button>
                      )}
                    </div>
                    <CardDescription>
                      Registre información detallada del mantenimiento realizado
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Fecha</Label>
                        <DateInput
                          value={historyDate}
                          onChange={setHistoryDate}
                          placeholder="dd/mm/aaaa"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo de Mantenimiento</Label>
                        <Select onValueChange={setHistoryType} value={historyType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Preventivo">Preventivo</SelectItem>
                            <SelectItem value="Correctivo">Correctivo</SelectItem>
                            <SelectItem value="Predictivo">Predictivo</SelectItem>
                            <SelectItem value="Overhaul">Overhaul</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Horas del Equipo</Label>
                        <Input
                          type="number"
                          placeholder="Ej: 500"
                          value={historyHours}
                          onChange={(e) => setHistoryHours?.(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Textarea
                          placeholder="Describa el mantenimiento realizado"
                          value={historyDescription}
                          onChange={(e) => setHistoryDescription(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Hallazgos</Label>
                        <Textarea
                          placeholder="Hallazgos durante el mantenimiento"
                          value={historyFindings}
                          onChange={(e) => setHistoryFindings?.(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Acciones Realizadas</Label>
                        <Textarea
                          placeholder="Acciones realizadas durante el mantenimiento"
                          value={historyActions}
                          onChange={(e) => setHistoryActions?.(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Técnico</Label>
                        <Input
                          placeholder="Nombre del técnico"
                          value={historyTechnician}
                          onChange={(e) => setHistoryTechnician(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Horas de Trabajo</Label>
                        <Input
                          type="number"
                          placeholder="Ej: 4"
                          value={historyLaborHours}
                          onChange={(e) => setHistoryLaborHours?.(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Costo de Mano de Obra</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="0.00"
                            className="pl-8"
                            value={historyLaborCost}
                            onChange={(e) => setHistoryLaborCost?.(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Orden de Trabajo</Label>
                        <Input
                          placeholder="Ej: OT-12345"
                          value={historyWorkOrder}
                          onChange={(e) => setHistoryWorkOrder?.(e.target.value)}
                        />
                      </div>
                    </div>

                    {selectedMaintenancePlan && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Tareas Completadas</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // This would open a dialog to manage tasks
                            }}
                          >
                            <ClipboardList className="mr-1 h-4 w-4" /> Gestionar Tareas
                          </Button>
                        </div>
                        <div className="border rounded-md p-3 bg-muted/20">
                          {Object.keys(completedTasks).length > 0 ? (
                            <div className="space-y-2">
                              {selectedMaintenancePlan.tasks?.map((task: any) => (
                                <div key={task.id} className="flex items-center gap-2">
                                  {completedTasks[task.id] ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <div className="h-4 w-4 rounded-full border border-muted-foreground" />
                                  )}
                                  <span className="text-sm">{task.description}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-2 text-sm text-muted-foreground">
                              No hay tareas marcadas como completadas
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Repuestos Utilizados</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onOpenPartDialog}
                        >
                          <Plus className="mr-1 h-4 w-4" /> Agregar Repuesto
                        </Button>
                      </div>

                      {historyParts.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nombre</TableHead>
                              <TableHead>Número de Parte</TableHead>
                              <TableHead>Cantidad</TableHead>
                              <TableHead>Costo</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {historyParts.map((part, index) => (
                              <TableRow key={index}>
                                <TableCell>{part.name}</TableCell>
                                <TableCell>{part.partNumber || "-"}</TableCell>
                                <TableCell>{part.quantity}</TableCell>
                                <TableCell>{part.cost || "-"}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removePart(index)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground border rounded-md">
                          No hay repuestos registrados para este mantenimiento.
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="button"
                      onClick={onAddDetailedMaintenanceHistory}
                      className="w-full"
                      disabled={!historyDate || !historyType || !historyDescription || !historyTechnician}
                    >
                      <Plus className="mr-2 h-4 w-4" />{" "}
                      {editingHistoryIndex !== null ? "Actualizar" : "Agregar"} Registro Detallado
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>

            {maintenanceHistory.length > 0 ? (
              <div className="space-y-4">
                <Separator />
                <h4 className="font-medium">Registros de Mantenimiento</h4>
                <div className="space-y-2">
                  {maintenanceHistory.map((record, index) => (
                    <div key={index} className="border rounded-md overflow-hidden">
                      <div className="flex items-start justify-between p-3 bg-muted/50">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {format(record.date, "PPP", { locale: es })} - {record.type}
                            {record.hours && <span className="ml-2">({record.hours} horas)</span>}
                          </div>
                          <div className="text-sm text-muted-foreground">{record.description}</div>
                          <div className="text-xs">Técnico: {record.technician}</div>
                          {record.cost && <div className="text-xs">Costo: ${record.cost}</div>}
                          {record.laborHours && (
                            <div className="text-xs">Horas de trabajo: {record.laborHours}</div>
                          )}
                          {record.workOrder && <div className="text-xs">OT: {record.workOrder}</div>}
                          {record.maintenancePlanId && (
                            <div className="text-xs flex items-center gap-1 text-blue-600">
                              <LinkIcon className="h-3 w-3" />
                              <span>Vinculado a plan de mantenimiento</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditMaintenanceHistory(index)}
                            className="h-8"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveMaintenanceHistory(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {record.findings && (
                        <div className="px-3 py-2 border-t">
                          <h5 className="text-xs font-medium">Hallazgos:</h5>
                          <p className="text-xs">{record.findings}</p>
                        </div>
                      )}
                      {record.actions && (
                        <div className="px-3 py-2 border-t">
                          <h5 className="text-xs font-medium">Acciones:</h5>
                          <p className="text-xs">{record.actions}</p>
                        </div>
                      )}
                      {record.parts && record.parts.length > 0 && (
                        <div className="p-3 border-t">
                          <h5 className="text-xs font-medium mb-2">Repuestos utilizados:</h5>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Nombre</TableHead>
                                <TableHead className="text-xs">Número de Parte</TableHead>
                                <TableHead className="text-xs">Cantidad</TableHead>
                                <TableHead className="text-xs">Costo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {record.parts.map((part, partIndex) => (
                                <TableRow key={partIndex}>
                                  <TableCell className="text-xs">{part.name}</TableCell>
                                  <TableCell className="text-xs">{part.partNumber || "-"}</TableCell>
                                  <TableCell className="text-xs">{part.quantity}</TableCell>
                                  <TableCell className="text-xs">{part.cost || "-"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                {isNewEquipment
                  ? "Este es un equipo nuevo sin historial de mantenimiento previo."
                  : "No hay registros de mantenimiento. Agregue el historial de mantenimiento previo del activo."}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 