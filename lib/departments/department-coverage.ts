import {
  CANONICAL_ROUTING_DEPARTMENTS,
  matchDepartmentToCanonical,
  resolveCanonicalRoutingDepartments,
  type DbDepartmentRow,
  type ResolvedCanonicalDepartment,
} from '@/lib/incidents/incident-routing-departments'

export type PlantDepartmentRow = DbDepartmentRow & {
  supervisor_id?: string | null
  member_count?: number
}

export type PlantCoverageSummary = {
  plant_id: string
  plant_name: string
  canonical_configured: number
  canonical_total: number
  departments_without_supervisor: number
  departments_without_members: number
  missing_canonical: string[]
}

export type OrgFoundationSummary = {
  total_plants: number
  plants_fully_configured: number
  total_departments: number
  departments_with_supervisor: number
  total_memberships: number
  active_profiles_without_membership: number
  open_incidents_total: number
  open_incidents_routed: number
  open_incidents_assigned: number
  open_incidents_acknowledged: number
  plants: PlantCoverageSummary[]
}

export function buildPlantCoverage(
  plantId: string,
  plantName: string,
  departments: PlantDepartmentRow[],
): PlantCoverageSummary {
  const plantDepts = departments.filter((dept) => dept.plant_id === plantId)
  const canonical = resolveCanonicalRoutingDepartments(plantDepts)
  const configured = canonical.filter((bucket) => bucket.primaryDepartmentId).length
  const missing = CANONICAL_ROUTING_DEPARTMENTS.filter(
    (bucket) => !canonical.find((resolved) => resolved.slug === bucket.slug)?.primaryDepartmentId,
  ).map((bucket) => bucket.label)

  const withoutSupervisor = plantDepts.filter((dept) => !dept.supervisor_id).length
  const withoutMembers = plantDepts.filter((dept) => (dept.member_count ?? 0) === 0).length

  return {
    plant_id: plantId,
    plant_name: plantName,
    canonical_configured: configured,
    canonical_total: CANONICAL_ROUTING_DEPARTMENTS.length,
    departments_without_supervisor: withoutSupervisor,
    departments_without_members: withoutMembers,
    missing_canonical: missing,
  }
}

export function buildOrgFoundationSummary(input: {
  plants: { id: string; name: string }[]
  departments: PlantDepartmentRow[]
  membershipCount: number
  activeProfilesWithoutMembership: number
  openIncidents: {
    total: number
    routed: number
    assigned: number
    acknowledged: number
  }
}): OrgFoundationSummary {
  const plants = input.plants.map((plant) =>
    buildPlantCoverage(plant.id, plant.name, input.departments),
  )

  const fullyConfigured = plants.filter(
    (plant) => plant.canonical_configured === plant.canonical_total,
  ).length

  return {
    total_plants: input.plants.length,
    plants_fully_configured: fullyConfigured,
    total_departments: input.departments.length,
    departments_with_supervisor: input.departments.filter((dept) => dept.supervisor_id).length,
    total_memberships: input.membershipCount,
    active_profiles_without_membership: input.activeProfilesWithoutMembership,
    open_incidents_total: input.openIncidents.total,
    open_incidents_routed: input.openIncidents.routed,
    open_incidents_assigned: input.openIncidents.assigned,
    open_incidents_acknowledged: input.openIncidents.acknowledged,
    plants,
  }
}

export function isDepartmentCanonicalConfigured(
  department: Pick<DbDepartmentRow, 'name' | 'code'>,
): boolean {
  return matchDepartmentToCanonical(department) !== null
}

export function canonicalBucketForDepartment(
  department: Pick<DbDepartmentRow, 'name' | 'code'>,
): ResolvedCanonicalDepartment | null {
  const slug = matchDepartmentToCanonical(department)
  if (!slug) return null
  return CANONICAL_ROUTING_DEPARTMENTS.find((bucket) => bucket.slug === slug) ?? null
}
