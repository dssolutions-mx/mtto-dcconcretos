"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react"
import { SupplierSelector } from "@/components/suppliers/SupplierSelector"
import { Supplier } from "@/types/suppliers"
import { toast } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { PartAutocomplete, PartSuggestion } from "@/components/inventory/part-autocomplete"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface QuotationItem {
  item_index?: number
  part_number?: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
  brand?: string
  notes?: string
}

interface QuotationFormData {
  supplier_id?: string
  supplier_name: string
  quoted_amount: number
  quotation_items: QuotationItem[]  // Item-level pricing - REQUIRED
  delivery_days?: number
  payment_terms?: string
  validity_date?: Date
  notes?: string
  file?: File
  file_url?: string
  file_name?: string
}

interface QuotationFormForCreationProps {
  quotations: QuotationFormData[]
  onQuotationsChange: (quotations: QuotationFormData[]) => void
  workOrderId?: string
  className?: string
}

export function QuotationFormForCreation({
  quotations,
  onQuotationsChange,
  workOrderId,
  className = ""
}: QuotationFormForCreationProps) {
  const [showForm, setShowForm] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])
  
  const [formData, setFormData] = useState<QuotationFormData>({
    supplier_name: "",
    quoted_amount: 0,
    quotation_items: [],
    delivery_days: undefined,
    payment_terms: "",
    validity_date: undefined,
    notes: ""
  })
  
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  
  // Item management for quotation
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([])
  const [newQuotationItem, setNewQuotationItem] = useState<Partial<QuotationItem>>({
    description: "",
    part_number: "",
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    brand: ""
  })

  // Item management functions
  const handlePartSelect = (part: PartSuggestion | null) => {
    if (part) {
      setNewQuotationItem(prev => ({
        ...prev,
        description: part.name,
        part_number: part.part_number,
        unit_price: part.default_unit_cost || prev.unit_price || 0,
        total_price: (part.default_unit_cost || prev.unit_price || 0) * (prev.quantity || 1)
      }))
    }
  }

  const handleNewItemChange = (field: string, value: any) => {
    setNewQuotationItem(prev => {
      const updated = { ...prev, [field]: value }
      
      // Auto-calculate total price
      if (field === 'quantity' || field === 'unit_price') {
        const quantity = field === 'quantity' ? Number(value) || 0 : Number(prev.quantity) || 0
        const unitPrice = field === 'unit_price' ? Number(value) || 0 : Number(prev.unit_price) || 0
        updated.total_price = quantity * unitPrice
      }
      
      return updated
    })
  }

  const addQuotationItem = () => {
    if (!newQuotationItem.description || !newQuotationItem.quantity || !newQuotationItem.unit_price) {
      setFormErrors(['Descripción, cantidad y precio unitario son requeridos para cada artículo'])
      return
    }

    const item: QuotationItem = {
      description: newQuotationItem.description!,
      part_number: newQuotationItem.part_number,
      quantity: Number(newQuotationItem.quantity) || 1,
      unit_price: Number(newQuotationItem.unit_price) || 0,
      total_price: Number(newQuotationItem.total_price) || 0,
      brand: newQuotationItem.brand,
      notes: newQuotationItem.notes
    }

    setQuotationItems([...quotationItems, item])
    
    // Recalculate total amount
    const newTotal = quotationItems.reduce((sum, i) => sum + i.total_price, 0) + item.total_price
    setFormData(prev => ({ ...prev, quoted_amount: newTotal }))
    
    // Reset new item form
    setNewQuotationItem({
      description: "",
      part_number: "",
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      brand: ""
    })
    setFormErrors([])
  }

  const removeQuotationItem = (index: number) => {
    const removed = quotationItems[index]
    const updated = quotationItems.filter((_, i) => i !== index)
    setQuotationItems(updated)
    
    // Recalculate total amount
    const newTotal = updated.reduce((sum, i) => sum + i.total_price, 0)
    setFormData(prev => ({ ...prev, quoted_amount: newTotal }))
  }

  const validateForm = (): boolean => {
    const errors: string[] = []
    
    if (!formData.supplier_name || formData.supplier_name.trim() === '') {
      errors.push('El nombre del proveedor es requerido')
    }
    
    if (quotationItems.length === 0) {
      errors.push('Debe agregar al menos un artículo a la cotización')
    }
    
    if (!formData.quoted_amount || formData.quoted_amount <= 0) {
      errors.push('El monto cotizado debe ser mayor a 0')
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

  const handleAddQuotation = () => {
    if (!validateForm()) {
      return
    }
    
    // Add quotation to list with its items
    const newQuotation: QuotationFormData = { 
      ...formData,
      quotation_items: quotationItems
    }
    onQuotationsChange([...quotations, newQuotation])
    
    // Reset form
    setFormData({
      supplier_name: "",
      quoted_amount: 0,
      quotation_items: [],
      delivery_days: undefined,
      payment_terms: "",
      validity_date: undefined,
      notes: ""
    })
    setQuotationItems([])
    setNewQuotationItem({
      description: "",
      part_number: "",
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      brand: ""
    })
    setSelectedSupplier(null)
    setShowForm(false)
    setFormErrors([])
    
    toast.success('Cotización agregada')
  }

  const handleRemoveQuotation = (index: number) => {
    const updated = quotations.filter((_, i) => i !== index)
    onQuotationsChange(updated)
    toast.success('Cotización eliminada')
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Cotizaciones de Proveedores</span>
              </CardTitle>
              <CardDescription>
                Agregue cotizaciones de diferentes proveedores para comparar precios y condiciones
              </CardDescription>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Cotización
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Quotations List */}
          {quotations.length > 0 && (
            <div className="space-y-2">
              <Label>Cotizaciones Agregadas ({quotations.length})</Label>
              {quotations.map((quotation, index) => (
                <div key={index} className="p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium">{quotation.supplier_name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Monto: ${quotation.quoted_amount.toLocaleString('es-MX')}</div>
                        {quotation.quotation_items && quotation.quotation_items.length > 0 && (
                          <div className="text-xs">
                            {quotation.quotation_items.length} {quotation.quotation_items.length === 1 ? 'item' : 'items'} con precios
                          </div>
                        )}
                        {quotation.delivery_days && (
                          <div>Entrega: {quotation.delivery_days} días</div>
                        )}
                        {quotation.payment_terms && (
                          <div>Condiciones: {quotation.payment_terms}</div>
                        )}
                        {quotation.file_name && (
                          <div className="flex items-center space-x-1">
                            <FileText className="h-3 w-3" />
                            <span>{quotation.file_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveQuotation(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Quotation Form */}
          {showForm && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Nueva Cotización</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Supplier Selection */}
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
                      showPerformance={true}
                      allowManualInput={true}
                      onManualInputChange={(name) => {
                        setFormData(prev => ({ ...prev, supplier_name: name }))
                        setSelectedSupplier(null)
                      }}
                    />
                  </div>

                  {/* Quotation Items Section */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Artículos de la Cotización *</Label>
                      <Badge variant="outline">{quotationItems.length} {quotationItems.length === 1 ? 'artículo' : 'artículos'}</Badge>
                    </div>
                    
                    {/* Items List */}
                    {quotationItems.length > 0 && (
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Descripción</TableHead>
                              <TableHead className="w-24">Cantidad</TableHead>
                              <TableHead className="w-32">Precio Unit.</TableHead>
                              <TableHead className="w-32">Total</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {quotationItems.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{item.description}</div>
                                    {item.part_number && (
                                      <div className="text-xs text-muted-foreground">Parte: {item.part_number}</div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>${item.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="font-medium">${item.total_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeQuotationItem(idx)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Add Item Form */}
                    <Card className="border-dashed">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Agregar Artículo</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <Label>Buscar Parte del Catálogo *</Label>
                            <PartAutocomplete
                              value={newQuotationItem.description || ""}
                              onSelect={handlePartSelect}
                              placeholder="Buscar por nombre o número de parte..."
                              showPartNumber={true}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Busca en el catálogo de inventario o escribe manualmente
                            </p>
                          </div>
                          
                          <div className="hidden">
                            <Label htmlFor="new-item-part-number">Número de Parte</Label>
                            <Input
                              id="new-item-part-number"
                              value={newQuotationItem.part_number || ""}
                              onChange={(e) => handleNewItemChange('part_number', e.target.value)}
                              placeholder="Número de parte"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="new-item-quantity">Cantidad *</Label>
                            <Input
                              id="new-item-quantity"
                              type="number"
                              min="1"
                              value={newQuotationItem.quantity || ""}
                              onChange={(e) => handleNewItemChange('quantity', e.target.value)}
                              placeholder="1"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="new-item-unit-price">Precio Unitario *</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">$</span>
                              <Input
                                id="new-item-unit-price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={newQuotationItem.unit_price || ""}
                                onChange={(e) => handleNewItemChange('unit_price', e.target.value)}
                                className="pl-8"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="new-item-brand">Marca</Label>
                            <Input
                              id="new-item-brand"
                              value={newQuotationItem.brand || ""}
                              onChange={(e) => handleNewItemChange('brand', e.target.value)}
                              placeholder="Opcional"
                            />
                          </div>
                          
                          <div className="flex items-end">
                            <Button
                              type="button"
                              onClick={addQuotationItem}
                              className="w-full"
                              disabled={!newQuotationItem.description || !newQuotationItem.quantity || !newQuotationItem.unit_price}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Agregar Artículo
                            </Button>
                          </div>
                        </div>
                        
                        {newQuotationItem.total_price > 0 && (
                          <div className="text-sm text-muted-foreground">
                            Total: ${newQuotationItem.total_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quoted Amount (Auto-calculated) */}
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="quoted_amount">Monto Total Cotizado *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        id="quoted_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.quoted_amount || ''}
                        onChange={(e) => {
                          const newAmount = parseFloat(e.target.value) || 0
                          setFormData(prev => ({ ...prev, quoted_amount: newAmount }))
                        }}
                        className="pl-8 font-semibold"
                        required
                        readOnly={quotationItems.length > 0} // Auto-calculated if items exist
                      />
                    </div>
                    {quotationItems.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Calculado automáticamente desde los artículos ({quotationItems.length} {quotationItems.length === 1 ? 'artículo' : 'artículos'})
                      </p>
                    )}
                  </div>

                  {/* Delivery Days, Payment Terms and Validity */}
                  <div className="grid grid-cols-2 gap-4">
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

                    <div className="space-y-2">
                      <Label htmlFor="payment_terms">Condiciones de Pago</Label>
                      <Input
                        id="payment_terms"
                        value={formData.payment_terms || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                        placeholder="Ej: 30 días, Contado"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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

                  {/* File Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="quotation_file">Archivo de Cotización (Opcional)</Label>
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

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="quotation_notes">Notas</Label>
                    <Textarea
                      id="quotation_notes"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notas adicionales sobre esta cotización..."
                      rows={3}
                    />
                  </div>

                  {/* Form Errors */}
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

                  {/* Form Actions */}
                  <div className="flex justify-end space-x-2">
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
                    <Button
                      type="button"
                      onClick={handleAddQuotation}
                    >
                      Agregar Cotización
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Alert */}
          {quotations.length === 0 && !showForm && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Agregue al menos una cotización con información del proveedor y precio. 
                Puede agregar múltiples cotizaciones para comparar.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
