"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Printer, X, FileDown } from "lucide-react"
import { useRouter } from "next/navigation"
import jsPDF from "jspdf"
import { snapdom } from "@zumer/snapdom"
import type { WorkOrderOriginData } from "@/lib/work-orders/build-origin-data"

const NAVY = "#1B365D"
const GREEN = "#00A64F"

interface EvidenceItem {
  url: string
  phase: string
  caption?: string
  description?: string
}

interface IssueHistoryEntry {
  date?: string
  checklist?: string
  description?: string
  notes?: string
  status?: string
  priority?: string
}

interface ScheduleData {
  plannedDate: string | null
  nextDue: string | null
  isPreventive: boolean
}

interface WorkOrderPrintDocumentProps {
  workOrder: any
  asset?: any
  purchaseOrders?: any[]
  profiles?: Record<string, any>
  requiredParts?: any[]
  totalPartsCost?: number
  requiredTasks?: any[]
  originData?: WorkOrderOriginData | null
  evidence?: EvidenceItem[]
  issueHistory?: IssueHistoryEntry[]
  maintenanceHistory?: { completed_tasks?: unknown } | null
  additionalExpenses?: any[]
  schedule?: ScheduleData
}

function getOriginBadgeLabel(originType: string): string {
  switch (originType) {
    case "incident":
      return "Desde incidente"
    case "checklist":
      return "Desde checklist"
    case "preventive":
      return "Preventivo programado"
    case "adhoc":
    default:
      return "Manual / Ad-hoc"
  }
}

export function WorkOrderPrintDocument({
  workOrder,
  asset,
  purchaseOrders = [],
  profiles = {},
  requiredParts = [],
  totalPartsCost = 0,
  requiredTasks = [],
  originData = null,
  evidence = [],
  issueHistory = [],
  maintenanceHistory = null,
  additionalExpenses = [],
  schedule = { plannedDate: null, nextDue: null, isPreventive: false },
}: WorkOrderPrintDocumentProps) {
  const router = useRouter()

  const handlePrint = () => {
    const navigationElements = document.querySelectorAll(
      "nav, header, .sidebar, .navigation, .nav, .header, [role=navigation], [role=banner], .navbar, .menu, .breadcrumb, .breadcrumbs"
    )
    const originalDisplay: string[] = []
    navigationElements.forEach((el, index) => {
      const element = el as HTMLElement
      originalDisplay[index] = element.style.display
      element.style.display = "none"
    })
    window.print()
    setTimeout(() => {
      navigationElements.forEach((el, index) => {
        const element = el as HTMLElement
        element.style.display = originalDisplay[index] || ""
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
      pdf.save(
        `orden-trabajo-${workOrder.order_id}-${format(new Date(), "yyyy-MM-dd")}.pdf`
      )
    } catch (err) {
      console.error("Error generating PDF:", err)
      handlePrint()
    } finally {
      noPrint?.style.removeProperty("display")
      element.classList.remove("pdf-export-mode")
    }
  }

  const handleClose = () => {
    router.back()
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A"
    try {
      return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es })
    } catch {
      return String(dateString)
    }
  }

  const formatDateShort = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A"
    try {
      return format(new Date(dateString), "d MMM HH:mm", { locale: es })
    } catch {
      return String(dateString)
    }
  }

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (!amount) return "$0.00"
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(numAmount)
  }

  const getProfileName = (profileId: string | null) => {
    if (!profileId) return "No asignado"
    const profile = profiles[profileId]
    if (!profile) return "No asignado"
    return profile.nombre && profile.apellido
      ? `${profile.nombre} ${profile.apellido}`
      : profile.nombre || "No asignado"
  }

  // Clean description: strip ORIGEN and NUEVA OCURRENCIA blocks (same as WorkOrderGeneralInfoCard)
  const rawDescription = workOrder.description ?? ""
  const descriptionWithoutOrigin = rawDescription
    .replace(/(^|\n)ORIGEN:[\s\S]*?(?=NUEVA OCURRENCIA|$)/gi, "")
    .trim()
  const recurrenceCount = (workOrder.related_issues_count ?? 1) > 1 || (workOrder.escalation_count ?? 0) > 0
    ? (workOrder.related_issues_count ?? 1) - 1 + (workOrder.escalation_count ?? 0)
    : 0
  const summaryLine =
    recurrenceCount > 0 && rawDescription.includes("NUEVA OCURRENCIA")
      ? descriptionWithoutOrigin.split("NUEVA OCURRENCIA")[0].trim()
      : descriptionWithoutOrigin
  const cleanSummary = summaryLine || "Sin descripción"

  // Cost calculation
  const regularPOs = (purchaseOrders || []).filter((po: any) => !po.is_adjustment)
  const quotedCost = regularPOs.reduce((sum: number, po: any) => {
    const amount =
      typeof po.total_amount === "string" ? parseFloat(po.total_amount) : po.total_amount
    return sum + (amount || 0)
  }, 0)
  const actualCost = regularPOs.reduce((sum: number, po: any) => {
    if (po.actual_amount) {
      const amount =
        typeof po.actual_amount === "string"
          ? parseFloat(po.actual_amount)
          : po.actual_amount
      return sum + (amount || 0)
    }
    const amount =
      typeof po.total_amount === "string" ? parseFloat(po.total_amount) : po.total_amount
    return sum + (amount || 0)
  }, 0)
  const estimatedCost = workOrder.estimated_cost
    ? typeof workOrder.estimated_cost === "string"
      ? parseFloat(workOrder.estimated_cost)
      : workOrder.estimated_cost
    : 0
  const hasReceipts = regularPOs.some(
    (po: any) => po.actual_amount || ["received", "validated"].includes(po.status)
  )
  const primaryCost = hasReceipts
    ? actualCost
    : quotedCost || estimatedCost || totalPartsCost

  const displayParts = requiredParts
  const isCompleted = workOrder.status === "Completado" || workOrder.status === "Completed"

  const SecHdr = ({
    title,
    children,
  }: {
    title: string
    children: React.ReactNode
  }) => (
    <div className="mb-6">
      <div
        className="py-2 px-3 mb-4 rounded"
        style={{ backgroundColor: NAVY }}
      >
        <h3 className="text-base font-bold text-white">{title}</h3>
      </div>
      {children}
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Print Controls - Hidden when printing */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 bg-white p-2 rounded shadow-lg border">
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
        <Button onClick={handleDownloadPDF} className="bg-green-600 hover:bg-green-700">
          <FileDown className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
        <Button variant="outline" onClick={handleClose}>
          <X className="h-4 w-4 mr-2" />
          Cerrar
        </Button>
      </div>

      {/* Print Content - DC Concretos format */}
      <div className="print-container report-content max-w-4xl mx-auto p-8">
        {/* DC Concretos Header */}
        <div
          className="flex items-stretch mb-6"
          style={{ borderBottom: `3px solid ${GREEN}` }}
        >
          <div className="w-32 flex-shrink-0 flex items-center p-2">
            <img
              src="/logo.png"
              alt="DC Concretos"
              className="max-h-14 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder-logo.png"
              }}
            />
          </div>
          <div
            className="flex-1 flex flex-col justify-center text-right px-4 py-3"
            style={{ backgroundColor: NAVY }}
          >
            <p className="text-white font-bold text-sm uppercase tracking-wide">
              DC CONCRETOS, S.A. DE C.V.
            </p>
            <p className="text-white/90 text-xs mt-0.5">
              OT-001 | Orden de Trabajo
            </p>
            <p className="text-lg font-bold mt-1" style={{ color: GREEN }}>
              ORDEN DE TRABAJO
            </p>
          </div>
        </div>

        {/* Document title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>
            Orden de Trabajo {workOrder.order_id}
          </h1>
          <p className="text-sm" style={{ color: GREEN }}>
            Sistema de Gestión de Mantenimiento Industrial · Generado el{" "}
            {format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", {
              locale: es,
            })}
          </p>
        </div>

        {/* Origen y Contexto */}
        {originData && (
          <SecHdr title="Origen y Contexto">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className="px-2 py-1 rounded text-xs font-medium border"
                style={{
                  backgroundColor: "#f0f0f0",
                  borderColor: "#ccc",
                  color: "#333",
                }}
              >
                {getOriginBadgeLabel(originData.originType)}
              </span>
              {originData.originName && (
                <span className="font-medium">{originData.originName}</span>
              )}
              {originData.cycleInterval && (
                <span
                  className="px-2 py-0.5 rounded text-xs border"
                  style={{ borderColor: "#ccc" }}
                >
                  {originData.cycleInterval}
                </span>
              )}
            </div>
            <p className="text-sm mt-2 text-gray-700">
              <strong>{originData.fechaLabel}:</strong>{" "}
              {originData.fechaValue ?? "N/A"}
            </p>
          </SecHdr>
        )}

        {/* Activo */}
        {asset && (
          <SecHdr title="Información del Activo">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr>
                  <td className="font-medium py-1 pr-4 align-top w-36">ID Activo:</td>
                  <td className="py-1 align-top">{asset.asset_id || "N/A"}</td>
                </tr>
                <tr>
                  <td className="font-medium py-1 pr-4 align-top">Nombre:</td>
                  <td className="py-1 align-top">{asset.name || "N/A"}</td>
                </tr>
                {asset.location && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top">Ubicación:</td>
                    <td className="py-1 align-top">{asset.location}</td>
                  </tr>
                )}
                {asset.current_hours != null && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top">
                      Horas actuales:
                    </td>
                    <td className="py-1 align-top font-bold">
                      {Number(asset.current_hours).toLocaleString()} hrs
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </SecHdr>
        )}

        {/* Resumen */}
        <SecHdr title="Resumen">
          <p className="text-base font-semibold text-gray-800 mb-4 leading-relaxed">
            {cleanSummary}
          </p>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="font-medium py-1 pr-4 align-top w-36">Estado:</td>
                <td className="py-1 align-top">
                  {(workOrder.status || "Pendiente").toUpperCase()}
                </td>
                <td className="font-medium py-1 pr-4 align-top pl-8">Tipo:</td>
                <td className="py-1 align-top">
                  {(workOrder.type || "N/A").toUpperCase()}
                </td>
              </tr>
              <tr>
                <td className="font-medium py-1 pr-4 align-top">Prioridad:</td>
                <td className="py-1 align-top">
                  {(workOrder.priority || "Media").toUpperCase()}
                </td>
              </tr>
              <tr>
                <td className="font-medium py-1 pr-4 align-top">
                  Solicitado por:
                </td>
                <td className="py-1 align-top">
                  {getProfileName(workOrder.requested_by)}
                </td>
                <td className="font-medium py-1 pr-4 align-top pl-8">
                  Técnico asignado:
                </td>
                <td className="py-1 align-top">
                  {getProfileName(workOrder.assigned_to)}
                </td>
              </tr>
              <tr>
                <td className="font-medium py-1 pr-4 align-top">
                  Fecha creación:
                </td>
                <td className="py-1 align-top">
                  {formatDate(workOrder.created_at)}
                </td>
                <td className="font-medium py-1 pr-4 align-top pl-8">
                  Fecha programada:
                </td>
                <td className="py-1 align-top">
                  {workOrder.planned_date
                    ? formatDate(workOrder.planned_date)
                    : "No planificada"}
                </td>
              </tr>
              {workOrder.estimated_duration && (
                <tr>
                  <td className="font-medium py-1 pr-4 align-top">
                    Duración estimada:
                  </td>
                  <td className="py-1 align-top">
                    {workOrder.estimated_duration} horas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </SecHdr>

        {/* Historial de recurrencias */}
        {issueHistory && issueHistory.length > 0 && (
          <SecHdr title="Historial de recurrencias">
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Fecha
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Descripción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...issueHistory]
                    .sort(
                      (a, b) =>
                        new Date(b.date || 0).getTime() -
                        new Date(a.date || 0).getTime()
                    )
                    .slice(0, 5)
                    .map((entry, idx) => (
                      <tr key={idx} className="border-t border-gray-200">
                        <td className="px-3 py-2">
                          {entry.date ? formatDateShort(entry.date) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {entry.notes || entry.description || "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </SecHdr>
        )}

        {/* Programación */}
        {(schedule.plannedDate || schedule.nextDue) && (
          <SecHdr title="Programación">
            <table className="w-full text-sm border-collapse">
              <tbody>
                {schedule.plannedDate && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top w-48">
                      Fecha programada:
                    </td>
                    <td className="py-1 align-top">
                      {formatDate(schedule.plannedDate)}
                    </td>
                  </tr>
                )}
                {schedule.nextDue && schedule.isPreventive && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top">
                      Próxima ejecución:
                    </td>
                    <td className="py-1 align-top">
                      {formatDate(schedule.nextDue)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </SecHdr>
        )}

        {/* Tareas de Mantenimiento */}
        {requiredTasks.length > 0 && (
          <SecHdr title="Tareas de Mantenimiento">
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b w-8">
                      #
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Descripción
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b w-24">
                      Tipo
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 border-b w-20">
                      Tiempo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requiredTasks.map(
                    (
                      task: {
                        id?: string
                        description?: string
                        type?: string
                        estimated_time?: number
                        parts?: Array<{
                          name: string
                          part_number?: string
                          quantity: number
                        }>
                      },
                      index: number
                    ) => (
                      <tr key={task.id || index} className="border-t border-gray-200">
                        <td className="px-3 py-2 text-center">{index + 1}</td>
                        <td className="px-3 py-2">
                          {task.description || "N/A"}
                        </td>
                        <td className="px-3 py-2">{task.type || "N/A"}</td>
                        <td className="px-3 py-2 text-center">
                          {task.estimated_time
                            ? `${task.estimated_time} hrs`
                            : "N/A"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </SecHdr>
        )}

        {/* Repuestos y Materiales */}
        {displayParts.length > 0 && (
          <SecHdr title="Repuestos y Materiales">
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Descripción
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b w-24">
                      P/N
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 border-b w-16">
                      Cant
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 border-b w-24">
                      Precio Unit.
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 border-b w-24">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayParts.map((part: any, index: number) => {
                    const partName =
                      part.name || part.description || part.item || "N/A"
                    const partNumber =
                      part.partNumber || part.part_number || part.code || "N/A"
                    const quantity = Number(part.quantity) || 1
                    const unitPrice = Number(part.unit_price || part.price || 0)
                    const totalPrice =
                      Number(part.total_price) || quantity * unitPrice
                    return (
                      <tr key={index} className="border-t border-gray-200">
                        <td className="px-3 py-2">{partName}</td>
                        <td className="px-3 py-2">{partNumber}</td>
                        <td className="px-3 py-2 text-center">{quantity}</td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(unitPrice)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(totalPrice)}
                        </td>
                      </tr>
                    )
                  })}
                  <tr
                    className="border-t border-gray-300 font-bold"
                    style={{ backgroundColor: "#f5f5f5" }}
                  >
                    <td colSpan={4} className="px-3 py-2 text-right">
                      Total:
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(
                        totalPartsCost ||
                          displayParts.reduce(
                            (sum: number, p: any) =>
                              sum + (Number(p.total_price) || 0),
                            0
                          )
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SecHdr>
        )}

        {/* Costos */}
        <SecHdr title="Información de Costos">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {estimatedCost > 0 && (
                <tr>
                  <td className="font-medium py-1 pr-4 align-top w-40">
                    Costo estimado:
                  </td>
                  <td className="py-1 align-top">{formatCurrency(estimatedCost)}</td>
                </tr>
              )}
              {quotedCost > 0 && (
                <tr>
                  <td className="font-medium py-1 pr-4 align-top">
                    Costo cotizado:
                  </td>
                  <td className="py-1 align-top">{formatCurrency(quotedCost)}</td>
                </tr>
              )}
              {hasReceipts && actualCost > 0 && (
                <tr>
                  <td className="font-medium py-1 pr-4 align-top">
                    Costo real:
                  </td>
                  <td className="py-1 align-top">{formatCurrency(actualCost)}</td>
                </tr>
              )}
              <tr
                className="font-bold border-t-2 border-gray-300"
                style={{ paddingTop: "8px" }}
              >
                <td className="font-medium py-2 pr-4 align-top">
                  Costo total:
                </td>
                <td className="py-2 align-top">{formatCurrency(primaryCost)}</td>
              </tr>
            </tbody>
          </table>
        </SecHdr>

        {/* Orden de Compra */}
        {regularPOs.length > 0 && (
          <SecHdr title="Orden de Compra">
            {regularPOs.map((po: any, index: number) => (
              <table
                key={index}
                className="w-full text-sm border-collapse mb-4"
              >
                <tbody>
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top w-36">
                      Número OC:
                    </td>
                    <td className="py-1 align-top">
                      {po.order_id || "N/A"}
                    </td>
                    <td className="font-medium py-1 pr-4 align-top pl-8">
                      Proveedor:
                    </td>
                    <td className="py-1 align-top">
                      {po.supplier || po.service_provider || "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top">
                      Estado:
                    </td>
                    <td className="py-1 align-top">{po.status || "N/A"}</td>
                    <td className="font-medium py-1 pr-4 align-top pl-8">
                      Monto:
                    </td>
                    <td className="py-1 align-top">
                      {formatCurrency(po.actual_amount || po.total_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            ))}
          </SecHdr>
        )}

        {/* Evidencia Fotográfica */}
        {evidence.length > 0 && (
          <SecHdr title="Evidencia Fotográfica">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {evidence.slice(0, 12).map((item, idx) => (
                <div key={idx} className="text-center">
                  <img
                    src={item.url}
                    alt={item.caption || item.description || item.phase}
                    className="w-24 h-24 object-cover rounded border mx-auto block"
                    crossOrigin="anonymous"
                  />
                  <p className="text-xs mt-1 font-medium text-gray-600">
                    {item.phase}
                  </p>
                  {(item.caption || item.description) && (
                    <p className="text-xs text-gray-500 truncate max-w-full">
                      {item.caption || item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {evidence.length > 12 && (
              <p className="text-xs text-gray-500 mt-2">
                ... y {evidence.length - 12} imagen(es) más
              </p>
            )}
          </SecHdr>
        )}

        {/* Información de Cierre */}
        {isCompleted &&
          (workOrder.completed_at ||
            workOrder.completed_by ||
            (maintenanceHistory as any)?.technician ||
            (maintenanceHistory as any)?.actions ||
            (maintenanceHistory as any)?.findings) && (
          <SecHdr title="Información de Cierre">
            <table className="w-full text-sm border-collapse">
              <tbody>
                {(workOrder.completed_at || (maintenanceHistory as any)?.date) && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top w-40">
                      Fecha de cierre:
                    </td>
                    <td className="py-1 align-top">
                      {formatDate(
                        workOrder.completed_at ||
                          (maintenanceHistory as any)?.date
                      )}
                    </td>
                  </tr>
                )}
                {(workOrder.completed_by || (maintenanceHistory as any)?.technician) && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top">
                      Técnico ejecutor:
                    </td>
                    <td className="py-1 align-top">
                      {(maintenanceHistory as any)?.technician ||
                        getProfileName(workOrder.completed_by)}
                    </td>
                  </tr>
                )}
                {(maintenanceHistory as any)?.actions && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top">
                      Resolución:
                    </td>
                    <td className="py-1 align-top">
                      {(maintenanceHistory as any).actions}
                    </td>
                  </tr>
                )}
                {(maintenanceHistory as any)?.findings && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top">
                      Observaciones:
                    </td>
                    <td className="py-1 align-top">
                      {(maintenanceHistory as any).findings}
                    </td>
                  </tr>
                )}
                {(maintenanceHistory as any)?.labor_hours && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top">
                      Horas de trabajo:
                    </td>
                    <td className="py-1 align-top">
                      {Number((maintenanceHistory as any).labor_hours)} hrs
                    </td>
                  </tr>
                )}
                {(maintenanceHistory as any)?.total_cost && (
                  <tr>
                    <td className="font-medium py-1 pr-4 align-top">
                      Costo total (cierre):
                    </td>
                    <td className="py-1 align-top">
                      {formatCurrency((maintenanceHistory as any).total_cost)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </SecHdr>
        )}

        {/* Gastos Adicionales */}
        {isCompleted && additionalExpenses.length > 0 && (
          <SecHdr title="Gastos Adicionales">
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Descripción
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">
                      Monto
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {additionalExpenses.map((exp: any, idx: number) => (
                    <tr key={idx} className="border-t border-gray-200">
                      <td className="px-3 py-2">{exp.description || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-3 py-2">
                        {exp.status || "Pendiente"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SecHdr>
        )}

        {/* Firmas */}
        <div
          className="mt-8 pt-6 border-t-2"
          style={{ borderColor: NAVY, pageBreakInside: "avoid" }}
        >
          <div className="flex flex-wrap justify-between gap-4">
            <div className="flex-1 min-w-[28%] border border-gray-400 p-4">
              <div className="font-bold text-sm uppercase border-b border-gray-600 pb-2 mb-3">
                Quien Ejecuta los Trabajos
              </div>
              <div className="border-b border-gray-400 h-12 mb-2" />
              <p className="text-xs">Nombre: ___________________________</p>
              <p className="text-xs">Cédula/ID: ___________________________</p>
              <p className="text-xs">Fecha: ___________________________</p>
              <div className="border-b border-gray-400 h-8 mt-2" />
              <p className="text-xs text-center italic mt-1">
                Certifico que el trabajo fue realizado según especificaciones
              </p>
            </div>
            <div className="flex-1 min-w-[28%] border border-gray-400 p-4">
              <div className="font-bold text-sm uppercase border-b border-gray-600 pb-2 mb-3">
                Quien Entrega la Orden
              </div>
              <div className="border-b border-gray-400 h-12 mb-2" />
              <p className="text-xs">Nombre: ___________________________</p>
              <p className="text-xs">Cargo: ___________________________</p>
              <p className="text-xs">Fecha: ___________________________</p>
              <div className="border-b border-gray-400 h-8 mt-2" />
              <p className="text-xs text-center italic mt-1">
                Entrego la orden de trabajo para su ejecución
              </p>
            </div>
            <div className="flex-1 min-w-[28%] border border-gray-400 p-4">
              <div className="font-bold text-sm uppercase border-b border-gray-600 pb-2 mb-3">
                Quien Recibe el Equipo
              </div>
              <div className="border-b border-gray-400 h-12 mb-2" />
              <p className="text-xs">Nombre: ___________________________</p>
              <p className="text-xs">Cargo: ___________________________</p>
              <p className="text-xs">Fecha: ___________________________</p>
              <div className="border-b border-gray-400 h-8 mt-2" />
              <p className="text-xs text-center italic mt-1">
                Recibo el equipo conforme después de la ejecución del trabajo
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="mt-8 pt-4"
          style={{ borderTop: `3px solid ${GREEN}` }}
        >
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-gray-600">
            <span>rh@dcconcretos.com.mx</span>
            <span>www.dcconcretos.com.mx</span>
            <span>
              Módulo: Órdenes de Trabajo · OT {workOrder.order_id}
            </span>
          </div>
          <p className="text-center text-xs mt-2 text-gray-500">
            Documento generado el{" "}
            {format(
              new Date(),
              "dd 'de' MMMM 'de' yyyy 'a las' HH:mm",
              { locale: es }
            )}{" "}
            · Clasificación: Uso Interno
          </p>
        </div>
      </div>

      {/* Print / PDF styles */}
      <style jsx global>{`
        .print-container.pdf-export-mode {
          padding: 6px !important;
          max-width: 100% !important;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          nav,
          header,
          .sidebar,
          [role="navigation"],
          [role="banner"],
          .breadcrumb,
          .breadcrumbs {
            display: none !important;
          }
          html,
          body {
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
          .executive-summary,
          .metrics-row {
            page-break-inside: avoid;
          }
          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </div>
  )
}
