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

export enum POPurpose {
  WORK_ORDER_CASH = "work_order_cash",           // Buy parts for WO (cash expense)
  WORK_ORDER_INVENTORY = "work_order_inventory", // Use inventory for WO (no cash)
  INVENTORY_RESTOCK = "inventory_restock",       // Restock inventory (deferred expense)
  MIXED = "mixed"                                // Partial from each
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
  
  // Para órdenes de inventario (work_order_inventory)
  FULFILLED = "fulfilled",                // Inventario cumplido/entregado (en lugar de purchased)
  
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
  po_purpose?: POPurpose                  // Purpose classification for expense tracking
  payment_method?: PaymentMethod
  requires_quote: boolean                 // Auto-calculado por trigger
  store_location?: string                 // Para compras directas
  service_provider?: string               // Para servicios directos
  actual_amount?: number                  // Monto real gastado
  purchased_at?: string                   // Timestamp de compra
  purchase_date?: string                  // Fecha cuando se comprará o se compró (independiente de cuándo se creó la OC)
  quote_required_reason?: string          // Razón de cotización
  enhanced_status?: string                // Enhanced workflow status
  quotation_url?: string                  // URL del archivo de cotización (legacy - use quotation_urls)
  quotation_urls?: string[]               // Array of quotation file URLs (nuevo - soporte para múltiples archivos)
  max_payment_date?: string               // Fecha máxima de pago (solo para transferencias)
  payment_date?: string                   // Fecha real cuando se realizó el pago
  payment_reference?: string              // Número de transferencia, cheque o referencia
  payment_notes?: string                  // Notas adicionales del pago
  paid_by?: string                        // Usuario que marcó como pagado
  
  // ✅ QUOTATION COMPARISON FIELDS
  selected_quotation_id?: string          // Reference to selected quotation
  quotation_selection_required?: boolean  // Whether selection is required before approval
  quotation_selection_status?: QuotationSelectionStatus // Current selection workflow status
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
  work_order_id?: string       // Optional - allows standalone purchase orders
  plant_id?: string           // Required for standalone POs (when no work_order_id)
  po_type: PurchaseOrderType
  po_purpose?: POPurpose      // Auto-determined during creation (optional override)
  supplier: string
  items: any[]
  total_amount: number
  payment_method?: PaymentMethod
  notes?: string
  quotation_url?: string       // Legacy single URL (mantener para compatibilidad)
  quotation_urls?: string[]    // Array of quotation URLs (preferred for new uploads)
  purchase_date?: string       // Fecha de compra (requerido)
  max_payment_date?: string    // Fecha máxima de pago (requerido solo para transferencias)
  
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
  purchase_order?: {
    authorized_by?: string | null
    authorization_date?: string | null
    total_amount?: string | null
    po_purpose?: POPurpose
  }
}

// Advance Workflow Request
export interface AdvanceWorkflowRequest {
  new_status: string
  notes?: string
  /** Required when approving with 2+ quotations and none selected; BU selects as part of approval */
  quotation_id?: string
}

// Quotation Validation
export interface QuoteValidationRequest {
  po_type: PurchaseOrderType
  total_amount: number
  po_purpose?: POPurpose
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

// Accounts Payable (Cuentas por Pagar) Types
export interface AccountsPayableItem {
  id: string
  order_id: string
  supplier: string
  service_provider?: string
  store_location?: string
  total_amount: number
  actual_amount?: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  payment_date?: string
  payment_reference?: string
  payment_notes?: string
  max_payment_date?: string
  created_at: string
  purchased_at?: string
  po_type: PurchaseOrderType
  status: string
  days_until_due: number
  payment_status_display: string
  requested_by_name?: string
  paid_by_name?: string
}

export enum PaymentStatus {
  PENDING = "pending",        // Pendiente de pago
  PAID = "paid",             // Pagado
  OVERDUE = "overdue",       // Vencido
  IMMEDIATE = "immediate"    // Inmediato (cash/card)
}

export interface MarkAsPaidRequest {
  purchase_order_id: string
  payment_date: string
  payment_reference?: string
  payment_notes?: string
}

export interface AccountsPayableSummary {
  total_pending: number
  total_overdue: number
  total_amount_pending: number
  total_amount_overdue: number
  items_due_this_week: number
  items_due_today: number
}

export interface AccountsPayableResponse {
  summary: AccountsPayableSummary
  items: AccountsPayableItem[]
  filters_applied: {
    status?: PaymentStatus
    payment_method?: PaymentMethod
    days_filter?: 'overdue' | 'today' | 'week' | 'month'
  }
}

// =====================================================
// Quotation Comparison Types
// =====================================================

export enum QuotationStatus {
  PENDING = 'pending',
  SELECTED = 'selected', 
  REJECTED = 'rejected'
}

export enum QuotationSelectionStatus {
  NOT_REQUIRED = 'not_required',
  PENDING_QUOTATIONS = 'pending_quotations',
  PENDING_SELECTION = 'pending_selection',
  SELECTED = 'selected'
}

export interface QuotationItem {
  item_index?: number              // Index in PO items array
  part_number?: string             // Match by part number
  description?: string             // Item description
  quantity: number                 // Quantity quoted
  unit_price: number               // Unit price from quotation
  total_price: number              // Total price (quantity * unit_price)
}

export interface PurchaseOrderQuotation {
  id: string
  purchase_order_id: string
  supplier_id?: string
  supplier_name: string
  quoted_amount: number
  quotation_items?: QuotationItem[]  // Item-level pricing from quotation
  delivery_days?: number
  payment_terms?: string
  validity_date?: string
  notes?: string
  file_url?: string
  file_name?: string
  status: QuotationStatus
  selected_at?: string
  selected_by?: string
  selection_reason?: string
  rejection_reason?: string
  created_at: string
  created_by?: string
  updated_at?: string
  
  // Joined data
  supplier?: import('./suppliers').Supplier
  selected_by_user?: { nombre: string; apellido: string }
}

export interface CreateQuotationRequest {
  purchase_order_id: string
  supplier_id?: string
  supplier_name: string
  quoted_amount: number
  quotation_items?: QuotationItem[]  // Item-level pricing (optional but recommended)
  delivery_days?: number
  payment_terms?: string
  validity_date?: string
  notes?: string
  file_url?: string
  file_name?: string
}

export interface SelectQuotationRequest {
  quotation_id: string
  selection_reason: string
}

export interface QuotationComparison {
  quotations: PurchaseOrderQuotation[]
  selected_quotation?: PurchaseOrderQuotation
  recommendation?: {
    quotation_id: string
    score: number
    reasoning: string[]
  }
  summary: {
    total_quotations: number
    lowest_price: number
    fastest_delivery: number
    average_price: number
  }
}

export interface QuotationComparisonResponse {
  comparison: QuotationComparison
  can_select: boolean
  selection_required: boolean
  min_quotations_met: boolean
} 