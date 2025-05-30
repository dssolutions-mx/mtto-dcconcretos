"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { X, Printer, Download } from "lucide-react"
import { useState, useEffect } from "react"

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
              <div key={index} className="text-xs bg-gray-50 p-2 rounded border-l-2 border-blue-200">
                <div className="font-medium text-gray-800">{part.name || part.part_name || 'Repuesto sin nombre'}</div>
                <div className="flex flex-wrap gap-2 text-gray-600 text-xs mt-1">
                  {part.partNumber && <span className="bg-blue-100 px-1 py-0.5 rounded">P/N: {part.partNumber}</span>}
                  <span className="bg-green-100 px-1 py-0.5 rounded">Cant: {part.quantity || 1}</span>
                  {part.unit_price && <span className="bg-yellow-100 px-1 py-0.5 rounded">Precio: {formatCurrency(part.unit_price)}</span>}
                  {part.total_price && <span className="bg-red-100 px-1 py-0.5 rounded">Total: {formatCurrency(part.total_price)}</span>}
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

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    // Usar la funcionalidad de impresión del navegador
    // que permite guardar como PDF de manera más confiable
    window.print()
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'upcoming':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'covered':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'scheduled':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200'
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
          <Download className="h-4 w-4 mr-2" />
          Imprimir/Guardar PDF
        </Button>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Cerrar
        </Button>
      </div>

      {/* Print Content */}
      <div className="print-container report-content max-w-4xl mx-auto p-8">
        
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-gray-200 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-20 h-20 bg-gray-100 rounded border flex items-center justify-center">
              <span className="text-xs text-gray-500">LOGO</span>
            </div>
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">REPORTE DE PRODUCCIÓN DE ACTIVO</h1>
              <p className="text-lg text-gray-600">Historial Completo de Mantenimiento y Operación</p>
            </div>
            <div className="w-20 text-right">
              <p className="text-xs text-gray-500">Activo:</p>
              <p className="font-bold text-lg">{asset.asset_id}</p>
            </div>
          </div>
          <div className="bg-gray-100 rounded p-3">
            <p className="text-sm text-gray-600">
              Documento generado el {format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
            </p>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mb-8 bg-blue-50 rounded-lg p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Resumen Ejecutivo del Activo
          </h3>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="mb-2">
                <strong>Nombre del Activo:</strong> {asset.name}
              </p>
              <p className="mb-2">
                <strong>Código de Activo:</strong> {asset.asset_id}
              </p>
              <p className="mb-2">
                <strong>Estado Actual:</strong> <span className={`font-medium ${asset.status === 'operational' ? 'text-green-600' : 'text-red-600'}`}>{asset.status?.toUpperCase()}</span>
              </p>
              <p className="mb-2">
                <strong>Ubicación:</strong> {asset.location || 'No especificada'}
              </p>
              <p className="mb-2">
                <strong>Departamento:</strong> {asset.department || 'No especificado'}
              </p>
            </div>
            <div>
              <p className="mb-2">
                <strong>Disponibilidad:</strong> <span className="text-green-600 font-medium">{summary.availability}%</span>
              </p>
              <p className="mb-2">
                <strong>Días Operativos:</strong> {summary.operatingDays.toLocaleString()} días
              </p>
              <p className="mb-2">
                <strong>Inversión Total en Mantenimiento:</strong> {formatCurrency(summary.totalCost)}
              </p>
              <p className="mb-2">
                <strong>Estado de Garantía:</strong> <span className={`font-medium ${summary.warrantyStatus === 'Active' ? 'text-green-600' : 'text-red-600'}`}>{summary.warrantyStatus}</span>
              </p>
              <p className="mb-2">
                <strong>Checklists Completados:</strong> {summary.completedChecklistsCount}
              </p>
            </div>
          </div>
        </div>

        {/* Asset Information Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Información Técnica del Activo
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">ID de Activo:</span>
                <span>{asset.asset_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Número de Serie:</span>
                <span>{asset.serial_number || 'N/A'}</span>
              </div>
              {asset.equipment_models && (
                <>
                  <div className="flex justify-between">
                    <span className="font-medium">Fabricante:</span>
                    <span>{asset.equipment_models.manufacturer || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Modelo:</span>
                    <span>{asset.equipment_models.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Número de Modelo:</span>
                    <span>{asset.equipment_models.model_id || 'N/A'}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="font-medium">Fecha de Compra:</span>
                <span>{formatDate(asset.purchase_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Fecha de Instalación:</span>
                <span>{formatDate(asset.installation_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Costo de Compra:</span>
                <span>{formatCurrency(asset.purchase_cost)}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Estado Operacional
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Horas Iniciales:</span>
                <span>{asset.initial_hours?.toLocaleString() || 0} hrs</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Horas Actuales:</span>
                <span className="font-bold text-blue-600">{asset.current_hours?.toLocaleString() || 0} hrs</span>
              </div>
              {asset.current_kilometers && (
                <div className="flex justify-between">
                  <span className="font-medium">Kilómetros Actuales:</span>
                  <span className="font-bold text-blue-600">{asset.current_kilometers.toLocaleString()} km</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-medium">Último Mantenimiento:</span>
                <span>{formatDate(asset.last_maintenance_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Tiempo Total de Inactividad:</span>
                <span>{summary.totalDowntime} horas</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Disponibilidad:</span>
                <span className="font-bold text-green-600">{summary.availability}%</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Estado de Garantía:</span>
                <span className={summary.warrantyStatus === 'Active' ? 'text-green-600 font-medium' : 'text-red-600'}>{summary.warrantyStatus}</span>
              </div>
              {summary.daysToWarrantyExpiration !== null && summary.warrantyStatus === 'Active' && (
                <div className="flex justify-between">
                  <span className="font-medium">Días hasta Vencimiento:</span>
                  <span className="font-medium">{summary.daysToWarrantyExpiration} días</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Maintenance Summary */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
            Resumen de Mantenimiento
          </h3>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 rounded p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{summary.preventiveMaintenanceCount}</p>
              <p className="text-sm text-gray-600">Mantenimientos Preventivos</p>
            </div>
            <div className="bg-red-50 rounded p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{summary.correctiveMaintenanceCount}</p>
              <p className="text-sm text-gray-600">Mantenimientos Correctivos</p>
            </div>
            <div className="bg-blue-50 rounded p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.completedChecklistsCount}</p>
              <p className="text-sm text-gray-600">Checklists Completados</p>
            </div>
            <div className="bg-yellow-50 rounded p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{summary.openIssuesCount}</p>
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
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Análisis de Intervalos de Mantenimiento Programados
            </h3>
            <div className="bg-blue-50 rounded p-4 mb-4 border-l-4 border-blue-500">
              <p className="text-sm text-blue-800">
                <strong>Estado de Intervalos:</strong> Análisis detallado del cumplimiento de cada intervalo de mantenimiento preventivo 
                definido para el modelo {asset.equipment_models?.name || 'del equipo'}. 
                Horas actuales del equipo: <strong>{asset.current_hours?.toLocaleString() || 0} horas</strong>
              </p>
            </div>
            
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Intervalo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Descripción</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 border-b">Estado</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 border-b">Progreso</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Último Realizado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Próximo Due</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Tareas</th>
                  </tr>
                </thead>
                <tbody>
                  {intervalAnalysis.map((interval: any, index: number) => (
                    <tr key={interval.id} className={`border-t border-gray-200 ${
                      interval.analysis.status === 'overdue' ? 'bg-red-50' :
                      interval.analysis.status === 'upcoming' ? 'bg-amber-50' :
                      interval.analysis.status === 'covered' ? 'bg-blue-50' : 'bg-white'
                    }`}>
                      <td className="px-4 py-3 border-r border-gray-200">
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
                      <td className="px-4 py-3 border-r border-gray-200">
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
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <div className="space-y-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusBadgeClass(interval.analysis.status)}`}>
                            {getStatusText(interval.analysis.status)}
                          </span>
                          {interval.analysis.urgencyLevel === 'high' && (
                            <div className="text-xs text-red-600 font-medium">🚨 URGENTE</div>
                          )}
                          {interval.analysis.urgencyLevel === 'medium' && (
                            <div className="text-xs text-amber-600 font-medium">⚠️ ATENCIÓN</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center border-r border-gray-200">
                        <div className="space-y-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                interval.analysis.status === 'overdue' ? 'bg-red-600' :
                                interval.analysis.status === 'upcoming' ? 'bg-amber-500' :
                                interval.analysis.status === 'covered' ? 'bg-blue-400' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(interval.analysis.progress, 100)}%` }}
                            ></div>
                          </div>
                          <div className="text-xs font-medium">
                            {interval.analysis.progress}%
                          </div>
                          {interval.analysis.hoursOverdue > 0 && (
                            <div className="text-xs text-red-600 font-medium">
                              +{interval.analysis.hoursOverdue}h vencido
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        {interval.analysis.wasPerformed && interval.analysis.lastMaintenance ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {formatDate(interval.analysis.lastMaintenance.date)}
                            </div>
                            <div className="text-xs text-gray-600">
                              A las {interval.analysis.lastMaintenance.hours?.toLocaleString() || 'N/A'} horas
                            </div>
                            <div className="text-xs text-gray-600">
                              Por: {interval.analysis.lastMaintenance.technician}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-sm text-orange-600 font-medium">
                              Nunca realizado
                            </div>
                            {interval.analysis.status === 'covered' && (
                              <div className="text-xs text-blue-600">
                                Cubierto por mantenimiento posterior
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-200">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {interval.analysis.nextHours.toLocaleString()} horas
                          </div>
                          {interval.analysis.status === 'scheduled' && (
                            <div className="text-xs text-green-600">
                              En {(interval.analysis.nextHours - (asset.current_hours || 0)).toLocaleString()} horas
                            </div>
                          )}
                          {interval.analysis.status === 'upcoming' && (
                            <div className="text-xs text-amber-600 font-medium">
                              En {Math.abs(interval.analysis.nextHours - (asset.current_hours || 0))} horas
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {interval.maintenance_tasks && interval.maintenance_tasks.length > 0 ? (
                          <div className="space-y-1">
                            {interval.maintenance_tasks.slice(0, 3).map((task: any, taskIndex: number) => (
                              <div key={task.id} className="text-xs bg-gray-50 p-1 rounded">
                                <div className="font-medium text-gray-800">
                                  {task.description}
                                </div>
                                {task.task_parts && task.task_parts.length > 0 && (
                                  <div className="text-xs text-gray-600">
                                    {task.task_parts.length} repuestos requeridos
                                  </div>
                                )}
                              </div>
                            ))}
                            {interval.maintenance_tasks.length > 3 && (
                              <div className="text-xs text-gray-500 italic">
                                ... y {interval.maintenance_tasks.length - 3} tareas más
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            Sin tareas definidas
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
                <div className="font-medium text-red-600">
                  {intervalAnalysis.filter((i: any) => i.analysis.status === 'overdue').length}
                </div>
                <div className="text-xs text-gray-600">Intervalos Vencidos</div>
              </div>
              <div className="bg-white border rounded p-3">
                <div className="font-medium text-amber-600">
                  {intervalAnalysis.filter((i: any) => i.analysis.status === 'upcoming').length}
                </div>
                <div className="text-xs text-gray-600">Próximos a Vencer</div>
              </div>
              <div className="bg-white border rounded p-3">
                <div className="font-medium text-blue-600">
                  {intervalAnalysis.filter((i: any) => i.analysis.status === 'covered').length}
                </div>
                <div className="text-xs text-gray-600">Cubiertos</div>
              </div>
              <div className="bg-white border rounded p-3">
                <div className="font-medium text-green-600">
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
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Historial de Checklists Completados
            </h3>
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
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
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
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Historial de Mantenimiento Detallado
            </h3>
            {maintenanceHistory.slice(0, 10).map((maintenance: any, index: number) => (
              <div key={index} className="border border-gray-200 rounded mb-4 p-4">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-sm"><strong>Fecha:</strong> {formatDate(maintenance.date)}</p>
                    <p className="text-sm"><strong>Tipo:</strong> <span className={`font-medium ${maintenance.type === 'preventive' ? 'text-green-600' : 'text-red-600'}`}>{maintenance.type === 'preventive' ? 'Preventivo' : 'Correctivo'}</span></p>
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
                    <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded">{maintenance.findings}</p>
                  </div>
                )}
                {maintenance.actions && (
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-1">Acciones Realizadas:</p>
                    <p className="text-sm text-gray-700 bg-green-50 p-2 rounded">{maintenance.actions}</p>
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
            ))}
          </div>
        )}

        {/* Incidents */}
        {incidents.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Historial de Incidentes
            </h3>
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
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
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
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Estado de Órdenes de Trabajo
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded p-4">
                <h4 className="font-medium text-green-800 mb-2">Completadas</h4>
                <p className="text-2xl font-bold text-green-600">
                  {workOrders.filter((wo: any) => wo.status === 'Completada').length}
                </p>
              </div>
              <div className="bg-yellow-50 rounded p-4">
                <h4 className="font-medium text-yellow-800 mb-2">En Progreso</h4>
                <p className="text-2xl font-bold text-yellow-600">
                  {workOrders.filter((wo: any) => ['En ejecución', 'Aprobada'].includes(wo.status)).length}
                </p>
              </div>
              <div className="bg-blue-50 rounded p-4">
                <h4 className="font-medium text-blue-800 mb-2">Pendientes</h4>
                <p className="text-2xl font-bold text-blue-600">
                  {workOrders.filter((wo: any) => ['Pendiente', 'Cotizada'].includes(wo.status)).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
            Recomendaciones y Observaciones
          </h3>
          <div className="bg-amber-50 rounded p-4 border-l-4 border-amber-500">
            <div className="space-y-2 text-sm">
              {summary.availability < 95 && (
                <p className="text-amber-800">
                  ⚠️ <strong>Disponibilidad Baja:</strong> La disponibilidad del activo ({summary.availability}%) está por debajo del objetivo del 95%. Considere revisar el programa de mantenimiento preventivo.
                </p>
              )}
              {summary.warrantyStatus === 'Expired' && (
                <p className="text-amber-800">
                  ⚠️ <strong>Garantía Vencida:</strong> La garantía del activo ha vencido. Considere un plan de mantenimiento más intensivo.
                </p>
              )}
              {summary.daysToWarrantyExpiration !== null && summary.daysToWarrantyExpiration < 90 && summary.warrantyStatus === 'Active' && (
                <p className="text-amber-800">
                  ⚠️ <strong>Garantía por Vencer:</strong> La garantía vence en {summary.daysToWarrantyExpiration} días. Programe mantenimientos preventivos antes del vencimiento.
                </p>
              )}
              {summary.openIssuesCount > 0 && (
                <p className="text-amber-800">
                  ⚠️ <strong>Problemas Pendientes:</strong> Hay {summary.openIssuesCount} problemas sin resolver detectados en checklists.
                </p>
              )}
              {summary.correctiveMaintenanceCount > summary.preventiveMaintenanceCount && (
                <p className="text-amber-800">
                  ⚠️ <strong>Mantenimiento Reactivo:</strong> Se han realizado más mantenimientos correctivos que preventivos. Considere mejorar el programa preventivo.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t-2 border-gray-200">
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

        {/* Footer */}
        <div className="mt-8 pt-6 border-t-2 border-gray-300">
          <div className="bg-gray-100 rounded p-4">
            <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
              <div>
                <p className="font-medium mb-1">Información del Documento</p>
                <p>Activo: <strong>{asset.asset_id}</strong></p>
                <p>Generado: {format(new Date(), "dd/MM/yyyy 'a las' HH:mm")}</p>
                <p>Versión: 1.0</p>
              </div>
              <div>
                <p className="font-medium mb-1">Sistema de Gestión</p>
                <p>Plataforma: Sistema de Mantenimiento Industrial</p>
                <p>Módulo: Reportes de Producción</p>
                <p>Estado: Documento Oficial</p>
              </div>
              <div>
                <p className="font-medium mb-1">Confidencialidad</p>
                <p>Clasificación: Uso Interno</p>
                <p>Distribución: Autorizada</p>
                <p>Archivo: Departamento de Mantenimiento</p>
              </div>
            </div>
            <div className="text-center mt-4 pt-3 border-t border-gray-300">
              <p className="text-xs text-gray-500 italic">
                Este documento constituye un registro oficial de la productividad y estado del activo y debe ser conservado según las políticas de la empresa.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          /* Resetear estilos de página */
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
            color: black !important;
            background: white !important;
          }
          
          /* Configuración de página */
          @page {
            margin: 15mm !important;
            size: A4 !important;
          }
          
          /* Contenedor del reporte */
          .report-content {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          
          /* Evitar saltos de página en elementos importantes */
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid !important;
            color: black !important;
          }
          
          .mb-8 {
            page-break-inside: avoid !important;
            margin-bottom: 20px !important;
          }
          
          /* Tablas */
          table {
            page-break-inside: auto !important;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          
          thead {
            display: table-header-group !important;
          }
          
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          
          th, td {
            border: 1px solid #ccc !important;
            padding: 4px !important;
            font-size: 10px !important;
          }
          
          /* Encabezados de tabla */
          th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }
          
          /* Colores de fondo para impresión */
          .bg-blue-50 {
            background-color: #eff6ff !important;
          }
          
          .bg-green-50 {
            background-color: #f0fdf4 !important;
          }
          
          .bg-red-50 {
            background-color: #fef2f2 !important;
          }
          
          .bg-yellow-50 {
            background-color: #fefce8 !important;
          }
          
          .bg-gray-50 {
            background-color: #f9fafb !important;
          }
          
          .bg-amber-50 {
            background-color: #fffbeb !important;
          }
        }
      `}</style>
    </div>
  )
} 