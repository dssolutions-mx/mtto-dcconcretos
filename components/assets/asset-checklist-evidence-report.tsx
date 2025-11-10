"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Printer, 
  Download, 
  X, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Calendar, 
  User, 
  MapPin, 
  Truck,
  FileText,
  Clock,
  Camera,
  ExternalLink
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { SecurityConfig, SecurityTalkData } from "@/types"

interface Asset {
  id: string
  name: string
  asset_id: string
  location: string | null
  department: string | null
  status: string
  plants?: {
    name: string
    location: string
  }
  departments?: {
    name: string
  }
}

interface CompletedItem {
  id: string
  item_id: string
  status: 'pass' | 'flag' | 'fail'
  notes?: string
  photo_url?: string
  description?: string  // Added description field that exists in the data
}

interface CompletedChecklist {
  id: string
  checklist_id: string
  asset_id: string
  completed_items: CompletedItem[]
  technician: string
  completion_date: string
  notes: string | null
  status: string
  signature_data: string | null
  created_by: string | null
  checklists: {
    id: string
    name: string
    frequency: string
    description: string | null
    checklist_sections: Array<{
      id: string
      title: string
      order_index: number
      section_type?: 'checklist' | 'evidence' | 'cleanliness_bonus' | 'security_talk'
      security_config?: SecurityConfig | null
      checklist_items: Array<{
        id: string
        description: string
        required: boolean
        order_index: number
      }>
    }>
  }
  profile: {
    id: string
    nombre: string | null
    apellido: string | null
    role: string | null
    telefono: string | null
    avatar_url: string | null
    departamento: string | null
  } | null
  issues?: Array<{
    id: string
    description: string
    status: string
    notes: string | null
    photo_url: string | null
    work_order_id: string | null
    resolved: boolean | null
  }>
  security_data?: Record<string, SecurityTalkData> | null
}

interface ReportData {
  asset: Asset
  completed_checklists: CompletedChecklist[]
  total_checklists: number
  period_start: string
  period_end: string
  summary: {
    total_items: number
    passed_items: number
    flagged_items: number
    failed_items: number
    total_issues: number
  }
}

interface AssetChecklistEvidenceReportProps {
  assetId: string
  onClose: () => void
  dateRange?: {
    start: string
    end: string
  }
}

export function AssetChecklistEvidenceReport({ 
  assetId, 
  onClose, 
  dateRange 
}: AssetChecklistEvidenceReportProps) {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [operatorDirectory, setOperatorDirectory] = useState<Record<string, { nombre: string; apellido: string; employee_code?: string }>>({})

  useEffect(() => {
    fetchReportData()
  }, [assetId, dateRange])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (dateRange?.start) params.append('start_date', dateRange.start)
      if (dateRange?.end) params.append('end_date', dateRange.end)

      const response = await fetch(`/api/assets/${assetId}/checklist-evidence-report?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar el reporte')
      }

      const result = await response.json()
      if (!result.data) {
        throw new Error('Reporte sin datos válidos')
      }
      setData(result.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchOperatorDirectory = async (operatorIds: string[]) => {
    if (operatorIds.length === 0) return

    try {
      const response = await fetch(`/api/operators/register?ids=${operatorIds.join(',')}`)
      if (!response.ok) return

      const operators = await response.json()
      setOperatorDirectory(prev => {
        const updated = { ...prev }
        operators.forEach((op: any) => {
          updated[op.id] = {
            nombre: op.nombre || '',
            apellido: op.apellido || '',
            employee_code: op.employee_code || undefined
          }
        })
        return updated
      })
    } catch (error) {
      console.error('Error fetching operator directory for report:', error)
    }
  }

  useEffect(() => {
    if (!data?.completed_checklists?.length) return

    const attendeeIds = new Set<string>()
    data.completed_checklists.forEach(checklist => {
      const securitySections = checklist.security_data || {}
      Object.values(securitySections).forEach(sectionData => {
        if (sectionData?.attendees && Array.isArray(sectionData.attendees)) {
          sectionData.attendees.forEach(id => attendeeIds.add(id))
        }
      })
    })

    const missingIds = Array.from(attendeeIds).filter(id => !operatorDirectory[id])
    if (missingIds.length > 0) {
      fetchOperatorDirectory(missingIds)
    }
  }, [data, operatorDirectory])

  const handlePrint = () => {
    window.print()
  }

  const handleExportPDF = () => {
    // This would integrate with a PDF generation service
    // For now, we'll use the browser's print to PDF functionality
    window.print()
  }

  const getOperatorDisplayName = (operatorId: string) => {
    const operator = operatorDirectory[operatorId]
    if (!operator) {
      return `Operador ${operatorId.substring(0, 8)}...`
    }
    const fullName = `${operator.nombre || ''} ${operator.apellido || ''}`.trim()
    return operator.employee_code
      ? `${fullName} (${operator.employee_code})`
      : fullName
  }

  const renderSecuritySection = (
    section: CompletedChecklist['checklists']['checklist_sections'][number],
    securityData: SecurityTalkData,
    config: SecurityConfig
  ) => {
    const isPlantManagerMode = config.mode === 'plant_manager' || (securityData.attendees?.length ?? 0) > 0

    return (
      <div key={section.id} className="border rounded-lg p-4">
        <h4 className="font-medium text-lg mb-3 text-gray-900">
          {section.title}
        </h4>
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <span className="font-medium text-gray-900">Modo:</span>{' '}
            {isPlantManagerMode ? 'Jefe de Planta / Dosificador' : 'Operador'}
          </div>

          {config.require_attendance && (
            isPlantManagerMode ? (
              <div>
                <span className="font-medium text-gray-900">Asistentes:</span>
                {securityData.attendees && securityData.attendees.length > 0 ? (
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {securityData.attendees.map(attendeeId => (
                      <li key={attendeeId}>{getOperatorDisplayName(attendeeId)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-gray-500">No se registraron asistentes.</p>
                )}
              </div>
            ) : (
              <div>
                <span className="font-medium text-gray-900">Asistencia:</span>{' '}
                {securityData.attendance === true
                  ? 'Asistió'
                  : securityData.attendance === false
                    ? 'No asistió'
                    : 'No registrado'}
              </div>
            )
          )}

          {config.require_topic && securityData.topic && (
            <div>
              <span className="font-medium text-gray-900">Tema Cubierto:</span>
              <p className="mt-1 bg-gray-50 p-2 rounded">{securityData.topic}</p>
            </div>
          )}

          {config.require_reflection && securityData.reflection && (
            <div>
              <span className="font-medium text-gray-900">Reflexión:</span>
              <p className="mt-1 bg-gray-50 p-2 rounded whitespace-pre-wrap">
                {securityData.reflection}
              </p>
            </div>
          )}

          {config.allow_evidence && securityData.evidence && securityData.evidence.length > 0 && (
            <div>
              <span className="font-medium text-gray-900 block mb-2">Evidencia Fotográfica:</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {securityData.evidence.map((evidence, index) => (
                  evidence?.photo_url ? (
                    <div key={`${section.id}-evidence-${index}`} className="space-y-1">
                      <div className="relative w-full aspect-[4/3] overflow-hidden rounded border">
                        <img
                          src={evidence.photo_url}
                          alt={`Evidencia ${index + 1} - ${section.title}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {(evidence.category || evidence.description) && (
                        <p className="text-xs text-gray-500">
                          {evidence.category && <span className="font-medium">{evidence.category}: </span>}
                          {evidence.description}
                        </p>
                      )}
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es })
  }

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'flag':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-500 text-white">Correcto</Badge>
      case 'flag':
        return <Badge className="bg-yellow-500 text-white">Atención</Badge>
      case 'fail':
        return <Badge className="bg-red-500 text-white">Falla</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  // Simple helper function like in the single checklist page
  const getItemCompletionData = (checklist: CompletedChecklist, itemId: string): CompletedItem | null => {
    if (!checklist.completed_items || !Array.isArray(checklist.completed_items)) {
      return null
    }
    return checklist.completed_items.find(item => item.item_id === itemId) || null
  }

  useEffect(() => {
    // Add print styles - ONLY hide sidebar/nav, preserve ALL formatting
    const styleId = 'asset-checklist-report-print-styles'
    if (document.getElementById(styleId)) {
      return
    }
    
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @media print {
        /* Hide sidebar and navigation */
        aside,
        nav,
        header:not(.print-header),
        [role="navigation"],
        [role="banner"],
        .breadcrumb,
        .breadcrumbs,
        .print\\:hidden {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Page margins */
        @page {
          margin: 1cm;
          size: A4;
        }
        
        /* Prevent horizontal overflow */
        html,
        body {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          overflow-x: hidden !important;
          overflow-y: visible !important;
        }
        
        /* Fix flex container - remove sidebar space completely */
        body > div,
        body > div > div {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Flex container with sidebar - make it block or ensure no sidebar space */
        div[class*="flex"][class*="min-h-screen"],
        div.flex.min-h-screen {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        /* Ensure sidebar takes zero space */
        aside {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          flex: 0 0 0 !important;
        }
        
        /* Main content wrapper - full width */
        div.flex.flex-1 {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Main content - full width but preserve internal structure */
        main {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Report container - full width */
        .report-container {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
        }
        
        /* Prevent page breaks in cards */
        .break-inside-avoid {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        /* Prevent horizontal overflow on containers only */
        div, section, article {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
      }
    `
    document.head.appendChild(style)
    
    return () => {
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        document.head.removeChild(existingStyle)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-48"></div>
            </div>
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen p-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Error en Reporte</h1>
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
          <Alert variant="destructive">
            <AlertDescription>{error || "No se pudo cargar el reporte"}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white report-container">
      {/* Header - Hidden when printing */}
      <div className="print:hidden bg-white border-b p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Reporte de Evidencias de Checklist</h1>
            <p className="text-sm text-gray-600">{data.asset?.name || 'Activo'} ({data.asset?.asset_id || 'Sin ID'})</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-4 print:max-w-full print:mx-0">
        {/* Report Header */}
        <div className="text-center mb-8 print:mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            REPORTE DE EVIDENCIAS DE CHECKLIST
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Evidencia Documentada de Mantenimiento Preventivo
          </p>
          <div className="text-sm text-gray-500">
            Generado el {formatDateTime(new Date().toISOString())}
          </div>
        </div>

        {/* Asset Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Información del Activo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Nombre del Activo</dt>
                  <dd className="text-lg font-medium">{data.asset?.name || 'Sin nombre'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">ID del Activo</dt>
                  <dd className="text-lg">{data.asset?.asset_id || 'Sin ID'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Estado</dt>
                  <dd className="text-lg">
                    <Badge variant={data.asset?.status === 'Activo' ? 'default' : 'secondary'}>
                      {data.asset?.status || 'Sin estado'}
                    </Badge>
                  </dd>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Planta</dt>
                  <dd className="text-lg">{data.asset?.plants?.name || data.asset?.location || 'No especificada'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Departamento</dt>
                  <dd className="text-lg">{data.asset?.departments?.name || data.asset?.department || 'No especificado'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Ubicación</dt>
                  <dd className="text-lg">{data.asset?.plants?.location || 'No especificada'}</dd>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resumen del Período
            </CardTitle>
            <p className="text-sm text-gray-600">
              Del {formatDate(data.period_start)} al {formatDate(data.period_end)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{data.total_checklists}</div>
                <div className="text-sm text-gray-600">Checklists Completados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{data.summary.passed_items}</div>
                <div className="text-sm text-gray-600">Ítems Correctos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{data.summary.flagged_items}</div>
                <div className="text-sm text-gray-600">Ítems con Atención</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{data.summary.failed_items}</div>
                <div className="text-sm text-gray-600">Ítems Fallidos</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-800">{data.summary.total_items}</div>
                <div className="text-sm text-gray-600">Total de Ítems Evaluados</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completed Checklists Details */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Detalles de Checklists Completados</h2>
          
          {data.completed_checklists.map((checklist, index) => (
            <Card key={checklist.id} className="break-inside-avoid">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {index + 1}. {checklist.checklists?.name || 'Checklist sin nombre'}
                  </CardTitle>
                  <Badge className="bg-green-500 text-white">Completado</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDateTime(checklist.completion_date)}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {checklist.profile?.nombre && checklist.profile?.apellido 
                      ? `${checklist.profile.nombre} ${checklist.profile.apellido}` 
                      : checklist.technician}
                  </div>
                  <Badge variant="outline">
                    {checklist.checklists?.frequency || 'Sin frecuencia'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Checklist Description */}
                {checklist.checklists?.description && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">{checklist.checklists.description}</p>
                  </div>
                )}

                {/* Technician Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded">
                  <div>
                    <h4 className="font-medium mb-2">Técnico Responsable</h4>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="font-medium">Nombre: </span>
                        {checklist.profile?.nombre && checklist.profile?.apellido 
                          ? `${checklist.profile.nombre} ${checklist.profile.apellido}` 
                          : checklist.technician}
                      </div>
                      {checklist.profile?.role && (
                        <div>
                          <span className="font-medium">Cargo: </span>
                          {checklist.profile.role}
                        </div>
                      )}
                      {checklist.profile?.departamento && (
                        <div>
                          <span className="font-medium">Departamento: </span>
                          {checklist.profile.departamento}
                        </div>
                      )}
                      {checklist.profile?.telefono && (
                        <div>
                          <span className="font-medium">Teléfono: </span>
                          {checklist.profile.telefono}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {checklist.signature_data && (
                    <div>
                      <h4 className="font-medium mb-2">Firma Digital</h4>
                      <img 
                        src={checklist.signature_data} 
                        alt="Firma del técnico"
                        className="max-w-48 h-16 object-contain border rounded bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Checklist Sections and Items */}
                <div className="space-y-4">
                  {(() => {
                    const hasMatchingItems = checklist.checklists?.checklist_sections?.some(section => {
                      const securityDataForSection = checklist.security_data?.[section.id]
                      if (section.section_type === 'security_talk' || securityDataForSection) {
                        return !!securityDataForSection
                      }
                      return section.checklist_items?.some(item => getItemCompletionData(checklist, item.id))
                    })
                    
                    // Si tenemos plantilla Y hay matching, mostrar por secciones
                    if (checklist.checklists?.checklist_sections?.length > 0 && hasMatchingItems) {
                      return (
                    checklist.checklists.checklist_sections
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((section) => {
                        const securityDataForSection = checklist.security_data?.[section.id]

                        if (section.section_type === 'security_talk' || securityDataForSection) {
                          if (!securityDataForSection) return null
                          const inferredConfig: SecurityConfig = section.security_config || {
                            mode: securityDataForSection.attendees && securityDataForSection.attendees.length > 0 ? 'plant_manager' : 'operator',
                            require_attendance: true,
                            require_topic: true,
                            require_reflection: true,
                            allow_evidence: Array.isArray(securityDataForSection.evidence) && securityDataForSection.evidence.length > 0
                          }
                          return renderSecuritySection(section, securityDataForSection, inferredConfig)
                        }
                        // Solo mostrar secciones que tengan items completados
                        const completedSectionItems = section.checklist_items
                          ?.filter((item) => getItemCompletionData(checklist, item.id))
                          ?.sort((a, b) => a.order_index - b.order_index);
                        
                        if (!completedSectionItems?.length) return null;
                        
                        return (
                      <div key={section.id} className="border rounded-lg p-4">
                        <h4 className="font-medium text-lg mb-3 text-gray-900">
                          {section.title}
                        </h4>
                        
                        <div className="space-y-3">
                          {completedSectionItems.map((item) => {
                              const completionData = getItemCompletionData(checklist, item.id)
                              return (
                                <div key={item.id} className="border-l-4 border-gray-200 pl-4 py-2">
                                  <div className="flex items-start justify-between gap-4 mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        {completionData && getStatusIcon(completionData.status)}
                                        <span className="font-medium">{item.description}</span>
                                        {item.required && (
                                          <Badge variant="outline" className="text-xs">
                                            Obligatorio
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    {completionData && getStatusBadge(completionData.status)}
                                  </div>
                                  
                                  {completionData && (
                                    <div className="space-y-2 ml-6">
                                      {completionData.notes && (
                                        <div>
                                          <span className="text-sm font-medium text-gray-500">Observaciones:</span>
                                          <p className="text-sm mt-1 bg-gray-50 p-2 rounded">
                                            {completionData.notes}
                                          </p>
                                        </div>
                                      )}
                                      
                                      {completionData.photo_url && (
                                        <div>
                                          <span className="text-sm font-medium text-gray-500 block mb-2">
                                            Evidencia Fotográfica:
                                          </span>
                                          <div className="relative inline-block">
                                            <img 
                                              src={completionData.photo_url} 
                                              alt={`Evidencia: ${item.description}`}
                                              className="w-48 h-36 object-cover rounded border print:max-w-32 print:max-h-24"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                        );
                      })
                        .filter(Boolean)
                      );
                    } else {
                      // Si no hay matching o no hay plantilla, mostrar directamente los completed_items
                      return checklist.completed_items?.filter(item => item.description)?.length > 0 && (
                      <div className="border rounded-lg p-4">
                        <h4 className="font-medium text-lg mb-3 text-gray-900">
                          Elementos Evaluados
                        </h4>
                        
                        <div className="space-y-3">
                          {checklist.completed_items
                            .filter(item => item.description) // Solo items con descripción
                            .map((item, index) => (
                              <div key={item.item_id || index} className="border-l-4 border-gray-200 pl-4 py-2">
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      {getStatusIcon(item.status)}
                                      <span className="font-medium">{item.description}</span>
                                    </div>
                                  </div>
                                  {getStatusBadge(item.status)}
                                </div>
                                
                                <div className="space-y-2 ml-6">
                                  {item.notes && (
                                    <div>
                                      <span className="text-sm font-medium text-gray-500">Observaciones:</span>
                                      <p className="text-sm mt-1 bg-gray-50 p-2 rounded">
                                        {item.notes}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {item.photo_url && (
                                    <div>
                                      <span className="text-sm font-medium text-gray-500 block mb-2">
                                        Evidencia Fotográfica:
                                      </span>
                                      <div className="relative inline-block">
                                        <img 
                                          src={item.photo_url} 
                                          alt={`Evidencia: ${item.description}`}
                                          className="w-48 h-36 object-cover rounded border print:max-w-32 print:max-h-24"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                      );
                    }
                  })()}
                </div>



                {/* General Notes */}
                {checklist.notes && (
                  <div className="mt-4 p-4 bg-gray-50 rounded">
                    <h4 className="font-medium mb-2">Observaciones Generales</h4>
                    <p className="text-sm">{checklist.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {data.completed_checklists.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  No hay checklists completados
                </h3>
                <p className="text-sm text-gray-500">
                  No se encontraron checklists completados para este activo en el período seleccionado.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Report Footer */}
        <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500 print:mt-6">
          <p>
            Este reporte fue generado automáticamente el {formatDateTime(new Date().toISOString())}
          </p>
          <p className="mt-1">
            Documento de evidencia para verificación de mantenimiento preventivo realizado.
          </p>
        </div>
      </div>
    </div>
  )
}