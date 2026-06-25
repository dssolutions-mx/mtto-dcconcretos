import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertCanCompleteChecklistSchedule,
  resolveScheduleAuthContext,
  type ScheduleAuthRow,
} from '@/lib/checklist/executor-authorization'
import type { ActorContext } from '@/lib/auth/server-authorization'

export async function loadScheduleForDraftAuth(
  supabase: SupabaseClient,
  scheduleId: string
) {
  const { data, error } = await supabase
    .from('checklist_schedules')
    .select(
      `
      id,
      asset_id,
      template_id,
      draft_payload,
      draft_updated_at,
      draft_updated_by,
      checklists!template_id (
        executor_roles,
        frequency,
        model_id,
        equipment_models ( maintenance_unit )
      ),
      assets!inner (
        id,
        plant_id,
        model_id,
        equipment_models ( maintenance_unit )
      )
    `
    )
    .eq('id', scheduleId)
    .single()

  if (error || !data) {
    return { schedule: null, error: error ?? new Error('Schedule not found') }
  }

  return { schedule: data, error: null }
}

export async function assertCanEditScheduleDraft(
  supabase: SupabaseClient,
  actor: ActorContext,
  schedule: ScheduleAuthRow
) {
  const { executorRoles, asset } = resolveScheduleAuthContext(schedule)

  return assertCanCompleteChecklistSchedule(
    supabase,
    actor,
    executorRoles,
    asset
  )
}
