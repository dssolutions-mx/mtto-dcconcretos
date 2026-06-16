import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyNominaConcept } from './nomina-concept-classifier'

test('classifies bonus via is_bonus flag', () => {
  assert.equal(classifyNominaConcept({ is_bonus: true }), 'bono')
})

test('classifies tiempo extra from expense_subcategory', () => {
  assert.equal(
    classifyNominaConcept({ expense_subcategory: 'Tiempo Extra', is_cash_payment: true }),
    'tiempo_extra'
  )
})

test('classifies apoyo from description', () => {
  assert.equal(
    classifyNominaConcept({ description: 'APOYO A OPERADOR P3', is_cash_payment: true }),
    'apoyo'
  )
})

test('classifies generic cash as otro_efectivo', () => {
  assert.equal(
    classifyNominaConcept({ description: 'NÓMINA EFECTIVO', is_cash_payment: true }),
    'otro_efectivo'
  )
})

test('classifies formal payroll when not cash and no special markers', () => {
  assert.equal(
    classifyNominaConcept({ subcategory: 'PTU', is_cash_payment: false }),
    'nomina_formal'
  )
})

test('bonus takes precedence over apoyo in description', () => {
  assert.equal(
    classifyNominaConcept({ description: 'BONO APOYO PRODUCCIÓN', is_bonus: true }),
    'bono'
  )
})
