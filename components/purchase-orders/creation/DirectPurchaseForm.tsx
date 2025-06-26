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
  Save, 
  ShoppingCart, 
  Loader2, 
  Plus, 
  Trash2, 
  Store,
  Calculator,
  AlertCircle,
  CheckCircle2,
  Package,
  Building2
} from "lucide-react"
import { PurchaseOrderType, PaymentMethod, CreatePurchaseOrderRequest, QuoteValidationResponse } from "@/types/purchase-orders"
import { QuotationValidator } from "./QuotationValidator"
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders"
import { createClient } from "@/lib/supabase"
import { useUserPlant } from "@/hooks/use-user-plant"

interface DirectPurchaseFormProps {
  workOrderId?: string
  onSuccess?: (purchaseOrderId: string) => void
  onCancel?: () => void
}

interface PurchaseOrderItem {
  id: string
  name: string
  partNumber: string
  quantity: number | string
  unit_price: number | string
  total_price: number
  supplier?: string
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

export function DirectPurchaseForm({ 
  workOrderId, 
  onSuccess, 
  onCancel 
}: DirectPurchaseFormProps) {
  const router = useRouter()
  const { createPurchaseOrder, isCreating, error, clearError } = usePurchaseOrders()
  const { userPlants, loading: plantsLoading } = useUserPlant()

  // Plant selection state
  const [selectedPlantId, setSelectedPlantId] = useState<string>("")

  // Work order state
  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null)
  const [isLoadingWorkOrder, setIsLoadingWorkOrder] = useState(true)
  const [workOrderError, setWorkOrderError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<Partial<CreatePurchaseOrderRequest>>({
    work_order_id: workOrderId || undefined,
    po_type: PurchaseOrderType.DIRECT_PURCHASE,
    supplier: "",
    items: [],
    total_amount: 0,
    payment_method: PaymentMethod.CASH,
    notes: "",
    max_payment_date: undefined
  })

  // Items management
  const [items, setItems] = useState<PurchaseOrderItem[]>([])
  const [newItem, setNewItem] = useState<Partial<PurchaseOrderItem>>({
    name: '',
    partNumber: '',
    quantity: '',
    unit_price: '',
    total_price: 0
  })

  // Supplier suggestions (loaded from recent purchase orders)
  const [recentSuppliers, setRecentSuppliers] = useState<string[]>([])
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Validation
  const [validationResult, setValidationResult] = useState<QuoteValidationResponse | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])

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
          setRecentSuppliers(uniqueSuppliers.slice(0, 15)) // Keep top 15
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
        let partsToLoad: PurchaseOrderItem[] = []
        
        if (workOrderData.required_parts) {
          try {
            const requiredParts = Array.isArray(workOrderData.required_parts) 
              ? workOrderData.required_parts 
              : JSON.parse(workOrderData.required_parts)
            
            partsToLoad = requiredParts.map((part: any, index: number) => ({
              id: `wo-part-${index}`,
              name: part.name || part.item || 'Artículo',
              partNumber: part.partNumber || part.part_number || '',
              quantity: Number(part.quantity) || 1,
              unit_price: Number(part.unit_price) || Number(part.price) || 0,
              total_price: Number(part.total_price) || (Number(part.quantity) || 1) * (Number(part.unit_price) || Number(part.price) || 0)
            }))
          } catch (e) {
            console.error('Error parsing required parts:', e)
          }
        }
        
        // If no parts but has estimated cost, create generic entry
        if (partsToLoad.length === 0 && workOrderData.estimated_cost && Number(workOrderData.estimated_cost) > 0) {
          partsToLoad = [{
            id: 'estimated-cost',
            name: 'Materiales y repuestos',
            partNumber: '',
            quantity: 1,
            unit_price: Number(workOrderData.estimated_cost),
            total_price: Number(workOrderData.estimated_cost)
          }]
        }
        
        setItems(partsToLoad)
        
        // Auto-populate notes with work order info
        if (workOrderData.description) {
          setFormData(prev => ({ 
            ...prev, 
            notes: `Orden de trabajo: ${workOrderData.order_id} - ${workOrderData.description}` 
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
      const filtered = recentSuppliers.filter(supplier =>
        supplier.toLowerCase().includes(value.toLowerCase())
      )
      setSupplierSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setSupplierSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Select supplier from suggestions
  const selectSupplier = (supplier: string) => {
    handleInputChange('supplier', supplier)
    setShowSuggestions(false)
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
    if (!newItem.name || !newItem.quantity || !newItem.unit_price) {
      setFormErrors(['Nombre, cantidad y precio unitario son requeridos'])
      return
    }

    const item: PurchaseOrderItem = {
      id: `item-${Date.now()}`,
      name: newItem.name || '',
      partNumber: newItem.partNumber || '',
      quantity: Number(newItem.quantity) || 0,
      unit_price: Number(newItem.unit_price) || 0,
      total_price: Number(newItem.total_price) || 0
    }

    setItems(prev => [...prev, item])
    setNewItem({
      name: '',
      partNumber: '',
      quantity: '',
      unit_price: '',
      total_price: 0
    })
    setFormErrors([])
  }

  // Remove item from list
  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  // Update existing item
  const updateItem = (itemId: string, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      
      const updated = { ...item, [field]: value }
      
      // Recalculate total price if quantity or unit price changes
      if (field === 'quantity' || field === 'unit_price') {
        const quantity = field === 'quantity' ? Number(value) || 0 : Number(item.quantity) || 0
        const unitPrice = field === 'unit_price' ? Number(value) || 0 : Number(item.unit_price) || 0
        updated.total_price = quantity * unitPrice
      }
      
      return updated
    }))
  }

  // Validate form
  const validateForm = (): boolean => {
    const errors: string[] = []

    // Plant validation (only for standalone orders without work order)
    if (!workOrderId && !selectedPlantId) {
      errors.push('La planta es obligatoria')
    }

    if (!formData.supplier?.trim()) {
      errors.push('Proveedor es requerido')
    }

    if (!formData.payment_method) {
      errors.push('Método de pago es requerido')
    }

    // Validate max payment date for transfers
    if (formData.payment_method === PaymentMethod.TRANSFER) {
      if (!formData.max_payment_date) {
        errors.push('Fecha máxima de pago es requerida para transferencias')
      } else {
        const maxDate = new Date(formData.max_payment_date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        if (maxDate < today) {
          errors.push('La fecha máxima de pago no puede ser anterior a hoy')
        }
      }
    }

    if (items.length === 0) {
      errors.push('Debe agregar al menos un artículo')
    }

    if (formData.total_amount === 0) {
      errors.push('El monto total debe ser mayor a cero')
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
        work_order_id: workOrderId,
        po_type: PurchaseOrderType.DIRECT_PURCHASE,
        supplier: formData.supplier!,
        items: items,
        total_amount: formData.total_amount!,
        payment_method: formData.payment_method,
        notes: formData.notes,
        max_payment_date: formData.payment_method === PaymentMethod.TRANSFER ? formData.max_payment_date : undefined,
        // Include plant_id for standalone orders
        ...(selectedPlantId && { plant_id: selectedPlantId })
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
      console.error('Error creating direct purchase order:', error)
    }
  }

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
            <div className="p-2 rounded-lg bg-blue-100">
              <Store className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>Compra Directa</CardTitle>
              <CardDescription>
                Ferretería, tienda local, refacciones básicas - Sin cotización requerida
              </CardDescription>
            </div>
          </div>
        </CardHeader>
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
          poType={PurchaseOrderType.DIRECT_PURCHASE}
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
          <CardTitle className="text-lg">Información del Proveedor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor</Label>
              <div className="relative">
                <Input
                  id="supplier"
                  placeholder="Nombre del proveedor o tienda"
                  value={formData.supplier || ""}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  onFocus={() => {
                    if (recentSuppliers.length > 0) {
                      setSupplierSuggestions(recentSuppliers)
                      setShowSuggestions(true)
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow for selection
                    setTimeout(() => setShowSuggestions(false), 200)
                  }}
                  required
                />
                {(showSuggestions && supplierSuggestions.length > 0) ? (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 text-xs text-gray-500 border-b">
                      Proveedores recientes:
                    </div>
                    {supplierSuggestions.map((supplier, index) => (
                      <button
                        key={index}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                        onClick={() => selectSupplier(supplier)}
                      >
                        {supplier}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Escribe el nombre del proveedor o selecciona uno de los recientes
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de Pago</Label>
              <Select
                value={formData.payment_method || ""}
                onValueChange={(value) => handleInputChange('payment_method', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentMethod.CASH}>Efectivo</SelectItem>
                  <SelectItem value={PaymentMethod.CARD}>Tarjeta</SelectItem>
                  <SelectItem value={PaymentMethod.TRANSFER}>Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Max Payment Date - Only shown for transfers */}
          {formData.payment_method === PaymentMethod.TRANSFER && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="max_payment_date">Fecha Máxima de Pago</Label>
                <Input
                  id="max_payment_date"
                  type="date"
                  value={formData.max_payment_date || ""}
                  onChange={(e) => handleInputChange('max_payment_date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required={formData.payment_method === PaymentMethod.TRANSFER}
                />
                <p className="text-xs text-muted-foreground">
                  Fecha límite para realizar la transferencia
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plant Selection - Only show for standalone orders */}
      {!workOrderId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Selección de Planta</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plantsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Cargando plantas...</span>
              </div>
            ) : userPlants.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No tienes acceso a ninguna planta. Contacta al administrador.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="plant_selector">Planta *</Label>
                <Select
                  value={selectedPlantId}
                  onValueChange={setSelectedPlantId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la planta donde se realizará la compra" />
                  </SelectTrigger>
                  <SelectContent>
                    {userPlants.map((plant) => (
                      <SelectItem key={plant.plant_id} value={plant.plant_id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{plant.plant_name}</span>
                          {plant.business_unit_name && (
                            <span className="text-xs text-muted-foreground">
                              {plant.business_unit_name}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecciona la planta donde se realizará esta compra directa
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Artículos a Comprar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Item */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <h4 className="font-medium mb-3">Agregar Artículo</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <Label htmlFor="item_name">Descripción</Label>
                <Input
                  id="item_name"
                  placeholder="Nombre del artículo"
                  value={newItem.name || ""}
                  onChange={(e) => handleNewItemChange('name', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="part_number">Número de Parte</Label>
                <Input
                  id="part_number"
                  placeholder="Código/Modelo"
                  value={newItem.partNumber || ""}
                  onChange={(e) => handleNewItemChange('partNumber', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="quantity">Cantidad</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={newItem.quantity || ""}
                  onChange={(e) => handleNewItemChange('quantity', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="unit_price">Precio Unitario</Label>
                <Input
                  id="unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={newItem.unit_price || ""}
                  onChange={(e) => handleNewItemChange('unit_price', e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button type="button" onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Button>
              </div>
            </div>

            {(newItem.total_price && newItem.total_price > 0) ? (
              <div className="mt-2 text-sm text-muted-foreground">
                Total: ${newItem.total_price.toFixed(2)}
              </div>
            ) : null}
          </div>

          {/* Items List */}
          {items.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Parte/Código</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Precio Unit.</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                          className="border-0 p-0 h-auto"
                          placeholder="Nombre del artículo"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.partNumber}
                          onChange={(e) => updateItem(item.id, 'partNumber', e.target.value)}
                          className="border-0 p-0 h-auto"
                          placeholder="Código"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity || ""}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          className="border-0 p-0 h-auto w-20"
                          placeholder="1"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price || ""}
                          onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
                          className="border-0 p-0 h-auto w-24"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          ${item.total_price.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Total Summary */}
              <div className="p-4 border-t bg-muted/30">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total de la Compra:</span>
                  <span className="text-lg font-bold">
                    ${formData.total_amount?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notas Adicionales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Información adicional, observaciones, o instrucciones especiales..."
            value={formData.notes || ""}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit Actions */}
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
              <ShoppingCart className="mr-2 h-4 w-4" />
              Crear Compra Directa
            </>
          )}
        </Button>
      </div>
    </form>
  )
} 