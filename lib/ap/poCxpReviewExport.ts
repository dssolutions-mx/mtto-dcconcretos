import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatMxCurrency } from '@/lib/ap/po-invoice-utils'
import { resolvePoPreTaxAmount } from '@/lib/ap/po-amounts'

export interface PoCxpExportRow {
  order_id: string
  supplier: string
  po_pre_tax: number
  invoice_number: string
  invoice_date: string
  invoice_pre_tax: number
  iva: number
  retentions: number
  net_payable: number
  paid_to_date: number
  balance: number
  status: string
  due_date: string | null
  expense_category: string
}

export async function loadPoCxpReviewData(
  supabase: SupabaseClient,
  plantId?: string,
): Promise<{ rows: PoCxpExportRow[]; plantLabel: string }> {
  let query = supabase.from('po_invoice_balances').select('*').order('supplier')
  if (plantId) query = query.eq('plant_id', plantId)

  const { data: balances } = await query
  const rows: PoCxpExportRow[] = []

  for (const inv of balances ?? []) {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('total_amount, approval_amount, actual_amount')
      .eq('id', inv.purchase_order_id)
      .maybeSingle()

    const poPreTax = po ? resolvePoPreTaxAmount(po) : 0
    const retentions =
      Number(inv.retention_isr_amount ?? 0) + Number(inv.retention_iva_amount ?? 0)

    rows.push({
      order_id: inv.order_id,
      supplier: inv.supplier,
      po_pre_tax: poPreTax,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      invoice_pre_tax: Number(inv.subtotal) - Number(inv.discount_amount ?? 0),
      iva: Number(inv.tax),
      retentions,
      net_payable: Number(inv.total),
      paid_to_date: Number(inv.paid_to_date),
      balance: Number(inv.balance),
      status: inv.invoice_status,
      due_date: inv.due_date,
      expense_category: inv.expense_category,
    })
  }

  let plantLabel = 'Todas las plantas'
  if (plantId) {
    const { data: plant } = await supabase.from('plants').select('name').eq('id', plantId).maybeSingle()
    plantLabel = plant?.name ?? plantId
  }

  return { rows, plantLabel }
}

export async function buildPoCxpReviewExcel(
  data: { rows: PoCxpExportRow[]; plantLabel: string },
  generatedAt: Date,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('CxP OC Mantenimiento')

  ws.mergeCells('A1:L1')
  const title = ws.getCell('A1')
  title.value = 'Revisión integral — Cuentas por pagar (OC Mantenimiento)'
  title.font = { bold: true, size: 14 }

  ws.getCell('A2').value = `Planta: ${data.plantLabel}`
  ws.getCell('A3').value = `Generado: ${format(generatedAt, 'dd/MM/yyyy HH:mm')}`
  ws.getCell('A4').value =
    'Nota: Monto OC es sin IVA. Neto a pagar incluye IVA y retenciones.'

  const headers = [
    'OC',
    'Proveedor',
    'Monto OC (sin IVA)',
    'Folio factura',
    'Fecha factura',
    'Base factura (sin IVA)',
    'IVA',
    'Retenciones',
    'Neto a pagar',
    'Pagado',
    'Saldo',
    'Estatus',
    'Vencimiento',
    'Categoría',
  ]

  const headerRow = ws.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  }
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const row of data.rows) {
    ws.addRow([
      row.order_id,
      row.supplier,
      row.po_pre_tax,
      row.invoice_number,
      row.invoice_date,
      row.invoice_pre_tax,
      row.iva,
      row.retentions,
      row.net_payable,
      row.paid_to_date,
      row.balance,
      row.status,
      row.due_date ?? '',
      row.expense_category,
    ])
  }

  const currencyCols = [3, 6, 7, 8, 9, 10, 11]
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 5) return
    for (const col of currencyCols) {
      const cell = row.getCell(col)
      if (typeof cell.value === 'number') {
        cell.numFmt = '"$"#,##0.00'
      }
    }
  })

  const totals = data.rows.reduce(
    (acc, r) => ({
      po: acc.po + r.po_pre_tax,
      net: acc.net + r.net_payable,
      balance: acc.balance + r.balance,
    }),
    { po: 0, net: 0, balance: 0 },
  )

  const totalRow = ws.addRow([
    'TOTALES',
    '',
    totals.po,
    '',
    '',
    '',
    '',
    '',
    totals.net,
    '',
    totals.balance,
    '',
    '',
    '',
  ])
  totalRow.font = { bold: true }

  ws.columns.forEach((col) => {
    col.width = 16
  })

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export function formatExportSummary(rows: PoCxpExportRow[]): string {
  const balance = rows.reduce((s, r) => s + r.balance, 0)
  return `${rows.length} facturas · Saldo total ${formatMxCurrency(balance)}`
}
