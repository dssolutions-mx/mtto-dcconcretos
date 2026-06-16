export type PoInvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'void'

export type PoAccountingStatus = 'pending_invoice' | 'invoiced' | 'paid'

export type PoExpenseCategory =
  | 'refacciones'
  | 'mano_obra'
  | 'servicio_externo'
  | 'otros'

export type PoInvoiceExpenseType = 'materials' | 'labor'

export type PoPaymentMethod = 'cash' | 'transfer' | 'card'

export interface PoSupplierInvoiceItem {
  id?: string
  description: string
  amount: number
  expense_type?: PoInvoiceExpenseType | null
  po_line_index?: number | null
}

export interface PoSupplierInvoice {
  id: string
  purchase_order_id: string
  plant_id: string
  supplier_id?: string | null
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  subtotal: number
  discount_amount?: number
  vat_rate: number
  tax: number
  retention_isr_rate?: number
  retention_isr_amount?: number
  retention_iva_rate?: number
  retention_iva_amount?: number
  total: number
  status: PoInvoiceStatus
  expense_category: PoExpenseCategory
  po_purpose_snapshot?: string | null
  po_type_snapshot?: string | null
  document_url?: string | null
  receipt_id?: string | null
  notes?: string | null
  registered_by?: string | null
  created_at: string
  updated_at: string
  items?: PoSupplierInvoiceItem[]
}

export interface PoInvoiceBalance {
  invoice_id: string
  purchase_order_id: string
  plant_id: string
  supplier_id?: string | null
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  subtotal: number
  discount_amount?: number
  vat_rate: number
  tax: number
  retention_isr_amount?: number
  retention_iva_amount?: number
  total: number
  invoice_status: PoInvoiceStatus
  expense_category: PoExpenseCategory
  document_url?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  order_id: string
  supplier: string
  po_type?: string | null
  po_purpose?: string | null
  po_status?: string | null
  paid_to_date: number
  balance: number
  is_overdue: boolean
  days_until_due?: number | null
}

export interface PoInvoicePayment {
  id: string
  invoice_id: string
  purchase_order_id: string
  plant_id: string
  payment_date: string
  amount: number
  payment_method?: PoPaymentMethod | null
  reference?: string | null
  notes?: string | null
  recorded_by?: string | null
  created_at: string
}

export interface PoWithoutInvoiceRow {
  purchase_order_id: string
  order_id: string
  plant_id: string
  plant_name?: string | null
  supplier: string
  supplier_id?: string | null
  po_type?: string | null
  po_purpose?: string | null
  po_status: string
  total_amount: number
  actual_amount?: number | null
  approval_date?: string | null
  purchased_at?: string | null
  max_payment_date?: string | null
  payment_condition?: string | null
  accounting_status: PoAccountingStatus
  has_receipt: boolean
  receipt_count: number
  created_at: string
}

export interface CreatePoSupplierInvoiceInput {
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  subtotal: number
  discount_amount?: number
  vat_rate?: number
  retention_isr_rate?: number
  retention_iva_rate?: number
  expense_category?: PoExpenseCategory
  document_url?: string | null
  receipt_id?: string | null
  notes?: string | null
  items?: PoSupplierInvoiceItem[]
}

export interface RecordPoInvoicePaymentInput {
  invoice_id: string
  payment_date: string
  amount: number
  payment_method?: PoPaymentMethod
  reference?: string | null
  notes?: string | null
}

export interface ProcurementActionQueueItem {
  id: string
  type: 'sin_factura' | 'vencida' | 'post_aprobacion' | 'parcial'
  title: string
  description: string
  purchase_order_id?: string
  invoice_id?: string
  order_id?: string
  amount?: number
  due_date?: string | null
  priority: 'high' | 'medium' | 'low'
}

export interface ProcurementDashboard {
  sin_factura_count: number
  sin_factura_amount: number
  open_invoices_count: number
  open_invoices_balance: number
  overdue_count: number
  overdue_balance: number
  post_approval_pending_count: number
  partially_paid_count: number
}

export const PO_EXPENSE_CATEGORY_LABELS: Record<PoExpenseCategory, string> = {
  refacciones: 'Refacciones',
  mano_obra: 'Mano de obra',
  servicio_externo: 'Servicio externo',
  otros: 'Otros',
}

export const PO_INVOICE_STATUS_LABELS: Record<PoInvoiceStatus, string> = {
  open: 'Abierta',
  partially_paid: 'Parcialmente pagada',
  paid: 'Pagada',
  void: 'Anulada',
}

export const PO_ACCOUNTING_STATUS_LABELS: Record<PoAccountingStatus, string> = {
  pending_invoice: 'Sin factura',
  invoiced: 'Facturada',
  paid: 'Pagada',
}

export const PO_PAYMENT_METHOD_LABELS: Record<PoPaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
}

export const PROCUREMENT_TABS = ['resumen', 'sin_factura', 'facturas', 'post_aprobacion'] as const
export type ProcurementTab = (typeof PROCUREMENT_TABS)[number]
