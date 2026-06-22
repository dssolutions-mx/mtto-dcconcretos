import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateDotFormat } from './dot-validation'

describe('validateDotFormat', () => {
  it('accepts empty input', () => {
    assert.deepEqual(validateDotFormat(''), { valid: true })
    assert.deepEqual(validateDotFormat('   '), { valid: true })
  })

  it('rejects placeholders and very short values', () => {
    assert.equal(validateDotFormat('eee').valid, false)
    assert.equal(validateDotFormat('ab').valid, false)
  })

  it('warns on short but non-placeholder codes', () => {
    const result = validateDotFormat('AB12C')
    assert.equal(result.valid, false)
    assert.equal(result.severity, 'warning')
  })

  it('accepts realistic sidewall codes', () => {
    assert.deepEqual(validateDotFormat('4521 ABCD 0123'), { valid: true })
    assert.deepEqual(validateDotFormat('  0123 abcd 4521  '), { valid: true })
  })
})
