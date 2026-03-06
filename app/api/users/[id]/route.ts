import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { loadActorContext, canDeleteUsers } from '@/lib/auth/server-authorization'

// DELETE /api/users/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    if (!canDeleteUsers(actor)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id: targetUserId } = await params
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    if (targetUserId === actor.userId) {
      return NextResponse.json({ error: 'No puedes eliminar tu propio usuario' }, { status: 400 })
    }

    // Best-effort: delete Supabase auth user via Admin
    try {
      const admin = createAdminClient()
      const authAdmin = admin.auth?.admin as { deleteUser?: (id: string) => Promise<unknown>; deleteUserById?: (id: string) => Promise<unknown>; users?: { delete: (id: string) => Promise<unknown> } } | undefined
      if (typeof authAdmin?.deleteUser === 'function') {
        await authAdmin.deleteUser(targetUserId)
      } else if (typeof authAdmin?.deleteUserById === 'function') {
        await authAdmin.deleteUserById(targetUserId)
      } else if (typeof authAdmin?.users?.delete === 'function') {
        await authAdmin.users.delete(targetUserId)
      } else {
        console.warn('Admin client does not support deleteUser on this SDK version')
      }
    } catch (adminError) {
      console.error('Failed to delete auth user via admin:', adminError)
      return NextResponse.json({ error: 'No se pudo eliminar el usuario de autenticación' }, { status: 500 })
    }

    // Remove profile row (if not cascaded)
    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', targetUserId)

    if (profileDeleteError) {
      console.warn('Profile delete error (may be already cascaded):', profileDeleteError.message)
    }

    return NextResponse.json({ message: 'Usuario eliminado permanentemente' })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/users/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


