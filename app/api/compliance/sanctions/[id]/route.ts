import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { status, resolution_notes } = body

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Get sanction to verify ownership/access
    const { data: sanction, error: sanctionError } = await supabase
      .from('sanctions')
      .select('id, user_id, status')
      .eq('id', id)
      .single()

    if (sanctionError || !sanction) {
      return NextResponse.json(
        { error: 'Sanction not found' },
        { status: 404 }
      )
    }

    // Only managers can update sanctions
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'ENCARGADO_MANTENIMIENTO']
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only managers can update sanctions' },
        { status: 403 }
      )
    }

    // Validate status
    if (status && !['active', 'resolved', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (status) {
      updateData.status = status
      if (status === 'resolved' || status === 'cancelled') {
        updateData.resolved_at = new Date().toISOString()
        updateData.resolved_by = profile.id
      }
    }
    if (resolution_notes !== undefined) {
      updateData.resolution_notes = resolution_notes
    }

    // Update sanction
    const { data: updatedSanction, error: updateError } = await supabase
      .from('sanctions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating sanction:', updateError)
      return NextResponse.json(
        { error: 'Failed to update sanction', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sanction: updatedSanction
    })

  } catch (error) {
    console.error('Error in PATCH /api/compliance/sanctions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('sanctions')
      .select(`
        *,
        user:profiles!user_id (
          id,
          nombre,
          apellido
        ),
        applied_by_profile:profiles!applied_by (
          id,
          nombre,
          apellido
        ),
        resolved_by_profile:profiles!resolved_by (
          id,
          nombre,
          apellido
        ),
        incident:compliance_incidents (
          id,
          incident_type,
          severity
        ),
        policy_rule:policy_rules (
          id,
          title,
          rule_number
        )
      `)
      .eq('id', id)
      .single()

    // Apply RLS: Users can only see their own sanctions unless they're managers
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'ENCARGADO_MANTENIMIENTO']
    if (!allowedRoles.includes(profile.role)) {
      query = query.eq('user_id', profile.id)
    }

    const { data: sanction, error } = await query

    if (error) {
      console.error('Error fetching sanction:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sanction' },
        { status: 500 }
      )
    }

    if (!sanction) {
      return NextResponse.json(
        { error: 'Sanction not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ sanction })

  } catch (error) {
    console.error('Error in GET /api/compliance/sanctions/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


