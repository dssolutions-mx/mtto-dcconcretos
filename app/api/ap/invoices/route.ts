import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const plantId = request.nextUrl.searchParams.get('plant_id')
    const includePaid = request.nextUrl.searchParams.get('include_paid') === 'true'

    let query = supabase
      .from('po_invoice_balances')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })

    if (plantId) {
      query = query.eq('plant_id', plantId)
    }

    if (!includePaid) {
      query = query.in('invoice_status', ['open', 'partially_paid'])
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Error al cargar facturas', details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, invoices: data ?? [] })
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
