import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// PATCH /api/users/deactivate
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // AuthN
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { user_id: targetUserId, reason = '', revoke_sessions = true } = body || {}

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    // Load current user profile
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, business_unit_id, plant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Authorization: GERENCIA_GENERAL can deactivate anyone; JEFE_UNIDAD_NEGOCIO only within scope
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO']
    if (!allowedRoles.includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Prevent self-deactivation unless GERENCIA_GENERAL
    if (targetUserId === currentProfile.id && currentProfile.role !== 'GERENCIA_GENERAL') {
      return NextResponse.json({ error: 'No puedes desactivar tu propio usuario' }, { status: 400 })
    }

    // Load target user for scope check
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('id, business_unit_id, plant_id')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Usuario objetivo no encontrado' }, { status: 404 })
    }

    if (currentProfile.role === 'JEFE_UNIDAD_NEGOCIO') {
      // Must match same business unit
      if (!currentProfile.business_unit_id || currentProfile.business_unit_id !== targetProfile.business_unit_id) {
        return NextResponse.json({ error: 'Solo puedes desactivar usuarios de tu unidad de negocio' }, { status: 403 })
      }
    }

    // Perform deactivation
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        status: 'inactive',
        deactivated_at: new Date().toISOString(),
        deactivated_by: currentProfile.id,
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
        // Invalidate all refresh tokens for this user (sign out everywhere)
        // @ts-ignore - method name may vary depending on SDK version
        if (typeof (admin as any).auth?.admin?.signOut === 'function') {
          // Some SDKs expose admin.signOut(userId)
          await (admin as any).auth.admin.signOut(targetUserId)
        } else if (typeof (admin as any).auth?.admin?.logout === 'function') {
          await (admin as any).auth.admin.logout(targetUserId)
        } else if (typeof (admin as any).auth?.admin?.invalidateRefreshTokens === 'function') {
          await (admin as any).auth.admin.invalidateRefreshTokens(targetUserId)
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


