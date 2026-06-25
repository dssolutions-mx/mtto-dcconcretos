import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildItemDescriptionMap,
  countChecklistSectionItems,
  mapCompletedItemsToChecklistSections,
  normalizeCompletedChecklistSections,
  resolveCompletedItemDescription,
} from './completed-checklist-display'

describe('completed-checklist-display', () => {
  it('keeps duplicate-titled sections when ids differ', () => {
    const sections = normalizeCompletedChecklistSections([
      { id: '3db1e6de', title: 'REVISION GENERAL', order_index: 0, section_type: 'checklist' },
      { id: '82c47d65', title: 'REVISION GENERAL', order_index: 1, section_type: 'checklist' },
    ])

    assert.equal(sections.length, 2)
    assert.equal(sections[0]?.id, '3db1e6de')
    assert.equal(sections[1]?.id, '82c47d65')
  })

  it('dedupes only repeated section ids', () => {
    const sections = normalizeCompletedChecklistSections([
      { id: 'same-id', title: 'A', order_index: 0 },
      { id: 'same-id', title: 'A duplicate row', order_index: 1 },
      { id: 'other-id', title: 'A', order_index: 2 },
    ])

    assert.equal(sections.length, 2)
  })

  it('maps completed items across all same-titled checklist sections', () => {
    const { groups, orphanedItems } = mapCompletedItemsToChecklistSections({
      sections: [
        {
          id: '3db1e6de',
          title: 'REVISION GENERAL',
          order_index: 0,
          section_type: 'checklist',
          checklist_items: [
            { id: 'item-a', description: 'Barcos limpios', order_index: 0 },
          ],
        },
        {
          id: '82c47d65',
          title: 'REVISION GENERAL',
          order_index: 1,
          section_type: 'checklist',
          checklist_items: [
            { id: 'c21c4fda', description: 'Área de carga', order_index: 0 },
            { id: '5917b65c', description: 'Tolvas', order_index: 1 },
          ],
        },
      ],
      completedItems: [
        { item_id: 'item-a', status: 'pass' as const },
        { item_id: 'c21c4fda', status: 'pass' as const },
        { item_id: '5917b65c', status: 'pass' as const },
      ],
    })

    assert.equal(groups.length, 2)
    assert.equal(groups[0]?.items.length, 1)
    assert.equal(groups[1]?.items.length, 2)
    assert.equal(groups[1]?.items[0]?.description, 'Área de carga')
    assert.equal(groups[1]?.items[1]?.description, 'Tolvas')
    assert.deepEqual(orphanedItems, [])
  })

  it('uses completed item description when template snapshot lacks it', () => {
    const map = buildItemDescriptionMap([])
    const label = resolveCompletedItemDescription('c21c4fda', {
      item_id: 'c21c4fda',
      description: 'Área de carga',
    }, map)

    assert.equal(label, 'Área de carga')
  })

  it('counts checklist items across duplicate-titled sections', () => {
    const total = countChecklistSectionItems([
      {
        id: '3db1e6de',
        title: 'REVISION GENERAL',
        section_type: 'checklist',
        checklist_items: [{ id: 'a', description: 'One' }],
      },
      {
        id: '82c47d65',
        title: 'REVISION GENERAL',
        section_type: 'checklist',
        checklist_items: [
          { id: 'b', description: 'Two' },
          { id: 'c', description: 'Three' },
        ],
      },
      {
        id: '350e9448',
        title: 'Charla de Seguridad',
        section_type: 'security_talk',
        checklist_items: [],
      },
    ])

    assert.equal(total, 3)
  })
})
