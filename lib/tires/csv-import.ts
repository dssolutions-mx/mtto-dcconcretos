import type { TireCondition, TireIdRules } from '@/types/tires'

export const CSV_IMPORT_MAX_ROWS = 100

/** Spanish column headers for Excel template and CSV import. */
export const IMPORT_TEMPLATE_HEADERS = [
  'codigo_interno',
  'dot',
  'marca',
  'medida',
  'modelo',
  'condicion',
  'costo_compra',
  'fecha_compra',
  'almacen',
  'banda_mm',
  'presion_psi',
] as const

export type ImportTemplateHeader = (typeof IMPORT_TEMPLATE_HEADERS)[number]

/** @deprecated use IMPORT_TEMPLATE_HEADERS */
export const CSV_TEMPLATE_HEADERS = IMPORT_TEMPLATE_HEADERS

export type CsvImportHeader = ImportTemplateHeader

export const IMPORT_INSTRUCTIONS: { field: string; description: string }[] = [
  {
    field: 'codigo_interno',
    description:
      'Opcional. ID operativo de su flota. Si está vacío y la auto-generación está activa, se asigna al importar.',
  },
  {
    field: 'dot',
    description:
      'DOT / serial del fabricante (pared lateral). Obligatorio si su flota lo requiere en ajustes.',
  },
  { field: 'marca', description: 'Obligatorio. Marca de la llanta.' },
  { field: 'medida', description: 'Obligatorio. Ej. 11R22.5' },
  { field: 'modelo', description: 'Opcional. Modelo comercial.' },
  { field: 'condicion', description: 'nueva o renovada. Por defecto: nueva.' },
  { field: 'costo_compra', description: 'Opcional. Número sin símbolo de moneda.' },
  { field: 'fecha_compra', description: 'Opcional. Formato YYYY-MM-DD o DD/MM/YYYY.' },
  {
    field: 'almacen',
    description: 'Opcional. UUID del almacén o código de almacén (warehouse_code).',
  },
  {
    field: 'banda_mm',
    description: 'Opcional. Lectura inicial de profundidad de banda en mm (inventario).',
  },
  {
    field: 'presion_psi',
    description: 'Opcional. Lectura inicial de presión en psi (inventario).',
  },
]

/** Maps canonical field → accepted header aliases (normalized). */
const HEADER_ALIASES: Record<string, string[]> = {
  codigo_interno: ['codigo_interno', 'internal_code', 'id_interno'],
  dot: ['dot', 'serial', 'serial_fabricante', 'serial_number'],
  marca: ['marca', 'brand'],
  medida: ['medida', 'size', 'tamano'],
  modelo: ['modelo', 'model'],
  condicion: ['condicion', 'condition'],
  costo_compra: ['costo_compra', 'purchase_cost', 'costo'],
  fecha_compra: ['fecha_compra', 'purchase_date', 'fecha'],
  almacen: ['almacen', 'almacen_id', 'almacen_codigo', 'warehouse_id', 'warehouse_code'],
  banda_mm: ['banda_mm', 'tread_mm', 'banda', 'profundidad_banda'],
  presion_psi: ['presion_psi', 'pressure_psi', 'presion'],
}

export interface CsvImportRow {
  row_number: number
  codigo_interno: string | null
  marca: string
  medida: string
  modelo: string | null
  dot: string | null
  condicion: TireCondition
  costo_compra: number | null
  fecha_compra: string | null
  almacen_id: string | null
  banda_mm: number | null
  presion_psi: number | null
}

export interface CsvImportRowError {
  row_number: number
  field?: string
  message: string
}

export interface ImportValidationContext {
  existingDots?: Set<string>
  existingInternalCodes?: Set<string>
  warehouseIds?: Set<string>
  warehouseCodes?: Map<string, string>
  idRules?: TireIdRules
}

export interface CsvImportValidationResult {
  valid_rows: CsvImportRow[]
  errors: CsvImportRowError[]
  duplicate_dots_in_file: string[]
  duplicate_internal_codes_in_file: string[]
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SIZE_RE = /\d{2,3}[\/\s]?R?\d{2}/i

const TREAD_MIN_MM = 0
const TREAD_MAX_MM = 50
const PRESSURE_MIN_PSI = 0
const PRESSURE_MAX_PSI = 250

export function generateCsvTemplate(): string {
  const header = IMPORT_TEMPLATE_HEADERS.join(',')
  const example =
    ',DOT1234567890,Michelin,11R22.5,XDA2,nueva,18500,2026-06-01,,14.5,100'
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

function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const normalized = headerRow.map(normalizeHeader)
  const headerIndex = new Map<string, number>()

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.includes(normalized[i])) {
        headerIndex.set(canonical, i)
        break
      }
    }
  }

  return headerIndex
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

function parseMeasurement(raw: string): number | null {
  const v = raw.trim().replace(',', '.')
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function resolveWarehouseId(
  raw: string,
  ctx: ImportValidationContext
): { id: string | null; error?: string } {
  const v = raw.trim()
  if (!v) return { id: null }

  if (UUID_RE.test(v)) {
    if (ctx.warehouseIds && !ctx.warehouseIds.has(v)) {
      return { id: null, error: 'Almacén no encontrado (UUID inválido)' }
    }
    return { id: v }
  }

  const codeKey = v.toUpperCase()
  const resolved = ctx.warehouseCodes?.get(codeKey)
  if (!resolved) {
    return { id: null, error: `Almacén "${v}" no encontrado (use UUID o código)` }
  }
  return { id: resolved }
}

export function validateCsvImportRows(
  rawRows: string[][],
  ctx: ImportValidationContext = {}
): CsvImportValidationResult {
  const errors: CsvImportRowError[] = []
  const valid_rows: CsvImportRow[] = []
  const dotsInFile = new Map<string, number[]>()
  const internalCodesInFile = new Map<string, number[]>()

  const existingDots = ctx.existingDots ?? new Set<string>()
  const existingInternalCodes = ctx.existingInternalCodes ?? new Set<string>()
  const idRules = ctx.idRules ?? {}

  if (rawRows.length === 0) {
    return {
      valid_rows: [],
      errors: [{ row_number: 0, message: 'El archivo está vacío' }],
      duplicate_dots_in_file: [],
      duplicate_internal_codes_in_file: [],
    }
  }

  const headerIndex = buildHeaderIndex(rawRows[0])

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
    return {
      valid_rows: [],
      errors,
      duplicate_dots_in_file: [],
      duplicate_internal_codes_in_file: [],
    }
  }

  const dataRows = rawRows.slice(1)
  if (dataRows.length > CSV_IMPORT_MAX_ROWS) {
    errors.push({
      row_number: 0,
      message: `Máximo ${CSV_IMPORT_MAX_ROWS} filas por lote. Divida el archivo en lotes más pequeños.`,
    })
    return {
      valid_rows: [],
      errors,
      duplicate_dots_in_file: [],
      duplicate_internal_codes_in_file: [],
    }
  }

  const getCell = (row: string[], key: string): string => {
    const idx = headerIndex.get(key)
    if (idx == null) return ''
    return row[idx]?.trim() ?? ''
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const row_number = i + 2
    const codigo_interno = getCell(row, 'codigo_interno') || null
    const marca = getCell(row, 'marca')
    const medida = getCell(row, 'medida')
    const modelo = getCell(row, 'modelo') || null
    const dot = getCell(row, 'dot') || null
    const condicionRaw = getCell(row, 'condicion') || 'nueva'
    const costoRaw = getCell(row, 'costo_compra')
    const fechaRaw = getCell(row, 'fecha_compra')
    const almacenRaw = getCell(row, 'almacen')
    const bandaRaw = getCell(row, 'banda_mm')
    const presionRaw = getCell(row, 'presion_psi')

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

    if (idRules.dot_required && !dot) {
      errors.push({
        row_number,
        field: 'dot',
        message: 'DOT / serial es obligatorio según ajustes de flota',
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

    const warehouseResult = resolveWarehouseId(almacenRaw, ctx)
    if (warehouseResult.error) {
      errors.push({
        row_number,
        field: 'almacen',
        message: warehouseResult.error,
      })
      rowHasError = true
    }

    const banda_mm = parseMeasurement(bandaRaw)
    if (bandaRaw && banda_mm == null) {
      errors.push({
        row_number,
        field: 'banda_mm',
        message: 'Banda (mm) inválida',
      })
      rowHasError = true
    } else if (banda_mm != null && (banda_mm < TREAD_MIN_MM || banda_mm > TREAD_MAX_MM)) {
      errors.push({
        row_number,
        field: 'banda_mm',
        message: `Banda debe estar entre ${TREAD_MIN_MM} y ${TREAD_MAX_MM} mm`,
      })
      rowHasError = true
    }

    const presion_psi = parseMeasurement(presionRaw)
    if (presionRaw && presion_psi == null) {
      errors.push({
        row_number,
        field: 'presion_psi',
        message: 'Presión (psi) inválida',
      })
      rowHasError = true
    } else if (
      presion_psi != null &&
      (presion_psi < PRESSURE_MIN_PSI || presion_psi > PRESSURE_MAX_PSI)
    ) {
      errors.push({
        row_number,
        field: 'presion_psi',
        message: `Presión debe estar entre ${PRESSURE_MIN_PSI} y ${PRESSURE_MAX_PSI} psi`,
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

    if (codigo_interno) {
      const normalizedCode = codigo_interno.toUpperCase()
      const prev = internalCodesInFile.get(normalizedCode) ?? []
      prev.push(row_number)
      internalCodesInFile.set(normalizedCode, prev)

      if (existingInternalCodes.has(normalizedCode)) {
        errors.push({
          row_number,
          field: 'codigo_interno',
          message: `Código interno "${codigo_interno}" ya existe en el sistema`,
        })
        rowHasError = true
      }
    }

    if (!rowHasError && condicion) {
      valid_rows.push({
        row_number,
        codigo_interno,
        marca,
        medida,
        modelo,
        dot,
        condicion,
        costo_compra,
        fecha_compra,
        almacen_id: warehouseResult.id,
        banda_mm,
        presion_psi,
      })
    }
  }

  const duplicate_dots_in_file: string[] = []
  const duplicate_internal_codes_in_file: string[] = []
  const duplicateRowNumbers = new Set<number>()

  for (const [dot, rowNums] of dotsInFile) {
    if (rowNums.length > 1) {
      duplicate_dots_in_file.push(dot)
      for (const row_number of rowNums) {
        duplicateRowNumbers.add(row_number)
        errors.push({
          row_number,
          field: 'dot',
          message: `DOT duplicado en el archivo (filas ${rowNums.join(', ')})`,
        })
      }
    }
  }

  for (const [code, rowNums] of internalCodesInFile) {
    if (rowNums.length > 1) {
      duplicate_internal_codes_in_file.push(code)
      for (const row_number of rowNums) {
        duplicateRowNumbers.add(row_number)
        errors.push({
          row_number,
          field: 'codigo_interno',
          message: `Código interno duplicado en el archivo (filas ${rowNums.join(', ')})`,
        })
      }
    }
  }

  const filteredValidRows = valid_rows.filter((r) => !duplicateRowNumbers.has(r.row_number))

  return {
    valid_rows: filteredValidRows,
    errors,
    duplicate_dots_in_file,
    duplicate_internal_codes_in_file,
  }
}

export function parseAndValidateCsvImport(
  text: string,
  ctx: ImportValidationContext = {}
): CsvImportValidationResult {
  const rows = parseCsvText(text)
  return validateCsvImportRows(rows, ctx)
}

export function parseAndValidateImportRows(
  rawRows: string[][],
  ctx: ImportValidationContext = {}
): CsvImportValidationResult {
  return validateCsvImportRows(rawRows, ctx)
}
