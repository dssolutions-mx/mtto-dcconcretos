"use client"

import React, { useState, useRef, useCallback, useMemo } from "react"
import {
  Camera,
  Upload,
  X,
  Check,
  Plus,
  Grid3X3,
  List,
  FileText,
  AlertTriangle,
  Eye,
  Trash2,
  Images,
} from "lucide-react"
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

// VisuallyHidden component for accessibility
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span className="sr-only">{children}</span>
)

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
  context: "creation" | "completion" | "maintenance" | "checklist" | "incident" | "asset"
  workOrderId?: string
  assetId?: string
  title?: string
  description?: string
  /** Phone-first flow: no classify tab; auto category; optional captions (operators reporting incidents). */
  operatorSimple?: boolean
}

const OPERATOR_DEFAULT_CATEGORY = "evidencia_reporte"
const OPERATOR_DEFAULT_DESCRIPTION = "Foto del problema"

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
    { value: "evidencia_reporte", label: "Evidencia de reporte", icon: "📷" },
    { value: "condicion_inicial", label: "Condición Inicial", icon: "📷" },
    { value: "falla_danos", label: "Falla/Daños", icon: "💥" },
    { value: "area_afectada", label: "Área Afectada", icon: "🏭" },
    { value: "condiciones_seguridad", label: "Condiciones de Seguridad", icon: "⚠️" },
    { value: "evidencia_causa", label: "Evidencia de la Causa", icon: "🔍" },
    { value: "impacto_operacional", label: "Impacto Operacional", icon: "📊" },
    { value: "acciones_inmediatas", label: "Acciones Inmediatas", icon: "🚨" },
    { value: "estado_final", label: "Estado Final", icon: "✅" },
    { value: "documentacion_soporte", label: "Documentación de Soporte", icon: "📄" },
  ],
  asset: [
    { value: "frontal", label: "Vista Frontal", icon: "📷" },
    { value: "lateral", label: "Vista Lateral", icon: "↔️" },
    { value: "posterior", label: "Vista Posterior", icon: "🔄" },
    { value: "superior", label: "Vista Superior", icon: "⬆️" },
    { value: "motor", label: "Motor", icon: "⚙️" },
    { value: "compresor", label: "Compresor", icon: "🔧" },
    { value: "panel", label: "Panel de Control", icon: "🎛️" },
    { value: "conexiones", label: "Conexiones", icon: "🔌" },
    { value: "filtros", label: "Filtros", icon: "🚰" },
    { value: "lubricacion", label: "Sistema de Lubricación", icon: "🛢️" },
    { value: "refrigeracion", label: "Sistema de Refrigeración", icon: "❄️" },
    { value: "tablero", label: "Tablero Eléctrico", icon: "⚡" },
    { value: "placa", label: "Placa de Identificación", icon: "🏷️" },
    { value: "desgaste", label: "Desgaste/Daño", icon: "⚠️" },
    { value: "instalacion", label: "Instalación", icon: "🏗️" },
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
  description = "Suba fotografías y documentos como evidencia",
  operatorSimple = false,
}: EvidenceUploadProps) {
  const [pendingEvidence, setPendingEvidence] = useState<EvidencePhoto[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [uploading, setUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [customCategories, setCustomCategories] = useState<Array<{ value: string; label: string; icon: string }>>([])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [showAddCategory, setShowAddCategory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const isOperatorIncidentSimple = operatorSimple && context === "incident"

  const categories = [...(EVIDENCE_CATEGORIES[context] || EVIDENCE_CATEGORIES.creation), ...customCategories]

  const addCustomCategory = useCallback(() => {
    if (newCategoryName.trim() && !categories.find(cat => cat.value === newCategoryName.toLowerCase().replace(/\s+/g, '_'))) {
      const newCategory = {
        value: newCategoryName.toLowerCase().replace(/\s+/g, '_'),
        label: newCategoryName.trim(),
        icon: "📋"
      }
      setCustomCategories(prev => [...prev, newCategory])
      setNewCategoryName("")
      setShowAddCategory(false)
      
      toast({
        title: "Categoría agregada",
        description: `La categoría "${newCategory.label}" ha sido agregada exitosamente.`,
        variant: "default",
      })
    }
  }, [newCategoryName, categories])

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
          description: `${file.name.split(".")[0]}`,
          category: "",
          uploaded_at: new Date().toISOString(),
        }
      })

      setPendingEvidence((prev) => [...prev, ...newEvidence])
    }

    if (e.target) {
      e.target.value = ""
    }
  }, [])

  const handleOperatorFileAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"))
    const newEvidence = files.map((file) => {
      const preview = URL.createObjectURL(file)
      return {
        id: crypto.randomUUID(),
        file,
        url: preview,
        preview,
        description: OPERATOR_DEFAULT_DESCRIPTION,
        category: OPERATOR_DEFAULT_CATEGORY,
        uploaded_at: new Date().toISOString(),
      }
    })
    setPendingEvidence((prev) => [...prev, ...newEvidence])
    e.target.value = ""
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

  const openPreview = useCallback((imageUrl: string) => {
    setPreviewImage(imageUrl)
  }, [])

  const closePreview = useCallback(() => {
    setPreviewImage(null)
  }, [])

  const uploadToSupabase = useCallback(
    async (evidenceItem: EvidencePhoto): Promise<EvidencePhoto> => {
      if (!evidenceItem.file) {
        throw new Error("No file to upload")
      }

      const bucket =
        context === "checklist"
          ? "checklist-photos"
          : context === "incident"
            ? "incident-evidence"
            : context === "asset"
              ? "asset-photos"
              : "work-order-evidence"

      const formData = new FormData()
      formData.append("file", evidenceItem.file)
      formData.append("bucket", bucket)

      try {
        const res = await fetch("/api/storage/upload", {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string })?.error || "Upload failed")
        }

        const data = await res.json()
        return {
          ...evidenceItem,
          url: data.url,
          bucket_path: data.path,
          file: undefined,
        }
      } catch (serverError: unknown) {
        console.warn("Server upload failed, falling back to client storage upload:", serverError)

        const supabase = createClient()
        const fileExt = evidenceItem.file.name.split(".").pop()
        const fileName = `${context}_${workOrderId || assetId || "general"}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${fileExt}`

        const { error } = await supabase.storage.from(bucket).upload(fileName, evidenceItem.file, {
          cacheControl: "3600",
          upsert: true,
        })

        if (error) {
          console.error("Client storage upload failed:", error)
          throw new Error(error.message || "Upload failed")
        }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName)

        return {
          ...evidenceItem,
          url: urlData.publicUrl,
          bucket_path: fileName,
          file: undefined,
        }
      }
    },
    [context, workOrderId, assetId]
  )

  const handleSaveEvidence = useCallback(async () => {
    if (isOperatorIncidentSimple) {
      if (pendingEvidence.length === 0) {
        onOpenChange(false)
        return
      }
      const normalized = pendingEvidence
        .filter((item) => item.file)
        .map((item) => ({
          ...item,
          description: item.description.trim() || OPERATOR_DEFAULT_DESCRIPTION,
          category: item.category || OPERATOR_DEFAULT_CATEGORY,
        }))
      if (normalized.length === 0) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No hay fotos para subir",
        })
        return
      }
      try {
        setUploading(true)
        const uploadedEvidence = await Promise.all(normalized.map((item) => uploadToSupabase(item)))
        setEvidence([...evidence, ...uploadedEvidence])
        setPendingEvidence([])
        onOpenChange(false)
        toast({
          title: "Listo",
          description:
            uploadedEvidence.length === 1
              ? "La foto se agregó a tu reporte."
              : `${uploadedEvidence.length} fotos agregadas a tu reporte.`,
        })
      } catch (error: unknown) {
        console.error("Error uploading evidence:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: `Error al subir: ${error instanceof Error ? error.message : "Intenta de nuevo"}`,
        })
      } finally {
        setUploading(false)
      }
      return
    }

    const validEvidence = pendingEvidence.filter(
      (item) => item.description.trim() && item.category
    )

    if (validEvidence.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Todas las evidencias deben tener descripción y categoría",
      })
      return
    }

    try {
      setUploading(true)

      // For asset context, don't upload to Supabase, just save locally
      if (context === "asset") {
        setEvidence([...evidence, ...validEvidence])
        setPendingEvidence([])
        onOpenChange(false)

        toast({
          title: "Éxito",
          description: `${validEvidence.length} evidencia(s) agregada(s) correctamente`,
        })
        return
      }

      // For other contexts, upload all evidence to Supabase
      const uploadedEvidence = await Promise.all(validEvidence.map((item) => uploadToSupabase(item)))

      setEvidence([...evidence, ...uploadedEvidence])
      setPendingEvidence([])
      onOpenChange(false)

      toast({
        title: "Éxito",
        description: `${uploadedEvidence.length} evidencia(s) subida(s) correctamente`,
      })
    } catch (error: unknown) {
      console.error("Error uploading evidence:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: `Error al subir evidencias: ${error instanceof Error ? error.message : "Error"}`,
      })
    } finally {
      setUploading(false)
    }
  }, [
    pendingEvidence,
    evidence,
    setEvidence,
    onOpenChange,
    context,
    isOperatorIncidentSimple,
    uploadToSupabase,
  ])

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

  const canSave = useMemo(() => {
    if (isOperatorIncidentSimple) {
      return pendingEvidence.length > 0
    }
    return (
      pendingEvidence.length > 0 &&
      pendingEvidence.every((item) => item.description.trim() && item.category)
    )
  }, [pendingEvidence, isOperatorIncidentSimple])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh]",
          isOperatorIncidentSimple ? "max-w-lg sm:max-w-lg" : "max-w-4xl"
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isOperatorIncidentSimple ? (
          <div className="my-2 max-h-[min(70vh,520px)] space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="default"
                className="min-h-[52px] w-full gap-2 text-base"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-5 w-5 shrink-0" />
                Tomar foto
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[52px] w-full gap-2 text-base"
                onClick={() => galleryInputRef.current?.click()}
              >
                <Images className="h-5 w-5 shrink-0" />
                Elegir fotos
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleOperatorFileAdd}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleOperatorFileAdd}
              />
            </div>

            {pendingEvidence.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Fotos ({pendingEvidence.length})
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {pendingEvidence.map((item, index) => {
                    const src = item.preview || item.url
                    return (
                      <div key={item.id} className="space-y-1.5">
                        <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                          <button
                            type="button"
                            className="absolute inset-0"
                            onClick={() => openPreview(src)}
                            aria-label="Ver foto grande"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          </button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute right-1 top-1 h-8 w-8"
                            onClick={() => removeEvidence(index)}
                            aria-label="Quitar foto"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Nota (opcional)"
                          className="text-sm"
                          value={
                            item.description === OPERATOR_DEFAULT_DESCRIPTION ? "" : item.description
                          }
                          onChange={(e) => {
                            const v = e.target.value
                            updateEvidenceDescription(
                              index,
                              v === "" ? OPERATOR_DEFAULT_DESCRIPTION : v
                            )
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
        <div className="my-4" style={{ height: "calc(80vh - 200px)", overflowY: "auto" }}>
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
                      onRemove={removeEvidence}
                      onPreview={openPreview}
                      setShowAddCategory={setShowAddCategory}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        )}

        <DialogFooter>
          {isOperatorIncidentSimple ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-[48px] w-full sm:w-auto"
                onClick={handleClose}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-[48px] w-full sm:min-w-[180px]"
                onClick={() => void handleSaveEvidence()}
                disabled={uploading}
              >
                {uploading
                  ? "Subiendo…"
                  : pendingEvidence.length > 0
                    ? "Agregar al reporte"
                    : "Listo"}
              </Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {pendingEvidence.filter((e) => e.category && e.description.trim()).length} de{" "}
                {pendingEvidence.length} clasificados
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} disabled={uploading}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleSaveEvidence()} disabled={!canSave || uploading}>
                  {uploading ? "Subiendo..." : "Guardar Evidencia"}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Image Preview Modal */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={closePreview}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 bg-black/90">
            <VisuallyHidden>
              <DialogTitle>Vista previa de evidencia</DialogTitle>
            </VisuallyHidden>
            <VisuallyHidden>
              <DialogDescription>Imagen ampliada en un modal de vista previa</DialogDescription>
            </VisuallyHidden>
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
              <Button
                variant="secondary"
                size="lg"
                className="absolute top-4 right-4 bg-white/90 hover:bg-white"
                onClick={closePreview}
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                Haz clic fuera de la imagen o presiona el botón X para cerrar
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Custom Category Creation Modal */}
      {showAddCategory && (
        <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Agregar Categoría Personalizada
              </DialogTitle>
              <DialogDescription>
                Crea una nueva categoría para clasificar tu evidencia
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-category-name">Nombre de la categoría</Label>
                <Input
                  id="new-category-name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ej: Inspección de válvulas"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomCategory()
                    }
                  }}
                />
              </div>
              
              {newCategoryName.trim() && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Vista previa:</p>
                  <div className="flex items-center gap-2">
                    <span>📋</span>
                    <span className="font-medium">{newCategoryName.trim()}</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddCategory(false)
                  setNewCategoryName("")
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={addCustomCategory}
                disabled={!newCategoryName.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Categoría
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
  onRemove,
  onPreview,
  setShowAddCategory,
}: {
  evidence: EvidencePhoto
  index: number
  categories: Array<{ value: string; label: string; icon: string }>
  updateEvidenceCategory: (index: number, category: string) => void
  updateEvidenceDescription: (index: number, description: string) => void
  getCategoryInfo: (categoryValue: string) => { value: string; label: string; icon: string }
  onRemove: (index: number) => void
  onPreview: (imageUrl: string) => void
  setShowAddCategory: (show: boolean) => void
}) {
  const isImage = evidence.file?.type.startsWith('image/') || false
  const categoryInfo = evidence.category ? getCategoryInfo(evidence.category) : null

  return (
    <Card className="relative">
      <CardContent className="p-4">
        {/* Delete button - Top right of entire card */}
        <Button
          variant="destructive"
          size="sm"
          className="absolute top-2 right-2 h-8 w-8 p-0 z-10 shadow-lg"
          onClick={() => onRemove(index)}
          title="Eliminar evidencia"
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Preview */}
          <div className="relative">
            <div 
              className={cn(
                "aspect-square bg-muted rounded-lg overflow-hidden transition-all duration-200",
                isImage ? "cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-lg" : ""
              )}
              onClick={() => isImage && onPreview(evidence.preview || evidence.url)}
              title={isImage ? "Haz clic para ver en grande" : ""}
            >
              {isImage ? (
                <div className="relative w-full h-full group">
                  <img
                    src={evidence.preview || evidence.url}
                    alt={evidence.description}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                    <div className="bg-white/90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Eye className="h-6 w-6 text-gray-800" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Clic para ampliar
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-xs text-center text-muted-foreground">{evidence.file?.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Classification */}
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`category-${index}`}>Categoría</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddCategory(true)}
                    className="h-6 px-2 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Nueva
                  </Button>
                </div>
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

            {/* Status indicator and actions */}
            <div className="flex items-center justify-between">
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
              
              <div className="flex gap-2">
                {isImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPreview(evidence.preview || evidence.url)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Vista Previa
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRemove(index)}
                  className="flex items-center gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}) 