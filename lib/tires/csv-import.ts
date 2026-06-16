import type { TireCondition } from '@/types/tires'

export const CSV_IMPORT_MAX_ROWS = 100

export const CSV_TEMPLATE_HEADERS = [
  'marca',
  'medida',
  'modelo',
  'dot',
  'condicion',
  'costo_compra',
  'fecha_compra',
  'almacen_id',
] as const

export type CsvImportHeader = (typeof CSV_TEMPLATE_HEADERS)[number]

export interface CsvImportRow {
  row_number: number
  marca: string
  medida: string
  modelo: string | null
  dot: string | null
  condicion: TireCondition
  costo_compra: number | null
  fecha_compra: string | null
  almacen_id: string | null
}

export interface CsvImportRowError {
  row_number: number
  field?: string
  message: string
}

export interface CsvImportValidationResult {
  valid_rows: CsvImportRow[]
  errors: CsvImportRowError[]
  duplicate_dots_in_file: string[]
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SIZE_RE = /\d{2,3}[\/\s]?R?\d{2}/i

export function generateCsvTemplate(): string {
  const header = CSV_TEMPLATE_HEADERS.join(',')
  const example =
    'Michelin,11R22.5,XDA2,DOT1234567890,nueva,18500,2026-06-01,'
  return `${header}\n${example}\n`
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  const pushCell = () => {
    row.push(current.trim())
    current = ''
  }

  const pushRow = () => {
    if (row.some((c) => c.length > 0)) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && ch === ',') {
      pushCell()
      continue
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++
      pushCell()
      pushRow()
      continue
    }

    current += ch
  }

  if (current.length > 0 || row.length > 0) {
    pushCell()
    pushRow()
  }

  return rows
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function parseCondition(raw: string): TireCondition | null {
  const v = raw.trim().toLowerCase()
  if (v === 'nueva' || v === 'new') return 'nueva'
  if (v === 'renovada' || v === 'renovado') return 'renovada'
  return null
}

function parseDate(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function parseCost(raw: string): number | null {
  const v = raw.trim().replace(/[$,\s]/g, '')
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function validateCsvImportRows(
  rawRows: string[][],
  existingDots: Set<string> = new Set()
): CsvImportValidationResult {
  const errors: CsvImportRowError[] = []
  const valid_rows: CsvImportRow[] = []
  const dotsInFile = new Map<string, number[]>()

  if (rawRows.length === 0) {
    return {
      valid_rows: [],
      errors: [{ row_number: 0, message: 'El archivo está vacío' }],
      duplicate_dots_in_file: [],
    }
  }

  const headerRow = rawRows[0].map(normalizeHeader)
  const headerIndex = new Map<string, number>()
  headerRow.forEach((h, i) => headerIndex.set(h, i))

  const requiredHeaders = ['marca', 'medida']
  for (const h of requiredHeaders) {
    if (!headerIndex.has(h)) {
      errors.push({
        row_number: 1,
        field: h,
        message: `Falta columna obligatoria: ${h}`,
      })
    }
  }
  if (errors.length > 0) {
    return { valid_rows: [], errors, duplicate_dots_in_file: [] }
  }

  const dataRows = rawRows.slice(1)
  if (dataRows.length > CSV_IMPORT_MAX_ROWS) {
    errors.push({
      row_number: 0,
      message: `Máximo ${CSV_IMPORT_MAX_ROWS} filas por lote. Divida el archivo en lotes más pequeños.`,
    })
    return { valid_rows: [], errors, duplicate_dots_in_file: [] }
  }

  const getCell = (row: string[], key: string): string => {
    const idx = headerIndex.get(key)
    if (idx == null) return ''
    return row[idx]?.trim() ?? ''
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const row_number = i + 2
    const marca = getCell(row, 'marca')
    const medida = getCell(row, 'medida')
    const modelo = getCell(row, 'modelo') || null
    const dot = getCell(row, 'dot') || null
    const condicionRaw = getCell(row, 'condicion') || 'nueva'
    const costoRaw = getCell(row, 'costo_compra')
    const fechaRaw = getCell(row, 'fecha_compra')
    const almacenRaw = getCell(row, 'almacen_id')

    let rowHasError = false

    if (!marca) {
      errors.push({ row_number, field: 'marca', message: 'Marca es obligatoria' })
      rowHasError = true
    }
    if (!medida) {
      errors.push({ row_number, field: 'medida', message: 'Medida es obligatoria' })
      rowHasError = true
    } else if (!SIZE_RE.test(medida)) {
      errors.push({
        row_number,
        field: 'medida',
        message: `Medida "${medida}" no reconocida (ej. 11R22.5)`,
      })
      rowHasError = true
    }

    const condicion = parseCondition(condicionRaw)
    if (!condicion) {
      errors.push({
        row_number,
        field: 'condicion',
        message: 'Condición debe ser "nueva" o "renovada"',
      })
      rowHasError = true
    }

    const costo_compra = parseCost(costoRaw)
    if (costoRaw && costo_compra == null) {
      errors.push({
        row_number,
        field: 'costo_compra',
        message: 'Costo de compra inválido',
      })
      rowHasError = true
    }

    const fecha_compra = parseDate(fechaRaw)
    if (fechaRaw && !fecha_compra) {
      errors.push({
        row_number,
        field: 'fecha_compra',
        message: 'Fecha inválida (use YYYY-MM-DD)',
      })
      rowHasError = true
    }

    const almacen_id = almacenRaw || null
    if (almacen_id && !UUID_RE.test(almacen_id)) {
      errors.push({
        row_number,
        field: 'almacen_id',
        message: 'ID de almacén debe ser UUID válido',
      })
      rowHasError = true
    }

    if (dot) {
      const normalizedDot = dot.toUpperCase()
      const prev = dotsInFile.get(normalizedDot) ?? []
      prev.push(row_number)
      dotsInFile.set(normalizedDot, prev)

      if (existingDots.has(normalizedDot)) {
        errors.push({
          row_number,
          field: 'dot',
          message: `DOT "${dot}" ya existe en el sistema`,
        })
        rowHasError = true
      }
    }

    if (!rowHasError && condicion) {
      valid_rows.push({
        row_number,
        marca,
        medida,
        modelo,
        dot,
        condicion,
        costo_compra,
        fecha_compra,
        almacen_id,
      })
    }
  }

  const duplicate_dots_in_file: string[] = []
  const duplicateRowNumbers = new Set<number>()
  for (const [dot, rows] of dotsInFile) {
    if (rows.length > 1) {
      duplicate_dots_in_file.push(dot)
      for (const row_number of rows) {
        duplicateRowNumbers.add(row_number)
        errors.push({
          row_number,
          field: 'dot',
          message: `DOT duplicado en el archivo (${rows.join(', ')})`,
        })
      }
    }
  }

  const filteredValidRows = valid_rows.filter((r) => !duplicateRowNumbers.has(r.row_number))

  return { valid_rows: filteredValidRows, errors, duplicate_dots_in_file }
}

export function parseAndValidateCsvImport(
  text: string,
  existingDots: Set<string> = new Set()
): CsvImportValidationResult {
  const rows = parseCsvText(text)
  return validateCsvImportRows(rows, existingDots)
}
