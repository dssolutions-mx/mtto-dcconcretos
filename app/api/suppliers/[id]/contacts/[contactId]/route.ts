import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { canWriteSupplier } from '@/lib/auth/supplier-padron-permissions'
import { getSupplierActor, getSupplierJunctionBusinessUnitIds } from '@/lib/api/supplier-actor'

type RouteParams = { params: Promise<{ id: string; contactId: string }> }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId, contactId } = await params
  const { data: { user }, error: a } = await supabase.auth.getUser()
  if (a || !user) return NextResponse.json({ error: 'Auth' }, { status: 401 })
  const actor = await getSupplierActor(supabase)
  if (!actor.profile) return NextResponse.json({ error: 'Perfil' }, { status: 403 })
  const { data: row } = await supabase
    .from('suppliers')
    .select('id, created_by, business_unit_id, serves_all_business_units')
    .eq('id', supplierId)
    .single()
  if (!row) return NextResponse.json({ error: 'No' }, { status: 404 })
  const j = await getSupplierJunctionBusinessUnitIds(supabase, supplierId)
  if (
    !canWriteSupplier(
      user.id,
      actor.profile.role,
      actor.profile.business_unit_id,
      {
        id: row.id,
        created_by: row.created_by,
        business_unit_id: row.business_unit_id,
        serves_all_business_units: row.serves_all_business_units ?? false,
      },
      j
    )
  ) {
    return NextResponse.json({ error: 'Permiso' }, { status: 403 })
  }
  const body = (await request.json()) as Record<string, unknown>
  const { data, error } = await supabase
    .from('supplier_contacts')
    .update({
      contact_type: body.contact_type,
      name: body.name,
      position: body.position,
      email: body.email,
      phone: body.phone,
      mobile_phone: body.mobile_phone,
      is_primary: body.is_primary,
      is_active: body.is_active,
    } as never)
    .eq('id', contactId)
    .eq('supplier_id', supplierId)
    .select()
    .single()
  if (error) {
    return NextResponse.json({ error: 'Update' }, { status: 500 })
  }
  return NextResponse.json({ contact: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId, contactId } = await params
  const { data: { user }, error: a } = await supabase.auth.getUser()
  if (a || !user) return NextResponse.json({ error: 'Auth' }, { status: 401 })
  const actor = await getSupplierActor(supabase)
  if (!actor.profile) return NextResponse.json({ error: 'Perfil' }, { status: 403 })
  const { data: row } = await supabase
    .from('suppliers')
    .select('id, created_by, business_unit_id, serves_all_business_units')
    .eq('id', supplierId)
    .single()
  if (!row) return NextResponse.json({ error: 'No' }, { status: 404 })
  const j = await getSupplierJunctionBusinessUnitIds(supabase, supplierId)
  if (
    !canWriteSupplier(
      user.id,
      actor.profile.role,
      actor.profile.business_unit_id,
      {
        id: row.id,
        created_by: row.created_by,
        business_unit_id: row.business_unit_id,
        serves_all_business_units: row.serves_all_business_units ?? false,
      },
      j
    )
  ) {
    return NextResponse.json({ error: 'Permiso' }, { status: 403 })
  }
  const { error } = await supabase
    .from('supplier_contacts')
    .delete()
    .eq('id', contactId)
    .eq('supplier_id', supplierId)
  if (error) {
    return NextResponse.json({ error: 'Delete' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
