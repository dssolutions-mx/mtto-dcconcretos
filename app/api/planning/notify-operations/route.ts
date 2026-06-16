import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { queueOpsServiceWindowNotification } from '@/lib/planning/service-windows'

/**
 * POST /api/planning/notify-operations
 * Queue ops notification for a confirmed service window.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { service_window_id } = await request.json()
    if (!service_window_id) {
      return NextResponse.json({ error: 'service_window_id requerido' }, { status: 400 })
    }

    await queueOpsServiceWindowNotification(supabase, service_window_id)

    return NextResponse.json({ success: true, queued: true })
  } catch (e) {
    console.error('[planning/notify-operations]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
