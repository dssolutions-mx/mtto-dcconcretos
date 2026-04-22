"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileText, Upload, AlertCircle, Plus, X, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { SupplierSelector } from "@/components/suppliers/SupplierSelector"
import { PurchaseOrderQuotation, CreateQuotationRequest } from "@/types/purchase-orders"
import {
  getSignedUrlForQuotationFile,
  type QuotationExtraFile,
  resolveQuotationsObjectPath,
  quotationHasFile,
} from "@/lib/quotations/quotation-file-access"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function normalizeAdditionalFiles(q: PurchaseOrderQuotation): QuotationExtraFile[] {
  const raw = q.additional_files
  if (!raw || !Array.isArray(raw)) return []
  return raw
    .map((a) => {
      const o = a as Record<string, unknown>
      const path = o.file_storage_path
      if (typeof path === "string" && path.trim()) {
        return {
          file_storage_path: path.trim(),
          file_name: typeof o.file_name === "string" ? o.file_name : null,
        }
      }
      return null
    })
    .filter((x): x is QuotationExtraFile => x !== null)
}

interface QuotationFormData {
  supplier_id?: string
  supplier_name: string
  quoted_amount: number
  delivery_days?: number
  payment_terms?: string
  validity_date?: Date
  notes?: string
  file_url?: string
  file_storage_path?: string
  file_name?: string
}

interface EnhancedQuotationUploaderProps {
  purchaseOrderId: string
  workOrderId?: string
  onQuotationAdded?: (quotation: PurchaseOrderQuotation) => void
  onQuotationRemoved?: (quotationId: string) => void
  onQuotationUpdated?: (quotation: PurchaseOrderQuotation) => void
  existingQuotations?: PurchaseOrderQuotation[]
  className?: string
  /** Compact mode: fewer fields, no nested card */
  compact?: boolean
  mode?: "create" | "edit"
  /** Required when mode is edit */
  initialQuotation?: PurchaseOrderQuotation | null
}

export function EnhancedQuotationUploader({
  purchaseOrderId,
  workOrderId,
  onQuotationAdded,
  onQuotationUpdated,
  className = "",
  compact = false,
  mode = "create",
  initialQuotation = null,
}: EnhancedQuotationUploaderProps) {
  const isEdit = mode === "edit" && initialQuotation
  const supabase = createClient()
  const [showForm, setShowForm] = useState(!!isEdit)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  const [formData, setFormData] = useState<QuotationFormData>({
    supplier_name: "",
    quoted_amount: 0,
    delivery_days: undefined,
    payment_terms: "",
    validity_date: undefined,
    notes: "",
  })

  const [formErrors, setFormErrors] = useState<string[]>([])
  /** New files to upload (create: first = primary, rest = additional; edit: all append to additional) */
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  /** Single new file that replaces the primary in edit mode (optional) */
  const [primaryReplaceFile, setPrimaryReplaceFile] = useState<File | null>(null)
  /** Existing extra attachments in edit (can remove) */
  const [extraFiles, setExtraFiles] = useState<QuotationExtraFile[]>([])
  const [primaryPreviewUrl, setPrimaryPreviewUrl] = useState<string | null>(null)
  const [extraPreviewUrls, setExtraPreviewUrls] = useState<Record<string, string>>({})

  const refreshPrimaryPreview = useCallback(async () => {
    if (!isEdit || !initialQuotation) {
      setPrimaryPreviewUrl(null)
      return
    }
    const u = await getSignedUrlForQuotationFile(supabase, {
      file_url: formData.file_url,
      file_storage_path: formData.file_storage_path,
      file_name: formData.file_name,
    })
    setPrimaryPreviewUrl(u)
  }, [isEdit, initialQuotation, supabase, formData.file_url, formData.file_storage_path, formData.file_name])

  useEffect(() => {
    if (!isEdit || !initialQuotation) return
    setFormData({
      supplier_id: initialQuotation.supplier_id,
      supplier_name: initialQuotation.supplier_name,
      quoted_amount: initialQuotation.quoted_amount,
      delivery_days: initialQuotation.delivery_days,
      payment_terms: initialQuotation.payment_terms || "",
      validity_date: initialQuotation.validity_date
        ? new Date(`${initialQuotation.validity_date}T12:00:00`)
        : undefined,
      notes: initialQuotation.notes || "",
      file_url: initialQuotation.file_url,
      file_storage_path: initialQuotation.file_storage_path ?? undefined,
      file_name: initialQuotation.file_name,
    })
    setExtraFiles(normalizeAdditionalFiles(initialQuotation))
    setPendingFiles([])
    setPrimaryReplaceFile(null)
    setShowForm(true)
  }, [isEdit, initialQuotation?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- row identity only

  useEffect(() => {
    void refreshPrimaryPreview()
  }, [refreshPrimaryPreview])

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const run = async () => {
      const next: Record<string, string> = {}
      for (const a of extraFiles) {
        const u = await getSignedUrlForQuotationFile(supabase, a)
        if (u) next[a.file_storage_path] = u
      }
      if (!cancelled) setExtraPreviewUrls(next)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [isEdit, extraFiles, supabase])

  const validateFileTypeAndSize = (file: File): string | null => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]
    if (!allowedTypes.includes(file.type)) {
      return "Solo se permiten archivos PDF, JPG, PNG o WebP"
    }
    if (file.size > 10 * 1024 * 1024) {
      return "El archivo no puede ser mayor a 10MB"
    }
    return null
  }

  const primaryResolved = (): boolean => {
    if (primaryReplaceFile) return true
    return Boolean(
      resolveQuotationsObjectPath({ file_storage_path: formData.file_storage_path, file_url: formData.file_url }) ||
        formData.file_url?.trim()
    )
  }

  const validateForm = (): boolean => {
    const errors: string[] = []

    if (!formData.supplier_name || formData.supplier_name.trim() === "") {
      errors.push("El nombre del proveedor es requerido")
    }

    if (!formData.quoted_amount || formData.quoted_amount <= 0) {
      errors.push("El monto cotizado debe ser mayor a 0")
    }

    if (!isEdit) {
      if (pendingFiles.length === 0) {
        errors.push("Debe subir al menos un archivo de cotización")
      }
    } else if (initialQuotation) {
      const hasAnyFile = primaryResolved() || extraFiles.length > 0 || pendingFiles.length > 0
      if (!hasAnyFile) {
        errors.push("Debe conservar o subir al menos un archivo de cotización")
      }
    }

    setFormErrors(errors)
    return errors.length === 0
  }

  const uploadFile = async (file: File): Promise<string> => {
    setIsUploadingFile(true)
    try {
      const folderName = workOrderId || purchaseOrderId
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const fileName = `${folderName}/${Date.now()}_${sanitizedFileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("quotations")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) throw uploadError
      if (!uploadData?.path) throw new Error("Sin ruta de archivo tras subir")

      return uploadData.path
    } finally {
      setIsUploadingFile(false)
    }
  }

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    e.target.value = ""
    if (!fileList?.length) return
    const next: File[] = []
    for (const file of Array.from(fileList)) {
      const err = validateFileTypeAndSize(file)
      if (err) {
        setFormErrors([err])
        return
      }
      next.push(file)
    }
    if (!next.length) return
    setFormErrors([])
    setPendingFiles((p) => [...p, ...next])
  }

  const handlePrimaryReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const err = validateFileTypeAndSize(file)
    if (err) {
      setFormErrors([err])
      return
    }
    setPrimaryReplaceFile(file)
    setFormErrors([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setFormErrors([])

    try {
      if (isEdit && initialQuotation) {
        let fileStoragePath = formData.file_storage_path
        let fileName = formData.file_name
        let fileUrl: string | null | undefined = formData.file_url

        if (primaryReplaceFile) {
          fileStoragePath = await uploadFile(primaryReplaceFile)
          fileName = primaryReplaceFile.name
          fileUrl = null
        }

        const uploadedExtra = await Promise.all(pendingFiles.map((f) => uploadFile(f)))
        const newExtra: QuotationExtraFile[] = pendingFiles.map((f, i) => ({
          file_storage_path: uploadedExtra[i]!,
          file_name: f.name,
        }))
        const additional_files = [...extraFiles, ...newExtra].map((a) => ({
          file_storage_path: a.file_storage_path,
          file_name: a.file_name ?? null,
        }))

        const body: Record<string, unknown> = {
          supplier_id: formData.supplier_id ?? null,
          supplier_name: formData.supplier_name,
          quoted_amount: formData.quoted_amount,
          delivery_days: formData.delivery_days ?? null,
          payment_terms: formData.payment_terms || null,
          validity_date: formData.validity_date ? format(formData.validity_date, "yyyy-MM-dd") : null,
          notes: formData.notes || null,
          additional_files,
        }
        if (fileStoragePath) {
          body.file_storage_path = fileStoragePath
          body.file_name = fileName
          body.file_url = fileUrl ?? null
        } else if (formData.file_url) {
          body.file_url = formData.file_url
          body.file_name = fileName
        }

        const response = await fetch(`/api/purchase-orders/quotations/${initialQuotation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || "Error al actualizar cotización")
        }
        const updated = result.data as PurchaseOrderQuotation
        onQuotationUpdated?.(updated)
        toast.success("Cotización actualizada")
        return
      }

      if (pendingFiles.length === 0) {
        setFormErrors(["Debe subir al menos un archivo de cotización"])
        return
      }

      const paths = await Promise.all(pendingFiles.map((f) => uploadFile(f)))
      const primaryPath = paths[0]!
      const restPaths = paths.slice(1)
      const additional = restPaths.map((path, i) => ({
        file_storage_path: path,
        file_name: pendingFiles[i + 1]!.name,
      }))

      const request: CreateQuotationRequest = {
        purchase_order_id: purchaseOrderId,
        supplier_id: formData.supplier_id,
        supplier_name: formData.supplier_name,
        quoted_amount: formData.quoted_amount,
        delivery_days: formData.delivery_days,
        payment_terms: formData.payment_terms || undefined,
        validity_date: formData.validity_date ? format(formData.validity_date, "yyyy-MM-dd") : undefined,
        notes: formData.notes || undefined,
        file_storage_path: primaryPath,
        file_url: undefined,
        file_name: pendingFiles[0]!.name,
        additional_files: additional,
      }

      const response = await fetch("/api/purchase-orders/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Error al crear cotización")
      }

      const newQuotation = result.data as PurchaseOrderQuotation
      onQuotationAdded?.(newQuotation)

      setFormData({
        supplier_name: "",
        quoted_amount: 0,
        delivery_days: undefined,
        payment_terms: "",
        validity_date: undefined,
        notes: "",
      })
      setPendingFiles([])
      setShowForm(false)

      toast.success("Cotización agregada exitosamente")
    } catch (error) {
      console.error("Error creating quotation:", error)
      const errorMessage = error instanceof Error ? error.message : "Error al crear cotización"
      setFormErrors([errorMessage])
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const showFormSection = compact || showForm || isEdit
  const fileInputAddLabel = isEdit ? "Agregar archivos" : "Archivos de cotización *"
  const manualOnlyName = !formData.supplier_id && formData.supplier_name?.trim() ? formData.supplier_name : null
  const editRegistryFallback = formData.supplier_id ? formData.supplier_name : null

  return (
    <div className={className}>
      {!compact && !isEdit && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">Agregue cotizaciones de diferentes proveedores para comparar</p>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Cotización
            </Button>
          )}
        </div>
      )}

      {showFormSection && (
        <div className={compact ? "space-y-3" : "border rounded-lg p-4 space-y-4"}>
          <form onSubmit={handleSubmit} className={compact ? "space-y-3" : "space-y-4"}>
            <div className="space-y-2">
              <Label>Proveedor *</Label>
              <SupplierSelector
                value={formData.supplier_id ?? null}
                onChange={(supplier) => {
                  setFormData((prev) => ({
                    ...prev,
                    supplier_id: supplier?.id,
                    supplier_name: supplier?.name || "",
                  }))
                }}
                initialManualName={manualOnlyName}
                registryNameFallback={editRegistryFallback}
                placeholder="Buscar proveedor o escribir nombre…"
                showPerformance={!compact}
                allowManualInput={true}
                onManualInputChange={(name) => {
                  setFormData((prev) => ({ ...prev, supplier_name: name, supplier_id: undefined }))
                }}
              />
            </div>

            <div className={compact ? "space-y-4" : "grid grid-cols-2 gap-4"}>
              <div className="space-y-2">
                <Label htmlFor="quoted_amount">Monto Cotizado *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="quoted_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quoted_amount || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, quoted_amount: parseFloat(e.target.value) || 0 }))
                    }
                    className="pl-8"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_days">Días de Entrega</Label>
                <Input
                  id="delivery_days"
                  type="number"
                  min="1"
                  value={formData.delivery_days || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, delivery_days: parseInt(e.target.value) || undefined }))}
                  placeholder="Ej: 7"
                />
              </div>
            </div>

            {!compact && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Condiciones de Pago</Label>
                  <Input
                    id="payment_terms"
                    value={formData.payment_terms || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, payment_terms: e.target.value }))}
                    placeholder="Ej: 30 días, Contado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validity_date">Vigencia de Cotización</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !formData.validity_date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.validity_date ? format(formData.validity_date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.validity_date}
                        onSelect={(date) => setFormData((prev) => ({ ...prev, validity_date: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Archivos de cotización</Label>

              {isEdit &&
                initialQuotation &&
                (primaryResolved() || extraFiles.length > 0 || quotationHasFile(initialQuotation)) && (
                <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">Archivos actuales</p>
                  {(formData.file_storage_path || formData.file_url || primaryReplaceFile) && (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {primaryReplaceFile?.name || formData.file_name || "Cotización principal"}
                        </span>
                        {primaryPreviewUrl && !primaryReplaceFile && (
                          <a
                            href={primaryPreviewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary text-xs shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Abrir
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {extraFiles.map((a) => (
                    <div key={a.file_storage_path} className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{a.file_name || a.file_storage_path.split("/").pop()}</span>
                        {extraPreviewUrls[a.file_storage_path] && (
                          <a
                            href={extraPreviewUrls[a.file_storage_path]}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary text-xs"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Abrir
                          </a>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive"
                          onClick={() => setExtraFiles((prev) => prev.filter((x) => x.file_storage_path !== a.file_storage_path))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isEdit && (
                <div className="space-y-1">
                  <Label htmlFor="quotation_primary_replace" className="text-xs text-muted-foreground">
                    Reemplazar archivo principal (opcional)
                  </Label>
                  <Input
                    id="quotation_primary_replace"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handlePrimaryReplace}
                    disabled={isUploadingFile}
                  />
                  {primaryReplaceFile && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      {primaryReplaceFile.name}
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1" onClick={() => setPrimaryReplaceFile(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="quotation_file_add" className="text-sm">
                  {isEdit ? (primaryResolved() || extraFiles.length > 0 ? "Agregar más archivos (opcional)" : fileInputAddLabel) : fileInputAddLabel}
                </Label>
                <Input
                  id="quotation_file_add"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handleAddFiles}
                  disabled={isUploadingFile}
                />
              </div>

              {pendingFiles.length > 0 && (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {pendingFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <Upload className="h-3 w-3 shrink-0" />
                        <span className="truncate">Por subir: {f.name}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!compact && (
              <div className="space-y-2">
                <Label htmlFor="quotation_notes">Notas</Label>
                <Textarea
                  id="quotation_notes"
                  value={formData.notes || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notas adicionales..."
                  rows={2}
                />
              </div>
            )}

            {formErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {formErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-2">
              {!compact && !isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setFormErrors([])
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting || isUploadingFile} className="flex-1">
                {isSubmitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Agregar"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
