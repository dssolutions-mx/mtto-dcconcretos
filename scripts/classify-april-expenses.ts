/**
 * Classify April 2026 indirect expenses from INDIRECTOS_ABRIL_INTELIGENTE_FINAL.csv
 *
 * Columns: CONCEPTO, MONTO, PLANTA, DEPARTAMENTO, cash
 * Output: GASTOS_ABRIL2026_CLASIFICADOS.csv with VALOR + IS_CASH + assignment types.
 */

import * as fs from 'fs'
import * as path from 'path'

interface ExpenseRow {
  CONCEPTO: string
  VALOR: string
  PLANTA: string
  DEPARTAMENTO: string
  IS_CASH: boolean
}

function normalizeMontoToValor(raw: string): string {
  return raw.replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '')
}

/** RFC CSV with optional quoted fields */
function parseCsvFields(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      i++
      let val = ''
      while (i < line.length && line[i] !== '"') val += line[i++]
      if (line[i] === '"') i++
      fields.push(val.trim())
      if (line[i] === ',') i++
    } else {
      let val = ''
      while (i < line.length && line[i] !== ',') val += line[i++]
      fields.push(val.trim())
      if (line[i] === ',') i++
    }
  }
  return fields
}

function parseCashFlag(raw: string | undefined): boolean {
  return (raw || '').trim().toLowerCase() === 'cash'
}

function classifyExpense(concepto: string): {
  categoria: string
  subcategoria: string
} {
  const conceptoUpper = concepto.toUpperCase()

  if (conceptoUpper.includes('IMPUESTOS') && conceptoUpper.includes('DERECHOS')) {
    return { categoria: '13', subcategoria: 'Derechos' }
  }
  if (
    conceptoUpper.includes('TRAMITE') ||
    conceptoUpper.includes('TRÁMITE') ||
    conceptoUpper.includes('TRAMITES')
  ) {
    return { categoria: '5', subcategoria: 'Servicios Legales y Trámites' }
  }
  if (conceptoUpper.includes('NOTARIA') || conceptoUpper.includes('NOTARÍA')) {
    return { categoria: '5', subcategoria: 'Honorarios y Asesorías' }
  }
  if (conceptoUpper.includes('TORTAS')) {
    return { categoria: '9', subcategoria: 'Atención al Personal (Comidas, Almuerzo)' }
  }
  if (conceptoUpper.includes('HOTEL')) {
    return { categoria: '4', subcategoria: 'Renta de Inmuebles' }
  }
  if (conceptoUpper.includes('PLACAS') && conceptoUpper.includes('CAMIONETA')) {
    return { categoria: '8', subcategoria: 'Verificaciones Vehiculares' }
  }

  if (
    conceptoUpper.includes('IMSS') ||
    conceptoUpper.includes('RCV') ||
    conceptoUpper.includes('INFONAVIT') ||
    conceptoUpper.match(/\d+%\s*S\/?NOM/i) ||
    conceptoUpper.includes('COMISIONES')
  ) {
    return { categoria: '9', subcategoria: 'NOMINA - Obligaciones Patronales' }
  }
  if (
    conceptoUpper.includes('COMIDA') ||
    conceptoUpper.includes('ALMUERZO') ||
    conceptoUpper.includes('ATENCION AL PERSONAL') ||
    conceptoUpper.includes('VALES DESPENSA') ||
    conceptoUpper.includes('ADORNOS NAVIDEÑOS') ||
    conceptoUpper.includes('PRESENTE') ||
    conceptoUpper.includes('FIESTA') ||
    conceptoUpper.includes('CARNE ASADA') ||
    conceptoUpper.includes('CUMBLEAÑOS') ||
    conceptoUpper.includes('DESPIEDRE')
  ) {
    return { categoria: '9', subcategoria: 'Atención al Personal (Comidas, Almuerzo)' }
  }
  if (conceptoUpper.includes('VIATICOS') || conceptoUpper.includes('VIATICO')) {
    return { categoria: '9', subcategoria: 'Viáticos' }
  }
  if (conceptoUpper.includes('UNIFORMES')) {
    return { categoria: '9', subcategoria: 'Uniformes de Trabajo' }
  }
  if (
    conceptoUpper.includes('UREA') ||
    conceptoUpper.includes('CONCRETO') ||
    conceptoUpper.includes('MATERIALES PETREOS') ||
    conceptoUpper.includes('ARENA LAVADA') ||
    conceptoUpper.includes('ADITIVOS')
  ) {
    return {
      categoria: '1',
      subcategoria: 'Materiales de Producción (Urea, Concreto, Materiales Pétreos)'
    }
  }
  if (conceptoUpper.includes('BOMBEO') || conceptoUpper.includes('GRUA') || conceptoUpper.includes('BOMBA')) {
    return { categoria: '1', subcategoria: 'Servicios de Producción (Bombeo, Grúa)' }
  }
  if (
    conceptoUpper.includes('ANTIDOP') ||
    conceptoUpper.includes('ANTIDOPING') ||
    conceptoUpper.includes('DESENGRASANTE')
  ) {
    return {
      categoria: '1',
      subcategoria: 'Químicos y Aditivos (Antidoping, Desincrustrante, Catalizadores)'
    }
  }
  if (
    conceptoUpper.includes('GASOLINA') ||
    conceptoUpper.includes('COMBUSTIBLE') ||
    conceptoUpper.includes('COMBUSTIBLES') ||
    conceptoUpper.includes('DIESEL')
  ) {
    return { categoria: '2', subcategoria: 'Combustible y Gasolina' }
  }
  if (conceptoUpper.includes('CASETAS') || conceptoUpper.includes('CASETA')) {
    return { categoria: '2', subcategoria: 'Casetas Viales' }
  }
  if (conceptoUpper.includes('UBER') || conceptoUpper.includes('TAXI')) {
    return { categoria: '2', subcategoria: 'Transporte Ejecutivo (Uber, Taxis)' }
  }
  if (conceptoUpper.includes('TRASLADO') || conceptoUpper.includes('TRASALADO')) {
    return { categoria: '2', subcategoria: 'Traslado de Equipos' }
  }
  if (conceptoUpper.includes('ELECTRICIDAD')) {
    return { categoria: '3', subcategoria: 'Electricidad' }
  }
  if (conceptoUpper.includes('AGUA') && !conceptoUpper.includes('GARRAFON')) {
    return { categoria: '3', subcategoria: 'Agua' }
  }
  if (
    conceptoUpper.includes('TELEFONIA') ||
    conceptoUpper.includes('TELEFONÍA') ||
    conceptoUpper.includes('INTERNET')
  ) {
    return { categoria: '3', subcategoria: 'Telefonía e Internet' }
  }
  if (conceptoUpper.includes('RENTA') && conceptoUpper.includes('TERRENO')) {
    return { categoria: '4', subcategoria: 'Renta de Terrenos' }
  }
  if (
    conceptoUpper.includes('RENTA') &&
    (conceptoUpper.includes('DEPARTAMENTO') ||
      conceptoUpper.includes('CAMPAMENTO') ||
      conceptoUpper.includes('CUARTO') ||
      conceptoUpper.includes('POSADA') ||
      conceptoUpper.includes('CASA') ||
      conceptoUpper.includes('HOSPEDAJE'))
  ) {
    return { categoria: '4', subcategoria: 'Renta de Inmuebles' }
  }
  if (conceptoUpper.includes('LEASING') || conceptoUpper.includes('ARRENDAMIENTO LEASING')) {
    return { categoria: '4', subcategoria: 'Renta de Vehículos (Leasing)' }
  }
  if (
    conceptoUpper.includes('RENTA') &&
    (conceptoUpper.includes('MAQUINARIA') ||
      conceptoUpper.includes('CR') ||
      conceptoUpper.includes('EQUIPO'))
  ) {
    return { categoria: '4', subcategoria: 'Renta de Maquinaria y Equipo' }
  }
  if (conceptoUpper.includes('RENTA') && conceptoUpper.includes('BAÑOS')) {
    return { categoria: '4', subcategoria: 'Renta de Baños y Otros' }
  }
  if (conceptoUpper.includes('ARRENDAMIENTOS') || conceptoUpper.includes('ARRENDAMIENTO')) {
    return { categoria: '4', subcategoria: 'Renta de Inmuebles' }
  }
  if (
    conceptoUpper.includes('HONORARIOS') ||
    conceptoUpper.includes('ASESORIAS') ||
    conceptoUpper.includes('ASESORÍAS') ||
    conceptoUpper.includes('GASTOS LEGALES')
  ) {
    return { categoria: '5', subcategoria: 'Honorarios y Asesorías' }
  }
  if (conceptoUpper.includes('SOPORTE') && conceptoUpper.includes('SISTEMAS')) {
    return { categoria: '5', subcategoria: 'Soporte de Sistemas' }
  }
  if (
    conceptoUpper.includes('REGISTRO') ||
    conceptoUpper.includes('PLANO') ||
    conceptoUpper.includes('GRAVAMEN')
  ) {
    return { categoria: '5', subcategoria: 'Servicios Legales y Trámites' }
  }
  if (
    conceptoUpper.includes('PAPELERIA') ||
    conceptoUpper.includes('PAPELERÍA') ||
    conceptoUpper.includes('ARTICULOS DE OFICINA') ||
    conceptoUpper.includes('ARTÍCULOS DE OFICINA')
  ) {
    return { categoria: '6', subcategoria: 'Papelería y Artículos de Oficina' }
  }
  if (conceptoUpper.includes('LIMPIEZA') || conceptoUpper.includes('ARTICULOS DE LIMPIEZA')) {
    return { categoria: '6', subcategoria: 'Artículos de Limpieza' }
  }
  if (conceptoUpper.includes('GARRAFON') || conceptoUpper.includes('GARRAFÓN')) {
    return { categoria: '6', subcategoria: 'Agua de Garrafón' }
  }
  if (conceptoUpper.includes('MEDICAMENTOS') || conceptoUpper.includes('BOTIQUIN') || conceptoUpper.includes('TORNILLOS')) {
    return { categoria: '6', subcategoria: 'Material de Laboratorio' }
  }
  if (conceptoUpper.includes('LICENCIAS') && conceptoUpper.includes('SISTEMAS')) {
    return { categoria: '7', subcategoria: 'Licencias de Software' }
  }
  if (conceptoUpper.includes('DOMINIO') || conceptoUpper.includes('HOSTING')) {
    return { categoria: '7', subcategoria: 'Dominios y Hosting' }
  }
  if (conceptoUpper.includes('RENTA') && conceptoUpper.includes('EQUIPO') && conceptoUpper.includes('IMPRESION')) {
    return { categoria: '7', subcategoria: 'Renta de Equipo de Impresión' }
  }
  if (conceptoUpper.includes('VERIFICACION') || conceptoUpper.includes('VERIFICACIÓN')) {
    return { categoria: '8', subcategoria: 'Verificaciones Vehiculares' }
  }
  if (
    conceptoUpper.includes('MANTO') ||
    conceptoUpper.includes('MANTENIMIENTO') ||
    conceptoUpper.includes('TALACHA') ||
    conceptoUpper.includes('RESCATE') ||
    conceptoUpper.includes('TUBERIA') ||
    conceptoUpper.includes('SOLDADURA') ||
    conceptoUpper.includes('POLARIZADO') ||
    conceptoUpper.includes('ARREGLO') ||
    conceptoUpper.includes('TROMPO') ||
    conceptoUpper.includes('CERRAJERIA')
  ) {
    return { categoria: '8', subcategoria: 'Reparaciones y Mantenimiento' }
  }
  if (conceptoUpper.includes('PUBLICIDAD') || conceptoUpper.includes('BORDADOS') || conceptoUpper.includes('FINIQUITO')) {
    return { categoria: '10', subcategoria: 'Publicidad' }
  }
  if (conceptoUpper.includes('ATENCION AL CLIENTE')) {
    return { categoria: '10', subcategoria: 'Atención al Cliente' }
  }
  if (conceptoUpper.includes('RECARGOS')) {
    return { categoria: '11', subcategoria: 'Recargos' }
  }
  if (conceptoUpper.includes('SEGUROS') || conceptoUpper.includes('DEDUCIBLE')) {
    return { categoria: '12', subcategoria: 'Seguros' }
  }
  if (conceptoUpper.includes('MULTA') || conceptoUpper.includes('MORDIDA') || conceptoUpper.includes('DADIVA')) {
    return { categoria: '13', subcategoria: 'Impuestos Locales' }
  }
  if (conceptoUpper.includes('DERECHOS') || conceptoUpper.includes('DEPOSITO')) {
    return { categoria: '13', subcategoria: 'Derechos' }
  }
  if (conceptoUpper.includes('NO DEDUCIBLES') || conceptoUpper.includes('NO DEDUCIBLE')) {
    return { categoria: '14', subcategoria: 'Gastos No Deducibles' }
  }
  if (conceptoUpper.includes('PAQUETERIA') || conceptoUpper.includes('ENVIOS') || conceptoUpper.includes('ENVÍOS')) {
    return { categoria: '14', subcategoria: 'Paquetería y Envíos' }
  }
  return { categoria: '14', subcategoria: 'Otros Gastos Varios' }
}

type AssignmentType =
  | 'DIRECTO'
  | 'DISTRIBUIR_VOLUMEN'
  | 'DISTRIBUIR_BU'
  | 'DISTRIBUIR_4P_5'

function determineAssignmentType(planta: string): AssignmentType {
  const plantaUpper = planta.toUpperCase().trim()
  if (/4\s*P\s*Y\s*5/i.test(plantaUpper)) return 'DISTRIBUIR_4P_5'
  if (/^P00[1-5]$/.test(plantaUpper) || plantaUpper === 'P004P') return 'DIRECTO'
  if (plantaUpper === 'GEN' || plantaUpper === 'GENERAL') return 'DISTRIBUIR_VOLUMEN'
  if (plantaUpper.includes('TJ') || plantaUpper.includes('BJ')) return 'DISTRIBUIR_BU'
  return 'DISTRIBUIR_VOLUMEN'
}

function normalizePlantCode(planta: string): string {
  const plantaUpper = planta.toUpperCase().trim()
  if (/4\s*P\s*Y\s*5/i.test(plantaUpper)) return '4p_y_5'
  if (plantaUpper.includes('TJ')) return 'tj'
  if (plantaUpper.includes('BJ')) return 'bj'
  if (plantaUpper === 'GEN' || plantaUpper === 'GENERAL') return 'gen'
  return plantaUpper
}

async function main() {
  console.log('🚀 Classifying April 2026 Expenses...\n')

  const csvPath = path.join(process.cwd(), 'INDIRECTOS_ABRIL_INTELIGENTE_FINAL.csv')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')

  const lines = csvContent.split('\n').filter(line => line.trim())
  const records: ExpenseRow[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvFields(lines[i])
    const concepto = (fields[0] || '').trim()
    const montoRaw = fields[1] || ''
    const planta = (fields[2] || '').trim()
    const departamento = (fields[3] || '').trim()
    const cashCol = fields[4]

    if (!concepto) {
      skipped++
      continue
    }
    const valor = normalizeMontoToValor(montoRaw)
    if (!valor || Number.isNaN(parseFloat(valor))) {
      console.warn(`⚠️  Skip row ${i + 1}: invalid amount — ${concepto.slice(0, 70)}`)
      skipped++
      continue
    }
    if (/por\s+definir/i.test(planta) || /por\s+definir/i.test(departamento)) {
      console.warn(`⚠️  Skip row ${i + 1}: POR DEFINIR — ${concepto.slice(0, 70)}`)
      skipped++
      continue
    }

    records.push({
      CONCEPTO: concepto,
      VALOR: valor,
      PLANTA: planta,
      DEPARTAMENTO: departamento,
      IS_CASH: parseCashFlag(cashCol)
    })
  }

  console.log(`📊 Loaded ${records.length} expense rows (${skipped} skipped)\n`)

  const classified: Array<
    ExpenseRow & {
      CATEGORIA_GASTO: string
      SUBCATEGORIA_GASTO: string
      TIPO_ASIGNACION: string
      PLANTA_O_BU: string
    }
  > = []

  for (const record of records) {
    const classification = classifyExpense(record.CONCEPTO)
    classified.push({
      ...record,
      CATEGORIA_GASTO: classification.categoria,
      SUBCATEGORIA_GASTO: classification.subcategoria,
      TIPO_ASIGNACION: determineAssignmentType(record.PLANTA),
      PLANTA_O_BU: normalizePlantCode(record.PLANTA)
    })
  }

  const outputPath = path.join(process.cwd(), 'GASTOS_ABRIL2026_CLASIFICADOS.csv')
  const outputLines = [
    'CONCEPTO,VALOR,PLANTA_O_BU,DEPARTAMENTO,CATEGORIA_GASTO,SUBCATEGORIA_GASTO,TIPO_ASIGNACION,IS_CASH,NOTAS'
  ]

  const quoteIfNeeded = (field: string) => (field.includes(',') ? `"${field}"` : field)

  for (const record of classified) {
    outputLines.push(
      [
        quoteIfNeeded(record.CONCEPTO),
        record.VALOR,
        record.PLANTA_O_BU,
        record.DEPARTAMENTO,
        record.CATEGORIA_GASTO,
        quoteIfNeeded(record.SUBCATEGORIA_GASTO),
        record.TIPO_ASIGNACION,
        record.IS_CASH ? 'true' : 'false',
        ''
      ].join(',')
    )
  }

  fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf-8')

  const byType = classified.reduce(
    (acc, r) => {
      acc[r.TIPO_ASIGNACION] = (acc[r.TIPO_ASIGNACION] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const cashCount = classified.filter(r => r.IS_CASH).length
  const totalAmount = classified.reduce(
    (sum, r) => sum + parseFloat(r.VALOR.replace(/,/g, '') || '0'),
    0
  )

  console.log('📊 CLASSIFICATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total expenses: ${classified.length}`)
  console.log(`Marked cash (IS_CASH): ${cashCount}`)
  console.log(`Total amount: $${totalAmount.toFixed(2)}`)
  console.log('\nBy assignment type:')
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} expenses`)
  })
  console.log(`\n✅ Classified CSV saved to: ${outputPath}`)
}

main().catch(console.error)
