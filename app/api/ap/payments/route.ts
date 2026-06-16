import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { recordPoInvoicePayment } from '@/lib/ap/procurement-service'
import type { RecordPoInvoicePaymentInput } from '@/types/po-invoices'

const PAYMENT_ROLES = new Set(['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'])

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const invoiceId = request.nextUrl.searchParams.get('invoice_id')
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'invoice_id requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('po_invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false })

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Error al cargar pagos', details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, payments: data ?? [] })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error al cargar pagos',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
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

    if (!profile?.role || !PAYMENT_ROLES.has(profile.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para registrar pagos' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as RecordPoInvoicePaymentInput
    const result = await recordPoInvoicePayment(supabase, user.id, body)

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, message: 'Pago registrado' })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error al registrar pago',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
