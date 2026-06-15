import { NextResponse } from 'next/server'
import { requireReportsApiAccess } from '@/lib/reports/report-api-auth'

/** BU/plant pickers for reports that must not call ingresos-gastos (GG/JUN only). */
export async function GET() {
  const auth = await requireReportsApiAccess()
  if (!auth.ok) return auth.response

  const { supabase } = auth
  const [{ data: businessUnits, error: buError }, { data: plants, error: plantError }] =
    await Promise.all([
      supabase.from('business_units').select('id, name, code').order('name'),
      supabase
        .from('plants')
        .select('id, name, code, business_unit_id')
        .order('name'),
    ])

  if (buError || plantError) {
    console.error('[scope-filters]', buError ?? plantError)
    return NextResponse.json(
      { error: buError?.message ?? plantError?.message ?? 'Error al cargar filtros' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    businessUnits: businessUnits ?? [],
    plants: plants ?? [],
  })
}
