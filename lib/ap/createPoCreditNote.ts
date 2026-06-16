import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeCfdiUuid } from '@/lib/sat/normalizeCfdiUuid'
import { roundMoney } from '@/lib/ap/po-invoice-utils'

export type PoCreditNoteInvoiceAllocationInput = {
  invoice_id: string
  allocated_subtotal: number
}

export type CreatePoCreditNoteInput = {
  supplier_id?: string | null
  plant_id: string
  credit_number?: string | null
  credit_date: string
  reason: 'price_adjustment' | 'return' | 'defect' | 'other'
  notes?: string | null
  amount: number
  vat_rate?: number
  invoice_allocations: PoCreditNoteInvoiceAllocationInput[]
  cfdi_uuid?: string | null
  cfdi_serie?: string | null
  cfdi_folio?: string | null
  cfdi_emisor_rfc?: string | null
  cfdi_receptor_rfc?: string | null
  cfdi_relacionado_uuid?: string | null
  cfdi_capture_mode?: string
}

export type CreatePoCreditNoteResult =
  | { ok: true; credit_note: Record<string, unknown> }
  | { ok: false; error: string; status: number }

export async function createPoCreditNote(
  supabase: SupabaseClient,
  userId: string,
  body: CreatePoCreditNoteInput,
): Promise<CreatePoCreditNoteResult> {
  const {
    supplier_id = null,
    plant_id,
    credit_number,
    credit_date,
    reason,
    notes,
    amount,
    vat_rate = 0.16,
    invoice_allocations,
    cfdi_uuid: rawCfdiUuid = null,
    cfdi_serie = null,
    cfdi_folio = null,
    cfdi_emisor_rfc = null,
    cfdi_receptor_rfc = null,
    cfdi_relacionado_uuid = null,
    cfdi_capture_mode = 'manual',
  } = body

  const cfdi_uuid = normalizeCfdiUuid(rawCfdiUuid)

  if (!plant_id || !credit_date || !reason || !amount || amount <= 0) {
    return {
      ok: false,
      error: 'Campos requeridos: plant_id, credit_date, reason, amount',
      status: 400,
    }
  }
  if (!Array.isArray(invoice_allocations) || invoice_allocations.length === 0) {
    return { ok: false, error: 'Se requiere al menos una factura en invoice_allocations', status: 400 }
  }

  if (cfdi_capture_mode === 'cfdi') {
    if (!cfdi_uuid || !cfdi_emisor_rfc) {
      return { ok: false, error: 'Modo CFDI requiere cfdi_uuid y cfdi_emisor_rfc', status: 400 }
    }
  }

  if (cfdi_uuid) {
    const { data: dup } = await supabase
      .from('po_credit_notes')
      .select('id, credit_number')
      .eq('cfdi_uuid', cfdi_uuid)
      .maybeSingle()
    if (dup) {
      return {
        ok: false,
        error: `Este CFDI ya está registrado en la NC ${dup.credit_number ?? dup.id}`,
        status: 409,
      }
    }
  }

  const allocSum = invoice_allocations.reduce((s, a) => s + Number(a.allocated_subtotal ?? 0), 0)
  if (Math.abs(allocSum - Number(amount)) > 0.01) {
    return {
      ok: false,
      error: `La suma de asignaciones (${allocSum}) no coincide con el monto del crédito (${amount})`,
      status: 400,
    }
  }

  const invoiceIds = invoice_allocations.map((a) => a.invoice_id)
  const { data: invoices, error: invErr } = await supabase
    .from('po_supplier_invoices')
    .select('id, supplier_id, plant_id, invoice_number, subtotal, discount_amount, vat_rate, status')
    .in('id', invoiceIds)

  if (invErr || !invoices || invoices.length !== invoiceIds.length) {
    return { ok: false, error: 'Una o más facturas no encontradas', status: 404 }
  }

  for (const inv of invoices) {
    if (inv.plant_id !== plant_id) {
      return { ok: false, error: `Factura ${inv.invoice_number} no pertenece a la planta indicada`, status: 400 }
    }
    if (supplier_id && inv.supplier_id !== supplier_id) {
      return {
        ok: false,
        error: `Factura ${inv.invoice_number} no pertenece al proveedor indicado`,
        status: 400,
      }
    }
    if (inv.status === 'void') {
      return {
        ok: false,
        error: `Factura ${inv.invoice_number} está anulada y no puede recibir notas de crédito`,
        status: 400,
      }
    }
  }

  const { data: existingAllocs } = await supabase
    .from('po_credit_note_invoice_allocations')
    .select('invoice_id, allocated_subtotal')
    .in('invoice_id', invoiceIds)

  for (const alloc of invoice_allocations) {
    const inv = invoices.find((i) => i.id === alloc.invoice_id)!
    const taxableBase = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)
    const alreadyApplied = (existingAllocs ?? [])
      .filter((a) => a.invoice_id === alloc.invoice_id)
      .reduce((s, a) => s + Number(a.allocated_subtotal), 0)
    if (alreadyApplied + Number(alloc.allocated_subtotal) > taxableBase + 0.01) {
      return {
        ok: false,
        error: `El crédito para la factura ${inv.invoice_number} excede la base gravable (${taxableBase})`,
        status: 400,
      }
    }
  }

  const taxAmount = roundMoney(Number(amount) * Number(vat_rate))
  const resolvedSupplierId = supplier_id ?? invoices[0]?.supplier_id ?? null

  const { data: creditNote, error: cnErr } = await supabase
    .from('po_credit_notes')
    .insert({
      supplier_id: resolvedSupplierId,
      plant_id,
      credit_number: credit_number?.trim() || null,
      credit_date,
      reason,
      amount: Number(amount),
      tax_amount: taxAmount,
      total: roundMoney(Number(amount) + taxAmount),
      vat_rate: Number(vat_rate),
      status: 'open',
      notes: notes?.trim() || null,
      applied_by: userId,
      cfdi_uuid: cfdi_uuid || null,
      cfdi_serie,
      cfdi_folio,
      cfdi_emisor_rfc,
      cfdi_receptor_rfc,
      cfdi_relacionado_uuid,
      cfdi_capture_mode,
    })
    .select()
    .single()

  if (cnErr || !creditNote) {
    return { ok: false, error: cnErr?.message ?? 'Error al crear nota de crédito', status: 500 }
  }

  for (const alloc of invoice_allocations) {
    const inv = invoices.find((i) => i.id === alloc.invoice_id)!
    const allocTax = roundMoney(Number(alloc.allocated_subtotal) * Number(inv.vat_rate))

    await supabase.from('po_credit_note_invoice_allocations').insert({
      credit_note_id: creditNote.id,
      invoice_id: alloc.invoice_id,
      allocated_subtotal: Number(alloc.allocated_subtotal),
      allocated_tax: allocTax,
    })
  }

  const cnStatus = 'fully_applied'
  await supabase.from('po_credit_notes').update({ status: cnStatus }).eq('id', creditNote.id)

  return { ok: true, credit_note: { ...creditNote, status: cnStatus } }
}
