import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { resolvePoPreTaxAmount } from '@/lib/ap/po-amounts'

const POST_APPROVAL_STATUSES = [
  'approved',
  'purchased',
  'ordered',
  'received',
  'receipt_uploaded',
  'fulfilled',
  'validated',
]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (poError || !po) {
      return NextResponse.json({ success: false, error: 'OC no encontrada' }, { status: 404 })
    }

    const [{ data: receipts }, { data: invoices }, { data: payments }] = await Promise.all([
      supabase
        .from('purchase_order_receipts')
        .select('id, file_url, expense_type, description, receipt_date, created_at')
        .eq('purchase_order_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('po_supplier_invoices')
        .select(`
          *,
          items:po_supplier_invoice_items (id, description, amount, expense_type)
        `)
        .eq('purchase_order_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('po_invoice_payments')
        .select('*')
        .eq('purchase_order_id', id)
        .order('payment_date', { ascending: false }),
    ])

    const steps = [
      {
        key: 'approved',
        label: 'Aprobada',
        done: POST_APPROVAL_STATUSES.includes(po.status ?? ''),
        date: po.approval_date ?? po.authorization_date,
      },
      {
        key: 'executed',
        label: po.po_type === 'special_order' ? 'Pedida / Recibida' : 'Comprada / Cumplida',
        done: ['purchased', 'ordered', 'received', 'fulfilled', 'receipt_uploaded', 'validated'].includes(
          po.status ?? '',
        ),
        date: po.purchased_at,
      },
      {
        key: 'receipt',
        label: 'Comprobante',
        done: (receipts?.length ?? 0) > 0 || po.receipt_uploaded,
        count: receipts?.length ?? 0,
      },
      {
        key: 'invoice',
        label: 'Factura proveedor',
        done: (invoices?.filter((i) => i.status !== 'void').length ?? 0) > 0,
        count: invoices?.filter((i) => i.status !== 'void').length ?? 0,
      },
      {
        key: 'payment',
        label: 'Pago',
        done: po.accounting_status === 'paid' || po.payment_status === 'paid',
        count: payments?.length ?? 0,
      },
      {
        key: 'validated',
        label: 'Validada',
        done: po.status === 'validated',
        date: null,
      },
    ]

    return NextResponse.json({
      success: true,
      purchase_order: po,
      receipts: receipts ?? [],
      invoices: invoices ?? [],
      payments: payments ?? [],
      lifecycle: {
        steps,
        po_pre_tax: resolvePoPreTaxAmount(po),
        accounting_status: po.accounting_status,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error al cargar ciclo de vida',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
