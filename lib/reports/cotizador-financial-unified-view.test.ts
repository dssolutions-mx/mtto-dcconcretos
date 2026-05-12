import test from 'node:test'
import assert from 'node:assert/strict'

import {
  COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_FIFO,
  COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_LEGACY,
  cotizadorPlantFinancialUnifiedViewName,
  cotizadorUsesFifoFinancialPipeline,
} from './cotizador-financial-unified-view'

test('cotizadorPlantFinancialUnifiedViewName uses legacy before 2026-04', () => {
  assert.equal(
    cotizadorPlantFinancialUnifiedViewName('2026-03-01'),
    COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_LEGACY
  )
  assert.equal(
    cotizadorPlantFinancialUnifiedViewName('2025-12-01'),
    COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_LEGACY
  )
})

test('cotizadorPlantFinancialUnifiedViewName uses FIFO from 2026-04', () => {
  assert.equal(
    cotizadorPlantFinancialUnifiedViewName('2026-04-01'),
    COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_FIFO
  )
  assert.equal(
    cotizadorPlantFinancialUnifiedViewName('2027-01-01'),
    COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_FIFO
  )
})

test('cotizadorUsesFifoFinancialPipeline matches month YYYY-MM', () => {
  assert.equal(cotizadorUsesFifoFinancialPipeline('2026-03'), false)
  assert.equal(cotizadorUsesFifoFinancialPipeline('2026-04'), true)
  assert.equal(cotizadorUsesFifoFinancialPipeline('2026-05'), true)
})
