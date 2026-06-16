/**
 * Service window lifecycle + ops notification queue.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceWindowReason } from '@/lib/planning/planning-types'

export interface CreateServiceWindowInput {
  asset_id: string
  work_order_id?: string | null
  plant_id?: string | null
  starts_at: string
  ends_at: string
  reason?: ServiceWindowReason
  notes?: string | null
  confirm?: boolean
  notify_operations?: boolean
  created_by?: string | null
}

export async function createServiceWindow(
  supabase: SupabaseClient,
  input: CreateServiceWindowInput,
) {
  const planning_status = input.confirm ? 'confirmed' : 'draft'

  const { data: window, error } = await supabase
    .from('asset_service_windows')
    .insert({
      asset_id: input.asset_id,
      work_order_id: input.work_order_id ?? null,
      plant_id: input.plant_id ?? null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      planning_status,
      reason: input.reason ?? 'corrective',
      notes: input.notes ?? null,
      created_by: input.created_by ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  if (input.work_order_id) {
    await supabase
      .from('work_orders')
      .update({
        service_window_id: window.id,
        planned_start_at: input.starts_at,
        planned_end_at: input.ends_at,
        planned_date: input.starts_at.slice(0, 10),
      })
      .eq('id', input.work_order_id)
  }

  if (input.notify_operations && planning_status === 'confirmed') {
    try {
      await queueOpsServiceWindowNotification(supabase, window.id)
    } catch (e) {
      console.warn('[service-windows] ops notification queue failed:', e)
    }
  }

  return window
}

export async function queueOpsServiceWindowNotification(
  supabase: SupabaseClient,
  serviceWindowId: string,
) {
  const { data: sw } = await supabase
    .from('asset_service_windows')
    .select(
      `
      id, starts_at, ends_at, planning_status, reason, notes, plant_id,
      asset:assets ( id, asset_id, name, status ),
      work_order:work_orders ( id, order_id, description, assigned_to )
    `,
    )
    .eq('id', serviceWindowId)
    .single()

  if (!sw) return

  const asset = sw.asset as { asset_id?: string; name?: string; status?: string } | null
  const wo = sw.work_order as { order_id?: string; description?: string } | null

  const payload = {
    service_window_id: sw.id,
    asset_code: asset?.asset_id,
    asset_name: asset?.name,
    asset_status: asset?.status,
    starts_at: sw.starts_at,
    ends_at: sw.ends_at,
    reason: sw.reason,
    work_order: wo?.order_id,
    description: wo?.description ?? sw.notes,
    message: `Unidad ${asset?.asset_id ?? asset?.name} fuera de servicio programada`,
  }

  const roles = ['JEFE_PLANTA', 'COORDINADOR_MANTENIMIENTO', 'GERENTE_MANTENIMIENTO']

  for (const role of roles) {
    await supabase.from('maintenance_notification_queue').insert({
      notification_type: 'ops_service_window',
      recipient_role: role,
      plant_id: sw.plant_id,
      payload,
      scheduled_send_at: new Date().toISOString(),
      status: 'pending',
    })
  }

  await supabase
    .from('asset_service_windows')
    .update({ ops_notified_at: new Date().toISOString() })
    .eq('id', serviceWindowId)
}

export async function fetchPlanningCalendar(
  supabase: SupabaseClient,
  from: string,
  to: string,
  plantId?: string | null,
) {
  let q = supabase
    .from('planning_calendar_events')
    .select('*')
    .gte('starts_at', `${from}T00:00:00`)
    .lte('starts_at', `${to}T23:59:59`)
    .order('starts_at')

  if (plantId) q = q.eq('plant_id', plantId)

  const { data, error } = await q
  if (!error) return data ?? []

  // Fallback before migration is applied: work orders with planned_date only
  let woQ = supabase
    .from('work_orders')
    .select(
      `
      id, asset_id, plant_id, planned_date, planned_start_at, planned_end_at,
      status, order_id, assigned_to, estimated_duration, service_window_id,
      asset:assets ( asset_id, name, status )
    `,
    )
    .gte('planned_date', from)
    .lte('planned_date', to)
    .in('status', ['Pendiente', 'Programada', 'Esperando repuestos'])

  if (plantId) woQ = woQ.eq('plant_id', plantId)

  const { data: workOrders } = await woQ
  return (workOrders ?? []).map((wo) => {
    const asset = wo.asset as { asset_id?: string; name?: string; status?: string } | null
    return {
      event_id: wo.id,
      event_type: 'work_order',
      asset_id: wo.asset_id,
      work_order_id: wo.id,
      plant_id: wo.plant_id,
      starts_at: wo.planned_start_at ?? `${wo.planned_date}T06:00:00`,
      ends_at:
        wo.planned_end_at ??
        new Date(
          new Date(wo.planned_start_at ?? `${wo.planned_date}T06:00:00`).getTime() +
            (wo.estimated_duration ?? 4) * 3_600_000,
        ).toISOString(),
      status: wo.status,
      reason: null,
      ops_notified_at: null,
      asset_code: asset?.asset_id ?? null,
      asset_name: asset?.name ?? null,
      asset_status: asset?.status ?? null,
      work_order_label: wo.order_id,
      technician_id: wo.assigned_to,
    }
  })
}
