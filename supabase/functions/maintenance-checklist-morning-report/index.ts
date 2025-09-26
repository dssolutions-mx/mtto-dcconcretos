import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!

const FROM_EMAIL = "juan.aguirre@dssolutions-mx.com"
const FROM_NAME = "DASHBOARD DE MANTENIMIENTO"
const RECIPIENT_EMAIL = "juan.aguirre@dssolutions-mx.com, mantenimientotij@dcconcretos.com.mx"

// Build recipients array robustly from env or fallback constant
function buildRecipients(): { email: string }[] {
  const envTo = Deno.env.get('SENDGRID_TO')
  const raw: unknown = envTo ?? (RECIPIENT_EMAIL as unknown)
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map(v => ({ email: String(v) }))
  }
  if (typeof raw === 'string') {
    // Allow JSON array string, or comma/semicolon-separated values
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

function formatTimeForDisplay(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function formatDateForDisplay(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

function buildMorningReportEmail(reportData: any[], targetDate: string) {
  const mexicoDate = getMexicoDate(new Date(targetDate + 'T12:00:00'))
  const formattedDate = formatDateForDisplay(mexicoDate)
  
  // Group data by status and priority
  const pendingChecklists = reportData.filter(item => item.status === 'pendiente')
  const completedChecklists = reportData.filter(item => item.status === 'completado')
  const systemIssues = reportData.filter(item => item.maintenance_status !== 'READY')
  
  // Calculate technician workload
  const technicianWorkload = new Map()
  reportData.forEach(item => {
    if (item.assigned_technician && item.assigned_technician !== 'No asignado') {
      const current = technicianWorkload.get(item.assigned_technician) || 0
      technicianWorkload.set(item.assigned_technician, current + 1)
    }
  })

  // Build summary statistics
  const totalScheduled = reportData.length
  const totalPending = pendingChecklists.length
  const totalCompleted = completedChecklists.length
  const totalSystemIssues = systemIssues.length
  const unassignedTasks = reportData.filter(item => !item.technician_id).length

  // Create system issues alerts HTML
  const systemIssuesHtml = systemIssues.length > 0 ? `
    <div style="background-color: #FEF2F2; padding: 20px; border-radius: 8px; border-left: 4px solid #DC2626; margin-bottom: 30px;">
      <h3 style="color: #DC2626; margin: 0 0 15px 0; font-size: 16px;">⚠️ Alertas del Sistema (${systemIssues.length})</h3>
      ${systemIssues.map(issue => `
        <div style="margin-bottom: 10px; padding: 8px; background-color: #FFFFFF; border-radius: 4px;">
          <strong style="color: #DC2626;">${issue.asset_name} (${issue.asset_code})</strong><br>
          <span style="font-size: 14px; color: #64748B;">
            ${issue.maintenance_status === 'NO_TECHNICIAN_ASSIGNED' ? '❌ Sin técnico asignado' :
              issue.maintenance_status === 'ASSET_NOT_OPERATIONAL' ? '🔧 Activo no operativo' :
              issue.maintenance_status === 'ALREADY_COMPLETED' ? '✅ Ya completado' : issue.maintenance_status}
          </span>
        </div>
      `).join('')}
    </div>
  ` : ''

  // Create pending checklists table
  const pendingChecklistsHtml = pendingChecklists.length > 0 ? `
    <div style="margin-bottom: 30px;">
      <h3 style="color: #0C4A6E; font-size: 18px; margin: 0 0 15px 0; border-bottom: 2px solid #E0F2FE; padding-bottom: 8px;">
        📋 Checklists Programados para Hoy (${pendingChecklists.length})
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #F8FAFC;">
            <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Activo</th>
            <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Checklist</th>
            <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Técnico</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Duración Est.</th>
            <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Planta</th>
          </tr>
        </thead>
        <tbody>
          ${pendingChecklists.map(item => `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">
                <strong>${item.asset_name}</strong><br>
                <span style="font-size: 12px; color: #64748B;">${item.asset_code}</span>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">${item.checklist_name}</td>
              <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">
                <span style="color: ${item.assigned_technician === 'No asignado' ? '#DC2626' : '#0F172A'};">
                  ${item.assigned_technician}
                </span>
                ${item.technician_workload > 1 ? `<br><span style="font-size: 11px; color: #F59E0B;">⚠️ ${item.technician_workload} tareas asignadas</span>` : ''}
              </td>
              <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">
                ${item.estimated_duration ? `${item.estimated_duration}h` : '-'}
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">
                ${item.plant_name || 'N/A'}
                ${item.department_name ? `<br><span style="font-size: 12px; color: #64748B;">${item.department_name}</span>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : `
    <div style="background-color: #F0F9FF; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
      <p style="margin: 0; font-size: 16px; color: #0369A1;">✅ No hay checklists pendientes programados para hoy</p>
    </div>
  `

  // Create technician workload summary
  const technicianWorkloadHtml = technicianWorkload.size > 0 ? `
    <div style="margin-bottom: 30px;">
      <h3 style="color: #0C4A6E; font-size: 16px; margin: 0 0 15px 0;">👥 Carga de Trabajo por Técnico</h3>
      <div style="display: grid; gap: 10px;">
        ${Array.from(technicianWorkload.entries()).map(([technician, count]) => `
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; background-color: #F8FAFC; border-radius: 4px; border-left: 4px solid ${count > 3 ? '#F59E0B' : '#10B981'};">
            <span>${technician}</span>
            <span style="font-weight: 600; color: ${count > 3 ? '#F59E0B' : '#10B981'};">${count} ${count === 1 ? 'tarea' : 'tareas'}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : ''

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reporte Matutino de Checklists</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #F8FAFC; color: #334155;">
      <div style="max-width: 800px; margin: 0 auto; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background-color: #0C4A6E; padding: 30px; text-align: center; border-bottom: 5px solid #0369A1;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 600;">🌅 Reporte Matutino - Checklists</h1>
          <p style="color: #BAE6FD; margin: 10px 0 0 0; font-size: 16px;">${formattedDate}</p>
        </div>
        
        <!-- Executive Summary -->
        <div style="padding: 20px; background-color: #F0F9FF; border-left: 4px solid #0369A1; margin: 20px;">
          <h2 style="color: #0C4A6E; margin: 0 0 15px 0; font-size: 18px;">📊 Resumen Ejecutivo</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: #0369A1;">${totalScheduled}</div>
              <div style="font-size: 12px; color: #64748B;">Total Programados</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: #F59E0B;">${totalPending}</div>
              <div style="font-size: 12px; color: #64748B;">Pendientes</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: #10B981;">${totalCompleted}</div>
              <div style="font-size: 12px; color: #64748B;">Ya Completados</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: ${totalSystemIssues > 0 ? '#DC2626' : '#10B981'};">${totalSystemIssues}</div>
              <div style="font-size: 12px; color: #64748B;">Alertas Sistema</div>
            </div>
          </div>
          ${unassignedTasks > 0 ? `
            <div style="margin-top: 15px; padding: 10px; background-color: #FEF2F2; border-radius: 6px; border-left: 3px solid #DC2626;">
              <span style="color: #DC2626; font-weight: 600;">⚠️ Atención:</span> 
              <span style="color: #7F1D1D;">${unassignedTasks} ${unassignedTasks === 1 ? 'tarea sin técnico asignado' : 'tareas sin técnico asignado'}</span>
            </div>
          ` : ''}
        </div>

        <!-- Content -->
        <div style="padding: 20px;">
          ${systemIssuesHtml}
          ${pendingChecklistsHtml}
          ${technicianWorkloadHtml}
        </div>
        
        <!-- Footer -->
        <div style="background-color: #F1F5F9; padding: 20px; text-align: center; border-top: 1px solid #E2E8F0;">
          <p style="margin: 0; font-size: 14px; color: #64748B;">
            © 2025 Dashboard de Mantenimiento. Sistema de Gestión de Mantenimiento.
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #94A3B8;">
            Este correo fue enviado automáticamente. Por favor no responda a este mensaje.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

serve(async (req) => {
  try {
    console.log('Morning checklist report function triggered')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Get target date from URL parameter or use today (Mexico time)
    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const forceSend = url.searchParams.get('force') === 'true'
    
    let targetDate: string
    if (dateParam) {
      // Validate date format YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(dateParam)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD')
      }
      targetDate = dateParam
    } else {
      targetDate = formatDateForDB(getMexicoDate())
    }
    
    console.log(`Generating morning report for date: ${targetDate}`)
    
    // Execute the morning report database function
    const { data: reportData, error } = await supabase
      .rpc('get_daily_checklist_morning_report', { target_date: targetDate })
    
    if (error) {
      console.error('Database query error:', error)
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    console.log(`Found ${reportData?.length || 0} scheduled checklists for ${targetDate}`)
    
    // Check if we should send email (has data or force flag)
    const shouldSendEmail = (reportData && reportData.length > 0) || forceSend
    
    if (!shouldSendEmail) {
      console.log('Not sending email - no scheduled checklists and force flag not set')
      return new Response(JSON.stringify({
        success: true,
        message: 'No hay checklists programados para enviar notificaciones.',
        date: targetDate,
        schedules_count: 0
      }), {
        headers: { "Content-Type": "application/json" }
      })
    }

    // Generate email content
    const emailContent = buildMorningReportEmail(reportData || [], targetDate)
    
    // Prepare email data for SendGrid
    const emailData = {
      personalizations: [
        {
          to: buildRecipients(),
          subject: `Checklist Programados - ${targetDate} - Dashboard de Mantenimiento`
        }
      ],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      content: [{ type: "text/html", value: emailContent }]
    }
    
    // Send email via SendGrid
    console.log('Sending email via SendGrid...')
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SendGrid error:', errorText)
      
      // Log failed notification
      await supabase.from('notifications').insert({
        user_id: null,
        title: 'Morning Checklist Report Failed',
        message: `Failed to send morning report for ${targetDate}: ${errorText.slice(0, 200)}`,
        type: 'MORNING_CHECKLIST_REPORT_ERROR',
        related_entity: 'system',
        priority: 'high',
        status: 'unread'
      })
      
      return new Response(JSON.stringify({ 
        error: 'Failed to send email',
        details: errorText
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    }

    console.log('Email sent successfully')

    // Log successful notification
    await supabase.from('notifications').insert({
      user_id: null,
      title: 'Morning Checklist Report Sent',
      message: `Morning report sent successfully for ${targetDate} with ${reportData?.length || 0} scheduled checklists`,
      type: 'MORNING_CHECKLIST_REPORT',
      related_entity: 'system',
      priority: 'medium',
      status: 'unread'
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Morning checklist report sent successfully for ${targetDate}`,
      date: targetDate,
      schedules_count: reportData?.length || 0,
      recipient: RECIPIENT_EMAIL
    }), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
