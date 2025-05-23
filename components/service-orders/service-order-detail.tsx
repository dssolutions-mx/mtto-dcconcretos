"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { 
  CalendarDays, Clock, User, Wrench, Package, CheckSquare, ArrowLeft, 
  FileText, AlertTriangle, ClipboardCheck, Printer, Download, Eye,
  Settings, CircuitBoard, Cog, FileImage, Receipt, Camera, Building,
  DollarSign, Calendar, MapPin, Hash
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { ServiceOrderPrintReport } from "./service-order-print-report"

interface ServiceOrderDetailProps {
  id: string
}

interface ServiceOrderData {
  id: string
  order_id: string
  asset_id: string | null
  asset_name: string
  type: string
  priority: string | null
  status: string | null
  date: string
  technician: string
  technician_id: string | null
  description: string
  findings: string | null
  actions: string | null
  notes: string | null
  parts: any[]
  labor_hours: number | null
  labor_cost: string | null
  parts_cost: string | null
  total_cost: string | null
  checklist_id: string | null
  work_order_id: string | null
  documents: string[] | null
  created_at: string
  updated_at: string
  asset?: {
    name: string
    asset_id: string
    location: string | null
    serial_number: string | null
    current_hours: number | null
    current_kilometers: number | null
    equipment_model?: {
      name: string
      manufacturer: string
    } | null
  }
  work_order?: any
  maintenance_history?: any[]
  completed_checklist?: any
}

export function ServiceOrderDetail({ id }: ServiceOrderDetailProps) {
  const [serviceOrder, setServiceOrder] = useState<ServiceOrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPrintView, setShowPrintView] = useState(false)
  const [showPrintReport, setShowPrintReport] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchServiceOrder = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        
        // Get comprehensive service order data with asset details
        const { data, error } = await supabase
          .from("service_orders")
          .select(`
            *,
            asset:asset_id (
              name,
              asset_id,
              location,
              serial_number,
              current_hours,
              current_kilometers,
              equipment_model:model_id (
                name,
                manufacturer
              )
            ),
            work_order:work_order_id (
              *
            )
          `)
          .eq("id", id)
          .single()
        
        if (error) throw error
        
        // Debug logging to understand the data structure
        console.log("Raw service order data from database:", data)
        console.log("Parts data (raw):", data.parts)
        console.log("Parts data type:", typeof data.parts)
        
        // Parse parts data properly
        let parsedParts = [];
        if (data.parts) {
          try {
            // If it's a string, parse it as JSON
            if (typeof data.parts === 'string') {
              parsedParts = JSON.parse(data.parts);
            } 
            // If it's already an object/array, use it directly
            else if (Array.isArray(data.parts)) {
              parsedParts = data.parts;
            }
            // If it's an object but not an array, try to convert it
            else if (typeof data.parts === 'object') {
              parsedParts = Array.isArray(data.parts) ? data.parts : [data.parts];
            }
          } catch (error) {
            console.error("Error parsing parts data:", error);
            parsedParts = [];
          }
        }
        
        console.log("Parsed parts array:", parsedParts)
        
        // Initialize with proper data structure
        const initialServiceOrder: ServiceOrderData = {
          ...data,
          parts: parsedParts,
          asset: data.asset || undefined
        }

        setServiceOrder(initialServiceOrder)
        
        // Get related maintenance history
        if (data.asset_id) {
          const { data: historyData } = await supabase
            .from("maintenance_history")
            .select("*")
            .eq("service_order_id", id)
            .order("date", { ascending: false })
          
          if (historyData) {
            setServiceOrder(prev => ({
              ...prev!,
              maintenance_history: historyData
            }))
          }
        }

        // Get completed checklist if exists
        if (data.checklist_id) {
          const { data: checklistData } = await supabase
            .from("completed_checklists")
            .select("*")
            .eq("id", data.checklist_id)
            .single()
          
          if (checklistData) {
            setServiceOrder(prev => ({
              ...prev!,
              completed_checklist: checklistData
            }))
          }
        }
        
      } catch (error: any) {
        console.error("Error loading service order:", error.message)
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

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A"
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'a las' HH:mm", { locale: es })
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
    const statusMap: Record<string, { variant: "default" | "outline" | "secondary" | "destructive", label: string, color: string }> = {
      "pendiente": { variant: "outline", label: "Pendiente", color: "text-yellow-600" },
      "en_proceso": { variant: "secondary", label: "En Proceso", color: "text-blue-600" },
      "completado": { variant: "default", label: "Completado", color: "text-green-600" },
      "cancelado": { variant: "destructive", label: "Cancelado", color: "text-red-600" }
    }
    
    const statusInfo = statusMap[status?.toLowerCase()] || { variant: "default", label: status || "Desconocido", color: "text-gray-600" }
    
    return (
      <Badge variant={statusInfo.variant} className={statusInfo.color}>
        {statusInfo.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { variant: "default" | "outline" | "secondary" | "destructive", label: string }> = {
      "baja": { variant: "outline", label: "Baja" },
      "media": { variant: "secondary", label: "Media" },
      "alta": { variant: "default", label: "Alta" },
      "critica": { variant: "destructive", label: "Crítica" }
    }
    
    const priorityInfo = priorityMap[priority?.toLowerCase()] || { variant: "outline", label: priority || "Media" }
    
    return <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>
  }

  const handlePrint = () => {
    setShowPrintView(true)
    setTimeout(() => {
      window.print()
      setShowPrintView(false)
    }, 100)
  }

  const handleDetailedPrint = () => {
    setShowPrintReport(true)
  }

  const generateDetailedReport = () => {
    const reportContent = `
REPORTE DETALLADO DE ORDEN DE SERVICIO
======================================

INFORMACIÓN GENERAL DEL SERVICIO
--------------------------------
Orden ID:               ${serviceOrder?.order_id}
Activo:                 ${serviceOrder?.asset_name}
ID del Activo:          ${serviceOrder?.asset?.asset_id || serviceOrder?.asset_id}
Ubicación:              ${serviceOrder?.asset?.location || 'No especificada'}
Fecha de Servicio:      ${formatDate(serviceOrder?.date)}
Técnico Responsable:    ${serviceOrder?.technician}
Tipo de Mantenimiento:  ${serviceOrder?.type === 'preventive' ? 'Preventivo' : 'Correctivo'}
Estado:                 ${serviceOrder?.status}
Prioridad:              ${serviceOrder?.priority}
Duración:               ${serviceOrder?.labor_hours || 0} horas

INFORMACIÓN DEL ACTIVO
---------------------
${serviceOrder?.asset?.equipment_model?.manufacturer ? `Fabricante:           ${serviceOrder.asset.equipment_model.manufacturer}` : ''}
${serviceOrder?.asset?.equipment_model?.name ? `Modelo:               ${serviceOrder.asset.equipment_model.name}` : ''}
${serviceOrder?.asset?.serial_number ? `Número de Serie:      ${serviceOrder.asset.serial_number}` : ''}
${serviceOrder?.asset?.current_hours ? `Horas Actuales:       ${serviceOrder.asset.current_hours.toLocaleString()} hrs` : ''}
${serviceOrder?.asset?.current_kilometers ? `Kilómetros Actuales:  ${serviceOrder.asset.current_kilometers.toLocaleString()} km` : ''}

DESCRIPCIÓN DEL TRABAJO REALIZADO
=================================
${serviceOrder?.description || 'Sin descripción disponible'}

${serviceOrder?.findings ? `
HALLAZGOS DURANTE LA INSPECCIÓN
===============================
${serviceOrder.findings}
` : ''}

${serviceOrder?.actions ? `
ACCIONES CORRECTIVAS REALIZADAS
===============================
${serviceOrder.actions}
` : ''}

${serviceOrder?.notes ? `
OBSERVACIONES ADICIONALES
========================
${serviceOrder.notes}
` : ''}

REPUESTOS Y MATERIALES UTILIZADOS
=================================
${serviceOrder?.parts?.length ? 
  serviceOrder.parts.map((part: any, index: number) => {
    const partName = part.name || part.part_name || part.description || 'Repuesto sin nombre';
    const partNumber = part.part_number || part.partNumber || part.part_id || '';
    const quantity = part.quantity || 1;
    const unitCost = part.cost || part.unit_cost || part.unit_price || 0;
    const totalCost = part.total_price || part.total_cost || (quantity * unitCost);
    
    return `${index + 1}. ${partName}${partNumber ? ` (P/N: ${partNumber})` : ''}
   Cantidad: ${quantity}
   Costo Unitario: ${formatCurrency(unitCost)}
   Subtotal: ${formatCurrency(totalCost)}`;
  }).join('\n\n') : 
  'No se utilizaron repuestos en este servicio.'
}

RESUMEN DE COSTOS DEL SERVICIO
==============================
Horas de Trabajo:       ${serviceOrder?.labor_hours || 0} horas
Costo de Mano de Obra:  ${formatCurrency(serviceOrder?.labor_cost)}
Cantidad de Repuestos:  ${serviceOrder?.parts?.length || 0} items
Costo de Repuestos:     ${formatCurrency(serviceOrder?.parts_cost)}
-----------------------------------------------------
COSTO TOTAL:            ${formatCurrency(serviceOrder?.total_cost)}

CRONOLOGÍA DEL SERVICIO
=======================
Orden Creada:           ${formatDateTime(serviceOrder?.created_at)}
Servicio Ejecutado:     ${formatDateTime(serviceOrder?.date)}
${serviceOrder?.updated_at && serviceOrder.updated_at !== serviceOrder.created_at ? 
  `Última Actualización:  ${formatDateTime(serviceOrder.updated_at)}` : ''}
${serviceOrder?.work_order_id ? 
  `Orden de Trabajo:      ${serviceOrder.work_order_id}` : ''}

======================================
Este reporte fue generado automáticamente por el Sistema de Gestión de Mantenimiento
Generado el: ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
Documento confidencial - Solo para uso interno de la organización
======================================
    `.trim()

    // Create and download the report
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Reporte_Detallado_${serviceOrder?.order_id}_${format(new Date(), 'yyyyMMdd_HHmm')}.txt`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
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

  return (
    <div className={`space-y-6 ${showPrintView ? 'print-view' : ''}`}>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-view { font-size: 12px; }
          .print-view .card { border: 1px solid #ccc; margin-bottom: 1rem; }
          .print-view .text-2xl { font-size: 18px; }
          .print-view .text-lg { font-size: 14px; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
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
          <p className="text-muted-foreground mt-1">
            Servicio realizado el {formatDate(serviceOrder.date)}
          </p>
        </div>
                 <div className="flex items-center gap-2">
           <Button variant="outline" onClick={generateDetailedReport}>
             <Download className="mr-2 h-4 w-4" />
             Descargar Reporte
           </Button>
           <Button variant="outline" onClick={handleDetailedPrint}>
             <Printer className="mr-2 h-4 w-4" />
             Imprimir Reporte Detallado
           </Button>
           <Button variant="outline" onClick={handlePrint}>
             <Printer className="mr-2 h-4 w-4" />
             Imprimir Vista
           </Button>
         </div>
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Details - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Service Overview */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                                 <div>
                   <CardTitle className="flex items-center gap-2">
                     <Settings className="h-5 w-5" />
                     Información del Servicio
                   </CardTitle>
                  <CardDescription>Detalles generales de la orden de servicio</CardDescription>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(serviceOrder.status || 'unknown')}
                  {getPriorityBadge(serviceOrder.priority || 'media')}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">ID de Orden</p>
                      <p className="font-medium">{serviceOrder.order_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CalendarDays className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha de Servicio</p>
                      <p className="font-medium">{formatDate(serviceOrder.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo de Mantenimiento</p>
                      <p className="font-medium">
                        {serviceOrder.type === 'preventive' ? 'Preventivo' : 
                         serviceOrder.type === 'corrective' ? 'Correctivo' : 
                         serviceOrder.type}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Técnico Responsable</p>
                      <p className="font-medium">{serviceOrder.technician}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Duración del Trabajo</p>
                      <p className="font-medium">{serviceOrder.labor_hours || 0} horas</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                                         <Building className="h-5 w-5 text-muted-foreground" />
                     <div>
                       <p className="text-sm text-muted-foreground">Ubicación</p>
                       <p className="font-medium">{serviceOrder.asset?.location || 'No especificada'}</p>
                     </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Descripción del Trabajo Realizado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Descripción General</h4>
                <p className="text-sm border rounded-md p-3 bg-muted/30">
                  {serviceOrder.description || 'Sin descripción disponible'}
                </p>
              </div>
              
              {serviceOrder.findings && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Hallazgos Durante la Inspección</h4>
                  <p className="text-sm border rounded-md p-3 bg-blue-50">
                    {serviceOrder.findings}
                  </p>
                </div>
              )}
              
              {serviceOrder.actions && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Acciones Correctivas Realizadas</h4>
                  <p className="text-sm border rounded-md p-3 bg-green-50">
                    {serviceOrder.actions}
                  </p>
                </div>
              )}
              
              {serviceOrder.notes && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Observaciones Adicionales</h4>
                  <p className="text-sm border rounded-md p-3 bg-yellow-50">
                    {serviceOrder.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Asset Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cog className="h-5 w-5" />
                Información del Activo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre del Activo</p>
                  <p className="font-medium">{serviceOrder.asset_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID del Activo</p>
                  <p className="font-medium">{serviceOrder.asset?.asset_id || serviceOrder.asset_id}</p>
                </div>
                                 {serviceOrder.asset?.equipment_model?.manufacturer && (
                   <div>
                     <p className="text-sm text-muted-foreground">Fabricante</p>
                     <p className="font-medium">{serviceOrder.asset.equipment_model.manufacturer}</p>
                   </div>
                 )}
                 {serviceOrder.asset?.equipment_model?.name && (
                   <div>
                     <p className="text-sm text-muted-foreground">Modelo</p>
                     <p className="font-medium">{serviceOrder.asset.equipment_model.name}</p>
                   </div>
                 )}
                {serviceOrder.asset?.serial_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Número de Serie</p>
                    <p className="font-medium">{serviceOrder.asset.serial_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Ubicación</p>
                  <p className="font-medium">{serviceOrder.asset?.location || 'No especificada'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Sidebar - 1/3 width */}
        <div className="space-y-6">
          
          {/* Cost Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Resumen de Costos
              </CardTitle>
              <CardDescription>Desglose detallado de gastos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mano de Obra</span>
                  <span className="font-medium">{formatCurrency(serviceOrder.labor_cost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Repuestos</span>
                  <span className="font-medium">{formatCurrency(serviceOrder.parts_cost)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total del Servicio</span>
                  <span className="font-bold text-lg">{formatCurrency(serviceOrder.total_cost)}</span>
                </div>
                {serviceOrder.labor_hours && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Horas Trabajadas</span>
                      <span className="font-medium">{serviceOrder.labor_hours}h</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Enlaces Relacionados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/activos/${serviceOrder.asset_id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Activo
                </Link>
              </Button>
              {serviceOrder.work_order_id && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/ordenes/${serviceOrder.work_order_id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Ver Orden de Trabajo
                  </Link>
                </Button>
              )}
              {serviceOrder.checklist_id && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/checklists/ejecutar/${serviceOrder.checklist_id}`}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Ver Checklist
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Cronología</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                    <CheckSquare className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Servicio Completado</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(serviceOrder.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Orden Creada</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(serviceOrder.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="parts" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="parts">Repuestos Utilizados</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="parts" className="space-y-4 no-print">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Repuestos y Materiales Utilizados
              </CardTitle>
              <CardDescription>
                Detalle de todos los repuestos utilizados durante el servicio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {serviceOrder.parts && serviceOrder.parts.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre del Repuesto</TableHead>
                        <TableHead>Número de Parte</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unitario</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceOrder.parts.map((part: any, index: number) => {
                        // Handle different possible property names for the same data
                        const partName = part.name || part.part_name || part.description || 'Repuesto sin nombre';
                        const partNumber = part.part_number || part.partNumber || part.part_id || 'N/A';
                        const quantity = part.quantity || 1;
                        const unitCost = part.cost || part.unit_cost || part.unit_price || 0;
                        const totalCost = part.total_price || part.total_cost || (quantity * unitCost);
                        
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{partName}</TableCell>
                            <TableCell className="text-muted-foreground">{partNumber}</TableCell>
                            <TableCell className="text-center">{quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(unitCost)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(totalCost)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <tfoot>
                      <tr className="bg-muted/50">
                        <td colSpan={4} className="px-4 py-3 text-sm font-medium text-right">
                          Total en Repuestos
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-right">
                          {formatCurrency(serviceOrder.parts_cost)}
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No se utilizaron repuestos</p>
                  <p className="text-sm text-muted-foreground">
                    Este servicio no requirió el uso de repuestos o materiales adicionales.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="checklist">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Checklist de Mantenimiento
              </CardTitle>
              <CardDescription>
                Puntos de verificación completados durante el servicio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {serviceOrder.completed_checklist ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Fecha de Completado:</span>
                      <p className="font-medium">{formatDate(serviceOrder.completed_checklist.completion_date)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estado:</span>
                      <p className="font-medium">{serviceOrder.completed_checklist.status}</p>
                    </div>
                  </div>
                  {serviceOrder.completed_checklist.notes && (
                    <div>
                      <span className="text-muted-foreground text-sm">Notas del Checklist:</span>
                      <p className="mt-1 text-sm border rounded-md p-3 bg-muted/30">
                        {serviceOrder.completed_checklist.notes}
                      </p>
                    </div>
                  )}
                  <Button variant="outline" asChild>
                    <Link href={`/checklists/ejecutar/${serviceOrder.checklist_id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Checklist Completo
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No hay checklist asociado</p>
                  <p className="text-sm text-muted-foreground">
                    Este servicio no incluyó un checklist de verificación.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historial de Mantenimiento
              </CardTitle>
              <CardDescription>
                Registros relacionados con este servicio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {serviceOrder.maintenance_history && serviceOrder.maintenance_history.length > 0 ? (
                <div className="space-y-4">
                  {serviceOrder.maintenance_history.map((record: any, index: number) => (
                    <div key={index} className="border rounded-md p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{record.type}</h4>
                        <span className="text-sm text-muted-foreground">{formatDate(record.date)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{record.description}</p>
                      {record.findings && (
                        <p className="text-sm"><strong>Hallazgos:</strong> {record.findings}</p>
                      )}
                      {record.actions && (
                        <p className="text-sm"><strong>Acciones:</strong> {record.actions}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">Sin historial adicional</p>
                  <p className="text-sm text-muted-foreground">
                    No hay registros adicionales en el historial de mantenimiento.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5" />
                Documentos y Fotografías
              </CardTitle>
              <CardDescription>
                Archivos adjuntos relacionados con el servicio
              </CardDescription>
            </CardHeader>
            <CardContent>
              {serviceOrder.documents && serviceOrder.documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {serviceOrder.documents.map((doc: string, index: number) => (
                    <div key={index} className="border rounded-md p-4">
                      <div className="flex items-center gap-3">
                        <Camera className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Documento {index + 1}</p>
                          <p className="text-xs text-muted-foreground">Archivo adjunto</p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href={doc} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileImage className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No hay documentos</p>
                  <p className="text-sm text-muted-foreground">
                    No se adjuntaron documentos o fotografías a este servicio.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
                 </TabsContent>
       </Tabs>

       {/* Print Report Modal */}
       {showPrintReport && serviceOrder && (
         <div className="fixed inset-0 z-50 bg-white">
           <ServiceOrderPrintReport
             serviceOrder={serviceOrder}
             onClose={() => setShowPrintReport(false)}
           />
         </div>
       )}
     </div>
   )
} 