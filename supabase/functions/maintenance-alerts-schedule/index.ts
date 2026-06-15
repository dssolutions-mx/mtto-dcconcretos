import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  computeCyclicIntervalResults,
  parseMaintenanceUnitString,
  selectCyclicSummaryInterval,
} from '../../../lib/utils/cyclic-maintenance.ts'


const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!

const FROM_EMAIL = 'juan.aguirre@dssolutions-mx.com'
const FROM_NAME = 'DASHBOARD DE MANTENIMIENTO'

interface Recipient {
  email: string
  role: string
  business_unit_id: string | null
  name: string
}

interface MaintenanceAlert {
  asset_id: string
  asset_code: string
  asset_name: string
  plant_id: string
  plant_name: string
  business_unit_id: string | null
  maintenance_unit: string
  current_hours?: number
  current_kilometers?: number
  maintenance_plan_name: string | null
  interval_value?: number
  last_service_date: string | null
  last_service_hours?: number
  last_service_kilometers?: number
  last_service_interval_value?: number
  hours_remaining?: number
  kilometers_remaining?: number
  hours_overdue?: number
  kilometers_overdue?: number
}

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

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '-'
  return new Intl.NumberFormat('es-MX').format(num)
}

function buildEmail(alerts: MaintenanceAlert[], recipientName: string) {
  const today = formatDateForDisplay(new Date())
  const overdue = alerts.filter(a => (a.hours_overdue !== undefined && a.hours_overdue > 0) || (a.kilometers_overdue !== undefined && a.kilometers_overdue > 0))
  const upcoming = alerts.filter(a => !((a.hours_overdue !== undefined && a.hours_overdue > 0) || (a.kilometers_overdue !== undefined && a.kilometers_overdue > 0)))

  const list = (items: MaintenanceAlert[]) => {
    if (!items || items.length === 0) return `<div style="padding:12px;background:#F8FAFC;border-radius:6px;color:#64748B;">Sin registros</div>`
    return `
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Activo</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Plan de Mantenimiento</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Planta</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Unidad</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Horas/Km Actuales</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Último Servicio</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Restante</th>
            <th style="text-align:left;padding:10px;color:#64748B;border-bottom:2px solid #E2E8F0;">Vencido por</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(a => {
            const unit = a.maintenance_unit
            const isOverdue = (a.hours_overdue !== undefined && a.hours_overdue > 0) || (a.kilometers_overdue !== undefined && a.kilometers_overdue > 0)
            const current = unit === 'hours' 
              ? (a.current_hours !== undefined ? formatNumber(a.current_hours) + ' h' : '-')
              : (a.current_kilometers !== undefined ? formatNumber(a.current_kilometers) + ' km' : '-')
            
            let lastServiceHtml = '-'
            if (a.last_service_date) {
              const dateStr = formatDate(a.last_service_date)
              const valueStr = unit === 'hours'
                ? (a.last_service_hours !== undefined ? formatNumber(a.last_service_hours) + ' h' : '')
                : (a.last_service_kilometers !== undefined ? formatNumber(a.last_service_kilometers) + ' km' : '')
              const intervalStr = a.last_service_interval_value !== undefined && a.last_service_interval_value !== null
                ? `<div style="font-size:11px;font-weight:600;color:#2563EB;margin-top:2px;">Intervalo: ${formatNumber(a.last_service_interval_value)} ${unit === 'hours' ? 'h' : 'km'}</div>`
                : ''
              lastServiceHtml = `
                <div>
                  <div style="font-size:13px;">${dateStr}</div>
                  ${valueStr ? `<div style="font-size:11px;color:#64748B;">${valueStr}</div>` : ''}
                  ${intervalStr}
                </div>
              `
            }
            
            const remaining = unit === 'hours'
              ? (a.hours_remaining !== undefined ? formatNumber(a.hours_remaining) + ' h' : '-')
              : (a.kilometers_remaining !== undefined ? formatNumber(a.kilometers_remaining) + ' km' : '-')
            
            const overdue = unit === 'hours'
              ? (a.hours_overdue !== undefined && a.hours_overdue > 0 ? formatNumber(a.hours_overdue) + ' h' : '-')
              : (a.kilometers_overdue !== undefined && a.kilometers_overdue > 0 ? formatNumber(a.kilometers_overdue) + ' km' : '-')
            
            return `
            <tr style="${isOverdue ? 'background-color:#FFEBEE;' : ''}">
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;"><strong>${a.asset_name || '-'}</strong><br><span style="font-size:12px;color:#64748B;">${a.asset_code || '-'}</span></td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${a.maintenance_plan_name || 'N/A'}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${a.plant_name || '-'}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${unit === 'hours' ? 'Horas' : 'Kilómetros'}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${current}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${lastServiceHtml}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;color:${remaining !== '-' ? '#10B981' : '#64748B'};">${remaining}</td>
              <td style="padding:10px;border-bottom:1px solid #E2E8F0;color:${isOverdue ? '#DC2626' : '#64748B'};font-weight:${isOverdue ? '600' : 'normal'};">${overdue}</td>
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
        <p style="margin:6px 0 0 0;color:#BAE6FD;">${today} - ${recipientName}</p>
      </div>

      <div style="padding:24px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px;">
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:#DC2626;">${overdue.length}</div>
            <div style="font-size:12px;color:#64748B;">Vencidos</div>
          </div>
          <div style="text-align:center;background:#F1F5F9;border-radius:8px;padding:14px;">
            <div style="font-size:22px;font-weight:700;color:#0369A1;">${alerts.length}</div>
            <div style="font-size:12px;color:#64748B;">Total de Activos</div>
          </div>
        </div>

        ${overdue.length > 0 ? `<h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">Vencidos</h3>${list(overdue)}` : ''}

        ${upcoming.length > 0 ? `<h3 style="color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-top:20px;">Próximos</h3>${list(upcoming)}` : ''}
      </div>

      <div style="background:#F1F5F9;padding:16px;text-align:center;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:12px;color:#64748B;">© 2025 Dashboard de Mantenimiento</p>
      </div>
    </div>
  </body>
  </html>
  `
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
    
    // Get BU Managers (JEFE_UNIDAD_NEGOCIO)
    const { data: buProfiles, error: buError } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, email, business_unit_id')
      .eq('role', 'JEFE_UNIDAD_NEGOCIO')
      .eq('status', 'active')
    
    if (buError) {
      console.error('Error fetching BU profiles:', buError)
    }

    // Get Maintenance Managers (GERENTE_MANTENIMIENTO) - BU scoped maintenance authority
    const { data: gerenteProfiles, error: gerenteError } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, email, business_unit_id')
      .or('role.eq.GERENTE_MANTENIMIENTO,business_role.eq.GERENTE_MANTENIMIENTO')
      .eq('status', 'active')

    if (gerenteError) {
      console.error('Error fetching Gerente Mantenimiento profiles:', gerenteError)
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
        // Try auth.users email first, fallback to profile.email
        const user = usersById.get(profile.id)
        const email = user?.email || profile.email
        if (email) {
          recipients.push({
            email: email,
            role: 'GERENCIA_GENERAL',
            business_unit_id: null,
            name: `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || 'Gerente General'
          })
        }
      }
    }
    
    // Process BU Managers
    if (buProfiles && buProfiles.length > 0) {
      for (const profile of buProfiles) {
        // Try auth.users email first, fallback to profile.email
        const user = usersById.get(profile.id)
        const email = user?.email || profile.email
        if (email && profile.business_unit_id) {
          recipients.push({
            email: email,
            role: 'JEFE_UNIDAD_NEGOCIO',
            business_unit_id: profile.business_unit_id,
            name: `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || 'Jefe de Unidad'
          })
        }
      }
    }

    // Process Maintenance Managers (GERENTE_MANTENIMIENTO) - GLOBAL scope
    // They oversee the entire company, so they receive all maintenance alerts.
    if (gerenteProfiles && gerenteProfiles.length > 0) {
      for (const profile of gerenteProfiles) {
        const user = usersById.get(profile.id)
        const email = user?.email || profile.email
        if (email) {
          recipients.push({
            email: email,
            role: 'GERENTE_MANTENIMIENTO',
            business_unit_id: null,
            name: `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || 'Gerente de Mantenimiento'
          })
        }
      }
    }
    
    console.log(`Found ${recipients.length} recipients:`, recipients.map(r => ({ email: r.email, role: r.role })))
  } catch (e) {
    console.error('Error in getRecipients:', e)
  }
  
  return recipients
}

// Replicate the exact calculation logic from asset-maintenance-summary API
async function calculateMaintenanceSummary(supabase: any): Promise<MaintenanceAlert[]> {
  // Fetch all assets with their models and plants
  const { data: businessUnitsRaw } = await supabase
    .from('business_units')
    .select(`
      id, name,
      plants:plants(
        id, name, business_unit_id,
        assets:assets(
          id, asset_id, name, plant_id, model_id,
          current_hours, current_kilometers,
          equipment_models(
            id, name, maintenance_unit
          )
        )
      )
    `)
    .order('name')
  
  // Build flat asset list
  const assets: any[] = []
  for (const bu of (businessUnitsRaw || [])) {
    for (const plant of (bu.plants || [])) {
      for (const asset of (plant.assets || [])) {
        assets.push({
          id: asset.id,
          asset_code: asset.asset_id,
          asset_name: asset.name,
          plant_id: asset.plant_id,
          plant_name: plant.name,
          business_unit_id: plant.business_unit_id,
          model_id: asset.model_id,
          current_hours: asset.current_hours || 0,
          current_kilometers: asset.current_kilometers || 0,
          maintenance_unit: (asset as any).equipment_models?.maintenance_unit || 'hours'
        })
      }
    }
  }
  
  if (assets.length === 0) {
    return []
  }
  
  // Get model IDs and fetch intervals
  const modelIds = Array.from(new Set(assets.map(a => a.model_id).filter(Boolean)))
  const { data: maintenanceIntervals } = await supabase
    .from('maintenance_intervals')
    .select('id, model_id, interval_value, name, type, is_first_cycle_only, is_recurring')
    .in('model_id', modelIds)
  
  // Group intervals by model_id
  const intervalsByModel = new Map<string, any[]>()
  ;(maintenanceIntervals || []).forEach(interval => {
    if (!interval.model_id) return
    if (!intervalsByModel.has(interval.model_id)) {
      intervalsByModel.set(interval.model_id, [])
    }
    intervalsByModel.get(interval.model_id)!.push(interval)
  })
  
  // Fetch maintenance history
  const assetIds = assets.map(a => a.id)
  const { data: maintenanceHistory } = await supabase
    .from('maintenance_history')
    .select('asset_id, maintenance_plan_id, hours, kilometers, date, type')
    .in('asset_id', assetIds)
    .or('type.eq.preventive,type.eq.Preventivo,type.eq.preventivo')
    .not('maintenance_plan_id', 'is', null)
    .order('date', { ascending: false })
  
  // Process each asset
  const alerts: MaintenanceAlert[] = []
  
  for (const asset of assets) {
    const intervals = intervalsByModel.get(asset.model_id || '') || []
    const assetMaintenanceHistory = (maintenanceHistory || []).filter(mh => mh.asset_id === asset.id)
    const maintenanceUnit = parseMaintenanceUnitString(asset.maintenance_unit)
    const currentValue =
      maintenanceUnit === 'hours'
        ? Number(asset.current_hours) || 0
        : Number(asset.current_kilometers) || 0

    let selectedInterval: any = null
    let lastServiceDate: string | null = null
    let lastServiceValue: number | null = null
    let lastServiceIntervalValue: number | null = null
    let hoursOverdue: number | undefined = undefined
    let kilometersOverdue: number | undefined = undefined
    let hoursRemaining: number | undefined = undefined
    let kilometersRemaining: number | undefined = undefined

    if (intervals.length > 0) {
      const intervalResults = computeCyclicIntervalResults({
        intervals,
        history: assetMaintenanceHistory,
        currentValue,
        unit: maintenanceUnit,
      })
      const selection = selectCyclicSummaryInterval({
        intervalResults,
        history: assetMaintenanceHistory,
        intervals,
        currentValue,
        unit: maintenanceUnit,
      })
      selectedInterval = selection.selectedInterval
      lastServiceDate = selection.lastServiceDate
      lastServiceValue = selection.lastServiceValue
      lastServiceIntervalValue = selection.lastServiceIntervalValue
      if (maintenanceUnit === 'hours') {
        hoursOverdue = selection.overdue
        hoursRemaining = selection.remaining
      } else {
        kilometersOverdue = selection.overdue
        kilometersRemaining = selection.remaining
      }
    }

    // Build maintenance plan name
    let maintenancePlanName: string | null = null
    if (selectedInterval) {
      const intervalValue = selectedInterval.interval_value || 0
      const unit = maintenanceUnit === 'hours' ? 'h' : 'km'
      const intervalName = selectedInterval.name || `${intervalValue} ${unit}`
      maintenancePlanName = intervalName
    }
    
    alerts.push({
      asset_id: asset.id,
      asset_code: asset.asset_code,
      asset_name: asset.asset_name,
      plant_id: asset.plant_id,
      plant_name: asset.plant_name,
      business_unit_id: asset.business_unit_id,
      maintenance_unit: maintenanceUnit,
      current_hours: maintenanceUnit === 'hours' ? asset.current_hours : undefined,
      current_kilometers: maintenanceUnit === 'kilometers' ? asset.current_kilometers : undefined,
      maintenance_plan_name: maintenancePlanName,
      interval_value: selectedInterval?.interval_value,
      last_service_date: lastServiceDate,
      last_service_hours: maintenanceUnit === 'hours' ? lastServiceValue : undefined,
      last_service_kilometers: maintenanceUnit === 'kilometers' ? lastServiceValue : undefined,
      last_service_interval_value: lastServiceIntervalValue,
      hours_remaining: hoursRemaining,
      kilometers_remaining: kilometersRemaining,
      hours_overdue: hoursOverdue,
      kilometers_overdue: kilometersOverdue
    })
  }
  
  return alerts
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Calculate maintenance summary using exact logic from API
    const allAlerts = await calculateMaintenanceSummary(supabase)
    
    // Get recipients
    const recipients = await getRecipients(supabase)
    
    if (recipients.length === 0) {
      console.log('No recipients found')
      return new Response(JSON.stringify({ success: true, message: 'No recipients to send to' }), { 
        headers: { 'Content-Type': 'application/json' } 
      })
    }
    
    // Send emails to each recipient
    const results = []
    for (const recipient of recipients) {
      // Filter alerts based on recipient role
      let filteredAlerts = allAlerts
      if (recipient.role === 'JEFE_UNIDAD_NEGOCIO' && recipient.business_unit_id) {
        filteredAlerts = allAlerts.filter(a => a.business_unit_id === recipient.business_unit_id)
      }
      // GERENCIA_GENERAL gets all alerts (no filtering)
      
      if (filteredAlerts.length === 0 && new URL(req.url).searchParams.get('force') !== 'true') {
        console.log(`Skipping ${recipient.email} - no alerts`)
        continue
      }
      
      const emailContent = buildEmail(filteredAlerts, recipient.name)
      const payload = {
        personalizations: [{ 
          to: [{ email: recipient.email }], 
          subject: `Alertas de Mantenimiento - ${formatDateForDisplay(new Date())}` 
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
          title: 'Maintenance Alerts Failed',
          message: `Failed to send to ${recipient.email}: ${t.slice(0, 200)}`,
          type: 'MAINTENANCE_ALERTS_ERROR',
          related_entity: 'system',
          priority: 'high'
        })
        results.push({ recipient: recipient.email, success: false, error: t })
      } else {
        console.log(`Email sent successfully to ${recipient.email}`)
        results.push({ recipient: recipient.email, success: true })
      }
    }
    
    await supabase.from('notifications').insert({
      user_id: null,
      title: 'Maintenance Alerts Sent',
      message: `Sent to ${results.filter(r => r.success).length} recipients`,
      type: 'MAINTENANCE_ALERTS',
      related_entity: 'system',
      priority: 'medium'
    })
    
    return new Response(JSON.stringify({ success: true, results }), { 
      headers: { 'Content-Type': 'application/json' } 
    })
  } catch (e: any) {
    console.error('Error:', e)
    return new Response(JSON.stringify({ error: 'Internal error', details: e?.message || String(e) }), { status: 500 })
  }
})
