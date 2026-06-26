import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isEphemeralPhotoPreviewUrl,
  sanitizeDieselConsumptionDraftForStorage,
} from './sanitize-diesel-draft'

describe('sanitize-diesel-draft', () => {
  it('isEphemeralPhotoPreviewUrl detects blob and data URLs', () => {
    assert.equal(isEphemeralPhotoPreviewUrl('blob:http://localhost/x'), true)
    assert.equal(isEphemeralPhotoPreviewUrl('data:image/jpeg;base64,abc'), true)
    assert.equal(isEphemeralPhotoPreviewUrl('https://cdn.example.com/x.jpg'), false)
  })

  it('sanitizeDieselConsumptionDraftForStorage strips ephemeral machinePhotoPreview', () => {
    const out = sanitizeDieselConsumptionDraftForStorage({
      productType: 'diesel',
      quantityLiters: '50',
      machinePhotoPreview: 'blob:http://localhost/abc',
      machinePhotoDraftId: 'photo-1',
      savedAt: Date.now(),
    })
    assert.equal(out.machinePhotoPreview, null)
    assert.equal(out.machinePhotoDraftId, 'photo-1')
    assert.equal(out.quantityLiters, '50')
  })

  it('sanitizeDieselConsumptionDraftForStorage keeps https preview', () => {
    const out = sanitizeDieselConsumptionDraftForStorage({
      machinePhotoPreview: 'https://cdn.example.com/evidence.jpg',
    })
    assert.equal(
      out.machinePhotoPreview,
      'https://cdn.example.com/evidence.jpg'
    )
  })

  it('sanitizeDieselConsumptionDraftForStorage removes leaked checklist keys', () => {
    const out = sanitizeDieselConsumptionDraftForStorage({
      notes: 'ok',
      evidenceData: { sec: [{ photo_url: 'blob:x' }] },
      securityData: { st: {} },
    })
    assert.equal(out.notes, 'ok')
    assert.equal('evidenceData' in out, false)
    assert.equal('securityData' in out, false)
  })
})
