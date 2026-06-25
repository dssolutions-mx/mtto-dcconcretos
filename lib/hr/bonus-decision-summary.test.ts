import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aggregateBonusPaySheetRows,
  computeTrafficLight,
  summarizeBonusPaySheet,
} from './bonus-decision-summary'

describe('bonus-decision-summary', () => {
  it('aggregateBonusPaySheetRows — punctuality, cleanliness, closure', () => {
    const operators = [
      {
        operator_id: 'op-1',
        operator_name: 'Ana López',
        employee_code: 'E001',
        plant_id: 'plant-1',
        plant_name: 'Planta Norte',
      },
      {
        operator_id: 'op-2',
        operator_name: 'Bruno Díaz',
        employee_code: 'E002',
        plant_id: 'plant-1',
        plant_name: 'Planta Norte',
      },
    ]

    const events = [
      { operator_id: 'op-1', plant_id: 'plant-1', event_type: 'punctuality', event_date: '2026-06-01', status: 'on_time' },
      { operator_id: 'op-1', plant_id: 'plant-1', event_type: 'punctuality', event_date: '2026-06-02', status: 'late' },
      { operator_id: 'op-1', plant_id: 'plant-1', event_type: 'cleanliness_weekly', event_date: '2026-06-07', status: 'pass' },
      { operator_id: 'op-1', plant_id: 'plant-1', event_type: 'cleanliness_weekly', event_date: '2026-06-14', status: 'fail' },
      {
        operator_id: 'op-1',
        plant_id: 'plant-1',
        event_type: 'cleanliness_closure',
        event_date: '2026-06-24',
        status: 'eligible',
        period_year: 2026,
        period_month: 6,
        metadata: { system_suggested_eligible: true, weekly_pass_rate: 0.5 },
      },
      { operator_id: 'op-2', plant_id: 'plant-1', event_type: 'punctuality', event_date: '2026-06-01', status: 'absent' },
    ]

    const rows = aggregateBonusPaySheetRows(operators, events, { year: 2026, month: 6 })
    assert.equal(rows.length, 2)

    const ana = rows.find((r) => r.operator_id === 'op-1')!
    assert.equal(ana.punctuality_pct, 50)
    assert.equal(ana.cleanliness_pass_rate, 50)
    assert.equal(ana.closure_official, true)
    assert.equal(ana.system_recommendation, 'eligible')
    assert.equal(ana.traffic_light, 'green')

    const bruno = rows.find((r) => r.operator_id === 'op-2')!
    assert.equal(bruno.punctuality_pct, 0)
    assert.equal(bruno.closure_official, null)
  })

  it('aggregateBonusPaySheetRows — includes operators without events', () => {
    const operators = [
      {
        operator_id: 'op-3',
        operator_name: 'Carlos Ruiz',
        employee_code: 'E003',
        plant_id: 'plant-1',
        plant_name: 'Planta Norte',
      },
    ]

    const rows = aggregateBonusPaySheetRows(operators, [], { year: 2026, month: 6 })
    assert.equal(rows.length, 1)
    assert.equal(rows[0].operator_name, 'Carlos Ruiz')
    assert.equal(rows[0].punctuality_pct, null)
    assert.equal(rows[0].system_recommendation, 'pending')
  })

  it('computeTrafficLight — ineligible closure is red', () => {
    assert.equal(
      computeTrafficLight({
        punctuality_pct: 95,
        cleanliness_pass_rate: 90,
        closure_official: false,
        system_recommendation: 'ineligible',
      }),
      'red'
    )
  })

  it('summarizeBonusPaySheet — averages and closure counts', () => {
    const summary = summarizeBonusPaySheet([
      {
        operator_id: 'a',
        operator_name: 'A',
        employee_code: null,
        plant_id: 'p',
        plant_name: 'P',
        punctuality_pct: 80,
        cleanliness_pass_rate: 100,
        closure_official: true,
        system_recommendation: 'eligible',
        traffic_light: 'green',
        punctuality_days_total: 5,
        punctuality_days_on_time: 4,
        cleanliness_evals_total: 2,
        cleanliness_evals_passed: 2,
      },
      {
        operator_id: 'b',
        operator_name: 'B',
        employee_code: null,
        plant_id: 'p',
        plant_name: 'P',
        punctuality_pct: 60,
        cleanliness_pass_rate: 50,
        closure_official: null,
        system_recommendation: 'pending',
        traffic_light: 'yellow',
        punctuality_days_total: 5,
        punctuality_days_on_time: 3,
        cleanliness_evals_total: 2,
        cleanliness_evals_passed: 1,
      },
    ])

    assert.equal(summary.total_operators, 2)
    assert.equal(summary.closure_completed, 1)
    assert.equal(summary.closure_eligible, 1)
    assert.equal(summary.avg_punctuality_pct, 70)
    assert.equal(summary.avg_cleanliness_pass_rate, 75)
  })
})
