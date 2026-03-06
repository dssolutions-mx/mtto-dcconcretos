import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  loadActorContext,
  canDeactivateUsers,
  checkScopeOverBusinessUnit,
} from '@/lib/auth/server-authorization'

// PATCH /api/users/deactivate
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!canDeactivateUsers(actor)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { user_id: targetUserId, reason = '', revoke_sessions = true } = body || {}

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    if (targetUserId === actor.userId && actor.profile.role !== 'GERENCIA_GENERAL') {
      return NextResponse.json({ error: 'No puedes desactivar tu propio usuario' }, { status: 400 })
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('id, business_unit_id, plant_id')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Usuario objetivo no encontrado' }, { status: 404 })
    }

    if (!checkScopeOverBusinessUnit(actor, targetProfile.business_unit_id)) {
      return NextResponse.json({ error: 'Solo puedes desactivar usuarios de tu unidad de negocio' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        status: 'inactive',
        deactivated_at: new Date().toISOString(),
        deactivated_by: actor.userId,
        deactivation_reason: reason || 'Desactivado por administración'
      })
      .eq('id', targetUserId)

    if (updateError) {
      console.error('Error deactivating user:', updateError)
      return NextResponse.json({ error: 'Error al desactivar usuario' }, { status: 500 })
    }

    // Revoke sessions (best-effort)
    if (revoke_sessions) {
      try {
        const admin = createAdminClient()
        const authAdmin = admin.auth?.admin as { signOut?: (id: string) => Promise<unknown>; logout?: (id: string) => Promise<unknown>; invalidateRefreshTokens?: (id: string) => Promise<unknown> } | undefined
        if (typeof authAdmin?.signOut === 'function') {
          await authAdmin.signOut(targetUserId)
        } else if (typeof authAdmin?.logout === 'function') {
          await authAdmin.logout(targetUserId)
        } else if (typeof authAdmin?.invalidateRefreshTokens === 'function') {
          await authAdmin.invalidateRefreshTokens(targetUserId)
        } else {
          console.warn('Admin client does not support session revocation on this SDK version')
        }
      } catch (revokeError) {
        console.warn('Failed to revoke sessions for user:', revokeError)
      }
    }

    return NextResponse.json({ message: 'Usuario desactivado correctamente' })
  } catch (error) {
    console.error('Unexpected error in PATCH /api/users/deactivate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


