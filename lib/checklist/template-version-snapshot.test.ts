import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSectionVersionSnapshot,
  hasSectionVersionConfigFields,
  SECTION_VERSION_SNAPSHOT_CONFIG_KEYS,
} from './template-version-snapshot'
import {
  buildPlantaDailyPreset,
  buildPlantaMonthlyPreset,
} from './planta-template-presets'
import { PLANT_EXECUTOR_ROLES } from './executor-roles'

test('buildSectionVersionSnapshot includes section_type and all config fields', () => {
  const snapshot = buildSectionVersionSnapshot({
    id: 'sec-1',
    title: 'Puntualidad',
    order_index: 0,
    section_type: 'operator_punctuality',
    punctuality_config: { require_production_flag: true },
    items: [],
  })

  assert.equal(snapshot.section_type, 'operator_punctuality')
  assert.deepEqual(snapshot.punctuality_config, { require_production_flag: true })
  for (const key of SECTION_VERSION_SNAPSHOT_CONFIG_KEYS) {
    assert.ok(key in snapshot, `missing ${key}`)
  }
})

test('buildSectionVersionSnapshot serializes items', () => {
  const snapshot = buildSectionVersionSnapshot({
    title: 'Checklist',
    order_index: 0,
    section_type: 'checklist',
    items: [
      {
        description: 'Item A',
        required: false,
        order_index: 0,
        item_type: 'measure',
        expected_value: '10',
        tolerance: '1',
      },
    ],
  })

  assert.equal(snapshot.items.length, 1)
  assert.equal(snapshot.items[0].item_type, 'measure')
  assert.equal(snapshot.items[0].required, false)
})

test('hasSectionVersionConfigFields detects full special-section snapshot', () => {
  const full = buildSectionVersionSnapshot({
    title: 'Mixed',
    order_index: 0,
    section_type: 'security_talk',
    security_config: { mode: 'plant_manager' },
  })
  assert.equal(hasSectionVersionConfigFields(full as Record<string, unknown>), true)

  const legacy = { title: 'Old', order_index: 0, items: [] }
  assert.equal(hasSectionVersionConfigFields(legacy), false)
})

test('buildPlantaDailyPreset matches operaciones diario contract', () => {
  const preset = buildPlantaDailyPreset()
  assert.equal(preset.frequency, 'diario')
  assert.deepEqual(preset.executor_roles, PLANT_EXECUTOR_ROLES)
  assert.equal(preset.sections.length, 3)
  assert.equal(preset.sections[0].section_type, 'operator_punctuality')
  assert.equal(preset.sections[1].section_type, 'security_talk')
  assert.equal(preset.sections[1].security_config?.mode, 'plant_manager')
  assert.equal(preset.sections[2].section_type, 'evidence')
})

test('buildPlantaMonthlyPreset matches operaciones mensual contract', () => {
  const preset = buildPlantaMonthlyPreset()
  assert.equal(preset.frequency, 'mensual')
  assert.deepEqual(preset.executor_roles, PLANT_EXECUTOR_ROLES)
  assert.equal(preset.sections.length, 1)
  assert.equal(preset.sections[0].section_type, 'bonus_closure')
})
