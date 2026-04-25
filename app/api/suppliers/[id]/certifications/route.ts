import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { canWriteSupplier } from '@/lib/auth/supplier-padron-permissions'
import { getSupplierActor, getSupplierJunctionBusinessUnitIds } from '@/lib/api/supplier-actor'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId } = await params
  const { data, error } = await supabase
    .from('supplier_certifications')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('expiration_date', { ascending: true, nullsFirst: false })
  if (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
  return NextResponse.json({ certifications: data ?? [] })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId } = await params
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
    .insert({
      supplier_id: supplierId,
      certification_name: String(body.certification_name || ''),
      certification_number: (body.certification_number as string) || null,
      certificate_url: (body.certificate_url as string) || null,
      issuing_body: (body.issuing_body as string) || null,
      issue_date: (body.issue_date as string) || null,
      expiration_date: (body.expiration_date as string) || null,
      is_active: body.is_active !== false,
    } as never)
    .select()
    .single()
  if (error) {
    return NextResponse.json({ error: 'Insert' }, { status: 500 })
  }
  return NextResponse.json({ certification: data })
}
