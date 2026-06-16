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
    const hasReceipt = request.nextUrl.searchParams.get('has_receipt')

    let query = supabase
      .from('po_without_supplier_invoice')
      .select('*')
      .order('approval_date', { ascending: true, nullsFirst: false })

    if (plantId) {
      query = query.eq('plant_id', plantId)
    }

    if (hasReceipt === 'true') {
      query = query.eq('has_receipt', true)
    } else if (hasReceipt === 'false') {
      query = query.eq('has_receipt', false)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Error al cargar OC sin factura', details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, rows: data ?? [] })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error al cargar OC sin factura',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
