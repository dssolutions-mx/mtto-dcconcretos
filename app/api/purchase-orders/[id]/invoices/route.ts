import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createPoSupplierInvoice } from '@/lib/ap/createPoSupplierInvoice'
import type { CreatePoSupplierInvoiceInput } from '@/types/po-invoices'

const INVOICE_REGISTER_ROLES = new Set([
  'GERENCIA_GENERAL',
  'AREA_ADMINISTRATIVA',
  'GERENTE_MANTENIMIENTO',
])

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

    const { id: purchaseOrderId } = await params

    const { data: invoices, error } = await supabase
      .from('po_supplier_invoices')
      .select(`
        *,
        items:po_supplier_invoice_items (
          id,
          description,
          amount,
          expense_type,
          po_line_index
        )
      `)
      .eq('purchase_order_id', purchaseOrderId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Error al cargar facturas', details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, invoices: invoices ?? [] })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error al cargar facturas',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile?.role || !INVOICE_REGISTER_ROLES.has(profile.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para registrar facturas de proveedor' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as CreatePoSupplierInvoiceInput
    const { id: purchaseOrderId } = await params

    const result = await createPoSupplierInvoice(supabase, user.id, purchaseOrderId, body)

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, invoice: result.invoice })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error al registrar factura',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
