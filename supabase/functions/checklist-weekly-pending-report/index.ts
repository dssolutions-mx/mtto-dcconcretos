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

// Mexico timezone helpers (GMT-6)
const TIMEZONE_OFFSET = -6 * 60 * 60 * 1000
function getMexicoDate(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utc + TIMEZONE_OFFSET)
}

function formatDateForDB(date = new Date()) {
  const mexicoDate = getMexicoDate(date)
  const year = mexicoDate.getFullYear()
  const month = String(mexicoDate.getMonth() + 1).padStart(2, '0')
  const day = String(mexicoDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeekMondayMX(date = new Date()) {
  const d = getMexicoDate(date)
  const day = d.getDay() === 0 ? 7 : d.getDay() // 1..7 (Mon..Sun)
  const diff = day - 1
  const monday = new Date(d)
  monday.setDate(d.getDate() - diff)
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate())
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDateForDisplay(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).format(date)
}

function buildEmail(week: { date: string; pending: any[]; all: any[] }[], consolidated: any[]) {
  const weekRange = `${formatDateForDisplay(new Date(week[0].date + 'T12:00:00'))} - ${formatDateForDisplay(new Date(week[week.length - 1].date + 'T12:00:00'))}`

  const dailySections = week.map(({ date, pending }) => {
    const dt = formatDateForDisplay(new Date(date + 'T12:00:00'))
    const rows = pending.map((p: any) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #E2E8F0;">
          <strong>${p.asset_name}</strong><br><span style="font-size:12px;color:#64748B;">${p.asset_code || ''}</span>
        </td>
        <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${p.checklist_name}</td>
        <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${p.assigned_technician || 'No asignado'}</td>
        <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${p.plant_name || '-'}</td>
      </tr>
    `).join('')
    return `
      <h3 style="color:#0C4A6E;border-bottom:2px solid #E0F2FE;padding-bottom:6px;">${dt}</h3>
      <div style="margin-bottom:16px;color:#64748B;">Pendientes: <strong>${pending.length}</strong></div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Activo</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Checklist</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Técnico</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Planta</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="4" style="padding:12px;color:#64748B;">Sin pendientes</td></tr>`}
        </tbody>
      </table>
    `
  }).join('\n')

  const consolidatedRows = consolidated.map((p: any) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #E2E8F0;"><strong>${p.asset_name}</strong><br><span style="font-size:12px;color:#64748B;">${p.asset_code || ''}</span></td>
      <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${p.checklist_name}</td>
      <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${p.assigned_technician || 'No asignado'}</td>
      <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${p.plant_name || '-'}</td>
    </tr>
  `).join('')

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;background:#F8FAFC;color:#334155;">
    <div style="max-width:900px;margin:0 auto;background:#fff;box-shadow:0 4px 6px rgba(0,0,0,.08)">
      <div style="background:#0C4A6E;color:#fff;padding:24px 28px;border-bottom:5px solid #0369A1;">
        <h1 style="margin:0;font-size:22px;">Pendientes de Checklists - Semana</h1>
        <p style="margin:6px 0 0 0;color:#BAE6FD;">${weekRange}</p>
      </div>
      <div style="padding:24px;">
        <h2 style="color:#0C4A6E;margin:0 0 12px 0;font-size:18px;">Resumen Consolidado</h2>
        <div style="margin-bottom:16px;color:#64748B;">Pendientes al cierre de semana (viernes): <strong>${consolidated.length}</strong></div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
          <thead>
            <tr style="background:#F8FAFC;">
              <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Activo</th>
              <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Checklist</th>
              <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Técnico</th>
              <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Planta</th>
            </tr>
          </thead>
          <tbody>
            ${consolidatedRows || `<tr><td colspan="4" style="padding:12px;color:#64748B;">Sin pendientes al cierre de semana</td></tr>`}
          </tbody>
        </table>

        <h2 style="color:#0C4A6E;margin:24px 0 12px 0;font-size:18px;">Detalle por día</h2>
        ${dailySections}
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
    const dateParam = url.searchParams.get('date') // Friday of the week (YYYY-MM-DD)
    const forceSend = url.searchParams.get('force') === 'true'

    const runDate = dateParam ? new Date(dateParam + 'T12:00:00') : getMexicoDate()
    const monday = startOfWeekMondayMX(runDate)
    // Build Monday..Friday dates
    const days: string[] = []
    for (let i = 0; i < 5; i++) days.push(formatDateForDB(addDays(monday, i)))

    // Fetch per-day data using existing morning report RPC
    const weekData: { date: string; pending: any[]; all: any[] }[] = []
    for (const d of days) {
      const { data, error } = await supabase.rpc('get_daily_checklist_morning_report', { target_date: d })
      if (error) {
        return new Response(JSON.stringify({ error: 'DB error', details: error.message }), { status: 400 })
      }
      const all = data || []
      const pending = (all as any[]).filter(r => r.status === 'pendiente')
      weekData.push({ date: d, pending, all })
    }

    // Consolidated: still pending on Friday
    const friday = days[4]
    const fridayPending = (weekData[4]?.pending || []) as any[]
    const fridayKey = new Set(fridayPending.map(p => `${p.asset_name}|${p.checklist_name}`))
    const consolidated: any[] = []
    const seen = new Set<string>()
    for (const { pending } of weekData) {
      for (const p of pending) {
        const key = `${p.asset_name}|${p.checklist_name}`
        if (fridayKey.has(key) && !seen.has(key)) {
          consolidated.push(p)
          seen.add(key)
        }
      }
    }

    // Determine if we should send: any weekly pending or forced
    const totalWeeklyPending = weekData.reduce((acc, d) => acc + d.pending.length, 0)
    const shouldSend = totalWeeklyPending > 0 || forceSend
    if (!shouldSend) {
      return new Response(JSON.stringify({ success: true, message: 'No weekly pending checklists' }), { headers: { 'Content-Type': 'application/json' } })
    }

    const emailContent = buildEmail(weekData, consolidated)
    const payload = {
      personalizations: [{ to: buildRecipients(), subject: `Pendientes de Checklists - Semana (${days[0]} a ${days[4]})` }],
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
        title: 'Weekly Pending Checklists Failed',
        message: t.slice(0, 200),
        type: 'WEEKLY_PENDING_CHECKLISTS_ERROR',
        related_entity: 'system',
        priority: 'high'
      })
      return new Response(JSON.stringify({ error: 'Email send failed', details: t }), { status: 500 })
    }

    await supabase.from('notifications').insert({
      user_id: null,
      title: 'Weekly Pending Checklists Sent',
      message: `Range ${days[0]} to ${days[4]}`,
      type: 'WEEKLY_PENDING_CHECKLISTS',
      related_entity: 'system',
      priority: 'medium'
    })

    return new Response(JSON.stringify({ success: true, range: { from: days[0], to: days[4] }, totals: weekData.map(d => ({ date: d.date, pending: d.pending.length })) }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Internal error', details: e?.message || String(e) }), { status: 500 })
  }
})


