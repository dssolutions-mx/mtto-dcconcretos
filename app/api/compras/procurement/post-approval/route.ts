import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const POST_APPROVAL_STATUSES = [
  'approved',
  'purchased',
  'ordered',
  'received',
  'receipt_uploaded',
  'fulfilled',
]

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const plantId = request.nextUrl.searchParams.get('plant_id')

    let query = supabase
      .from('purchase_orders')
      .select(
        'id, order_id, supplier, status, po_type, total_amount, actual_amount, accounting_status, plant_id, approval_date, purchased_at',
      )
      .in('status', POST_APPROVAL_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (plantId) {
      query = query.eq('plant_id', plantId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Error al cargar OC post-aprobación', details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, rows: data ?? [] })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error al cargar OC post-aprobación',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
