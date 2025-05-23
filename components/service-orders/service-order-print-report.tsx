"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { X, Printer } from "lucide-react"

interface ServiceOrderPrintReportProps {
  serviceOrder: any
  onClose: () => void
}

export function ServiceOrderPrintReport({ serviceOrder, onClose }: ServiceOrderPrintReportProps) {
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

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Print Controls - Hidden when printing */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Cerrar
        </Button>
      </div>

      {/* Print Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-6">
        
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">REPORTE DETALLADO DE ORDEN DE SERVICIO</h1>
          <p className="text-lg text-gray-600">Sistema de Gestión de Mantenimiento</p>
          <p className="text-sm text-gray-500 mt-2">
            Generado el {format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
          </p>
        </div>

        {/* Service Order Information Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Información General del Servicio
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Orden ID:</span>
                <span>{serviceOrder.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Fecha de Servicio:</span>
                <span>{formatDate(serviceOrder.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Tipo de Mantenimiento:</span>
                <span>
                  {serviceOrder.type === 'preventive' ? 'Mantenimiento Preventivo' : 
                   serviceOrder.type === 'corrective' ? 'Mantenimiento Correctivo' : 
                   serviceOrder.type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Estado:</span>
                <span>{serviceOrder.status || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Prioridad:</span>
                <span>{serviceOrder.priority || 'Media'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Técnico Responsable:</span>
                <span>{serviceOrder.technician}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Duración del Trabajo:</span>
                <span>{serviceOrder.labor_hours || 0} horas</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Información del Activo
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Nombre del Activo:</span>
                <span>{serviceOrder.asset_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">ID del Activo:</span>
                <span>{serviceOrder.asset?.asset_id || serviceOrder.asset_id}</span>
              </div>
              {serviceOrder.asset?.equipment_model?.manufacturer && (
                <div className="flex justify-between">
                  <span className="font-medium">Fabricante:</span>
                  <span>{serviceOrder.asset.equipment_model.manufacturer}</span>
                </div>
              )}
              {serviceOrder.asset?.equipment_model?.name && (
                <div className="flex justify-between">
                  <span className="font-medium">Modelo:</span>
                  <span>{serviceOrder.asset.equipment_model.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-medium">Ubicación:</span>
                <span>{serviceOrder.asset?.location || 'No especificada'}</span>
              </div>
              {serviceOrder.asset?.serial_number && (
                <div className="flex justify-between">
                  <span className="font-medium">Número de Serie:</span>
                  <span>{serviceOrder.asset.serial_number}</span>
                </div>
              )}
              {serviceOrder.asset?.current_hours && (
                <div className="flex justify-between">
                  <span className="font-medium">Horas Actuales:</span>
                  <span>{serviceOrder.asset.current_hours.toLocaleString()} hrs</span>
                </div>
              )}
              {serviceOrder.asset?.current_kilometers && (
                <div className="flex justify-between">
                  <span className="font-medium">Kilómetros Actuales:</span>
                  <span>{serviceOrder.asset.current_kilometers.toLocaleString()} km</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Work Details */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
            Detalles del Trabajo Realizado
          </h3>

          <div className="space-y-6">
            <div>
              <p className="font-medium text-sm text-gray-600 mb-2">Descripción del Trabajo:</p>
              <div className="border border-gray-200 rounded p-3 bg-gray-50">
                <p className="text-sm">{serviceOrder.description || 'Sin descripción disponible'}</p>
              </div>
            </div>

            {serviceOrder.findings && (
              <div>
                <p className="font-medium text-sm text-gray-600 mb-2">Hallazgos Durante la Inspección:</p>
                <div className="border border-blue-200 rounded p-3 bg-blue-50">
                  <p className="text-sm">{serviceOrder.findings}</p>
                </div>
              </div>
            )}

            {serviceOrder.actions && (
              <div>
                <p className="font-medium text-sm text-gray-600 mb-2">Acciones Correctivas Realizadas:</p>
                <div className="border border-green-200 rounded p-3 bg-green-50">
                  <p className="text-sm">{serviceOrder.actions}</p>
                </div>
              </div>
            )}

            {serviceOrder.notes && (
              <div>
                <p className="font-medium text-sm text-gray-600 mb-2">Observaciones Adicionales:</p>
                <div className="border border-yellow-200 rounded p-3 bg-yellow-50">
                  <p className="text-sm">{serviceOrder.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Parts Used */}
        {serviceOrder.parts && serviceOrder.parts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              Repuestos y Materiales Utilizados
            </h3>
            <div className="overflow-hidden border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Descripción</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Cantidad</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Costo Unitario</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceOrder.parts.map((part: any, index: number) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{part.name || part.description || 'Repuesto sin nombre'}</p>
                          {part.part_number && (
                            <p className="text-xs text-gray-500">P/N: {part.part_number}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{part.quantity || 1}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(part.unit_cost || part.cost || 0)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency((part.quantity || 1) * (part.unit_cost || part.cost || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-medium">
                      Total Repuestos:
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {formatCurrency(serviceOrder.parts_cost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Cost Summary */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
            Resumen de Costos del Servicio
          </h3>
          <div className="bg-gray-50 rounded p-6">
            <div className="grid grid-cols-2 gap-6 text-sm mb-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Horas de Trabajo:</span>
                  <span className="font-medium">{serviceOrder.labor_hours || 0} horas</span>
                </div>
                <div className="flex justify-between">
                  <span>Costo de Mano de Obra:</span>
                  <span className="font-medium">{formatCurrency(serviceOrder.labor_cost)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Cantidad de Repuestos:</span>
                  <span className="font-medium">{serviceOrder.parts?.length || 0} items</span>
                </div>
                <div className="flex justify-between">
                  <span>Costo de Repuestos:</span>
                  <span className="font-medium">{formatCurrency(serviceOrder.parts_cost)}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-300 pt-4">
              <div className="flex justify-between text-xl font-bold">
                <span>COSTO TOTAL DEL SERVICIO:</span>
                <span>{formatCurrency(serviceOrder.total_cost)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
            Cronología del Servicio
          </h3>
          <div className="bg-gray-50 rounded p-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Orden de Servicio Creada:</span>
                <span>{formatDateTime(serviceOrder.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Servicio Ejecutado:</span>
                <span>{formatDateTime(serviceOrder.date)}</span>
              </div>
              {serviceOrder.updated_at && serviceOrder.updated_at !== serviceOrder.created_at && (
                <div className="flex justify-between">
                  <span className="font-medium">Última Actualización:</span>
                  <span>{formatDateTime(serviceOrder.updated_at)}</span>
                </div>
              )}
              {serviceOrder.work_order_id && (
                <div className="flex justify-between">
                  <span className="font-medium">Orden de Trabajo Relacionada:</span>
                  <span>{serviceOrder.work_order_id}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quality Control Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
            Control de Calidad y Verificación
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded p-4">
              <h4 className="font-medium text-gray-700 mb-3">Verificación del Técnico</h4>
              <div className="space-y-2 text-sm">
                <p>☐ Trabajo completado según especificaciones</p>
                <p>☐ Repuestos instalados correctamente</p>
                <p>☐ Pruebas de funcionamiento realizadas</p>
                <p>☐ Área de trabajo limpia y ordenada</p>
                <p>☐ Documentación completada</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded p-4">
              <h4 className="font-medium text-gray-700 mb-3">Verificación del Supervisor</h4>
              <div className="space-y-2 text-sm">
                <p>☐ Calidad del trabajo verificada</p>
                <p>☐ Cumplimiento de procedimientos</p>
                <p>☐ Seguridad durante la ejecución</p>
                <p>☐ Costos dentro del presupuesto</p>
                <p>☐ Cliente/Usuario satisfecho</p>
              </div>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t-2 border-gray-200">
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Técnico Responsable</h4>
            <div className="border-b border-gray-400 mb-2 h-16"></div>
            <p className="text-sm text-gray-600">Nombre: {serviceOrder.technician}</p>
            <p className="text-sm text-gray-600">Fecha: _______________</p>
            <p className="text-sm text-gray-600">Firma: _______________</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Supervisor de Mantenimiento</h4>
            <div className="border-b border-gray-400 mb-2 h-16"></div>
            <p className="text-sm text-gray-600">Nombre: _______________</p>
            <p className="text-sm text-gray-600">Fecha: _______________</p>
            <p className="text-sm text-gray-600">Firma: _______________</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Recibido Conforme</h4>
            <div className="border-b border-gray-400 mb-2 h-16"></div>
            <p className="text-sm text-gray-600">Nombre: _______________</p>
            <p className="text-sm text-gray-600">Fecha: _______________</p>
            <p className="text-sm text-gray-600">Firma: _______________</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500">
          <p>Este documento fue generado automáticamente por el Sistema de Gestión de Mantenimiento</p>
          <p>Orden de Servicio: {serviceOrder.order_id} | Generado: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
          <p>Documento confidencial - Solo para uso interno de la organización</p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .print\\:p-6 {
            padding: 1.5rem !important;
          }
          
          @page {
            margin: 0.5in;
            size: letter;
          }
          
          .page-break {
            page-break-before: always;
          }
          
          table {
            page-break-inside: avoid;
          }
          
          .border-gray-200 {
            border-color: #e5e7eb !important;
          }
          
          .bg-gray-50 {
            background-color: #f9fafb !important;
          }
          
          .bg-blue-50 {
            background-color: #eff6ff !important;
          }
          
          .bg-green-50 {
            background-color: #f0fdf4 !important;
          }
          
          .bg-yellow-50 {
            background-color: #fefce8 !important;
          }
          
          /* Ensure proper spacing for signatures */
          .grid-cols-3 > div {
            min-height: 120px;
          }
        }
      `}</style>
    </div>
  )
} 