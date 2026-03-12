"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { X, Printer, FileDown } from "lucide-react"
import { useState, useEffect } from "react"
import jsPDF from "jspdf"
import { snapdom } from "@zumer/snapdom"

// DC Concretos brand colors (policy_template.js scheme)
const NAVY = "#1B365D"
const GREEN = "#00A64F"

/** Compute Asset Health Score (0-100). Heuristic: 100 - (active_incidents*15) - (overdue_maintenance*10), clamped. */
function computeHealthScore(activeIncidents: number, overdueMaintenance: number): number {
  const raw = Math.round(100 - activeIncidents * 15 - overdueMaintenance * 10)
  return Math.max(0, Math.min(100, raw))
}

/** Banded health: Alto (80+), Medio (50-79), Bajo (<50). */
function getHealthBand(score: number): { band: string; color: string } {
  if (score >= 80) return { band: "Alto", color: "text-gray-800" }
  if (score >= 50) return { band: "Medio", color: "text-gray-700" }
  return { band: "Bajo", color: "text-gray-700" }
}

interface AssetProductionReportProps {
  assetId: string
  onClose: () => void
}

export function AssetProductionReport({ assetId, onClose }: AssetProductionReportProps) {
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const response = await fetch(`/api/assets/${assetId}/production-report`)
        if (!response.ok) {
          throw new Error('Error fetching report data')
        }
        const data = await response.json()
        setReportData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [assetId])

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

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (!amount) return "$0.00"
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(numAmount)
  }

  const formatParts = (parts: any) => {
    if (!parts) return <span className="text-gray-500">No especificados</span>
    
    try {
      // Si ya es un objeto, úsalo directamente
      const partsData = typeof parts === 'string' ? JSON.parse(parts) : parts
      
      // Si es un array de repuestos
      if (Array.isArray(partsData)) {
        return (
          <div className="space-y-1">
            {partsData.slice(0, 5).map((part: any, index: number) => (
              <div key={index} className="text-xs bg-gray-50 p-2 rounded border-l-2 border-gray-300">
                <div className="font-medium text-gray-800">{part.name || part.part_name || 'Repuesto sin nombre'}</div>
                <div className="flex flex-wrap gap-2 text-gray-600 text-xs mt-1">
                  {part.partNumber && <span className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">P/N: {part.partNumber}</span>}
                  <span className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">Cant: {part.quantity || 1}</span>
                  {part.unit_price && <span className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">Precio: {formatCurrency(part.unit_price)}</span>}
                  {part.total_price && <span className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">Total: {formatCurrency(part.total_price)}</span>}
                </div>
              </div>
            ))}
            {partsData.length > 5 && (
              <div className="text-xs text-gray-500 italic">
                ... y {partsData.length - 5} repuestos más
              </div>
            )}
          </div>
        )
      }
      
      // Si es un objeto con propiedades de repuestos
      if (typeof partsData === 'object') {
        return (
          <div className="text-xs bg-gray-50 p-2 rounded border">
            {Object.entries(partsData).map(([key, value]: [string, any]) => (
              <div key={key} className="mb-1 flex justify-between">
                <strong className="text-gray-700">{key}:</strong> 
                <span className="text-gray-600">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
              </div>
            ))}
          </div>
        )
      }
      
      return <span className="text-gray-600">{String(partsData)}</span>
    } catch (error) {
      // Si hay error parseando, mostrar como string
      return <span className="text-gray-500 italic">Error al parsear: {String(parts).substring(0, 100)}...</span>
    }
  }

  // Function to determine if maintenance is preventive or corrective
  const getMaintenanceType = (maintenance: any) => {
    const type = maintenance.type?.toLowerCase()
    
    // A maintenance is preventive if:
    // 1. Has explicit preventive type
    // 2. Is associated with a maintenance plan (maintenance_plan_id)
    const isPreventive = type === 'preventive' || type === 'preventivo' || maintenance.maintenance_plan_id
    
    return {
      isPreventive,
      displayText: isPreventive ? 'Preventivo' : 'Correctivo',
      colorClass: 'text-gray-700'
    }
  }

  const handlePrint = () => {
    // Hide all navigation elements before printing
    const navigationElements = document.querySelectorAll('nav, header, .sidebar, .navigation, .nav, .header, [role="navigation"], [role="banner"], .navbar, .menu, .breadcrumb, .breadcrumbs')
    const originalDisplay: string[] = []
    
    navigationElements.forEach((el, index) => {
      const element = el as HTMLElement
      originalDisplay[index] = element.style.display
      element.style.display = 'none'
    })
    
    // Trigger print
    window.print()
    
    // Restore navigation elements after printing
    setTimeout(() => {
      navigationElements.forEach((el, index) => {
        const element = el as HTMLElement
        element.style.display = originalDisplay[index] || ''
      })
    }, 100)
  }

  const handleDownloadPDF = async () => {
    const element = document.querySelector(".print-container") as HTMLElement
    const noPrint = document.querySelector(".no-print") as HTMLElement
    if (!element) return
    try {
      noPrint?.style.setProperty("display", "none")
      element.classList.add("pdf-export-mode")
      element.scrollIntoView({ behavior: "instant" })
      await new Promise((r) => setTimeout(r, 150))

      const result = await snapdom(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        embedFonts: true,
        exclude: [".no-print"],
        width: element.scrollWidth,
        height: element.scrollHeight,
      })
      const canvas = await result.toCanvas()
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      const margin = 5
      const contentW = pdfW - margin * 2
      const pageH = pdfH - margin * 2
      const ratio = contentW / canvas.width
      const imgH = canvas.height * ratio
      const totalPages = Math.max(1, Math.ceil(imgH / pageH))
      let position = margin
      pdf.addImage(imgData, "PNG", margin, position, contentW, imgH, undefined, "FAST")
      for (let i = 1; i < totalPages; i++) {
        position -= pageH
        pdf.addPage()
        pdf.addImage(imgData, "PNG", margin, position, contentW, imgH, undefined, "FAST")
      }
      pdf.save(`reporte-produccion-${asset?.asset_id || assetId}-${format(new Date(), "yyyy-MM-dd")}.pdf`)
    } catch (err) {
      console.error("Error generating PDF:", err)
      handlePrint()
    } finally {
      noPrint?.style.removeProperty("display")
      element.classList.remove("pdf-export-mode")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generando reporte...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return null
  }

  const { asset, summary, completedChecklists, incidents, maintenanceHistory, workOrders, maintenancePlans, maintenanceIntervals, intervalAnalysis } = reportData

  // Key metrics for executive summary
  const isResolved = (s: string) => (s || "").toLowerCase() === "resuelto" || (s || "").toLowerCase() === "resolved"
  const activeIncidentsCount = (incidents || []).filter((i: any) => !isResolved(i.status)).length
  const overdueMaintenanceCount = (intervalAnalysis || []).filter((i: any) => i.analysis?.status === "overdue").length
  const totalMaintenance = summary.preventiveMaintenanceCount + summary.correctiveMaintenanceCount || 1
  const preventivePct = Math.round((summary.preventiveMaintenanceCount / totalMaintenance) * 100)
  const correctivePct = Math.round((summary.correctiveMaintenanceCount / totalMaintenance) * 100)
  const healthScore = computeHealthScore(activeIncidentsCount, overdueMaintenanceCount)
  const healthBand = getHealthBand(healthScore)

  // Auto-generated executive summary (Problema → Impacto → Solución → Decisión), 250-400 words
  const execSummaryParts: string[] = []
  const mainNumber = healthScore
  execSummaryParts.push(`Estado de salud del activo: ${mainNumber}/100 (${healthBand.band}).`)
  if (activeIncidentsCount > 0) {
    execSummaryParts.push(`Problema: Hay ${activeIncidentsCount} incidente(s) activo(s) sin resolver que requieren atención.`)
  }
  if (overdueMaintenanceCount > 0) {
    execSummaryParts.push(`Problema: ${overdueMaintenanceCount} intervalo(s) de mantenimiento preventivo vencido(s), incrementando riesgo de fallas.`)
  }
  if (activeIncidentsCount === 0 && overdueMaintenanceCount === 0) {
    execSummaryParts.push(`Problema: Ningún incidente abierto ni intervalos vencidos en este momento.`)
  }
  execSummaryParts.push(`Impacto: Disponibilidad ${summary.availability}%; ${summary.totalDowntime} horas de inactividad acumuladas. Mantenimiento: ${preventivePct}% preventivo vs ${correctivePct}% correctivo.`)
  if (correctivePct > 60) {
    execSummaryParts.push(`Solución: El alto ratio correctivo sugiere fortalecer el programa preventivo para reducir fallas reactivas.`)
  } else {
    execSummaryParts.push(`Solución: El balance preventivo/correctivo se encuentra dentro de rangos aceptables.`)
  }
  if (overdueMaintenanceCount > 0) {
    execSummaryParts.push(`Decisión: Priorizar la ejecución de los ${overdueMaintenanceCount} intervalo(s) vencido(s) para minimizar riesgo.`)
  }
  if (activeIncidentsCount > 0) {
    execSummaryParts.push(`Decisión: Atender los ${activeIncidentsCount} incidente(s) abierto(s) para restaurar operación completa.`)
  }
  if (activeIncidentsCount === 0 && overdueMaintenanceCount === 0) {
    execSummaryParts.push(`Decisión: Mantener el ritmo de mantenimiento preventivo y monitoreo continuo.`)
  }
  const executiveSummaryText = execSummaryParts.join(" ")

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'bg-gray-200 text-gray-800 border-gray-300 font-medium'
      case 'upcoming':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'covered':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'scheduled':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'completed':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'VENCIDO'
      case 'upcoming':
        return 'PRÓXIMO'
      case 'covered':
        return 'CUBIERTO'
      case 'scheduled':
        return 'PROGRAMADO'
      case 'completed':
        return 'COMPLETADO'
      default:
        return 'PENDIENTE'
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Print Controls - Hidden when printing */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 bg-white p-2 rounded shadow-lg">
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
        <Button onClick={handleDownloadPDF} className="bg-green-600 hover:bg-green-700">
          <FileDown className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Cerrar
        </Button>
      </div>

      {/* Print Content - DC Concretos format (policy_template.js scheme) */}
      <div className="print-container report-content max-w-4xl mx-auto p-8">
        
        {/* DC Concretos Header */}
        <div className="dc-header flex items-stretch mb-6" style={{ borderBottom: `3px solid ${GREEN}` }}>
          <div className="w-32 flex-shrink-0 flex items-center p-2">
            <img src="/logo.png" alt="DC Concretos" className="max-h-14 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-logo.png" }} />
          </div>
          <div className="flex-1 flex flex-col justify-center text-right px-4 py-3" style={{ backgroundColor: NAVY }}>
            <p className="text-white font-bold text-sm uppercase tracking-wide">DC CONCRETOS, S.A. DE C.V.</p>
            <p className="text-white/90 text-xs mt-0.5">REP-PROD-001 | Activo: {asset.asset_id}</p>
            <p className="text-lg font-bold mt-1" style={{ color: GREEN }}>REPORTE DE PRODUCCIÓN DE ACTIVO</p>
          </div>
        </div>
        
        {/* Document title and version */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>Reporte de Producción</h1>
          <p className="text-sm" style={{ color: GREEN }}>Historial de Mantenimiento y Operación · {asset.name} · Generado el {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}</p>
        </div>

        {/* Resumen Ejecutivo (Problema → Impacto → Solución → Decisión) - DC Concretos secHdr style */}
        <div className="mb-8 executive-summary p-6 rounded bg-gray-50 border-l-4 border-gray-400">
          <div className="py-2 px-4 mb-4 rounded" style={{ backgroundColor: NAVY }}>
            <h2 className="text-lg font-bold text-white">Resumen Ejecutivo</h2>
          </div>
          {/* Compact metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 metrics-row">
            <div className="bg-white rounded p-3 border text-center">
              <p className="text-2xl font-bold text-gray-900">{healthScore}</p>
              <p className="text-xs text-gray-600">Salud del Activo (0-100)</p>
              <p className={`text-sm font-medium ${healthBand.color}`}>{healthBand.band}</p>
            </div>
            <div className="bg-white rounded p-3 border text-center">
              <p className="text-2xl font-bold text-gray-900">{activeIncidentsCount}</p>
              <p className="text-xs text-gray-600">Incidentes Activos</p>
            </div>
            <div className="bg-white rounded p-3 border text-center">
              <p className="text-lg font-bold text-gray-800">{preventivePct}%</p>
              <p className="text-xs text-gray-600">Preventivo</p>
            </div>
            <div className="bg-white rounded p-3 border text-center">
              <p className="text-lg font-bold text-gray-800">{correctivePct}%</p>
              <p className="text-xs text-gray-600">Correctivo</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed max-w-3xl">{executiveSummaryText}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-1"><strong>Activo:</strong> {asset.name} ({asset.asset_id})</p>
              <p className="mb-1"><strong>Planta:</strong> {(asset as any).plants?.name || asset.location || "N/A"}</p>
              <p><strong>Inversión Total:</strong> {formatCurrency(summary.totalCost)}</p>
            </div>
            <div>
              <p className="mb-1"><strong>Disponibilidad:</strong> {summary.availability}%</p>
              <p className="mb-1"><strong>Tiempo Fuera:</strong> {summary.totalDowntime} hrs</p>
              <p><strong>Garantía:</strong> {summary.warrantyStatus}</p>
            </div>
          </div>
        </div>

        {/* Asset Information Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <div className="py-2 px-3 mb-4 rounded" style={{ backgroundColor: NAVY }}>
              <h3 className="text-base font-bold text-white">Información Técnica del Activo</h3>
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr><td className="font-medium py-1 pr-4 align-top">ID de Activo:</td><td className="py-1 align-top">{asset.asset_id}</td></tr>
                <tr><td className="font-medium py-1 pr-4 align-top">Número de Serie:</td><td className="py-1 align-top">{asset.serial_number || 'N/A'}</td></tr>
                {asset.equipment_models && (
                  <>
                    <tr><td className="font-medium py-1 pr-4 align-top">Fabricante:</td><td className="py-1 align-top">{asset.equipment_models.manufacturer || 'N/A'}</td></tr>
                    <tr><td className="font-medium py-1 pr-4 align-top">Modelo:</td><td className="py-1 align-top">{asset.equipment_models.name || 'N/A'}</td></tr>
                    <tr><td className="font-medium py-1 pr-4 align-top">Número de Modelo:</td><td className="py-1 align-top">{asset.equipment_models.model_id || 'N/A'}</td></tr>
                  </>
                )}
                <tr><td className="font-medium py-1 pr-4 align-top">Fecha de Compra:</td><td className="py-1 align-top">{formatDate(asset.purchase_date)}</td></tr>
                <tr><td className="font-medium py-1 pr-4 align-top">Fecha de Instalación:</td><td className="py-1 align-top">{formatDate(asset.installation_date)}</td></tr>
                <tr><td className="font-medium py-1 pr-4 align-top">Costo de Compra:</td><td className="py-1 align-top">{formatCurrency(asset.purchase_cost)}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div className="py-2 px-3 mb-4 rounded" style={{ backgroundColor: NAVY }}>
              <h3 className="text-base font-bold text-white">Estado Operacional</h3>
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr><td className="font-medium py-1 pr-4 align-top">Horas Iniciales:</td><td className="py-1 align-top">{asset.initial_hours?.toLocaleString() || 0} hrs</td></tr>
                <tr><td className="font-medium py-1 pr-4 align-top">Horas Actuales:</td><td className="py-1 align-top font-bold text-gray-800">{asset.current_hours?.toLocaleString() || 0} hrs</td></tr>
                {asset.current_kilometers && (
                  <tr><td className="font-medium py-1 pr-4 align-top">Kilómetros Actuales:</td><td className="py-1 align-top font-bold text-gray-800">{asset.current_kilometers.toLocaleString()} km</td></tr>
                )}
                <tr><td className="font-medium py-1 pr-4 align-top">Último Mantenimiento:</td><td className="py-1 align-top">{formatDate(asset.last_maintenance_date)}</td></tr>
                <tr><td className="font-medium py-1 pr-4 align-top">Tiempo Total de Inactividad:</td><td className="py-1 align-top">{summary.totalDowntime} horas</td></tr>
                <tr><td className="font-medium py-1 pr-4 align-top">Disponibilidad:</td><td className="py-1 align-top font-bold text-gray-800">{summary.availability}%</td></tr>
                <tr><td className="font-medium py-1 pr-4 align-top">Estado de Garantía:</td><td className="py-1 align-top font-medium text-gray-800">{summary.warrantyStatus}</td></tr>
                {summary.daysToWarrantyExpiration !== null && summary.warrantyStatus === 'Active' && (
                  <tr><td className="font-medium py-1 pr-4 align-top">Días hasta Vencimiento:</td><td className="py-1 align-top font-medium">{summary.daysToWarrantyExpiration} días</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance Summary */}
        <div className="mb-8">
          <div className="py-2 px-3 mb-4 rounded" style={{ backgroundColor: NAVY }}>
            <h3 className="text-base font-bold text-white">Resumen de Mantenimiento</h3>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded p-4 text-center border border-gray-200">
              <p className="text-2xl font-bold text-gray-800">{summary.preventiveMaintenanceCount}</p>
              <p className="text-sm text-gray-600">Mantenimientos Preventivos</p>
            </div>
            <div className="bg-gray-50 rounded p-4 text-center border border-gray-200">
              <p className="text-2xl font-bold text-gray-800">{summary.correctiveMaintenanceCount}</p>
              <p className="text-sm text-gray-600">Mantenimientos Correctivos</p>
            </div>
            <div className="bg-gray-50 rounded p-4 text-center border border-gray-200">
              <p className="text-2xl font-bold text-gray-800">{summary.completedChecklistsCount}</p>
              <p className="text-sm text-gray-600">Checklists Completados</p>
            </div>
            <div className="bg-gray-50 rounded p-4 text-center border border-gray-200">
              <p className="text-2xl font-bold text-gray-800">{summary.openIssuesCount}</p>
              <p className="text-sm text-gray-600">Problemas Abiertos</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="mb-2"><strong>Horas Totales de Trabajo:</strong> {summary.totalMaintenanceHours} hrs</p>
                <p className="mb-2"><strong>Costo de Mantenimiento:</strong> {formatCurrency(summary.totalMaintenanceCost)}</p>
              </div>
              <div>
                <p className="mb-2"><strong>Costo de Incidentes:</strong> {formatCurrency(summary.totalIncidentCost)}</p>
                <p className="mb-2"><strong>Costo Total:</strong> {formatCurrency(summary.totalCost)}</p>
              </div>
              <div>
                <p className="mb-2"><strong>Problemas Resueltos:</strong> {summary.resolvedIssuesCount}</p>
                <p className="mb-2"><strong>Tasa de Resolución:</strong> {summary.checklistIssuesCount > 0 ? Math.round((summary.resolvedIssuesCount / summary.checklistIssuesCount) * 100) : 100}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Maintenance Intervals Analysis */}
        {intervalAnalysis && intervalAnalysis.length > 0 && (
          <div className="mb-8 maintenance-intervals-section">
            <div className="py-2 px-3 mb-4 rounded" style={{ backgroundColor: NAVY }}>
              <h3 className="text-base font-bold text-white">Análisis de Intervalos de Mantenimiento Programados</h3>
            </div>
            <div className="bg-gray-50 rounded p-4 mb-4 border-l-4 border-gray-400">
              <p className="text-sm text-gray-700">
                <strong>Estado de Intervalos:</strong> Análisis detallado del cumplimiento de cada intervalo de mantenimiento preventivo 
                definido para el modelo {asset.equipment_models?.name || 'del equipo'}. 
                Horas actuales del equipo: <strong>{asset.current_hours?.toLocaleString() || 0} horas</strong>
              </p>
            </div>
            
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-600 border-b w-32">Intervalo</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600 border-b w-48">Descripción</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600 border-b w-28">Estado</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600 border-b w-20">Progreso</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600 border-b w-40">Último Realizado</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600 border-b w-32">Próximo Due</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600 border-b">Tareas</th>
                  </tr>
                </thead>
                <tbody>
                  {intervalAnalysis.map((interval: any, index: number) => (
                    <tr key={interval.id} className={`border-t border-gray-200 ${
                      interval.analysis.status === 'overdue' ? 'bg-gray-100' :
                      interval.analysis.status === 'upcoming' ? 'bg-gray-50' :
                      interval.analysis.status === 'covered' ? 'bg-gray-50' :
                      interval.analysis.status === 'completed' ? 'bg-gray-50' : 'bg-white'
                    }`}>
                      <td className="px-3 py-3 border-r border-gray-200 w-32">
                        <div className="space-y-1">
                          <div className="font-medium">{interval.type}</div>
                          <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                            Cada {interval.interval_value} horas
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {interval.id.substring(0, 8)}...
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 border-r border-gray-200 w-48">
                        <div className="font-medium mb-1">{interval.description || interval.name}</div>
                        {interval.maintenance_tasks && interval.maintenance_tasks.length > 0 && (
                          <div className="text-xs text-gray-600">
                            {interval.maintenance_tasks.length} tareas programadas
                          </div>
                        )}
                        {interval.estimated_duration && (
                          <div className="text-xs text-gray-600">
                            Duración estimada: {interval.estimated_duration}h
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center border-r border-gray-200 w-28">
                        <div className="space-y-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadgeClass(interval.analysis.status)}`}>
                            {getStatusText(interval.analysis.status)}
                          </span>
                          {interval.analysis.urgencyLevel === 'high' && (
                            <div className="text-xs text-gray-700 font-medium">URGENTE</div>
                          )}
                          {interval.analysis.urgencyLevel === 'medium' && (
                            <div className="text-xs text-gray-700 font-medium">ATENCIÓN</div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center border-r border-gray-200 w-20">
                        <div className="space-y-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                interval.analysis.status === 'overdue' ? 'bg-gray-600' :
                                interval.analysis.status === 'upcoming' ? 'bg-gray-500' :
                                interval.analysis.status === 'covered' ? 'bg-gray-400' : 'bg-gray-500'
                              }`}
                              style={{ width: `${Math.min(interval.analysis.progress, 100)}%` }}
                            ></div>
                          </div>
                          <div className="text-xs font-medium">
                            {interval.analysis.progress}%
                          </div>
                          {interval.analysis.hoursOverdue > 0 && (
                            <div className="text-xs text-gray-700 font-medium">
                              +{interval.analysis.hoursOverdue}h vencido
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 border-r border-gray-200 w-40">
                        {interval.analysis.wasPerformed && interval.analysis.lastMaintenance ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {formatDate(interval.analysis.lastMaintenance.date)}
                            </div>
                            <div className="text-xs text-gray-600">
                              A las {Number(interval.analysis?.lastMaintenance?.hours)?.toLocaleString() || 'N/A'} horas del equipo
                            </div>
                            <div className="text-xs text-gray-600">
                              Por: {interval.analysis.lastMaintenance.technician}
                            </div>
                            <div className="text-xs text-gray-700 font-medium">
                              Completado
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-sm text-orange-600 font-medium">
                              Nunca realizado
                            </div>
                            {interval.analysis.status === 'covered' && (
                              <div className="text-xs text-gray-600">
                                Cubierto por mantenimiento posterior
                              </div>
                            )}
                            {interval.analysis.status === 'overdue' && (
                              <div className="text-xs text-gray-700 font-medium">
                                Vencido - Requiere atención inmediata
                              </div>
                            )}
                            {interval.analysis.status === 'upcoming' && interval.analysis.urgencyLevel === 'high' && (
                              <div className="text-xs text-gray-700 font-medium">
                                Urgente - Próximo en ≤100h
                              </div>
                            )}
                            {interval.analysis.status === 'upcoming' && interval.analysis.urgencyLevel === 'medium' && (
                              <div className="text-xs text-gray-600 font-medium">
                                Próximo - En ≤200h
                              </div>
                            )}
                            {interval.analysis.status === 'scheduled' && (
                              <div className="text-xs text-gray-600">
                                Programado para el futuro
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 border-r border-gray-200 w-32">
                        <div className="space-y-1">
                          {interval.analysis.wasPerformed ? (
                            <>
                              <div className="text-sm font-medium text-gray-700">
                                Completado
                              </div>
                              <div className="text-xs text-gray-600">
                                Intervalo: {interval.interval_value?.toLocaleString() || 'N/A'} horas
                              </div>
                              <div className="text-xs text-gray-600">
                                Mantenimiento realizado
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-sm font-medium">
                                {interval.interval_value?.toLocaleString() || 'N/A'} horas
                              </div>
                              <div className="text-xs text-gray-600">
                                Intervalo programado
                              </div>
                              {interval.analysis.status === 'overdue' && (
                                <div className="text-xs text-gray-700 font-medium">
                                  Vencido por {interval.analysis.hoursOverdue || 0} horas
                                </div>
                              )}
                              {interval.analysis.status === 'upcoming' && (
                                <div className="text-xs text-gray-600 font-medium">
                                  En {Math.max(0, (interval.interval_value || 0) - (asset.current_hours || 0))} horas
                                </div>
                              )}
                              {interval.analysis.status === 'scheduled' && (
                                <div className="text-xs text-gray-600">
                                  En {Math.max(0, (interval.interval_value || 0) - (asset.current_hours || 0))} horas
                                </div>
                              )}
                              {interval.analysis.status === 'covered' && (
                                <div className="text-xs text-gray-600">
                                  Cubierto por mantenimiento posterior
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {interval.maintenance_tasks && interval.maintenance_tasks.length > 0 ? (
                          <div className="space-y-1">
                            {interval.maintenance_tasks.slice(0, 2).map((task: any, taskIndex: number) => (
                              <div key={task.id} className="text-xs bg-gray-50 p-2 rounded border-l-2 border-gray-300">
                                <div className="font-medium text-gray-800 mb-1">
                                  {task.description}
                                </div>
                                {task.task_parts && task.task_parts.length > 0 && (
                                  <div className="text-xs text-gray-600">
                                    {task.task_parts.length} repuesto(s): {task.task_parts.map((part: any) => part.part_name || part.name).join(', ').substring(0, 50)}{task.task_parts.map((part: any) => part.part_name || part.name).join(', ').length > 50 ? '...' : ''}
                                  </div>
                                )}
                                {task.estimated_duration && (
                                  <div className="text-xs text-gray-600">
                                    Duración: {task.estimated_duration}h
                                  </div>
                                )}
                              </div>
                            ))}
                            {interval.maintenance_tasks.length > 2 && (
                              <div className="text-xs text-gray-500 italic bg-gray-100 p-1 rounded">
                                {interval.maintenance_tasks.length - 2} tarea(s) adicional(es)
                              </div>
                            )}
                            <div className="text-xs text-gray-500 font-medium mt-2">
                              Total: {interval.maintenance_tasks.length} tarea(s)
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 italic">
                            Sin tareas específicas definidas
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white border rounded p-3">
              <div className="font-medium text-gray-800">
                {intervalAnalysis.filter((i: any) => i.analysis.status === 'overdue').length}
              </div>
              <div className="text-xs text-gray-600">Intervalos Vencidos</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="font-medium text-gray-800">
                {intervalAnalysis.filter((i: any) => i.analysis.status === 'upcoming').length}
              </div>
              <div className="text-xs text-gray-600">Próximos a Vencer</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="font-medium text-gray-800">
                {intervalAnalysis.filter((i: any) => i.analysis.status === 'covered').length}
              </div>
              <div className="text-xs text-gray-600">Cubiertos</div>
            </div>
            <div className="bg-white border rounded p-3">
              <div className="font-medium text-gray-800">
                {intervalAnalysis.filter((i: any) => i.analysis.status === 'scheduled').length}
              </div>
                <div className="text-xs text-gray-600">Programados</div>
              </div>
            </div>
          </div>
        )}

        {/* Completed Checklists */}
        {completedChecklists.length > 0 && (
          <div className="mb-8">
            <div className="py-2 px-3 mb-4 rounded" style={{ backgroundColor: NAVY }}>
              <h3 className="text-base font-bold text-white">Historial de Checklists Completados</h3>
            </div>
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-sm print-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Checklist</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Técnico</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 border-b">Estado</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 border-b">Problemas</th>
                  </tr>
                </thead>
                <tbody>
                  {completedChecklists.map((checklist: any, index: number) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-3 border-r border-gray-200">
                        {formatDate(checklist.completion_date)}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <div>
                          <p className="font-medium">{checklist.checklists?.name || 'Checklist'}</p>
                          <p className="text-xs text-gray-500">{checklist.checklists?.frequency}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        {checklist.technician}
                      </td>
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          checklist.status === 'Completado' 
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {checklist.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {checklist.checklist_issues?.length || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Maintenance History */}
        {maintenanceHistory.length > 0 && (
          <div className="mb-8 maintenance-history-section">
            <div className="py-2 px-3 mb-4 rounded" style={{ backgroundColor: NAVY }}>
              <h3 className="text-base font-bold text-white">Historial de Mantenimiento Detallado</h3>
            </div>
            {maintenanceHistory.slice(0, 10).map((maintenance: any, index: number) => {
              const maintenanceType = getMaintenanceType(maintenance)
              
              return (
              <div key={index} className="border border-gray-200 rounded mb-4 p-4">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-sm"><strong>Fecha:</strong> {formatDate(maintenance.date)}</p>
                    <p className="text-sm"><strong>Tipo:</strong> <span className={`font-medium ${maintenanceType.colorClass}`}>{maintenanceType.displayText}</span></p>
                    {maintenance.maintenance_plan_id && (
                      <p className="text-xs text-gray-600 mt-1">Asociado a plan de mantenimiento</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm"><strong>Técnico:</strong> {maintenance.technician}</p>
                    <p className="text-sm"><strong>Horas de Trabajo:</strong> {maintenance.labor_hours || 0} hrs</p>
                  </div>
                  <div>
                    <p className="text-sm"><strong>Costo Total:</strong> {formatCurrency(maintenance.total_cost)}</p>
                    <p className="text-sm"><strong>Horas del Equipo:</strong> {maintenance.hours?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
                <div className="mb-3">
                  <p className="text-sm font-medium mb-1">Descripción:</p>
                  <p className="text-sm text-gray-700">{maintenance.description}</p>
                </div>
                {maintenance.findings && (
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-1">Hallazgos:</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-200">{maintenance.findings}</p>
                  </div>
                )}
                {maintenance.actions && (
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-1">Acciones Realizadas:</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-200">{maintenance.actions}</p>
                  </div>
                )}
                {maintenance.parts && (
                  <div>
                    <p className="text-sm font-medium mb-1">Repuestos Utilizados:</p>
                    <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      {formatParts(maintenance.parts)}
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}

        {/* Incidents */}
        {incidents.length > 0 && (
          <div className="mb-8">
            <div className="py-2 px-3 mb-4 rounded" style={{ backgroundColor: NAVY }}>
              <h3 className="text-base font-bold text-white">Historial de Incidentes</h3>
            </div>
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-sm print-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Descripción</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 border-b">Tiempo Fuera</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 border-b">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((incident: any, index: number) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-3 border-r border-gray-200">
                        {formatDate(incident.date)}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-800">
                          {incident.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        {incident.description}
                      </td>
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        {incident.downtime || 0} hrs
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(incident.total_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Work Orders Status */}
        {workOrders.length > 0 && (
          <div className="mb-8">
            <div className="py-2 px-3 mb-4 rounded" style={{ backgroundColor: NAVY }}>
              <h3 className="text-base font-bold text-white">Estado de Órdenes de Trabajo</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded p-4 border border-gray-200">
                <h4 className="font-medium text-gray-800 mb-2">Completadas</h4>
                <p className="text-2xl font-bold text-gray-800">
                  {workOrders.filter((wo: any) => wo.status === 'Completada').length}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-4 border border-gray-200">
                <h4 className="font-medium text-gray-800 mb-2">En Progreso</h4>
                <p className="text-2xl font-bold text-gray-800">
                  {workOrders.filter((wo: any) => ['En ejecución', 'Aprobada'].includes(wo.status)).length}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-4 border border-gray-200">
                <h4 className="font-medium text-gray-800 mb-2">Pendientes</h4>
                <p className="text-2xl font-bold text-gray-800">
                  {workOrders.filter((wo: any) => ['Pendiente', 'Cotizada'].includes(wo.status)).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="mb-8">
          <div className="py-2 px-3 mb-4 rounded" style={{ backgroundColor: NAVY }}>
            <h3 className="text-base font-bold text-white">Recomendaciones y Observaciones</h3>
          </div>
          <div className="bg-gray-50 rounded p-4 border-l-4 border-gray-400">
            <div className="space-y-2 text-sm">
              {summary.availability < 95 && (
                <p className="text-gray-700">
                  <strong>Disponibilidad Baja:</strong> La disponibilidad del activo ({summary.availability}%) está por debajo del objetivo del 95%. Considere revisar el programa de mantenimiento preventivo.
                </p>
              )}
              {summary.warrantyStatus === 'Expired' && (
                <p className="text-gray-700">
                  <strong>Garantía Vencida:</strong> La garantía del activo ha vencido. Considere un plan de mantenimiento más intensivo.
                </p>
              )}
              {summary.daysToWarrantyExpiration !== null && summary.daysToWarrantyExpiration < 90 && summary.warrantyStatus === 'Active' && (
                <p className="text-gray-700">
                  <strong>Garantía por Vencer:</strong> La garantía vence en {summary.daysToWarrantyExpiration} días. Programe mantenimientos preventivos antes del vencimiento.
                </p>
              )}
              {summary.openIssuesCount > 0 && (
                <p className="text-gray-700">
                  <strong>Problemas Pendientes:</strong> Hay {summary.openIssuesCount} problemas sin resolver detectados en checklists.
                </p>
              )}
              {summary.correctiveMaintenanceCount > summary.preventiveMaintenanceCount && (
                <p className="text-gray-700">
                  <strong>Mantenimiento Reactivo:</strong> Se han realizado más mantenimientos correctivos que preventivos. Considere mejorar el programa preventivo.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* DC Concretos closing block (policy_template) */}
        <div className="text-center mt-12 mb-6" style={{ borderTop: `2px solid ${GREEN}` }}>
          <p className="font-bold text-lg mt-6" style={{ color: NAVY }}>DC Concretos, S.A. de C.V.</p>
          <p className="text-sm mt-1 italic" style={{ color: GREEN }}>"Ayudando a concretar ideas"</p>
        </div>

        {/* Signatures - sigRow style */}
        <div className="grid grid-cols-3 gap-8 mt-8 pt-8" style={{ borderTop: `2px solid #333` }}>
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Responsable de Mantenimiento</h4>
            <div className="border-b border-gray-400 mb-2 h-16"></div>
            <p className="text-sm text-gray-600">Nombre: _______________</p>
            <p className="text-sm text-gray-600">Fecha: _______________</p>
            <p className="text-sm text-gray-600">Firma: _______________</p>
            <p className="text-xs text-gray-500 mt-2">Valido la información del reporte</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Supervisor de Operaciones</h4>
            <div className="border-b border-gray-400 mb-2 h-16"></div>
            <p className="text-sm text-gray-600">Nombre: _______________</p>
            <p className="text-sm text-gray-600">Fecha: _______________</p>
            <p className="text-sm text-gray-600">Firma: _______________</p>
            <p className="text-xs text-gray-500 mt-2">Apruebo el estado del activo</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Gerencia General</h4>
            <div className="border-b border-gray-400 mb-2 h-16"></div>
            <p className="text-sm text-gray-600">Nombre: _______________</p>
            <p className="text-sm text-gray-600">Cargo: _______________</p>
            <p className="text-sm text-gray-600">Fecha: _______________</p>
            <p className="text-sm text-gray-600">Firma: _______________</p>
            <p className="text-xs text-gray-500 mt-2">Recibo conforme el reporte</p>
          </div>
        </div>

        {/* DC Concretos Footer (policy_template style) */}
        <div className="mt-8 pt-4" style={{ borderTop: `3px solid ${GREEN}` }}>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm" style={{ color: "#666" }}>
            <span>rh@dcconcretos.com.mx</span>
            <span>www.dcconcretos.com.mx</span>
            <span>Módulo: Reportes de Producción · Activo: {asset.asset_id}</span>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: "#666" }}>
            Documento generado el {format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })} · Clasificación: Uso Interno
          </p>
        </div>
      </div>

      {/* PDF export: reduce padding to maximize paper usage */}
      <style jsx global>{`
        .print-container.pdf-export-mode {
          padding: 6px !important;
          max-width: 100% !important;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          nav, header, .sidebar, [role="navigation"], [role="banner"], .breadcrumb, .breadcrumbs {
            display: none !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            margin: 1.5cm;
            size: A4 portrait;
          }
          .print-container {
            max-width: 100% !important;
          }
          .executive-summary, .metrics-row {
            page-break-inside: avoid;
          }
          thead { display: table-header-group; }
        }
      `}</style>
    </div>
  )
} 