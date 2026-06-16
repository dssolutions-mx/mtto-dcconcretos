import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildFleetStatusSnapshot,
  computeAssetTireSubState,
  computeCoveragePct,
  computeFleetModuleState,
  getTireUiRole,
} from './fleet-status'

test('computeFleetModuleState returns empty when no tires', () => {
  assert.equal(computeFleetModuleState(0, 0), 'empty')
  assert.equal(computeFleetModuleState(0, 100), 'empty')
})

test('computeFleetModuleState returns operational at 80%+ coverage', () => {
  assert.equal(computeFleetModuleState(10, 80), 'operational')
  assert.equal(computeFleetModuleState(10, 95), 'operational')
})

test('computeFleetModuleState returns partial below 80%', () => {
  assert.equal(computeFleetModuleState(5, 50), 'partial')
})

test('computeCoveragePct handles zero slots', () => {
  assert.equal(computeCoveragePct(0, 0), 0)
  assert.equal(computeCoveragePct(5, 10), 50)
})

test('computeAssetTireSubState detects layout and stock states', () => {
  assert.equal(
    computeAssetTireSubState({
      hasExplicitLayout: false,
      hasModel: true,
      mountedCount: 0,
      totalPositions: 10,
      warehouseCount: 0,
    }),
    'no-layout'
  )
  assert.equal(
    computeAssetTireSubState({
      hasExplicitLayout: true,
      hasModel: true,
      mountedCount: 0,
      totalPositions: 10,
      warehouseCount: 0,
    }),
    'no-stock'
  )
  assert.equal(
    computeAssetTireSubState({
      hasExplicitLayout: true,
      hasModel: true,
      mountedCount: 0,
      totalPositions: 10,
      warehouseCount: 4,
    }),
    'ready-to-mount'
  )
})

test('getTireUiRole maps mechanic and warehouse roles', () => {
  assert.equal(getTireUiRole('OPERADOR'), 'mechanic')
  assert.equal(getTireUiRole('AUXILIAR_COMPRAS'), 'warehouse')
  assert.equal(getTireUiRole('GERENTE_MANTENIMIENTO'), 'supervisor')
})

test('buildFleetStatusSnapshot builds empty fleet KPIs', () => {
  const snap = buildFleetStatusSnapshot({
    totalTires: 0,
    assetsWithLayout: 0,
    totalRollingAssets: 40,
    positionsDefined: 0,
    warehouseCount: 0,
    mountedCount: 0,
    totalMountSlots: 0,
  })
  assert.equal(snap.state, 'empty')
  assert.equal(snap.kpis.coveragePct, 0)
})
