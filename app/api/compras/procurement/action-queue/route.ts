import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { fetchProcurementActionQueue } from '@/lib/ap/procurement-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const plantId = request.nextUrl.searchParams.get('plant_id')
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20)
    const items = await fetchProcurementActionQueue(supabase, plantId, limit)

    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error al cargar cola de acciones',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
