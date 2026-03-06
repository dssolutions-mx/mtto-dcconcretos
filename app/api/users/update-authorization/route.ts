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
      position,
      notes
    } = body as {
      user_id?: string
      role?: string
      individual_limit?: number
      business_unit_id?: string | null
      plant_id?: string | null
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