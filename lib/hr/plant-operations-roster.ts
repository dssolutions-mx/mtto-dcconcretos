import type { SupabaseClient } from '@supabase/supabase-js'

export type PlantOperationsRosterSource = 'home_plant' | 'asset_assignment' | 'both'

export type PlantOperationsRosterEntry = {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
  home_plant_id: string | null
  source: PlantOperationsRosterSource
}

type ProfileRow = {
  id: string
  nombre: string | null
  apellido: string | null
  employee_code: string | null
  plant_id: string | null
  role: string | null
  business_role: string | null
}

export function isOperatorProfile(profile: {
  role?: string | null
  business_role?: string | null
}): boolean {
  if (profile.role === 'DOSIFICADOR') return false
  return profile.role === 'OPERADOR' || profile.business_role === 'OPERADOR'
}

function toRosterProfile(row: ProfileRow): Omit<PlantOperationsRosterEntry, 'source'> {
  return {
    id: row.id,
    nombre: row.nombre ?? '',
    apellido: row.apellido ?? '',
    employee_code: row.employee_code ?? undefined,
    home_plant_id: row.plant_id,
  }
}

/**
 * Merges home-plant and asset-assignment operator sets with dedupe by operator id.
 */
export function mergePlantOperationsRoster(
  homePlantOperators: Array<Omit<PlantOperationsRosterEntry, 'source'>>,
  assetAssignmentOperators: Array<Omit<PlantOperationsRosterEntry, 'source'>>
): PlantOperationsRosterEntry[] {
  const homeIds = new Set(homePlantOperators.map((op) => op.id))
  const assignmentIds = new Set(assetAssignmentOperators.map((op) => op.id))
  const byId = new Map<string, PlantOperationsRosterEntry>()

  for (const op of homePlantOperators) {
    byId.set(op.id, {
      ...op,
      source: assignmentIds.has(op.id) ? 'both' : 'home_plant',
    })
  }

  for (const op of assetAssignmentOperators) {
    if (homeIds.has(op.id)) {
      const existing = byId.get(op.id)
      if (existing) {
        existing.source = 'both'
      }
      continue
    }
    byId.set(op.id, {
      ...op,
      source: 'asset_assignment',
    })
  }

  return [...byId.values()].sort((a, b) => {
    const nameCmp = a.nombre.localeCompare(b.nombre, 'es')
    if (nameCmp !== 0) return nameCmp
    return a.apellido.localeCompare(b.apellido, 'es')
  })
}

export type BuildPlantOperationsRosterOptions = {
  /** When true, skip Supabase queries (for tests). */
  _mock?: {
    homePlantOperators: Array<Omit<PlantOperationsRosterEntry, 'source'>>
    assetAssignmentOperators: Array<Omit<PlantOperationsRosterEntry, 'source'>>
  }
}

export async function buildPlantOperationsRoster(
  supabase: SupabaseClient,
  plantId: string,
  options?: BuildPlantOperationsRosterOptions
): Promise<PlantOperationsRosterEntry[]> {
  if (options?._mock) {
    return mergePlantOperationsRoster(
      options._mock.homePlantOperators,
      options._mock.assetAssignmentOperators
    )
  }

  const { data: homeProfiles, error: homeError } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, employee_code, plant_id, role, business_role')
    .eq('plant_id', plantId)
    .eq('status', 'active')
    .or('role.eq.OPERADOR,business_role.eq.OPERADOR')

  if (homeError) {
    console.error('[plant-operations-roster] home profiles', homeError)
  }

  const homePlantOperators = (homeProfiles ?? [])
    .filter((row) => isOperatorProfile(row))
    .map((row) => toRosterProfile(row as ProfileRow))

  const { data: plantAssets, error: assetsError } = await supabase
    .from('assets')
    .select('id')
    .eq('plant_id', plantId)
    .eq('status', 'operational')

  if (assetsError) {
    console.error('[plant-operations-roster] assets', assetsError)
    return mergePlantOperationsRoster(homePlantOperators, [])
  }

  const assetIds = (plantAssets ?? []).map((a) => a.id).filter(Boolean)
  if (assetIds.length === 0) {
    return mergePlantOperationsRoster(homePlantOperators, [])
  }

  const { data: assignments, error: assignError } = await supabase
    .from('asset_operators')
    .select(
      `
      operator_id,
      profiles:operator_id (
        id,
        nombre,
        apellido,
        employee_code,
        plant_id,
        role,
        business_role,
        status
      )
    `
    )
    .in('asset_id', assetIds)
    .eq('status', 'active')

  if (assignError) {
    console.error('[plant-operations-roster] asset_operators', assignError)
    return mergePlantOperationsRoster(homePlantOperators, [])
  }

  const seenAssignmentIds = new Set<string>()
  const assetAssignmentOperators: Array<Omit<PlantOperationsRosterEntry, 'source'>> = []

  for (const row of assignments ?? []) {
    const profile = normalizeNested(row.profiles) as ProfileRow & { status?: string | null }
    if (!profile?.id || profile.status !== 'active') continue
    if (!isOperatorProfile(profile)) continue
    if (seenAssignmentIds.has(profile.id)) continue
    seenAssignmentIds.add(profile.id)
    assetAssignmentOperators.push(toRosterProfile(profile))
  }

  return mergePlantOperationsRoster(homePlantOperators, assetAssignmentOperators)
}

function normalizeNested<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}
