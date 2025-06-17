import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  PurchaseOrderType,
  PaymentMethod,
  EnhancedPurchaseOrder,
  CreatePurchaseOrderRequest,
  PurchaseOrderResponse,
  WorkflowStatusResponse,
  QuoteValidationResponse,
  PurchaseOrderMetrics,
  DirectPurchasesResponse,
  DirectServicesResponse,
  SpecialOrdersResponse
} from '@/types/purchase-orders'

// Hook state interface
interface UsePurchaseOrdersState {
  // Data
  purchaseOrders: EnhancedPurchaseOrder[]
  currentPurchaseOrder: EnhancedPurchaseOrder | null
  workflowStatus: WorkflowStatusResponse | null
  metrics: PurchaseOrderMetrics | null
  
  // Loading states
  isLoading: boolean
  isCreating: boolean
  isUpdating: boolean
  isLoadingWorkflow: boolean
  
  // Error states
  error: string | null
  validationErrors: string[]
}

// Hook return interface
interface UsePurchaseOrdersReturn extends UsePurchaseOrdersState {
  // Core operations
  createPurchaseOrder: (request: CreatePurchaseOrderRequest) => Promise<EnhancedPurchaseOrder | null>
  loadPurchaseOrders: (filters?: PurchaseOrderFilters) => Promise<void>
  loadPurchaseOrder: (id: string) => Promise<void>
  
  // Workflow operations
  loadWorkflowStatus: (id: string) => Promise<void>
  advanceWorkflow: (id: string, newStatus: string, notes?: string) => Promise<boolean>
  
  // Validation
  validateQuotationRequirement: (poType: PurchaseOrderType, amount: number) => Promise<QuoteValidationResponse | null>
  
  // Analytics
  loadMetrics: () => Promise<void>
  loadDirectPurchases: () => Promise<DirectPurchasesResponse | null>
  loadDirectServices: () => Promise<DirectServicesResponse | null>
  loadSpecialOrders: () => Promise<SpecialOrdersResponse | null>
  
  // State management
  clearError: () => void
  clearCurrentPurchaseOrder: () => void
  reset: () => void
}

// Filters interface
interface PurchaseOrderFilters {
  poType?: PurchaseOrderType
  status?: string
  paymentMethod?: PaymentMethod
  workOrderId?: string
  plantId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export function usePurchaseOrders(): UsePurchaseOrdersReturn {
  const { toast } = useToast()
  
  // State
  const [state, setState] = useState<UsePurchaseOrdersState>({
    purchaseOrders: [],
    currentPurchaseOrder: null,
    workflowStatus: null,
    metrics: null,
    isLoading: false,
    isCreating: false,
    isUpdating: false,
    isLoadingWorkflow: false,
    error: null,
    validationErrors: []
  })

  // Helper function to handle API errors
  const handleApiError = useCallback((error: any, operation: string): string => {
    console.error(`Error in ${operation}:`, error)
    const errorMessage = error instanceof Error 
      ? error.message 
      : `Error en ${operation}`
    
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive"
    })
    
    return errorMessage
  }, [toast])

  // Helper function to make API calls
  const apiCall = useCallback(async <T>(
    url: string, 
    options: RequestInit = {}
  ): Promise<T> => {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }, [])

  // Create purchase order
  const createPurchaseOrder = useCallback(async (
    request: CreatePurchaseOrderRequest
  ): Promise<EnhancedPurchaseOrder | null> => {
    setState(prev => ({ ...prev, isCreating: true, error: null, validationErrors: [] }))

    try {
      const response = await apiCall<PurchaseOrderResponse>('/api/purchase-orders/create-typed', {
        method: 'POST',
        body: JSON.stringify(request)
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Error creating purchase order')
      }

      toast({
        title: "Éxito",
        description: `Orden de compra ${response.data.order_id} creada exitosamente`,
      })

      // Add to local state
      setState(prev => ({
        ...prev,
        purchaseOrders: [response.data!, ...prev.purchaseOrders],
        currentPurchaseOrder: response.data!,
        isCreating: false
      }))

      return response.data
      
    } catch (error) {
      const errorMessage = handleApiError(error, 'crear orden de compra')
      setState(prev => ({ ...prev, error: errorMessage, isCreating: false }))
      return null
    }
  }, [apiCall, handleApiError, toast])

  // Load purchase orders with filters
  const loadPurchaseOrders = useCallback(async (filters?: PurchaseOrderFilters) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Build query parameters
      const searchParams = new URLSearchParams()
      if (filters?.poType) searchParams.append('po_type', filters.poType)
      if (filters?.status) searchParams.append('status', filters.status)
      if (filters?.paymentMethod) searchParams.append('payment_method', filters.paymentMethod)
      if (filters?.workOrderId) searchParams.append('work_order_id', filters.workOrderId)
      if (filters?.plantId) searchParams.append('plant_id', filters.plantId)
      if (filters?.dateFrom) searchParams.append('date_from', filters.dateFrom)
      if (filters?.dateTo) searchParams.append('date_to', filters.dateTo)
      if (filters?.limit) searchParams.append('limit', filters.limit.toString())
      if (filters?.offset) searchParams.append('offset', filters.offset.toString())

      const url = `/api/purchase-orders${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
      const purchaseOrders = await apiCall<EnhancedPurchaseOrder[]>(url)

      setState(prev => ({
        ...prev,
        purchaseOrders,
        isLoading: false
      }))

    } catch (error) {
      const errorMessage = handleApiError(error, 'cargar órdenes de compra')
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
    }
  }, [apiCall, handleApiError])

  // Load single purchase order
  const loadPurchaseOrder = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const purchaseOrder = await apiCall<EnhancedPurchaseOrder>(`/api/purchase-orders/${id}`)
      
      setState(prev => ({
        ...prev,
        currentPurchaseOrder: purchaseOrder,
        isLoading: false
      }))

    } catch (error) {
      const errorMessage = handleApiError(error, 'cargar orden de compra')
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
    }
  }, [apiCall, handleApiError])

  // Load workflow status
  const loadWorkflowStatus = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isLoadingWorkflow: true, error: null }))

    try {
      const workflowStatus = await apiCall<WorkflowStatusResponse>(
        `/api/purchase-orders/workflow-status/${id}`
      )
      
      setState(prev => ({
        ...prev,
        workflowStatus,
        isLoadingWorkflow: false
      }))

    } catch (error) {
      const errorMessage = handleApiError(error, 'cargar estado del workflow')
      setState(prev => ({ ...prev, error: errorMessage, isLoadingWorkflow: false }))
    }
  }, [apiCall, handleApiError])

  // Advance workflow
  const advanceWorkflow = useCallback(async (
    id: string, 
    newStatus: string, 
    notes?: string
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isUpdating: true, error: null }))

    try {
      const response = await apiCall<{ success: boolean, message: string }>(
        `/api/purchase-orders/advance-workflow/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ new_status: newStatus, notes })
        }
      )

      if (!response.success) {
        throw new Error(response.message)
      }

      toast({
        title: "Éxito",
        description: response.message,
      })

      // Reload workflow status and current purchase order
      await Promise.all([
        loadWorkflowStatus(id),
        state.currentPurchaseOrder?.id === id ? loadPurchaseOrder(id) : Promise.resolve()
      ])

      setState(prev => ({ ...prev, isUpdating: false }))
      return true

    } catch (error) {
      const errorMessage = handleApiError(error, 'avanzar workflow')
      setState(prev => ({ ...prev, error: errorMessage, isUpdating: false }))
      return false
    }
  }, [apiCall, handleApiError, toast, loadWorkflowStatus, loadPurchaseOrder, state.currentPurchaseOrder?.id])

  // Validate quotation requirement
  const validateQuotationRequirement = useCallback(async (
    poType: PurchaseOrderType, 
    amount: number
  ): Promise<QuoteValidationResponse | null> => {
    try {
      const response = await apiCall<QuoteValidationResponse>(
        '/api/purchase-orders/validate-quotation-requirement',
        {
          method: 'POST',
          body: JSON.stringify({ po_type: poType, total_amount: amount })
        }
      )

      return response

    } catch (error) {
      console.error('Error validating quotation requirement:', error)
      
      // Return fallback validation
      switch (poType) {
        case PurchaseOrderType.DIRECT_PURCHASE:
          return {
            requires_quote: false,
            reason: "Las compras directas no requieren cotización",
            recommendation: "Proceda con la compra una vez aprobada."
          }
        
        case PurchaseOrderType.DIRECT_SERVICE:
          const requiresQuote = amount > 10000
          return {
            requires_quote: requiresQuote,
            reason: requiresQuote 
              ? `Servicio por $${amount.toLocaleString()} requiere cotización por ser mayor a $10,000`
              : `Servicio por $${amount.toLocaleString()} puede proceder sin cotización`,
            threshold_amount: 10000,
            recommendation: requiresQuote 
              ? "Solicite cotización formal antes de proceder."
              : "Puede proceder directamente una vez aprobado."
          }
        
        case PurchaseOrderType.SPECIAL_ORDER:
          return {
            requires_quote: true,
            reason: "Los pedidos especiales siempre requieren cotización formal",
            recommendation: "Contacte al proveedor para obtener cotización oficial."
          }
        
        default:
          return {
            requires_quote: true,
            reason: "Tipo de orden no reconocido",
            recommendation: "Verifique los requisitos específicos."
          }
      }
    }
  }, [apiCall])

  // Load metrics
  const loadMetrics = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await apiCall<{ success: boolean, data: PurchaseOrderMetrics }>(
        '/api/purchase-orders/metrics/by-type'
      )

      setState(prev => ({
        ...prev,
        metrics: response.data,
        isLoading: false
      }))

    } catch (error) {
      const errorMessage = handleApiError(error, 'cargar métricas')
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
    }
  }, [apiCall, handleApiError])

  // Load direct purchases analysis
  const loadDirectPurchases = useCallback(async (): Promise<DirectPurchasesResponse | null> => {
    try {
      const response = await apiCall<DirectPurchasesResponse>('/api/purchase-orders/direct-purchases')
      return response
    } catch (error) {
      handleApiError(error, 'cargar análisis de compras directas')
      return null
    }
  }, [apiCall, handleApiError])

  // Load direct services analysis
  const loadDirectServices = useCallback(async (): Promise<DirectServicesResponse | null> => {
    try {
      const response = await apiCall<DirectServicesResponse>('/api/purchase-orders/direct-services')
      return response
    } catch (error) {
      handleApiError(error, 'cargar análisis de servicios directos')
      return null
    }
  }, [apiCall, handleApiError])

  // Load special orders analysis
  const loadSpecialOrders = useCallback(async (): Promise<SpecialOrdersResponse | null> => {
    try {
      const response = await apiCall<SpecialOrdersResponse>('/api/purchase-orders/special-orders')
      return response
    } catch (error) {
      handleApiError(error, 'cargar análisis de pedidos especiales')
      return null
    }
  }, [apiCall, handleApiError])

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, validationErrors: [] }))
  }, [])

  // Clear current purchase order
  const clearCurrentPurchaseOrder = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      currentPurchaseOrder: null, 
      workflowStatus: null 
    }))
  }, [])

  // Reset all state
  const reset = useCallback(() => {
    setState({
      purchaseOrders: [],
      currentPurchaseOrder: null,
      workflowStatus: null,
      metrics: null,
      isLoading: false,
      isCreating: false,
      isUpdating: false,
      isLoadingWorkflow: false,
      error: null,
      validationErrors: []
    })
  }, [])

  return {
    // State
    ...state,
    
    // Core operations
    createPurchaseOrder,
    loadPurchaseOrders,
    loadPurchaseOrder,
    
    // Workflow operations
    loadWorkflowStatus,
    advanceWorkflow,
    
    // Validation
    validateQuotationRequirement,
    
    // Analytics
    loadMetrics,
    loadDirectPurchases,
    loadDirectServices,
    loadSpecialOrders,
    
    // State management
    clearError,
    clearCurrentPurchaseOrder,
    reset
  }
} 