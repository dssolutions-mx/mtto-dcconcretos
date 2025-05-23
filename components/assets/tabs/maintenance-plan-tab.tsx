"use client"

import { AlertCircle, Check, CheckCircle2, Clock } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
}

export function MaintenancePlanTab({
  selectedModel,
  maintenanceSchedule,
  completedMaintenances,
  nextMaintenance,
  openMaintenanceDialog,
  onRegisterMaintenance,
}: MaintenancePlanTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan de Mantenimiento</CardTitle>
        <CardDescription>
          Plan de mantenimiento recomendado por el fabricante para este modelo de equipo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {selectedModel ? (
          <>
            {nextMaintenance && (
              <Alert className="bg-amber-50 border-amber-200">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Próximo mantenimiento</AlertTitle>
                <AlertDescription className="text-amber-700">
                  {nextMaintenance.name} a las {nextMaintenance.hours} horas (faltan {nextMaintenance.remaining}{" "}
                  horas)
                </AlertDescription>
              </Alert>
            )}

            {maintenanceSchedule.length > 0 ? (
              <div className="space-y-4">
                {maintenanceSchedule.map((maintenance) => (
                  <Card
                    key={maintenance.id}
                    className={cn(
                      "border transition-colors",
                      completedMaintenances.includes(maintenance.id) ? "bg-green-50 border-green-200" : "",
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={completedMaintenances.includes(maintenance.id) ? "outline" : "default"}
                          >
                            {maintenance.hours} horas
                          </Badge>
                          <h3 className="font-medium">{maintenance.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {completedMaintenances.includes(maintenance.id) ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
                              <Check className="mr-1 h-3 w-3" /> Completado
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <CardDescription className="mt-1">{maintenance.description}</CardDescription>
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
                      <Button variant="outline" size="sm" onClick={() => openMaintenanceDialog(maintenance)}>
                        Ver detalles
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onRegisterMaintenance(maintenance)
                        }}
                      >
                        Registrar Mantenimiento
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay un plan de mantenimiento definido para este modelo de equipo.
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Seleccione un modelo de equipo para ver el plan de mantenimiento recomendado.
          </div>
        )}
      </CardContent>
    </Card>
  )
} 