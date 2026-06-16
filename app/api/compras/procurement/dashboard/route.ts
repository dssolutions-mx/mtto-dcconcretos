import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { fetchProcurementDashboard } from '@/lib/ap/procurement-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const plantId = request.nextUrl.searchParams.get('plant_id')
    const dashboard = await fetchProcurementDashboard(supabase, plantId)

    return NextResponse.json({ success: true, dashboard })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error al cargar resumen de compras',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
