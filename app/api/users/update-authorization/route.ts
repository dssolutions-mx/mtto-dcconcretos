import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext, canUpdateUserAuthorization } from '@/lib/auth/server-authorization'
import { normalizeRoleForPersistence } from '@/lib/auth/role-model'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const {
      user_id,
      role,
      individual_limit,
      business_unit_id,
      plant_id,
      managed_plant_ids,
      position,
      notes,
    } = body as {
      user_id?: string
      role?: string
      individual_limit?: number
      business_unit_id?: string | null
      plant_id?: string | null
      /** Full set of plants for JEFE_PLANTA (primary must match `plant_id` when both sent). */
      managed_plant_ids?: string[] | null
      position?: string
      notes?: string
    }

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!canUpdateUserAuthorization(actor)) {
      return NextResponse.json({ 
        error: 'No tienes permisos para actualizar autorizaciones de usuario' 
      }, { status: 403 })
    }

    if (managed_plant_ids !== undefined && Array.isArray(managed_plant_ids)) {
      if (managed_plant_ids.length === 0) {
        return NextResponse.json(
          { error: 'Jefe de Planta requiere al menos una planta en el alcance' },
          { status: 400 }
        )
      }
      if (plant_id && !managed_plant_ids.includes(plant_id)) {
        return NextResponse.json(
          { error: 'La planta principal debe estar en la lista de plantas asignadas' },
          { status: 400 }
        )
      }
    }

    // Update user profile
    const updateData: Record<string, unknown> = {}
    if (role !== undefined) {
      const normalizedRole = normalizeRoleForPersistence(role)
      if (!normalizedRole) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
      }
      updateData.role = normalizedRole.role
      updateData.business_role = normalizedRole.businessRole
      updateData.role_scope = normalizedRole.roleScope
    }
    if (individual_limit !== undefined) updateData.can_authorize_up_to = individual_limit
    if (business_unit_id !== undefined) updateData.business_unit_id = business_unit_id || null
    if (plant_id !== undefined) updateData.plant_id = plant_id || null
    if (position !== undefined) updateData.position = position

    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user_id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating user profile:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const effectiveRole = (updatedProfile as { role?: string }).role
    if (
      effectiveRole === 'JEFE_PLANTA' &&
      managed_plant_ids !== undefined &&
      Array.isArray(managed_plant_ids)
    ) {
      const primary = (updatedProfile as { plant_id?: string | null }).plant_id
      if (primary && !managed_plant_ids.includes(primary)) {
        return NextResponse.json(
          { error: 'La planta principal debe estar en la lista de plantas asignadas' },
          { status: 400 }
        )
      }
      const toInsert = [...new Set(managed_plant_ids.filter(Boolean))]
      if (toInsert.length > 0) {
        await supabase
          .from('profile_managed_plants')
          .delete()
          .eq('profile_id', user_id)
        const { error: pmpErr } = await supabase.from('profile_managed_plants').insert(
          toInsert.map((pid) => ({ profile_id: user_id, plant_id: pid }))
        )
        if (pmpErr) {
          console.error('profile_managed_plants sync:', pmpErr)
          return NextResponse.json(
            { error: 'No se pudo actualizar el alcance de plantas del Jefe de Planta' },
            { status: 500 }
          )
        }
      }
    } else if (effectiveRole === 'JEFE_PLANTA' && plant_id !== undefined && managed_plant_ids === undefined) {
      const p = (updatedProfile as { plant_id?: string | null }).plant_id
      if (p) {
        await supabase.from('profile_managed_plants').delete().eq('profile_id', user_id)
        const { error: insErr } = await supabase
          .from('profile_managed_plants')
          .insert({ profile_id: user_id, plant_id: p })
        if (insErr) {
          console.warn('profile_managed_plants single-plant sync:', insErr)
        }
      }
    }

    // Log the change for audit purposes (simplified)
    if (notes) {
      console.log('Authorization change:', {
        user_id,
        changed_by: user.id,
        changes: updateData,
        notes,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({ 
      success: true, 
      profile: updatedProfile,
      message: 'Usuario actualizado correctamente' 
    })

  } catch (error) {
    console.error('Unexpected error in PATCH /api/users/update-authorization:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 