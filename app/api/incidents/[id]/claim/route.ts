import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { isDepartmentMember } from '@/lib/departments/department-membership'
import { isOpenIncidentStatus } from '@/lib/incidents/incident-routing'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: current, error: fetchError } = await supabase
      .from('incident_history')
      .select(
        'id, routing_department_id, assigned_to_id, pipeline_stage, status, asset_id, acknowledged_at, acknowledged_by_id',
      )
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 })
    }

    if (!isOpenIncidentStatus(current.status)) {
      return NextResponse.json({ error: 'El incidente ya está cerrado' }, { status: 400 })
    }

    if (!current.routing_department_id) {
      return NextResponse.json(
        { error: 'Clasifique el incidente en un departamento antes de tomarlo' },
        { status: 400 },
      )
    }

    if (current.assigned_to_id && current.assigned_to_id !== user.id) {
      return NextResponse.json(
        { error: 'El incidente ya está asignado a otro responsable' },
        { status: 409 },
      )
    }

    const { data: asset } = await supabase
      .from('assets')
      .select('plant_id')
      .eq('id', current.asset_id)
      .maybeSingle()

    if (!asset?.plant_id) {
      return NextResponse.json({ error: 'Activo sin planta' }, { status: 400 })
    }

    const isMember = await isDepartmentMember(supabase, {
      userId: user.id,
      plantId: asset.plant_id,
      departmentId: current.routing_department_id,
    })

    if (!isMember) {
      return NextResponse.json(
        { error: 'No perteneces al departamento asignado en esta planta' },
        { status: 403 },
      )
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('incident_history')
      .update({
        assigned_to_id: user.id,
        assigned_at: now,
        acknowledged_at: current.acknowledged_at ?? now,
        acknowledged_by_id: current.acknowledged_by_id ?? user.id,
        pipeline_stage: 'asignado',
        updated_at: now,
      })
      .eq('id', id)
      .select(
        'id, routing_department_id, assigned_to_id, assigned_at, acknowledged_at, acknowledged_by_id, pipeline_stage',
      )
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('incident_assignment_log').insert({
      incident_id: id,
      from_department_id: current.routing_department_id,
      to_department_id: current.routing_department_id,
      from_assignee_id: current.assigned_to_id,
      to_assignee_id: user.id,
      from_pipeline_stage: current.pipeline_stage,
      to_pipeline_stage: 'asignado',
      reason: 'Reclamado por responsable',
      changed_by: user.id,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('POST incident claim error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
