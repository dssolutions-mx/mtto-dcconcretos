import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { extractXmlFromFormData } from '@/lib/sat/extractXmlFromUpload'

const ALLOWED_ROLES = new Set(['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA', 'GERENTE_MANTENIMIENTO'])

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile?.role || !ALLOWED_ROLES.has(profile.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
    }

    const form = await request.formData()
    const extracted = await extractXmlFromFormData(form)
    if ('error' in extracted) {
      return NextResponse.json({ success: false, error: extracted.error }, { status: 400 })
    }

    const entry = extracted.entries[0]
    if (!entry) {
      return NextResponse.json({ success: false, error: 'No se encontró XML' }, { status: 400 })
    }

    const cfdi = parseCfdiXml(entry.text)
    if (cfdi.tipo_comprobante !== 'I') {
      return NextResponse.json(
        { success: false, error: `El CFDI debe ser de tipo Ingreso (I), recibido: ${cfdi.tipo_comprobante}` },
        { status: 400 },
      )
    }

    const { data: dup } = await supabase
      .from('po_supplier_invoices')
      .select('id, invoice_number')
      .eq('cfdi_uuid', cfdi.uuid)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      cfdi,
      file_name: entry.name,
      duplicate_invoice: dup
        ? { id: dup.id, invoice_number: dup.invoice_number }
        : null,
    })
  } catch (err) {
    if (err instanceof CfdiParseError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}
