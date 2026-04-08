"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
  XCircle,
  ChevronDown
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
import { buildPurchaseOrderRoutingContext } from "@/lib/purchase-orders/routing-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { PurchaseOrderCreationReviewDialog } from "@/components/purchase-orders/creation/PurchaseOrderCreationReviewDialog"
import { getCreationWorkflowSummaryLines } from "@/lib/purchase-orders/creation-workflow-copy"
import {
  getIntentVersusLinesErrors,
  getIntentVersusLinesSoftWarning,
} from "@/lib/purchase-orders/wo-line-intent-validation"

interface SpecialOrderFormProps {
  workOrderId?: string
  prefillSupplier?: string
  woLineSourceIntent?: 'inventory' | 'mixed' | 'purchase'
  onSuccess?: (purchaseOrderId: string) => void
  onCancel?: () => void
}

function pickWarehouseForIssueSpecial(
  warehouses: Array<{ warehouse_id: string; available_quantity: number }>,
  qty: number
): string | undefined {
  if (!warehouses?.length) return undefined
  const qtyN = Number(qty) || 0
  const best = warehouses
    .filter((w) => w.available_quantity >= qtyN)
    .sort((a, b) => b.available_quantity - a.available_quantity)[0]
  return (best ?? warehouses[0]).warehouse_id
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
  warehouse_id?: string  // Selected warehouse when fulfill_from=inventory
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
  type?: string
  description: string
  required_parts?: unknown
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
  woLineSourceIntent,
  onSuccess, 
  onCancel 
}: SpecialOrderFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const { createPurchaseOrder, isCreating, error, clearError } = usePurchaseOrders()
  const { userPlants, loading: plantsLoading } = useUserPlant()
  const launchWorkOrderType = searchParams.get("workOrderType")

  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSoftWarning, setReviewSoftWarning] = useState<string | null>(null)

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

  // Line items: optional catalog lines with fulfill_from (inventory vs purchase); quotations still capture supplier pricing
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
  
  // Supplier suggestions and recent suppliers
  const [recentSuppliers, setRecentSuppliers] = useState<string[]>([])
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([])
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false)

  // Validation
  const [validationResult, setValidationResult] = useState<QuoteValidationResponse | null>(null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  
  // Quotation handling - structured quotations with supplier info
  interface QuotationFormData {
    supplier_id?: string
    supplier_name: string
    quoted_amount: number
    quotation_items: unknown[]
    delivery_days?: number
    payment_terms?: string
    validity_date?: Date
    notes?: string
    file?: File
    file_url?: string
    file_storage_path?: string
    file_name?: string
  }
  const [quotations, setQuotations] = useState<QuotationFormData[]>([])

  const normalizeQuotations = (nextQuotations: QuotationFormData[]): QuotationFormData[] =>
    nextQuotations.map((quotation) => ({
      ...quotation,
      quotation_items: Array.isArray(quotation.quotation_items) ? quotation.quotation_items : [],
    }))
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
            
            partsToLoad = await Promise.all(requiredParts.map(async (part, index: number) => {
              const partRecord = part as Record<string, unknown>
              const partNumber =
                typeof partRecord.partNumber === 'string'
                  ? partRecord.partNumber
                  : typeof partRecord.part_number === 'string'
                    ? partRecord.part_number
                    : ''
              let part_id =
                typeof partRecord.part_id === 'string'
                  ? partRecord.part_id
                  : typeof partRecord.id === 'string'
                    ? partRecord.id
                    : undefined
              if (!part_id && partNumber) {
                try {
                  const { data: foundParts } = await supabase
                    .from('inventory_parts')
                    .select('id')
                    .eq('part_number', partNumber)
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle()
                  if (foundParts) part_id = foundParts.id
                } catch {
                  /* ignore */
                }
              }
              return {
                id: `wo-part-${index}`,
                part_number: partNumber,
                description:
                  typeof partRecord.name === 'string'
                    ? partRecord.name
                    : typeof partRecord.item === 'string'
                      ? partRecord.item
                      : typeof partRecord.description === 'string'
                        ? partRecord.description
                        : 'Artículo',
                brand: typeof partRecord.brand === 'string' ? partRecord.brand : '',
                quantity: Number(partRecord.quantity) || 1,
                unit_price: Number(partRecord.unit_price) || Number(partRecord.price) || 0,
                total_price:
                  Number(partRecord.total_price) ||
                  (Number(partRecord.quantity) || 1) *
                    (Number(partRecord.unit_price) || Number(partRecord.price) || 0),
                lead_time_days: Number(partRecord.lead_time_days) || 15,
                is_special_order: true,
                part_id,
                fulfill_from:
                  woLineSourceIntent === 'inventory'
                    ? ('inventory' as const)
                    : ('purchase' as const)
              }
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
  }, [workOrderId, woLineSourceIntent])

  // Calculate total amount whenever items change
  useEffect(() => {
    const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0)
    setFormData(prev => ({ ...prev, total_amount: total, items }))
  }, [items])

  const effectivePlantId =
    workOrder?.plant_id || workOrder?.asset?.plant_id || selectedPlantId || undefined

  // Handle form input changes
  const handleInputChange = (field: string, value: unknown) => {
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
  const handleNewItemChange = (field: string, value: unknown) => {
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

    const plantId = effectivePlantId
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
          const updated: OrderItem = {
            ...i,
            availability: {
              sufficient: data.sufficient,
              total_available: data.total_available,
              available_by_warehouse: data.available_by_warehouse || []
            }
          }
          if (data.sufficient && !updated.fulfill_from) {
            updated.fulfill_from = 'inventory'
          }
          if (
            updated.fulfill_from === 'inventory' &&
            updated.availability.available_by_warehouse?.length &&
            !updated.warehouse_id
          ) {
            updated.warehouse_id = pickWarehouseForIssueSpecial(
              updated.availability.available_by_warehouse,
              Number(updated.quantity) || 0
            )
          }
          return updated
        }))
      }
    } catch (err) {
      console.error('Availability check failed:', err)
    }
  }

  const itemsForAvailabilityRef = useRef(items)
  itemsForAvailabilityRef.current = items

  useEffect(() => {
    if (!effectivePlantId) return
    for (const row of itemsForAvailabilityRef.current) {
      if (row.part_id) void checkItemAvailability(row)
    }
    // Re-fetch when plant context changes; line-level checks happen in addItem/handleItemChange
  // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-running on every items edit
  }, [effectivePlantId])

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
      
      const plantId = effectivePlantId
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

    setItems(prev => [...prev, item])
    
    // Check availability after insertion so state hydration can attach the result.
    if (item.part_id) {
      setTimeout(() => {
        void checkItemAvailability(item)
      }, 0)
    }

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
  const handleItemChange = (itemId: string, field: keyof OrderItem, value: unknown) => {
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

    // Inventory items must have warehouse selected
    const inventoryWithoutWarehouse = items.filter(i => i.fulfill_from === 'inventory' && !i.warehouse_id)
    if (inventoryWithoutWarehouse.length > 0) {
      errors.push(`Seleccione el almacén de origen para los items de inventario`)
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

    if (workOrderId && woLineSourceIntent) {
      errors.push(...getIntentVersusLinesErrors(woLineSourceIntent, items))
    }

    setFormErrors(errors)
    return errors.length === 0
  }

  const woTypeForPolicy = workOrder?.type ?? launchWorkOrderType

  const formatWoTypeLabel = (t?: string | null): string | null => {
    if (!t) return null
    const n = t.trim().toLowerCase()
    if (n === 'preventive' || n === 'preventivo') return 'Preventivo'
    if (n === 'corrective' || n === 'correctivo') return 'Correctivo'
    return t
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    if (workOrderId && woLineSourceIntent) {
      setReviewSoftWarning(getIntentVersusLinesSoftWarning(woLineSourceIntent, items))
    } else {
      setReviewSoftWarning(null)
    }

    setReviewOpen(true)
  }

  const performCreate = async () => {
    try {
      setReviewSubmitting(true)
      const normalizedQuotations = normalizeQuotations(quotations)
      const isStandaloneQuoteFirstDraft = !workOrderId && items.length === 0 && quotations.length > 0
      const requestItems = isStandaloneQuoteFirstDraft ? [] : items
      // For quote-first drafts: derive provisional total_amount from first quotation so PO can be created
      const requestTotalAmount = isStandaloneQuoteFirstDraft
        ? (normalizedQuotations[0]?.quoted_amount ?? 0)
        : (formData.total_amount || 0)

      const submissionRoutingContext = buildPurchaseOrderRoutingContext({
        poType: PurchaseOrderType.SPECIAL_ORDER,
        workOrderId,
        workOrderType: woTypeForPolicy,
        totalAmount: requestTotalAmount,
        quotationAmounts: normalizedQuotations.map((quotation) => quotation.quoted_amount),
        quotationPaymentTerms: normalizedQuotations.map((quotation) => quotation.payment_terms),
        paymentMethod: formData.payment_method,
        items: requestItems.map((item) => ({
          fulfill_from: item.fulfill_from,
          total_price: item.total_price,
        })),
      })

      // Determine supplier based on po_purpose
      let finalSupplier = isStandaloneQuoteFirstDraft
        ? "Proveedor por seleccionar"
        : (formData.supplier || "Por definir")
      
      // Auto-set supplier to "Inventario Interno" if all items are from inventory
      if (submissionRoutingContext.poPurpose === 'work_order_inventory') {
        finalSupplier = 'Inventario Interno'
      }
      
      // Create the base request object
      const request: CreatePurchaseOrderRequest = {
        work_order_id: workOrderId || undefined,
        po_type: PurchaseOrderType.SPECIAL_ORDER,
        po_purpose: submissionRoutingContext.poPurpose,
        work_order_type: submissionRoutingContext.workOrderType || undefined,
        approval_amount: submissionRoutingContext.approvalAmount,
        approval_amount_source: submissionRoutingContext.approvalAmountSource,
        payment_condition: submissionRoutingContext.paymentCondition,
        supplier: finalSupplier,
        items: requestItems,
        total_amount: requestTotalAmount,
        payment_method: formData.payment_method,
        notes: formData.notes,
        purchase_date: formData.purchase_date,
        quotation_urls: quotationUrls.length > 0 ? quotationUrls : undefined,
        quotation_amounts: normalizedQuotations.map((quotation) => quotation.quoted_amount),
        quotation_payment_terms: normalizedQuotations
          .map((quotation) => quotation.payment_terms)
          .filter((paymentTerms): paymentTerms is string => Boolean(paymentTerms)),
        quotation_url: quotationUrl || undefined, // Legacy fallback
        ...(formData.max_payment_date && { max_payment_date: formData.max_payment_date })
      }

      // Include plant_id: from work order for WO-based, or selected for standalone
      if (selectedPlantId) {
        request.plant_id = selectedPlantId as string
      } else if (workOrderId && workOrder && (workOrder.plant_id || workOrder.asset?.plant_id)) {
        request.plant_id = workOrder.plant_id ?? workOrder.asset?.plant_id
      }

      const result = await createPurchaseOrder(request, {
        suppressSuccessToast: normalizedQuotations.length > 0,
      })
      
      if (result) {
        // Create quotations after PO is created
        if (normalizedQuotations.length > 0) {
          try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user) {
              throw new Error('No se pudo autenticar al usuario para guardar las cotizaciones.')
            }

            // Upload files first, then create quotations
            for (const quotation of normalizedQuotations) {
              if (quotation.file && !quotation.file_storage_path && !quotation.file_url) {
                const folderName = workOrderId || result.id
                const sanitizedFileName = quotation.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
                const fileName = `${folderName}/${Date.now()}_${sanitizedFileName}`

                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('quotations')
                  .upload(fileName, quotation.file, { cacheControl: '3600', upsert: false })

                if (uploadError || !uploadData) {
                  throw new Error(uploadError?.message || 'No se pudo subir el archivo de cotización.')
                }

                quotation.file_storage_path = uploadData.path
              }

              // Create quotation via API
              const quotationRequest = {
                purchase_order_id: result.id,
                supplier_id: quotation.supplier_id,
                supplier_name: quotation.supplier_name,
                quoted_amount: quotation.quoted_amount,
                quotation_items: quotation.quotation_items || undefined, // Include item-level pricing
                delivery_days: quotation.delivery_days,
                payment_terms: quotation.payment_terms,
                validity_date: quotation.validity_date ? format(quotation.validity_date, 'yyyy-MM-dd') : undefined,
                notes: quotation.notes,
                file_storage_path: quotation.file_storage_path,
                file_url: quotation.file_url,
                file_name: quotation.file_name
              }
              
              const response = await fetch('/api/purchase-orders/quotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quotationRequest)
              })

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }))
                throw new Error(errorData.error || response.statusText || 'No se pudo guardar la cotización.')
              }
            }
          } catch (error) {
            console.error('Error creating quotations:', error)
            const message = error instanceof Error ? error.message : 'No se pudieron guardar las cotizaciones.'
            let rollbackMessage = 'No se pudo verificar la reversión automática de la orden borrador.'
            try {
              const rollbackResponse = await fetch(`/api/purchase-orders/${result.id}`, {
                method: 'DELETE',
              })
              const rollbackPayload = await rollbackResponse.json().catch(() => ({}))
              rollbackMessage = rollbackResponse.ok
                ? 'La orden borrador se revirtió automáticamente.'
                : `No se pudo revertir automáticamente la orden borrador: ${rollbackPayload.error || rollbackResponse.statusText}`
            } catch (rollbackError) {
              console.error('Error rolling back draft purchase order:', rollbackError)
            }
            setFormErrors([
              `No se completó la creación estricta de la OC ${result.order_id}. ${message} ${rollbackMessage}`,
            ])
            toast.error(`No se pudo completar la OC ${result.order_id} con sus cotizaciones.`)
            setReviewOpen(false)
            return
          }

          toast.success(`Pedido especial creado con ${normalizedQuotations.length} cotización${normalizedQuotations.length > 1 ? 'es' : ''}`)
        }
        
        setReviewOpen(false)
        if (onSuccess) {
          onSuccess(result.id)
        } else {
          router.push(`/compras/${result.id}`)
        }
      }
    } catch (error) {
      console.error('Error creating special order:', error)
      setReviewOpen(false)
    } finally {
      setReviewSubmitting(false)
    }
  }

  // Purchase items (for prefill and quote) - items marked for purchase, not inventory
  const purchaseItems = items.filter(i => i.fulfill_from !== 'inventory')
  // Estimated delivery - only from items to purchase (inventory items are already in stock)
  const estimatedDeliveryDays = purchaseItems.length > 0 
    ? Math.max(...purchaseItems.map(item => item.lead_time_days || 15))
    : 15
  const prefillItems = purchaseItems.map(i => ({
    description: i.description,
    part_number: i.part_number,
    quantity: Number(i.quantity) || 1,
    unit_price: Number(i.unit_price) || 0,
    total_price: Number(i.total_price) || 0,
    brand: i.brand,
    part_id: i.part_id
  }))
  const routingContext = buildPurchaseOrderRoutingContext({
    poType: PurchaseOrderType.SPECIAL_ORDER,
    workOrderId,
    workOrderType: woTypeForPolicy,
    totalAmount: formData.total_amount,
    paymentMethod: formData.payment_method,
    quotationAmounts: quotations.map((quotation) => quotation.quoted_amount),
    quotationPaymentTerms: quotations.map((quotation) => quotation.payment_terms),
    items: items.map((item) => ({
      fulfill_from: item.fulfill_from,
      total_price: item.total_price,
    })),
  })

  const normalizedQuotationsPreview = normalizeQuotations(quotations)
  const isStandaloneQuoteFirstPreview =
    !workOrderId && items.length === 0 && quotations.length > 0
  const previewRequestItems = isStandaloneQuoteFirstPreview ? [] : items
  const previewTotalAmountSpecial = isStandaloneQuoteFirstPreview
    ? (normalizedQuotationsPreview[0]?.quoted_amount ?? 0)
    : (formData.total_amount || 0)
  const reviewRoutingPreview = buildPurchaseOrderRoutingContext({
    poType: PurchaseOrderType.SPECIAL_ORDER,
    workOrderId,
    workOrderType: woTypeForPolicy,
    totalAmount: previewTotalAmountSpecial,
    paymentMethod: formData.payment_method,
    quotationAmounts: normalizedQuotationsPreview.map((q) => q.quoted_amount),
    quotationPaymentTerms: normalizedQuotationsPreview.map((q) => q.payment_terms),
    items: previewRequestItems.map((item) => ({
      fulfill_from: item.fulfill_from,
      total_price: item.total_price,
    })),
  })
  const reviewWorkflowLines = getCreationWorkflowSummaryLines({
    poPurpose: reviewRoutingPreview.poPurpose,
    workOrderType: reviewRoutingPreview.workOrderType,
    approvalAmount: reviewRoutingPreview.approvalAmount,
  })
  const reviewInventoryCount = previewRequestItems.filter(
    (i) => i.fulfill_from === 'inventory'
  ).length
  const reviewPurchaseCount = Math.max(0, previewRequestItems.length - reviewInventoryCount)

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
    <>
      <PurchaseOrderCreationReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onConfirm={performCreate}
        isSubmitting={reviewSubmitting || isCreating}
        poTypeLabel="Pedido especial"
        poPurpose={reviewRoutingPreview.poPurpose}
        workOrderTypeLabel={formatWoTypeLabel(woTypeForPolicy)}
        approvalAmount={reviewRoutingPreview.approvalAmount}
        totalAmount={previewTotalAmountSpecial}
        inventoryLineCount={reviewInventoryCount}
        purchaseLineCount={reviewPurchaseCount}
        workOrderId={workOrderId}
        workOrderOrderId={workOrder?.order_id ?? null}
        workflowHintLines={reviewWorkflowLines}
        softWarning={reviewSoftWarning}
      />
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
            Cotización formal sigue siendo obligatoria. Puede agregar líneas desde el catálogo y elegir surtido desde almacén o compra; las partidas de compra se reflejan en las cotizaciones.
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

      {/* Plant first on standalone so availability checks use the correct plant */}
      {!workOrderId && (
        <Card>
          {isMobile ? (
            <Collapsible defaultOpen={!!selectedPlantId}>
              <CardHeader asChild>
                <CollapsibleTrigger className="w-full text-left hover:no-underline group">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Building2 className="h-5 w-5" />
                      <span>Selección de Planta</span>
                    </CardTitle>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
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
                  Necesaria para consultar disponibilidad por almacén al elegir refacciones del catálogo
                </p>
              </div>
            )}
          </CardContent>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Building2 className="h-5 w-5" />
                  <span>Selección de Planta</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {plantsLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Cargando plantas...</span>
                  </div>
                ) : userPlants.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No tienes acceso a ninguna planta. Contacta al administrador.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="plant_selector">Planta *</Label>
                    <Select value={selectedPlantId || ""} onValueChange={setSelectedPlantId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona la planta donde se realizará el pedido" />
                      </SelectTrigger>
                      <SelectContent>
                        {userPlants.map((plant) => (
                          <SelectItem key={plant.plant_id} value={plant.plant_id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{plant.plant_name}</span>
                              {plant.business_unit_name && <span className="text-xs text-muted-foreground">{plant.business_unit_name}</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Necesaria para consultar disponibilidad por almacén al elegir refacciones del catálogo
                    </p>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      )}

      {/* Line items: set fulfill_from; purchase lines pre-fill quotations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>
                {workOrderId ? "Artículos de la Orden de Trabajo" : "Refacciones y materiales (opcional)"}
              </span>
            </CardTitle>
          </div>
          <CardDescription>
            {workOrderId
              ? "Seleccione el origen por artículo (Inventario o Compra). Las líneas de compra pre-llenan las cotizaciones."
              : "Agregue líneas del catálogo si aplica. Elija Inventario o Compra por línea; la compra sigue documentándose en las cotizaciones."}
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
              <div className={isMobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3"}>
                <div className={isMobile ? "" : "lg:col-span-3"}>
                  <Label htmlFor="new-item-description">Buscar Parte del Catálogo *</Label>
                  <PartAutocomplete
                    value={newItem.description || ""}
                    onSelect={handlePartSelect}
                    onManualEntry={handleManualPartEntry}
                    placeholder="Buscar por nombre o número de parte..."
                    showPartNumber={true}
                    allowManualEntry={true}
                    popoverSide={isMobile ? "top" : undefined}
                    inModalContext={isMobile}
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
                <Button type="button" onClick={addItem} size={isMobile ? "default" : "sm"} className={isMobile ? "min-h-[44px] w-full" : ""}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items List */}
          {items.length > 0 && (
            <div className="border rounded-lg">
              {isMobile ? (
                <div className="p-4 space-y-3">
                  {items.map((item) => {
                    const isInventory = item.fulfill_from === 'inventory'
                    return (
                      <Card key={item.id} className={`p-4 space-y-2 ${isInventory ? "bg-green-50/70 border-green-200" : ""}`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 space-y-1">
                            <Input
                              value={item.description}
                              onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                              placeholder="Descripción"
                              className="min-h-[44px] font-medium"
                            />
                            <Input
                              value={item.part_number}
                              onChange={(e) => handleItemChange(item.id, 'part_number', e.target.value)}
                              placeholder="P/N"
                              className="min-h-[40px] text-sm"
                            />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.id)} aria-label="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Marca</Label>
                            <Input value={item.brand} onChange={(e) => handleItemChange(item.id, 'brand', e.target.value)} placeholder="Marca" className="min-h-[44px]" />
                          </div>
                          <div>
                            <Label className="text-xs">Cantidad</Label>
                            <Input type="number" min={1} value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} className="min-h-[44px]" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Precio Unit.</Label>
                            <Input type="number" step="0.01" min={0} value={item.unit_price} onChange={(e) => handleItemChange(item.id, 'unit_price', e.target.value)} disabled={isInventory} className={`min-h-[44px] ${isInventory ? "bg-muted" : ""}`} />
                          </div>
                          <div>
                            <Label className="text-xs">Entrega (días)</Label>
                            {isInventory ? (
                              <span className="flex items-center min-h-[44px] text-muted-foreground">N/A</span>
                            ) : (
                              <Input type="number" min={1} value={item.lead_time_days || 15} onChange={(e) => handleItemChange(item.id, 'lead_time_days', Number(e.target.value))} className="min-h-[44px]" />
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <div className="flex gap-2 flex-wrap">
                            <Select value={item.fulfill_from || 'purchase'} onValueChange={(value: 'inventory' | 'purchase') => {
                                setItems(prev => prev.map(i => {
                                  if (i.id !== item.id) return i
                                  const updates: Partial<OrderItem> = { fulfill_from: value }
                                  if (value === 'purchase') updates.warehouse_id = undefined
                                  else if (value === 'inventory' && i.availability?.available_by_warehouse?.length) {
                                    const wh = i.availability.available_by_warehouse
                                    const best = wh.filter(w => w.available_quantity >= (Number(i.quantity) || 0)).sort((a, b) => b.available_quantity - a.available_quantity)[0]
                                    updates.warehouse_id = best?.warehouse_id || wh[0].warehouse_id
                                  }
                                  return { ...i, ...updates }
                                }))
                              }}>
                                <SelectTrigger className="h-8 w-[120px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inventory">Inventario</SelectItem>
                                  <SelectItem value="purchase">Compra</SelectItem>
                                </SelectContent>
                              </Select>
                            {item.is_special_order && <Badge variant="secondary" className="text-xs"><FileText className="h-3 w-3 mr-1" />Especial</Badge>}
                          </div>
                          <span className="font-semibold">${item.total_price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {isInventory && item.availability?.available_by_warehouse?.length ? (
                          <div>
                            <Label className="text-xs">Almacén</Label>
                            <Select value={item.warehouse_id || ''} onValueChange={(v) => handleItemChange(item.id, 'warehouse_id', v)}>
                              <SelectTrigger className="min-h-[44px]">
                                <SelectValue placeholder="Seleccionar almacén" />
                              </SelectTrigger>
                              <SelectContent>
                                {item.availability.available_by_warehouse.map((w) => (
                                  <SelectItem key={w.warehouse_id} value={w.warehouse_id}>
                                    {w.warehouse_name} ({w.available_quantity} disp.)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : isInventory && item.part_id ? (
                          <p className="text-xs text-amber-600 px-1">
                            {!effectivePlantId
                              ? 'Seleccione planta arriba para ver almacenes'
                              : item.availability
                                ? 'Sin stock'
                                : 'Verificando...'}
                          </p>
                        ) : null}
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artículo/Parte</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Cant.</TableHead>
                      <TableHead>Precio Unit.</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead className="w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {items.map((item) => {
                    const isInventory = item.fulfill_from === 'inventory'
                    return (
                    <TableRow key={item.id} className={isInventory ? 'bg-green-50/70' : ''}>
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
                            className={`pl-6 ${isInventory ? 'bg-muted cursor-not-allowed' : ''}`}
                            type="number"
                            step="0.01"
                            min={0}
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(item.id, 'unit_price', e.target.value)}
                            disabled={isInventory}
                            title={isInventory ? 'No aplica: viene de inventario' : undefined}
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
                        <Select
                          value={item.fulfill_from || 'purchase'}
                          onValueChange={(value: 'inventory' | 'purchase') => {
                            setItems(prev => prev.map(i => {
                              if (i.id !== item.id) return i
                              const updates: Partial<OrderItem> = { fulfill_from: value }
                              if (value === 'purchase') {
                                updates.warehouse_id = undefined
                              } else if (value === 'inventory' && i.availability?.available_by_warehouse?.length) {
                                const wh = i.availability.available_by_warehouse
                                const best = wh.filter(w => w.available_quantity >= (Number(i.quantity) || 0))
                                  .sort((a, b) => b.available_quantity - a.available_quantity)[0]
                                updates.warehouse_id = best?.warehouse_id || wh[0].warehouse_id
                              }
                              return { ...i, ...updates }
                            }))
                          }}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inventory">Inventario</SelectItem>
                            <SelectItem value="purchase">Compra</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {isInventory && item.availability?.available_by_warehouse?.length ? (
                          <Select
                            value={item.warehouse_id || ''}
                            onValueChange={(v) => handleItemChange(item.id, 'warehouse_id', v)}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Seleccionar almacén" />
                            </SelectTrigger>
                            <SelectContent>
                              {item.availability.available_by_warehouse.map((w) => (
                                <SelectItem key={w.warehouse_id} value={w.warehouse_id}>
                                  {w.warehouse_name} ({w.available_quantity} disp.)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : isInventory && item.part_id ? (
                          <span className="text-xs text-amber-600">
                            {!effectivePlantId
                              ? 'Seleccione planta'
                              : item.availability
                                ? 'Sin stock'
                                : 'Verificando...'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {isInventory ? (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                min={1}
                                value={item.lead_time_days || 15}
                                onChange={(e) => handleItemChange(item.id, 'lead_time_days', Number(e.target.value))}
                              />
                              <span className="text-sm">d</span>
                            </>
                          )}
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
                  )})}
                </TableBody>
              </Table>
              )}
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
                      <span className="font-medium">
                        {purchaseItems.length > 0 ? `${estimatedDeliveryDays} días` : 'N/A (todo inventario)'}
                      </span>
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

          {/* Inventory vs purchase summary - same as DirectPurchaseForm; standalone uses line mix when po_purpose is inventory_restock */}
          {items.length > 0 && (() => {
            const inventoryItemsList = items.filter(i => i.fulfill_from === 'inventory')
            const purchaseItemsList = items.filter(i => i.fulfill_from === 'purchase' || !i.fulfill_from)
            const inventoryTotalSum = inventoryItemsList.reduce((sum, item) => sum + (item.total_price || 0), 0)
            const purchaseTotalSum = purchaseItemsList.reduce((sum, item) => sum + (item.total_price || 0), 0)

            if (workOrderId) {
              if (routingContext.poPurpose === 'work_order_inventory') {
                return (
                  <Alert className="border-green-500 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Esta orden usará solo existencias del almacén.</strong> No implica compra a proveedor en esta OC; sigue el flujo de autorización habitual.
                    </AlertDescription>
                  </Alert>
                )
              }
              if (routingContext.poPurpose === 'mixed') {
                return (
                  <Alert className="border-yellow-500 bg-yellow-50">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      <strong>Esta orden mezcla surtido desde almacén y compra a proveedor.</strong> Desde almacén: ${inventoryTotalSum.toFixed(2)}. Compra a proveedor: ${purchaseTotalSum.toFixed(2)}. Las cotizaciones se orientan a las partidas de compra.
                    </AlertDescription>
                  </Alert>
                )
              }
              if (routingContext.poPurpose === 'work_order_cash') {
                return (
                  <Alert className="border-blue-500 bg-blue-50">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>Esta orden va principalmente por compra a proveedor:</strong> ${purchaseTotalSum.toFixed(2)}. Las cotizaciones se pre-llenarán con estas partidas.
                    </AlertDescription>
                  </Alert>
                )
              }
              return null
            }

            if (inventoryItemsList.length === items.length && items.length > 0) {
              return (
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Todas las líneas son surtido desde almacén.</strong> Registre las cotizaciones obligatorias del pedido especial según política; no hay partidas de compra que pre-llenar desde esta lista.
                  </AlertDescription>
                </Alert>
              )
            }
            if (purchaseItemsList.length === items.length) {
              return (
                <Alert className="border-blue-500 bg-blue-50">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Compra a proveedor:</strong> ${purchaseTotalSum.toFixed(2)}. Las cotizaciones se pre-llenarán con estas partidas.
                  </AlertDescription>
                </Alert>
              )
            }
            if (inventoryItemsList.length > 0 && purchaseItemsList.length > 0) {
              return (
                <Alert className="border-yellow-500 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Mezcla almacén y compra.</strong> Desde almacén: ${inventoryTotalSum.toFixed(2)}. Compra a proveedor: ${purchaseTotalSum.toFixed(2)}. Las cotizaciones se orientan a las partidas de compra.
                  </AlertDescription>
                </Alert>
              )
            }
            return null
          })()}
        </CardContent>
      </Card>

      {/* Quotation Form - Always required for special orders */}
      {/* Pre-fill with purchase items from work order when adding first quotation */}
      <QuotationFormForCreation
        quotations={quotations}
        onQuotationsChange={(newQuotations) => {
          setQuotations(normalizeQuotations(newQuotations))
          setFormErrors(prev => prev.filter(error => !error.includes('cotización')))
        }}
        workOrderId={workOrderId}
        prefillItems={prefillItems.length > 0 ? prefillItems : undefined}
      />

      {/* Work Order Information */}
      {workOrder && (
        <Card>
          {isMobile ? (
            <Collapsible defaultOpen={false}>
              <CardHeader asChild>
                <CollapsibleTrigger className="w-full text-left hover:no-underline group">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Package className="h-5 w-5" />
                      <span>Información de la Orden de Trabajo</span>
                    </CardTitle>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-4">
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
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Descripción</Label>
                      <p className="text-sm">{workOrder.description}</p>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <>
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
            </>
          )}
        </Card>
      )}

      {/* Validation Results */}
      {(formData.total_amount && formData.total_amount > 0) ? (
        <QuotationValidator
          poType={PurchaseOrderType.SPECIAL_ORDER}
          amount={formData.total_amount}
          poPurpose={routingContext.poPurpose}
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
        {isMobile ? (
          <Collapsible defaultOpen={true}>
            <CardHeader asChild>
              <CollapsibleTrigger className="w-full text-left hover:no-underline group">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Información Básica</span>
                    </CardTitle>
                    <CardDescription>Fechas y método de pago; las cotizaciones formalizan la compra a proveedor</CardDescription>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Flujo de Pedido Especial:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Opcional: agregue líneas del catálogo y elija surtido desde almacén o compra (pedido independiente: elija planta arriba)</li>
                <li>Configure fechas, método de pago y notas</li>
                <li>Agregue cotizaciones de proveedores (cada una con artículos y precios)</li>
                <li>Compare cotizaciones y seleccione la mejor opción</li>
                <li>El sistema actualizará proveedor y artículos según la cotización elegida</li>
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
                className={isMobile ? "min-h-[44px]" : ""}
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
                <SelectTrigger className={isMobile ? "min-h-[44px]" : ""}>
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
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Información Básica</span>
              </CardTitle>
              <CardDescription>
                Fechas y método de pago. Proveedor y precios de compra se documentan en las cotizaciones; las líneas de refacción sirven para surtido y pre-llenado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Flujo de Pedido Especial:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Opcional: agregue líneas del catálogo y elija surtido desde almacén o compra (pedido independiente: elija planta arriba)</li>
                    <li>Configure fechas, método de pago y notas</li>
                    <li>Agregue cotizaciones de proveedores (cada una con artículos y precios)</li>
                    <li>Compare cotizaciones y seleccione la mejor opción</li>
                    <li>El sistema actualizará proveedor y artículos según la cotización elegida</li>
                  </ol>
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Fecha de Compra *</Label>
                  <Input id="purchase_date" type="date" value={formData.purchase_date || ''} onChange={(e) => handleInputChange('purchase_date', e.target.value)} required />
                  <p className="text-xs text-muted-foreground">Fecha en que se realizará o se realizó la compra</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Método de Pago *</Label>
                  <Select value={formData.payment_method || ""} onValueChange={(value) => handleInputChange('payment_method', value as PaymentMethod)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar método de pago" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PaymentMethod.TRANSFER}>Transferencia</SelectItem>
                      <SelectItem value={PaymentMethod.CARD}>Tarjeta Corporativa</SelectItem>
                      <SelectItem value={PaymentMethod.CASH}>Efectivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.payment_method === PaymentMethod.TRANSFER && (
                  <div className="space-y-2">
                    <Label htmlFor="max_payment_date">Fecha Máxima de Pago *</Label>
                    <Input id="max_payment_date" type="date" value={formData.max_payment_date || ""} onChange={(e) => handleInputChange('max_payment_date', e.target.value)} min={new Date().toISOString().split('T')[0]} />
                    <p className="text-sm text-muted-foreground">Fecha límite para realizar la transferencia al proveedor</p>
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Notas Adicionales</Label>
                  <Textarea id="notes" placeholder="Notas adicionales sobre el pedido especial" value={formData.notes || ''} onChange={(e) => handleInputChange('notes', e.target.value)} rows={3} />
                </div>
              </div>
            </CardContent>
          </>
        )}
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
          disabled={
            isCreating ||
            reviewSubmitting ||
            (items.length === 0 && quotations.length === 0)
          }
          className="min-w-[150px]"
        >
          {isCreating || reviewSubmitting ? (
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
    </>
  )
} 