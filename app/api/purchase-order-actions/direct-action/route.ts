import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const po = url.searchParams.get('po')
    const action = url.searchParams.get('action')
    const email = url.searchParams.get('email')
    const quotation = url.searchParams.get('quotation')

    if (!po || !action || !email) {
      const fallback = new URL('/compras/accion-po', url.origin)
      fallback.searchParams.set('action', 'error')
      fallback.searchParams.set('reason', 'missing_params')
      return NextResponse.redirect(fallback)
    }

    const supabase = await createClient()

    const { data: token, error } = await supabase.rpc('get_po_action_token', {
      p_po_id: po,
      p_action: action,
      p_recipient_email: email,
      p_quotation_id: quotation || null,
    })

    if (error || !token) {
      const fallback = new URL('/compras/accion-po', url.origin)
      fallback.searchParams.set('po', po)
      fallback.searchParams.set('action', 'error')
      fallback.searchParams.set('reason', 'no_token')
      return NextResponse.redirect(fallback)
    }

    const processUrl = new URL('/api/purchase-order-actions/process', url.origin)
    processUrl.searchParams.set('token', token as string)
    return NextResponse.redirect(processUrl)
  } catch (err) {
    const url = new URL(request.url)
    const fallback = new URL('/compras/accion-po', url.origin)
    fallback.searchParams.set('action', 'error')
    fallback.searchParams.set('reason', 'unexpected')
    return NextResponse.redirect(fallback)
  }
}


