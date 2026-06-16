import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { parseCfdiXml, CfdiParseError } from '@/lib/sat/cfdiParser'
import { extractXmlFromFormData } from '@/lib/sat/extractXmlFromUpload'
import { markUploadDuplicates } from '@/lib/ap/bulkCfdiValidation'

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
    const extracted = await extractXmlFromFormData(form)
    if ('error' in extracted) {
      return NextResponse.json({ error: extracted.error }, { status: 400 })
    }

    const parsed: Array<{
      id: string
      file_name: string
      cfdi: ReturnType<typeof parseCfdiXml>
      duplicate_credit_note: { id: string; credit_number: string | null } | null
      related_invoice_uuid: string | null
    }> = []
    const errors: Array<{ file: string; message: string }> = []

    for (const { name, text } of extracted.entries) {
      try {
        const cfdi = parseCfdiXml(text)
        if (cfdi.tipo_comprobante !== 'E') {
          errors.push({
            file: name,
            message: `Se esperaba tipo Egreso (E), recibido: ${cfdi.tipo_comprobante}`,
          })
          continue
        }

        const { data: dup } = await supabase
          .from('po_credit_notes')
          .select('id, credit_number')
          .eq('cfdi_uuid', cfdi.uuid)
          .maybeSingle()

        const relatedUuid = cfdi.cfdi_relacionados[0]?.uuid ?? null

        parsed.push({
          id: cfdi.uuid,
          file_name: name,
          cfdi,
          duplicate_credit_note: dup
            ? { id: dup.id, credit_number: dup.credit_number }
            : null,
          related_invoice_uuid: relatedUuid,
        })
      } catch (err) {
        const msg = err instanceof CfdiParseError ? err.message : 'XML inválido'
        errors.push({ file: name, message: msg })
      }
    }

    return NextResponse.json({
      parsed: markUploadDuplicates(parsed),
      errors,
    })
  } catch (err) {
    console.error('/api/ap/cfdi/parse-bulk-credit-notes POST error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
