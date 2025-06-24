"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Building2, 
  Loader2, 
  Plus, 
  Trash2, 
  FileText,
  Calculator,
  AlertCircle,
  CheckCircle2,
  Package,
  Clock,
  Quote
} from "lucide-react"
import { PurchaseOrderType, PaymentMethod, CreatePurchaseOrderRequest, QuoteValidationResponse } from "@/types/purchase-orders"
import { QuotationValidator } from "./QuotationValidator"
import { QuotationUploader } from "./QuotationUploader"
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders"
import { createClient } from "@/lib/supabase"

interface SpecialOrderFormProps {
  workOrderId?: string
  onSuccess?: (purchaseOrderId: string) => void
  onCancel?: () => void
}

interface OrderItem {
  id: string
  part_number: string
  description: string
  brand: string
  quantity: number | string
  unit_price: number | string
  total_price: number
  lead_time_days?: number
  is_special_order?: boolean
}

interface WorkOrderData {
  id: string
  order_id: string
  description: string
  required_parts?: any
  estimated_cost?: string
  asset?: {
    id: string
    name: string
    asset_id: string
  }
}

// Common suppliers/agencies in Mexico
const COMMON_SUPPLIERS = [
  "Caterpillar de México",
  "John Deere México",
  "Komatsu México",
  "SKF México",
  "Timken México",
  "Gates México",
  "Parker Hannifin México",
  "Bosch México",
  "Siemens México",
  "ABB México",
  "Schneider Electric México",
  "Danfoss México"
]

export function SpecialOrderForm({ 
  workOrderId, 
  onSuccess, 
  onCancel 
}: SpecialOrderFormProps) {
  const router = useRouter()
  const { createPurchaseOrder, isCreating, error, clearError } = usePurchaseOrders()

  // Work order state
  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null)
  const [isLoadingWorkOrder, setIsLoadingWorkOrder] = useState(true)
  const [workOrderError, setWorkOrderError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<Partial<CreatePurchaseOrderRequest>>({
    work_order_id: workOrderId || undefined,
    po_type: PurchaseOrderType.SPECIAL_ORDER,
    supplier: "",
    items: [],
    total_amount: 0,
    payment_method: PaymentMethod.TRANSFER,
    notes: "Este pedido especial requiere cotización formal del proveedor."
  })

  // Items management
  const [items, setItems] = useState<OrderItem[]>([])
  const [newItem, setNewItem] = useState<Partial<OrderItem>>({
    part_number: '',
    description: '',
    brand: '',
    quantity: '',
    unit_price: '',
    total_price: 0,
    lead_time_days: 7,
    is_special_order: true
  })

  // Supplier suggestions
  const [recentSuppliers, setRecentSuppliers] = useState<string[]>([])
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([])
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false)

  // Validation
  const [validationResult, setValidationResult] = useState<QuoteValidationResponse | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  
  // Quotation handling
  const [quotationUrl, setQuotationUrl] = useState<string | null>(null)

  // Load work order data and recent suppliers
  useEffect(() => {
    const loadWorkOrderData = async () => {
      setIsLoadingWorkOrder(true)
      setWorkOrderError(null)
      
      try {
        const supabase = createClient()
        
        // Load recent suppliers from existing purchase orders
        const { data: supplierData, error: supplierError } = await supabase
          .from("purchase_orders")
          .select("supplier")
          .eq("po_type", "special_order")
          .not("supplier", "is", null)
          .order("created_at", { ascending: false })
          .limit(50)
          
        if (!supplierError && supplierData) {
          const uniqueSuppliers = Array.from(
            new Set(supplierData
              .map(item => item.supplier)
              .filter(supplier => supplier && supplier.trim() !== "")
            )
          ) as string[]
          setRecentSuppliers(uniqueSuppliers.slice(0, 15))
        }
        
        // Get work order with asset
        const { data: workOrderData, error: workOrderError } = await supabase
          .from("work_orders")
          .select(`
            *,
            asset:assets (*)
          `)
          .eq("id", workOrderId)
          .single()
          
        if (workOrderError) {
          setWorkOrderError("Error al cargar la orden de trabajo")
          console.error("Error fetching work order:", workOrderError)
          return
        }
        
        if (!workOrderData) {
          setWorkOrderError("Orden de trabajo no encontrada")
          return
        }
        
        setWorkOrder(workOrderData)
        
        // Pre-populate items from work order required_parts
        let partsToLoad: OrderItem[] = []
        
        if (workOrderData.required_parts) {
          try {
            const requiredParts = Array.isArray(workOrderData.required_parts) 
              ? workOrderData.required_parts 
              : JSON.parse(workOrderData.required_parts)
            
            partsToLoad = requiredParts.map((part: any, index: number) => ({
              id: `wo-part-${index}`,
              part_number: part.partNumber || part.part_number || '',
              description: part.name || part.item || part.description || 'Artículo',
              brand: part.brand || '',
              quantity: Number(part.quantity) || 1,
              unit_price: Number(part.unit_price) || Number(part.price) || 0,
              total_price: Number(part.total_price) || (Number(part.quantity) || 1) * (Number(part.unit_price) || Number(part.price) || 0),
              lead_time_days: part.lead_time_days || 15,
              is_special_order: true
            }))
          } catch (e) {
            console.error('Error parsing required parts:', e)
          }
        }
        
        // If no parts but has estimated cost, create generic entry
        if (partsToLoad.length === 0 && workOrderData.estimated_cost && Number(workOrderData.estimated_cost) > 0) {
          partsToLoad = [{
            id: 'estimated-order',
            part_number: '',
            description: 'Partes especiales para ' + (workOrderData.description || 'mantenimiento'),
            brand: '',
            quantity: 1,
            unit_price: Number(workOrderData.estimated_cost),
            total_price: Number(workOrderData.estimated_cost),
            lead_time_days: 15,
            is_special_order: true
          }]
        }
        
        setItems(partsToLoad)
        
        // Auto-populate notes with work order info
        if (workOrderData.description) {
          setFormData(prev => ({ 
            ...prev, 
            notes: `Orden de trabajo: ${workOrderData.order_id} - ${workOrderData.description}\n\nNOTA: Este pedido especial requiere cotización formal del proveedor antes de proceder.`
          }))
        }
        
      } catch (err) {
        console.error("Error loading work order data:", err)
        setWorkOrderError(err instanceof Error ? err.message : "Error al cargar los datos de la orden de trabajo")
      } finally {
        setIsLoadingWorkOrder(false)
      }
    }
    
    if (workOrderId) {
      loadWorkOrderData()
    } else {
      // No work order - just load suppliers
      setIsLoadingWorkOrder(false)
    }
  }, [workOrderId])

  // Calculate total amount whenever items change
  useEffect(() => {
    const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0)
    setFormData(prev => ({ ...prev, total_amount: total, items }))
  }, [items])

  // Handle form input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    clearError()
  }

  // Handle supplier input with suggestions
  const handleSupplierChange = (value: string) => {
    handleInputChange('supplier', value)
    
    if (value && value.length > 0) {
      const recentFiltered = recentSuppliers.filter(supplier =>
        supplier.toLowerCase().includes(value.toLowerCase())
      )
      const commonFiltered = COMMON_SUPPLIERS.filter(supplier =>
        supplier.toLowerCase().includes(value.toLowerCase())
      )
      
      const allSuggestions = [...new Set([...recentFiltered, ...commonFiltered])]
      setSupplierSuggestions(allSuggestions.slice(0, 8))
      setShowSupplierSuggestions(allSuggestions.length > 0)
    } else {
      setSupplierSuggestions([])
      setShowSupplierSuggestions(false)
    }
  }

  // Select supplier from suggestions
  const selectSupplier = (supplier: string) => {
    handleInputChange('supplier', supplier)
    setShowSupplierSuggestions(false)
    setSupplierSuggestions([])
  }

  // Handle new item changes
  const handleNewItemChange = (field: string, value: any) => {
    setNewItem(prev => {
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

  // Add new item to list
  const addItem = () => {
    if (!newItem.description || !newItem.quantity || !newItem.unit_price) {
      setFormErrors(['Descripción, cantidad y precio unitario son requeridos'])
      return
    }

    const item: OrderItem = {
      id: `item-${Date.now()}`,
      part_number: newItem.part_number || '',
      description: newItem.description || '',
      brand: newItem.brand || '',
      quantity: Number(newItem.quantity) || 0,
      unit_price: Number(newItem.unit_price) || 0,
      total_price: Number(newItem.total_price) || 0,
      lead_time_days: Number(newItem.lead_time_days) || 15,
      is_special_order: true
    }

    setItems(prev => [...prev, item])
    setNewItem({
      part_number: '',
      description: '',
      brand: '',
      quantity: '',
      unit_price: '',
      total_price: 0,
      lead_time_days: 15,
      is_special_order: true
    })
    setFormErrors([])
  }

  // Remove item from list
  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  // Validate form
  const validateForm = (): boolean => {
    const errors: string[] = []

    if (!formData.supplier?.trim()) {
      errors.push('Proveedor/Agencia es requerido')
    }

    if (!formData.payment_method) {
      errors.push('Método de pago es requerido')
    }

    if (items.length === 0) {
      errors.push('Debe agregar al menos un artículo')
    }

    if (formData.total_amount === 0) {
      errors.push('El monto total debe ser mayor a cero')
    }

    // Check for items without part numbers (recommended for special orders)
    const itemsWithoutPartNumber = items.filter(item => !item.part_number?.trim())
    if (itemsWithoutPartNumber.length > 0) {
      errors.push(`Recomendado: Agregar número de parte para ${itemsWithoutPartNumber.length} artículo(s)`)
    }

    // Special orders always require quotation
    if (!quotationUrl) {
      errors.push('Se requiere cotización formal del proveedor para pedidos especiales')
    }

    setFormErrors(errors)
    return errors.length === 0
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      const request: CreatePurchaseOrderRequest = {
        work_order_id: workOrderId || undefined,
        po_type: PurchaseOrderType.SPECIAL_ORDER,
        supplier: formData.supplier!,
        items: items,
        total_amount: formData.total_amount!,
        payment_method: formData.payment_method,
        notes: formData.notes,
        quotation_url: quotationUrl || undefined
      }

      const result = await createPurchaseOrder(request)
      
      if (result) {
        if (onSuccess) {
          onSuccess(result.id)
        } else {
          router.push(`/compras/${result.id}`)
        }
      }
    } catch (error) {
      console.error('Error creating special order:', error)
    }
  }

  // Calculate estimated delivery time
  const estimatedDeliveryDays = items.length > 0 
    ? Math.max(...items.map(item => item.lead_time_days || 15))
    : 15

  // Loading state
  if (isLoadingWorkOrder) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">Cargando datos de la orden de trabajo...</span>
      </div>
    )
  }

  // Work order error state (only show if workOrderId was provided but loading failed)
  if (workOrderId && (workOrderError || !workOrder)) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-3">
            <p>{workOrderError || "No se pudo cargar la orden de trabajo"}</p>
            <div className="flex space-x-2">
              {onCancel && (
                <Button variant="outline" size="sm" onClick={onCancel}>
                  Volver
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/ordenes')}
              >
                Ver Órdenes de Trabajo
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Building2 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <CardTitle>Pedido Especial</CardTitle>
              <CardDescription>
                Agencia, proveedor formal, partes especiales - Siempre requiere cotización
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quotation Requirement Notice */}
      <Alert>
        <Quote className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">⚠️ Cotización Obligatoria</p>
            <p className="text-sm">
              Los pedidos especiales siempre requieren cotización formal del proveedor antes de proceder. 
              El proveedor deberá enviar una cotización detallada con precios, disponibilidad y tiempos de entrega.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* Quotation Upload - Always required for special orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Cotización del Proveedor</span>
            <Badge variant="destructive">Obligatorio</Badge>
          </CardTitle>
          <CardDescription>
            Suba la cotización formal recibida del proveedor con precios, disponibilidad y tiempos de entrega
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuotationUploader
            workOrderId={workOrderId}
            isRequired={true}
            onFileUploaded={(url) => {
              setQuotationUrl(url)
              setFormErrors(prev => prev.filter(error => !error.includes('cotización')))
            }}
            onFileRemoved={() => {
              setQuotationUrl(null)
            }}
          />
        </CardContent>
      </Card>

      {/* Work Order Information */}
      {workOrder && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Información de la Orden de Trabajo</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Orden de Trabajo</Label>
                <p className="font-medium">{workOrder.order_id}</p>
              </div>
              {workOrder.asset && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Activo</Label>
                  <p className="font-medium">{workOrder.asset.name}</p>
                  <p className="text-sm text-muted-foreground">{workOrder.asset.asset_id}</p>
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Descripción</Label>
              <p className="text-sm">{workOrder.description}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {(formData.total_amount && formData.total_amount > 0) ? (
        <QuotationValidator
          poType={PurchaseOrderType.SPECIAL_ORDER}
          amount={formData.total_amount}
          onValidationResult={setValidationResult}
        />
      ) : null}

      {/* Form Errors */}
      {formErrors.length > 0 ? (
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
      ) : null}

      {/* API Error */}
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Supplier Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Información del Proveedor/Agencia</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor/Agencia *</Label>
              <div className="relative">
                <Input
                  id="supplier"
                  placeholder="Nombre de la agencia o proveedor formal"
                  value={formData.supplier || ""}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  onFocus={() => setShowSupplierSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 150)}
                />
                {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md mt-1 max-h-48 overflow-y-auto">
                    {supplierSuggestions.map((supplier, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onClick={() => selectSupplier(supplier)}
                      >
                        {supplier}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de Pago *</Label>
              <Select 
                value={formData.payment_method || ""} 
                onValueChange={(value) => handleInputChange('payment_method', value as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentMethod.TRANSFER}>Transferencia</SelectItem>
                  <SelectItem value={PaymentMethod.CARD}>Tarjeta Corporativa</SelectItem>
                  <SelectItem value={PaymentMethod.CASH}>Efectivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>Artículos a Solicitar</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Item */}
          <Card className="border-dashed border-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Agregar Artículo</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                <div>
                  <Label htmlFor="new-item-part-number">Número de Parte</Label>
                  <Input
                    id="new-item-part-number"
                    placeholder="P/N"
                    value={newItem.part_number || ""}
                    onChange={(e) => handleNewItemChange('part_number', e.target.value)}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Label htmlFor="new-item-description">Descripción *</Label>
                  <Input
                    id="new-item-description"
                    placeholder="Descripción del artículo"
                    value={newItem.description || ""}
                    onChange={(e) => handleNewItemChange('description', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="new-item-brand">Marca</Label>
                  <Input
                    id="new-item-brand"
                    placeholder="Marca"
                    value={newItem.brand || ""}
                    onChange={(e) => handleNewItemChange('brand', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="new-item-quantity">Cantidad *</Label>
                  <Input
                    id="new-item-quantity"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="1"
                    value={newItem.quantity}
                    onChange={(e) => handleNewItemChange('quantity', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="new-item-price">Precio Unit. *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      id="new-item-price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-8"
                      value={newItem.unit_price}
                      onChange={(e) => handleNewItemChange('unit_price', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div>
                  <Label htmlFor="new-item-lead-time">Tiempo de Entrega (días)</Label>
                  <Input
                    id="new-item-lead-time"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="15"
                    value={newItem.lead_time_days}
                    onChange={(e) => handleNewItemChange('lead_time_days', e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <div className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      id="is-special-order"
                      checked={newItem.is_special_order}
                      onChange={(e) => handleNewItemChange('is_special_order', e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="is-special-order" className="text-sm">Pedido especial</Label>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-medium">
                    ${(newItem.total_price || 0).toLocaleString('es-MX', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </span>
                </div>
                <Button type="button" onClick={addItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artículo/Parte</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Precio Unit.</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {item.part_number && (
                            <p className="text-sm text-muted-foreground">P/N: {item.part_number}</p>
                          )}
                          {item.is_special_order && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              <FileText className="h-3 w-3 mr-1" />
                              Especial
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.brand || '-'}</TableCell>
                      <TableCell>{Number(item.quantity)}</TableCell>
                      <TableCell>
                        ${Number(item.unit_price).toLocaleString('es-MX', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${item.total_price.toLocaleString('es-MX', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.lead_time_days || 15}d</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Order Summary */}
          {items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total de Artículos:</span>
                      <span className="font-medium">{items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tiempo Estimado de Entrega:</span>
                      <span className="font-medium">{estimatedDeliveryDays} días</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total del Pedido:</span>
                    <span className="text-xl font-bold">
                      ${(formData.total_amount || 0).toLocaleString('es-MX', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notas y Especificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Especificaciones técnicas, notas para el proveedor, condiciones especiales, etc."
            value={formData.notes || ""}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        
        <Button 
          type="submit" 
          disabled={isCreating || items.length === 0}
          className="min-w-[150px]"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Building2 className="mr-2 h-4 w-4" />
              Crear Pedido Especial
            </>
          )}
        </Button>
      </div>
    </form>
  )
} 