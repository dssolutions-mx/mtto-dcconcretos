"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Calendar, CheckCircle2, Clock, FileText, Printer, User, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"

interface ServiceOrderDetailsProps {
  orderId: string
}

export function ServiceOrderDetails({ orderId }: ServiceOrderDetailsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [serviceOrder, setServiceOrder] = useState<any>(null)
  const [relatedChecklist, setRelatedChecklist] = useState<any>(null)

  useEffect(() => {
    async function loadServiceOrder() {
      try {
        setIsLoading(true)
        const supabase = createClient()

        // Obtener la orden de servicio
        const { data: orderData, error: orderError } = await supabase
          .from("service_orders")
          .select("*")
          .eq("order_id", orderId)
          .single()

        if (orderError) {
          throw orderError
        }

        setServiceOrder(orderData)

        // Si hay un checklist relacionado, obtenerlo
        if (orderData.checklist_id) {
          const { data: checklistData, error: checklistError } = await supabase
            .from("completed_checklists")
            .select("*")
            .eq("checklist_id", orderData.checklist_id)
            .eq("service_order_id", orderId)
            .single()

          if (!checklistError) {
            setRelatedChecklist(checklistData)
          }
        }
      } catch (error) {
        console.error("Error al cargar la orden de servicio:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (orderId) {
      loadServiceOrder()
    }
  }, [orderId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Cargando orden de servicio...</p>
        </div>
      </div>
    )
  }

  if (!serviceOrder) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium">Orden de servicio no encontrada</h3>
        <p className="text-muted-foreground mt-2">La orden de servicio solicitada no existe o ha sido eliminada.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/ordenes")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Órdenes
        </Button>
      </div>
    )
  }

  // Formatear la fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  // Obtener el color del badge según el estado
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completado":
        return "bg-green-100 text-green-800 hover:bg-green-200"
      case "en progreso":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200"
      case "pendiente":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
      case "cancelado":
        return "bg-red-100 text-red-800 hover:bg-red-200"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200"
    }
  }

  // Obtener el color del badge según la prioridad
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "alta":
        return "bg-orange-100 text-orange-800 hover:bg-orange-200"
      case "media":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200"
      case "baja":
        return "bg-green-100 text-green-800 hover:bg-green-200"
      case "crítica":
        return "bg-red-100 text-red-800 hover:bg-red-200"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Orden de Servicio: {serviceOrder.order_id}</h2>
          <p className="text-muted-foreground">Detalles de la orden de servicio para {serviceOrder.asset_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/ordenes")}>
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
            <CardDescription>Detalles generales de la orden de servicio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Activo</h4>
                <p className="font-medium">{serviceOrder.asset_name}</p>
                <p className="text-sm text-muted-foreground">ID: {serviceOrder.asset_id}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Estado</h4>
                <Badge className={getStatusColor(serviceOrder.status)}>{serviceOrder.status}</Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Tipo</h4>
                <p>{serviceOrder.type}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Prioridad</h4>
                <Badge className={getPriorityColor(serviceOrder.priority)}>{serviceOrder.priority}</Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Fecha</h4>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span>{formatDate(serviceOrder.date)}</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Técnico</h4>
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-1 text-muted-foreground" />
                  <span>{serviceOrder.technician}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Descripción</h4>
              <p className="text-sm">{serviceOrder.description}</p>
            </div>

            {serviceOrder.notes && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Observaciones</h4>
                <p className="text-sm">{serviceOrder.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
            <CardDescription>Resumen de la orden de servicio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tipo de Mantenimiento</span>
                <span className="font-medium">{serviceOrder.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fecha de Realización</span>
                <span className="font-medium">{formatDate(serviceOrder.date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Técnico Responsable</span>
                <span className="font-medium">{serviceOrder.technician}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Repuestos Utilizados</span>
                <span className="font-medium">{serviceOrder.parts ? serviceOrder.parts.length : 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Costo Total</span>
                <span className="font-medium">${serviceOrder.total_cost || "0.00"}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Checklist Relacionado</span>
                <span className="font-medium">
                  {serviceOrder.checklist_id ? (
                    <Link href={`/checklists/${serviceOrder.checklist_id}`} className="text-primary hover:underline">
                      Ver Checklist
                    </Link>
                  ) : (
                    "N/A"
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fecha de Creación</span>
                <span className="font-medium">{formatDate(serviceOrder.created_at)}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant={serviceOrder.status === "Completado" ? "outline" : "default"}>
              {serviceOrder.status === "Completado" ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Completado
                </>
              ) : (
                <>
                  <Wrench className="mr-2 h-4 w-4" />
                  Marcar como Completado
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Tabs defaultValue="parts">
        <TabsList>
          <TabsTrigger value="parts">Repuestos Utilizados</TabsTrigger>
          <TabsTrigger value="checklist">Checklist Relacionado</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="parts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Repuestos Utilizados</CardTitle>
              <CardDescription>Repuestos utilizados durante el mantenimiento</CardDescription>
            </CardHeader>
            <CardContent>
              {serviceOrder.parts && serviceOrder.parts.length > 0 ? (
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
                    {serviceOrder.parts.map((part: any) => (
                      <TableRow key={part.id}>
                        <TableCell>{part.name}</TableCell>
                        <TableCell className="text-center">{part.quantity}</TableCell>
                        <TableCell className="text-right">${part.cost || "0.00"}</TableCell>
                        <TableCell className="text-right">
                          ${((Number.parseFloat(part.cost) || 0) * part.quantity).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-medium">${serviceOrder.total_cost || "0.00"}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay repuestos registrados para esta orden de servicio.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Checklist Relacionado</CardTitle>
              <CardDescription>Detalles del checklist que generó esta orden de servicio</CardDescription>
            </CardHeader>
            <CardContent>
              {relatedChecklist ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">ID del Checklist</h4>
                      <p>{relatedChecklist.checklist_id}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Fecha de Completado</h4>
                      <p>{formatDate(relatedChecklist.completion_date)}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Técnico</h4>
                      <p>{relatedChecklist.technician}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Estado</h4>
                      <Badge className={getStatusColor(relatedChecklist.status)}>{relatedChecklist.status}</Badge>
                    </div>
                  </div>

                  {relatedChecklist.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Observaciones</h4>
                      <p className="text-sm">{relatedChecklist.notes}</p>
                    </div>
                  )}

                  <div className="flex justify-center mt-4">
                    <Button variant="outline" asChild>
                      <Link href={`/checklists/${relatedChecklist.checklist_id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        Ver Checklist Completo
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay un checklist relacionado con esta orden de servicio.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de la Orden</CardTitle>
              <CardDescription>Historial de cambios y actualizaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Orden completada</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(serviceOrder.date)} • {serviceOrder.technician}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Orden creada automáticamente</p>
                    <p className="text-xs text-muted-foreground">{formatDate(serviceOrder.created_at)} • Sistema</p>
                    <p className="text-xs text-muted-foreground mt-1">Generada a partir del checklist completado</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
