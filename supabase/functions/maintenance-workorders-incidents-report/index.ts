import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!

const FROM_EMAIL = 'juan.aguirre@dssolutions-mx.com'
const FROM_NAME = 'DASHBOARD DE MANTENIMIENTO'

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

interface Recipient {
  email: string
  role: string
  business_unit_id: string | null
  plant_id: string | null
  name: string
}

async function getRecipients(supabase: any): Promise<Recipient[]> {
  const recipients: Recipient[] = []
  
  try {
    // Get General Managers
    const { data: gmProfiles, error: gmError } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, email')
      .eq('role', 'GERENCIA_GENERAL')
      .eq('status', 'active')
    
    if (gmError) {
      console.error('Error fetching GM profiles:', gmError)
    }
    
    // Get BU Managers
    const { data: buProfiles, error: buError } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, email, business_unit_id')
      .eq('role', 'JEFE_UNIDAD_NEGOCIO')
      .eq('status', 'active')
    
    if (buError) {
      console.error('Error fetching BU profiles:', buError)
    }
    
    // Get Plant Managers (JEFE_PLANTA)
    const { data: plantProfiles, error: plantError } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, email, plant_id, business_unit_id')
      .eq('role', 'JEFE_PLANTA')
      .eq('status', 'active')
    
    if (plantError) {
      console.error('Error fetching Plant profiles:', plantError)
    }
    
    // Get emails from auth.users (try/catch in case admin API not available)
    let usersById = new Map<string, any>()
    try {
      const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
      if (!authError && users) {
        users.forEach((u: any) => usersById.set(u.id, u))
      } else if (authError) {
        console.error('Error fetching auth users:', authError)
      }
    } catch (e) {
      console.error('Exception fetching auth users:', e)
    }
    
    // Process General Managers
    if (gmProfiles && gmProfiles.length > 0) {
      for (const profile of gmProfiles) {
        const user = usersById.get(profile.id)
        const email = user?.email || profile.email
        if (email) {
          recipients.push({
            email: email,
            role: 'GERENCIA_GENERAL',
            business_unit_id: null,
            plant_id: null,
            name: `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || 'Gerente General'
          })
        }
      }
    }
    
    // Process BU Managers
    if (buProfiles && buProfiles.length > 0) {
      for (const profile of buProfiles) {
        const user = usersById.get(profile.id)
        const email = user?.email || profile.email
        if (email && profile.business_unit_id) {
          recipients.push({
            email: email,
            role: 'JEFE_UNIDAD_NEGOCIO',
            business_unit_id: profile.business_unit_id,
            plant_id: null,
            name: `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || 'Jefe de Unidad'
          })
        }
      }
    }
    
    // Process Plant Managers
    if (plantProfiles && plantProfiles.length > 0) {
      for (const profile of plantProfiles) {
        const user = usersById.get(profile.id)
        const email = user?.email || profile.email
        if (email && profile.plant_id) {
          recipients.push({
            email: email,
            role: 'JEFE_PLANTA',
            business_unit_id: profile.business_unit_id,
            plant_id: profile.plant_id,
            name: `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || 'Jefe de Planta'
          })
        }
      }
    }
    
    console.log(`Found ${recipients.length} recipients:`, recipients.map(r => ({
      email: r.email,
      role: r.role
    })))
  } catch (e) {
    console.error('Error in getRecipients:', e)
  }
  
  return recipients
}

function filterReportByRecipient(report: any, recipient: Recipient): any {
  const filtered = {
    total_work_orders_created: 0,
    total_work_orders_completed: 0,
    total_incidents_created: 0,
    work_orders_created: [] as any[],
    work_orders_completed: [] as any[],
    incidents_created: [] as any[],
    purchase_orders_pending: [] as any[]
  }
  
  // GERENCIA_GENERAL gets everything
  if (recipient.role === 'GERENCIA_GENERAL') {
    filtered.work_orders_created = report.work_orders_created || []
    filtered.work_orders_completed = report.work_orders_completed || []
    filtered.incidents_created = report.incidents_created || []
    filtered.purchase_orders_pending = report.purchase_orders_pending || []
  }
  // JEFE_UNIDAD_NEGOCIO gets only their business unit
  else if (recipient.role === 'JEFE_UNIDAD_NEGOCIO' && recipient.business_unit_id) {
    filtered.work_orders_created = (report.work_orders_created || []).filter(
      (wo: any) => wo.business_unit_id === recipient.business_unit_id
    )
    filtered.work_orders_completed = (report.work_orders_completed || []).filter(
      (wo: any) => wo.business_unit_id === recipient.business_unit_id
    )
    filtered.incidents_created = (report.incidents_created || []).filter(
      (inc: any) => inc.business_unit_id === recipient.business_unit_id
    )
    // Filter purchase orders by work order business unit
    const woIds = new Set([
      ...filtered.work_orders_created.map((wo: any) => wo.id),
      ...filtered.work_orders_completed.map((wo: any) => wo.id)
    ])
    filtered.purchase_orders_pending = (report.purchase_orders_pending || []).filter(
      (po: any) => woIds.has(po.work_order_id)
    )
  }
  // JEFE_PLANTA gets only their plant
  else if (recipient.role === 'JEFE_PLANTA' && recipient.plant_id) {
    filtered.work_orders_created = (report.work_orders_created || []).filter(
      (wo: any) => wo.plant_id === recipient.plant_id
    )
    filtered.work_orders_completed = (report.work_orders_completed || []).filter(
      (wo: any) => wo.plant_id === recipient.plant_id
    )
    filtered.incidents_created = (report.incidents_created || []).filter(
      (inc: any) => inc.plant_id === recipient.plant_id
    )
    // Filter purchase orders by work order plant
    const woIds = new Set([
      ...filtered.work_orders_created.map((wo: any) => wo.id),
      ...filtered.work_orders_completed.map((wo: any) => wo.id)
    ])
    filtered.purchase_orders_pending = (report.purchase_orders_pending || []).filter(
      (po: any) => woIds.has(po.work_order_id)
    )
  }
  
  // Update counts
  filtered.total_work_orders_created = filtered.work_orders_created.length
  filtered.total_work_orders_completed = filtered.work_orders_completed.length
  filtered.total_incidents_created = filtered.incidents_created.length
  
  return filtered
}

function buildEmail(report: any, targetDate: string, recipientName: string) {
  const dateStr = formatDateForDisplay(getMexicoDate(new Date(targetDate + 'T12:00:00')))
  const woCreated = report.work_orders_created || []
  const woCompleted = report.work_orders_completed || []
  const incidents = report.incidents_created || []
  const poPending = report.purchase_orders_pending || []

  // Helper function to format maintenance interval display
  const formatMaintenanceInterval = (item: any): string => {
    if (!item.maintenance_interval_name) return '-'
    const value = item.maintenance_interval_value || ''
    const type = item.maintenance_interval_type || ''
    const name = item.maintenance_interval_name || ''
    if (value && type) {
      return `${name} (${value} ${type})`
    }
    return name || '-'
  }

  const list = (items: any[], cols: { key: string; label: string; formatter?: (item: any) => string }[]) => {
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
              ${cols.map(c => {
                const value = c.formatter ? c.formatter(it) : (it[c.key] ?? '-')
                return `<td style="padding:10px;border-bottom:1px solid #E2E8F0;">${value}</td>`
              }).join('')}
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
        <p style="margin:6px 0 0 0;color:#BAE6FD;">${dateStr} - ${recipientName}</p>
      </div>

      <div style="padding:24px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px;">
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:#0369A1;">${report.total_work_orders_created || 0}</div>
            <div style="font-size:12px;color:#64748B;">OT preventivas creadas</div>
          </div>
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:#10B981;">${report.total_work_orders_completed || 0}</div>
            <div style="font-size:12px;color:#64748B;">OT preventivas completadas</div>
          </div>
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:${(report.total_incidents_created||0)>0?'#F59E0B':'#64748B'};">${report.total_incidents_created || 0}</div>
            <div style="font-size:12px;color:#64748B;">Incidentes</div>
          </div>
        </div>

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">OT preventivas creadas hoy</h3>
        ${list(woCreated,[
          {key:'order_id',label:'OT'},
          {key:'asset_id',label:'Activo'},
          {key:'type',label:'Tipo'},
          {key:'maintenance_interval_name',label:'Intervalo de Mantenimiento',formatter:formatMaintenanceInterval},
          {key:'priority',label:'Prioridad'},
          {key:'status',label:'Estado'},
          {key:'planned_date',label:'Planificada'},
          {key:'creator_name',label:'Creado por'}
        ])}

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">OT preventivas completadas hoy</h3>
        ${list(woCompleted,[
          {key:'order_id',label:'OT'},
          {key:'asset_id',label:'Activo'},
          {key:'type',label:'Tipo'},
          {key:'maintenance_interval_name',label:'Intervalo de Mantenimiento',formatter:formatMaintenanceInterval},
          {key:'total_cost',label:'Costo Total'},
          {key:'completed_at',label:'Fecha Cierre'},
          {key:'creator_name',label:'Creado por'}
        ])}

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">Incidentes del día</h3>
        ${list(incidents,[
          {key:'asset_id',label:'Activo'},
          {key:'type',label:'Tipo'},
          {key:'description',label:'Descripción'},
          {key:'status',label:'Estado'},
          {key:'creator_name',label:'Creado por'}
        ])}

        <h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">OC pendientes (ligadas a OT preventivas de hoy)</h3>
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

    // Get all report data
    const { data, error } = await supabase.rpc('get_daily_work_orders_incidents_report', { target_date: targetDate })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 })

    const fullReport = (data && data[0]) || {
      total_work_orders_created: 0,
      total_work_orders_completed: 0,
      total_incidents_created: 0,
      work_orders_created: [],
      work_orders_completed: [],
      incidents_created: [],
      purchase_orders_pending: []
    }

    // Get recipients
    const recipients = await getRecipients(supabase)
    if (recipients.length === 0) {
      console.log('No recipients found')
      return new Response(JSON.stringify({
        success: true,
        message: 'No recipients to send to'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Send emails to each recipient with filtered data
    const results = []
    for (const recipient of recipients) {
      // Filter report data based on recipient role
      const filteredReport = filterReportByRecipient(fullReport, recipient)
      
      // Check if we should send - only send if there's actual content (ignore force flag)
      const hasContent = (filteredReport.total_work_orders_created + filteredReport.total_work_orders_completed + filteredReport.total_incidents_created) > 0
      if (!hasContent) {
        console.log(`Skipping ${recipient.email} - no data`)
        continue
      }

      const emailContent = buildEmail(filteredReport, targetDate, recipient.name)
      const payload = {
        personalizations: [{
          to: [{ email: recipient.email }],
          subject: `OT + Incidentes - ${targetDate}`
        }],
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
        console.error(`Failed to send email to ${recipient.email}:`, t)
        await supabase.from('notifications').insert({
          user_id: null,
          title: 'WO+Incidents Report Failed',
          message: `Failed to send to ${recipient.email}: ${t.slice(0, 200)}`,
          type: 'WO_INCIDENTS_REPORT_ERROR',
          related_entity: 'system',
          priority: 'high'
        })
        results.push({
          recipient: recipient.email,
          success: false,
          error: t
        })
      } else {
        console.log(`Email sent successfully to ${recipient.email}`)
        results.push({
          recipient: recipient.email,
          success: true
        })
      }
    }

    await supabase.from('notifications').insert({
      user_id: null,
      title: 'WO+Incidents Report Sent',
      message: `Sent to ${results.filter(r => r.success).length} recipients for ${targetDate}`,
      type: 'WO_INCIDENTS_REPORT',
      related_entity: 'system',
      priority: 'medium'
    })

    return new Response(JSON.stringify({
      success: true,
      date: targetDate,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Internal error', details: e?.message || String(e) }), { status: 500 })
  }
})
