import ExcelJS from 'exceljs'
import {
  IMPORT_TEMPLATE_HEADERS,
  IMPORT_INSTRUCTIONS,
  type ImportTemplateHeader,
} from '@/lib/tires/csv-import'

const DATA_SHEET = 'Datos'
const INSTRUCTIONS_SHEET = 'Instrucciones'

export async function generateExcelTemplateBuffer(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sistema de Mantenimiento'
  workbook.created = new Date()

  const dataSheet = workbook.addWorksheet(DATA_SHEET)
  dataSheet.columns = IMPORT_TEMPLATE_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: Math.max(h.length + 4, 14),
  }))

  dataSheet.addRow({
    codigo_interno: '',
    dot: 'DOT1234567890',
    marca: 'Michelin',
    medida: '11R22.5',
    modelo: 'XDA2',
    condicion: 'nueva',
    costo_compra: 18500,
    fecha_compra: '2026-06-01',
    almacen: '',
    banda_mm: 14.5,
    presion_psi: 100,
  })

  const headerRow = dataSheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF4' },
  }

  const instructionsSheet = workbook.addWorksheet(INSTRUCTIONS_SHEET)
  instructionsSheet.getColumn(1).width = 22
  instructionsSheet.getColumn(2).width = 72
  instructionsSheet.addRow(['Campo', 'Descripción'])
  instructionsSheet.getRow(1).font = { bold: true }
  for (const row of IMPORT_INSTRUCTIONS) {
    instructionsSheet.addRow([row.field, row.description])
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

/** Reads the first data worksheet (prefers "Datos") into raw string rows. */
export async function parseExcelToRows(buffer: ArrayBuffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet =
    workbook.getWorksheet(DATA_SHEET) ??
    workbook.worksheets.find((ws) => ws.name.toLowerCase() !== INSTRUCTIONS_SHEET.toLowerCase()) ??
    workbook.worksheets[0]

  if (!worksheet) {
    throw new Error('El archivo Excel no contiene hojas de cálculo')
  }

  const rows: string[][] = []
  worksheet.eachRow((row, rowNumber) => {
    const values = row.values as unknown[]
    const cells = (values?.slice(1) ?? []).map((v) => cellToString(v))
    if (rowNumber === 1 || cells.some((c) => c.length > 0)) {
      rows.push(cells)
    }
  })

  if (rows.length === 0) {
    throw new Error('La hoja de datos está vacía')
  }

  return rows
}

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'object' && value !== null && 'text' in value) {
    const rich = value as { text?: string }
    return String(rich.text ?? '').trim()
  }
  return String(value).trim()
}

export function isExcelFileName(name: string): boolean {
  return /\.xlsx?$/i.test(name)
}

export { DATA_SHEET, INSTRUCTIONS_SHEET, type ImportTemplateHeader }
