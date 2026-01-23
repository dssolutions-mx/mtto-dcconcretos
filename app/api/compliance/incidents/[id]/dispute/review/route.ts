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

    // Verify user is a manager
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'ENCARGADO_MANTENIMIENTO']
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only managers can review disputes' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { decision, review_notes } = body

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { error: 'Decision must be either "approved" or "rejected"' },
        { status: 400 }
      )
    }

    // Verify incident exists and has a pending dispute
    const { data: incident, error: incidentError } = await supabase
      .from('compliance_incidents')
      .select('id, user_id, dispute_status, status')
      .eq('id', id)
      .single()

    if (incidentError || !incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
    }

    if (!['pending', 'under_review'].includes(incident.dispute_status || 'none')) {
      return NextResponse.json(
        { error: 'This incident does not have a pending dispute' },
        { status: 400 }
      )
    }

    // Update incident dispute status
    const updateData: Record<string, unknown> = {
      dispute_status: decision === 'approved' ? 'approved' : 'rejected',
      dispute_reviewed_by: user.id,
      dispute_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (review_notes) {
      updateData.dispute_review_notes = review_notes.trim()
    }

    // If dispute is approved, dismiss the incident
    if (decision === 'approved') {
      updateData.status = 'dismissed'
      updateData.resolved_at = new Date().toISOString()
      updateData.resolved_by = user.id
      updateData.resolution_notes = `Dispute approved: ${review_notes || 'No additional notes'}`
    }

    const { error: updateError } = await supabase
      .from('compliance_incidents')
      .update(updateData)
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
        action: decision === 'approved' ? 'approved' : 'rejected',
        performed_by: user.id,
        notes: review_notes?.trim() || null
      })

    if (historyError) {
      console.error('Error creating dispute history:', historyError)
      // Don't fail the request
    }

    // Notify the user about the decision
    await supabase.from('compliance_notifications').insert({
      user_id: incident.user_id,
      title: decision === 'approved' 
        ? '✅ Disputa Aprobada' 
        : '❌ Disputa Rechazada',
      message: decision === 'approved'
        ? 'Tu disputa ha sido aprobada. El incidente ha sido descartado.'
        : `Tu disputa ha sido rechazada. ${review_notes ? `Notas: ${review_notes}` : ''}`,
      type: decision === 'approved' ? 'compliance_warning' : 'compliance_critical',
      priority: decision === 'approved' ? 'medium' : 'high',
      entity_id: id,
      entity_type: 'incident',
      action_url: `/compliance/incidentes/${id}`,
      action_label: 'Ver Detalles'
    })

    return NextResponse.json({ 
      success: true,
      message: `Dispute ${decision === 'approved' ? 'approved' : 'rejected'} successfully`
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
