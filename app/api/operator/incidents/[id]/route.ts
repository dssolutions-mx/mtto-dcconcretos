import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import {
  incidentBelongsToAssignment,
  isIncidentOpenForOperator,
  resolveOperatorIncidentsScope,
} from '@/lib/api/operator-incidents-scope'

type WoRow = {
  id: string
  order_id: string
  status: string | null
  priority: string | null
  assigned_to: string | null
  created_at: string | null
  completed_at: string | null
  description: string | null
  type: string | null
} | null

function asSingleWo(wo: WoRow | WoRow[] | null | undefined): WoRow {
  if (!wo) return null
  return Array.isArray(wo) ? wo[0] ?? null : wo
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Incident ID required' }, { status: 400 })
    }

    const supabase = await createClient()
    const scope = await resolveOperatorIncidentsScope(supabase)
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    if (scope.expandedAssetIds.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: incident, error } = await supabase
      .from('incident_history')
      .select(
        `
        id,
        asset_id,
        date,
        type,
        description,
        status,
        impact,
        resolution,
        work_order_id,
        documents,
        reported_by,
        reported_by_id,
        created_at,
        updated_at,
        assets ( id, name, asset_id, location ),
        work_orders!incident_history_work_order_id_fkey (
          id,
          order_id,
          status,
          priority,
          assigned_to,
          created_at,
          completed_at,
          description,
          type
        )
      `
      )
      .eq('id', id)
      .single()

    if (error || !incident) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const assetId = incident.asset_id as string | null
    const allowed = scope.assignments.some((a) =>
      incidentBelongsToAssignment(assetId, a.asset_id, scope.scopeByAssignment)
    )
    if (!allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const wo = asSingleWo(
      incident.work_orders as WoRow | WoRow[] | null | undefined
    )
    let mechanicName: string | null = null
    if (wo?.assigned_to) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('nombre, apellido')
        .eq('id', wo.assigned_to)
        .single()
      if (prof) {
        mechanicName = `${prof.nombre || ''} ${prof.apellido || ''}`.trim() || null
      }
    }

    const assets = incident.assets as {
      id: string
      name: string | null
      asset_id: string | null
      location: string | null
    } | null

    return NextResponse.json({
      id: incident.id,
      asset_id: incident.asset_id,
      date: incident.date,
      type: incident.type,
      description: incident.description,
      status: incident.status,
      impact: incident.impact,
      resolution: incident.resolution,
      documents: incident.documents,
      reported_by: incident.reported_by,
      reported_by_id: incident.reported_by_id,
      created_at: incident.created_at,
      updated_at: incident.updated_at,
      is_open: isIncidentOpenForOperator(incident.status as string | null),
      asset: assets
        ? {
            id: assets.id,
            name: assets.name,
            asset_id: assets.asset_id,
            location: assets.location,
          }
        : null,
      work_order: wo
        ? {
            id: wo.id,
            order_id: wo.order_id,
            status: wo.status,
            priority: wo.priority,
            mechanic_name: mechanicName,
            created_at: wo.created_at,
            completed_at: wo.completed_at,
            description: wo.description,
            type: wo.type,
          }
        : null,
    })
  } catch (e) {
    console.error('GET /api/operator/incidents/[id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
