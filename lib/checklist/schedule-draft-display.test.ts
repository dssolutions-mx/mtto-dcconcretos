import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  countBonusClosureDecisionsInPayload,
  detectDraftRestorePrompt,
  formatDraftSavedAt,
  resolveDraftSyncStatus,
  scheduleHasVisibleDraft,
} from './schedule-draft-display'

describe('schedule-draft-display', () => {
  it('scheduleHasVisibleDraft uses draft_updated_at or payload', () => {
    assert.equal(scheduleHasVisibleDraft({ draft_updated_at: '2026-06-25T10:00:00Z' }), true)
    assert.equal(
      scheduleHasVisibleDraft({
        draft_payload: { plant_operations_data: { sec: { decisions: [] } } },
      }),
      true
    )
    assert.equal(scheduleHasVisibleDraft({}), false)
  })

  it('detectDraftRestorePrompt prefers server when newer', () => {
    const prompt = detectDraftRestorePrompt({
      serverPayload: { security_data: { a: {} } },
      serverUpdatedAt: '2026-06-25T12:00:00Z',
      serverAuthorName: 'Ana López',
      localData: {
        timestamp: new Date('2026-06-25T10:00:00Z').getTime(),
        itemStatus: { item1: 'pass' },
      },
    })

    assert.ok(prompt)
    assert.equal(prompt?.source, 'both')
    assert.equal(prompt?.savedByName, 'Ana López')
  })

  it('resolveDraftSyncStatus reflects saving and offline states', () => {
    assert.equal(
      resolveDraftSyncStatus({
        saving: true,
        isOnline: true,
        hasPendingSync: false,
        laneBDraftDirty: false,
        hasUnsavedChanges: false,
        serverDraftUpdatedAt: null,
        hasLocalDraft: false,
      }),
      'saving'
    )

    assert.equal(
      resolveDraftSyncStatus({
        saving: false,
        isOnline: false,
        hasPendingSync: false,
        laneBDraftDirty: true,
        hasUnsavedChanges: false,
        serverDraftUpdatedAt: '2026-06-25T10:00:00Z',
        hasLocalDraft: true,
      }),
      'local_only'
    )

    assert.equal(
      resolveDraftSyncStatus({
        saving: false,
        isOnline: true,
        hasPendingSync: false,
        laneBDraftDirty: false,
        hasUnsavedChanges: false,
        serverDraftUpdatedAt: '2026-06-25T10:00:00Z',
        hasLocalDraft: false,
      }),
      'synced'
    )
  })

  it('countBonusClosureDecisionsInPayload counts eligible decisions', () => {
    const count = countBonusClosureDecisionsInPayload({
      plant_operations_data: {
        bonus: {
          decisions: [
            { operator_id: '1', eligible: true },
            { operator_id: '2' },
          ],
        },
      },
    })
    assert.equal(count, 1)
  })

  it('formatDraftSavedAt returns Spanish locale string', () => {
    const formatted = formatDraftSavedAt('2026-06-25T15:30:00Z')
    assert.ok(formatted)
    assert.match(formatted!, /\d/)
  })
})
