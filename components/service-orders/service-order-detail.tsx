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
    window.print()
  }

  const handleDetailedPrint = () => {
    // Crear una nueva ventana para el reporte
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    
    if (!printWindow) {
      alert('Por favor permita las ventanas emergentes para imprimir el reporte')
      return
    }

    // Generar el HTML del reporte
    const reportHTML = generatePrintReportHTML()
    
    printWindow.document.write(reportHTML)
    printWindow.document.close()
    
    // Esperar a que se cargue y luego imprimir
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 500)
    }
  }

  const generatePrintReportHTML = () => {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Servicio - ${serviceOrder?.order_id}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.3;
            color: #333;
            background: white;
            margin: 0;
            padding: 0;
        }
        
        .container {
            max-width: 100%;
            margin: 0;
            padding: 15mm;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .logo {
            width: 60px;
            height: 60px;
            background: #f0f0f0;
            border: 1px solid #ccc;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #666;
        }
        
        .title {
            flex: 1;
            margin: 0 20px;
        }
        
        .title h1 {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .title p {
            font-size: 14px;
            color: #666;
        }
        
        .order-number {
            text-align: right;
        }
        
        .order-number p:first-child {
            font-size: 10px;
            color: #666;
        }
        
        .order-number p:last-child {
            font-size: 16px;
            font-weight: bold;
        }
        
        .summary {
            background: #e3f2fd;
            padding: 15px;
            margin-bottom: 25px;
            border-left: 4px solid #2196f3;
            border-radius: 4px;
        }
        
        .summary h3 {
            font-size: 16px;
            margin-bottom: 10px;
        }
        
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .section {
            margin-bottom: 25px;
        }
        
        .section h3 {
            font-size: 16px;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 12px;
        }
        
        .info-row .label {
            font-weight: bold;
        }
        
        .work-details {
            margin-bottom: 25px;
        }
        
        .work-box {
            border: 1px solid #ddd;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 4px;
        }
        
        .work-box.description {
            background: #f9f9f9;
        }
        
        .work-box.findings {
            background: #e8f4f8;
        }
        
        .work-box.actions {
            background: #e8f8e8;
        }
        
        .work-box h4 {
            font-size: 12px;
            margin-bottom: 5px;
            color: #666;
        }
        
        .parts-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        
        .parts-table th,
        .parts-table td {
            border: 1px solid #333;
            padding: 8px;
            text-align: left;
            font-size: 11px;
        }
        
        .parts-table th {
            background: #f0f0f0;
            font-weight: bold;
            text-align: center;
        }
        
        .parts-table .text-center {
            text-align: center;
        }
        
        .parts-table .text-right {
            text-align: right;
        }
        
        .cost-summary {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        
        .certification {
            background: #e8f5e8;
            padding: 15px;
            margin: 25px 0;
            border-left: 4px solid #4caf50;
            border-radius: 4px;
        }
        
        .validation-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #333;
        }
        
        .validation-box {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            background: #f9f9f9;
        }
        
        .validation-box h4 {
            font-size: 14px;
            margin-bottom: 10px;
            color: #333;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }
        
        .validation-info p {
            margin-bottom: 8px;
            font-size: 12px;
            color: #333;
        }
        
        .timeline-section {
            margin: 25px 0;
        }
        
        .timeline-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
        }
        
        .timeline-item {
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 15px;
            background: #fafafa;
        }
        
        .timeline-icon {
            font-size: 24px;
            text-align: center;
            margin-bottom: 10px;
        }
        
        .timeline-content h4 {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #333;
        }
        
        .timeline-content p {
            font-size: 11px;
            margin-bottom: 4px;
            color: #666;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #333;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
        }
        
        .footer-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            font-size: 10px;
            color: #666;
        }
        
        .footer h4 {
            font-size: 11px;
            margin-bottom: 5px;
            color: #333;
        }
        
        .footer-note {
            text-align: center;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            font-size: 9px;
            font-style: italic;
            color: #666;
        }
        
        @media print {
            @page {
                margin: 15mm;
                size: A4;
            }
            
            body { 
                margin: 0 !important;
                padding: 0 !important;
                font-size: 12px !important;
            }
            
            .container { 
                padding: 0 !important;
                margin: 0 !important;
                max-width: 100% !important;
            }
            
            .header {
                margin-bottom: 20px !important;
            }
            
            .section {
                margin-bottom: 15px !important;
                page-break-inside: avoid;
            }
            
            .parts-table {
                page-break-inside: avoid;
            }
            
            .grid {
                margin-bottom: 15px !important;
            }
            
            h1 {
                font-size: 18px !important;
            }
            
            h3 {
                font-size: 14px !important;
                margin-bottom: 8px !important;
            }
            
            .info-row {
                font-size: 11px !important;
                margin-bottom: 6px !important;
            }
            
            .timeline-grid {
                display: grid !important;
                grid-template-columns: 1fr 1fr 1fr !important;
                gap: 10px !important;
                margin-bottom: 15px !important;
            }
            
            .timeline-item {
                page-break-inside: avoid;
                margin-bottom: 8px !important;
            }
            
            .timeline-content p {
                font-size: 10px !important;
            }
            
            .validation-section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-content">
                <div class="logo">LOGO</div>
                <div class="title">
                    <h1>REPORTE DE SERVICIO DE MANTENIMIENTO</h1>
                    <p>Sistema de Gestión de Mantenimiento Industrial</p>
                </div>
                <div class="order-number">
                    <p>Orden:</p>
                    <p>${serviceOrder?.order_id}</p>
                </div>
            </div>
            <div style="background: #f0f0f0; padding: 8px; border-radius: 4px;">
                <p style="font-size: 12px; color: #666;">
                    Documento generado el ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                </p>
            </div>
        </div>

        <!-- Resumen Ejecutivo -->
        <div class="summary">
            <h3>Resumen Ejecutivo del Servicio</h3>
            <div class="grid">
                <div>
                    <p><strong>Tipo de Intervención:</strong> ${serviceOrder?.type === 'preventive' ? 'Mantenimiento Preventivo Programado' : 'Mantenimiento Correctivo de Emergencia'}</p>
                    <p><strong>Activo Intervenido:</strong> ${serviceOrder?.asset_name} (${serviceOrder?.asset?.asset_id})</p>
                    <p><strong>Ubicación:</strong> ${(serviceOrder?.asset as any)?.plants?.name || serviceOrder?.asset?.location || 'Sin planta'}</p>
                </div>
                <div>
                    <p><strong>Duración Total:</strong> ${serviceOrder?.labor_hours || 0} horas de trabajo</p>
                    <p><strong>Inversión Total:</strong> ${formatCurrency(serviceOrder?.total_cost)}</p>
                    <p><strong>Estado Final:</strong> <span style="color: #4caf50; font-weight: bold;">SERVICIO COMPLETADO</span></p>
                </div>
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #bbb;">
                <p style="font-style: italic;">${serviceOrder?.description}</p>
            </div>
        </div>

        <!-- Información General -->
        <div class="grid">
            <div class="section">
                <h3>Información General del Servicio</h3>
                <div class="info-row">
                    <span class="label">Orden ID:</span>
                    <span>${serviceOrder?.order_id}</span>
                </div>
                <div class="info-row">
                    <span class="label">Fecha de Servicio:</span>
                    <span>${formatDate(serviceOrder?.date)}</span>
                </div>
                <div class="info-row">
                    <span class="label">Tipo de Mantenimiento:</span>
                    <span>${serviceOrder?.type === 'preventive' ? 'Mantenimiento Preventivo' : serviceOrder?.type === 'corrective' ? 'Mantenimiento Correctivo' : serviceOrder?.type}</span>
                </div>
                <div class="info-row">
                    <span class="label">Estado:</span>
                    <span>${serviceOrder?.status || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Prioridad:</span>
                    <span>${serviceOrder?.priority || 'Media'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Técnico Responsable:</span>
                    <span style="color: #2196f3; font-weight: bold;">${serviceOrder?.technician}</span>
                </div>
                <div class="info-row">
                    <span class="label">Duración del Trabajo:</span>
                    <span>${serviceOrder?.labor_hours || 0} horas</span>
                </div>
            </div>

            <div class="section">
                <h3>Información del Activo</h3>
                <div class="info-row">
                    <span class="label">Nombre del Activo:</span>
                    <span>${serviceOrder?.asset_name}</span>
                </div>
                <div class="info-row">
                    <span class="label">ID del Activo:</span>
                    <span>${serviceOrder?.asset?.asset_id || serviceOrder?.asset_id}</span>
                </div>
                ${serviceOrder?.asset?.equipment_model?.manufacturer ? `
                <div class="info-row">
                    <span class="label">Fabricante:</span>
                    <span>${serviceOrder.asset.equipment_model.manufacturer}</span>
                </div>
                ` : ''}
                ${serviceOrder?.asset?.equipment_model?.name ? `
                <div class="info-row">
                    <span class="label">Modelo:</span>
                    <span>${serviceOrder.asset.equipment_model.name}</span>
                </div>
                ` : ''}
                <div class="info-row">
                    <span class="label">Ubicación:</span>
                    <span>${(serviceOrder?.asset as any)?.plants?.name || serviceOrder?.asset?.location || 'Sin planta'}</span>
                </div>
                ${serviceOrder?.asset?.serial_number ? `
                <div class="info-row">
                    <span class="label">Número de Serie:</span>
                    <span>${serviceOrder.asset.serial_number}</span>
                </div>
                ` : ''}
            </div>
        </div>

        <!-- Detalles del Trabajo -->
        <div class="work-details">
            <h3>Detalles del Trabajo Realizado</h3>
            
            <div class="work-box description">
                <h4>Descripción del Trabajo:</h4>
                <p>${serviceOrder?.description || 'Sin descripción disponible'}</p>
            </div>

            ${serviceOrder?.findings ? `
            <div class="work-box findings">
                <h4>Hallazgos Durante la Inspección:</h4>
                <p>${serviceOrder.findings}</p>
            </div>
            ` : ''}

            ${serviceOrder?.actions ? `
            <div class="work-box actions">
                <h4>Acciones Correctivas Realizadas:</h4>
                <p>${serviceOrder.actions}</p>
            </div>
            ` : ''}
        </div>

        <!-- Repuestos -->
        ${serviceOrder?.parts && serviceOrder.parts.length > 0 ? `
        <div class="section">
            <h3>Repuestos y Materiales Utilizados</h3>
            <table class="parts-table">
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th>Cantidad</th>
                        <th>Costo Unitario</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${serviceOrder.parts.map((part: any) => {
                        const partName = part.name || part.part_name || part.description || 'Repuesto sin nombre';
                        const partNumber = part.part_number || part.partNumber || part.part_id || '';
                        const quantity = part.quantity || 1;
                        const unitCost = part.cost || part.unit_cost || part.unit_price || 0;
                        const totalCost = part.total_price || part.total_cost || (quantity * unitCost);
                        
                        return `
                        <tr>
                            <td>
                                <strong>${partName}</strong>
                                ${partNumber ? `<br><small style="color: #666;">P/N: ${partNumber}</small>` : ''}
                            </td>
                            <td class="text-center">${quantity}</td>
                            <td class="text-right">${formatCurrency(unitCost)}</td>
                            <td class="text-right"><strong>${formatCurrency(totalCost)}</strong></td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: #f0f0f0; border-top: 2px solid #333;">
                        <td colspan="3" style="text-align: right; font-weight: bold;">Total Repuestos:</td>
                        <td style="text-align: right; font-weight: bold;">${formatCurrency(serviceOrder.parts_cost)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
        ` : ''}

        <!-- Resumen de Costos -->
        <div class="cost-summary">
            <h3 style="margin-bottom: 15px;">Resumen de Costos del Servicio</h3>
            <div class="grid" style="margin-bottom: 15px;">
                <div>
                    <div class="info-row">
                        <span>Horas de Trabajo:</span>
                        <span><strong>${serviceOrder?.labor_hours || 0} horas</strong></span>
                    </div>
                    <div class="info-row">
                        <span>Costo de Mano de Obra:</span>
                        <span><strong>${formatCurrency(serviceOrder?.labor_cost)}</strong></span>
                    </div>
                </div>
                <div>
                    <div class="info-row">
                        <span>Cantidad de Repuestos:</span>
                        <span><strong>${serviceOrder?.parts?.length || 0} items</strong></span>
                    </div>
                    <div class="info-row">
                        <span>Costo de Repuestos:</span>
                        <span><strong>${formatCurrency(serviceOrder?.parts_cost)}</strong></span>
                    </div>
                </div>
            </div>
            <div style="border-top: 1px solid #333; padding-top: 15px;">
                <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold;">
                    <span>COSTO TOTAL DEL SERVICIO:</span>
                    <span>${formatCurrency(serviceOrder?.total_cost)}</span>
                </div>
            </div>
        </div>

        <!-- Cronología Detallada -->
        <div class="timeline-section">
            <h3 style="margin-bottom: 15px;">Cronología del Servicio</h3>
            <div class="timeline-grid">
                <div class="timeline-item">
                    <div class="timeline-icon">📅</div>
                    <div class="timeline-content">
                        <h4>Orden de Servicio Creada</h4>
                        <p><strong>Fecha:</strong> ${formatDateTime(serviceOrder?.created_at)}</p>
                        <p><strong>Estado inicial:</strong> Programado</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-icon">🔧</div>
                    <div class="timeline-content">
                        <h4>Servicio Ejecutado</h4>
                        <p><strong>Fecha:</strong> ${formatDateTime(serviceOrder?.date)}</p>
                        <p><strong>Técnico:</strong> ${serviceOrder?.technician}</p>
                        <p><strong>Duración:</strong> ${serviceOrder?.labor_hours || 0} horas</p>
                    </div>
                </div>
                <div class="timeline-item">
                    <div class="timeline-icon">✅</div>
                    <div class="timeline-content">
                        <h4>Servicio Completado</h4>
                        <p><strong>Estado final:</strong> <span style="color: #4caf50; font-weight: bold;">COMPLETADO</span></p>
                        <p><strong>Documento generado:</strong> ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm")}</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Certificación Digital -->
        <div class="certification">
            <h3 style="margin-bottom: 15px;">Certificación Digital del Servicio</h3>
            <div class="grid">
                <div>
                    <p style="margin-bottom: 10px;"><strong>✓ Trabajo Completado:</strong> El servicio fue ejecutado y registrado en el sistema.</p>
                    <p><strong>✓ Documentación Completa:</strong> Toda la información ha sido capturada digitalmente.</p>
                </div>
                <div>
                    <p style="margin-bottom: 10px;"><strong>✓ Trazabilidad Completa:</strong> El registro permite seguimiento completo de la intervención.</p>
                    <p><strong>✓ Evidencia Digital:</strong> Este documento sirve como evidencia oficial del servicio.</p>
                </div>
            </div>
        </div>

        <!-- Validación del Servicio -->
        <div class="validation-section">
            <h3 style="margin-bottom: 15px;">Validación del Servicio Completado</h3>
            <div class="grid">
                <div class="validation-box">
                    <h4>Técnico Responsable</h4>
                    <div class="validation-info">
                        <p><strong>Nombre:</strong> ${serviceOrder?.technician}</p>
                        <p><strong>Fecha de Ejecución:</strong> ${formatDate(serviceOrder?.date)}</p>
                        <p><strong>Hora de Finalización:</strong> ${formatDateTime(serviceOrder?.date)}</p>
                        <p><strong>Estado:</strong> <span style="color: #4caf50; font-weight: bold;">SERVICIO COMPLETADO</span></p>
                    </div>
                </div>
                <div class="validation-box">
                    <h4>Detalles de la Intervención</h4>
                    <div class="validation-info">
                        <p><strong>Duración Total:</strong> ${serviceOrder?.labor_hours || 0} horas</p>
                        <p><strong>Tipo de Mantenimiento:</strong> ${serviceOrder?.type === 'preventive' ? 'Preventivo' : 'Correctivo'}</p>
                        <p><strong>Prioridad:</strong> ${serviceOrder?.priority || 'Media'}</p>
                        <p><strong>Costo Total:</strong> ${formatCurrency(serviceOrder?.total_cost)}</p>
                    </div>
                </div>
            </div>
            <div style="background: #f0f8ff; padding: 15px; margin-top: 15px; border-radius: 4px; border-left: 4px solid #2196f3;">
                <p style="margin: 0; font-size: 12px; text-align: center;">
                    <strong>Registro Digital de Servicio:</strong> Este documento constituye evidencia digital del servicio de mantenimiento ejecutado.
                    Generado automáticamente por el sistema el ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-grid">
                <div>
                    <h4>Información del Documento</h4>
                    <p>Orden de Servicio: <strong>${serviceOrder?.order_id}</strong></p>
                    <p>Generado: ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm")}</p>
                    <p>Versión: 1.0</p>
                </div>
                <div>
                    <h4>Sistema de Gestión</h4>
                    <p>Plataforma: Sistema de Mantenimiento Industrial</p>
                    <p>Módulo: Órdenes de Servicio</p>
                    <p>Estado: Documento Oficial</p>
                </div>
                <div>
                    <h4>Confidencialidad</h4>
                    <p>Clasificación: Uso Interno</p>
                    <p>Distribución: Autorizada</p>
                    <p>Archivo: Departamento de Mantenimiento</p>
                </div>
            </div>
            <div class="footer-note">
                <strong>DOCUMENTO OFICIAL DE EVIDENCIA:</strong> Este reporte constituye evidencia digital oficial del servicio de mantenimiento ejecutado. 
                La información contenida ha sido registrada automáticamente por el sistema y puede ser utilizada para auditorías, 
                seguimiento de mantenimiento, análisis de costos y como respaldo legal de los trabajos realizados.
            </div>
        </div>
    </div>
</body>
</html>
    `
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
Ubicación:              ${(serviceOrder?.asset as any)?.plants?.name || serviceOrder?.asset?.location || 'Sin planta'}
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
    <div className="space-y-6">
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
                       <p className="font-medium">{(serviceOrder?.asset as any)?.plants?.name || serviceOrder?.asset?.location || 'Sin planta'}</p>
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
                  <p className="font-medium">{(serviceOrder?.asset as any)?.plants?.name || serviceOrder?.asset?.location || 'Sin planta'}</p>
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


     </div>
   )
} 