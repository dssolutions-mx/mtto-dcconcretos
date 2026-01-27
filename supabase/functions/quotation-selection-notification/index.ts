import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!
const FRONTEND_URL = Deno.env.get('FRONTEND_URL')!
const SENDGRID_FROM = Deno.env.get('SENDGRID_FROM') || 'juan.aguirre@dssolutions-mx.com'

function buildQuotationSelectionEmailHtml(po: any, requesterName: string, viewUrl: string, quotations: any[] = []) {
  const totalAmount = Number(po.total_amount || 0)
  
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: Arial, sans-serif; color: #334155; }
  .container { max-width: 640px; margin: 0 auto; padding: 20px; }
  .title { font-size: 20px; font-weight: 700; margin: 0 0 10px; }
  .row { display: flex; justify-content: space-between; margin: 6px 0; }
  .btn { display:inline-block; padding:12px 20px; margin:10px 0; color:#fff; text-decoration:none; border-radius:6px; font-weight:700; background:#2563eb }
  .meta { background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:6px; margin-top:10px }
  .alert-box { background:#fef3c7; border-left:4px solid #f59e0b; padding:12px; margin:12px 0; border-radius:4px }
  .comparison-table { width:100%; border-collapse:collapse; margin-top:12px; font-size:13px }
  .comparison-table th { background:#f1f5f9; padding:8px; text-align:left; border:1px solid #e2e8f0; font-weight:600 }
  .comparison-table td { padding:8px; border:1px solid #e2e8f0 }
  .best-price { background:#dcfce7; font-weight:700 }
  .fastest { background:#dbeafe; font-weight:700 }
</style></head>
<body>
  <div class="container">
    <div class="title">🔍 Selección de Cotización Requerida: ${po.order_id || ''}</div>
    
    <div class="alert-box">
      <div style="font-weight:700; margin-bottom:4px">⚠️ Acción Requerida</div>
      <div style="font-size:13px; color:#92400e">
        Se han recibido ${quotations.length} cotizaciones de diferentes proveedores. 
        Por favor, revisa y selecciona la cotización ganadora antes de proceder con la aprobación.
      </div>
    </div>
    
    <div class="meta">
      <div class="row"><div>Orden de Compra</div><div><strong>${po.order_id || 'N/A'}</strong></div></div>
      <div class="row"><div>Monto Estimado</div><div><strong>$${totalAmount.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></div></div>
      <div class="row"><div>Tipo</div><div><strong>${po.po_type || 'N/A'}</strong></div></div>
      <div class="row"><div>Cotizaciones Recibidas</div><div><strong>${quotations.length} proveedores</strong></div></div>
    </div>
    
    <!-- Quotation Comparison Table -->
    <div style="margin-top:16px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px">
      <div style="font-weight:700; margin-bottom:8px">Comparación de Cotizaciones</div>
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th style="text-align:right">Precio</th>
            <th style="text-align:right">Entrega</th>
            <th>Condiciones</th>
          </tr>
        </thead>
        <tbody>
          ${quotations.map((q: any) => {
            const lowestPrice = Math.min(...quotations.map((qt: any) => Number(qt.quoted_amount)))
            const fastestDelivery = Math.min(...quotations.filter((qt: any) => qt.delivery_days).map((qt: any) => Number(qt.delivery_days)))
            const isBestPrice = Number(q.quoted_amount) === lowestPrice
            const isFastest = q.delivery_days && Number(q.delivery_days) === fastestDelivery
            
            return `
            <tr class="${isBestPrice ? 'best-price' : isFastest ? 'fastest' : ''}">
              <td>
                ${q.supplier_name}
                ${isBestPrice ? ' 💰 Mejor Precio' : ''}
                ${isFastest ? ' ⚡ Más Rápido' : ''}
              </td>
              <td style="text-align:right">$${Number(q.quoted_amount).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
              <td style="text-align:right">${q.delivery_days ? q.delivery_days + ' días' : 'N/A'}</td>
              <td>${q.payment_terms || 'CONTADO'}</td>
            </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <p>Hola ${requesterName || ''}, por favor ingresa al sistema para revisar y seleccionar la mejor cotización:</p>
    <p>
      <a class="btn" href="${viewUrl}">Revisar y Seleccionar Cotización</a>
    </p>
    
    <p style="color:#64748b; font-size:12px; margin-top:16px">
      Después de seleccionar la cotización, se enviará automáticamente un email de aprobación a los autorizadores correspondientes.
    </p>
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
      .select('id, order_id, total_amount, supplier, po_type, po_purpose, plant_id, requested_by')
      .eq('id', id)
      .single()
    if (poErr || !po) return new Response(JSON.stringify({ error: poErr?.message || 'PO not found' }), { status: 404 })

    // Get quotations for this PO
    const { data: quotations, error: quotErr } = await supabase
      .from('purchase_order_quotations')
      .select('supplier_name, quoted_amount, delivery_days, payment_terms, status')
      .eq('purchase_order_id', po.id)
      .order('quoted_amount', { ascending: true })

    if (quotErr || !quotations || quotations.length < 2) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No need to notify - less than 2 quotations' 
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Get requester information
    let requesterEmail: string | null = null
    let requesterName: string | null = null
    
    if (po.requested_by) {
      const { data: requester } = await supabase
        .from('profiles')
        .select('email, nombre, apellido')
        .eq('id', po.requested_by)
        .maybeSingle()
      
      if (requester?.email) {
        requesterEmail = requester.email
        requesterName = `${requester.nombre || ''} ${requester.apellido || ''}`.trim()
        
        // Get auth email
        const { data: users } = await supabase.auth.admin.listUsers()
        const found = users?.users?.find((u: any) => u.id === po.requested_by)
        if (found?.email) requesterEmail = found.email
      }
    }

    if (!requesterEmail) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No requester email found' 
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    const baseUrl = FRONTEND_URL.replace(/\/+$/, '')
    const viewUrl = `${baseUrl}/compras/${po.id}`
    const html = buildQuotationSelectionEmailHtml(po, requesterName || '', viewUrl, quotations)

    // Send email via SendGrid
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: requesterEmail }],
          tracking_settings: {
            click_tracking: { enable: false, enable_text: false },
            open_tracking: { enable: false },
          },
        }],
        from: { email: SENDGRID_FROM },
        subject: `🔍 Seleccionar Cotización: OC ${po.order_id || ''} (${quotations.length} proveedores)`,
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
        user_id: po.requested_by,
        title: 'Selección de Cotización (falló envío de email)',
        message: `PO ${po.order_id || ''} → ${requesterEmail} | error: ${errText.slice(0, 500)}`,
        type: 'QUOTATION_SELECTION_EMAIL',
        related_entity: 'purchase_order',
        entity_id: po.id,
      })
    } else {
      await supabase.from('notifications').insert({
        user_id: po.requested_by,
        title: 'Selección de Cotización (email enviado)',
        message: `PO ${po.order_id || ''} requiere selección entre ${quotations.length} proveedores → ${requesterEmail}`,
        type: 'QUOTATION_SELECTION_EMAIL',
        related_entity: 'purchase_order',
        entity_id: po.id,
      })
    }

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('Function error', e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
  }
})
