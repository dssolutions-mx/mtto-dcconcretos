import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { dispute_reason } = body

    if (!dispute_reason || dispute_reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Dispute reason is required' },
        { status: 400 }
      )
    }

    // Verify incident exists and belongs to user
    const { data: incident, error: incidentError } = await supabase
      .from('compliance_incidents')
      .select('id, user_id, status, dispute_status')
      .eq('id', id)
      .single()

    if (incidentError || !incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
    }

    // Only the user assigned to the incident can dispute it
    if (incident.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only dispute incidents assigned to you' },
        { status: 403 }
      )
    }

    // Can only dispute if status is pending_review or confirmed
    if (!['pending_review', 'confirmed'].includes(incident.status)) {
      return NextResponse.json(
        { error: 'Can only dispute incidents that are pending review or confirmed' },
        { status: 400 }
      )
    }

    // Can only dispute if not already disputed or under review
    if (['pending', 'under_review'].includes(incident.dispute_status || 'none')) {
      return NextResponse.json(
        { error: 'This incident already has a pending dispute' },
        { status: 400 }
      )
    }

    // Update incident with dispute
    const { error: updateError } = await supabase
      .from('compliance_incidents')
      .update({
        dispute_reason: dispute_reason.trim(),
        dispute_status: 'pending',
        dispute_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating incident:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Create dispute history entry
    const { error: historyError } = await supabase
      .from('compliance_dispute_history')
      .insert({
        incident_id: id,
        action: 'submitted',
        performed_by: user.id,
        notes: dispute_reason.trim()
      })

    if (historyError) {
      console.error('Error creating dispute history:', historyError)
      // Don't fail the request, just log
    }

    // Notify managers about the dispute
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single()

    if (userProfile) {
      // Get managers who should be notified
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA'])
        .or(
          `role.eq.GERENCIA_GENERAL,role.eq.AREA_ADMINISTRATIVA${
            userProfile.plant_id ? `,plant_id.eq.${userProfile.plant_id}` : ''
          }${
            userProfile.business_unit_id ? `,business_unit_id.eq.${userProfile.business_unit_id}` : ''
          }`
        )

      if (managers && managers.length > 0) {
        const { data: incidentDetails } = await supabase
          .from('compliance_incidents')
          .select('id, incident_type, severity')
          .eq('id', id)
          .single()

        managers.forEach(async (manager) => {
          await supabase.from('compliance_notifications').insert({
            user_id: manager.id,
            title: '⚠️ Disputa de Incidente',
            message: `Un incidente de cumplimiento ha sido disputado. Revisar y resolver.`,
            type: 'compliance_critical',
            priority: 'high',
            entity_id: id,
            entity_type: 'incident',
            action_url: `/compliance/incidentes/${id}`,
            action_label: 'Revisar Disputa'
          })
        })
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Dispute submitted successfully'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get dispute history
    const { data: history, error: historyError } = await supabase
      .from('compliance_dispute_history')
      .select(`
        *,
        performed_by_profile:profiles!performed_by (
          id,
          nombre,
          apellido,
          role
        )
      `)
      .eq('incident_id', id)
      .order('created_at', { ascending: true })

    if (historyError) {
      console.error('Error fetching dispute history:', historyError)
      return NextResponse.json({ error: historyError.message }, { status: 500 })
    }

    return NextResponse.json({ history: history || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
