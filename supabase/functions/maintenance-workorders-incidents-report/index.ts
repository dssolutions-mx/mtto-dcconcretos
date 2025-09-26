import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!

const FROM_EMAIL = 'juan.aguirre@dssolutions-mx.com'
const FROM_NAME = 'DASHBOARD DE MANTENIMIENTO'
const RECIPIENT_EMAIL = 'juan.aguirre@dssolutions-mx.com, mantenimientotij@dcconcretos.com.mx'

function buildRecipients(): { email: string }[] {
  const envTo = Deno.env.get('SENDGRID_TO')
  const raw: unknown = envTo ?? (RECIPIENT_EMAIL as unknown)
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(v => ({ email: String(v) }))
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((v: any) => ({ email: String(v) }))
    } catch {}
    return raw
      .split(/[;,]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(email => ({ email }))
  }
  return [{ email: String(raw || RECIPIENT_EMAIL) }]
}

const TIMEZONE_OFFSET = -6 * 60 * 60 * 1000
function getMexicoDate(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utc + TIMEZONE_OFFSET)
}
function formatDateForDB(date = new Date()) {
  const mx = getMexicoDate(date)
  const y = mx.getFullYear()
  const m = String(mx.getMonth() + 1).padStart(2, '0')
  const d = String(mx.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function formatDateForDisplay(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}

function buildEmail(report: any, targetDate: string) {
  const dateStr = formatDateForDisplay(getMexicoDate(new Date(targetDate + 'T12:00:00')))
  const woCreated = report.work_orders_created || []
  const woCompleted = report.work_orders_completed || []
  const woOverdue = report.work_orders_overdue || []
  const incidents = report.incidents_created || []
  const poPending = report.purchase_orders_pending || []

  const list = (items: any[], cols: { key: string; label: string }[]) => {
    if (!items || items.length === 0) return `<div style="padding:12px;background:#F8FAFC;border-radius:6px;color:#64748B;">Sin registros</div>`
    return `
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#F8FAFC;">
            ${cols.map(c => `<th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">${c.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr>
              ${cols.map(c => `<td style="padding:10px;border-bottom:1px solid #E2E8F0;">${it[c.key] ?? '-'}</td>`).join('')}
            </tr>
          `).join('')}
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
        <h1 style="margin:0;font-size:22px;">Órdenes de Trabajo + Incidentes</h1>
        <p style="margin:6px 0 0 0;color:#BAE6FD;">${dateStr}</p>
      </div>

      <div style="padding:24px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px;">
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:#0369A1;">${report.total_work_orders_created || 0}</div>
            <div style="font-size:12px;color:#64748B;">OT creadas</div>
          </div>
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:#10B981;">${report.total_work_orders_completed || 0}</div>
            <div style="font-size:12px;color:#64748B;">OT completadas</div>
          </div>
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:${(report.total_work_orders_overdue||0)>0?'#DC2626':'#10B981'};">${report.total_work_orders_overdue || 0}</div>
            <div style="font-size:12px;color:#64748B;">OT vencidas</div>
          </div>
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:${(report.total_incidents_created||0)>0?'#F59E0B':'#64748B'};">${report.total_incidents_created || 0}</div>
            <div style="font-size:12px;color:#64748B;">Incidentes</div>
          </div>
        </div>

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">OT creadas hoy</h3>
        ${list(woCreated,[
          {key:'order_id',label:'OT'},
          {key:'asset_name',label:'Activo'},
          {key:'type',label:'Tipo'},
          {key:'priority',label:'Prioridad'},
          {key:'status',label:'Estado'},
          {key:'planned_date',label:'Planificada'}
        ])}

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">OT completadas hoy</h3>
        ${list(woCompleted,[
          {key:'order_id',label:'OT'},
          {key:'asset_name',label:'Activo'},
          {key:'type',label:'Tipo'},
          {key:'total_cost',label:'Costo Total'},
          {key:'completed_at',label:'Fecha Cierre'}
        ])}

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">OT vencidas</h3>
        ${list(woOverdue,[
          {key:'order_id',label:'OT'},
          {key:'asset_name',label:'Activo'},
          {key:'priority',label:'Prioridad'},
          {key:'planned_date',label:'Planificada'},
          {key:'days_overdue',label:'Días Venc.'}
        ])}

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">Incidentes del día</h3>
        ${list(incidents,[
          {key:'id',label:'ID'},
          {key:'asset_name',label:'Activo'},
          {key:'type',label:'Tipo'},
          {key:'description',label:'Descripción'},
          {key:'status',label:'Estado'}
        ])}

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">OC pendientes (ligadas a OT de hoy / vencidas)</h3>
        ${list(poPending,[
          {key:'order_id',label:'OC'},
          {key:'work_order_id',label:'OT'},
          {key:'supplier',label:'Proveedor'},
          {key:'total_amount',label:'Monto'},
          {key:'expected_delivery_date',label:'Entrega Est.'}
        ])}
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
    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const forceSend = url.searchParams.get('force') === 'true'

    let targetDate: string
    if (dateParam) {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      if (!ok) return new Response(JSON.stringify({ error: 'Invalid date format' }), { status: 400 })
      targetDate = dateParam
    } else {
      targetDate = formatDateForDB(getMexicoDate())
    }

    const { data, error } = await supabase.rpc('get_daily_work_orders_incidents_report', { target_date: targetDate })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })

    const report = (data && data[0]) || {
      total_work_orders_created: 0,
      total_work_orders_completed: 0,
      total_work_orders_overdue: 0,
      total_incidents_created: 0,
      work_orders_created: [],
      work_orders_completed: [],
      work_orders_overdue: [],
      incidents_created: [],
      purchase_orders_pending: []
    }

    const shouldSend = (report.total_work_orders_created + report.total_work_orders_completed + report.total_work_orders_overdue + report.total_incidents_created) > 0 || forceSend
    if (!shouldSend) return new Response(JSON.stringify({ success: true, message: 'No data to send', date: targetDate }), { headers: { 'Content-Type': 'application/json' } })

    const emailContent = buildEmail(report, targetDate)
    const payload = {
      personalizations: [{ to: buildRecipients(), subject: `OT + Incidentes - ${targetDate}` }],
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
        title: 'WO+Incidents Report Failed',
        message: `Failed for ${targetDate}: ${t.slice(0, 200)}`,
        type: 'WO_INCIDENTS_REPORT_ERROR',
        related_entity: 'system',
        priority: 'high'
      })
      return new Response(JSON.stringify({ error: 'Email send failed', details: t }), { status: 500 })
    }

    await supabase.from('notifications').insert({
      user_id: null,
      title: 'WO+Incidents Report Sent',
      message: `Sent for ${targetDate}`,
      type: 'WO_INCIDENTS_REPORT',
      related_entity: 'system',
      priority: 'medium'
    })

    return new Response(JSON.stringify({ success: true, date: targetDate }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Internal error', details: e?.message || String(e) }), { status: 500 })
  }
})
