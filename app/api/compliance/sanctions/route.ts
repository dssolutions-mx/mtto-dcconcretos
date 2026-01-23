import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import type { ApplySanctionRequest } from '@/types/compliance'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to check role
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

    // Only managers can apply sanctions
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'ENCARGADO_MANTENIMIENTO']
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only managers can apply sanctions' },
        { status: 403 }
      )
    }

    const body: ApplySanctionRequest = await request.json()
    const { incident_id, user_id, sanction_type, description, sanction_amount, percentage, policy_rule_id } = body

    // Validate required fields
    if (!user_id || !sanction_type || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, sanction_type, description' },
        { status: 400 }
      )
    }

    // Validate sanction type
    const validSanctionTypes = ['verbal_warning', 'written_warning', 'suspension', 'fine', 'termination', 'other']
    if (!validSanctionTypes.includes(sanction_type)) {
      return NextResponse.json(
        { error: 'Invalid sanction_type' },
        { status: 400 }
      )
    }

    // If fine, require amount or percentage
    if (sanction_type === 'fine' && !sanction_amount && !percentage) {
      return NextResponse.json(
        { error: 'Fine sanctions require sanction_amount or percentage' },
        { status: 400 }
      )
    }

    // Verify incident exists if provided
    if (incident_id) {
      const { data: incident, error: incidentError } = await supabase
        .from('compliance_incidents')
        .select('id, user_id')
        .eq('id', incident_id)
        .single()

      if (incidentError || !incident) {
        return NextResponse.json(
          { error: 'Incident not found' },
          { status: 404 }
        )
      }

      // Verify incident user matches sanction user
      if (incident.user_id !== user_id) {
        return NextResponse.json(
          { error: 'Incident user_id does not match sanction user_id' },
          { status: 400 }
        )
      }
    }

    // Verify user exists
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id, nombre, apellido')
      .eq('id', user_id)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      )
    }

    // Create sanction
    const { data: sanction, error: sanctionError } = await supabase
      .from('sanctions')
      .insert({
        incident_id: incident_id || null,
        user_id,
        policy_rule_id: policy_rule_id || null,
        sanction_type,
        description,
        sanction_amount: sanction_amount || null,
        percentage: percentage || null,
        applied_date: new Date().toISOString().split('T')[0],
        applied_by: profile.id,
        status: 'active'
      })
      .select()
      .single()

    if (sanctionError) {
      console.error('Error creating sanction:', sanctionError)
      return NextResponse.json(
        { error: 'Failed to create sanction', details: sanctionError.message },
        { status: 500 }
      )
    }

    // Create notification for the user
    const { error: notificationError } = await supabase
      .from('compliance_notifications')
      .insert({
        user_id,
        title: `Sanción Aplicada: ${sanction_type === 'verbal_warning' ? 'Llamada Verbal' : sanction_type === 'written_warning' ? 'Amonestación Escrita' : sanction_type === 'suspension' ? 'Suspensión' : sanction_type === 'fine' ? 'Multa' : sanction_type === 'termination' ? 'Terminación' : 'Otra'}`,
        message: description,
        type: 'sanction_applied',
        priority: sanction_type === 'termination' ? 'critical' : sanction_type === 'suspension' ? 'high' : 'medium',
        entity_id: sanction.id,
        entity_type: 'sanction',
        action_url: '/compliance/sanciones',
        action_label: 'Ver Detalles'
      })

    if (notificationError) {
      console.error('Error creating notification:', notificationError)
      // Don't fail the request if notification fails
    }

    // If incident_id provided, optionally update incident status
    if (incident_id) {
      await supabase
        .from('compliance_incidents')
        .update({ 
          status: 'confirmed',
          resolved_at: new Date().toISOString(),
          resolved_by: profile.id,
          resolution_notes: `Sanción aplicada: ${sanction_type}`
        })
        .eq('id', incident_id)
    }

    return NextResponse.json({
      success: true,
      sanction
    }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/compliance/sanctions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const status = searchParams.get('status')
    const sanctionType = searchParams.get('sanction_type')

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
      .order('applied_date', { ascending: false })
      .limit(100)

    // Apply filters based on role
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'ENCARGADO_MANTENIMIENTO']
    
    if (allowedRoles.includes(profile.role)) {
      // Managers can see all sanctions in their scope
      if (userId) {
        query = query.eq('user_id', userId)
      }
    } else {
      // Regular users can only see their own sanctions
      query = query.eq('user_id', profile.id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (sanctionType) {
      query = query.eq('sanction_type', sanctionType)
    }

    const { data: sanctions, error } = await query

    if (error) {
      console.error('Error fetching sanctions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sanctions' },
        { status: 500 }
      )
    }

    return NextResponse.json({ sanctions: sanctions || [] })

  } catch (error) {
    console.error('Error in GET /api/compliance/sanctions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


