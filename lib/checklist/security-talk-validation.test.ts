import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_SECURITY_CONFIG,
  normalizeSecurityConfig,
  resolveExecutionSectionType,
  resolveSecurityTalkUiMode,
} from './security-talk-validation'

describe('security-talk-validation', () => {
  it('normalizeSecurityConfig applies defaults for empty config', () => {
    assert.deepEqual(normalizeSecurityConfig({}), DEFAULT_SECURITY_CONFIG)
    assert.deepEqual(normalizeSecurityConfig(null), DEFAULT_SECURITY_CONFIG)
  })

  it('resolveExecutionSectionType infers security_talk from security_config', () => {
    assert.equal(
      resolveExecutionSectionType({
        section_type: 'checklist',
        security_config: { mode: 'plant_manager' },
      }),
      'security_talk'
    )
    assert.equal(
      resolveExecutionSectionType({
        title: 'Charla',
        security_config: { mode: 'operator' },
      }),
      'security_talk'
    )
    assert.equal(
      resolveExecutionSectionType({
        title: 'Charla',
        security_config: JSON.stringify({ mode: 'plant_manager' }),
      }),
      'security_talk'
    )
  })

  it('resolveExecutionSectionType keeps explicit special types', () => {
    assert.equal(
      resolveExecutionSectionType({ section_type: 'operator_punctuality' }),
      'operator_punctuality'
    )
  })

  it('resolveSecurityTalkUiMode uses operator form for field roles', () => {
    const config = normalizeSecurityConfig({ mode: 'plant_manager' })
    assert.equal(resolveSecurityTalkUiMode(config, 'OPERADOR'), 'operator')
    assert.equal(resolveSecurityTalkUiMode(config, 'MECANICO'), 'operator')
    assert.equal(resolveSecurityTalkUiMode(config, 'DOSIFICADOR'), 'plant_manager')
    assert.equal(
      resolveSecurityTalkUiMode(config, {
        role: 'DOSIFICADOR',
        business_role: 'OPERADOR',
      }),
      'operator'
    )
    assert.equal(resolveSecurityTalkUiMode(config, null), 'operator')
    assert.equal(resolveSecurityTalkUiMode(config, {}), 'operator')
  })
})
