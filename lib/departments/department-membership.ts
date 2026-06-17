import type { SupabaseClient } from '@supabase/supabase-js'
import {
  matchDepartmentToCanonical,
  type DbDepartmentRow,
} from '@/lib/incidents/incident-routing-departments'

export type DepartmentMember = {
  id: string
  nombre: string | null
  apellido: string | null
  departamento: string | null
  plant_id: string | null
  role: 'member' | 'supervisor' | 'backup'
  source: string
  is_supervisor: boolean
}

export type DepartmentMembershipRow = {
  profile_id: string
  department_id: string
  role: 'member' | 'supervisor' | 'backup'
  source: string
  profiles?: {
    id: string
    nombre: string | null
    apellido: string | null
    departamento: string | null
    plant_id: string | null
  } | null
  departments?: {
    id: string
    name: string
    code: string
    plant_id: string
    supervisor_id: string | null
  } | null
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** Legacy text match — used when department_memberships table is not yet applied. */
export function profileMatchesDepartmentText(
  profileDepartamento: string | null | undefined,
  department: Pick<DbDepartmentRow, 'name' | 'code'>,
): boolean {
  if (!profileDepartamento) return false
  const deptToken = normalizeToken(profileDepartamento)
  const slug = matchDepartmentToCanonical(department)
  if (slug === 'mantenimiento') {
    return deptToken.includes('mantenimiento') || deptToken === 'mtto' || deptToken === 'mant'
  }
  if (slug === 'operaciones') {
    return (
      deptToken.includes('produccion') ||
      deptToken.includes('producción') ||
      deptToken.includes('operacion') ||
      deptToken.includes('operaciones')
    )
  }
  if (slug === 'recursos_humanos') {
    return deptToken.includes('recursos humanos') || deptToken === 'rh' || deptToken === 'rrhh'
  }
  if (slug === 'calidad') {
    return deptToken.includes('calidad') || deptToken === 'cal' || deptToken === 'qc'
  }
  const name = normalizeToken(department.name)
  const code = normalizeToken(department.code)
  return deptToken === name || deptToken === code || deptToken.includes(name)
}

export async function loadDepartmentMembers(
  supabase: SupabaseClient,
  params: { plantId: string; departmentId: string },
): Promise<DepartmentMember[]> {
  const { plantId, departmentId } = params

  const { data: department, error: deptError } = await supabase
    .from('departments')
    .select('id, name, code, plant_id, supervisor_id')
    .eq('id', departmentId)
    .eq('plant_id', plantId)
    .single()

  if (deptError || !department) return []

  const { data: junctionRows, error: junctionError } = await supabase
    .from('department_memberships')
    .select(
      `
      profile_id,
      role,
      source,
      profiles (
        id,
        nombre,
        apellido,
        departamento,
        plant_id,
        is_active
      )
    `,
    )
    .eq('department_id', departmentId)

  if (!junctionError && junctionRows && junctionRows.length > 0) {
    return junctionRows
      .filter((row) => row.profiles?.is_active !== false)
      .map((row) => ({
        id: row.profiles!.id,
        nombre: row.profiles!.nombre,
        apellido: row.profiles!.apellido,
        departamento: row.profiles!.departamento,
        plant_id: row.profiles!.plant_id,
        role: row.role as DepartmentMember['role'],
        source: row.source,
        is_supervisor: row.role === 'supervisor' || row.profiles!.id === department.supervisor_id,
      }))
      .sort((a, b) => {
        if (a.is_supervisor !== b.is_supervisor) return a.is_supervisor ? -1 : 1
        return `${a.nombre ?? ''}`.localeCompare(`${b.nombre ?? ''}`, 'es')
      })
  }

  // Fallback before migration: text match + supervisor
  const { data: managed } = await supabase
    .from('profile_managed_plants')
    .select('profile_id')
    .eq('plant_id', plantId)

  const managedIds = new Set((managed ?? []).map((row) => row.profile_id))
  const managedFilter =
    managedIds.size > 0
      ? `plant_id.eq.${plantId},id.in.(${[...managedIds].join(',')})`
      : `plant_id.eq.${plantId}`

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, departamento, plant_id')
    .eq('is_active', true)
    .or(managedFilter)
    .order('nombre')

  return (profiles ?? [])
    .filter(
      (profile) =>
        profile.id === department.supervisor_id ||
        profileMatchesDepartmentText(profile.departamento, department),
    )
    .map((profile) => ({
      ...profile,
      role: profile.id === department.supervisor_id ? 'supervisor' : 'member',
      source: 'legacy_text',
      is_supervisor: profile.id === department.supervisor_id,
    }))
}

export async function isDepartmentMember(
  supabase: SupabaseClient,
  params: { userId: string; plantId: string; departmentId: string },
): Promise<boolean> {
  const members = await loadDepartmentMembers(supabase, {
    plantId: params.plantId,
    departmentId: params.departmentId,
  })
  return members.some((member) => member.id === params.userId)
}

/** Department IDs where the user has an explicit or legacy membership. */
export async function getUserDepartmentIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data: junctionRows, error: junctionError } = await supabase
    .from('department_memberships')
    .select('department_id')
    .eq('profile_id', userId)

  if (!junctionError && junctionRows && junctionRows.length > 0) {
    return [...new Set(junctionRows.map((row) => row.department_id))]
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, departamento, plant_id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.departamento) return []

  const { data: departments } = await supabase
    .from('departments')
    .select('id, name, code, plant_id')

  return (departments ?? [])
    .filter((dept) => profileMatchesDepartmentText(profile.departamento, dept))
    .map((dept) => dept.id)
}

export function displayProfileName(
  profile: Pick<DepartmentMember, 'nombre' | 'apellido'>,
): string {
  return `${profile.nombre ?? ''} ${profile.apellido ?? ''}`.trim() || 'Sin nombre'
}
