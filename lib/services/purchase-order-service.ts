import { createClient } from '@/lib/supabase-server'
import {
  PurchaseOrderType,
  PaymentMethod,
  EnhancedPurchaseOrder,
  CreatePurchaseOrderRequest,
  QuoteValidationResponse,
  WorkflowStatusResponse,
  PurchaseOrderMetrics,
  ValidationResult,
  DirectPurchasesResponse,
  DirectServicesResponse,
  SpecialOrdersResponse,
  PurchaseOrderViabilityState,
} from '@/types/purchase-orders'
import {
  buildPurchaseOrderRoutingContext,
  type PurchaseOrderRoutingContext,
} from '@/lib/purchase-orders/routing-context'
import { buildServerRoutingContextInput } from '@/lib/purchase-orders/server-routing-seed'
import {
  resolveWorkflowPath,
  getNextStepForAdministration,
} from '@/lib/purchase-orders/workflow-policy'

type PurchaseOrderRecord = {
  status?: string | null
  requires_quote?: boolean | null
  total_amount?: string | number | null
  store_location?: string | null
  service_provider?: string | null
  supplier?: string | null
}

type PurchaseOrderSummaryRow = {
  count?: number | null
  total_amount?: string | number | null
  avg_amount?: string | number | null
  quote_rate?: string | number | null
  po_type?: string | null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return ''
}

export class PurchaseOrderService {
  
  /**
   * Validates if a purchase order requires quotation based on type and amount
   * Uses the requires_quotation() function from Stage 1
   */
  static async validateQuoteRequirement(
    po_type: PurchaseOrderType, 
    amount: number,
    po_purpose?: string
  ): Promise<QuoteValidationResponse> {
    const supabase = await createClient()

    try {
      const { data, error } = await supabase
        .rpc('requires_quotation', {
          p_po_type: po_type,
          p_amount: amount,
          p_po_purpose: po_purpose ?? null,
        })

      if (error) throw error

      const requiresQuote = Boolean(data)
      const reason = this.getQuoteReason(po_type, amount, requiresQuote)
      const recommendation = this.getQuoteRecommendation(po_type, amount, requiresQuote)
      
      return { 
        requires_quote: requiresQuote,
        reason: po_purpose === 'work_order_inventory'
          ? 'Las órdenes surtidas totalmente desde inventario no requieren cotización'
          : reason,
        threshold_amount:
          po_type === PurchaseOrderType.DIRECT_PURCHASE ||
          po_type === PurchaseOrderType.DIRECT_SERVICE
            ? 5000
            : undefined,
        recommendation
      }
    } catch (error) {
      console.error('Error validating quote requirement:', error)
      throw new Error('Failed to validate quotation requirement')
    }
  }
  
  /**
   * Creates a new typed purchase order with automatic workflow advancement
   */
  static async createTypedPurchaseOrder(
    request: CreatePurchaseOrderRequest,
    user_id: string
  ): Promise<EnhancedPurchaseOrder> {
    const supabase = await createClient()
    
    try {
      // Generate unique order ID
      const order_id = await this.generateOrderId()
      const normalizedRequest = await this.normalizeCreateRequest(request)
      const quoteRequirement = await this.validateQuoteRequirement(
        normalizedRequest.po_type,
        normalizedRequest.approval_amount ?? 0,
        normalizedRequest.po_purpose
      )
      
      // Determine initial status:
      // - If requires quote: start in 'draft' (will advance after quotation selection)
      // - If doesn't require quote: go directly to 'pending_approval'
      // - Exception: inventory-only POs don't need approval, but still go to pending_approval for workflow
      const initialStatus = quoteRequirement.requires_quote ? 'draft' : 'pending_approval'
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
          order_id,
          work_order_id: normalizedRequest.work_order_id,
          plant_id: normalizedRequest.plant_id,
          po_type: normalizedRequest.po_type,
          po_purpose: normalizedRequest.po_purpose,
          work_order_type: normalizedRequest.work_order_type,
          supplier: normalizedRequest.supplier,
          total_amount: normalizedRequest.total_amount,
          approval_amount: normalizedRequest.approval_amount,
          approval_amount_source: normalizedRequest.approval_amount_source,
          payment_method: normalizedRequest.payment_method,
          payment_condition: normalizedRequest.payment_condition,
          viability_state: normalizedRequest.viability_state,
          store_location: normalizedRequest.store_location,
          service_provider: normalizedRequest.service_provider,
          items: normalizedRequest.items,
          notes: normalizedRequest.notes,
          quotation_url: normalizedRequest.quotation_url,
          // Store quotation_urls as JSONB array; avoid stringifying to prevent scalar JSON issues
          quotation_urls: Array.isArray(normalizedRequest.quotation_urls) ? normalizedRequest.quotation_urls : (normalizedRequest.quotation_urls ? [normalizedRequest.quotation_urls] : null),
          purchase_date: normalizedRequest.purchase_date,
          max_payment_date: normalizedRequest.max_payment_date,
          requested_by: user_id,
          status: initialStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) {
        console.error('Database error creating purchase order:', error)
        throw new Error(`Failed to create purchase order: ${error.message}`)
      }
      
      return {
        ...(data as EnhancedPurchaseOrder),
        work_order_type: normalizedRequest.work_order_type,
        viability_state: normalizedRequest.viability_state,
        approval_amount: normalizedRequest.approval_amount,
        approval_amount_source: normalizedRequest.approval_amount_source,
        payment_condition: normalizedRequest.payment_condition,
      }
      
    } catch (error) {
      console.error('Error in createTypedPurchaseOrder:', error)
      throw error
    }
  }
  
  /**
   * Advances the workflow status using the database function
   * Uses advance_purchase_order_workflow() from Stage 1
   * Now includes quotation selection validation
   */
  static async advanceWorkflow(
    id: string, 
    new_status: string, 
    user_id: string, 
    notes?: string
  ): Promise<{ success: boolean, message: string }> {
    const supabase = await createClient()
    
    try {
      // Check quotation selection requirement and items existence before advancing to pending_approval
      if (new_status === 'pending_approval') {
        const { data: po, error: poError } = await supabase
          .from('purchase_orders')
          .select('quotation_selection_required, quotation_selection_status, po_purpose, items')
          .eq('id', id)
          .single()
        
        if (!poError && po) {
          // Skip check if using inventory (no purchase needed)
          if (po.po_purpose !== 'work_order_inventory' && po.quotation_selection_required) {
            // Allow pending_selection: BU can approve+select in one step (plan Phase 3)
            if (po.quotation_selection_status === 'pending_quotations') {
              throw new Error('Se requieren al menos 2 cotizaciones antes de solicitar aprobación')
            }
            if (po.quotation_selection_status !== 'selected' && po.quotation_selection_status !== 'pending_selection') {
              throw new Error('La selección de cotización es requerida antes de solicitar aprobación')
            }
            // Only check items when already selected (items come from selection)
            if (po.quotation_selection_status === 'selected') {
              const items = po.items as unknown[]
              if (!items || !Array.isArray(items) || items.length === 0) {
                throw new Error(
                  'La orden de compra no tiene artículos. Los artículos deben ser agregados desde la cotización seleccionada.'
                )
              }
            }
          }
        }
      }
      
      const { data, error } = await supabase
        .rpc('advance_purchase_order_workflow', {
          p_purchase_order_id: id,
          p_new_status: new_status,
          p_user_id: user_id,
          p_notes: notes ?? null
        })
      
      if (error) {
        // If attempting to approve and the only blocker is max_payment_date being in the past,
        // bypass that constraint per new business rule and directly approve.
        const message = getErrorMessage(error)
        if (new_status === 'approved' && message.includes('max_payment_date cannot be in the past')) {
          // Perform a safe direct update to approved, recording approver and timestamp
          const { error: updateError } = await supabase
            .from('purchase_orders')
            .update({
              status: 'approved',
              approved_by: user_id,
              authorization_date: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

          if (updateError) {
            throw updateError
          }

          return { success: true, message: 'Orden aprobada ignorando restricción de fecha de pago (política actualizada)' }
        }

        // Surface original error for API route to map properly
        throw error
      }
      return data || { success: false, message: 'Unknown error occurred' }
    } catch (error) {
      console.error('Error advancing workflow:', error)
      // Re-throw the original Supabase/Postgres error so the route can translate it
      throw error
    }
  }
  
  /**
   * Gets current workflow status and allowed next statuses
   * Uses get_allowed_statuses() function from Stage 1
   */
  static async getWorkflowStatus(id: string): Promise<WorkflowStatusResponse> {
    const supabase = await createClient()
    
    try {
      // Get current PO with authorization info for 2-step approval display
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('id, status, po_type, po_purpose, work_order_type, requires_quote, authorized_by, authorization_date, total_amount, approval_amount, approval_amount_source, payment_condition, viability_state')
        .eq('id', id)
        .single()
      
      if (poError || !po) {
        throw new Error('Purchase order not found')
      }
      
      // Get valid next statuses based on current status using the new function
      // Now includes po_purpose to support inventory-only workflow
      const { data: nextStatuses, error: statusError } = await supabase
        .rpc('get_valid_next_statuses', { 
          p_current_status: po.status, 
          p_po_type: po.po_type,
          p_po_purpose: po.po_purpose || null
        })
      
      if (statusError) {
        console.error('Error getting valid next statuses:', statusError)
        console.error('Function parameters:', { p_current_status: po.status, p_po_type: po.po_type })
        throw new Error(`Failed to get valid next statuses: ${statusError.message}`)
      }

      // App-layer workflow policy enrichment (Task 4: authoritative before SQL migration)
      // approval_amount may be stored as 0.00 (not null) when unset — fall through to total_amount
      const approvalAmount =
        Number(po.approval_amount) > 0
          ? Number(po.approval_amount)
          : Number(po.total_amount ?? 0)
      const policyInput = {
        poPurpose: po.po_purpose ?? null,
        workOrderType: po.work_order_type ?? null,
        approvalAmount,
        paymentCondition: po.payment_condition ?? null,
      }
      const workflowPolicy = resolveWorkflowPath(policyInput)
      const nextStepForAdmin = getNextStepForAdministration(
        policyInput,
        po.status,
        po.viability_state ?? null
      )
      
      return {
        current_status: po.status,
        allowed_next_statuses: nextStatuses || [],
        po_type: po.po_type as PurchaseOrderType,
        requires_quote: po.requires_quote,
        can_advance: (nextStatuses?.length || 0) > 0,
        workflow_stage: this.getWorkflowStage(po.status, po.po_type),
        recommendation: this.getWorkflowRecommendation(po.status, po.po_type),
        purchase_order: {
          authorized_by: po.authorized_by,
          authorization_date: po.authorization_date,
          total_amount: po.total_amount,
          po_purpose: po.po_purpose || undefined,
          work_order_type: po.work_order_type || null,
          approval_amount: po.approval_amount ? Number(po.approval_amount) : null,
          approval_amount_source: po.approval_amount_source || null,
          payment_condition: po.payment_condition || null,
          viability_state: po.viability_state || null,
          workflow_policy: {
            path: workflowPolicy.path,
            requires_viability: workflowPolicy.requiresViability,
            requires_gm_if_above_threshold: workflowPolicy.requiresGMIfAboveThreshold,
            next_step_description: nextStepForAdmin,
          },
        },
      }
    } catch (error) {
      console.error('Error getting workflow status:', error)
      throw new Error('Failed to get workflow status')
    }
  }
  
  /**
   * Gets metrics by type using the views from Stage 1
   * Uses purchase_order_metrics and po_type_summary views
   */
  static async getMetricsByType(): Promise<PurchaseOrderMetrics> {
    const supabase = await createClient()
    
    try {
      const [summaryResult, detailedResult] = await Promise.all([
        supabase.from('po_type_summary').select('*'),
        supabase.from('purchase_order_metrics').select('*')
      ])
      
      if (summaryResult.error) throw summaryResult.error
      if (detailedResult.error) throw detailedResult.error
      
      return {
        summary: this.formatSummaryMetrics(summaryResult.data || []),
        detailed_metrics: detailedResult.data || []
      }
    } catch (error) {
      console.error('Error getting metrics by type:', error)
      throw new Error('Failed to get metrics')
    }
  }
  
  /**
   * Gets direct purchases with analytics
   */
  static async getDirectPurchases(): Promise<DirectPurchasesResponse> {
    const supabase = await createClient()
    
    try {
      const { data: orders, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('po_type', 'direct_purchase')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      const analytics = this.analyzeDirectPurchases(orders || [])
      
      return {
        orders: (orders || []) as EnhancedPurchaseOrder[],
        top_stores: analytics.topStores,
        avg_amount: analytics.avgAmount,
        completion_rate: analytics.completionRate
      }
    } catch (error) {
      console.error('Error getting direct purchases:', error)
      throw new Error('Failed to get direct purchases')
    }
  }
  
  /**
   * Gets direct services with analytics
   */
  static async getDirectServices(): Promise<DirectServicesResponse> {
    const supabase = await createClient()
    
    try {
      const { data: orders, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('po_type', 'direct_service')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      const analytics = this.analyzeDirectServices(orders || [])
      
      return {
        orders: (orders || []) as EnhancedPurchaseOrder[],
        with_quotes: analytics.withQuotes,
        without_quotes: analytics.withoutQuotes,
        top_providers: analytics.topProviders,
        quote_threshold_analysis: analytics.thresholdAnalysis
      }
    } catch (error) {
      console.error('Error getting direct services:', error)
      throw new Error('Failed to get direct services')
    }
  }
  
  /**
   * Gets special orders with analytics
   */
  static async getSpecialOrders(): Promise<SpecialOrdersResponse> {
    const supabase = await createClient()
    
    try {
      const { data: orders, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('po_type', 'special_order')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      const analytics = this.analyzeSpecialOrders(orders || [])
      
      return {
        orders: (orders || []) as EnhancedPurchaseOrder[],
        avg_delivery_time: analytics.avgDeliveryTime,
        completion_stages: analytics.completionStages,
        top_agencies: analytics.topAgencies
      }
    } catch (error) {
      console.error('Error getting special orders:', error)
      throw new Error('Failed to get special orders')
    }
  }
  
  // ============== PRIVATE HELPER METHODS ==============

  static async buildCreateRoutingContext(
    request: CreatePurchaseOrderRequest
  ): Promise<PurchaseOrderRoutingContext> {
    const workOrderType = await this.resolveWorkOrderType(request)

    return buildPurchaseOrderRoutingContext(
      buildServerRoutingContextInput(request, workOrderType)
    )
  }

  static async normalizeCreateRequest(
    request: CreatePurchaseOrderRequest
  ): Promise<CreatePurchaseOrderRequest> {
    const requestWithResolvedPlant = await this.withResolvedPlantId(request)
    const requestWithCompatibilityDefaults =
      this.withCompatibilityDefaults(requestWithResolvedPlant)
    const routingContext = await this.buildCreateRoutingContext(
      requestWithCompatibilityDefaults
    )

    return {
      ...requestWithCompatibilityDefaults,
      po_purpose: routingContext.poPurpose,
      work_order_type: routingContext.workOrderType ?? undefined,
      approval_amount: routingContext.approvalAmount,
      approval_amount_source: routingContext.approvalAmountSource,
      payment_condition: routingContext.paymentCondition,
      viability_state: routingContext.poPurpose === 'work_order_inventory'
        ? PurchaseOrderViabilityState.NOT_REQUIRED
        : PurchaseOrderViabilityState.PENDING,
    }
  }

  private static withCompatibilityDefaults(
    request: CreatePurchaseOrderRequest
  ): CreatePurchaseOrderRequest {
    if (request.po_type !== PurchaseOrderType.DIRECT_SERVICE) {
      return request
    }

    const placeholderServiceProvider =
      request.service_provider?.trim() ||
      request.supplier?.trim() ||
      'Proveedor por definir'

    return {
      ...request,
      supplier: request.supplier?.trim() || placeholderServiceProvider,
      service_provider: placeholderServiceProvider,
    }
  }

  private static async withResolvedPlantId(
    request: CreatePurchaseOrderRequest
  ): Promise<CreatePurchaseOrderRequest> {
    if (request.plant_id || !request.work_order_id) {
      return request
    }

    const supabase = await createClient()
    const { data: workOrder } = await supabase
      .from('work_orders')
      .select(`
        plant_id,
        asset:assets (
          plant_id
        )
      `)
      .eq('id', request.work_order_id)
      .maybeSingle()

    const plantId = workOrder?.plant_id || workOrder?.asset?.plant_id

    if (!plantId) {
      return request
    }

    return {
      ...request,
      plant_id: plantId,
    }
  }

  private static async resolveWorkOrderType(
    request: CreatePurchaseOrderRequest
  ): Promise<CreatePurchaseOrderRequest['work_order_type']> {
    if (!request.work_order_id) {
      return request.work_order_type
    }

    const supabase = await createClient()
    const { data } = await supabase
      .from('work_orders')
      .select('type')
      .eq('id', request.work_order_id)
      .maybeSingle()

    return data?.type ?? undefined
  }
  
  private static getQuoteReason(po_type: PurchaseOrderType, amount: number, requires: boolean): string {
    if (po_type === PurchaseOrderType.DIRECT_PURCHASE) {
      return requires ? 
        `Compra directa por $${amount.toLocaleString()} requiere cotización (>= $5,000)` :
        `Compra directa por $${amount.toLocaleString()} no requiere cotización (< $5,000)`
    }
    
    if (po_type === PurchaseOrderType.DIRECT_SERVICE) {
      return requires ? 
        `Servicio directo por $${amount.toLocaleString()} requiere cotización (>= $5,000)` :
        `Servicio directo por $${amount.toLocaleString()} no requiere cotización (< $5,000)`
    }
    
    if (po_type === PurchaseOrderType.SPECIAL_ORDER) {
      return 'Los pedidos especiales siempre requieren cotización formal'
    }
    
    return 'Validar requisitos según tipo de orden'
  }
  
  private static getQuoteRecommendation(po_type: PurchaseOrderType, amount: number, requires: boolean): string {
    if (po_type === PurchaseOrderType.DIRECT_PURCHASE) {
      return requires ?
        'Obtenga cotización del proveedor antes de solicitar aprobación.' :
        'Puede proceder sin cotización. Solicite aprobación directamente.'
    }
    
    if (po_type === PurchaseOrderType.DIRECT_SERVICE) {
      return requires ? 
        'Obtenga cotización del proveedor antes de solicitar aprobación.' :
        'Puede proceder sin cotización. Solicite aprobación directamente.'
    }
    
    if (po_type === PurchaseOrderType.SPECIAL_ORDER) {
      return 'Solicite cotización formal del proveedor/agencia antes de continuar.'
    }
    
    return 'Consulte las políticas de compras para este tipo de orden.'
  }
  
  private static getWorkflowStage(status: string, poType: string): string {
    const stageMap: Record<string, Record<string, string>> = {
      direct_purchase: {
        draft: 'Borrador - Completar Información',
        pending_approval: 'Esperando Aprobación',
        approved: 'Aprobada - Proceder a Comprar',
        purchased: 'Comprada - Subir Comprobante',
        receipt_uploaded: 'En Validación Administrativa',
        validated: 'Proceso Completado'
      },
      direct_service: {
        draft: 'Borrador - Completar Información', 
        pending_approval: 'Esperando Aprobación',
        approved: 'Aprobada - Contratar Servicio',
        purchased: 'Servicio Realizado - Subir Comprobante',
        receipt_uploaded: 'En Validación Administrativa',
        validated: 'Proceso Completado'
      },
      special_order: {
        draft: 'Borrador - Obtener Cotización',
        quoted: 'Cotizada - Solicitar Aprobación',
        pending_approval: 'Esperando Aprobación',
        approved: 'Aprobada - Realizar Pedido',
        ordered: 'Pedido Realizado - Esperando Entrega',
        received: 'Recibida - Subir Comprobante',
        receipt_uploaded: 'En Validación Administrativa',
        validated: 'Proceso Completado'
      }
    }
    
    return stageMap[poType]?.[status] || status
  }
  
  private static getWorkflowRecommendation(status: string, poType: string): string {
    if (status === 'draft') {
      if (poType === 'direct_purchase') return 'Complete la información de la tienda y artículos a comprar'
      if (poType === 'direct_service') return 'Complete la información del proveedor de servicio'
      if (poType === 'special_order') return 'Obtenga cotización del proveedor antes de continuar'
    }
    
    if (status === 'approved') {
      if (poType === 'direct_purchase') return 'Puede proceder a realizar la compra en la tienda especificada'
      if (poType === 'direct_service') return 'Puede contratar el servicio con el proveedor especificado'
      if (poType === 'special_order') return 'Realice el pedido formal con el proveedor'
    }
    
    if (status === 'purchased' || status === 'received') {
      return 'Suba el comprobante/factura para completar el proceso'
    }
    
    if (status === 'receipt_uploaded') {
      return 'Comprobante subido. Esperando validación administrativa.'
    }
    
    return 'Continúe con el siguiente paso del proceso'
  }
  
  private static async generateOrderId(): Promise<string> {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    return `PO-${timestamp}-${random}`
  }
  
  private static formatSummaryMetrics(data: PurchaseOrderSummaryRow[]) {
    // Format the summary data from po_type_summary view
    const summary = {
      total_orders: 0,
      total_amount: 0,
      by_type: {} as PurchaseOrderMetrics['summary']['by_type'],
      by_payment_method: {} as PurchaseOrderMetrics['summary']['by_payment_method']
    }
    
    // Process the data from the view
    data.forEach(row => {
      summary.total_orders += row.count || 0
      summary.total_amount += parseFloat(row.total_amount || 0)
      
      if (row.po_type) {
        summary.by_type[row.po_type] = {
          count: row.count || 0,
          total_amount: parseFloat(row.total_amount || 0),
          avg_amount: parseFloat(row.avg_amount || 0),
          quote_rate: parseFloat(row.quote_rate || 0)
        }
      }
    })
    
    return summary
  }
  
  private static analyzeDirectPurchases(orders: PurchaseOrderRecord[]) {
    const storeAnalysis = orders.reduce((acc, order) => {
      const store = order.store_location || 'Sin especificar'
      if (!acc[store]) {
        acc[store] = { count: 0, total_amount: 0 }
      }
      acc[store].count += 1
      acc[store].total_amount += parseFloat(order.total_amount || 0)
      return acc
    }, {} as Record<string, { count: number, total_amount: number }>)
    
    const topStores = Object.entries(storeAnalysis)
      .map(([store, data]) => ({ 
        store, 
        count: (data as { count: number, total_amount: number }).count, 
        total_amount: (data as { count: number, total_amount: number }).total_amount 
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10)
    
    const avgAmount = orders.length > 0 
      ? orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0) / orders.length
      : 0
    
    const completionRate = orders.length > 0
      ? (orders.filter(order => order.status === 'validated').length / orders.length) * 100
      : 0
    
    return { topStores, avgAmount, completionRate }
  }
  
  private static analyzeDirectServices(orders: PurchaseOrderRecord[]) {
    const withQuotes = orders.filter(order => order.requires_quote).length
    const withoutQuotes = orders.length - withQuotes
    
    const providerAnalysis = orders.reduce((acc, order) => {
      const provider = order.service_provider || 'Sin especificar'
      if (!acc[provider]) {
        acc[provider] = { count: 0, total_amount: 0 }
      }
      acc[provider].count += 1
      acc[provider].total_amount += parseFloat(order.total_amount || 0)
      return acc
    }, {} as Record<string, { count: number, total_amount: number }>)
    
    const topProviders = Object.entries(providerAnalysis)
      .map(([provider, data]) => ({ 
        provider, 
        count: (data as { count: number, total_amount: number }).count, 
        total_amount: (data as { count: number, total_amount: number }).total_amount 
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10)
    
    const below5k = orders.filter(order => parseFloat(order.total_amount || 0) < 5000)
    const above5k = orders.filter(order => parseFloat(order.total_amount || 0) >= 5000)
    
    const thresholdAnalysis = {
      below_5k: {
        count: below5k.length,
        total: below5k.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0)
      },
      above_5k: {
        count: above5k.length,
        total: above5k.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0)
      }
    }
    
    return { withQuotes, withoutQuotes, topProviders, thresholdAnalysis }
  }
  
  private static analyzeSpecialOrders(orders: PurchaseOrderRecord[]) {
    // Calculate average delivery time (placeholder logic)
    const avgDeliveryTime = 7 // days - would need actual delivery data
    
    // Analyze completion stages
    const completionStages = orders.reduce((acc, order) => {
      const stage = order.status || 'unknown'
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Top agencies analysis
    const agencyAnalysis = orders.reduce((acc, order) => {
      const agency = order.supplier || 'Sin especificar'
      if (!acc[agency]) {
        acc[agency] = { count: 0, total_amount: 0 }
      }
      acc[agency].count += 1
      acc[agency].total_amount += parseFloat(order.total_amount || 0)
      return acc
    }, {} as Record<string, { count: number, total_amount: number }>)
    
    const topAgencies = Object.entries(agencyAnalysis)
      .map(([agency, data]) => ({ 
        agency, 
        count: (data as { count: number, total_amount: number }).count, 
        total_amount: (data as { count: number, total_amount: number }).total_amount 
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10)
    
    return { avgDeliveryTime, completionStages, topAgencies }
  }
}

/**
 * Validation service for purchase order requests
 */
export class PurchaseOrderValidationService {
  static validateCreateRequest(request: CreatePurchaseOrderRequest): ValidationResult {
    const errors: string[] = []
    
    // Validaciones generales - work_order_id is now optional, but either work_order_id or plant_id is required
    if (!request.work_order_id && !request.plant_id) {
      errors.push('Se requiere work_order_id o plant_id para crear la orden de compra')
    }
    
    if (!request.po_type) errors.push('po_type es requerido')
    if (!request.supplier) errors.push('supplier es requerido')
    
    // Validaciones específicas por tipo
    switch (request.po_type) {
      case PurchaseOrderType.DIRECT_PURCHASE:
        // store_location is optional - not required anymore
        break
        
      case PurchaseOrderType.DIRECT_SERVICE:
        if (!request.service_provider) {
          errors.push('service_provider es requerido para servicios directos')
        }
        if (!request.total_amount || request.total_amount <= 0) {
          errors.push('total_amount debe ser mayor a 0')
        }
        break
        
      case PurchaseOrderType.SPECIAL_ORDER:
        // Quote-first draft path: allow total_amount=0 when quotation_amounts has values
        const hasQuotationAmounts =
          request.quotation_amounts && request.quotation_amounts.length > 0
        const hasValidTotal =
          request.total_amount != null && request.total_amount > 0
        if (!hasQuotationAmounts && !hasValidTotal) {
          errors.push('total_amount debe ser mayor a 0 o se requieren quotation_amounts para borradores quote-first')
        }
        break
        
      default:
        errors.push('po_type debe ser direct_purchase, direct_service, o special_order')
    }

    if (
      request.po_type === PurchaseOrderType.DIRECT_PURCHASE &&
      (!request.total_amount || request.total_amount <= 0)
    ) {
      errors.push('total_amount debe ser mayor a 0')
    }
    
    // Validar payment_method si se proporciona
    if (request.payment_method && !Object.values(PaymentMethod).includes(request.payment_method)) {
      errors.push('payment_method debe ser cash, transfer, o card')
    }
    
    // Validar max_payment_date para transferencias
    if (request.payment_method === PaymentMethod.TRANSFER) {
      if (!request.max_payment_date) {
        errors.push('max_payment_date es requerido para transferencias')
      } else {
        const maxDate = new Date(request.max_payment_date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        if (isNaN(maxDate.getTime())) {
          errors.push('max_payment_date debe ser una fecha válida')
        } else if (maxDate < today) {
          errors.push('max_payment_date no puede ser anterior a hoy')
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
  static async validateStatusTransition(
    currentStatus: string,
    newStatus: string,
    poType: PurchaseOrderType
  ): Promise<boolean> {
    // This would use the get_allowed_statuses function to validate
    // For now, return true (validation is done in the database function)
    return true
  }
} 