"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FileText, X, Upload, AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { SupplierSelector } from "@/components/suppliers/SupplierSelector"
import { Supplier } from "@/types/suppliers"
import { PurchaseOrderQuotation, CreateQuotationRequest } from "@/types/purchase-orders"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuotationFormData {
  supplier_id?: string
  supplier_name: string
  quoted_amount: number
  delivery_days?: number
  payment_terms?: string
  validity_date?: Date
  notes?: string
  file?: File
  file_url?: string
  file_name?: string
}

interface EnhancedQuotationUploaderProps {
  purchaseOrderId: string
  workOrderId?: string
  onQuotationAdded?: (quotation: PurchaseOrderQuotation) => void
  onQuotationRemoved?: (quotationId: string) => void
  existingQuotations?: PurchaseOrderQuotation[]
  className?: string
  /** Compact mode: fewer fields, no nested card */
  compact?: boolean
}

export function EnhancedQuotationUploader({
  purchaseOrderId,
  workOrderId,
  onQuotationAdded,
  onQuotationRemoved,
  existingQuotations = [],
  className = "",
  compact = false
}: EnhancedQuotationUploaderProps) {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  
  const [formData, setFormData] = useState<QuotationFormData>({
    supplier_name: "",
    quoted_amount: 0,
    delivery_days: undefined,
    payment_terms: "",
    validity_date: undefined,
    notes: ""
  })
  
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])

  const validateForm = (): boolean => {
    const errors: string[] = []
    
    if (!formData.supplier_name || formData.supplier_name.trim() === '') {
      errors.push('El nombre del proveedor es requerido')
    }
    
    if (!formData.quoted_amount || formData.quoted_amount <= 0) {
      errors.push('El monto cotizado debe ser mayor a 0')
    }
    
    if (!formData.file && !formData.file_url) {
      errors.push('Debe subir un archivo de cotización')
    }
    
    setFormErrors(errors)
    return errors.length === 0
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        setFormErrors(['Solo se permiten archivos PDF, JPG, PNG o WebP'])
        return
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setFormErrors(['El archivo no puede ser mayor a 10MB'])
        return
      }
      
      setFormData(prev => ({ ...prev, file, file_name: file.name }))
      setFormErrors([])
    }
  }

  const uploadFile = async (file: File): Promise<string> => {
    setIsUploadingFile(true)
    try {
      const folderName = workOrderId || purchaseOrderId
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `${folderName}/${Date.now()}_${sanitizedFileName}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('quotations')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (uploadError) throw uploadError
      
      // Create signed URL
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('quotations')
        .createSignedUrl(uploadData.path, 3600 * 24 * 7) // 7 days
      
      if (urlError) throw urlError
      
      return signedUrlData?.signedUrl || ''
    } finally {
      setIsUploadingFile(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    setFormErrors([])
    
    try {
      let fileUrl = formData.file_url
      
      // Upload file if provided
      if (formData.file && !fileUrl) {
        fileUrl = await uploadFile(formData.file)
      }
      
      // Create quotation request
      const request: CreateQuotationRequest = {
        purchase_order_id: purchaseOrderId,
        supplier_id: selectedSupplier?.id,
        supplier_name: formData.supplier_name,
        quoted_amount: formData.quoted_amount,
        delivery_days: formData.delivery_days,
        payment_terms: formData.payment_terms || undefined,
        validity_date: formData.validity_date ? format(formData.validity_date, 'yyyy-MM-dd') : undefined,
        notes: formData.notes || undefined,
        file_url: fileUrl,
        file_name: formData.file_name
      }
      
      // Call API to create quotation
      const response = await fetch('/api/purchase-orders/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Error al crear cotización')
      }
      
      const newQuotation = result.data as PurchaseOrderQuotation
      onQuotationAdded?.(newQuotation)
      
      // Reset form
      setFormData({
        supplier_name: "",
        quoted_amount: 0,
        delivery_days: undefined,
        payment_terms: "",
        validity_date: undefined,
        notes: ""
      })
      setSelectedSupplier(null)
      setShowForm(false)
      
      toast.success('Cotización agregada exitosamente')
    } catch (error) {
      console.error('Error creating quotation:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error al crear cotización'
      setFormErrors([errorMessage])
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const showFormSection = compact || showForm

  return (
    <div className={className}>
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Agregue cotizaciones de diferentes proveedores para comparar
          </p>
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
                value={selectedSupplier?.id}
                onChange={(supplier) => {
                  setSelectedSupplier(supplier)
                  setFormData(prev => ({
                    ...prev,
                    supplier_id: supplier?.id,
                    supplier_name: supplier?.name || ''
                  }))
                }}
                placeholder="Buscar proveedor o escribir nombre..."
                showPerformance={!compact}
                allowManualInput={true}
                onManualInputChange={(name) => {
                  setFormData(prev => ({ ...prev, supplier_name: name }))
                  setSelectedSupplier(null)
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
                          value={formData.quoted_amount || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, quoted_amount: parseFloat(e.target.value) || 0 }))}
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
                  value={formData.delivery_days || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_days: parseInt(e.target.value) || undefined }))}
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
                    value={formData.payment_terms || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                    placeholder="Ej: 30 días, Contado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validity_date">Vigencia de Cotización</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.validity_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.validity_date ? (
                          format(formData.validity_date, "PPP", { locale: es })
                        ) : (
                          <span>Seleccionar fecha</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.validity_date}
                        onSelect={(date) => setFormData(prev => ({ ...prev, validity_date: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quotation_file">Archivo de Cotización *</Label>
              <Input
                id="quotation_file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                disabled={isUploadingFile}
              />
              {formData.file && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{formData.file.name}</span>
                </div>
              )}
            </div>

            {!compact && (
              <div className="space-y-2">
                <Label htmlFor="quotation_notes">Notas</Label>
                <Textarea
                  id="quotation_notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
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
              {!compact && (
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
              <Button
                type="submit"
                disabled={isSubmitting || isUploadingFile}
                className="flex-1"
              >
                {isSubmitting ? 'Guardando...' : 'Agregar'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
