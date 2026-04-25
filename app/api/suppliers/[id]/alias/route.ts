import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { canWriteSupplier, isNonJefePadronEditorRole } from '@/lib/auth/supplier-padron-permissions'
import { getSupplierActor, getSupplierJunctionBusinessUnitIds } from '@/lib/api/supplier-actor'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * Set or clear which canonical supplier this row is an alias of.
 * Linking to another row requires padrón editor (non-Jefe) or creator, or Jefe on scoped row.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = (await request.json()) as { alias_of: string | null }
    if (!Object.prototype.hasOwnProperty.call(body, 'alias_of')) {
      return NextResponse.json({ error: 'alias_of requerido' }, { status: 400 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const actor = await getSupplierActor(supabase)
    if (!actor.profile) {
      return NextResponse.json({ error: 'Perfil requerido' }, { status: 403 })
    }
    if (body.alias_of !== null) {
      if (body.alias_of === id) {
        return NextResponse.json({ error: 'No puedes apuntar un proveedor a sí mismo' }, { status: 400 })
      }
      if (!isNonJefePadronEditorRole(actor.profile.role)) {
        return NextResponse.json(
          { error: 'Solo padrón (gerencia, administración, etc.) puede marcar un registro como alias de otro' },
          { status: 403 }
        )
      }
    }

    const { data: row, error: fErr } = await supabase
      .from('suppliers')
      .select('id, created_by, business_unit_id, serves_all_business_units')
      .eq('id', id)
      .single()
    if (fErr || !row) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }
    const j = await getSupplierJunctionBusinessUnitIds(supabase, id)
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
      return NextResponse.json({ error: 'Permiso denegado' }, { status: 403 })
    }

    const { data: upd, error } = await supabase
      .from('suppliers')
      .update({ alias_of: body.alias_of, updated_by: user.id })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('alias update', error)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    return NextResponse.json({ success: true, supplier: upd })
  } catch (e) {
    console.error('alias', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
