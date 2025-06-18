// Enhanced Purchase Order Types for 3-Type System
// Based on Stage 1 database implementation

export enum PurchaseOrderType {
  DIRECT_PURCHASE = "direct_purchase",    // Compra directa - ferretería, tienda local
  DIRECT_SERVICE = "direct_service",      // Servicio directo - técnico especialista
  SPECIAL_ORDER = "special_order"         // Pedido especial - agencia, proveedor formal
}

export enum PaymentMethod {
  CASH = "cash",                          // Efectivo
  TRANSFER = "transfer",                  // Transferencia
  CARD = "card"                          // Tarjeta
}

// Enhanced status workflow for all types
export enum EnhancedPOStatus {
  // Estados comunes
  DRAFT = "draft",
  PENDING_APPROVAL = "pending_approval", 
  APPROVED = "approved",
  REJECTED = "rejected",
  
  // Para DIRECT_PURCHASE y DIRECT_SERVICE
  PURCHASED = "purchased",                // Ya se compró/contrató
  RECEIPT_UPLOADED = "receipt_uploaded",  // Comprobante subido
  VALIDATED = "validated",                // Validado por admin
  
  // Para SPECIAL_ORDER (estados adicionales)
  QUOTED = "quoted",                      // Cotizado
  ORDERED = "ordered",                    // Pedido realizado
  RECEIVED = "received"                   // Recibido/Completado
}

// Base interface extending existing purchase_orders table
export interface EnhancedPurchaseOrder {
  // Campos existentes (mantener compatibilidad)
  id: string
  order_id: string
  work_order_id: string
  supplier: string
  items: any[]
  total_amount: number
  status: string
  notes?: string
  created_at: string
  updated_at: string
  plant_id?: string
  requested_by?: string
  approved_by?: string
  authorization_date?: string
  
  // ✅ NUEVOS CAMPOS IMPLEMENTADOS EN STAGE 1
  po_type: PurchaseOrderType
  payment_method?: PaymentMethod
  requires_quote: boolean                 // Auto-calculado por trigger
  store_location?: string                 // Para compras directas
  service_provider?: string               // Para servicios directos
  actual_amount?: number                  // Monto real gastado
  purchased_at?: string                   // Timestamp de compra
  quote_required_reason?: string          // Razón de cotización
  enhanced_status?: string                // Enhanced workflow status
  quotation_url?: string                  // URL del archivo de cotización
}

// Interfaces específicas por tipo
export interface DirectPurchaseOrder extends EnhancedPurchaseOrder {
  po_type: PurchaseOrderType.DIRECT_PURCHASE
  store_location?: string                 // Opcional, ya no es obligatorio
  requires_quote: false                   // Siempre false
}

export interface DirectServiceOrder extends EnhancedPurchaseOrder {
  po_type: PurchaseOrderType.DIRECT_SERVICE
  service_provider: string                // Obligatorio
  requires_quote: boolean                 // Basado en monto ($10k threshold)
}

export interface SpecialOrder extends EnhancedPurchaseOrder {
  po_type: PurchaseOrderType.SPECIAL_ORDER
  requires_quote: true                    // Siempre true
}

// Request/Response Types for API
export interface CreatePurchaseOrderRequest {
  work_order_id: string
  po_type: PurchaseOrderType
  supplier: string
  items: any[]
  total_amount: number
  payment_method?: PaymentMethod
  notes?: string
  quotation_url?: string       // URL del archivo de cotización (requerido si requires_quote = true)
  
  // Campos específicos por tipo
  store_location?: string      // Para direct_purchase (opcional)
  service_provider?: string    // Para direct_service (required)
}

export interface PurchaseOrderResponse {
  success: boolean
  data?: EnhancedPurchaseOrder
  message: string
  error?: string
}

// Workflow Status Response
export interface WorkflowStatusResponse {
  current_status: string
  allowed_next_statuses: string[]
  po_type: PurchaseOrderType
  requires_quote: boolean
  can_advance: boolean
  workflow_stage: string
  recommendation?: string
}

// Advance Workflow Request
export interface AdvanceWorkflowRequest {
  new_status: string
  notes?: string
}

// Quotation Validation
export interface QuoteValidationRequest {
  po_type: PurchaseOrderType
  total_amount: number
}

export interface QuoteValidationResponse {
  requires_quote: boolean
  reason: string
  threshold_amount?: number
  recommendation: string
}

// Métricas y Analytics
export interface PurchaseOrderMetrics {
  summary: {
    total_orders: number
    total_amount: number
    by_type: Record<PurchaseOrderType, {
      count: number
      total_amount: number
      avg_amount: number
      quote_rate: number
    }>
    by_payment_method: Record<PaymentMethod, {
      count: number
      total_amount: number
    }>
  }
  detailed_metrics: Array<{
    po_type: PurchaseOrderType
    payment_method?: PaymentMethod
    count: number
    total_amount: number
    avg_amount: number
    with_quotes: number
    without_quotes: number
  }>
}

// Specific Type Analytics
export interface DirectPurchasesResponse {
  orders: DirectPurchaseOrder[]
  top_stores: Array<{ store: string, count: number, total_amount: number }>
  avg_amount: number
  completion_rate: number
}

export interface DirectServicesResponse {
  orders: DirectServiceOrder[]
  with_quotes: number
  without_quotes: number
  top_providers: Array<{ provider: string, count: number, total_amount: number }>
  quote_threshold_analysis: {
    below_10k: { count: number, total: number }
    above_10k: { count: number, total: number }
  }
}

export interface SpecialOrdersResponse {
  orders: SpecialOrder[]
  avg_delivery_time: number
  completion_stages: Record<string, number>
  top_agencies: Array<{ agency: string, count: number, total_amount: number }>
}

// Validation Result
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

// Database Function Response Types (matching Stage 1 implementation)
export interface QuoteRequirementResponse {
  requires_quote: boolean
  reason: string
}

export interface AllowedStatusesResponse {
  allowed_statuses: string[]
}

export interface WorkflowAdvanceResponse {
  success: boolean
  message: string
  new_status?: string
} 