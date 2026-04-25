import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type Cluster = {
  key: string
  kind: 'name_bu' | 'tax_id'
  supplier_ids: string[]
  rows: Array<{
    id: string
    name: string
    business_unit_id: string | null
    tax_id: string | null
    status: string | null
  }>
}

function normName(s: string) {
  return s.trim().toLowerCase()
}

function normTax(s: string | null | undefined) {
  if (!s) return ''
  return s.trim().toLowerCase()
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const minCluster = Math.max(2, parseInt(searchParams.get('min') || '2', 10) || 2)

    const { data: rows, error } = await supabase
      .from('suppliers')
      .select('id, name, business_unit_id, tax_id, status, alias_of')
      .is('alias_of', null)
      .limit(15000)

    if (error) {
      console.error('duplicates fetch', error)
      return NextResponse.json({ error: 'Error al cargar proveedores' }, { status: 500 })
    }

    const byName = new Map<string, typeof rows>()
    const byTax = new Map<string, typeof rows>()

    for (const r of rows ?? []) {
      const nkey = `${normName(r.name)}|${r.business_unit_id ?? '00000000-0000-0000-0000-000000000000'}`
      if (!byName.has(nkey)) byName.set(nkey, [])
      byName.get(nkey)!.push(r)

      const t = normTax(r.tax_id)
      if (t.length >= 10) {
        if (!byTax.has(t)) byTax.set(t, [])
        byTax.get(t)!.push(r)
      }
    }

    const clusters: Cluster[] = []
    for (const [key, list] of byName) {
      if (list.length >= minCluster) {
        clusters.push({
          key,
          kind: 'name_bu',
          supplier_ids: list.map((x) => x.id),
          rows: list.map((x) => ({
            id: x.id,
            name: x.name,
            business_unit_id: x.business_unit_id,
            tax_id: x.tax_id,
            status: x.status,
          })),
        })
      }
    }
    for (const [tkey, list] of byTax) {
      if (list.length >= minCluster) {
        const supplier_ids = list.map((x) => x.id)
        if (supplier_ids.length < minCluster) continue
        clusters.push({
          key: tkey,
          kind: 'tax_id',
          supplier_ids,
          rows: list.map((x) => ({
            id: x.id,
            name: x.name,
            business_unit_id: x.business_unit_id,
            tax_id: x.tax_id,
            status: x.status,
          })),
        })
      }
    }

    return NextResponse.json({ clusters, total_suppliers: rows?.length ?? 0 })
  } catch (e) {
    console.error('duplicates', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
