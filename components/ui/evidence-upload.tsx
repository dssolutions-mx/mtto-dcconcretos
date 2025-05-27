"use client"

import React, { useState, useRef, useCallback, useMemo } from "react"
import { Camera, Upload, X, Check, Plus, Grid3X3, List, FileText, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { toast } from "@/components/ui/use-toast"

export interface EvidencePhoto {
  id: string
  file?: File
  url: string
  preview?: string
  description: string
  category: string
  uploaded_at: string
  bucket_path?: string
}

interface EvidenceUploadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evidence: EvidencePhoto[]
  setEvidence: (evidence: EvidencePhoto[]) => void
  context: "creation" | "completion" | "maintenance" | "checklist" | "incident"
  workOrderId?: string
  assetId?: string
  title?: string
  description?: string
}

const EVIDENCE_CATEGORIES = {
  creation: [
    { value: "identificacion_problema", label: "Identificación del Problema", icon: "🔍" },
    { value: "estado_equipo", label: "Estado del Equipo", icon: "⚙️" },
    { value: "preocupaciones_seguridad", label: "Preocupaciones de Seguridad", icon: "⚠️" },
    { value: "area_trabajo_antes", label: "Área de Trabajo - Antes", icon: "📍" },
    { value: "herramientas_materiales", label: "Herramientas y Materiales", icon: "🔧" },
    { value: "documentacion", label: "Documentación", icon: "📄" },
  ],
  completion: [
    { value: "trabajo_completado", label: "Trabajo Completado", icon: "✅" },
    { value: "partes_reemplazadas", label: "Partes Reemplazadas", icon: "🔄" },
    { value: "area_trabajo_despues", label: "Área de Trabajo - Después", icon: "📍" },
    { value: "equipo_funcionamiento", label: "Equipo en Funcionamiento", icon: "▶️" },
    { value: "control_calidad", label: "Control de Calidad", icon: "🔍" },
    { value: "limpieza_final", label: "Limpieza Final", icon: "🧹" },
    { value: "recibos_facturas", label: "Recibos/Facturas", icon: "🧾" },
  ],
  maintenance: [
    { value: "antes_mantenimiento", label: "Antes del Mantenimiento", icon: "📷" },
    { value: "durante_proceso", label: "Durante el Proceso", icon: "⚙️" },
    { value: "inspeccion_partes", label: "Inspección de Partes", icon: "🔍" },
    { value: "mediciones", label: "Mediciones", icon: "📏" },
    { value: "lubricacion", label: "Lubricación", icon: "🛢️" },
    { value: "calibracion", label: "Calibración", icon: "⚖️" },
  ],
  checklist: [
    { value: "problema_cumplimiento", label: "Problema de Cumplimiento", icon: "❌" },
    { value: "elemento_marcado", label: "Elemento Marcado", icon: "🚩" },
    { value: "desgaste_dano", label: "Desgaste/Daño", icon: "⚠️" },
    { value: "lectura_medicion", label: "Lectura/Medición", icon: "📊" },
    { value: "violacion_seguridad", label: "Violación de Seguridad", icon: "🚨" },
    { value: "accion_correctiva", label: "Acción Correctiva", icon: "🔧" },
  ],
  incident: [
    { value: "condicion_inicial", label: "Condición Inicial", icon: "📷" },
    { value: "falla_danos", label: "Falla/Daños", icon: "💥" },
    { value: "area_afectada", label: "Área Afectada", icon: "🏭" },
    { value: "condiciones_seguridad", label: "Condiciones de Seguridad", icon: "⚠️" },
    { value: "evidencia_causa", label: "Evidencia de la Causa", icon: "🔍" },
    { value: "impacto_operacional", label: "Impacto Operacional", icon: "📊" },
    { value: "acciones_inmediatas", label: "Acciones Inmediatas", icon: "🚨" },
    { value: "estado_final", label: "Estado Final", icon: "✅" },
    { value: "documentacion_soporte", label: "Documentación de Soporte", icon: "📄" },
  ]
}

export function EvidenceUpload({
  open,
  onOpenChange,
  evidence,
  setEvidence,
  context,
  workOrderId,
  assetId,
  title = "Gestión de Evidencia",
  description = "Suba fotografías y documentos como evidencia"
}: EvidenceUploadProps) {
  const [pendingEvidence, setPendingEvidence] = useState<EvidencePhoto[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categories = EVIDENCE_CATEGORIES[context] || EVIDENCE_CATEGORIES.creation

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      
      const newEvidence = files.map((file) => {
        const preview = URL.createObjectURL(file)
        
        return {
          id: crypto.randomUUID(),
          file,
          url: preview,
          preview,
          description: `${file.name.split('.')[0]}`,
          category: "",
          uploaded_at: new Date().toISOString(),
        }
      })
      
      setPendingEvidence(prev => [...prev, ...newEvidence])
    }
    
    if (e.target) {
      e.target.value = ""
    }
  }, [])

  const updateEvidenceCategory = useCallback((index: number, category: string) => {
    setPendingEvidence(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], category }
      return updated
    })
  }, [])

  const updateEvidenceDescription = useCallback((index: number, description: string) => {
    setPendingEvidence(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], description }
      return updated
    })
  }, [])

  const removeEvidence = useCallback((index: number) => {
    setPendingEvidence(prev => {
      const toRemove = prev[index]
      if (toRemove.preview) {
        URL.revokeObjectURL(toRemove.preview)
      }
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const uploadToSupabase = async (evidenceItem: EvidencePhoto): Promise<EvidencePhoto> => {
    if (!evidenceItem.file) {
      throw new Error("No file to upload")
    }

    const supabase = createClient()
    
    // Determine bucket based on context
    const bucket = context === "checklist" 
      ? "checklist-photos" 
      : context === "incident" 
        ? "incident-evidence" 
        : "work-order-evidence"
    
    // Create unique filename
    const fileExt = evidenceItem.file.name.split('.').pop()
    const fileName = `${context}_${workOrderId || assetId || 'general'}_${evidenceItem.id}.${fileExt}`
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, evidenceItem.file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName)

    return {
      ...evidenceItem,
      url: urlData.publicUrl,
      bucket_path: fileName,
      file: undefined // Remove file reference after upload
    }
  }

  const handleSaveEvidence = useCallback(async () => {
    const validEvidence = pendingEvidence.filter(item => 
      item.description.trim() && item.category
    )
    
    if (validEvidence.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Todas las evidencias deben tener descripción y categoría"
      })
      return
    }

    try {
      setUploading(true)
      
      // Upload all evidence to Supabase
      const uploadedEvidence = await Promise.all(
        validEvidence.map(item => uploadToSupabase(item))
      )

      setEvidence([...evidence, ...uploadedEvidence])
      setPendingEvidence([])
      onOpenChange(false)
      
      toast({
        title: "Éxito",
        description: `${uploadedEvidence.length} evidencia(s) subida(s) correctamente`
      })
    } catch (error: any) {
      console.error("Error uploading evidence:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error al subir evidencias: ${error.message}`
      })
    } finally {
      setUploading(false)
    }
  }, [pendingEvidence, evidence, setEvidence, onOpenChange, workOrderId, assetId, context])

  const handleClose = useCallback(() => {
    // Clean up preview URLs
    pendingEvidence.forEach(item => {
      if (item.preview) {
        URL.revokeObjectURL(item.preview)
      }
    })
    setPendingEvidence([])
    onOpenChange(false)
  }, [pendingEvidence, onOpenChange])

  const getCategoryInfo = useCallback((categoryValue: string) => {
    const category = categories.find(c => c.value === categoryValue)
    return category || { value: categoryValue, label: categoryValue, icon: "📋" }
  }, [categories])

  const canSave = useMemo(() => 
    pendingEvidence.length > 0 && 
    pendingEvidence.every(item => item.description.trim() && item.category), 
    [pendingEvidence])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4" style={{ height: 'calc(80vh - 200px)', overflowY: 'auto' }}>
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Subir Evidencia</TabsTrigger>
              <TabsTrigger value="classify">
                Clasificar ({pendingEvidence.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4 space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Subir Evidencia</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fotografías, documentos, recibos o cualquier evidencia relevante
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Seleccionar Archivos
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {pendingEvidence.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Archivos Seleccionados ({pendingEvidence.length})
                    </h4>
                    <div className="flex gap-1">
                      <Button
                        variant={viewMode === "grid" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className={cn(
                    viewMode === "grid" 
                      ? "grid grid-cols-2 md:grid-cols-3 gap-4" 
                      : "space-y-2"
                  )}>
                    {pendingEvidence.map((item, index) => (
                      <EvidencePreview
                        key={item.id}
                        evidence={item}
                        index={index}
                        viewMode={viewMode}
                        onRemove={removeEvidence}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="classify" className="mt-4 space-y-4">
              {pendingEvidence.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No hay archivos para clasificar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingEvidence.map((item, index) => (
                    <EvidenceClassificationCard
                      key={item.id}
                      evidence={item}
                      index={index}
                      categories={categories}
                      updateEvidenceCategory={updateEvidenceCategory}
                      updateEvidenceDescription={updateEvidenceDescription}
                      getCategoryInfo={getCategoryInfo}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {pendingEvidence.filter(e => e.category && e.description.trim()).length} de {pendingEvidence.length} clasificados
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEvidence}
                disabled={!canSave || uploading}
              >
                {uploading ? "Subiendo..." : "Guardar Evidencia"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const EvidencePreview = React.memo(function EvidencePreview({ 
  evidence, 
  index, 
  viewMode, 
  onRemove 
}: {
  evidence: EvidencePhoto
  index: number
  viewMode: "grid" | "list"
  onRemove: (index: number) => void
}) {
  const isImage = evidence.file?.type.startsWith('image/') || false

  if (viewMode === "grid") {
    return (
      <Card className="relative">
        <CardContent className="p-2">
          <div className="aspect-square relative bg-muted rounded-md overflow-hidden">
            {isImage ? (
              <img
                src={evidence.preview || evidence.url}
                alt={evidence.description}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="text-xs mt-2 truncate">{evidence.description || evidence.file?.name}</p>
          <Button
            variant="destructive"
            size="sm"
            className="absolute top-1 right-1 h-6 w-6 p-0"
            onClick={() => onRemove(index)}
          >
            <X className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex items-center gap-3 p-2 border rounded-lg">
      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
        {isImage ? (
          <img
            src={evidence.preview || evidence.url}
            alt={evidence.description}
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <FileText className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{evidence.description || evidence.file?.name}</p>
        <p className="text-xs text-muted-foreground">
          {evidence.file?.size ? `${(evidence.file.size / 1024 / 1024).toFixed(2)} MB` : ''}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onRemove(index)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
})

const EvidenceClassificationCard = React.memo(function EvidenceClassificationCard({
  evidence,
  index,
  categories,
  updateEvidenceCategory,
  updateEvidenceDescription,
  getCategoryInfo,
}: {
  evidence: EvidencePhoto
  index: number
  categories: Array<{ value: string; label: string; icon: string }>
  updateEvidenceCategory: (index: number, category: string) => void
  updateEvidenceDescription: (index: number, description: string) => void
  getCategoryInfo: (categoryValue: string) => { value: string; label: string; icon: string }
}) {
  const isImage = evidence.file?.type.startsWith('image/') || false
  const categoryInfo = evidence.category ? getCategoryInfo(evidence.category) : null

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Preview */}
          <div className="aspect-square bg-muted rounded-lg overflow-hidden">
            {isImage ? (
              <img
                src={evidence.preview || evidence.url}
                alt={evidence.description}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <p className="text-xs text-center mt-2">{evidence.file?.name}</p>
              </div>
            )}
          </div>

          {/* Classification */}
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`category-${index}`}>Categoría</Label>
                <Select
                  value={evidence.category}
                  onValueChange={(value) => updateEvidenceCategory(index, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center gap-2">
                          <span>{category.icon}</span>
                          <span>{category.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoryInfo && (
                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                    <span>{categoryInfo.icon}</span>
                    <span>{categoryInfo.label}</span>
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`description-${index}`}>Descripción</Label>
                <Textarea
                  id={`description-${index}`}
                  value={evidence.description}
                  onChange={(e) => updateEvidenceDescription(index, e.target.value)}
                  placeholder="Describe la evidencia..."
                  className="min-h-[80px]"
                />
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              {evidence.category && evidence.description.trim() ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Listo para subir
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Falta información
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}) 