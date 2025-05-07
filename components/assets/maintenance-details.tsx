"use client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Calendar, CheckCircle2, Clock, FileText, Printer, User } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface MaintenanceDetailsProps {
  maintenance: any
  onBack: () => void
}

export function MaintenanceDetails({ maintenance, onBack }: MaintenanceDetailsProps) {
  // Formatear la fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, "PPP", { locale: es })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detalles del Mantenimiento</h2>
          <p className="text-muted-foreground">{maintenance.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

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
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span>{formatDate(maintenance.date)}</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Tipo</h4>
                <Badge variant={maintenance.type === "Preventivo" ? "default" : "secondary"}>{maintenance.type}</Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Horas del Equipo</h4>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span>{maintenance.hours} horas</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Técnico</h4>
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span>{maintenance.technician}</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Horas de Trabajo</h4>
                <span>{maintenance.laborHours} horas</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Estado</h4>
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {maintenance.status}
                </Badge>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Descripción</h4>
              <p className="text-sm">{maintenance.description}</p>
            </div>

            {maintenance.findings && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Hallazgos</h4>
                <p className="text-sm">{maintenance.findings}</p>
              </div>
            )}

            {maintenance.actions && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Acciones Realizadas</h4>
                <p className="text-sm">{maintenance.actions}</p>
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
                  {maintenance.parts
                    ? maintenance.parts.reduce(
                        (total: number, part: any) => total + part.quantity * (part.cost || 0),
                        0,
                      )
                    : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Costo de Mano de Obra</span>
                <span className="font-medium">${maintenance.laborCost || 0}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Costo Total</span>
                <span className="font-bold">${maintenance.totalCost || 0}</span>
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
              <CardTitle>Repuestos Utilizados</CardTitle>
              <CardDescription>Repuestos utilizados durante el mantenimiento</CardDescription>
            </CardHeader>
            <CardContent>
              {maintenance.parts && maintenance.parts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repuesto</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Costo Unitario</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenance.parts.map((part: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{part.name}</TableCell>
                        <TableCell className="text-center">{part.quantity}</TableCell>
                        <TableCell className="text-right">${part.cost || 0}</TableCell>
                        <TableCell className="text-right">${((part.cost || 0) * part.quantity).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay repuestos registrados para este mantenimiento.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tareas Completadas</CardTitle>
              <CardDescription>Tareas realizadas durante el mantenimiento</CardDescription>
            </CardHeader>
            <CardContent>
              {maintenance.completedTasks ? (
                <div className="space-y-2">
                  {Object.entries(maintenance.completedTasks).map(([taskId, completed]: [string, any]) => {
                    // Buscar la tarea correspondiente (en una aplicación real, tendríamos los datos completos)
                    const taskDescription = `Tarea ${taskId}`
                    return (
                      <div key={taskId} className="flex items-center gap-2 p-2 border rounded-md">
                        {completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-muted-foreground" />
                        )}
                        <span className={completed ? "font-medium" : "text-muted-foreground"}>{taskDescription}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay tareas registradas para este mantenimiento.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
