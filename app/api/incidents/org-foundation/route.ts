import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { buildOrgFoundationSummary } from '@/lib/departments/department-coverage'
import { isOpenIncidentStatus } from '@/lib/incidents/incident-routing'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: plants } = await supabase.from('plants').select('id, name').order('name')
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name, code, plant_id, supervisor_id')

    const membershipCounts = new Map<string, number>()
    const { data: memberships, error: membershipError } = await supabase
      .from('department_memberships')
      .select('department_id')

    if (!membershipError && memberships) {
      for (const row of memberships) {
        membershipCounts.set(row.department_id, (membershipCounts.get(row.department_id) ?? 0) + 1)
      }
    }

    const departmentsWithCounts = (departments ?? []).map((dept) => ({
      ...dept,
      member_count: membershipCounts.get(dept.id) ?? 0,
    }))

    const { count: activeProfiles } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    let activeWithoutMembership = 0
    if (!membershipError) {
      const { data: memberProfileIds } = await supabase
        .from('department_memberships')
        .select('profile_id')
      const memberSet = new Set((memberProfileIds ?? []).map((row) => row.profile_id))
      const { data: activeProfilesList } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true)
      activeWithoutMembership = (activeProfilesList ?? []).filter((p) => !memberSet.has(p.id)).length
    } else {
      activeWithoutMembership = activeProfiles ?? 0
    }

    const { data: openIncidentsRaw } = await supabase
      .from('incident_history')
      .select('routing_department_id, assigned_to_id, acknowledged_at, status')
      .is('merged_into_id', null)

    const open = (openIncidentsRaw ?? []).filter((row) => isOpenIncidentStatus(row.status))
    const summary = buildOrgFoundationSummary({
      plants: plants ?? [],
      departments: departmentsWithCounts,
      membershipCount: memberships?.length ?? 0,
      activeProfilesWithoutMembership: activeWithoutMembership,
      openIncidents: {
        total: open.length,
        routed: open.filter((row) => row.routing_department_id).length,
        assigned: open.filter((row) => row.assigned_to_id).length,
        acknowledged: open.filter((row) => row.acknowledged_at).length,
      },
    })

    return NextResponse.json({
      summary,
      migration_pending: !!membershipError,
    })
  } catch (error) {
    console.error('GET org foundation error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
