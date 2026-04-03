import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import {
  incidentBelongsToAssignment,
  isIncidentOpenForOperator,
  resolveOperatorIncidentsScope,
} from '@/lib/api/operator-incidents-scope'
import {
  fetchPurchaseOrdersForOperatorWorkOrders,
  mergeOperatorPartsProcurement,
  purchaseOrdersForWorkOrder,
} from '@/lib/operator-incident-procurement'

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
  planned_date: string | null
  purchase_order_id: string | null
} | null

function asSingleWo(wo: WoRow | WoRow[] | null | undefined): WoRow {
  if (!wo) return null
  return Array.isArray(wo) ? wo[0] ?? null : wo
}

type IncidentDetailRow = {
  id: string
  asset_id: string | null
  date: string
  type: string
  description: string
  status: string | null
  impact: string | null
  resolution: string | null
  work_order_id: string | null
  documents: unknown
  reported_by: string | null
  reported_by_id: string | null
  created_at: string | null
  updated_at: string | null
  assets: { id: string; name: string | null; asset_id: string | null; location: string | null } | null
  work_orders: WoRow | WoRow[] | null
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
          type,
          planned_date,
          purchase_order_id
        )
      `
      )
      .eq('id', id)
      .single()

    if (error || !incident) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const inc = incident as IncidentDetailRow
    const assetId = inc.asset_id as string | null
    const allowed = scope.assignments.some((a) =>
      incidentBelongsToAssignment(assetId, a.asset_id, scope.scopeByAssignment)
    )
    if (!allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const wo = asSingleWo(
      inc.work_orders as WoRow | WoRow[] | null | undefined
    )
    let mechanicName: string | null = null
    if (wo?.assigned_to) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('nombre, apellido')
        .eq('id', wo.assigned_to)
        .single()
      if (prof) {
        const pr = prof as { nombre: string | null; apellido: string | null }
        mechanicName = `${pr.nombre || ''} ${pr.apellido || ''}`.trim() || null
      }
    }

    const allPoRows = wo
      ? await fetchPurchaseOrdersForOperatorWorkOrders(supabase, [wo.id], [wo.purchase_order_id])
      : []
    const partsRows = wo
      ? purchaseOrdersForWorkOrder(allPoRows, wo.id, wo.purchase_order_id)
      : []
    const partsProcurement = mergeOperatorPartsProcurement(partsRows)

    const assets = inc.assets as {
      id: string
      name: string | null
      asset_id: string | null
      location: string | null
    } | null

    return NextResponse.json({
      id: inc.id,
      asset_id: inc.asset_id,
      date: inc.date,
      type: inc.type,
      description: inc.description,
      status: inc.status,
      impact: inc.impact,
      resolution: inc.resolution,
      documents: inc.documents,
      reported_by: inc.reported_by,
      reported_by_id: inc.reported_by_id,
      created_at: inc.created_at,
      updated_at: inc.updated_at,
      is_open: isIncidentOpenForOperator(inc.status as string | null),
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
            planned_date: wo.planned_date,
            status: wo.status,
            priority: wo.priority,
            mechanic_name: mechanicName,
            created_at: wo.created_at,
            completed_at: wo.completed_at,
            description: wo.description,
            type: wo.type,
            parts_procurement: partsProcurement,
          }
        : null,
    })
  } catch (e) {
    console.error('GET /api/operator/incidents/[id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
