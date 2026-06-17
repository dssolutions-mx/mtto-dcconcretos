import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '50'), 1), 100)

    let query = supabase
      .from('incident_notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data, error } = await query

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ notifications: [], migration_pending: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { count } = await supabase
      .from('incident_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_dismissed', false)

    return NextResponse.json({
      notifications: data ?? [],
      unread_count: count ?? 0,
    })
  } catch (error) {
    console.error('GET incident notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as {
      notification_id?: string
      action?: 'read' | 'dismiss' | 'read_all'
    }

    if (body.action === 'read_all') {
      const { error } = await supabase
        .from('incident_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (!body.notification_id || !body.action) {
      return NextResponse.json(
        { error: 'notification_id y action requeridos' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const updateData =
      body.action === 'read'
        ? { is_read: true, read_at: now }
        : { is_dismissed: true, dismissed_at: now, is_read: true, read_at: now }

    const { error } = await supabase
      .from('incident_notifications')
      .update(updateData)
      .eq('id', body.notification_id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH incident notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
