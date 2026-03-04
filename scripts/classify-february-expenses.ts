/**
 * Classify February 2026 Expenses
 *
 * Reads INDIRECTOS PRCESADOS.csv (column MONTO) and classifies
 * each expense according to the 14 expense categories.
 */

import * as fs from 'fs'
import * as path from 'path'

interface ExpenseRow {
  CONCEPTO: string
  VALOR: string
  PLANTA: string
  DEPARTAMENTO: string
}

function classifyExpense(concepto: string, departamento: string): {
  categoria: string
  subcategoria: string
} {
  const conceptoUpper = concepto.toUpperCase()

  if (conceptoUpper.includes('IMSS') ||
      conceptoUpper.includes('RCV') ||
      conceptoUpper.includes('INFONAVIT') ||
      conceptoUpper.match(/\d+%\s*S\/?NOM/i) ||
      conceptoUpper.includes('COMISIONES')) {
    return { categoria: '9', subcategoria: 'NOMINA - Obligaciones Patronales' }
  }

  if (conceptoUpper.includes('COMIDA') ||
      conceptoUpper.includes('ALMUERZO') ||
      conceptoUpper.includes('ATENCION AL PERSONAL') ||
      conceptoUpper.includes('VALES DESPENSA') ||
      conceptoUpper.includes('PRESENTE') ||
      conceptoUpper.includes('FIESTA') ||
      conceptoUpper.includes('CARNE ASADA') ||
      conceptoUpper.includes('CUMBLEAÑOS') ||
      conceptoUpper.includes('TORTAS') ||
      conceptoUpper.includes('COMPRA DE ALMUERZO')) {
    return { categoria: '9', subcategoria: 'Atención al Personal (Comidas, Almuerzo)' }
  }

  if (conceptoUpper.includes('VIATICOS') || conceptoUpper.includes('VIATICO')) {
    return { categoria: '9', subcategoria: 'Viáticos' }
  }

  if (conceptoUpper.includes('UNIFORMES')) {
    return { categoria: '9', subcategoria: 'Uniformes de Trabajo' }
  }

  if (conceptoUpper.includes('UREA') ||
      conceptoUpper.includes('CONCRETO') ||
      conceptoUpper.includes('PREMEZCLADO') ||
      conceptoUpper.includes('MATERIALES PETREOS') ||
      conceptoUpper.includes('ARENA LAVADA') ||
      conceptoUpper.includes('ADITIVOS')) {
    return { categoria: '1', subcategoria: 'Materiales de Producción (Urea, Concreto, Materiales Pétreos)' }
  }

  if (conceptoUpper.includes('BOMBEO') || conceptoUpper.includes('GRUA') || conceptoUpper.includes('BOMBA')) {
    return { categoria: '1', subcategoria: 'Servicios de Producción (Bombeo, Grúa)' }
  }

  if (conceptoUpper.includes('VIAJES DE AGUA') || (conceptoUpper.includes('AGUA') && conceptoUpper.includes('VIAJES'))) {
    return { categoria: '3', subcategoria: 'Agua' }
  }

  if (conceptoUpper.includes('GASOLINA') ||
      conceptoUpper.includes('COMBUSTIBLE') ||
      conceptoUpper.includes('COMBUSTIBLES') ||
      conceptoUpper.includes('DIESEL')) {
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

  if (conceptoUpper.includes('TELEFONIA') || conceptoUpper.includes('INTERNET')) {
    return { categoria: '3', subcategoria: 'Telefonía e Internet' }
  }

  if (conceptoUpper.includes('RENTA') && (conceptoUpper.includes('TERRENO') || conceptoUpper.includes('PLANTA') || conceptoUpper.includes('PITAHAYA'))) {
    return { categoria: '4', subcategoria: 'Renta de Terrenos' }
  }

  if (conceptoUpper.includes('RENTA') && (conceptoUpper.includes('DEPARTAMENTO') || conceptoUpper.includes('CAMPAMENTO') || conceptoUpper.includes('CASA') || conceptoUpper.includes('CUARTO') || conceptoUpper.includes('POSADA') || conceptoUpper.includes('HOSPEDAJE') || conceptoUpper.includes('VILLA'))) {
    return { categoria: '4', subcategoria: 'Renta de Inmuebles' }
  }

  if (conceptoUpper.includes('LEASING') || conceptoUpper.includes('ARRENDAMIENTO LEASING')) {
    return { categoria: '4', subcategoria: 'Renta de Vehículos (Leasing)' }
  }

  if (conceptoUpper.includes('RENTA') && (conceptoUpper.includes('MAQUINARIA') || conceptoUpper.includes('CR') || conceptoUpper.includes('EQUIPO'))) {
    return { categoria: '4', subcategoria: 'Renta de Maquinaria y Equipo' }
  }

  if (conceptoUpper.includes('RENTA') && conceptoUpper.includes('BAÑOS')) {
    return { categoria: '4', subcategoria: 'Renta de Baños y Otros' }
  }

  if (conceptoUpper.includes('ARRENDAMIENTOS') || conceptoUpper.includes('ARRENDAMIENTO')) {
    return { categoria: '4', subcategoria: 'Renta de Inmuebles' }
  }

  if (conceptoUpper.includes('HONORARIOS') || conceptoUpper.includes('ASESORIAS') || conceptoUpper.includes('GASTOS LEGALES')) {
    return { categoria: '5', subcategoria: 'Honorarios y Asesorías' }
  }

  if (conceptoUpper.includes('SOPORTE') && conceptoUpper.includes('SISTEMAS')) {
    return { categoria: '5', subcategoria: 'Soporte de Sistemas' }
  }

  if (conceptoUpper.includes('TRAMITES LEGALES') || conceptoUpper.includes('REGISTRO') || conceptoUpper.includes('PLANO') || conceptoUpper.includes('GRAVAMEN') || conceptoUpper.includes('TOPOGRAFO')) {
    return { categoria: '5', subcategoria: 'Servicios Legales y Trámites' }
  }

  if (conceptoUpper.includes('PAPELERIA') || conceptoUpper.includes('ARTICULOS DE OFICINA')) {
    return { categoria: '6', subcategoria: 'Papelería y Artículos de Oficina' }
  }

  if (conceptoUpper.includes('LIMPIEZA') || conceptoUpper.includes('ARTICULOS DE LIMPIEZA')) {
    return { categoria: '6', subcategoria: 'Artículos de Limpieza' }
  }

  if (conceptoUpper.includes('GARRAFON')) {
    return { categoria: '6', subcategoria: 'Agua de Garrafón' }
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

  if (conceptoUpper.includes('VERIFICACION') || conceptoUpper.includes('VERIFICACIONES VEHICULARES')) {
    return { categoria: '8', subcategoria: 'Verificaciones Vehiculares' }
  }

  if (conceptoUpper.includes('MANTO') ||
      conceptoUpper.includes('MANTENIMIENTO') ||
      conceptoUpper.includes('TALACHA') ||
      conceptoUpper.includes('PAILERIA') ||
      conceptoUpper.includes('LAVADO') ||
      conceptoUpper.includes('DETALLADO') ||
      conceptoUpper.includes('SERVICIO DE MOTOR') ||
      conceptoUpper.includes('SOLDADURA') ||
      conceptoUpper.includes('ARREGLO') ||
      conceptoUpper.includes('TORNILLOS')) {
    return { categoria: '8', subcategoria: 'Reparaciones y Mantenimiento' }
  }

  if (conceptoUpper.includes('PUBLICIDAD') || conceptoUpper.includes('GASTOS DE VENTA') || conceptoUpper.includes('REPRESENTACION')) {
    return { categoria: '10', subcategoria: 'Publicidad' }
  }

  if (conceptoUpper.includes('RECARGOS')) {
    return { categoria: '11', subcategoria: 'Recargos' }
  }

  if (conceptoUpper.includes('SEGUROS') || conceptoUpper.includes('DEDUCIBLE')) {
    return { categoria: '12', subcategoria: 'Seguros' }
  }

  if (conceptoUpper.includes('MULTA') || conceptoUpper.includes('MORDIDA') || conceptoUpper.includes('DADIVA') || conceptoUpper.includes('IMPuestos')) {
    return { categoria: '13', subcategoria: 'Impuestos Locales' }
  }

  if (conceptoUpper.includes('DERECHOS') || conceptoUpper.includes('IMPUESTOS') || conceptoUpper.includes('DEPOSITO') || conceptoUpper.includes('IMPUESTOS Y DERECHOS')) {
    return { categoria: '13', subcategoria: 'Derechos' }
  }

  if (conceptoUpper.includes('NO DEDUCIBLES') || conceptoUpper.includes('NO DEDUCIBLE')) {
    return { categoria: '14', subcategoria: 'Gastos No Deducibles' }
  }

  if (conceptoUpper.includes('PAQUETERIA') || conceptoUpper.includes('ENVIOS')) {
    return { categoria: '14', subcategoria: 'Paquetería y Envíos' }
  }

  if (conceptoUpper.includes('REPOSICION') || conceptoUpper.includes('REP DE CJA') || conceptoUpper.includes('ESTACIONAMIENTO')) {
    return { categoria: '14', subcategoria: 'Otros Gastos Varios' }
  }

  return { categoria: '14', subcategoria: 'Otros Gastos Varios' }
}

function determineAssignmentType(planta: string): 'DIRECTO' | 'DISTRIBUIR_VOLUMEN' | 'DISTRIBUIR_BU' {
  const plantaUpper = planta.toUpperCase().trim()
  if (/^P00[1-5]$/.test(plantaUpper) || plantaUpper === 'P004P') return 'DIRECTO'
  if (plantaUpper === 'GEN' || plantaUpper === 'GENERAL') return 'DISTRIBUIR_VOLUMEN'
  if (plantaUpper.includes('TJ') || plantaUpper.includes('BJ')) return 'DISTRIBUIR_BU'
  return 'DISTRIBUIR_VOLUMEN'
}

function normalizePlantCode(planta: string): string {
  const plantaUpper = planta.toUpperCase().trim()
  if (plantaUpper.includes('TJ')) return 'tj'
  if (plantaUpper.includes('BJ')) return 'bj'
  if (plantaUpper === 'GEN' || plantaUpper === 'GENERAL') return 'gen'
  return plantaUpper
}

async function main() {
  console.log('🚀 Classifying February 2026 Expenses...\n')

  const csvPath = path.join(process.cwd(), 'INDIRECTOS PRCESADOS.csv')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')

  function parseCSVLine(line: string): string[] {
    if (line.startsWith('"')) {
      const closingQuoteIdx = line.indexOf('"', 1)
      if (closingQuoteIdx !== -1) {
        const concepto = line.substring(1, closingQuoteIdx).trim()
        const remaining = line.substring(closingQuoteIdx + 1).trim()
        const afterComma = remaining.startsWith(',') ? remaining.substring(1).trim() : remaining
        const remainingParts = afterComma.split(',').map(p => p.trim())
        const meaningful = remainingParts.filter(p => p !== '')
        if (meaningful.length >= 3) {
          return [concepto, meaningful[0], meaningful[1], meaningful[2]]
        }
      }
    }
    const allCommas = line.split(',').map(p => p.trim())
    if (allCommas.length >= 4) {
      return [allCommas[0], allCommas[1], allCommas[2], allCommas[3]]
    }
    const lastCommaIdx = line.lastIndexOf(',')
    const secondLastCommaIdx = line.lastIndexOf(',', lastCommaIdx - 1)
    const thirdLastCommaIdx = line.lastIndexOf(',', secondLastCommaIdx - 1)
    if (thirdLastCommaIdx !== -1) {
      return [
        line.substring(0, thirdLastCommaIdx).trim(),
        line.substring(thirdLastCommaIdx + 1, secondLastCommaIdx).trim(),
        line.substring(secondLastCommaIdx + 1, lastCommaIdx).trim(),
        line.substring(lastCommaIdx + 1).trim()
      ]
    }
    return allCommas
  }

  const lines = csvContent.split('\n').filter(line => line.trim())
  const records: ExpenseRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    records.push({
      CONCEPTO: values[0] || '',
      VALOR: values[1] || '',
      PLANTA: values[2] || '',
      DEPARTAMENTO: values[3] || ''
    })
  }

  console.log(`📊 Loaded ${records.length} expense records\n`)

  const classified: Array<ExpenseRow & { CATEGORIA_GASTO: string; SUBCATEGORIA_GASTO: string; TIPO_ASIGNACION: string; PLANTA_O_BU: string }> = []

  for (const record of records) {
    const classification = classifyExpense(record.CONCEPTO, record.DEPARTAMENTO)
    classified.push({
      ...record,
      CATEGORIA_GASTO: classification.categoria,
      SUBCATEGORIA_GASTO: classification.subcategoria,
      TIPO_ASIGNACION: determineAssignmentType(record.PLANTA),
      PLANTA_O_BU: normalizePlantCode(record.PLANTA)
    })
  }

  const outputPath = path.join(process.cwd(), 'GASTOS_FEBRERO2026_CLASIFICADOS.csv')
  const outputLines = ['CONCEPTO,VALOR,PLANTA_O_BU,DEPARTAMENTO,CATEGORIA_GASTO,SUBCATEGORIA_GASTO,TIPO_ASIGNACION,NOTAS']

  for (const record of classified) {
    const quoteIfNeeded = (field: string) => (field.includes(',') ? `"${field}"` : field)
    outputLines.push([
      quoteIfNeeded(record.CONCEPTO),
      record.VALOR,
      record.PLANTA_O_BU,
      record.DEPARTAMENTO,
      record.CATEGORIA_GASTO,
      quoteIfNeeded(record.SUBCATEGORIA_GASTO),
      record.TIPO_ASIGNACION,
      ''
    ].join(','))
  }

  fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf-8')

  const byType = classified.reduce((acc, r) => { acc[r.TIPO_ASIGNACION] = (acc[r.TIPO_ASIGNACION] || 0) + 1; return acc }, {} as Record<string, number>)
  const totalAmount = classified.reduce((sum, r) => sum + parseFloat(r.VALOR.replace(/,/g, '') || '0'), 0)

  console.log('📊 CLASSIFICATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total expenses: ${classified.length}`)
  console.log(`Total amount: $${totalAmount.toFixed(2)}`)
  console.log('\nBy assignment type:')
  Object.entries(byType).forEach(([type, count]) => console.log(`  ${type}: ${count} expenses`))
  console.log(`\n✅ Classified CSV saved to: ${outputPath}`)
}

main().catch(console.error)
