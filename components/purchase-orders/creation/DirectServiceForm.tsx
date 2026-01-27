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
  Wrench, 
  Loader2, 
  Plus, 
  Trash2, 
  User,
  Calculator,
  AlertCircle,
  CheckCircle2,
  Package,
  Clock,
  FileText
} from "lucide-react"
import { PurchaseOrderType, PaymentMethod, CreatePurchaseOrderRequest, QuoteValidationResponse } from "@/types/purchase-orders"
import { QuotationValidator } from "./QuotationValidator"
import { QuotationFormForCreation } from "./QuotationFormForCreation"
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders"
import { createClient } from "@/lib/supabase"
import { useUserPlant } from "@/hooks/use-user-plant"
import { SupplierSelector } from "@/components/suppliers/SupplierSelector"
import { Supplier } from "@/types/suppliers"
import { format } from "date-fns"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"

interface DirectServiceFormProps {
  workOrderId?: string
  prefillSupplier?: string
  onSuccess?: (purchaseOrderId: string) => void
  onCancel?: () => void
}

interface ServiceItem {
  id: string
  description: string
  category: string
  estimated_hours: number | string
  hourly_rate: number | string
  total_cost: number
  specialist_required?: boolean
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

// Common service providers in Mexico
const COMMON_SERVICE_PROVIDERS = [
  "Técnico Electricista Local",
  "Plomero Especializado",
  "Técnico Mecánico",
  "Servicio de Soldadura",
  "Técnico en Refrigeración",
  "Electricista Industrial",
  "Técnico en Aire Acondicionado",
  "Servicio de Tornería",
  "Técnico en Hidráulica",
  "Especialista en Motores"
]

export function DirectServiceForm({ 
  workOrderId,
  prefillSupplier,
  onSuccess, 
  onCancel 
}: DirectServiceFormProps) {
  const router = useRouter()
  const { createPurchaseOrder, isCreating, error, clearError } = usePurchaseOrders()
  const { userPlants, loading: plantLoading, error: plantError, userRole, hasFullAccess } = useUserPlant()

  // Work order state
  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null)
  const [isLoadingWorkOrder, setIsLoadingWorkOrder] = useState(true)
  const [workOrderError, setWorkOrderError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<Partial<CreatePurchaseOrderRequest>>({
    work_order_id: workOrderId || undefined,
    po_type: PurchaseOrderType.DIRECT_SERVICE,
    supplier: "Por definir", // Will be set when quotation is selected (for services >= $5k)
    items: [],
    total_amount: 0,
    payment_method: PaymentMethod.TRANSFER,
    notes: "",
    service_provider: "", // Will be set when quotation is selected
    purchase_date: new Date().toISOString().split('T')[0], // Default to today
    max_payment_date: undefined
  })

  // Supplier state - NOT SELECTED HERE if quotation required (comes from quotations)
  // Will be auto-populated when quotation is selected for services >= $5k
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  // Services management
  const [services, setServices] = useState<ServiceItem[]>([])
  const [newService, setNewService] = useState<Partial<ServiceItem>>({
    description: '',
    category: '',
    estimated_hours: '',
    hourly_rate: '',
    total_cost: 0,
    specialist_required: false
  })

  // Service provider suggestions
  const [recentProviders, setRecentProviders] = useState<string[]>([])
  const [providerSuggestions, setProviderSuggestions] = useState<string[]>([])
  const [showProviderSuggestions, setShowProviderSuggestions] = useState(false)

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
  
  // Plant selection for standalone orders - simplified since userPlants now contains all available plants
  const [selectedPlantId, setSelectedPlantId] = useState<string>("")

  // Load work order data and recent service providers
  useEffect(() => {
    // Apply prefill supplier name if provided
    if (prefillSupplier && (!selectedSupplier || selectedSupplier.name !== prefillSupplier)) {
      handleInputChange('service_provider', prefillSupplier)
      handleInputChange('supplier', prefillSupplier)
    }
    const loadWorkOrderData = async () => {
      setIsLoadingWorkOrder(true)
      setWorkOrderError(null)
      
      try {
        const supabase = createClient()
        
        // Load recent service providers from existing purchase orders
        const { data: providerData, error: providerError } = await supabase
          .from("purchase_orders")
          .select("service_provider")
          .eq("po_type", "direct_service")
          .not("service_provider", "is", null)
          .order("created_at", { ascending: false })
          .limit(50)
          
        if (!providerError && providerData) {
          const uniqueProviders = Array.from(
            new Set(providerData
              .map(item => item.service_provider)
              .filter(provider => provider && provider.trim() !== "")
            )
          ) as string[]
          setRecentProviders(uniqueProviders.slice(0, 15))
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
        
        // Pre-populate services from work order estimated cost
        let servicesToLoad: ServiceItem[] = []
        
        if (workOrderData.estimated_cost && Number(workOrderData.estimated_cost) > 0) {
          servicesToLoad = [{
            id: 'estimated-service',
            description: workOrderData.description || 'Servicio de mantenimiento',
            category: 'Mantenimiento General',
            estimated_hours: 8,
            hourly_rate: Number(workOrderData.estimated_cost) / 8,
            total_cost: Number(workOrderData.estimated_cost),
            specialist_required: Number(workOrderData.estimated_cost) > 5000
          }]
        }
        
        setServices(servicesToLoad)
        
        // Auto-populate notes with work order info
        if (workOrderData.description) {
          setFormData(prev => ({ 
            ...prev, 
            notes: `Orden de trabajo: ${workOrderData.order_id} - ${workOrderData.description}`,
            service_provider: ""
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
      // No work order - just load providers, plants are loaded by the hook
      setIsLoadingWorkOrder(false)
    }
  }, [workOrderId])

  // Auto-select plant for standalone orders when userPlants are loaded
  useEffect(() => {
    if (!workOrderId && userPlants.length > 0 && !selectedPlantId) {
      // Auto-select first plant if only one available
      if (userPlants.length === 1) {
        setSelectedPlantId(userPlants[0].plant_id)
      }
    }
  }, [userPlants, workOrderId, selectedPlantId])

  // Calculate total amount whenever services change
  // But don't override if user manually set a flat fee
  useEffect(() => {
    if (services.length > 0) {
      const total = services.reduce((sum, service) => sum + (service.total_cost || 0), 0)
      setFormData(prev => ({ ...prev, total_amount: total, items: services }))
    }
    // If services are cleared, keep the total_amount as-is (might be flat fee)
  }, [services])

  // Handle form input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    clearError()
  }

  // Handle service provider input with suggestions
  const handleProviderChange = (value: string) => {
    handleInputChange('service_provider', value)
    
    if (value && value.length > 0) {
      const recentFiltered = recentProviders.filter(provider =>
        provider.toLowerCase().includes(value.toLowerCase())
      )
      const commonFiltered = COMMON_SERVICE_PROVIDERS.filter(provider =>
        provider.toLowerCase().includes(value.toLowerCase())
      )
      
      const allSuggestions = [...new Set([...recentFiltered, ...commonFiltered])]
      setProviderSuggestions(allSuggestions.slice(0, 8))
      setShowProviderSuggestions(allSuggestions.length > 0)
    } else {
      setProviderSuggestions([])
      setShowProviderSuggestions(false)
    }
  }

  // Select provider from suggestions
  const selectProvider = (provider: string) => {
    handleInputChange('service_provider', provider)
    setShowProviderSuggestions(false)
    setProviderSuggestions([])
  }

  // Handle new service changes
  const handleNewServiceChange = (field: string, value: any) => {
    setNewService(prev => {
      const updated = { ...prev, [field]: value }
      
      // Auto-calculate total cost
      if (field === 'estimated_hours' || field === 'hourly_rate') {
        const hours = field === 'estimated_hours' ? Number(value) || 0 : Number(prev.estimated_hours) || 0
        const rate = field === 'hourly_rate' ? Number(value) || 0 : Number(prev.hourly_rate) || 0
        updated.total_cost = hours * rate
      }
      
      return updated
    })
  }

  // Add new service to list
  const addService = () => {
    if (!newService.description || !newService.estimated_hours || !newService.hourly_rate) {
      setFormErrors(['Descripción, horas estimadas y tarifa por hora son requeridos'])
      return
    }

    const service: ServiceItem = {
      id: `service-${Date.now()}`,
      description: newService.description || '',
      category: newService.category || 'General',
      estimated_hours: Number(newService.estimated_hours) || 0,
      hourly_rate: Number(newService.hourly_rate) || 0,
      total_cost: Number(newService.total_cost) || 0,
      specialist_required: newService.specialist_required || false
    }

    setServices(prev => [...prev, service])
    setNewService({
      description: '',
      category: '',
      estimated_hours: '',
      hourly_rate: '',
      total_cost: 0,
      specialist_required: false
    })
    setFormErrors([])
  }

  // Remove service from list
  const removeService = (serviceId: string) => {
    setServices(prev => prev.filter(service => service.id !== serviceId))
  }

  // Validate form
  const validateForm = (): boolean => {
    const errors: string[] = []

    // Validate plant selection for standalone orders
    if (!workOrderId && !selectedPlantId) {
      errors.push('Se requiere seleccionar una planta para órdenes independientes')
    }

    // Service provider validation - Only required if quotation NOT required
    if (!validationResult?.requires_quote && !selectedSupplier) {
      errors.push('Proveedor de servicio es requerido para servicios menores a $5,000')
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

    // Services are optional - can be flat fee (e.g., agency work)
    // But if services are provided, they must be valid
    if (services.length === 0 && (!formData.total_amount || formData.total_amount === 0)) {
      errors.push('Debe agregar al menos un servicio O especificar un monto total')
    }

    // Total amount is always required
    if (!formData.total_amount || formData.total_amount === 0) {
      errors.push('El monto total debe ser mayor a cero')
    }

    // Validate purchase_date is required
    if (!formData.purchase_date) {
      errors.push('La fecha de compra es obligatoria')
    }

    // Validate quotation requirement for services >= $5k
    if (formData.total_amount && formData.total_amount >= 5000 && quotations.length === 0) {
      errors.push('Se requiere al menos una cotización con información del proveedor y precio para servicios mayores o iguales a $5,000 MXN')
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
      // Determine PO purpose
      // Services are typically not in inventory, but check for consistency
      let po_purpose = 'work_order_cash'
      
      if (!workOrderId) {
        // Services for restocking don't make sense, but handle it
        po_purpose = 'work_order_cash' // Services are always purchased
      }
      // Note: Services are rarely in inventory, so we default to cash
      
      // For flat-fee services (no individual services), create a single item
      let finalItems = services
      if (services.length === 0 && formData.total_amount && formData.total_amount > 0) {
        // Create a single flat-fee service item
        finalItems = [{
          id: 'flat-fee-service',
          name: formData.notes || 'Servicio completo',
          description: formData.notes || 'Servicio completo',
          quantity: 1,
          unit_price: formData.total_amount,
          total_price: formData.total_amount
        }]
      }

      const request: CreatePurchaseOrderRequest = {
        work_order_id: workOrderId || undefined,
        po_type: PurchaseOrderType.DIRECT_SERVICE,
        po_purpose: po_purpose,
        supplier: selectedSupplier?.name || formData.service_provider!, // Use selected supplier name or fallback
        items: finalItems,
        total_amount: formData.total_amount!,
        payment_method: formData.payment_method,
        service_provider: selectedSupplier?.name || formData.service_provider,
        notes: formData.notes,
        purchase_date: formData.purchase_date,
        quotation_urls: quotationUrls.length > 0 ? quotationUrls : undefined,
        quotation_url: quotationUrl || undefined, // Legacy fallback
        max_payment_date: formData.payment_method === PaymentMethod.TRANSFER ? formData.max_payment_date : undefined
      }

      // Only add plant_id for standalone orders and when a plant is selected
      if (!workOrderId && selectedPlantId && selectedPlantId.trim() !== '') {
        request.plant_id = selectedPlantId
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
      console.error('Error creating direct service order:', error)
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
            <div className="p-2 rounded-lg bg-green-100">
              <Wrench className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <CardTitle>Servicio Directo</CardTitle>
              <CardDescription>
                Técnico especialista, servicio rápido - {formData.total_amount && formData.total_amount >= 5000 ? 'Requiere cotización por ser mayor o igual a $5,000' : 'Sin cotización requerida'}
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
          poType={PurchaseOrderType.DIRECT_SERVICE}
          amount={formData.total_amount}
          onValidationResult={setValidationResult}
        />
      ) : null}

      {/* Quotation Upload - Only show when required */}
      {validationResult?.requires_quote && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Cotización Requerida</span>
              <Badge variant="destructive">Obligatorio</Badge>
            </CardTitle>
            <CardDescription>
              El servicio por ${(formData.total_amount || 0).toLocaleString('es-MX')} requiere cotización por ser mayor o igual a $5,000 MXN
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuotationFormForCreation
              quotations={quotations}
              onQuotationsChange={(newQuotations) => {
                setQuotations(newQuotations)
                setFormErrors(prev => prev.filter(error => !error.includes('cotización')))
              }}
              workOrderId={workOrderId}
            />
          </CardContent>
        </Card>
      )}

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
            Fechas y método de pago requeridos para todos los servicios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plant Selector for Standalone Orders */}
          {!workOrderId && (
            <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Label htmlFor="plant_selector" className="text-sm font-medium text-blue-900">
                Planta * (Orden Independiente)
              </Label>
              <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccionar planta donde se ejecutará el servicio" />
                </SelectTrigger>
                <SelectContent>
                  {userPlants.map((plant) => (
                    <SelectItem key={plant.plant_id} value={plant.plant_id}>
                      {plant.plant_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedPlantId && (
                <p className="text-sm text-red-600">
                  Se requiere seleccionar una planta para órdenes independientes
                </p>
              )}
              <p className="text-xs text-blue-700">
                Esta orden no está vinculada a una orden de trabajo específica
              </p>
            </div>
          )}
          
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
                  <SelectValue placeholder="Seleccionar método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentMethod.TRANSFER}>Transferencia</SelectItem>
                  <SelectItem value={PaymentMethod.CASH}>Efectivo</SelectItem>
                  <SelectItem value={PaymentMethod.CARD}>Tarjeta</SelectItem>
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

      {/* Service Provider Information - Only show if quotation NOT required */}
      {!validationResult?.requires_quote && (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Información del Proveedor de Servicio</span>
          </CardTitle>
          <CardDescription>
            Servicio menor a $5,000 - proveedor se define aquí
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proveedor de Servicio *</Label>
              <SupplierSelector
                value={selectedSupplier?.id}
                onChange={(supplier) => {
                  setSelectedSupplier(supplier)
                  handleInputChange('service_provider', supplier?.name || '')
                  handleInputChange('supplier', supplier?.name || '')
                }}
                placeholder="Seleccionar proveedor de servicios"
                filterByType="service_provider"
                showPerformance={true}
                allowManualInput={true}
                onManualInputChange={(name) => {
                  handleInputChange('service_provider', name)
                  handleInputChange('supplier', name)
                }}
                businessUnitId={userPlants?.[0]?.business_unit_id}
              />
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
            <strong>Proveedor del servicio:</strong> Para servicios mayores o iguales a $5,000, 
            el proveedor será seleccionado de las cotizaciones comparadas. 
            Defina los servicios requeridos en la sección siguiente, y luego agregue cotizaciones de diferentes proveedores.
          </AlertDescription>
        </Alert>
      )}

      {/* Services List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>Servicios Solicitados</span>
          </CardTitle>
          <CardDescription>
            Agregue servicios individuales O especifique un monto total (útil para trabajos de agencia con precio fijo)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Flat Fee Option - For agency work */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <div className="space-y-2">
                <div className="font-semibold">¿Trabajo de agencia con precio fijo?</div>
                <div className="text-sm">
                  Si el proveedor factura un monto total (ej: $20,000 por trabajo completo), 
                  puede especificarlo directamente sin agregar servicios individuales.
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Label htmlFor="flat-fee-amount" className="text-sm font-medium">
                    Monto Total del Servicio:
                  </Label>
                  <div className="relative flex-1 max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      id="flat-fee-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="20000.00"
                      className="pl-8"
                      value={services.length === 0 && formData.total_amount ? formData.total_amount : ''}
                      onChange={(e) => {
                        const amount = parseFloat(e.target.value) || 0
                        setFormData(prev => ({ ...prev, total_amount: amount }))
                        // Clear services if flat fee is set
                        if (amount > 0) {
                          setServices([])
                        }
                      }}
                    />
                  </div>
                  {services.length === 0 && formData.total_amount && formData.total_amount > 0 && (
                    <Badge variant="default" className="ml-2">
                      Monto fijo: ${formData.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </Badge>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <Separator className="my-4" />
          <div className="text-sm font-medium text-muted-foreground mb-2">
            O agregue servicios individuales:
          </div>
          {/* Add New Service */}
          <Card className="border-dashed border-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Agregar Servicio</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2">
                  <Label htmlFor="new-service-description">Descripción del Servicio</Label>
                  <Input
                    id="new-service-description"
                    placeholder="Ej: Reparación de motor eléctrico"
                    value={newService.description || ""}
                    onChange={(e) => handleNewServiceChange('description', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="new-service-category">Categoría</Label>
                  <Select 
                    value={newService.category || ""} 
                    onValueChange={(value) => handleNewServiceChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electricidad">Electricidad</SelectItem>
                      <SelectItem value="Mecánica">Mecánica</SelectItem>
                      <SelectItem value="Hidráulica">Hidráulica</SelectItem>
                      <SelectItem value="Soldadura">Soldadura</SelectItem>
                      <SelectItem value="Refrigeración">Refrigeración</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-service-hours">Horas Estimadas</Label>
                  <Input
                    id="new-service-hours"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="8"
                    value={newService.estimated_hours}
                    onChange={(e) => handleNewServiceChange('estimated_hours', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="new-service-rate">Tarifa x Hora</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      id="new-service-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="500.00"
                      className="pl-8"
                      value={newService.hourly_rate}
                      onChange={(e) => handleNewServiceChange('hourly_rate', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="specialist-required"
                    checked={newService.specialist_required}
                    onChange={(e) => handleNewServiceChange('specialist_required', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="specialist-required" className="text-sm">Requiere especialista</Label>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-medium">
                      ${(newService.total_cost || 0).toLocaleString('es-MX', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </span>
                  </div>
                  <Button type="button" onClick={addService} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services Table */}
          {services.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Tarifa</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{service.description}</p>
                          {service.specialist_required && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              <User className="h-3 w-3 mr-1" />
                              Especialista
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{service.category}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{Number(service.estimated_hours).toFixed(1)}h</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        ${Number(service.hourly_rate).toLocaleString('es-MX', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${service.total_cost.toLocaleString('es-MX', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeService(service.id)}
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

          {/* Total Summary */}
          {services.length > 0 && (
            <div className="flex justify-end">
              <Card className="w-64">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total del Servicio:</span>
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
          <CardTitle className="text-lg">Notas Adicionales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Detalles adicionales, especificaciones técnicas, horarios preferidos, etc."
            value={formData.notes || ""}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
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
          disabled={isCreating || (!formData.total_amount || formData.total_amount === 0)}
          className="min-w-[150px]"
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Wrench className="mr-2 h-4 w-4" />
              Crear Servicio Directo
            </>
          )}
        </Button>
      </div>
    </form>
  )
} 