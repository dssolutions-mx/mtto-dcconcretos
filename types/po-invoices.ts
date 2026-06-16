export type PoInvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'void'

export type PoAccountingStatus = 'pending_invoice' | 'invoiced' | 'paid'

export type PoExpenseCategory =
  | 'refacciones'
  | 'mano_obra'
  | 'servicio_externo'
  | 'otros'

export type PoInvoiceExpenseType = 'materials' | 'labor'

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
  vat_rate: number
  tax: number
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

export interface CreatePoSupplierInvoiceInput {
  invoice_number: string
  invoice_date: string
  due_date?: string | null
  subtotal: number
  vat_rate?: number
  expense_category?: PoExpenseCategory
  document_url?: string | null
  receipt_id?: string | null
  notes?: string | null
  items?: PoSupplierInvoiceItem[]
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
