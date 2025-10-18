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
    amount: number
  ): Promise<QuoteValidationResponse> {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase
        .rpc('requires_quotation', { 
          p_po_type: po_type, 
          p_amount: amount 
        })
      
      if (error) throw error
      
      const reason = this.getQuoteReason(po_type, amount, data)
      const recommendation = this.getQuoteRecommendation(po_type, amount, data)
      
      return { 
        requires_quote: data,
        reason,
        threshold_amount: po_type === PurchaseOrderType.DIRECT_SERVICE ? 10000 : undefined,
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
      
      // For enhanced purchase orders, automatically advance to pending_approval
      // instead of staying in draft - this makes the workflow more intuitive
      const initialStatus = 'pending_approval'
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
          order_id,
          work_order_id: request.work_order_id,
          plant_id: request.plant_id,
          po_type: request.po_type,
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
          status: initialStatus, // Auto-advance to pending approval
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
   */
  static async advanceWorkflow(
    id: string, 
    new_status: string, 
    user_id: string, 
    notes?: string
  ): Promise<{ success: boolean, message: string }> {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase
        .rpc('advance_purchase_order_workflow', {
          p_purchase_order_id: id,
          p_new_status: new_status,
          p_user_id: user_id,
          p_notes: notes
        })
      
      if (error) {
        // Surface original error for API route to map properly (e.g., payment date validation)
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
      // Get current PO
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('id, status, po_type, requires_quote')
        .eq('id', id)
        .single()
      
      if (poError || !po) {
        throw new Error('Purchase order not found')
      }
      
      // Get valid next statuses based on current status using the new function
      const { data: nextStatuses, error: statusError } = await supabase
        .rpc('get_valid_next_statuses', { 
          p_current_status: po.status, 
          p_po_type: po.po_type 
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
        recommendation: this.getWorkflowRecommendation(po.status, po.po_type)
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
        `Servicio directo por $${amount.toLocaleString()} requiere cotización (>$10,000)` :
        `Servicio directo por $${amount.toLocaleString()} no requiere cotización (<$10,000)`
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
    
    const below10k = orders.filter(order => parseFloat(order.total_amount || 0) <= 10000)
    const above10k = orders.filter(order => parseFloat(order.total_amount || 0) > 10000)
    
    const thresholdAnalysis = {
      below_10k: {
        count: below10k.length,
        total: below10k.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0)
      },
      above_10k: {
        count: above10k.length,
        total: above10k.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0)
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