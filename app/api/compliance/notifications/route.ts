import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('compliance_notifications')
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
      console.error('Error fetching compliance notifications:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notifications: data || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notification_id, action } = body

    if (!notification_id || !action) {
      return NextResponse.json(
        { error: 'Missing notification_id or action' },
        { status: 400 }
      )
    }

    // Verify notification belongs to user
    const { data: notification, error: fetchError } = await supabase
      .from('compliance_notifications')
      .select('id')
      .eq('id', notification_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    let updateData: Record<string, unknown> = {}

    if (action === 'read') {
      updateData = {
        is_read: true,
        read_at: new Date().toISOString()
      }
    } else if (action === 'dismiss') {
      updateData = {
        is_dismissed: true,
        dismissed_at: new Date().toISOString()
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('compliance_notifications')
      .update(updateData)
      .eq('id', notification_id)

    if (updateError) {
      console.error('Error updating notification:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'mark_all_read') {
      const { error: updateError } = await supabase
        .from('compliance_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_dismissed', false)

      if (updateError) {
        console.error('Error marking all as read:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
