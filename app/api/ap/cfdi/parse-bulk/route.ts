import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { extractXmlFromFormData } from '@/lib/sat/extractXmlFromUpload'
import { invoiceNumberFromCfdi, markUploadDuplicates } from '@/lib/ap/bulkCfdiValidation'

const ALLOWED_ROLES = new Set(['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'])

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile?.role || !ALLOWED_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const form = await request.formData()
    const plantId = String(form.get('plant_id') ?? '').trim() || null
    const extracted = await extractXmlFromFormData(form)
    if ('error' in extracted) {
      return NextResponse.json({ error: extracted.error }, { status: 400 })
    }

    const parsed: Array<{
      id: string
      file_name: string
      cfdi: ReturnType<typeof parseCfdiXml>
      duplicate_invoice: { id: string; invoice_number: string } | null
      purchase_order_id: string | null
      order_id: string | null
    }> = []
    const errors: Array<{ file: string; message: string }> = []
    const skipped_non_invoice: Array<{ file: string; tipo: string }> = []

    for (const { name, text } of extracted.entries) {
      try {
        const cfdi = parseCfdiXml(text)
        if (cfdi.tipo_comprobante !== 'I') {
          skipped_non_invoice.push({ file: name, tipo: cfdi.tipo_comprobante })
          continue
        }

        const { data: dup } = await supabase
          .from('po_supplier_invoices')
          .select('id, invoice_number, purchase_order_id')
          .eq('cfdi_uuid', cfdi.uuid)
          .maybeSingle()

        let purchaseOrderId: string | null = null
        let orderId: string | null = null

        if (plantId) {
          const folio = invoiceNumberFromCfdi(cfdi)
          const emisorRfc = cfdi.emisor_rfc?.trim().toUpperCase()

          if (emisorRfc) {
            const { data: supplier } = await supabase
              .from('suppliers')
              .select('id')
              .eq('rfc', emisorRfc)
              .maybeSingle()

            if (supplier?.id) {
              const { data: poBySupplier } = await supabase
                .from('po_without_supplier_invoice')
                .select('purchase_order_id, order_id')
                .eq('plant_id', plantId)
                .eq('supplier_id', supplier.id)
                .order('approval_date', { ascending: false })
                .limit(1)
                .maybeSingle()

              if (poBySupplier) {
                purchaseOrderId = poBySupplier.purchase_order_id
                orderId = poBySupplier.order_id
              }
            }
          }

          if (!purchaseOrderId) {
            const { data: poMatch } = await supabase
              .from('po_without_supplier_invoice')
              .select('purchase_order_id, order_id, supplier')
              .eq('plant_id', plantId)
              .limit(50)

            const emisorPrefix = cfdi.emisor_nombre?.slice(0, 8).toUpperCase() ?? ''
            const match = emisorPrefix
              ? (poMatch ?? []).find((po) =>
                  po.supplier?.toUpperCase().includes(emisorPrefix),
                )
              : undefined
            if (match) {
              purchaseOrderId = match.purchase_order_id
              orderId = match.order_id
            }
          }

          if (!dup) {
            const { data: folioDup } = await supabase
              .from('po_supplier_invoices')
              .select('id, invoice_number')
              .eq('invoice_number', folio)
              .eq('plant_id', plantId)
              .maybeSingle()
            if (folioDup) {
              parsed.push({
                id: cfdi.uuid,
                file_name: name,
                cfdi,
                duplicate_invoice: { id: folioDup.id, invoice_number: folioDup.invoice_number },
                purchase_order_id: purchaseOrderId,
                order_id: orderId,
              })
              continue
            }
          }
        }

        parsed.push({
          id: cfdi.uuid,
          file_name: name,
          cfdi,
          duplicate_invoice: dup
            ? { id: dup.id, invoice_number: dup.invoice_number }
            : null,
          purchase_order_id: purchaseOrderId ?? dup?.purchase_order_id ?? null,
          order_id: orderId,
        })
      } catch (err) {
        const msg = err instanceof CfdiParseError ? err.message : 'XML inválido o no es CFDI'
        errors.push({ file: name, message: msg })
      }
    }

    const withUploadFlags = markUploadDuplicates(parsed)

    return NextResponse.json({
      parsed: withUploadFlags,
      errors,
      skipped_non_invoice,
      plant_id: plantId,
    })
  } catch (err) {
    console.error('/api/ap/cfdi/parse-bulk POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
