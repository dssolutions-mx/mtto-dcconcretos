"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"
import { CalendarDays, Clock, User, Wrench, Package, CheckSquare, ArrowLeft, FileText, AlertTriangle, ClipboardCheck } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"

interface ServiceOrderDetailProps {
  id: string
}

export function ServiceOrderDetail({ id }: ServiceOrderDetailProps) {
  const [serviceOrder, setServiceOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchServiceOrder = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        
        // Obtenemos la orden de servicio con información del activo y la OT asociada si existe
        const { data, error } = await supabase
          .from("service_orders")
          .select(`
            *,
            asset:asset_id (name, asset_id, location),
            work_order:work_order_id (*)
          `)
          .eq("id", id)
          .single()
        
        if (error) throw error
        
        // Inicializamos primero con un array de parts vacío para evitar el error
        const initialServiceOrder = {
          ...data,
          parts: []
        }

        setServiceOrder(initialServiceOrder)
        
        // También obtenemos las partes utilizadas si existen
        try {
          const { data: partsData, error: partsError } = await supabase
            .from("task_parts")  // Usando la tabla task_parts que sí existe
            .select("*")
            .eq("service_order_id", id)
          
          if (!partsError && partsData) {
            // Actualizamos con las partes obtenidas
            setServiceOrder((prevState: any) => ({
              ...prevState,
              parts: Array.isArray(partsData) ? partsData : []
            }))
          } else {
            console.warn("Error al cargar las partes:", partsError?.message)
          }
        } catch (partsErr) {
          console.warn("Error al cargar las partes:", partsErr)
        }
      } catch (error: any) {
        console.error("Error al cargar la orden de servicio:", error.message)
        setError("No se pudo cargar la información de la orden de servicio.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchServiceOrder()
  }, [id])

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A"
    try {
      return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: es })
    } catch (error) {
      return dateStr
    }
  }

  const formatCurrency = (amount: number | string | null | undefined) => {
    if (amount === null || amount === undefined) return "N/A"
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(numAmount)
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "outline" | "secondary" | "destructive", label: string }> = {
      "pendiente": { variant: "outline", label: "Pendiente" },
      "en_proceso": { variant: "secondary", label: "En Proceso" },
      "completado": { variant: "default", label: "Completado" },
      "cancelado": { variant: "destructive", label: "Cancelado" }
    }
    
    const statusInfo = statusMap[status?.toLowerCase()] || { variant: "default", label: status || "Desconocido" }
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-24 rounded-md" />
              <Skeleton className="h-24 rounded-md" />
            </div>
            <Skeleton className="h-32 rounded-md" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !serviceOrder) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-destructive">
            <AlertTriangle className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">{error || "No se pudo encontrar la orden de servicio"}</p>
            <Button onClick={() => router.push("/servicios")} variant="outline" className="mt-4">
              Volver a la lista
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Aseguramos que parts sea siempre un array antes de usarlo
  const parts = Array.isArray(serviceOrder?.parts) ? serviceOrder.parts : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => router.push("/servicios")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Orden de Servicio: {serviceOrder.order_id}</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Detalles de la Orden</CardTitle>
                  <CardDescription>Información general de la orden de servicio</CardDescription>
                </div>
                {getStatusBadge(serviceOrder.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">ID de Orden</p>
                      <p className="font-medium">{serviceOrder.order_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CalendarDays className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha</p>
                      <p className="font-medium">{formatDate(serviceOrder.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      <p className="font-medium">
                        {serviceOrder.type === 'corrective' ? 'Correctivo' : 
                         serviceOrder.type === 'preventive' ? 'Preventivo' : 
                         serviceOrder.type}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Técnico</p>
                      <p className="font-medium">{serviceOrder.technician || "No especificado"}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha de Completado</p>
                      <p className="font-medium">{formatDate(serviceOrder.completion_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Costo Total</p>
                      <p className="font-medium">{formatCurrency(serviceOrder.total_cost)}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-medium mb-2">Descripción</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {serviceOrder.description || "Sin descripción"}
                </p>
              </div>
            </CardContent>
          </Card>
          
          {parts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Partes Utilizadas</CardTitle>
                <CardDescription>Listado de repuestos y materiales utilizados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-muted/50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Nombre
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Número de Parte
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Cantidad
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Precio Unitario
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-gray-200">
                      {parts.map((part: any, index: number) => (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{part.name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{part.part_number}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{part.quantity}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{formatCurrency(part.cost)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            {formatCurrency(part.quantity * (part.cost || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-sm font-medium text-right">
                          Total
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {formatCurrency(
                            parts.reduce(
                              (total: number, part: any) => total + (part.quantity * (part.cost || 0)),
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {serviceOrder.work_order && (
            <Card>
              <CardHeader>
                <CardTitle>Orden de Trabajo Relacionada</CardTitle>
                <CardDescription>La orden de trabajo que derivó en esta orden de servicio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-muted p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">OT: {serviceOrder.work_order.order_id}</h3>
                    {getStatusBadge(serviceOrder.work_order.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {serviceOrder.work_order.description || "Sin descripción"}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/ordenes/${serviceOrder.work_order_id}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      Ver Orden de Trabajo
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activo</CardTitle>
              <CardDescription>Información del activo intervenido</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {serviceOrder.asset ? (
                <>
                  <div className="space-y-3">
                    <h3 className="font-medium">{serviceOrder.asset.name}</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <div className="flex items-center justify-between">
                        <span>ID:</span>
                        <span className="font-medium">{serviceOrder.asset.asset_id}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Ubicación:</span>
                        <span className="font-medium">{serviceOrder.asset.location}</span>
                      </div>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/activos/${serviceOrder.asset_id}`}>
                      <Package className="mr-2 h-4 w-4" />
                      Ver Activo
                    </Link>
                  </Button>
                </>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No se encontró información del activo</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Información Adicional</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creado:</span>
                  <span>{formatDate(serviceOrder.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última actualización:</span>
                  <span>{formatDate(serviceOrder.updated_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 