import test from 'node:test'
import assert from 'node:assert/strict'

import {
  groupIncidentsByPipelineStage,
  hoursSince,
  isOpenIncidentStatus,
  isSlaBreached,
} from './incident-routing'

test('detects open incident statuses', () => {
  assert.equal(isOpenIncidentStatus('Abierto'), true)
  assert.equal(isOpenIncidentStatus('resuelto'), false)
})

test('flags SLA breach when elapsed exceeds target', () => {
  const routedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  assert.equal(isSlaBreached(routedAt, 24, 'Abierto'), true)
  assert.equal(isSlaBreached(routedAt, 24, 'resuelto'), false)
})

test('groups incidents by pipeline stage', () => {
  const grouped = groupIncidentsByPipelineStage([
    { id: '1', pipeline_stage: 'bandeja' },
    { id: '2', pipeline_stage: 'asignado' },
    { id: '3', pipeline_stage: 'unknown' },
  ])
  assert.equal(grouped.bandeja.length, 2)
  assert.equal(grouped.asignado.length, 1)
})

test('computes hours since timestamp', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const hours = hoursSince(twoHoursAgo)
  assert.ok(hours >= 1)
  assert.ok(hours <= 3)
})
