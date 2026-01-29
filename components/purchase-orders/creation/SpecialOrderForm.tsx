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
  Quote,
  ShoppingCart,
  XCircle
} from "lucide-react"
import { PurchaseOrderType, PaymentMethod, CreatePurchaseOrderRequest, QuoteValidationResponse } from "@/types/purchase-orders"
import { QuotationValidator } from "./QuotationValidator"
import { QuotationFormForCreation } from "./QuotationFormForCreation"
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders"
import { createClient } from "@/lib/supabase"
import { SupplierSelector } from "@/components/suppliers/SupplierSelector"
import { Supplier } from "@/types/suppliers"
import { PartAutocomplete, PartSuggestion } from "@/components/inventory/part-autocomplete"
import { useUserPlant } from "@/hooks/use-user-plant"
import { format } from "date-fns"
import { toast } from "sonner"

interface SpecialOrderFormProps {
  workOrderId?: string
  prefillSupplier?: string
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
  part_id?: string  // Link to inventory catalog
  fulfill_from?: 'inventory' | 'purchase'  // Source selection per item
  availability?: {
    sufficient: boolean
    total_available: number
    available_by_warehouse: Array<{
      warehouse_id: string
      warehouse_name: string
      available_quantity: number
      current_quantity: number
      reserved_quantity: number
    }>
  }
}

interface WorkOrderData {
  id: string
  order_id: string
  description: string
  required_parts?: any
  estimated_cost?: string
  plant_id?: string
  asset?: {
    id: string
    name: string
    asset_id: string
    plant_id?: string
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
  prefillSupplier,
  onSuccess, 
  onCancel 
}: SpecialOrderFormProps) {
  const router = useRouter()
  const { createPurchaseOrder, isCreating, error, clearError } = usePurchaseOrders()
  const { userPlants, loading: plantsLoading } = useUserPlant()

  // Plant selection state
  const [selectedPlantId, setSelectedPlantId] = useState<string | undefined>(undefined)

  // Work order state
  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null)
  const [isLoadingWorkOrder, setIsLoadingWorkOrder] = useState(true)
  const [workOrderError, setWorkOrderError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<Partial<CreatePurchaseOrderRequest>>({
    work_order_id: workOrderId || undefined,
    po_type: PurchaseOrderType.SPECIAL_ORDER,
    supplier: "Por definir", // Will be set when quotation is selected
    items: [],
    total_amount: 0,
    payment_method: PaymentMethod.TRANSFER,
    notes: "Este pedido especial requiere cotización formal del proveedor.",
    purchase_date: new Date().toISOString().split('T')[0], // Default to today
    max_payment_date: undefined
  })

  // Items management - NOT USED for Special Orders (comes from quotations)
  // Keeping for compatibility with existing code, but will be empty
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

  // Supplier - NOT SELECTED HERE for Special Orders (comes from quotations)
  // Will be auto-populated when quotation is selected
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  // Validation
  const [validationResult, setValidationResult] = useState<QuoteValidationResponse | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  
  // Quotation handling - structured quotations with supplier info
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
  const [quotations, setQuotations] = useState<QuotationFormData[]>([])
  // Legacy support
  const [quotationUrls, setQuotationUrls] = useState<string[]>([])
  const [quotationUrl, setQuotationUrl] = useState<string | null>(null)

  // Load work order data and recent suppliers
  useEffect(() => {
    if (prefillSupplier) {
      handleInputChange('supplier', prefillSupplier)
    }
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
        
        // Also fetch plant_id if not in work order directly
        if (workOrderData && !workOrderData.plant_id && workOrderData.asset?.id) {
          const { data: assetData } = await supabase
            .from('assets')
            .select('plant_id')
            .eq('id', workOrderData.asset.id)
            .single()
          if (assetData?.plant_id) {
            workOrderData.plant_id = assetData.plant_id
          }
        }
          
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

  // Check availability for an item
  const checkItemAvailability = async (item: OrderItem) => {
    if (!item.part_id) return
    
    // Get plant_id from work order
    const plantId = workOrder?.plant_id || workOrder?.asset?.plant_id
    if (!plantId) return
    
    try {
      const res = await fetch(
        `/api/inventory/parts/${item.part_id}/availability?plant_id=${plantId}&quantity=${item.quantity || 0}`
      )
      const data = await res.json()
      if (data.success) {
        // Update item with availability
        setItems(prev => prev.map(i => {
          if (i.id !== item.id) return i
          const updated = {
            ...i,
            availability: {
              sufficient: data.sufficient,
              total_available: data.total_available,
              available_by_warehouse: data.available_by_warehouse || []
            }
          }
          // Auto-suggest inventory if available and not already set
          if (data.sufficient && !updated.fulfill_from) {
            updated.fulfill_from = 'inventory'
          }
          return updated
        }))
      }
    } catch (err) {
      console.error('Availability check failed:', err)
    }
  }

  // Handle part selection from autocomplete
  const handlePartSelect = (part: PartSuggestion | null) => {
    if (part) {
      const updatedItem = {
        description: part.name,
        part_number: part.part_number,
        part_id: part.id,  // Store part_id for availability checking
        // Auto-fill unit price if available
        unit_price: part.default_unit_cost || '',
        // Recalculate total
        total_price: (part.default_unit_cost || 0) * (Number(newItem.quantity) || 1)
      }
      setNewItem(prev => ({
        ...prev,
        ...updatedItem
      }))
      
      // Check availability if we have plant_id
      const plantId = workOrder?.plant_id || workOrder?.asset?.plant_id
      if (plantId && part.id) {
        setTimeout(async () => {
          try {
            const res = await fetch(
              `/api/inventory/parts/${part.id}/availability?plant_id=${plantId}&quantity=${Number(newItem.quantity) || 1}`
            )
            const data = await res.json()
            if (data.success && data.sufficient) {
              // Suggest inventory if available
              setNewItem(prev => ({
                ...prev,
                fulfill_from: 'inventory'
              }))
            }
          } catch (err) {
            console.error('Availability check failed:', err)
          }
        }, 100)
      }
    } else {
      // Clear part info if selection cleared
      setNewItem(prev => ({
        ...prev,
        description: '',
        part_number: '',
        part_id: undefined,
        fulfill_from: undefined
      }))
    }
  }

  // Handle manual entry when part not in catalog
  const handleManualPartEntry = (text: string) => {
    // User is typing manually - update the description field
    setNewItem(prev => ({
      ...prev,
      description: text,
      // Keep part_number if it was already set, otherwise clear it
      part_number: prev.part_number || ''
    }))
  }

  // Add new item to list
  const addItem = async () => {
    if (!newItem.description || !newItem.quantity || !newItem.unit_price) {
      setFormErrors(['Descripción, cantidad y precio unitario son requeridos'])
      return
    }

    const item: OrderItem = {
      id: `item-${Date.now()}`,
      part_number: newItem.part_number || '',
      description: newItem.description || '',
      brand: newItem.brand || '',
      part_id: newItem.part_id,
      quantity: Number(newItem.quantity) || 0,
      fulfill_from: newItem.fulfill_from || 'purchase',  // Default to purchase
      unit_price: Number(newItem.unit_price) || 0,
      total_price: Number(newItem.total_price) || 0,
      lead_time_days: Number(newItem.lead_time_days) || 15,
      is_special_order: true
    }

    // Check availability if part_id exists
    if (item.part_id) {
      await checkItemAvailability(item)
    }

    setItems(prev => [...prev, item])
    setNewItem({
      part_number: '',
      description: '',
      brand: '',
      part_id: undefined,
      quantity: '',
      unit_price: '',
      total_price: 0,
      lead_time_days: 15,
      is_special_order: true,
      fulfill_from: undefined
    })
    setFormErrors([])
  }

  // Remove item from list
  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  // Edit existing item inline
  const handleItemChange = (itemId: string, field: keyof OrderItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const updated: OrderItem = { ...item, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        const quantity = field === 'quantity' ? Number(value) || 0 : Number(item.quantity) || 0
        const unitPrice = field === 'unit_price' ? Number(value) || 0 : Number(item.unit_price) || 0
        updated.total_price = quantity * unitPrice
      }
      
      // Re-check availability if quantity or part_id changes
      if ((field === 'quantity' || field === 'part_id') && updated.part_id) {
        setTimeout(() => checkItemAvailability(updated), 100)
      }
      
      return updated
    }))
  }

  // Calculate PO purpose based on item selections
  const calculatePOPurpose = (items: OrderItem[]): string => {
    if (items.length === 0) return 'work_order_cash'
    
    const inventoryCount = items.filter(i => i.fulfill_from === 'inventory').length
    const purchaseCount = items.filter(i => i.fulfill_from === 'purchase' || !i.fulfill_from).length
    
    if (inventoryCount === items.length) return 'work_order_inventory'
    if (purchaseCount === items.length) return 'work_order_cash'
    return 'mixed'
  }

  // Validate form
  const validateForm = (): boolean => {
    const errors: string[] = []

    // Plant validation (only for standalone orders without work order)
    if (!workOrderId && !selectedPlantId) {
      errors.push('La planta es obligatoria')
    }

    // Supplier is NOT required here - it comes from selected quotation
    // Validation removed

    if (!formData.payment_method) {
      errors.push('Método de pago es requerido')
    }

    // Validate max_payment_date for transfers
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

    // Items are optional - they will come from selected quotation
    // But we still validate total amount if items are provided
    if (items.length > 0 && formData.total_amount === 0) {
      errors.push('El monto total debe ser mayor a cero')
    }
    
    // If no items, ensure quotations have items
    if (items.length === 0 && quotations.length > 0) {
      const quotationsWithItems = quotations.filter(q => q.quotation_items && q.quotation_items.length > 0)
      if (quotationsWithItems.length === 0) {
        errors.push('Las cotizaciones deben incluir al menos un artículo')
      }
    }

    // Validate purchase_date is required
    if (!formData.purchase_date) {
      errors.push('La fecha de compra es obligatoria')
    }

    // Part number is now optional - removed the requirement
    // Special orders always require quotation
    if (quotations.length === 0) {
      errors.push('Se requiere al menos una cotización con información del proveedor y precio para pedidos especiales')
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
      // Determine PO purpose based on work order linkage and item selections
      let po_purpose = 'work_order_cash'
      
      if (!workOrderId) {
        // No work order = restocking
        po_purpose = 'inventory_restock'
      } else if (workOrderId && items.length > 0) {
        // Calculate po_purpose from item fulfill_from selections
        po_purpose = calculatePOPurpose(items)
      }
      
      // Determine supplier based on po_purpose
      let finalSupplier = formData.supplier || "Por definir"
      
      // Auto-set supplier to "Inventario Interno" if all items are from inventory
      if (po_purpose === 'work_order_inventory') {
        finalSupplier = 'Inventario Interno'
      }
      
      // Create the base request object
      const request: CreatePurchaseOrderRequest = {
        work_order_id: workOrderId || undefined,
        po_type: PurchaseOrderType.SPECIAL_ORDER,
        po_purpose: po_purpose,
        supplier: finalSupplier,
        items: items,
        total_amount: formData.total_amount!,
        payment_method: formData.payment_method,
        notes: formData.notes,
        purchase_date: formData.purchase_date,
        quotation_urls: quotationUrls.length > 0 ? quotationUrls : undefined,
        quotation_url: quotationUrl || undefined, // Legacy fallback
        ...(formData.max_payment_date && { max_payment_date: formData.max_payment_date })
      }

      // Include plant_id for standalone orders
      if (selectedPlantId) {
        request.plant_id = selectedPlantId as string
      }

      const result = await createPurchaseOrder(request)
      
      if (result) {
        // Create quotations after PO is created
        if (quotations.length > 0) {
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            
            if (user) {
              // Upload files first, then create quotations
              for (const quotation of quotations) {
                let fileUrl = quotation.file_url
                
                // Upload file if provided
                if (quotation.file && !fileUrl) {
                  const folderName = workOrderId || result.id
                  const sanitizedFileName = quotation.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
                  const fileName = `${folderName}/${Date.now()}_${sanitizedFileName}`
                  
                  const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('quotations')
                    .upload(fileName, quotation.file, { cacheControl: '3600', upsert: false })
                  
                  if (!uploadError && uploadData) {
                    const { data: signedUrlData } = await supabase.storage
                      .from('quotations')
                      .createSignedUrl(uploadData.path, 3600 * 24 * 7)
                    fileUrl = signedUrlData?.signedUrl
                  }
                }
                
                // Create quotation via API
                const quotationRequest: any = {
                  purchase_order_id: result.id,
                  supplier_id: quotation.supplier_id,
                  supplier_name: quotation.supplier_name,
                  quoted_amount: quotation.quoted_amount,
                  quotation_items: quotation.quotation_items || undefined, // Include item-level pricing
                  delivery_days: quotation.delivery_days,
                  payment_terms: quotation.payment_terms,
                  validity_date: quotation.validity_date ? format(quotation.validity_date, 'yyyy-MM-dd') : undefined,
                  notes: quotation.notes,
                  file_url: fileUrl,
                  file_name: quotation.file_name
                }
                
                await fetch('/api/purchase-orders/quotations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(quotationRequest)
                })
              }
            }
          } catch (error) {
            console.error('Error creating quotations:', error)
            toast.error('PO creada pero hubo error al guardar cotizaciones. Puede agregarlas manualmente.')
          }
        }
        
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
            Información básica de la orden de compra. Los proveedores y artículos se agregarán en las cotizaciones.
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

      {/* Quotation Form - Always required for special orders */}
      {/* Items and supplier come from quotations - NOT from main form */}
      <QuotationFormForCreation
        quotations={quotations}
        onQuotationsChange={(newQuotations) => {
          setQuotations(newQuotations)
          setFormErrors(prev => prev.filter(error => !error.includes('cotización')))
          
          // Calculate total from all quotations (for display purposes)
          // Actual total will come from selected quotation
          if (newQuotations.length > 0) {
            const avgTotal = newQuotations.reduce((sum, q) => sum + q.quoted_amount, 0) / newQuotations.length
            setFormData(prev => ({ ...prev, total_amount: avgTotal }))
          }
        }}
        workOrderId={workOrderId}
      />

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
          poPurpose={formData.po_purpose}
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

      {/* Basic Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Información Básica</span>
          </CardTitle>
          <CardDescription>
            Configure fechas y método de pago. El proveedor y artículos se agregarán en las cotizaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Flujo de Pedido Especial:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Configure la información básica (fechas, método de pago, notas)</li>
                <li>Agregue cotizaciones de diferentes proveedores (cada una con sus artículos y precios)</li>
                <li>Compare las cotizaciones y seleccione la mejor opción</li>
                <li>El sistema actualizará automáticamente el proveedor y artículos seleccionados</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Purchase Date */}
            <div className="space-y-2">
              <Label htmlFor="purchase_date">Fecha de Compra *</Label>
              <Input
                id="purchase_date"
                type="date"
                value={formData.purchase_date || ''}
                onChange={(e) => handleInputChange('purchase_date', e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Fecha en que se realizará o se realizó la compra
              </p>
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
            
            {/* Max Payment Date - only show for transfers */}
            {formData.payment_method === PaymentMethod.TRANSFER && (
              <div className="space-y-2">
                <Label htmlFor="max_payment_date">Fecha Máxima de Pago *</Label>
                <Input
                  id="max_payment_date"
                  type="date"
                  value={formData.max_payment_date || ""}
                  onChange={(e) => handleInputChange('max_payment_date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]} // Set minimum to today
                />
                <p className="text-sm text-muted-foreground">
                  Fecha límite para realizar la transferencia al proveedor
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notas Adicionales</Label>
              <Textarea
                id="notes"
                placeholder="Notas adicionales sobre el pedido especial"
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
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
                  value={selectedPlantId || ""}
                  onValueChange={setSelectedPlantId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la planta donde se realizará el pedido" />
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
                  Selecciona la planta para la cual se solicita este pedido especial
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items List - HIDDEN: Items will come from selected quotation */}
      <Card className="hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Calculator className="h-5 w-5" />
              <span>Artículos a Solicitar</span>
            </CardTitle>
          </div>
          <CardDescription>
            Los artículos serán definidos en cada cotización de proveedor
          </CardDescription>
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
                <div className="lg:col-span-3">
                  <Label htmlFor="new-item-description">Buscar Parte del Catálogo *</Label>
                  <PartAutocomplete
                    value={newItem.description || ""}
                    onSelect={handlePartSelect}
                    onManualEntry={handleManualPartEntry}
                    placeholder="Buscar por nombre o número de parte..."
                    showPartNumber={true}
                    allowManualEntry={true}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Busca en el catálogo de inventario o escribe manualmente
                  </p>
                </div>
                <div className="hidden">
                  <Label htmlFor="new-item-part-number">Número de Parte</Label>
                  <Input
                    id="new-item-part-number"
                    placeholder="P/N"
                    value={newItem.part_number || ""}
                    onChange={(e) => handleNewItemChange('part_number', e.target.value)}
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
                        <div className="space-y-1">
                          <Input
                            value={item.description}
                            onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                            placeholder="Descripción del artículo"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={item.part_number}
                              onChange={(e) => handleItemChange(item.id, 'part_number', e.target.value)}
                              placeholder="P/N"
                            />
                            {item.is_special_order && (
                              <Badge variant="secondary" className="justify-self-start text-xs mt-1">
                                <FileText className="h-3 w-3 mr-1" />
                                Especial
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.brand}
                          onChange={(e) => handleItemChange(item.id, 'brand', e.target.value)}
                          placeholder="Marca"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                          <Input
                            className="pl-6"
                            type="number"
                            step="0.01"
                            min={0}
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(item.id, 'unit_price', e.target.value)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${item.total_price.toLocaleString('es-MX', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min={1}
                            value={item.lead_time_days || 15}
                            onChange={(e) => handleItemChange(item.id, 'lead_time_days', Number(e.target.value))}
                          />
                          <span className="text-sm">d</span>
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
          disabled={isCreating || (items.length === 0 && quotations.length === 0)}
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