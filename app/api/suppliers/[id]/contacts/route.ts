import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { canWriteSupplier } from '@/lib/auth/supplier-padron-permissions'
import { getSupplierActor, getSupplierJunctionBusinessUnitIds } from '@/lib/api/supplier-actor'

type RouteParams = { params: Promise<{ id: string }> }

async function assertCanWrite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  supplierId: string,
  role: string | null,
  bu: string | null
) {
  const { data: row } = await supabase
    .from('suppliers')
    .select('id, created_by, business_unit_id, serves_all_business_units')
    .eq('id', supplierId)
    .single()
  if (!row) return { ok: false as const, status: 404 as const }
  const j = await getSupplierJunctionBusinessUnitIds(supabase, supplierId)
  const ok = canWriteSupplier(
    userId,
    role,
    bu,
    {
      id: row.id,
      created_by: row.created_by,
      business_unit_id: row.business_unit_id,
      serves_all_business_units: row.serves_all_business_units ?? false,
    },
    j
  )
  if (!ok) return { ok: false as const, status: 403 as const }
  return { ok: true as const }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId } = await params
  const { data, error } = await supabase
    .from('supplier_contacts')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('is_primary', { ascending: false })
  if (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
  return NextResponse.json({ contacts: data ?? [] })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { id: supplierId } = await params
  const { data: { user }, error: a } = await supabase.auth.getUser()
  if (a || !user) return NextResponse.json({ error: 'Auth' }, { status: 401 })
  const actor = await getSupplierActor(supabase)
  if (!actor.profile) return NextResponse.json({ error: 'Perfil' }, { status: 403 })
  const w = await assertCanWrite(
    supabase,
    user.id,
    supplierId,
    actor.profile.role,
    actor.profile.business_unit_id
  )
  if (!w.ok) {
    return NextResponse.json({ error: 'Permiso' }, { status: w.status })
  }
  const body = (await request.json()) as Record<string, unknown>
  const { data, error } = await supabase
    .from('supplier_contacts')
    .insert({
      supplier_id: supplierId,
      contact_type: (body.contact_type as string) || 'general',
      name: (body.name as string) || '',
      position: body.position || null,
      email: body.email || null,
      phone: body.phone || null,
      mobile_phone: body.mobile_phone || null,
      is_primary: Boolean(body.is_primary),
      is_active: true,
    } as never)
    .select()
    .single()
  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Insert error' }, { status: 500 })
  }
  return NextResponse.json({ contact: data })
}
