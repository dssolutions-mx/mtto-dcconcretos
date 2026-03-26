import type { SupabaseClient } from '@supabase/supabase-js'

type ComponentAssignment = {
  id: string
  operator_id: string
  assignment_type: string
  asset_id: string
}

/**
 * After creating a composite, move operator responsibility to the composite row:
 * pick one operator (prefer primary on `primary_component_id`, else any primary, else first)
 * and deactivate all active `asset_operators` rows on the components.
 */
export async function migrateOperatorsToNewComposite(
  supabase: SupabaseClient,
  params: {
    compositeId: string
    componentIds: string[]
    primaryComponentId?: string | null
    actorUserId: string | null
  }
): Promise<{ migrated: boolean; operator_id?: string; error?: string }> {
  const { compositeId, componentIds, primaryComponentId, actorUserId } = params

  const { data: compAssignments, error: fetchErr } = await supabase
    .from('asset_operators')
    .select('id, operator_id, assignment_type, asset_id')
    .in('asset_id', componentIds)
    .eq('status', 'active')

  if (fetchErr || !compAssignments?.length) {
    return { migrated: false }
  }

  const rows = compAssignments as ComponentAssignment[]
  const primaries = rows.filter((a) => a.assignment_type === 'primary')

  let chosen: ComponentAssignment | undefined
  if (primaryComponentId) {
    chosen =
      primaries.find((a) => a.asset_id === primaryComponentId) ||
      rows.find((a) => a.asset_id === primaryComponentId)
  }
  if (!chosen && primaries.length === 1) {
    chosen = primaries[0]
  }
  if (!chosen) {
    chosen = primaries[0] || rows[0]
  }

  const today = new Date().toISOString().split('T')[0]
  const uid = actorUserId || undefined

  const { error: insertErr } = await supabase.from('asset_operators').insert({
    asset_id: compositeId,
    operator_id: chosen.operator_id,
    assignment_type: 'primary',
    start_date: today,
    status: 'active',
    assigned_by: uid,
    created_by: uid,
    updated_by: uid,
  })

  if (insertErr) {
    console.error('migrateOperatorsToNewComposite insert', insertErr)
    return { migrated: false, error: insertErr.message }
  }

  const { error: updErr } = await supabase
    .from('asset_operators')
    .update({
      status: 'inactive',
      end_date: today,
      updated_at: new Date().toISOString(),
    })
    .in(
      'id',
      rows.map((r) => r.id)
    )

  if (updErr) {
    console.error('migrateOperatorsToNewComposite deactivate components', updErr)
    return { migrated: true, operator_id: chosen.operator_id, error: updErr.message }
  }

  return { migrated: true, operator_id: chosen.operator_id }
}
