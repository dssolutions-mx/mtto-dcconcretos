import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isPersistablePhotoUrl,
  sanitizeLocalChecklistDraft,
  sanitizeSecurityTalkDataForStorage,
  stripEphemeralEvidenceFields,
} from './sanitize-draft'

describe('sanitize-draft', () => {
  it('isPersistablePhotoUrl accepts only http(s)', () => {
    assert.equal(isPersistablePhotoUrl('https://x.com/a.jpg'), true)
    assert.equal(isPersistablePhotoUrl('blob:http://localhost/x'), false)
    assert.equal(isPersistablePhotoUrl('data:image/jpeg;base64,abc'), false)
  })

  it('stripEphemeralEvidenceFields removes blob/data photo_url and file blobs', () => {
    const out = stripEphemeralEvidenceFields({
      photo_url: 'blob:http://localhost/abc',
      photo_id: 'photo_1',
      preview: 'data:image/jpeg;base64,xyz',
      file: new Blob(['x']),
    })
    assert.equal(out.photo_id, 'photo_1')
    assert.equal('photo_url' in out, false)
    assert.equal('preview' in out, false)
    assert.equal('file' in out, false)
  })

  it('sanitizeSecurityTalkDataForStorage keeps photo_id references', () => {
    const out = sanitizeSecurityTalkDataForStorage({
      sec1: {
        topic: 'EPP',
        evidence: [
          { photo_url: 'data:image/jpeg;base64,abc', photo_id: 'p1' },
          { photo_url: 'https://cdn.example.com/x.jpg' },
        ],
      },
    })
    const evidence = (out.sec1 as { evidence: unknown[] }).evidence
    assert.equal(evidence.length, 2)
    assert.equal((evidence[0] as { photo_id: string }).photo_id, 'p1')
    assert.equal('photo_url' in (evidence[0] as object), false)
    assert.equal(
      (evidence[1] as { photo_url: string }).photo_url,
      'https://cdn.example.com/x.jpg'
    )
  })

  it('sanitizeLocalChecklistDraft trims checklist and evidence', () => {
    const out = sanitizeLocalChecklistDraft({
      checklist: { id: 's1', name: 'Test', sections: [{ huge: true }] },
      evidenceData: {
        ev: [{ photo_url: 'blob:x', photoId: 'pid' }],
      },
      securityData: {
        st: { reflection: 'ok', evidence: [{ photo_id: 'p2' }] },
      },
      itemStatus: { a: 'pass' },
    })
    assert.deepEqual(out.checklist, {
      id: 's1',
      name: 'Test',
      assetId: undefined,
      asset: undefined,
      plantId: undefined,
      scheduledDate: undefined,
      scheduledDay: undefined,
    })
    assert.equal((out.evidenceData as Record<string, unknown[]>).ev[0].photoId, 'pid')
    assert.equal(out.itemStatus?.a, 'pass')
  })
})
