"use client"

import { AlertCircle, Check, CheckCircle2, Clock, LinkIcon, Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface MaintenanceTask {
  id: string
  description: string
  type: string
  estimatedTime: number
  requiresSpecialist: boolean
  parts: MaintenancePart[]
  completed?: boolean
}

interface MaintenancePart {
  id: string
  name: string
  partNumber: string
  quantity: number
  cost?: number
}

interface MaintenanceHistoryPart {
  name: string
  partNumber?: string
  quantity: number
  cost?: string
}

interface MaintenanceSchedule {
  id: string
  hours: number
  name: string
  description: string
  tasks: MaintenanceTask[]
  completed?: boolean
  completionDate?: Date
  technician?: string
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

interface NextMaintenance {
  hours: number
  name: string
  remaining: number
}

interface MaintenancePlanTabProps {
  selectedModel: any
  maintenanceSchedule: MaintenanceSchedule[]
  completedMaintenances: string[]
  nextMaintenance: NextMaintenance | null
  openMaintenanceDialog: (maintenance: MaintenanceSchedule) => void
  onRegisterMaintenance: (maintenance: MaintenanceSchedule) => void
  maintenanceHistory?: MaintenanceHistoryRecord[]
  onEditMaintenanceHistory?: (index: number) => void
  onRemoveMaintenanceHistory?: (index: number) => void
  onAddNewMaintenance?: () => void
}

export function MaintenancePlanTab({
  selectedModel,
  maintenanceSchedule,
  completedMaintenances,
  nextMaintenance,
  openMaintenanceDialog,
  onRegisterMaintenance,
  maintenanceHistory = [],
  onEditMaintenanceHistory = () => {},
  onRemoveMaintenanceHistory = () => {},
  onAddNewMaintenance = () => {}
}: MaintenancePlanTabProps) {
  return (
    <div className="space-y-6">
      {nextMaintenance && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Próximo Mantenimiento</AlertTitle>
          <AlertDescription>
            <span className="font-medium">{nextMaintenance.name}</span> a las{" "}
            <span className="font-medium">{nextMaintenance.hours}</span> horas (
            <span className="text-muted-foreground">
              {nextMaintenance.remaining} horas restantes
            </span>
            )
          </AlertDescription>
        </Alert>
      )}

      {maintenanceSchedule.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {maintenanceSchedule.map((maintenance) => (
              <Card
                key={maintenance.id}
                className={cn(
                  "overflow-hidden transition-all hover:shadow",
                  completedMaintenances.includes(maintenance.id) &&
                    "border-green-200 bg-green-50"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between">
                    <CardTitle>
                      {maintenance.name}
                      <Badge
                        variant="outline"
                        className="ml-2 text-xs font-normal"
                      >
                        {maintenance.hours} horas
                      </Badge>
                    </CardTitle>
                    {completedMaintenances.includes(maintenance.id) && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <CardDescription>{maintenance.description}</CardDescription>
                </CardHeader>

                <CardContent className="pb-2">
                  {maintenance.tasks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Tareas ({maintenance.tasks.length})</h4>
                      <div className="space-y-1">
                        {maintenance.tasks.map((task) => (
                          <div key={task.id} className="flex items-start gap-2 text-sm">
                            <div className="h-5 w-5 mt-0.5 flex-shrink-0">
                              {task.completed ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border border-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{task.description}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{task.type}</span>
                                <span>•</span>
                                <span>{task.estimatedTime}h</span>
                                {task.requiresSpecialist && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-600 flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      Requiere especialista
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex justify-between pt-2">
                  <Button variant="ghost" size="sm" onClick={() => openMaintenanceDialog(maintenance)}>
                    Ver detalles
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRegisterMaintenance(maintenance);
                    }}
                  >
                    Registrar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sin Plan de Mantenimiento</CardTitle>
            <CardDescription>
              {selectedModel ? "El modelo seleccionado no tiene un plan de mantenimiento definido" : "Seleccione un modelo para ver su plan de mantenimiento"}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      
      {/* Maintenance History Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Historial de Mantenimiento</CardTitle>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddNewMaintenance();
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Agregar Mantenimiento
            </Button>
          </div>
          <CardDescription>
            Registros de mantenimiento realizados en el activo
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {maintenanceHistory.length > 0 ? (
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay registros de mantenimiento para este activo.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 