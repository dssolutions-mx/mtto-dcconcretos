import { describe, expect, it } from 'vitest'
import { buildOrgFoundationSummary, buildPlantCoverage } from '@/lib/departments/department-coverage'

describe('department-coverage', () => {
  it('flags plants missing canonical departments', () => {
    const plant = buildPlantCoverage('p1', 'Planta 1', [
      { id: 'd1', name: 'Mantenimiento', code: 'MANT', plant_id: 'p1', supervisor_id: null, member_count: 2 },
      { id: 'd2', name: 'Operaciones', code: 'OPER', plant_id: 'p1', supervisor_id: null, member_count: 0 },
    ])

    expect(plant.canonical_configured).toBe(2)
    expect(plant.missing_canonical).toContain('Recursos Humanos')
    expect(plant.departments_without_members).toBe(1)
  })

  it('summarizes org readiness', () => {
    const summary = buildOrgFoundationSummary({
      plants: [{ id: 'p1', name: 'Planta 1' }],
      departments: [
        { id: 'd1', name: 'Mantenimiento', code: 'MANT', plant_id: 'p1', supervisor_id: 'u1', member_count: 3 },
      ],
      membershipCount: 3,
      activeProfilesWithoutMembership: 10,
      openIncidents: { total: 100, routed: 5, assigned: 2, acknowledged: 1 },
    })

    expect(summary.total_memberships).toBe(3)
    expect(summary.open_incidents_routed).toBe(5)
    expect(summary.plants[0]?.canonical_configured).toBeLessThan(4)
  })
})
