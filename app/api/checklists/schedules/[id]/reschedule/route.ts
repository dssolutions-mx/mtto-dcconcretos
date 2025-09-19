import { createClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const authHeader = request.headers.get('authorization')
    let supabase

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          cookies: { getAll: () => [], setAll: () => {} }
        }
      )
    } else {
      supabase = await createClient()
    }

    const body = await request.json()
    const newDateInput: string | undefined = body?.new_date || body?.new_day || body?.date

    if (!newDateInput) {
      return NextResponse.json({ error: 'new_date es requerido (YYYY-MM-DD)' }, { status: 400 })
    }

    // Normalize to YYYY-MM-DD
    const parsed = new Date(newDateInput)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
    }
    const yyyy = parsed.getUTCFullYear()
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getUTCDate()).padStart(2, '0')
    const normalizedDate = `${yyyy}-${mm}-${dd}`

    // Optional: get user id for updated_by
    let updatedBy: string | null = null
    try {
      const { data: userData } = await supabase.auth.getUser()
      updatedBy = userData?.user?.id ?? null
    } catch {
      updatedBy = null
    }

    // Ensure schedule exists and is pending
    const { data: schedule, error: scheduleError } = await supabase
      .from('checklist_schedules')
      .select('id, status')
      .eq('id', id)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Checklist programado no encontrado' }, { status: 404 })
    }

    if (schedule.status !== 'pendiente') {
      return NextResponse.json({ error: 'Solo se pueden reprogramar checklists pendientes' }, { status: 400 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('reschedule_checklist', {
      p_schedule_id: id,
      p_new_day: normalizedDate,
      p_updated_by: updatedBy
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (!result?.success) {
      const reason = result?.error || 'reschedule_failed'
      const status = reason === 'duplicate_schedule' ? 409 : 400
      return NextResponse.json({ error: reason, details: result }, { status })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 })
  }
}
