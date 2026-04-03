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
  planned_date: string | null
  purchase_order_id: string | null
} | null

type IncidentRow = {
  id: string
  asset_id: string | null
  date: string
  type: string
  description: string
  status: string | null
  work_order_id: string | null
  documents: unknown
  reported_by: string | null
  reported_by_id: string | null
  created_at: string | null
  assets: { id: string; name: string | null; asset_id: string | null } | null
  work_orders: WoRow | WoRow[]
}

function asSingleWo(wo: WoRow | WoRow[]): WoRow {
  if (!wo) return null
  return Array.isArray(wo) ? wo[0] ?? null : wo
}

export async function GET() {
  try {
    const supabase = await createClient()
    const scope = await resolveOperatorIncidentsScope(supabase)
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    if (scope.expandedAssetIds.length === 0) {
      return NextResponse.json({
        assets: [],
        summary: {
          total_open: 0,
          with_wo_pending: 0,
          with_wo_completed: 0,
          without_wo: 0,
        },
        operator: {
          id: scope.profile.id,
          nombre: scope.profile.nombre,
          apellido: scope.profile.apellido,
          role: scope.profile.role,
        },
      })
    }

    const { data: rawIncidents, error: incError } = await supabase
      .from('incident_history')
      .select(
        `
        id,
        asset_id,
        date,
        type,
        description,
        status,
        work_order_id,
        documents,
        reported_by,
        reported_by_id,
        created_at,
        assets ( id, name, asset_id ),
        work_orders!incident_history_work_order_id_fkey (
          id,
          order_id,
          status,
          priority,
          assigned_to,
          created_at,
          completed_at,
          planned_date,
          purchase_order_id
        )
      `
      )
      .in('asset_id', scope.expandedAssetIds)
      .order('date', { ascending: false })
      .limit(500)

    if (incError) {
      console.error('operator incidents list', incError)
      return NextResponse.json({ error: incError.message }, { status: 500 })
    }

    const incidents = (rawIncidents || []) as IncidentRow[]
    const openIncidents = incidents.filter((i) => isIncidentOpenForOperator(i.status))

    const mechanicIds = new Set<string>()
    const woIds: string[] = []
    const poIds: (string | null)[] = []
    for (const i of incidents) {
      const wo = asSingleWo(i.work_orders)
      if (wo?.assigned_to) mechanicIds.add(wo.assigned_to)
      if (wo) {
        woIds.push(wo.id)
        poIds.push(wo.purchase_order_id)
      }
    }

    const allPoRows = await fetchPurchaseOrdersForOperatorWorkOrders(supabase, woIds, poIds)

    const mechanicNames = new Map<string, string>()
    if (mechanicIds.size > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nombre, apellido')
        .in('id', [...mechanicIds])
      for (const p of (profs || []) as { id: string; nombre: string | null; apellido: string | null }[]) {
        const name = `${p.nombre || ''} ${p.apellido || ''}`.trim()
        mechanicNames.set(p.id, name || '—')
      }
    }

    const mapIncident = (i: IncidentRow) => {
      const wo = asSingleWo(i.work_orders)
      const mechanicName = wo?.assigned_to
        ? mechanicNames.get(wo.assigned_to) ?? null
        : null
      const isOpen = isIncidentOpenForOperator(i.status)
      const partsRows = wo
        ? purchaseOrdersForWorkOrder(allPoRows, wo.id, wo.purchase_order_id)
        : []
      const partsProcurement = mergeOperatorPartsProcurement(partsRows)
      return {
        id: i.id,
        type: i.type,
        description: i.description,
        date: i.date,
        status: i.status,
        is_open: isOpen,
        documents: i.documents,
        reported_by: i.reported_by,
        reported_by_id: i.reported_by_id,
        created_at: i.created_at,
        asset_uuid: i.assets?.id ?? i.asset_id,
        asset_code: i.assets?.asset_id ?? null,
        asset_name: i.assets?.name ?? null,
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
              parts_procurement: partsProcurement,
            }
          : null,
      }
    }

    const assetsOut = scope.assignments.map((row) => {
      const a = row.assets
      const rootId = row.asset_id
      const scoped = incidents.filter((inc) =>
        incidentBelongsToAssignment(inc.asset_id, rootId, scope.scopeByAssignment)
      )
      const mapped = scoped.map(mapIncident)
      const openCount = mapped.filter((m) => m.is_open).length
      return {
        asset_uuid: a?.id ?? rootId,
        asset_id: a?.asset_id ?? null,
        asset_name: a?.name ?? null,
        assignment_type: row.assignment_type,
        open_incidents: openCount,
        incidents: mapped,
      }
    })

    let withWoPending = 0
    let withWoCompleted = 0
    let withoutWo = 0
    for (const i of openIncidents) {
      const wo = asSingleWo(i.work_orders)
      if (!wo) {
        withoutWo += 1
        continue
      }
      const st = (wo.status || '').toLowerCase()
      if (st === 'completada' || st === 'completed') withWoCompleted += 1
      else withWoPending += 1
    }

    return NextResponse.json({
      assets: assetsOut,
      summary: {
        total_open: openIncidents.length,
        with_wo_pending: withWoPending,
        with_wo_completed: withWoCompleted,
        without_wo: withoutWo,
      },
      operator: {
        id: scope.profile.id,
        nombre: scope.profile.nombre,
        apellido: scope.profile.apellido,
        role: scope.profile.role,
      },
    })
  } catch (e) {
    console.error('GET /api/operator/incidents', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
