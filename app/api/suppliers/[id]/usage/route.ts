import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { id: supplierId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: srow, error: serr } = await supabase
      .from('suppliers')
      .select('id, name, business_unit_id, created_by, serves_all_business_units, alias_of')
      .eq('id', supplierId)
      .single()
    if (serr || !srow) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const s = srow as {
      id: string
      name: string
      business_unit_id: string | null
      serves_all_business_units: boolean | null
      alias_of: string | null
    }

    const { data: buJunc } = await supabase
      .from('supplier_business_units')
      .select('business_unit_id, business_units ( id, name )')
      .eq('supplier_id', supplierId)

    const { data: aliasRefs } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('alias_of', supplierId)

    const { data: poList } = await supabase
      .from('purchase_orders')
      .select('id, order_id, status, plant_id, work_order_id, total_amount, created_at')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(500)

    const statusCounts: Record<string, number> = {}
    for (const po of poList ?? []) {
      const st = (po as { status?: string }).status || 'unknown'
      statusCounts[st] = (statusCounts[st] || 0) + 1
    }

    const { count: qCount } = await supabase
      .from('purchase_order_quotations')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)

    const { data: partRows, count: partsCount } = await supabase
      .from('inventory_parts')
      .select('id, name, part_number, plant_id', { count: 'exact' })
      .eq('supplier_id', supplierId)
      .limit(200)

    const plantIds = [
      ...new Set(
        (poList ?? [])
          .map((p) => (p as { plant_id?: string | null }).plant_id)
          .filter(Boolean) as string[]
      ),
    ]

    return NextResponse.json({
      supplier: {
        id: s.id,
        name: s.name,
        business_unit_id: s.business_unit_id,
        serves_all_business_units: s.serves_all_business_units,
        alias_of: s.alias_of,
      },
      business_units: buJunc ?? [],
      purchase_orders: {
        total: poList?.length ?? 0,
        by_status: statusCounts,
        recent: (poList ?? []).slice(0, 30),
        plants_referenced: plantIds,
      },
      quotations_count: qCount ?? 0,
      inventory_parts: { count: partsCount ?? 0, sample: partRows ?? [] },
      linked_as_alias: aliasRefs ?? [],
    })
  } catch (e) {
    console.error('usage route', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
