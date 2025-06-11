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
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2 bg-white p-2 rounded shadow-lg">
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
      <div className="print-container max-w-4xl mx-auto p-8">
        
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-gray-200 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-20 h-20 bg-gray-100 rounded border flex items-center justify-center">
              <span className="text-xs text-gray-500">LOGO</span>
            </div>
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">REPORTE DE SERVICIO DE MANTENIMIENTO</h1>
              <p className="text-lg text-gray-600">Sistema de Gestión de Mantenimiento Industrial</p>
            </div>
            <div className="w-20 text-right">
              <p className="text-xs text-gray-500">Orden:</p>
              <p className="font-bold text-lg">{serviceOrder.order_id}</p>
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
            Resumen Ejecutivo del Servicio
          </h3>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="mb-2">
                <strong>Tipo de Intervención:</strong> {serviceOrder.type === 'preventive' ? 'Mantenimiento Preventivo Programado' : 'Mantenimiento Correctivo de Emergencia'}
              </p>
              <p className="mb-2">
                <strong>Activo Intervenido:</strong> {serviceOrder.asset_name} ({serviceOrder.asset?.asset_id})
              </p>
              <p className="mb-2">
                <strong>Ubicación:</strong> {(serviceOrder.asset as any)?.plants?.name || serviceOrder.asset?.location || 'Sin planta'}
              </p>
            </div>
            <div>
              <p className="mb-2">
                <strong>Duración Total:</strong> {serviceOrder.labor_hours || 0} horas de trabajo
              </p>
              <p className="mb-2">
                <strong>Inversión Total:</strong> {formatCurrency(serviceOrder.total_cost)}
              </p>
              <p className="mb-2">
                <strong>Estado Final:</strong> <span className="text-green-600 font-medium">SERVICIO COMPLETADO</span>
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm italic text-gray-700">
              {serviceOrder.description}
            </p>
          </div>
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
                <span className="font-medium text-blue-600">{serviceOrder.technician}</span>
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
                <span>{(serviceOrder.asset as any)?.plants?.name || serviceOrder.asset?.location || 'Sin planta'}</span>
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
              <table className="w-full text-sm print-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 border-b">Descripción</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 border-b">Cantidad</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 border-b">Costo Unitario</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 border-b">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceOrder.parts.map((part: any, index: number) => {
                    // Handle different possible property names for the same data
                    const partName = part.name || part.part_name || part.description || 'Repuesto sin nombre';
                    const partNumber = part.part_number || part.partNumber || part.part_id || '';
                    const quantity = part.quantity || 1;
                    const unitCost = part.cost || part.unit_cost || part.unit_price || 0;
                    const totalCost = part.total_price || part.total_cost || (quantity * unitCost);
                    
                    return (
                      <tr key={index} className="border-t border-gray-200">
                        <td className="px-4 py-3 border-r border-gray-200">
                          <div>
                            <p className="font-medium">{partName}</p>
                            {partNumber && (
                              <p className="text-xs text-gray-500">P/N: {partNumber}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-r border-gray-200">{quantity}</td>
                        <td className="px-4 py-3 text-right border-r border-gray-200">{formatCurrency(unitCost)}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(totalCost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-medium border-r border-gray-200">
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
                  <span>OT-{serviceOrder.work_order_id.slice(-6)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-medium">Tiempo Total de Servicio:</span>
                <span>{serviceOrder.labor_hours || 0} horas</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Estado del Servicio:</span>
                <span className="font-medium text-green-600">
                  {serviceOrder.status === 'completado' ? 'COMPLETADO SATISFACTORIAMENTE' : serviceOrder.status?.toUpperCase()}
                </span>
              </div>
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

        {/* Certification Section */}
        <div className="mb-8 bg-green-50 rounded-lg p-6 border-l-4 border-green-500">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Certificación del Servicio
          </h3>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="mb-3">
                <strong>✓ Trabajo Realizado Conforme:</strong> El servicio fue ejecutado siguiendo los procedimientos establecidos y las especificaciones técnicas del fabricante.
              </p>
              <p className="mb-3">
                <strong>✓ Calidad Verificada:</strong> Todos los componentes instalados y reparados han sido verificados y cumplen con los estándares de calidad requeridos.
              </p>
            </div>
            <div>
              <p className="mb-3">
                <strong>✓ Seguridad Garantizada:</strong> El equipo se encuentra en condiciones seguras de operación tras la intervención realizada.
              </p>
              <p className="mb-3">
                <strong>✓ Documentación Completa:</strong> Se ha registrado toda la información necesaria para el seguimiento del mantenimiento.
              </p>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t-2 border-gray-200">
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Técnico Responsable</h4>
            <div className="border-b border-gray-400 mb-2 h-16"></div>
            <p className="text-sm text-gray-600">Nombre: <strong>{serviceOrder.technician}</strong></p>
            <p className="text-sm text-gray-600">Fecha: {formatDate(serviceOrder.date)}</p>
            <p className="text-sm text-gray-600">Firma: _______________</p>
            <p className="text-xs text-gray-500 mt-2">Certifico que el trabajo fue realizado según especificaciones</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Supervisor de Mantenimiento</h4>
            <div className="border-b border-gray-400 mb-2 h-16"></div>
            <p className="text-sm text-gray-600">Nombre: _______________</p>
            <p className="text-sm text-gray-600">Fecha: _______________</p>
            <p className="text-sm text-gray-600">Firma: _______________</p>
            <p className="text-xs text-gray-500 mt-2">Valido la calidad y conformidad del servicio</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-4">Recibido Conforme - Cliente</h4>
            <div className="border-b border-gray-400 mb-2 h-16"></div>
            <p className="text-sm text-gray-600">Nombre: _______________</p>
            <p className="text-sm text-gray-600">Cargo: _______________</p>
            <p className="text-sm text-gray-600">Fecha: _______________</p>
            <p className="text-sm text-gray-600">Firma: _______________</p>
            <p className="text-xs text-gray-500 mt-2">Acepto el servicio y verifico su conformidad</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t-2 border-gray-300">
          <div className="bg-gray-100 rounded p-4">
            <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
              <div>
                <p className="font-medium mb-1">Información del Documento</p>
                <p>Orden de Servicio: <strong>{serviceOrder.order_id}</strong></p>
                <p>Generado: {format(new Date(), "dd/MM/yyyy 'a las' HH:mm")}</p>
                <p>Versión: 1.0</p>
              </div>
              <div>
                <p className="font-medium mb-1">Sistema de Gestión</p>
                <p>Plataforma: Sistema de Mantenimiento Industrial</p>
                <p>Módulo: Órdenes de Servicio</p>
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
                Este documento constituye un registro oficial del servicio de mantenimiento realizado y debe ser conservado según las políticas de la empresa.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            font-family: Arial, sans-serif !important;
            line-height: 1.4 !important;
          }
          
          .print-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 15mm !important;
            background: white !important;
          }
          
          @page {
            margin: 0;
            size: A4;
          }
          
          /* Reset all conflicting styles */
          .fixed, .absolute, .relative {
            position: static !important;
          }
          
          /* Clear typography */
          h1 {
            font-size: 20px !important;
            margin: 0 0 15px 0 !important;
            text-align: center !important;
            page-break-after: avoid !important;
          }
          
          h3 {
            font-size: 14px !important;
            margin: 15px 0 8px 0 !important;
            border-bottom: 1px solid #000 !important;
            padding-bottom: 3px !important;
            page-break-after: avoid !important;
          }
          
          h4 {
            font-size: 12px !important;
            margin: 10px 0 5px 0 !important;
            page-break-after: avoid !important;
          }
          
          p, div, span {
            font-size: 11px !important;
            line-height: 1.3 !important;
            margin: 0 !important;
          }
          
          /* Grid layouts for print */
          .grid-cols-2 {
            display: table !important;
            width: 100% !important;
            margin-bottom: 15px !important;
          }
          
          .grid-cols-2 > div {
            display: table-cell !important;
            width: 50% !important;
            vertical-align: top !important;
            padding-right: 15px !important;
          }
          
          .grid-cols-3 {
            display: table !important;
            width: 100% !important;
            margin-top: 20px !important;
          }
          
          .grid-cols-3 > div {
            display: table-cell !important;
            width: 33.33% !important;
            vertical-align: top !important;
            padding-right: 10px !important;
            min-height: 80px !important;
          }
          
          /* Table styling */
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 10px 0 !important;
            page-break-inside: avoid !important;
          }
          
          .print-table th,
          .print-table td {
            border: 1px solid #000 !important;
            padding: 6px !important;
            font-size: 10px !important;
            vertical-align: top !important;
          }
          
          .print-table th {
            background-color: #f0f0f0 !important;
            font-weight: bold !important;
            text-align: center !important;
          }
          
          .print-table td {
            text-align: left !important;
          }
          
          .print-table .text-center {
            text-align: center !important;
          }
          
          .print-table .text-right {
            text-align: right !important;
          }
          
          /* Spacing */
          .mb-8 {
            margin-bottom: 15px !important;
          }
          
          .mb-4 {
            margin-bottom: 8px !important;
          }
          
          .mb-2 {
            margin-bottom: 4px !important;
          }
          
          .mt-8 {
            margin-top: 15px !important;
          }
          
          .mt-12 {
            margin-top: 20px !important;
          }
          
          .pt-8 {
            padding-top: 15px !important;
          }
          
          .pb-6 {
            padding-bottom: 10px !important;
          }
          
          /* Borders */
          .border-b-2 {
            border-bottom: 2px solid #000 !important;
          }
          
          .border-b {
            border-bottom: 1px solid #000 !important;
          }
          
          .border-t-2 {
            border-top: 2px solid #000 !important;
          }
          
          .border {
            border: 1px solid #000 !important;
          }
          
          /* Background colors */
          .bg-gray-50 {
            background-color: #f8f8f8 !important;
          }
          
          .bg-blue-50 {
            background-color: #e8f4f8 !important;
          }
          
          .bg-green-50 {
            background-color: #e8f8e8 !important;
          }
          
          .bg-yellow-50 {
            background-color: #f8f8e8 !important;
          }
          
          /* Text alignment */
          .text-center {
            text-align: center !important;
          }
          
          .text-right {
            text-align: right !important;
          }
          
          .text-left {
            text-align: left !important;
          }
          
          /* Font weights */
          .font-bold {
            font-weight: bold !important;
          }
          
          .font-medium {
            font-weight: 500 !important;
          }
          
          /* Signature lines */
          .border-b.border-gray-400 {
            border-bottom: 1px solid #000 !important;
            height: 1px !important;
            margin: 40px 0 10px 0 !important;
          }
          
          /* Space between items */
          .space-y-3 > * + * {
            margin-top: 6px !important;
          }
          
          .space-y-2 > * + * {
            margin-top: 4px !important;
          }
          
          .space-y-6 > * + * {
            margin-top: 12px !important;
          }
          
          /* Flex layouts to block for print */
          .flex {
            display: block !important;
          }
          
          .justify-between {
            display: block !important;
          }
          
          .justify-between > span:first-child::after {
            content: ": ";
          }
        }
        
        /* Screen styles */
        .print-table {
          border-collapse: collapse;
        }
        
        .print-table th,
        .print-table td {
          border: 1px solid #e5e7eb;
        }
      `}</style>
    </div>
  )
} 