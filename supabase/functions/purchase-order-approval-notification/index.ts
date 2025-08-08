import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!
const FRONTEND_URL = Deno.env.get('FRONTEND_URL')!
const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY

// Generate compact JWT (HS256) with exp
async function generateActionToken(poId: string, action: 'approve' | 'reject', recipientEmail: string, expiresInSec = 86400) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    sub: recipientEmail,
    iat: now,
    exp: now + expiresInSec,
    data: { poId, action, recipientEmail },
  }
  const enc = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const data = `${enc(header)}.${enc(payload)}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${data}.${sigB64}`
}

function buildEmailHtml(po: any, recipientName: string, approveUrl: string, rejectUrl: string, viewUrl: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta http-equiv="x-ua-compatible" content="ie=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: Arial, sans-serif; color: #334155; }
  .container { max-width: 640px; margin: 0 auto; padding: 20px; }
  .title { font-size: 20px; font-weight: 700; margin: 0 0 10px; }
  .row { display: flex; justify-content: space-between; margin: 6px 0; }
  .btn { display:inline-block; padding:10px 16px; margin-right:10px; color:#fff; text-decoration:none; border-radius:6px; font-weight:700 }
  .approve { background:#16a34a }
  .reject { background:#dc2626 }
  .view { background:#2563eb }
  .meta { background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:6px; margin-top:10px }
  .muted { color:#64748b; font-size: 12px }
  a { color: inherit }
  .link { word-break: break-all }
</style></head>
<body>
  <div class="container">
    <div class="title">Aprobación requerida: Orden de Compra ${po.order_id || ''}</div>
    <div class="meta">
      <div class="row"><div>Proveedor</div><div><strong>${po.supplier || 'N/A'}</strong></div></div>
      <div class="row"><div>Monto</div><div><strong>$${Number(po.total_amount || 0).toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></div></div>
      <div class="row"><div>Tipo</div><div><strong>${po.po_type || 'N/A'}</strong></div></div>
      ${po.work_order_id_html || ''}
      ${po.quotation_html || ''}
    </div>
    ${po.notes_html || ''}
    <p>Hola ${recipientName || ''}, por favor autoriza esta orden:</p>
    <p>
      <a class="btn approve" href="${approveUrl}">Aprobar</a>
      <a class="btn reject" href="${rejectUrl}">Rechazar</a>
      <a class="btn view" href="${viewUrl}">Ver Detalles</a>
    </p>
    <p class="muted">Si los botones no funcionan, usa este enlace directo de aprobación:</p>
    <p class="link muted">${approveUrl}</p>
  </div>
</body>
</html>`
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { record, po_id } = await req.json()
    const id = po_id || record?.id
    if (!id) return new Response(JSON.stringify({ error: 'Missing po_id' }), { status: 400 })

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, order_id, total_amount, supplier, po_type, plant_id, requested_by, work_order_id, notes, quotation_url')
      .eq('id', id)
      .single()
    if (poErr || !po) return new Response(JSON.stringify({ error: poErr?.message || 'PO not found' }), { status: 404 })

    // Determine recipients based on organizational hierarchy and thresholds
    const amount = Number(po.total_amount || 0)

    // Resolve plant id from PO directly or via work order / asset
    let resolvedPlantId: string | null = po.plant_id || null
    if (!resolvedPlantId && (po as any).work_order_id) {
      const { data: wo } = await supabase
        .from('work_orders')
        .select('id, plant_id, asset_id')
        .eq('id', (po as any).work_order_id)
        .maybeSingle()
      resolvedPlantId = wo?.plant_id || null
      if (!resolvedPlantId && wo?.asset_id) {
        const { data: asset } = await supabase
          .from('assets')
          .select('plant_id')
          .eq('id', wo.asset_id)
          .maybeSingle()
        resolvedPlantId = asset?.plant_id || null
      }
    }

    // Resolve Business Unit from plant, then BU manager via profiles (role-based assignment)
    let businessUnitManagerEmail: string | null = null
    let businessUnitManagerName: string | null = null
    if (resolvedPlantId) {
      const { data: plant } = await supabase
        .from('plants')
        .select('id, business_unit_id')
        .eq('id', resolvedPlantId)
        .maybeSingle()
      const buId = plant?.business_unit_id as string | undefined
      if (buId) {
        // Pick active profiles in this BU with role JEFE_UNIDAD_NEGOCIO
        const { data: buManagers } = await supabase
          .from('profiles')
          .select('email, nombre, apellido')
          .eq('role', 'JEFE_UNIDAD_NEGOCIO')
          .eq('business_unit_id', buId)
          .eq('status', 'active')
        const m = (buManagers || []).find((p) => !!p.email)
        if (m?.email) {
          businessUnitManagerEmail = m.email
          businessUnitManagerName = `${(m as any).nombre || ''} ${(m as any).apellido || ''}`.trim()
        }
      }
    }

    // Get Gerencia General (unlimited authorization)
    const { data: gms } = await supabase
      .from('profiles')
      .select('email, nombre, apellido')
      .eq('role', 'GERENCIA_GENERAL')

    const gmRecipients = (gms || [])
      .filter((p) => !!p.email)
      .map((p) => ({ email: p.email as string, name: `${(p as any).nombre || ''} ${(p as any).apellido || ''}`.trim() }))

    // Threshold rule: <= 5000 -> BU Manager only; > 5000 -> Gerencia General only
    let recipients: Array<{ email: string; name: string }> = []
    if (amount > 5000) {
      recipients = gmRecipients
    } else {
      if (businessUnitManagerEmail) {
        recipients = [{ email: businessUnitManagerEmail, name: businessUnitManagerName || '' }]
      } else {
        // Fallback to GM if BU manager not found
        recipients = gmRecipients
      }
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No recipients' }), { headers: { 'Content-Type': 'application/json' } })
    }

    for (const r of recipients) {
      const approveToken = await generateActionToken(po.id, 'approve', r.email)
      const rejectToken = await generateActionToken(po.id, 'reject', r.email)

      await supabase.from('po_action_tokens').insert({
        purchase_order_id: po.id,
        recipient_email: r.email,
        action: 'approve',
        jwt_token: approveToken,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })
      await supabase.from('po_action_tokens').insert({
        purchase_order_id: po.id,
        recipient_email: r.email,
        action: 'reject',
        jwt_token: rejectToken,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })

      const baseUrl = FRONTEND_URL.replace(/\/+$/, '')
      const approveUrl = `${baseUrl}/api/purchase-order-actions/direct-action?po=${po.id}&action=approve&email=${encodeURIComponent(r.email)}`
      const rejectUrl = `${baseUrl}/api/purchase-order-actions/direct-action?po=${po.id}&action=reject&email=${encodeURIComponent(r.email)}`
      const viewUrl = `${baseUrl}/compras?po=${po.id}`

      // Optional enrichments for email body
      let workOrderHtml = ''
      if (po.work_order_id) {
        const woLink = `${baseUrl}/ordenes/${po.work_order_id}`
        workOrderHtml = `<div class="row"><div>Orden de trabajo</div><div><a href="${woLink}"><strong>${woLink}</strong></a></div></div>`
      }
      let quotationHtml = ''
      if (po.quotation_url) {
        const q = String(po.quotation_url)
        quotationHtml = `<div class="row"><div>Cotización</div><div><a href="${q}"><strong>Ver documento</strong></a></div></div>`
      }
      let notesHtml = ''
      if (po.notes) {
        const safeNotes = String(po.notes).slice(0, 800)
        notesHtml = `<div class="meta" style="margin-top:10px"><div class="row" style="justify-content:flex-start"><div><strong>Notas</strong></div></div><div style="margin-top:6px">${safeNotes.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`
      }

      const htmlReadyPo = { ...po, work_order_id_html: workOrderHtml, quotation_html: quotationHtml, notes_html: notesHtml }

      const html = buildEmailHtml(htmlReadyPo, r.name, approveUrl, rejectUrl, viewUrl)

      // SendGrid: disable click tracking to avoid URL rewriting
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: r.email }],
              tracking_settings: {
                click_tracking: { enable: false, enable_text: false },
                open_tracking: { enable: false },
              },
            },
          ],
          from: { email: 'no-reply@dssolutions-mx.com' },
          subject: `Aprobación de Orden de Compra ${po.order_id || ''}`,
          content: [{ type: 'text/html', value: html }],
          tracking_settings: {
            click_tracking: { enable: false, enable_text: false },
            open_tracking: { enable: false },
          },
        }),
      })

      if (!response.ok) {
        console.error('SendGrid error', await response.text())
      } else {
        await supabase.from('notifications').insert({
          user_id: null,
          title: 'Aprobación de Orden de Compra',
          message: `Se solicitó aprobación de la OC ${po.order_id || ''}`,
          type: 'PURCHASE_ORDER_APPROVAL_REQUEST',
          related_entity: 'purchase_order',
          entity_id: po.id,
        })
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('Function error', e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
  }
})


