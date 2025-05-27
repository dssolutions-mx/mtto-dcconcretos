"use client"

import React, { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, Eye, Download, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

export interface EvidenceItem {
  id?: string
  url: string
  description: string
  category: string
  uploaded_at: string
  bucket_path?: string
}

interface EvidenceViewerProps {
  evidence: EvidenceItem[]
  title?: string
  className?: string
  showCategories?: boolean
  maxItems?: number
}

export function EvidenceViewer({
  evidence,
  title = "Evidencia",
  className,
  showCategories = true,
  maxItems
}: EvidenceViewerProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null)
  const [showModal, setShowModal] = useState(false)

  const displayedEvidence = maxItems ? evidence.slice(0, maxItems) : evidence

  const handleViewEvidence = (item: EvidenceItem) => {
    setSelectedEvidence(item)
    setShowModal(true)
  }

  const handleDownload = (item: EvidenceItem) => {
    const link = document.createElement('a')
    link.href = item.url
    link.download = `${item.description}.${item.url.split('.').pop()}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isImage = (url: string) => {
    return url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('image')
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      // Categorías en español
      identificacion_problema: "bg-red-100 text-red-800",
      estado_equipo: "bg-blue-100 text-blue-800",
      preocupaciones_seguridad: "bg-yellow-100 text-yellow-800",
      area_trabajo_antes: "bg-gray-100 text-gray-800",
      area_trabajo_despues: "bg-green-100 text-green-800",
      trabajo_completado: "bg-green-100 text-green-800",
      partes_reemplazadas: "bg-purple-100 text-purple-800",
      equipo_funcionamiento: "bg-blue-100 text-blue-800",
      control_calidad: "bg-indigo-100 text-indigo-800",
      recibos_facturas: "bg-orange-100 text-orange-800",
      antes_mantenimiento: "bg-gray-100 text-gray-800",
      durante_proceso: "bg-blue-100 text-blue-800",
      inspeccion_partes: "bg-purple-100 text-purple-800",
      problema_cumplimiento: "bg-red-100 text-red-800",
      elemento_marcado: "bg-yellow-100 text-yellow-800",
      desgaste_dano: "bg-red-100 text-red-800",
      lectura_medicion: "bg-blue-100 text-blue-800",
      violacion_seguridad: "bg-red-100 text-red-800",
      accion_correctiva: "bg-green-100 text-green-800",
      // Categorías de incidentes
      condicion_inicial: "bg-gray-100 text-gray-800",
      falla_danos: "bg-red-100 text-red-800",
      area_afectada: "bg-orange-100 text-orange-800",
      condiciones_seguridad: "bg-yellow-100 text-yellow-800",
      evidencia_causa: "bg-purple-100 text-purple-800",
      impacto_operacional: "bg-blue-100 text-blue-800",
      acciones_inmediatas: "bg-green-100 text-green-800",
      estado_final: "bg-green-100 text-green-800",
      documentacion_soporte: "bg-gray-100 text-gray-800",
      // Mantener compatibilidad con categorías en inglés antiguas
      problem_identification: "bg-red-100 text-red-800",
      equipment_condition: "bg-blue-100 text-blue-800",
      safety_concerns: "bg-yellow-100 text-yellow-800",
      workspace_before: "bg-gray-100 text-gray-800",
      workspace_after: "bg-green-100 text-green-800",
      work_completed: "bg-green-100 text-green-800",
      parts_replaced: "bg-purple-100 text-purple-800",
      equipment_running: "bg-blue-100 text-blue-800",
      quality_check: "bg-indigo-100 text-indigo-800",
      receipt_invoice: "bg-orange-100 text-orange-800",
      before_maintenance: "bg-gray-100 text-gray-800",
      during_process: "bg-blue-100 text-blue-800",
      parts_inspection: "bg-purple-100 text-purple-800",
      compliance_issue: "bg-red-100 text-red-800",
      flagged_item: "bg-yellow-100 text-yellow-800",
    }
    return colors[category] || "bg-gray-100 text-gray-800"
  }

  if (evidence.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No hay evidencia disponible</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{title}</h3>
          <Badge variant="outline">{evidence.length} archivo(s)</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedEvidence.map((item, index) => (
          <Card key={item.id || index} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="aspect-video relative bg-muted">
              {isImage(item.url) ? (
                <img
                  src={item.url}
                  alt={item.description}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              
              {showCategories && (
                <Badge 
                  className={cn(
                    "absolute top-2 left-2 text-xs",
                    getCategoryColor(item.category)
                  )}
                >
                  {item.category}
                </Badge>
              )}

              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-6 w-6 p-0"
                  onClick={() => handleViewEvidence(item)}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-6 w-6 p-0"
                  onClick={() => handleDownload(item)}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <CardContent className="p-3">
              <p className="text-sm font-medium truncate mb-1">
                {item.description}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{new Date(item.uploaded_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {maxItems && evidence.length > maxItems && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Mostrando {maxItems} de {evidence.length} archivos
          </p>
        </div>
      )}

      {/* Modal for viewing evidence */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedEvidence?.description}</DialogTitle>
            <DialogDescription>
              Categoría: {selectedEvidence?.category} • {" "}
              Subido: {selectedEvidence ? new Date(selectedEvidence.uploaded_at).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {selectedEvidence && (
              <div className="space-y-4">
                {isImage(selectedEvidence.url) ? (
                  <img
                    src={selectedEvidence.url}
                    alt={selectedEvidence.description}
                    className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                    <div className="text-center">
                      <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium">{selectedEvidence.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Archivo no visualizable en el navegador
                      </p>
                      <Button
                        className="mt-4"
                        onClick={() => handleDownload(selectedEvidence)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 