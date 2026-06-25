import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SECTION_FUNNEL_LANE,
  completedItemsHaveMaintenanceIssues,
  getSectionFunnelLane,
  isMaintenanceSection,
  isOperationsEvaluationSection,
  shouldCreateChecklistIssue,
} from './section-funnel'
import { aggregateChecklistProgress } from './checklist-completion-progress'

const ALL_SECTION_TYPES = Object.keys(SECTION_FUNNEL_LANE) as Array<
  keyof typeof SECTION_FUNNEL_LANE
>

test('SECTION_FUNNEL_LANE maps every section type to a lane', () => {
  assert.equal(ALL_SECTION_TYPES.length, 7)
  for (const sectionType of ALL_SECTION_TYPES) {
    const lane = SECTION_FUNNEL_LANE[sectionType]
    assert.ok(lane === 'maintenance' || lane === 'operations_evaluation')
  }
})

test('maintenance lane includes checklist, evidence, tire_readings', () => {
  assert.equal(getSectionFunnelLane('checklist'), 'maintenance')
  assert.equal(getSectionFunnelLane('evidence'), 'maintenance')
  assert.equal(getSectionFunnelLane('tire_readings'), 'maintenance')
  assert.equal(getSectionFunnelLane(undefined), 'maintenance')
  assert.equal(getSectionFunnelLane('maintenance'), 'maintenance')
})

test('operations_evaluation lane includes RH / plant operations sections', () => {
  for (const sectionType of [
    'cleanliness_bonus',
    'security_talk',
    'operator_punctuality',
    'bonus_closure',
  ] as const) {
    assert.equal(getSectionFunnelLane(sectionType), 'operations_evaluation')
    assert.equal(isOperationsEvaluationSection(sectionType), true)
    assert.equal(isMaintenanceSection(sectionType), false)
    assert.equal(shouldCreateChecklistIssue(sectionType), false)
  }
})

test('checklist section with funnel_config operations_evaluation routes to Lane B', () => {
  const section = {
    section_type: 'checklist',
    funnel_config: { lane: 'operations_evaluation' as const },
  }
  assert.equal(getSectionFunnelLane(section), 'operations_evaluation')
  assert.equal(isOperationsEvaluationSection(section), true)
  assert.equal(shouldCreateChecklistIssue(section), false)
})

test('funnel_lane on completed_items overrides default checklist lane', () => {
  assert.equal(
    getSectionFunnelLane({
      section_type: 'checklist',
      funnel_lane: 'operations_evaluation',
    }),
    'operations_evaluation'
  )
  assert.equal(shouldCreateChecklistIssue({
    section_type: 'checklist',
    funnel_lane: 'operations_evaluation',
  }), false)
})

test('shouldCreateChecklistIssue only allows standard maintenance checklist items', () => {
  assert.equal(shouldCreateChecklistIssue('checklist'), true)
  assert.equal(shouldCreateChecklistIssue(undefined), true)
  assert.equal(shouldCreateChecklistIssue('tire_readings'), false)
  assert.equal(shouldCreateChecklistIssue('evidence'), false)
  assert.equal(shouldCreateChecklistIssue('cleanliness_bonus'), false)
  assert.equal(shouldCreateChecklistIssue('security_talk'), false)
  assert.equal(shouldCreateChecklistIssue('operator_punctuality'), false)
  assert.equal(shouldCreateChecklistIssue('bonus_closure'), false)
  assert.equal(
    shouldCreateChecklistIssue({
      section_type: 'checklist',
      funnel_config: { lane: 'operations_evaluation' },
    }),
    false
  )
})

test('completedItemsHaveMaintenanceIssues ignores operations_evaluation failures', () => {
  assert.equal(
    completedItemsHaveMaintenanceIssues([
      { status: 'fail', section_type: 'cleanliness_bonus' },
      { status: 'flag', section_type: 'security_talk' },
    ]),
    false
  )

  assert.equal(
    completedItemsHaveMaintenanceIssues([
      {
        status: 'fail',
        section_type: 'checklist',
        funnel_lane: 'operations_evaluation',
      },
    ]),
    false
  )

  assert.equal(
    completedItemsHaveMaintenanceIssues([
      { status: 'fail', section_type: 'checklist' },
      { status: 'pass', section_type: 'cleanliness_bonus' },
    ]),
    true
  )
})

test('aggregateChecklistProgress splits maintenance vs operations totals', () => {
  const result = aggregateChecklistProgress([
    {
      section_type: 'checklist',
      total: 3,
      completed: 2,
      hasIssues: false,
    },
    {
      section_type: 'checklist',
      funnel_config: { lane: 'operations_evaluation' },
      total: 5,
      completed: 1,
      hasIssues: true,
    },
    {
      section_type: 'operator_punctuality',
      total: 2,
      completed: 2,
    },
  ])

  assert.equal(result.totalItems, 10)
  assert.equal(result.completedItems, 5)
  assert.equal(result.maintenanceTotal, 3)
  assert.equal(result.maintenanceCompleted, 2)
  assert.equal(result.operationsTotal, 7)
  assert.equal(result.operationsCompleted, 3)
  assert.equal(result.sectionsWithMaintenanceIssues, 0)
  assert.equal(result.progressPercentage, 50)
})
