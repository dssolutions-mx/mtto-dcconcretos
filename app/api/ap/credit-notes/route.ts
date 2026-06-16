import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createPoCreditNote } from '@/lib/ap/createPoCreditNote'
import type { CreatePoCreditNoteInput } from '@/lib/ap/createPoCreditNote'

const ALLOWED_ROLES = new Set(['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'])

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const plantId = request.nextUrl.searchParams.get('plant_id')

    let query = supabase
      .from('po_credit_notes')
      .select(`
        *,
        allocations:po_credit_note_invoice_allocations (
          id,
          invoice_id,
          allocated_subtotal,
          allocated_tax,
          allocated_total
        )
      `)
      .order('credit_date', { ascending: false })
      .limit(100)

    if (plantId) query = query.eq('plant_id', plantId)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, credit_notes: data ?? [] })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile?.role || !ALLOWED_ROLES.has(profile.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const body = (await request.json()) as CreatePoCreditNoteInput
    const result = await createPoCreditNote(supabase, user.id, body)

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, credit_note: result.credit_note })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    )
  }
}
