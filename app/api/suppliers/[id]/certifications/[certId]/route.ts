import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { canWriteSupplier } from '@/lib/auth/supplier-padron-permissions'
import { getSupplierActor, getSupplierJunctionBusinessUnitIds } from '@/lib/api/supplier-actor'

type RouteParams = { params: Promise<{ id: string; certId: string }> }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId, certId } = await params
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
    .from('supplier_certifications')
    .update({
      certification_name: body.certification_name,
      certification_number: body.certification_number,
      certificate_url: body.certificate_url,
      issuing_body: body.issuing_body,
      issue_date: body.issue_date,
      expiration_date: body.expiration_date,
      is_active: body.is_active,
    } as never)
    .eq('id', certId)
    .eq('supplier_id', supplierId)
    .select()
    .single()
  if (error) {
    return NextResponse.json({ error: 'Update' }, { status: 500 })
  }
  return NextResponse.json({ certification: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId, certId } = await params
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
    .from('supplier_certifications')
    .delete()
    .eq('id', certId)
    .eq('supplier_id', supplierId)
  if (error) {
    return NextResponse.json({ error: 'Delete' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
