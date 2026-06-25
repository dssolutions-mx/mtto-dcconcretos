import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aggregateChecklistProgress,
  computeSectionProgressCounts,
  getEvidenceSectionProgress,
  getSecurityTalkSectionProgress,
} from './checklist-completion-progress'

describe('checklist-completion-progress', () => {
  it('optional evidence sections do not inflate completed count', () => {
    const progress = getEvidenceSectionProgress(
      [{}, {}, {}],
      { categories: ['Planta'], min_photos: 0 }
    )
    assert.equal(progress.total, 0)
    assert.equal(progress.completed, 0)
  })

  it('required evidence sections count uploaded photos up to required total', () => {
    const progress = getEvidenceSectionProgress(
      [{}, {}, {}],
      { categories: ['A', 'B'], min_photos: 2 }
    )
    assert.equal(progress.total, 4)
    assert.equal(progress.completed, 3)
  })

  it('reproduces 19/16 when optional evidence photos are uploaded', () => {
    const sections = [
      {
        section: {
          id: 'punctuality',
          section_type: 'operator_punctuality',
          punctuality_config: { require_production_flag: true },
        },
        itemStatus: {},
        sectionEvidences: [],
        sectionSecurityData: {},
        sectionPlantData: {
          had_production: true,
          operator_count: 2,
          entries: [
            { operator_id: 'a', status: 'on_time' as const },
            { operator_id: 'b', status: 'late' as const },
          ],
        },
        sectionTireReadings: [],
      },
      {
        section: {
          id: 'security',
          section_type: 'security_talk',
          security_config: {
            mode: 'plant_manager',
            require_attendance: true,
            require_topic: true,
            require_reflection: true,
          },
        },
        itemStatus: {},
        sectionEvidences: [],
        sectionSecurityData: {
          attendees: ['op-1'],
          topic: 'EPP',
          reflection: 'Usar casco',
        },
        sectionPlantData: undefined,
        sectionTireReadings: [],
      },
      {
        section: {
          id: 'evidence',
          section_type: 'evidence',
          evidence_config: {
            categories: ['Estado general de planta'],
            min_photos: 0,
          },
        },
        itemStatus: {},
        sectionEvidences: [{}, {}, {}],
        sectionSecurityData: {},
        sectionPlantData: undefined,
        sectionTireReadings: [],
      },
      {
        section: {
          id: 'checklist',
          section_type: 'checklist',
          items: Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
          })),
        },
        itemStatus: Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [`item-${index}`, 'pass'])
        ),
        sectionEvidences: [],
        sectionSecurityData: {},
        sectionPlantData: undefined,
        sectionTireReadings: [],
      },
    ]

    const counts = sections.map((input) => computeSectionProgressCounts(input))
    const aggregate = aggregateChecklistProgress(counts)

    assert.equal(aggregate.totalItems, 16)
    assert.equal(aggregate.completedItems, 16)
    assert.equal(aggregate.progressPercentage, 100)
  })

  it('caps aggregate completed at total', () => {
    const aggregate = aggregateChecklistProgress([
      { total: 10, completed: 10 },
      { total: 6, completed: 9 },
    ])
    assert.equal(aggregate.totalItems, 16)
    assert.equal(aggregate.completedItems, 16)
  })

  it('security talk counts required fields once', () => {
    const progress = getSecurityTalkSectionProgress(
      {
        attendees: ['op-1'],
        topic: 'EPP',
        reflection: 'Casco',
      },
      {
        mode: 'plant_manager',
        require_attendance: true,
        require_topic: true,
        require_reflection: true,
      }
    )
    assert.equal(progress.total, 3)
    assert.equal(progress.completed, 3)
  })

  it('operations checklist funnel_config does not count as maintenance issues', () => {
    const counts = computeSectionProgressCounts({
      section: {
        id: 'revision',
        section_type: 'checklist',
        funnel_config: { lane: 'operations_evaluation' },
        items: [
          { id: 'a' },
          { id: 'b' },
        ],
      },
      itemStatus: { a: 'fail', b: 'pass' },
      sectionEvidences: [],
      sectionSecurityData: {},
      sectionPlantData: undefined,
      sectionTireReadings: [],
    })

    assert.equal(counts.hasIssues, false)

    const aggregate = aggregateChecklistProgress([
      {
        section_type: 'checklist',
        funnel_config: { lane: 'operations_evaluation' },
        total: counts.total,
        completed: counts.completed,
        hasIssues: counts.hasIssues,
      },
      {
        section_type: 'checklist',
        total: 2,
        completed: 1,
        hasIssues: true,
      },
    ])

    assert.equal(aggregate.operationsTotal, 2)
    assert.equal(aggregate.maintenanceTotal, 2)
    assert.equal(aggregate.sectionsWithMaintenanceIssues, 1)
  })
})
