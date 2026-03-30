import type { SupabaseClient } from '@supabase/supabase-js'
import { expandPerAssignmentAssetScopes } from '@/lib/composite-operator-scope'

const RESOLVED_STATUS_KEYS = new Set([
  'resuelto',
  'cerrado',
  'resolved',
  'closed',
])

export type OperatorProfileRow = {
  id: string
  role: string
  plant_id: string | null
  nombre: string | null
  apellido: string | null
}

export type OperatorAssignmentRow = {
  asset_id: string
  assignment_type: string
  start_date: string
  assets: {
    id: string
    name: string | null
    asset_id: string | null
    location?: string | null
    status?: string | null
  } | null
}

export type OperatorScopeResult =
  | {
      ok: true
      userId: string
      profile: OperatorProfileRow
      assignments: OperatorAssignmentRow[]
      /** Union of all asset UUIDs (assigned + composite components) for incident queries */
      expandedAssetIds: string[]
      /** Map from assigned root asset_id -> expanded UUIDs */
      scopeByAssignment: Map<string, string[]>
    }
  | { ok: false; status: number; error: string }

/**
 * Resolves OPERADOR/DOSIFICADOR + active asset_operators + composite expansion.
 */
export async function resolveOperatorIncidentsScope(
  supabase: SupabaseClient
): Promise<OperatorScopeResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, plant_id, nombre, apellido')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false, status: 404, error: 'Profile not found' }
  }

  if (!['OPERADOR', 'DOSIFICADOR'].includes(profile.role)) {
    return { ok: false, status: 403, error: 'Access denied. Only operators can use this endpoint.' }
  }

  const { data: assignedAssets, error: assignmentsError } = await supabase
    .from('asset_operators')
    .select(
      `
      asset_id,
      assignment_type,
      start_date,
      assets (
        id,
        name,
        asset_id,
        location,
        status
      )
    `
    )
    .eq('operator_id', user.id)
    .eq('status', 'active')

  if (assignmentsError) {
    console.error('operator-incidents-scope assignments', assignmentsError)
    return { ok: false, status: 500, error: 'Error fetching assignments' }
  }

  const assignments = (assignedAssets || []) as OperatorAssignmentRow[]
  if (assignments.length === 0) {
    return {
      ok: true,
      userId: user.id,
      profile: profile as OperatorProfileRow,
      assignments: [],
      expandedAssetIds: [],
      scopeByAssignment: new Map(),
    }
  }

  const assignedAssetIds = assignments.map((a) => a.asset_id)
  const scopeByAssignment = await expandPerAssignmentAssetScopes(supabase, assignedAssetIds)
  const expandedAssetIds = [
    ...new Set([].concat(...[...scopeByAssignment.values()] as string[][])),
  ]

  return {
    ok: true,
    userId: user.id,
    profile: profile as OperatorProfileRow,
    assignments,
    expandedAssetIds,
    scopeByAssignment,
  }
}

/** Incident is "open" for operator dashboard if not resolved/closed. */
export function isIncidentOpenForOperator(status: string | null | undefined): boolean {
  if (status == null || status === '') return true
  const s = status.trim().toLowerCase()
  return !RESOLVED_STATUS_KEYS.has(s)
}

export function incidentBelongsToAssignment(
  incidentAssetId: string | null,
  assignmentRootId: string,
  scopeByAssignment: Map<string, string[]>
): boolean {
  if (!incidentAssetId) return false
  const set = scopeByAssignment.get(assignmentRootId)
  if (!set?.length) return incidentAssetId === assignmentRootId
  return set.includes(incidentAssetId)
}
