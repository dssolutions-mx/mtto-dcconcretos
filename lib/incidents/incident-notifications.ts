import type { SupabaseClient } from '@supabase/supabase-js'

export type IncidentNotificationType =
  | 'incident_assigned'
  | 'incident_claimed'
  | 'incident_acknowledged'
  | 'incident_routed'
  | 'incident_sla_breach'
  | 'incident_escalation'

export type IncidentNotificationInput = {
  userId: string
  incidentId: string
  type: IncidentNotificationType
  title: string
  message: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  actionUrl?: string
  actionLabel?: string
}

export async function createIncidentNotification(
  supabase: SupabaseClient,
  input: IncidentNotificationInput,
): Promise<void> {
  const { error } = await supabase.from('incident_notifications').insert({
    user_id: input.userId,
    incident_id: input.incidentId,
    type: input.type,
    title: input.title,
    message: input.message,
    priority: input.priority ?? 'medium',
    action_url: input.actionUrl ?? `/incidentes/${input.incidentId}`,
    action_label: input.actionLabel ?? 'Ver incidente',
  })

  if (error) {
    console.warn('incident notification insert failed:', error.message)
  }
}

export async function notifyDepartmentSupervisor(
  supabase: SupabaseClient,
  params: {
    departmentId: string
    incidentId: string
    type: IncidentNotificationType
    title: string
    message: string
    priority?: IncidentNotificationInput['priority']
    excludeUserId?: string
  },
): Promise<void> {
  const { data: department } = await supabase
    .from('departments')
    .select('supervisor_id')
    .eq('id', params.departmentId)
    .maybeSingle()

  if (
    department?.supervisor_id &&
    department.supervisor_id !== params.excludeUserId
  ) {
    await createIncidentNotification(supabase, {
      userId: department.supervisor_id,
      incidentId: params.incidentId,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority,
    })
  }
}
