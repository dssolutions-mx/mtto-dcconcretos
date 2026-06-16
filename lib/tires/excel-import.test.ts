import test from 'node:test'
import assert from 'node:assert/strict'

import { IMPORT_TEMPLATE_HEADERS, IMPORT_INSTRUCTIONS } from './csv-import'
import { generateExcelTemplateBuffer, parseExcelToRows } from './excel-import'

test('generateExcelTemplateBuffer produces xlsx with data and instructions sheets', async () => {
  const buffer = await generateExcelTemplateBuffer()
  assert.ok(buffer.byteLength > 500)

  const rows = await parseExcelToRows(buffer)
  assert.ok(rows.length >= 2)
  assert.deepEqual(rows[0], [...IMPORT_TEMPLATE_HEADERS])
  assert.equal(rows[1][2], 'Michelin')
  assert.equal(rows[1][3], '11R22.5')
})

test('IMPORT_INSTRUCTIONS covers all template columns', () => {
  const fields = new Set(IMPORT_INSTRUCTIONS.map((i) => i.field))
  for (const header of IMPORT_TEMPLATE_HEADERS) {
    assert.ok(fields.has(header), `Missing instruction for ${header}`)
  }
})

test('parseExcelToRows reads tread and pressure columns', async () => {
  const buffer = await generateExcelTemplateBuffer()
  const rows = await parseExcelToRows(buffer)
  const example = rows[1]
  const bandaIdx = IMPORT_TEMPLATE_HEADERS.indexOf('banda_mm')
  const presionIdx = IMPORT_TEMPLATE_HEADERS.indexOf('presion_psi')
  assert.equal(example[bandaIdx], '14.5')
  assert.equal(example[presionIdx], '100')
})
