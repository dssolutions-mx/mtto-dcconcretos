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
  SpecialOrdersResponse
} from '@/types/purchase-orders'

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
          p_po_purpose: po_purpose ?? null
        })
      
      if (error) throw error
      
      const reason = this.getQuoteReason(po_type, amount, data)
      const recommendation = this.getQuoteRecommendation(po_type, amount, data)
      
      return { 
        requires_quote: data,
        reason,
        threshold_amount: po_type === PurchaseOrderType.DIRECT_SERVICE ? 5000 : undefined,
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
      
      // Determine PO purpose if not provided
      // Default: work_order_cash if has WO, inventory_restock if standalone
      const po_purpose = request.po_purpose || 
        (request.work_order_id ? 'work_order_cash' : 'inventory_restock')
      
      // Check if quotation is required
      // Note: requires_quote will be set by trigger, but we need to check it to determine initial status
      const { data: quoteCheck } = await supabase
        .rpc('requires_quotation', {
          p_po_type: request.po_type,
          p_amount: request.total_amount || 0
        })
      
      const requiresQuote = quoteCheck || false
      
      // Determine initial status:
      // - If requires quote: start in 'draft' (will advance after quotation selection)
      // - If doesn't require quote: go directly to 'pending_approval'
      // - Exception: inventory-only POs don't need approval, but still go to pending_approval for workflow
      const initialStatus = requiresQuote ? 'draft' : 'pending_approval'
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
          order_id,
          work_order_id: request.work_order_id,
          plant_id: request.plant_id,
          po_type: request.po_type,
          po_purpose: po_purpose,
          supplier: request.supplier,
          total_amount: request.total_amount,
          payment_method: request.payment_method,
          store_location: request.store_location,
          service_provider: request.service_provider,
          items: request.items,
          notes: request.notes,
          quotation_url: request.quotation_url,
          // Store quotation_urls as JSONB array; avoid stringifying to prevent scalar JSON issues
          quotation_urls: Array.isArray(request.quotation_urls) ? request.quotation_urls : (request.quotation_urls ? [request.quotation_urls] : null),
          purchase_date: request.purchase_date,
          max_payment_date: request.max_payment_date,
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
      
      return data as EnhancedPurchaseOrder
      
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
            if (po.quotation_selection_status !== 'selected') {
              throw new Error(
                po.quotation_selection_status === 'pending_quotations'
                  ? 'Se requieren al menos 2 cotizaciones antes de solicitar aprobación'
                  : po.quotation_selection_status === 'pending_selection'
                  ? 'Debe seleccionar un proveedor de las cotizaciones antes de solicitar aprobación'
                  : 'La selección de cotización es requerida antes de solicitar aprobación'
              )
            }
            
            // Ensure PO items exist after quotation selection
            // Items should be populated automatically when quotation is selected
            const items = po.items as any[]
            if (!items || !Array.isArray(items) || items.length === 0) {
              throw new Error(
                'La orden de compra no tiene artículos. Los artículos deben ser agregados desde la cotización seleccionada.'
              )
            }
          }
        }
      }
      
      const { data, error } = await supabase
        .rpc('advance_purchase_order_workflow', {
          p_purchase_order_id: id,
          p_new_status: new_status,
          p_user_id: user_id,
          p_notes: notes
        })
      
      if (error) {
        // If attempting to approve and the only blocker is max_payment_date being in the past,
        // bypass that constraint per new business rule and directly approve.
        const message = typeof (error as any)?.message === 'string' ? (error as any).message : ''
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

        // If DB rejects due to missing quotation but the PO actually has one, approve directly
        if (
          new_status === 'approved' && (
            message.includes('Quotation required for this purchase order before approval') ||
            message.includes('Cannot approve: quotation is required but not uploaded')
          )
        ) {
          // Load quotation fields to double-check presence
          const { data: po, error: poError } = await supabase
            .from('purchase_orders')
            .select('quotation_urls, quotation_url, requires_quote')
            .eq('id', id)
            .single()

          if (!poError && po) {
            const urlsValue: unknown = (po as any).quotation_urls
            const hasArrayQuotes = Array.isArray(urlsValue)
              ? (urlsValue as unknown[]).some(u => typeof u === 'string' && (u as string).trim() !== '')
              : false
            const legacyQuote = typeof (po as any).quotation_url === 'string' && (po as any).quotation_url.trim() !== ''
            const hasAnyQuote = hasArrayQuotes || legacyQuote

            // If we have any quotes, proceed with direct approval
            if (hasAnyQuote) {
              const { error: updateError2 } = await supabase
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

              if (updateError2) {
                throw updateError2
              }

              return { success: true, message: 'Orden aprobada: se detectó cotización existente aunque la validación la rechazó' }
            }
          }
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
        .select('id, status, po_type, po_purpose, requires_quote, authorized_by, authorization_date, total_amount')
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
          po_purpose: po.po_purpose || undefined
        }
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
        orders: orders as any[],
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
        orders: orders as any[],
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
        orders: orders as any[],
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
  
  private static getQuoteReason(po_type: PurchaseOrderType, amount: number, requires: boolean): string {
    if (po_type === PurchaseOrderType.DIRECT_PURCHASE) {
      return 'Las compras directas no requieren cotización'
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
      return 'Proceda con la compra una vez aprobada. No necesita cotización previa.'
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
  
  private static formatSummaryMetrics(data: any[]): any {
    // Format the summary data from po_type_summary view
    const summary = {
      total_orders: 0,
      total_amount: 0,
      by_type: {} as any,
      by_payment_method: {} as any
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
  
  private static analyzeDirectPurchases(orders: any[]) {
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
  
  private static analyzeDirectServices(orders: any[]) {
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
  
  private static analyzeSpecialOrders(orders: any[]) {
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
    if (!request.total_amount || request.total_amount <= 0) errors.push('total_amount debe ser mayor a 0')
    
    // Validaciones específicas por tipo
    switch (request.po_type) {
      case PurchaseOrderType.DIRECT_PURCHASE:
        // store_location is optional - not required anymore
        break
        
      case PurchaseOrderType.DIRECT_SERVICE:
        if (!request.service_provider) {
          errors.push('service_provider es requerido para servicios directos')
        }
        break
        
      case PurchaseOrderType.SPECIAL_ORDER:
        // Special orders siempre requieren cotización - se valida en el frontend
        break
        
      default:
        errors.push('po_type debe ser direct_purchase, direct_service, o special_order')
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