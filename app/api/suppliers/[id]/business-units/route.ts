import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { canWriteBusinessUnitJunction } from '@/lib/auth/supplier-padron-permissions'
import { getSupplierActor, getSupplierJunctionBusinessUnitIds } from '@/lib/api/supplier-actor'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId } = await params
  const { business_unit_id: buId } = (await request.json()) as { business_unit_id: string }
  if (!buId) {
    return NextResponse.json({ error: 'business_unit_id requerido' }, { status: 400 })
  }
  const { data: { user }, error: a } = await supabase.auth.getUser()
  if (a || !user) return NextResponse.json({ error: 'Auth' }, { status: 401 })
  const actor = await getSupplierActor(supabase)
  if (!actor.profile) return NextResponse.json({ error: 'Perfil' }, { status: 403 })
  const { data: s } = await supabase
    .from('suppliers')
    .select('id, business_unit_id, serves_all_business_units')
    .eq('id', supplierId)
    .single()
  if (!s) return NextResponse.json({ error: 'No' }, { status: 404 })
  const j = await getSupplierJunctionBusinessUnitIds(supabase, supplierId)
  if (
    !canWriteBusinessUnitJunction(
      actor.profile.role,
      actor.profile.business_unit_id,
      s,
      j,
      buId
    )
  ) {
    return NextResponse.json({ error: 'Permiso' }, { status: 403 })
  }
  const { error } = await supabase.from('supplier_business_units').insert({
    supplier_id: supplierId,
    business_unit_id: buId,
  } as never)
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya asignada' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId } = await params
  const buId = new URL(request.url).searchParams.get('business_unit_id')
  if (!buId) {
    return NextResponse.json({ error: 'business_unit_id query' }, { status: 400 })
  }
  const { data: { user }, error: a } = await supabase.auth.getUser()
  if (a || !user) return NextResponse.json({ error: 'Auth' }, { status: 401 })
  const actor = await getSupplierActor(supabase)
  if (!actor.profile) return NextResponse.json({ error: 'Perfil' }, { status: 403 })
  const { data: s } = await supabase
    .from('suppliers')
    .select('id, business_unit_id, serves_all_business_units')
    .eq('id', supplierId)
    .single()
  if (!s) return NextResponse.json({ error: 'No' }, { status: 404 })
  const j = await getSupplierJunctionBusinessUnitIds(supabase, supplierId)
  if (
    !canWriteBusinessUnitJunction(
      actor.profile.role,
      actor.profile.business_unit_id,
      s,
      j,
      buId
    )
  ) {
    return NextResponse.json({ error: 'Permiso' }, { status: 403 })
  }
  const { error } = await supabase
    .from('supplier_business_units')
    .delete()
    .eq('supplier_id', supplierId)
    .eq('business_unit_id', buId)
  if (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
