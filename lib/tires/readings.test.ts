import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildLastRotationAtByInstallation,
  composeInstallationReading,
  latestPressureForInstallation,
  latestTreadForTire,
  type TireReadingRow,
} from './readings'

const tireId = 'tire-1'
const instA = 'inst-a'
const instB = 'inst-b'

const readings: TireReadingRow[] = [
  {
    id: 'r-wh',
    tire_id: tireId,
    installation_id: null,
    asset_id: null,
    read_at: '2026-06-01T10:00:00Z',
    tread_depth_mm: 12,
    pressure_psi: 95,
    checklist_id: null,
    position_code: null,
    notes: 'Lectura inicial (importación)',
    odometer_km: null,
    horometer_hours: null,
    recorded_by: null,
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'r-mount-a',
    tire_id: tireId,
    installation_id: instA,
    asset_id: 'asset-1',
    read_at: '2026-06-05T10:00:00Z',
    tread_depth_mm: 11.5,
    pressure_psi: 100,
    checklist_id: null,
    position_code: 'eje1_izq',
    notes: null,
    odometer_km: 1000,
    horometer_hours: null,
    recorded_by: null,
    created_at: '2026-06-05T10:00:00Z',
  },
  {
    id: 'r-mount-b-tread',
    tire_id: tireId,
    installation_id: instB,
    asset_id: 'asset-2',
    read_at: '2026-06-10T10:00:00Z',
    tread_depth_mm: 11,
    pressure_psi: null,
    checklist_id: null,
    position_code: 'eje2_der',
    notes: null,
    odometer_km: 2000,
    horometer_hours: null,
    recorded_by: null,
    created_at: '2026-06-10T10:00:00Z',
  },
  {
    id: 'r-old-psi',
    tire_id: tireId,
    installation_id: instB,
    asset_id: 'asset-2',
    read_at: '2026-06-08T10:00:00Z',
    tread_depth_mm: null,
    pressure_psi: 90,
    checklist_id: null,
    position_code: 'eje1_izq',
    notes: null,
    odometer_km: 1500,
    horometer_hours: null,
    recorded_by: null,
    created_at: '2026-06-08T10:00:00Z',
  },
]

test('latestTreadForTire returns most recent tread across warehouse and mounts', () => {
  const tread = latestTreadForTire(readings, tireId)
  assert.equal(tread?.id, 'r-mount-b-tread')
  assert.equal(tread?.tread_depth_mm, 11)
})

test('latestPressureForInstallation ignores PSI before position effective since', () => {
  const sinceMount = '2026-06-10T09:00:00Z'
  const psi = latestPressureForInstallation(readings, instB, sinceMount)
  assert.equal(psi, null)

  const sinceBeforeOld = '2026-06-07T00:00:00Z'
  const psiOld = latestPressureForInstallation(readings, instB, sinceBeforeOld)
  assert.equal(psiOld?.pressure_psi, 90)
})

test('composeInstallationReading carries tread on new mount but not old PSI', () => {
  const rotationMap = buildLastRotationAtByInstallation([])
  const composed = composeInstallationReading(
    {
      id: instB,
      tire_id: tireId,
      asset_id: 'asset-2',
      installed_at: '2026-06-10T09:00:00Z',
      removed_at: null,
    },
    readings,
    rotationMap
  )

  assert.equal(composed.latest_reading?.tread_depth_mm, 11)
  assert.equal(composed.latest_reading?.pressure_psi, null)
  assert.equal(composed.needs_pressure_reading, true)
})

test('composeInstallationReading clears PSI after rotation event', () => {
  const rotationMap = buildLastRotationAtByInstallation([
    {
      installation_id: instA,
      event_type: 'rotacion',
      event_at: '2026-06-12T08:00:00Z',
    },
  ])

  const withPostRotationPsi: TireReadingRow[] = [
    ...readings,
    {
      id: 'r-post-rot',
      tire_id: tireId,
      installation_id: instA,
      asset_id: 'asset-1',
      read_at: '2026-06-13T10:00:00Z',
      tread_depth_mm: null,
      pressure_psi: 105,
      checklist_id: null,
      position_code: 'eje2_der',
      notes: null,
      odometer_km: 1100,
      horometer_hours: null,
      recorded_by: null,
      created_at: '2026-06-13T10:00:00Z',
    },
  ]

  const beforeRotation = composeInstallationReading(
    {
      id: instA,
      tire_id: tireId,
      asset_id: 'asset-1',
      installed_at: '2026-06-05T08:00:00Z',
      removed_at: null,
    },
    withPostRotationPsi,
    rotationMap
  )
  assert.equal(beforeRotation.latest_reading?.pressure_psi, 105)
  assert.equal(beforeRotation.needs_pressure_reading, false)

  const withoutPostRotation = composeInstallationReading(
    {
      id: instA,
      tire_id: tireId,
      asset_id: 'asset-1',
      installed_at: '2026-06-05T08:00:00Z',
      removed_at: null,
    },
    readings,
    rotationMap
  )
  assert.equal(withoutPostRotation.latest_reading?.tread_depth_mm, 11)
  assert.equal(withoutPostRotation.latest_reading?.pressure_psi, null)
  assert.equal(withoutPostRotation.needs_pressure_reading, true)
})

test('warehouse tread is available on first mount with no installation PSI', () => {
  const rotationMap = buildLastRotationAtByInstallation([])
  const composed = composeInstallationReading(
    {
      id: 'inst-new',
      tire_id: tireId,
      asset_id: 'asset-3',
      installed_at: '2026-06-15T08:00:00Z',
      removed_at: null,
    },
    readings,
    rotationMap
  )
  assert.equal(composed.latest_reading?.tread_depth_mm, 11)
  assert.equal(composed.latest_reading?.pressure_psi, null)
  assert.equal(composed.needs_pressure_reading, true)
})
