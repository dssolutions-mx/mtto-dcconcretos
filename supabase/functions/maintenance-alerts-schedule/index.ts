import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!

const FROM_EMAIL = 'juan.aguirre@dssolutions-mx.com'
const FROM_NAME = 'DASHBOARD DE MANTENIMIENTO'
const RECIPIENT_EMAIL = 'juan.aguirre@dssolutions-mx.com'

function formatDate(d?: string | null) {
  if (!d) return '-'
  try {
    const date = new Date(d)
    return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit' }).format(date)
  } catch {
    return d as string
  }
}

function formatDateForDisplay(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}

function buildEmail(alerts: any[]) {
  const today = formatDateForDisplay(new Date())
  const critical = alerts.filter(a => a.risk_level === 'OVERDUE' || a.risk_level === 'CRITICAL')
  const others = alerts.filter(a => a.risk_level !== 'OVERDUE' && a.risk_level !== 'CRITICAL')

  const list = (items: any[]) => {
    if (!items || items.length === 0) return `<div style="padding:12px;background:#F8FAFC;border-radius:6px;color:#64748B;">Sin registros</div>`
    return `
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Activo</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Plan</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Planta</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Unidad</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Horas/Km actuales</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Último servicio</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Restante</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Vencido por</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(a => {
            const unit = a.maintenance_unit
            const current = unit === 'hours' ? (a.current_asset_hours ?? '-') + ' h' : (a.current_asset_kilometers ?? '-') + ' km'
            const last = unit === 'hours'
              ? `${formatDate(a.last_service_date)} (${a.last_service_hours ?? '-'} h)`
              : `${formatDate(a.last_service_date)} (${a.last_service_kilometers ?? '-'} km)`
            const remaining = unit === 'hours'
              ? (a.hours_until_due ?? '-') + ' h' 
              : (a.kilometers_until_due ?? '-') + ' km'
            const overdue = a.overdue_amount && a.overdue_amount > 0
              ? (unit === 'hours' ? `${a.overdue_amount} h` : `${a.overdue_amount} km`)
              : '-'
            return `
            <tr>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;"><strong>${a.asset_name}</strong><br><span style="font-size:12px;color:#64748B;">${a.asset_code}</span></td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${a.maintenance_type}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${a.plant_name || '-'}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${unit}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${current}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${last}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${remaining}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;color:${a.risk_level==='OVERDUE'?'#DC2626':'#64748B'};">${overdue}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    `
  }

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;background:#F8FAFC;color:#334155;">
    <div style="max-width:900px;margin:0 auto;background:#fff;box-shadow:0 4px 6px rgba(0,0,0,.08)">
      <div style="background:#0C4A6E;color:#fff;padding:24px 28px;border-bottom:5px solid #0369A1;">
        <h1 style="margin:0;font-size:22px;">Alertas de Mantenimiento</h1>
        <p style="margin:6px 0 0 0;color:#BAE6FD;">${today}</p>
      </div>

      <div style="padding:24px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px;">
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:#DC2626;">${critical.length}</div>
            <div style="font-size:12px;color:#64748B;">Críticos / Vencidos</div>
          </div>
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:#0369A1;">${alerts.length}</div>
            <div style="font-size:12px;color:#64748B;">Total en ventana (30 días)</div>
          </div>
        </div>

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">Críticos / Vencidos</h3>
        ${list(critical)}

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">Próximos (<= 30 días)</h3>
        ${list(others)}
      </div>

      <div style="background:#F1F5F9;padding:16px;text-align:center;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:12px;color:#64748B;">© 2025 Dashboard de Mantenimiento</p>
      </div>
    </div>
  </body>
  </html>
  `
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabase.rpc('get_maintenance_alerts_report')
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })

    const alerts = data || []
    const shouldSend = alerts.length > 0 || (new URL(req.url).searchParams.get('force') === 'true')
    if (!shouldSend) return new Response(JSON.stringify({ success: true, message: 'No alerts to send' }), { headers: { 'Content-Type': 'application/json' } })

    const emailContent = buildEmail(alerts)
    const payload = {
      personalizations: [{ to: [{ email: RECIPIENT_EMAIL }], subject: `Alertas de Mantenimiento` }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      content: [{ type: 'text/html', value: emailContent }]
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const t = await res.text()
      await supabase.from('notifications').insert({
        user_id: null,
        title: 'Maintenance Alerts Failed',
        message: t.slice(0, 200),
        type: 'MAINTENANCE_ALERTS_ERROR',
        related_entity: 'system',
        priority: 'high'
      })
      return new Response(JSON.stringify({ error: 'Email send failed', details: t }), { status: 500 })
    }

    await supabase.from('notifications').insert({
      user_id: null,
      title: 'Maintenance Alerts Sent',
      message: 'Maintenance alerts email sent',
      type: 'MAINTENANCE_ALERTS',
      related_entity: 'system',
      priority: 'medium'
    })

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Internal error', details: e?.message || String(e) }), { status: 500 })
  }
})
