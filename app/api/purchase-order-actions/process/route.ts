import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

function decodeTokenPayload(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    const fallback = new URL('/compras/accion-po', url.origin)
    fallback.searchParams.set('action', 'error')
    fallback.searchParams.set('reason', 'missing_token')
    return NextResponse.redirect(fallback)
  }

  try {
    const decoded = decodeTokenPayload(token)
    const attemptedAction: string | undefined = decoded?.data?.action
    const tokenPoId: string | undefined = decoded?.data?.poId

    const supabase = await createClient()

    const { data, error } = await supabase.rpc('process_po_email_action', {
      p_token: token,
    })

    if (error || typeof data === 'undefined' || data === null) {
      const fallback = new URL('/compras/accion-po', url.origin)
      fallback.searchParams.set('action', 'error')
      fallback.searchParams.set('reason', error?.message || 'processing_failed')
      if (attemptedAction) fallback.searchParams.set('attempt', attemptedAction)
      if (tokenPoId) fallback.searchParams.set('po', tokenPoId)
      return NextResponse.redirect(fallback)
    }

    // Allow different shapes from the RPC result
    const result: any = data
    const success: boolean = result === true || result?.success === true || (typeof result?.status === 'string' && ['approved','rejected'].includes(result.status))
    const po_id: string | undefined = result?.po_id || tokenPoId
    const status: string | undefined = result?.status
    const message: string | undefined = result?.message || result?.error

    const dest = new URL('/compras/accion-po', url.origin)
    if (success) {
      if (po_id) dest.searchParams.set('po', po_id)
      if (status === 'approved' || status === 'rejected') dest.searchParams.set('action', status)
      else dest.searchParams.set('action', 'ok')
      return NextResponse.redirect(dest)
    }

    dest.searchParams.set('action', 'error')
    if (message) dest.searchParams.set('reason', message)
    if (attemptedAction) dest.searchParams.set('attempt', attemptedAction)
    return NextResponse.redirect(dest)
  } catch (err) {
    const fallback = new URL('/compras/accion-po', url.origin)
    fallback.searchParams.set('action', 'error')
    fallback.searchParams.set('reason', 'unexpected')
    return NextResponse.redirect(fallback)
  }
}


