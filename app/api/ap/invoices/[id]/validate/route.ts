import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { id } = await params

    const { data, error } = await supabase.rpc('validate_po_invoice_vs_oc', {
      p_invoice_id: id,
    })

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Error al validar factura', details: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, warnings: data ?? [] })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno',
      },
      { status: 500 },
    )
  }
}
