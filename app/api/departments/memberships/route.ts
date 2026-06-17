import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext } from '@/lib/auth/server-authorization'

const ELEVATED_ROLES = new Set([
  'GERENCIA_GENERAL',
  'GERENTE_MANTENIMIENTO',
  'RECURSOS_HUMANOS',
  'EJECUTIVO',
  'AREA_ADMINISTRATIVA',
  'JEFE_UNIDAD_NEGOCIO',
])

function canManageMemberships(role: string | null | undefined): boolean {
  return !!role && ELEVATED_ROLES.has(role)
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const plantId = req.nextUrl.searchParams.get('plant_id')
    const departmentId = req.nextUrl.searchParams.get('department_id')

    let query = supabase.from('department_memberships').select(
      `
      profile_id,
      department_id,
      role,
      source,
      created_at,
      profiles ( id, nombre, apellido, departamento, plant_id, is_active ),
      departments ( id, name, code, plant_id, supervisor_id, plants ( name ) )
    `,
    )

    if (departmentId) query = query.eq('department_id', departmentId)
    if (plantId) {
      const { data: deptIds } = await supabase
        .from('departments')
        .select('id')
        .eq('plant_id', plantId)
      const ids = (deptIds ?? []).map((row) => row.id)
      if (ids.length === 0) return NextResponse.json({ memberships: [] })
      query = query.in('department_id', ids)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ memberships: [], migration_pending: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ memberships: data ?? [] })
  } catch (error) {
    console.error('GET memberships error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const actor = await loadActorContext(supabase, user.id)
    if (!actor || !canManageMemberships(actor.profile.role)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const body = (await req.json()) as {
      profile_id: string
      department_id: string
      role?: 'member' | 'supervisor' | 'backup'
    }

    if (!body.profile_id || !body.department_id) {
      return NextResponse.json({ error: 'profile_id y department_id son requeridos' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('department_memberships')
      .upsert(
        {
          profile_id: body.profile_id,
          department_id: body.department_id,
          role: body.role ?? 'member',
          source: 'manual',
          created_by: user.id,
        },
        { onConflict: 'profile_id,department_id' },
      )
      .select()
      .single()

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Migración pendiente: department_memberships no existe aún' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (body.role === 'supervisor') {
      await supabase
        .from('departments')
        .update({ supervisor_id: body.profile_id, updated_at: new Date().toISOString() })
        .eq('id', body.department_id)
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('POST memberships error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const actor = await loadActorContext(supabase, user.id)
    if (!actor || !canManageMemberships(actor.profile.role)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const profileId = req.nextUrl.searchParams.get('profile_id')
    const departmentId = req.nextUrl.searchParams.get('department_id')
    if (!profileId || !departmentId) {
      return NextResponse.json({ error: 'profile_id y department_id son requeridos' }, { status: 400 })
    }

    const { error } = await supabase
      .from('department_memberships')
      .delete()
      .eq('profile_id', profileId)
      .eq('department_id', departmentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE memberships error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
