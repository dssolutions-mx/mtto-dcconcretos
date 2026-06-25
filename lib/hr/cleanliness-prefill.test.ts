import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ActorContext } from '@/lib/auth/server-authorization'
import { canAccessCleanlinessPrefill } from './cleanliness-prefill'

function actor(
  overrides: Partial<ActorContext['profile']> & { userId?: string }
): ActorContext {
  const { userId = 'user-1', ...profileOverrides } = overrides
  return {
    userId,
    profile: {
      id: userId,
      role: 'DOSIFICADOR',
      business_unit_id: null,
      plant_id: 'plant-a',
      managed_plant_ids: ['plant-a'],
      can_authorize_up_to: null,
      ...profileOverrides,
    },
    effectiveBusinessRole: null,
    scope: 'plant',
    authorizationLimit: 0,
  }
}

describe('canAccessCleanlinessPrefill', () => {
  it('allows DOSIFICADOR for own plant', () => {
    const result = canAccessCleanlinessPrefill(
      actor({ role: 'DOSIFICADOR', plant_id: 'plant-a' }),
      'plant-a'
    )
    assert.equal(result.allowed, true)
  })

  it('denies DOSIFICADOR for another plant', () => {
    const result = canAccessCleanlinessPrefill(
      actor({ role: 'DOSIFICADOR', plant_id: 'plant-a' }),
      'plant-b'
    )
    assert.equal(result.allowed, false)
    if (!result.allowed) assert.equal(result.status, 403)
  })

  it('allows JEFE_PLANTA for managed plant', () => {
    const result = canAccessCleanlinessPrefill(
      actor({
        role: 'JEFE_PLANTA',
        plant_id: 'plant-a',
        managed_plant_ids: ['plant-a', 'plant-b'],
      }),
      'plant-b'
    )
    assert.equal(result.allowed, true)
  })

  it('denies JEFE_PLANTA for unmanaged plant', () => {
    const result = canAccessCleanlinessPrefill(
      actor({
        role: 'JEFE_PLANTA',
        plant_id: 'plant-a',
        managed_plant_ids: ['plant-a'],
      }),
      'plant-c'
    )
    assert.equal(result.allowed, false)
  })

  it('allows GERENCIA_GENERAL for any plant', () => {
    const result = canAccessCleanlinessPrefill(
      actor({ role: 'GERENCIA_GENERAL', plant_id: null, managed_plant_ids: [] }),
      'plant-z'
    )
    assert.equal(result.allowed, true)
  })

  it('allows RECURSOS_HUMANOS for any plant', () => {
    const result = canAccessCleanlinessPrefill(
      actor({
        role: 'RECURSOS_HUMANOS',
        business_role: 'RECURSOS_HUMANOS',
        plant_id: null,
        managed_plant_ids: [],
      }),
      'plant-z'
    )
    assert.equal(result.allowed, true)
  })

  it('denies unrelated roles', () => {
    const result = canAccessCleanlinessPrefill(
      actor({ role: 'MECANICO', plant_id: 'plant-a' }),
      'plant-a'
    )
    assert.equal(result.allowed, false)
  })
})
