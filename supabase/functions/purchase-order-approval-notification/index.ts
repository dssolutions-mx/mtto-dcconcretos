import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!
const FRONTEND_URL = Deno.env.get('FRONTEND_URL')!
const SENDGRID_FROM = Deno.env.get('SENDGRID_FROM') || 'juan.aguirre@dssolutions-mx.com'
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

function buildEmailHtml(po: any, recipientName: string, approveUrl: string, rejectUrl: string, viewUrl: string, quotations: any[] = []) {
  // Calculate cash impact based on po_purpose
  const totalAmount = Number(po.total_amount || 0)
  const poPurpose = po.po_purpose || 'work_order_cash'
  const cashImpact = (poPurpose === 'work_order_inventory' || poPurpose === 'inventory_restock') ? 0 : totalAmount
  
  // Get selected quotation
  const selectedQuotation = quotations.find((q: any) => q.status === 'selected')
  const hasQuotations = quotations.length > 0
  
  // Determine purpose label and color
  let purposeLabel = 'Compra con Efectivo'
  let purposeColor = '#f97316' // orange
  let purposeExplanation = 'Esta orden requiere efectivo para comprar las partes.'
  
  if (poPurpose === 'work_order_inventory') {
    purposeLabel = 'Uso de Inventario'
    purposeColor = '#3b82f6' // blue
    purposeExplanation = 'Las partes están en inventario. No requiere efectivo, solo autorización para usar el inventario existente.'
  } else if (poPurpose === 'inventory_restock') {
    purposeLabel = 'Reabastecimiento de Inventario'
    purposeColor = '#a855f7' // purple
    purposeExplanation = 'Compra para reabastecer inventario. El gasto se reconoce cuando se usen las partes, no al comprar.'
  } else if (poPurpose === 'mixed') {
    purposeLabel = 'Compra Mixta (Efectivo + Inventario)'
    purposeColor = '#f59e0b' // amber
    purposeExplanation = 'Algunas partes desde inventario, otras requieren compra.'
  }
  
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
  .purpose-badge { display:inline-block; padding:6px 12px; border-radius:4px; font-size:13px; font-weight:600; color:#fff; margin-bottom:12px }
  .alert-box { background:#fef3c7; border-left:4px solid #f59e0b; padding:12px; margin:12px 0; border-radius:4px }
  .cash-zero { color:#16a34a; font-weight:700 }
  .cash-required { color:#dc2626; font-weight:700 }
  a { color: inherit }
  .link { word-break: break-all }
  .comparison-table { width:100%; border-collapse:collapse; margin-top:12px; font-size:13px }
  .comparison-table th { background:#f1f5f9; padding:8px; text-align:left; border:1px solid #e2e8f0; font-weight:600 }
  .comparison-table td { padding:8px; border:1px solid #e2e8f0 }
  .comparison-table tr.selected { background:#dcfce7 }
  .comparison-table tr.rejected { opacity:0.6 }
</style></head>
<body>
  <div class="container">
    <div class="title">Aprobación requerida: Orden de Compra ${po.order_id || ''}</div>
    
    <!-- Purpose Badge -->
    <div class="purpose-badge" style="background:${purposeColor}">
      ${purposeLabel}
    </div>
    
    <!-- Cash Impact Alert -->
    ${cashImpact === 0 ? `
    <div class="alert-box" style="background:#dcfce7; border-left-color:#16a34a">
      <div style="font-weight:700; margin-bottom:4px">✓ Sin impacto en efectivo este mes</div>
      <div style="font-size:13px; color:#166534">${purposeExplanation}</div>
    </div>
    ` : `
    <div class="alert-box">
      <div style="font-weight:700; margin-bottom:4px">⚠️ Requiere efectivo: $${cashImpact.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
      <div style="font-size:13px; color:#92400e">${purposeExplanation}</div>
    </div>
    `}
    
    ${hasQuotations && quotations.length > 1 ? `
    <!-- Quotation Comparison Table -->
    <div style="margin-top:16px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px">
      <div style="font-weight:700; margin-bottom:8px">Comparación de Cotizaciones</div>
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th style="text-align:right">Precio</th>
            <th style="text-align:right">Entrega</th>
            <th style="text-align:center">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${quotations.map((q: any) => {
            const isSelected = q.status === 'selected'
            return `
            <tr class="${isSelected ? 'selected' : q.status === 'rejected' ? 'rejected' : ''}">
              <td>${q.supplier_name}${isSelected ? ' ✓' : ''}</td>
              <td style="text-align:right">$${Number(q.quoted_amount).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
              <td style="text-align:right">${q.delivery_days ? q.delivery_days + ' días' : 'N/A'}</td>
              <td style="text-align:center">${isSelected ? 'SELECCIONADO' : q.status === 'rejected' ? 'Rechazada' : 'Pendiente'}</td>
            </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    <div class="meta">
      <div class="row"><div>Proveedor</div><div><strong>${selectedQuotation?.supplier_name || po.supplier || 'N/A'}</strong></div></div>
      <div class="row"><div>Monto Total</div><div><strong>$${totalAmount.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></div></div>
      ${hasQuotations && selectedQuotation ? `
      <div class="row"><div>Monto Cotizado</div><div><strong>$${Number(selectedQuotation.quoted_amount).toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></div></div>
      <div class="row"><div>Cotizaciones Comparadas</div><div><strong>${quotations.length} proveedores</strong></div></div>
      ${selectedQuotation.selection_reason ? `<div class="row"><div>Razón de Selección</div><div>${selectedQuotation.selection_reason}</div></div>` : ''}
      ` : ''}
      <div class="row">
        <div>Impacto en Efectivo</div>
        <div class="${cashImpact === 0 ? 'cash-zero' : 'cash-required'}">
          ${cashImpact === 0 ? '$0' : `$${cashImpact.toLocaleString('es-MX',{minimumFractionDigits:2})}`}
        </div>
      </div>
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
      .select('id, order_id, total_amount, supplier, po_type, po_purpose, plant_id, requested_by, work_order_id, notes, quotation_url')
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
      .select('id, nombre, apellido')
      .eq('role', 'GERENCIA_GENERAL')
      .eq('status', 'active')

    let gmRecipients: Array<{ userId: string; email: string; name: string }> = []
    if (gms && gms.length) {
      const ids = gms.map((p: any) => p.id).filter(Boolean)
      if (ids.length) {
        const { data: users } = await supabase.auth.admin.listUsers()
        const usersById = new Map<string, any>()
        ;(users?.users || []).forEach((u: any) => usersById.set(u.id, u))
        gmRecipients = gms
          .map((p: any) => {
            const u = usersById.get(p.id)
            return u?.email ? { userId: p.id as string, email: u.email as string, name: `${p.nombre || ''} ${p.apellido || ''}`.trim() } : null
          })
          .filter(Boolean) as any
      }
    }

    // NEW: BU-first with escalation logic
    // If PO has been authorized_by (BU approved), check if escalation to GM is needed
    const { data: poFull } = await supabase.from('purchase_orders').select('authorized_by').eq('id', po.id).maybeSingle()
    const hasFirstApproval = !!poFull?.authorized_by
    
    let recipients: Array<{ userId?: string; email: string; name: string }> = []
    
    if (hasFirstApproval) {
      // BU already approved; check if amount exceeds BU limit → escalate to GM
      // For now, use a simple threshold: if amount > 5000 and BU approved, notify GM
      if (amount > 5000) {
        recipients = gmRecipients
      } else {
        // Amount within BU limit; no further escalation needed
        recipients = []
      }
    } else {
      // No first approval yet → always notify BU Manager first
      if (businessUnitManagerEmail) {
        // Resolve BU manager real auth email
        let buManagerAuthEmail = businessUnitManagerEmail
        const { data: buMgrProfile } = await supabase.from('profiles').select('id').eq('email', businessUnitManagerEmail).maybeSingle()
        if (buMgrProfile?.id) {
          const { data: users } = await supabase.auth.admin.listUsers()
          const found = (users?.users || []).find((u: any) => u.id === buMgrProfile.id)
          if (found?.email) buManagerAuthEmail = found.email
        }
        recipients = [{ email: buManagerAuthEmail, name: businessUnitManagerName || '' }]
      } else {
        // Fallback to GM if BU manager not found
        recipients = gmRecipients
      }
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No recipients' }), { headers: { 'Content-Type': 'application/json' } })
    }

    for (const r of recipients) {
      // Skip if a valid token already exists for this recipient (avoid duplicates)
      const { data: existing } = await supabase
        .from('po_action_tokens')
        .select('id')
        .eq('purchase_order_id', po.id)
        .eq('recipient_email', r.email)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
      if (existing && existing.length) {
        continue
      }
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

      // Add asset code when available
      let assetHtml = ''
      if ((po as any).work_order_id) {
        const { data: wo2 } = await supabase
          .from('work_orders')
          .select('asset_id')
          .eq('id', (po as any).work_order_id)
          .maybeSingle()
        if (wo2?.asset_id) {
          const { data: asset2 } = await supabase
            .from('assets')
            .select('asset_id')
            .eq('id', wo2.asset_id)
            .maybeSingle()
          if (asset2?.asset_id) {
            assetHtml = `<div class="row"><div>Activo</div><div><strong>${asset2.asset_id}</strong></div></div>`
          }
        }
      }

      // Fetch quotations for comparison summary
      const { data: quotations } = await supabase
        .from('purchase_order_quotations')
        .select('supplier_name, quoted_amount, delivery_days, status, selection_reason')
        .eq('purchase_order_id', po.id)
        .order('status', { ascending: false }) // Selected first

      const htmlReadyPo = { ...po, work_order_id_html: workOrderHtml + assetHtml, quotation_html: quotationHtml, notes_html: notesHtml }

      const html = buildEmailHtml(htmlReadyPo, r.name, approveUrl, rejectUrl, viewUrl, quotations || [])

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
          from: { email: SENDGRID_FROM },
          subject: `${(po as any).po_purpose === 'work_order_inventory' ? '💰 $0 Efectivo' : '💵'} Aprobación OC ${po.order_id || ''}`,
          content: [{ type: 'text/html', value: html }],
          tracking_settings: {
            click_tracking: { enable: false, enable_text: false },
            open_tracking: { enable: false },
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error('SendGrid error', errText)
        await supabase.from('notifications').insert({
          user_id: null,
          title: 'Aprobación de Orden de Compra (falló envío de email)',
          message: `PO ${po.order_id || ''} → ${r.email} | error: ${errText.slice(0, 500)}`,
          type: 'PURCHASE_ORDER_APPROVAL_EMAIL',
          related_entity: 'purchase_order',
          entity_id: po.id,
        })
      } else {
        await supabase.from('notifications').insert({
          user_id: null,
          title: 'Aprobación de Orden de Compra (email enviado)',
          message: `PO ${po.order_id || ''} → ${r.email}`,
          type: 'PURCHASE_ORDER_APPROVAL_EMAIL',
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


