"use client"

import { useState, useEffect, useCallback } from "react"
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
  Building2,
  FileText,
  XCircle
} from "lucide-react"
import { PurchaseOrderType, PaymentMethod, CreatePurchaseOrderRequest, QuoteValidationResponse } from "@/types/purchase-orders"
import { QuotationValidator } from "./QuotationValidator"
import { QuotationFormForCreation } from "./QuotationFormForCreation"
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders"
import { createClient } from "@/lib/supabase"
import { useUserPlant } from "@/hooks/use-user-plant"
import { toast } from "sonner"
import { SupplierSelector } from "@/components/suppliers/SupplierSelector"
import { Supplier } from "@/types/suppliers"
import { PartAutocomplete, PartSuggestion } from "@/components/inventory/part-autocomplete"

interface DirectPurchaseFormProps {
  workOrderId?: string
  prefillSupplier?: string
  onSuccess?: (purchaseOrderId: string) => void
  onCancel?: () => void
}

interface PurchaseOrderItem {
  id: string
  name: string
  partNumber: string
  part_id?: string  // Link to inventory catalog
  quantity: number | string
  unit_price: number | string
  total_price: number
  supplier?: string
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

export function DirectPurchaseForm({ 
  workOrderId,
  prefillSupplier,
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
    supplier: "Por definir", // Will be set when quotation is selected (for purchases >= $5k)
    items: [],
    total_amount: 0,
    payment_method: PaymentMethod.CASH,
    notes: "",
    purchase_date: new Date().toISOString().split('T')[0], // Default to today
    max_payment_date: undefined
  })

  // Items management - NOT USED if quotation required (comes from quotations)
  const [items, setItems] = useState<PurchaseOrderItem[]>([])
  const [newItem, setNewItem] = useState<Partial<PurchaseOrderItem>>({
    name: '',
    partNumber: '',
    quantity: '',
    unit_price: '',
    total_price: 0
  })

  // Supplier - NOT SELECTED HERE if quotation required (comes from quotations)
  // Will be auto-populated when quotation is selected for purchases >= $5k
  const [recentSuppliers, setRecentSuppliers] = useState<string[]>([])
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  // Validation
  const [validationResult, setValidationResult] = useState<QuoteValidationResponse | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  
  // Quotation handling - structured quotations (always available, required if >= $5k)
  interface QuotationFormData {
    supplier_id?: string
    supplier_name: string
    quoted_amount: number
    quotation_items?: any[]
    delivery_days?: number
    payment_terms?: string
    validity_date?: Date
    notes?: string
    file?: File
    file_url?: string
    file_name?: string
  }
  const [quotations, setQuotations] = useState<QuotationFormData[]>([])

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
        let partsToLoad: PurchaseOrderItem[] = []
        
        if (workOrderData.required_parts) {
          try {
            const requiredParts = Array.isArray(workOrderData.required_parts) 
              ? workOrderData.required_parts 
              : JSON.parse(workOrderData.required_parts)
            
            // Load parts and try to match with catalog
            const partsWithIds = await Promise.all(
              requiredParts.map(async (part: any, index: number) => {
                const partNumber = part.partNumber || part.part_number || ''
                let part_id: string | undefined = part.part_id || part.id
                
                // If no part_id but has part_number, look it up in catalog
                if (!part_id && partNumber) {
                  try {
                    const { data: foundParts } = await supabase
                      .from('inventory_parts')
                      .select('id, part_number, name')
                      .eq('part_number', partNumber)
                      .eq('is_active', true)
                      .limit(1)
                      .maybeSingle()
                    
                    if (foundParts) {
                      part_id = foundParts.id
                    }
                  } catch (err) {
                    console.error(`Error looking up part ${partNumber}:`, err)
                  }
                }
                
                const item: PurchaseOrderItem = {
                  id: `wo-part-${index}`,
                  name: part.name || part.item || 'Artículo',
                  partNumber: partNumber,
                  part_id: part_id,
                  quantity: Number(part.quantity) || 1,
                  unit_price: Number(part.unit_price) || Number(part.price) || 0,
                  total_price: Number(part.total_price) || (Number(part.quantity) || 1) * (Number(part.unit_price) || Number(part.price) || 0),
                  fulfill_from: 'purchase'  // Default to purchase, will be checked later
                }
                
                return item
              })
            )
            
            partsToLoad = partsWithIds
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

  // Check availability for an item
  const checkItemAvailability = useCallback(async (item: PurchaseOrderItem) => {
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
  }, [workOrder])

  // Calculate total amount whenever items change
  useEffect(() => {
    const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0)
    setFormData(prev => ({ ...prev, total_amount: total, items }))
  }, [items])

  // Check availability for items loaded from work order that have part_id but no availability yet
  useEffect(() => {
    if (!workOrderId || items.length === 0) return
    
    const plantId = workOrder?.plant_id || workOrder?.asset?.plant_id
    if (!plantId) return
    
    // Check availability for items that have part_id but no availability data yet
    items.forEach((item) => {
      if (item.part_id && !item.availability) {
        // Use a small delay to avoid race conditions
        setTimeout(() => {
          checkItemAvailability(item)
        }, 100)
      }
    })
  }, [items, workOrder, workOrderId, checkItemAvailability])

  // Auto-set supplier to "Inventario Interno" when all items are from inventory
  useEffect(() => {
    if (workOrderId && items.length > 0 && !validationResult?.requires_quote) {
      const poPurpose = calculatePOPurpose(items)
      if (poPurpose === 'work_order_inventory') {
        setFormData(prev => ({ ...prev, supplier: 'Inventario Interno' }))
        setSelectedSupplier(null) // Clear selected supplier
      } else if (poPurpose !== 'work_order_inventory' && formData.supplier === 'Inventario Interno') {
        // Reset to default if not all inventory
        setFormData(prev => ({ ...prev, supplier: prev.supplier === 'Inventario Interno' ? 'Por definir' : prev.supplier }))
      }
    }
  }, [items, workOrderId, validationResult?.requires_quote])

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

  // Handle part selection from autocomplete
  const handlePartSelect = (part: PartSuggestion | null) => {
    if (part) {
      const updatedItem = {
        name: part.name,
        partNumber: part.part_number,
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
        name: '',
        partNumber: '',
        part_id: undefined,
        fulfill_from: undefined
      }))
    }
  }

  // Handle manual entry when part not in catalog
  const handleManualPartEntry = (text: string) => {
    // User is typing manually - update the name field
    setNewItem(prev => ({
      ...prev,
      name: text,
      // Keep partNumber if it was already set, otherwise clear it
      partNumber: prev.partNumber || ''
    }))
  }

  // Add new item to list
  const addItem = async () => {
    if (!newItem.name || !newItem.quantity || !newItem.unit_price) {
      setFormErrors(['Nombre, cantidad y precio unitario son requeridos'])
      return
    }

    const item: PurchaseOrderItem = {
      id: `item-${Date.now()}`,
      name: newItem.name || '',
      partNumber: newItem.partNumber || '',
      part_id: newItem.part_id,
      quantity: Number(newItem.quantity) || 0,
      unit_price: Number(newItem.unit_price) || 0,
      total_price: Number(newItem.total_price) || 0,
      fulfill_from: newItem.fulfill_from || 'purchase'  // Default to purchase
    }

    // Check availability if part_id exists
    if (item.part_id) {
      await checkItemAvailability(item)
    }

    setItems(prev => [...prev, item])
    setNewItem({
      name: '',
      partNumber: '',
      part_id: undefined,
      quantity: '',
      unit_price: '',
      total_price: 0,
      fulfill_from: undefined
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
      
      // Re-check availability if quantity or part_id changes
      if ((field === 'quantity' || field === 'part_id') && updated.part_id) {
        // Use setTimeout to avoid race conditions
        setTimeout(() => checkItemAvailability(updated), 100)
      }
      
      return updated
    }))
  }

  // Calculate PO purpose based on item selections
  const calculatePOPurpose = (items: PurchaseOrderItem[]): string => {
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

    // Supplier validation - Only required if quotation NOT required
    if (!validationResult?.requires_quote && !formData.supplier?.trim()) {
      errors.push('Proveedor es requerido para compras menores a $5,000')
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

    // Items validation - Only required if quotation NOT required
    if (!validationResult?.requires_quote && items.length === 0) {
      errors.push('Debe agregar al menos un artículo')
    }
    
    // Quotation validation - Required if >= $5,000
    if (validationResult?.requires_quote && quotations.length === 0) {
      errors.push('Se requiere al menos una cotización con información del proveedor y precio para compras mayores o iguales a $5,000 MXN')
    }

    if (formData.total_amount === 0) {
      errors.push('El monto total debe ser mayor a cero')
    }

    // Validate purchase_date is required
    if (!formData.purchase_date) {
      errors.push('La fecha de compra es obligatoria')
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
      
      // Determine supplier based on po_purpose and whether quotations are used
      let finalSupplier = formData.supplier || "Por definir"
      let finalItems = items
      
      // Auto-set supplier to "Inventario Interno" if all items are from inventory
      if (po_purpose === 'work_order_inventory') {
        finalSupplier = 'Inventario Interno'
      }
      
      // If quotations exist, use placeholder values (will be updated when quotation is selected)
      if (quotations.length > 0) {
        finalSupplier = "Por definir" // Will be set when quotation is selected
        finalItems = [] // Will be populated from selected quotation
      }

      const request: CreatePurchaseOrderRequest = {
        work_order_id: workOrderId,
        po_type: PurchaseOrderType.DIRECT_PURCHASE,
        po_purpose: po_purpose,
        supplier: finalSupplier,
        items: finalItems,
        total_amount: formData.total_amount!,
        payment_method: formData.payment_method,
        notes: formData.notes,
        purchase_date: formData.purchase_date,
        max_payment_date: formData.payment_method === PaymentMethod.TRANSFER ? formData.max_payment_date : undefined,
        // Include plant_id for standalone orders
        ...(selectedPlantId && { plant_id: selectedPlantId })
      }

      const result = await createPurchaseOrder(request)
      
      // Validate that PO was created successfully
      if (!result || !result.id) {
        throw new Error('No se pudo crear la orden de compra. Por favor intente nuevamente.')
      }
      
      console.log('Purchase order created:', { id: result.id, order_id: result.order_id })
      
      // Create quotations if provided (always create if quotations exist, regardless of amount)
      if (quotations.length > 0) {
        try {
          // Upload files first (if any) - this provides natural delay and ensures files are ready
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          
          if (user) {
            // Upload files first, then create quotations (same pattern as DirectServiceForm/SpecialOrderForm)
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
              
              // Update quotation with file URL
              quotation.file_url = fileUrl
            }
          }
          
          // Additional delay to ensure PO is fully committed to database (after file uploads)
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          for (const quotation of quotations) {
            // Format validity_date if it's a Date object
            let validityDateStr: string | undefined = undefined
            if (quotation.validity_date) {
              if (quotation.validity_date instanceof Date) {
                validityDateStr = quotation.validity_date.toISOString().split('T')[0]
              } else if (typeof quotation.validity_date === 'string') {
                validityDateStr = quotation.validity_date
              }
            }
            
            // Ensure quotation_items is an array
            const quotationItems = Array.isArray(quotation.quotation_items) 
              ? quotation.quotation_items 
              : []
            
            const quotationPayload = {
              purchase_order_id: result.id,
              supplier_id: quotation.supplier_id || undefined,
              supplier_name: quotation.supplier_name,
              quoted_amount: quotation.quoted_amount,
              quotation_items: quotationItems,
              delivery_days: quotation.delivery_days || undefined,
              payment_terms: quotation.payment_terms || undefined,
              validity_date: validityDateStr,
              notes: quotation.notes || undefined,
              file_url: quotation.file_url || undefined, // Now includes uploaded file URL if file was provided
              file_name: quotation.file_name || undefined
            }
            
            console.log('Creating quotation for PO:', result.id, 'Payload:', quotationPayload)
            
            const response = await fetch('/api/purchase-orders/quotations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(quotationPayload)
            })
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: response.statusText }))
              console.error('Quotation creation error:', {
                status: response.status,
                statusText: response.statusText,
                errorData,
                purchase_order_id: result.id,
                quotationPayload
              })
              throw new Error(`Failed to create quotation: ${errorData.error || response.statusText}`)
            }
            
            const quotationResult = await response.json()
            console.log('Quotation created successfully:', quotationResult)
          }
          toast.success(`Compra creada con ${quotations.length} cotización${quotations.length > 1 ? 'es' : ''}`)
        } catch (quotationError) {
          console.error('Error creating quotations:', quotationError)
          toast.warning('Compra creada pero hubo un error al guardar las cotizaciones. Puede agregarlas después.')
        }
      }
      
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
                Ferretería, tienda local, refacciones básicas - {formData.total_amount && formData.total_amount >= 5000 ? 'Requiere cotización por ser mayor o igual a $5,000' : 'Sin cotización requerida'}
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

      {/* Basic Information - ALWAYS VISIBLE (dates and payment method) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información Básica</CardTitle>
          <CardDescription>
            Fechas y método de pago requeridos para todas las compras
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Purchase Date - ALWAYS REQUIRED */}
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

            {/* Payment Method - ALWAYS REQUIRED */}
            <div className="space-y-2">
              <Label htmlFor="payment_method">Método de Pago *</Label>
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
                <Label htmlFor="max_payment_date">Fecha Máxima de Pago *</Label>
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

      {/* Supplier Information - Only show if quotation NOT required */}
      {!validationResult?.requires_quote && (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información del Proveedor</CardTitle>
          <CardDescription>
            Para compras menores a $5,000, el proveedor se define aquí
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proveedor *</Label>
              {(() => {
                const poPurpose = calculatePOPurpose(items)
                const isInventoryOnly = poPurpose === 'work_order_inventory' && workOrderId
                
                if (isInventoryOnly) {
                  return (
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
                      <Package className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Inventario Interno</span>
                      <Badge variant="outline" className="ml-auto">Automático</Badge>
                    </div>
                  )
                }
                
                return (
                  <SupplierSelector
                    value={selectedSupplier?.id}
                    onChange={(supplier) => {
                      setSelectedSupplier(supplier)
                      handleInputChange('supplier', supplier?.name || '')
                    }}
                    placeholder="Seleccionar proveedor"
                    showPerformance={true}
                    allowManualInput={true}
                    onManualInputChange={(name) => {
                      handleInputChange('supplier', name)
                    }}
                    businessUnitId={userPlants?.[0]?.business_unit_id}
                  />
                )
              })()}
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Show message if quotation IS required */}
      {validationResult?.requires_quote && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Proveedor:</strong> Para compras mayores o iguales a $5,000, 
            el proveedor será seleccionado de las cotizaciones comparadas. 
            Agregue cotizaciones de diferentes proveedores más abajo.
          </AlertDescription>
        </Alert>
      )}

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

      {/* Informative Alerts - Show inventory vs purchase summary */}
      {!validationResult?.requires_quote && items.length > 0 && workOrderId && (() => {
        const poPurpose = calculatePOPurpose(items)
        const inventoryItems = items.filter(i => i.fulfill_from === 'inventory')
        const purchaseItems = items.filter(i => i.fulfill_from === 'purchase' || !i.fulfill_from)
        const inventoryTotal = inventoryItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
        const purchaseTotal = purchaseItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
        
        if (poPurpose === 'work_order_inventory') {
          return (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Esta orden utilizará solo inventario interno.</strong> No requiere efectivo este mes, solo autorización para usar el inventario.
              </AlertDescription>
            </Alert>
          )
        } else if (poPurpose === 'mixed') {
          return (
            <Alert className="border-yellow-500 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Esta orden incluye items de inventario y compras.</strong> Items de inventario: ${inventoryTotal.toFixed(2)} (sin efectivo). Items a comprar: ${purchaseTotal.toFixed(2)}. Impacto en efectivo: ${purchaseTotal.toFixed(2)}
              </AlertDescription>
            </Alert>
          )
        } else if (poPurpose === 'work_order_cash') {
          return (
            <Alert className="border-blue-500 bg-blue-50">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Esta orden requiere efectivo:</strong> ${purchaseTotal.toFixed(2)}
              </AlertDescription>
            </Alert>
          )
        }
        return null
      })()}

      {/* Items Section - Only show if quotation NOT required */}
      {!validationResult?.requires_quote && (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Artículos a Comprar</CardTitle>
          <CardDescription>
            Agregue los artículos que necesita comprar. Seleccione la fuente (inventario o compra) para cada item.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Item */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <h4 className="font-medium mb-3">Agregar Artículo</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <Label htmlFor="item_name">Buscar Parte del Catálogo</Label>
                <PartAutocomplete
                  value={newItem.name || ""}
                  onSelect={handlePartSelect}
                  onManualEntry={handleManualPartEntry}
                  placeholder="Buscar por nombre o número de parte..."
                  showPartNumber={true}
                  allowManualEntry={true}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Busca en el catálogo o escribe manualmente si no está en el catálogo
                </p>
              </div>

              <div className="hidden">
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
                    <TableHead>Disponibilidad</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const availability = item.availability
                    const hasPartId = !!item.part_id
                    
                    return (
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
                          {hasPartId && availability ? (
                            availability.sufficient ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Disponible ({availability.total_available})
                              </Badge>
                            ) : availability.total_available > 0 ? (
                              <Badge variant="secondary" className="gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Parcial ({availability.total_available}/{item.quantity})
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Sin Stock
                              </Badge>
                            )
                          ) : hasPartId ? (
                            <Badge variant="outline" className="gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verificando...
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              No en catálogo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.fulfill_from || 'purchase'}
                            onValueChange={(value: 'inventory' | 'purchase') => updateItem(item.id, 'fulfill_from', value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inventory">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4" />
                                  De Inventario
                                </div>
                              </SelectItem>
                              <SelectItem value="purchase">
                                <div className="flex items-center gap-2">
                                  <ShoppingCart className="h-4 w-4" />
                                  A Comprar
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {item.availability?.sufficient && !item.fulfill_from && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Disponible - sugerido
                            </p>
                          )}
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
                    )
                  })}
                </TableBody>
              </Table>

              {/* Enhanced Total Summary */}
              <div className="p-4 border-t bg-muted/30 space-y-2">
                {(() => {
                  const inventoryItems = items.filter(i => i.fulfill_from === 'inventory')
                  const purchaseItems = items.filter(i => i.fulfill_from === 'purchase' || !i.fulfill_from)
                  const inventoryTotal = inventoryItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
                  const purchaseTotal = purchaseItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
                  const poPurpose = calculatePOPurpose(items)
                  
                  return (
                    <>
                      {inventoryItems.length > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Total Items de Inventario:
                          </span>
                          <span className="font-medium text-green-600">
                            ${inventoryTotal.toFixed(2)} (sin impacto en efectivo)
                          </span>
                        </div>
                      )}
                      {purchaseItems.length > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4" />
                            Total Items a Comprar:
                          </span>
                          <span className="font-medium text-orange-600">
                            ${purchaseTotal.toFixed(2)} (requiere efectivo)
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="font-medium">Total General:</span>
                        <span className="text-lg font-bold">
                          ${formData.total_amount?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      )}

      {/* Show message if quotation IS required for items */}
      {validationResult?.requires_quote && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Artículos:</strong> Para compras mayores o iguales a $5,000, 
            los artículos se definen en cada cotización de proveedor. 
            Agregue cotizaciones más abajo con los artículos y precios de cada proveedor.
          </AlertDescription>
        </Alert>
      )}

      {/* Quotations Section - ALWAYS VISIBLE, required if >= $5k */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <CardTitle className="text-lg">Cotizaciones de Proveedores</CardTitle>
            </div>
            {validationResult?.requires_quote && (
              <Badge variant="destructive">Obligatorio</Badge>
            )}
            {!validationResult?.requires_quote && (
              <Badge variant="secondary">Opcional</Badge>
            )}
          </div>
          <CardDescription>
            {validationResult?.requires_quote ? (
              <>
                Esta compra por ${(formData.total_amount || 0).toLocaleString('es-MX')} requiere cotización 
                por ser mayor o igual a $5,000 MXN. Agregue al menos una cotización con proveedor y precios.
              </>
            ) : (
              <>
                Opcional: Puede agregar cotizaciones para comparar proveedores, incluso para compras menores a $5,000.
                Si agrega cotizaciones, el proveedor y artículos se tomarán de la cotización seleccionada.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuotationFormForCreation
            quotations={quotations}
            onQuotationsChange={(newQuotations) => {
              setQuotations(newQuotations)
              setFormErrors(prev => prev.filter(error => !error.includes('cotización')))
              
              // Update total amount if quotations exist (for display)
              if (newQuotations.length > 0 && validationResult?.requires_quote) {
                const avgTotal = newQuotations.reduce((sum, q) => sum + q.quoted_amount, 0) / newQuotations.length
                setFormData(prev => ({ ...prev, total_amount: avgTotal }))
              }
            }}
            workOrderId={workOrderId}
          />
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
          disabled={
            isCreating || 
            (!validationResult?.requires_quote && items.length === 0) ||
            (validationResult?.requires_quote && quotations.length === 0)
          }
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