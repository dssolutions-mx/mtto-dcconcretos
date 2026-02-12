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

// Helper: render quotation items (unit price, qty, total) for a single quotation
function renderQuotationItems(quotation: any): string {
  const items = Array.isArray(quotation?.quotation_items) ? quotation.quotation_items : []
  if (items.length === 0) return ''
  const rows = items.map((it: any) => {
    const qty = Number(it.quantity) || 1
    const unit = Number(it.unit_price) ?? Number(it.price) ?? 0
    const total = Number(it.total_price) ?? qty * unit
    return `<tr><td style="padding:6px 8px; border:1px solid #e2e8f0; font-size:12px">${(it.description || it.part_number || '—').toString().slice(0, 60)}</td><td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center">${qty}</td><td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:right">$${unit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td><td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:right">$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td></tr>`
  }).join('')
  return `<table style="width:100%; border-collapse:collapse; margin-top:6px; font-size:12px"><thead><tr style="background:#f1f5f9"><th style="padding:6px 8px; text-align:left; border:1px solid #e2e8f0">Descripción</th><th style="padding:6px 8px; text-align:center; border:1px solid #e2e8f0">Cant.</th><th style="padding:6px 8px; text-align:right; border:1px solid #e2e8f0">Precio unit.</th><th style="padding:6px 8px; text-align:right; border:1px solid #e2e8f0">Total</th></tr></thead><tbody>${rows}</tbody></table>`
}

type QuotationAction = { quotationId: string; supplierName: string; url: string; isSelected?: boolean }

function buildEmailHtml(
  po: any,
  recipientName: string,
  approveUrl: string,
  rejectUrl: string,
  viewUrl: string,
  quotations: any[] = [],
  approveByQuotation: QuotationAction[] = [],
  opts: { isTest?: boolean; variantLabel?: string; hideSelectedState?: boolean; selectedByPersonName?: string } = {}
) {
  const { isTest = false, variantLabel = '', hideSelectedState = false, selectedByPersonName = '' } = opts
  const totalAmount = Number(po.total_amount || 0)
  const poPurpose = po.po_purpose || 'work_order_cash'
  const cashImpact = (poPurpose === 'work_order_inventory' || poPurpose === 'inventory_restock') ? 0 : totalAmount
  // When hideSelectedState (BU selecting): no quotation is "selected" yet — BU will choose
  const selectedQuotation = hideSelectedState ? null : quotations.find((q: any) => q.status === 'selected')
  const hasQuotations = quotations.length > 0

  let purposeLabel = 'Compra a Proveedor'
  let purposeColor = '#0f4c81'
  let purposeExplanation = 'Las partes no están disponibles en inventario. Se requiere comprar a un proveedor externo.'
  if (poPurpose === 'work_order_inventory') {
    purposeLabel = 'Uso de Inventario'
    purposeColor = '#0f4c81'
    purposeExplanation = 'Las partes están disponibles en inventario. No se requiere compra externa, solo autorización para usar el inventario existente.'
  } else if (poPurpose === 'inventory_restock') {
    purposeLabel = 'Reabastecimiento de Inventario'
    purposeColor = '#0f4c81'
    purposeExplanation = 'Compra para reabastecer inventario. El gasto se reconoce cuando se usen las partes, no al momento de la compra.'
  } else if (poPurpose === 'mixed') {
    purposeLabel = 'Compra Mixta (Inventario + Proveedor)'
    purposeColor = '#0f4c81'
    purposeExplanation = 'Algunas partes desde inventario, otras no disponibles y requieren compra a proveedor.'
  }

  const testBanner = isTest ? `
    <div style="background:#b91c1c; color:#fff; padding:12px 20px; text-align:center; font-weight:700; font-size:14px; margin-bottom:20px;">
      PRUEBA ${variantLabel ? `— Variante ${variantLabel} — ` : ''}Este es un correo de prueba. No es una notificación real.
    </div>` : ''

  // Build comparison table: Proveedor, Monto, Entrega, Tiempo de pago, Estado + items per quote
  // When hideSelectedState (BU selecting): treat all as alternatives — no "selected" yet
  const comparisonTable = hasQuotations && quotations.length >= 1 ? quotations.map((q: any) => {
    const isSelected = !hideSelectedState && q.status === 'selected'
    const itemsHtml = renderQuotationItems(q)
    const summary = `
    <tr class="${isSelected ? 'selected' : q.status === 'rejected' ? 'rejected' : ''}">
      <td style="padding:10px 12px; border:1px solid #e2e8f0">${q.supplier_name}${isSelected ? ' ✓' : ''}</td>
      <td style="padding:10px 12px; border:1px solid #e2e8f0; text-align:right">$${Number(q.quoted_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      <td style="padding:10px 12px; border:1px solid #e2e8f0; text-align:right">${q.delivery_days != null ? q.delivery_days + ' días' : 'N/A'}</td>
      <td style="padding:10px 12px; border:1px solid #e2e8f0">${(q.payment_terms || 'N/A').toString().slice(0, 40)}</td>
      <td style="padding:10px 12px; border:1px solid #e2e8f0; text-align:center">${isSelected ? 'SELECCIONADO' : q.status === 'rejected' ? 'Rechazada' : 'Opción'}</td>
    </tr>`
    const detail = itemsHtml ? `<tr><td colspan="5" style="padding:8px 12px; border:1px solid #e2e8f0; background:#fafafa; vertical-align:top">${itemsHtml}</td></tr>` : ''
    return summary + detail
  }).join('') : ''

  const showComparison = hasQuotations && quotations.length >= 1

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Solicitud de Aprobación - Orden de Compra</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .email-wrapper { padding: 24px; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: #0f4c81; color: #ffffff; padding: 24px 28px; }
    .header-title { font-size: 18px; font-weight: 600; letter-spacing: 0.02em; margin: 0; }
    .header-subtitle { font-size: 13px; opacity: 0.9; margin-top: 4px; }
    .body { padding: 28px; line-height: 1.6; font-size: 14px; }
    .title { font-size: 17px; font-weight: 600; color: #0f4c81; margin: 0 0 16px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .btn { display:inline-block; padding:12px 20px; margin:6px 8px 6px 0; color:#fff; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; }
    .approve { background:#0d9488; }
    .reject { background:#b91c1c; }
    .view { background:#0f4c81; }
    .meta { background:#f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; margin: 16px 0; font-size: 13px; }
    .muted { color: #64748b; font-size: 12px; margin-top: 16px; }
    .purpose-badge { display:inline-block; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #fff; margin-bottom: 12px; background: ${purposeColor}; }
    .alert-box { padding: 14px 18px; margin: 16px 0; border-radius: 6px; border-left: 4px solid; font-size: 13px; }
    .cash-zero { color: #0d9488; font-weight: 600; }
    .cash-required { color: #b91c1c; font-weight: 600; }
    .comparison-table { width:100%; border-collapse:collapse; margin-top: 12px; font-size: 13px; }
    .comparison-table th { background: #f1f5f9; padding: 10px 12px; text-align:left; border: 1px solid #e2e8f0; font-weight: 600; color: #334155; }
    .comparison-table td { padding: 10px 12px; border: 1px solid #e2e8f0; }
    .comparison-table tr.selected { background: #ecfdf5; }
    .comparison-table tr.rejected { opacity: 0.7; }
    .footer { background: #f8fafc; padding: 16px 28px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
    a { color: #0f4c81; text-decoration: none; }
    .link { word-break: break-all; font-size: 11px; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      ${testBanner}
      <div class="header">
        <p class="header-title">Sistema de Gestión de Mantenimiento</p>
        <p class="header-subtitle">Solicitud de aprobación de Orden de Compra</p>
      </div>
      <div class="body">
        <h2 class="title">Orden de Compra ${po.order_id || ''} — Aprobación Requerida</h2>

        <div class="purpose-badge">${purposeLabel}</div>

        ${cashImpact === 0 ? `
        <div class="alert-box" style="background:#ecfdf5; border-left-color:#0d9488;">
          <div style="font-weight:600; margin-bottom:4px;">Partes en inventario — sin compra externa</div>
          <div style="color:#065f46;">${purposeExplanation}</div>
        </div>
        ` : `
        <div class="alert-box" style="background:#fef2f2; border-left-color:#b91c1c;">
          <div style="font-weight:600; margin-bottom:4px;">Partes no disponibles en inventario — requiere compra a proveedor: $${cashImpact.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
          <div style="color:#7f1d1d;">${purposeExplanation}</div>
        </div>
        `}

    ${showComparison ? `
    <div style="margin-top:16px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px">
      <div style="font-weight:700; margin-bottom:8px">${hideSelectedState ? 'Cotizaciones disponibles — seleccione una para aprobar' : 'Cotización seleccionada y alternativas'}</div>
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th style="text-align:right">Monto Total</th>
            <th style="text-align:right">Entrega</th>
            <th>Tiempo de pago</th>
            <th style="text-align:center">Estado</th>
          </tr>
        </thead>
        <tbody>${comparisonTable}</tbody>
      </table>
    </div>
    ` : ''}

    <div class="meta">
      <div class="row"><div>Proveedor</div><div><strong>${hideSelectedState && hasQuotations ? 'Por seleccionar' : (selectedQuotation?.supplier_name || po.supplier || 'N/A')}</strong></div></div>
      <div class="row"><div>Monto Total</div><div><strong>${hideSelectedState && hasQuotations ? 'Según cotización elegida' : `$${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}</strong></div></div>
      ${hasQuotations && selectedQuotation ? `
      <div class="row"><div>Monto Cotizado</div><div><strong>$${Number(selectedQuotation.quoted_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></div></div>
      ${(() => {
        const r = selectedQuotation.selection_reason
        const isAuto = r && /auto-seleccionada/i.test(r)
        const text = (r && !isAuto) ? r : (selectedByPersonName ? `${selectedByPersonName} la seleccionó` : (r || ''))
        return text ? `<div class="row"><div>Razón de Selección</div><div>${text}</div></div>` : ''
      })()}
      ` : ''}
      <div class="row">
        <div>Requiere compra a proveedor</div>
        <div class="${cashImpact === 0 ? 'cash-zero' : 'cash-required'}">
          ${cashImpact === 0 ? 'No (partes en inventario)' : `Sí — $${cashImpact.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`}
        </div>
      </div>
      <div class="row"><div>Tipo</div><div><strong>${po.po_type || 'N/A'}</strong></div></div>
      ${po.work_order_id_html || ''}
      ${po.quotation_html || ''}
    </div>
    ${po.notes_html || ''}
    <p>Estimado/a ${recipientName || 'autorizador'}, se solicita su autorización para la siguiente orden:</p>
    <p>
      ${approveByQuotation.length >= 2 ? (() => {
        const selected = approveByQuotation.find((q) => q.isSelected)
        const alternatives = approveByQuotation.filter((q) => !q.isSelected)
        const isBuSelection = !selected
        if (isBuSelection) {
          return `
      <div style="margin-bottom:16px;">
        <div style="font-weight:600; margin-bottom:8px; color:#0f4c81;">Seleccione la cotización a aprobar</div>
        <p style="margin:0 0 8px;">Elija el proveedor con el que desea aprobar esta orden:</p>
        ${approveByQuotation.map((q) =>
          `<a class="btn approve" href="${q.url}" style="margin-right:10px; margin-bottom:8px">Aprobar con ${q.supplierName}</a>`
        ).join(' ')}
      </div>
      `
        }
        return `
      <div style="margin-bottom:16px;">
        <div style="font-weight:600; margin-bottom:8px; color:#0f4c81;">Confirmar selección</div>
        <p style="margin:0 0 8px;">Aprobar la cotización ya seleccionada por el área solicitante (${selected.supplierName}):</p>
        <a class="btn approve" href="${selected.url}" style="margin-right:10px; margin-bottom:8px">Confirmar selección actual</a>
      </div>
      ${alternatives.length > 0 ? `
      <div style="margin-bottom:16px;">
        <div style="font-weight:600; margin-bottom:8px; color:#0f4c81;">Cambiar selección</div>
        <p style="margin:0 0 8px;">Si prefiere otra cotización, seleccione el proveedor:</p>
        ${alternatives.map((q) =>
          `<a class="btn view" href="${q.url}" style="margin-right:10px; margin-bottom:8px; background:#475569;">Aprobar con ${q.supplierName}</a>`
        ).join(' ')}
      </div>
      ` : ''}
      `
      })() : `<a class="btn approve" href="${approveUrl}">Aprobar</a>`}
      <a class="btn reject" href="${rejectUrl}">Rechazar</a>
      <a class="btn view" href="${viewUrl}">Ver Detalles</a>
    </p>
    <p class="muted">Si los botones no funcionan, utilice los enlaces directos proporcionados arriba.</p>
    ${approveByQuotation.length >= 2 ? (() => {
      const sel = approveByQuotation.find((q) => q.isSelected)
      if (!sel) {
        return approveByQuotation.map((q) => `<p class="link muted">Aprobar con ${q.supplierName}: ${q.url}</p>`).join('')
      }
      const alts = approveByQuotation.filter((q) => !q.isSelected)
      return `<p class="link muted">Confirmar selección: ${sel.url}</p>` + alts.map((q) => `<p class="link muted">Aprobar con ${q.supplierName}: ${q.url}</p>`).join('')
    })() : `<p class="link muted">${approveUrl}</p>`}
      </div>
      <div class="footer">Este correo fue generado automáticamente por el Sistema de Gestión de Mantenimiento. No responder.</div>
    </div>
  </div>
</body>
</html>`
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json()
    const { record, po_id, test_recipient, test_send_both } = body
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

    // Resolve approver name for GM email (replace "Auto-seleccionada" with "Hector Morales la seleccionó")
    let approverName = ''
    if (hasFirstApproval && poFull?.authorized_by) {
      const { data: approverProfile } = await supabase.from('profiles').select('nombre, apellido').eq('id', poFull.authorized_by).maybeSingle()
      if (approverProfile) approverName = `${(approverProfile as any).nombre || ''} ${(approverProfile as any).apellido || ''}`.trim()
    }

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
        const buUserId = buMgrProfile?.id
        recipients = [{ email: buManagerAuthEmail, name: businessUnitManagerName || '', userId: buUserId }]
      } else {
        // Fallback to GM if BU manager not found
        recipients = gmRecipients
      }
    }

    if (recipients.length === 0 && !test_recipient) {
      return new Response(JSON.stringify({ success: true, message: 'No recipients' }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Fetch quotations with full details (payment_terms, quotation_items for unit prices)
    const { data: quotations } = await supabase
      .from('purchase_order_quotations')
      .select('id, supplier_name, quoted_amount, delivery_days, payment_terms, quotation_items, status, selection_reason')
      .eq('purchase_order_id', po.id)
      .in('status', ['pending', 'selected'])
      .order('status', { ascending: false })

    const pendingQuotations = (quotations || []).filter((q: any) => q.status === 'pending' || q.status === 'selected')
    const isGmEscalationWithMultipleQuotes = hasFirstApproval && pendingQuotations.length >= 2
    const needsQuotationSelection = pendingQuotations.length >= 2

    // Test mode: override recipients and optionally send both BU + GM variants
    type RecipientWithVariant = { email: string; name: string; userId?: string; variant?: 'bu' | 'gm' }
    let recipientsWithVariant: RecipientWithVariant[] = recipients.map((r) => ({ ...r, variant: undefined as 'bu' | 'gm' | undefined }))
    if (test_recipient) {
      if (test_send_both) {
        recipientsWithVariant = [
          { email: test_recipient, name: 'Revisor (BU)', variant: 'bu' as const },
          { email: test_recipient, name: 'Revisor (GM)', variant: 'gm' as const },
        ]
      } else {
        recipientsWithVariant = [{ email: test_recipient, name: 'Revisor de prueba' }]
      }
    }

    const baseUrl = FRONTEND_URL.replace(/\/+$/, '')
    // Pre-build approveByQuotation for GM: include isSelected for "Confirmar selección" vs "Cambiar selección"
    const approveByQuotationForGm = pendingQuotations.length >= 2
      ? pendingQuotations.map((q: any) => ({
          quotationId: q.id,
          supplierName: q.supplier_name,
          url: `${baseUrl}/api/purchase-order-actions/direct-action?po=${po.id}&action=approve&email=RECIPIENT&quotation=${q.id}`,
          isSelected: q.status === 'selected',
        }))
      : []

    for (const r of recipientsWithVariant) {
      const isTest = !!test_recipient
      const variant = r.variant
      const useBuStyle = variant === 'bu'
      const useGmStyle = variant === 'gm'
      // BU: selects which quotation to approve → show "Aprobar con X" for each (no "Confirmar selección")
      // GM: BU already selected → show "Confirmar selección" (selected) + "Cambiar selección" (alternatives)
      let approveByQuotationForEmail: Array<{ quotationId: string; supplierName: string; url: string; isSelected?: boolean }> = []
      if (useBuStyle && pendingQuotations.length >= 2) {
        approveByQuotationForEmail = approveByQuotationForGm.map((x) => ({ ...x, url: x.url.replace('email=RECIPIENT', `email=${encodeURIComponent(r.email)}`), isSelected: false }))
      } else if (useBuStyle) {
        approveByQuotationForEmail = []
      } else if (useGmStyle && pendingQuotations.length >= 2) {
        approveByQuotationForEmail = approveByQuotationForGm.map((x) => ({ ...x, url: x.url.replace('email=RECIPIENT', `email=${encodeURIComponent(r.email)}`) }))
      } else if (!useBuStyle && !useGmStyle && isGmEscalationWithMultipleQuotes) {
        approveByQuotationForEmail = approveByQuotationForGm.map((x) => ({ ...x, url: x.url.replace('email=RECIPIENT', `email=${encodeURIComponent(r.email)}`) }))
      }

      // Skip if a valid token already exists for this recipient (avoid duplicates) - skip in test mode
      if (!isTest) {
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
      }

      const rejectToken = await generateActionToken(po.id, 'reject', r.email)
      if (!isTest) await supabase.from('po_action_tokens').insert({
        purchase_order_id: po.id,
        recipient_email: r.email,
        recipient_user_id: r.userId || null,
        action: 'reject',
        jwt_token: rejectToken,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })
      const rejectUrl = `${baseUrl}/api/purchase-order-actions/direct-action?po=${po.id}&action=reject&email=${encodeURIComponent(r.email)}`
      const viewUrl = `${baseUrl}/compras?po=${po.id}`

      let approveUrl = `${baseUrl}/api/purchase-order-actions/direct-action?po=${po.id}&action=approve&email=${encodeURIComponent(r.email)}`
      const approveByQuotation: Array<{ quotationId: string; supplierName: string; url: string }> = []

      if (needsQuotationSelection && !isTest) {
        // BU or GM with 2+ quotations: create per-quote approve tokens so recipient can select which one to approve
        for (const q of pendingQuotations) {
          const approveToken = await generateActionToken(po.id, 'approve', r.email)
          await supabase.from('po_action_tokens').insert({
            purchase_order_id: po.id,
            recipient_email: r.email,
            recipient_user_id: r.userId || null,
            action: 'approve',
            quotation_id: q.id,
            jwt_token: approveToken,
            expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          })
          approveByQuotation.push({ quotationId: q.id, supplierName: q.supplier_name, url: `${baseUrl}/api/purchase-order-actions/direct-action?po=${po.id}&action=approve&email=${encodeURIComponent(r.email)}&quotation=${q.id}`, isSelected: q.status === 'selected' })
        }
      } else if (!isTest) {
        // Single approve token (BU or GM with 1 quote)
        const approveToken = await generateActionToken(po.id, 'approve', r.email)
        await supabase.from('po_action_tokens').insert({
          purchase_order_id: po.id,
          recipient_email: r.email,
          recipient_user_id: r.userId || null,
          action: 'approve',
          jwt_token: approveToken,
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        })
      }

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

      const htmlReadyPo = { ...po, work_order_id_html: workOrderHtml + assetHtml, quotation_html: quotationHtml, notes_html: notesHtml }

      const finalApproveByQuotation = isTest ? approveByQuotationForEmail : (isGmEscalationWithMultipleQuotes ? approveByQuotation : approveByQuotationForEmail)
      const variantLabel = variant === 'bu' ? 'BU' : variant === 'gm' ? 'GM' : ''
      const hideSelectedState = useBuStyle || (!hasFirstApproval && !useGmStyle) // BU selecting: never show "selected"; GM sees selection after BU approved
      const selectedByPersonName = (useGmStyle || isGmEscalationWithMultipleQuotes) ? approverName : ''
      const html = buildEmailHtml(htmlReadyPo, r.name, approveUrl, rejectUrl, viewUrl, pendingQuotations, finalApproveByQuotation, { isTest, variantLabel, hideSelectedState, selectedByPersonName })

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
          subject: `${isTest ? '[PRUEBA] ' : ''}Solicitud de aprobación - Orden de Compra ${po.order_id || ''}${variantLabel ? ` (${variantLabel})` : ''}`,
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
        if (!isTest) await supabase.from('notifications').insert({
          user_id: null,
          title: 'Aprobación de Orden de Compra (falló envío de email)',
          message: `PO ${po.order_id || ''} → ${r.email} | error: ${errText.slice(0, 500)}`,
          type: 'PURCHASE_ORDER_APPROVAL_EMAIL',
          related_entity: 'purchase_order',
          entity_id: po.id,
        })
      } else if (!isTest) {
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


