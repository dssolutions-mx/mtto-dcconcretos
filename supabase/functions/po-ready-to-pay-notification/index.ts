import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!
const SENDGRID_FROM = Deno.env.get('SENDGRID_FROM') || 'juan.aguirre@dssolutions-mx.com'
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || ''

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json()
    const id = body.po_id || body.record?.id
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing po_id' }), { status: 400 })
    }

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, order_id, status, total_amount, approval_amount, supplier, po_type, po_purpose, work_order_type, authorized_by, approved_by, viability_checked_by, approval_date')
      .eq('id', id)
      .single()

    if (poErr || !po) {
      return new Response(JSON.stringify({ error: poErr?.message || 'PO not found' }), { status: 404 })
    }

    if ((po as any).status !== 'approved') {
      return new Response(JSON.stringify({ success: true, skipped: 'PO not approved' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: adminSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'po_admin_approval_email')
      .maybeSingle()

    const adminEmail = (adminSetting?.value as string)?.trim() || null
    if (!adminEmail) {
      return new Response(JSON.stringify({ success: true, message: 'No admin email configured' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const amount = Number(po.approval_amount) > 0
      ? Number(po.approval_amount)
      : Number(po.total_amount ?? 0)
    const approvalDate = po.approval_date
      ? new Date(po.approval_date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : ''

    const names: string[] = []
    if (po.authorized_by) {
      const { data: p } = await supabase.from('profiles').select('nombre, apellido').eq('id', po.authorized_by).maybeSingle()
      if (p) names.push(`Aprobación técnica: ${((p as any).nombre || '').trim()} ${((p as any).apellido || '').trim()}`)
    }
    if (po.viability_checked_by) {
      const { data: p } = await supabase.from('profiles').select('nombre, apellido').eq('id', po.viability_checked_by).maybeSingle()
      if (p) names.push(`Viabilidad financiera: ${((p as any).nombre || '').trim()} ${((p as any).apellido || '').trim()}`)
    }
    if (po.approved_by) {
      const { data: p } = await supabase.from('profiles').select('nombre, apellido').eq('id', po.approved_by).maybeSingle()
      if (p) names.push(`Aprobación final: ${((p as any).nombre || '').trim()} ${((p as any).apellido || '').trim()}`)
    }
    const approvalChain = names.length > 0 ? names.join('<br/>') : '—'

    const viewUrl = FRONTEND_URL ? `${FRONTEND_URL.replace(/\/+$/, '')}/compras/${po.id}` : ''

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Orden ${po.order_id || ''} — Lista para pago</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px; font-size: 12pt; line-height: 1.5; }
    .page { max-width: 600px; margin: 0 auto; }
    .header { border-bottom: 2px solid #0f4c81; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 18pt; font-weight: 600; color: #0f4c81; }
    .header .sub { margin-top: 4px; font-size: 11pt; color: #64748b; }
    .badge { display: inline-block; background: #0d9488; color: #fff; padding: 6px 14px; font-weight: 600; font-size: 11pt; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 11pt; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { font-weight: 600; color: #475569; background: #f8fafc; width: 40%; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10pt; color: #64748b; }
    .link { color: #0f4c81; text-decoration: none; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>Sistema de Gestión de Mantenimiento</h1>
      <div class="sub">Notificación para proceder con pago o compra</div>
    </div>
    <div class="badge">LISTA PARA PAGO</div>
    <p style="margin: 0 0 20px;">La siguiente orden de compra ha completado validación técnica, viabilidad financiera y aprobación correspondiente. Puede proceder con el pago o compra.</p>
    <table>
      <tr><th>Orden</th><td><strong>${(po.order_id || '').toString()}</strong></td></tr>
      <tr><th>Proveedor</th><td>${(po.supplier || '—').toString()}</td></tr>
      <tr><th>Monto</th><td><strong>$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</strong></td></tr>
      <tr><th>Tipo</th><td>${(po.po_type || '—').toString()}</td></tr>
      <tr><th>Fecha de aprobación</th><td>${approvalDate || '—'}</td></tr>
      <tr><th>Cadena de aprobación</th><td>${approvalChain}</td></tr>
    </table>
    ${viewUrl ? `<p style="margin-top: 20px;"><a href="${viewUrl}" class="link">Ver detalles en el sistema</a></p>` : ''}
    <div class="footer">Documento generado automáticamente. Impresión autorizada como respaldo de control.</div>
  </div>
</body>
</html>`

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: adminEmail }] }],
        from: { email: SENDGRID_FROM },
        subject: `Orden ${po.order_id || ''} — Lista para pago`,
        content: [{ type: 'text/html', value: html }],
        tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('SendGrid error', errText)
      await supabase.from('notifications').insert({
        user_id: null,
        title: 'PO ready-to-pay email failed',
        message: `PO ${po.order_id} → ${adminEmail} | ${errText.slice(0, 300)}`,
        type: 'PO_READY_TO_PAY_EMAIL',
        related_entity: 'purchase_order',
        entity_id: po.id,
      })
      return new Response(JSON.stringify({ error: 'Send failed' }), { status: 500 })
    }

    await supabase.from('notifications').insert({
      user_id: null,
      title: 'PO lista para pago (email enviado)',
      message: `PO ${po.order_id} → ${adminEmail}`,
      type: 'PO_READY_TO_PAY_EMAIL',
      related_entity: 'purchase_order',
      entity_id: po.id,
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Function error', e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
  }
})
