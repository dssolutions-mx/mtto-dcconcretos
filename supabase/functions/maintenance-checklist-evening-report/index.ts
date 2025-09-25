import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!

const FROM_EMAIL = "juan.aguirre@dssolutions-mx.com"
const FROM_NAME = "DASHBOARD DE MANTENIMIENTO"
const RECIPIENT_EMAIL = "juan.aguirre@dssolutions-mx.com"

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

function formatDateForDisplay(date = new Date()) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

function buildEveningReportEmail(reportData: any, targetDate: string) {
  const mexicoDate = getMexicoDate(new Date(targetDate + 'T12:00:00'))
  const formattedDate = formatDateForDisplay(mexicoDate)
  
  // Extract data from the complex report result
  const totalScheduled = reportData.total_scheduled || 0
  const totalCompleted = reportData.total_completed || 0
  const completionRate = reportData.completion_rate || 0
  const issuesFound = reportData.issues_found || 0
  const criticalIssues = reportData.critical_issues || 0
  const workOrdersGenerated = reportData.work_orders_generated || 0
  const avgCompletionTime = reportData.avg_completion_time_hours || 0
  const technicianPerformance = reportData.technician_performance || []
  const assetPerformance = reportData.asset_performance || []
  const incompleteChecklists = reportData.incomplete_checklists || []

  // Create performance indicators
  const getPerformanceColor = (rate: number) => {
    if (rate >= 90) return '#10B981' // Green
    if (rate >= 70) return '#F59E0B' // Yellow
    return '#DC2626' // Red
  }

  const getPerformanceIcon = (rate: number) => {
    if (rate >= 90) return '🟢'
    if (rate >= 70) return '🟡'
    return '🔴'
  }

  // Create technician performance table
  const technicianPerformanceHtml = technicianPerformance.length > 0 ? `
    <div style="margin-bottom: 30px;">
      <h3 style="color: #0C4A6E; font-size: 18px; margin: 0 0 15px 0; border-bottom: 2px solid #E0F2FE; padding-bottom: 8px;">
        👥 Rendimiento por Técnico
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #F8FAFC;">
            <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Técnico</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Programados</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Completados</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">% Completado</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Issues</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Tiempo Prom.</th>
          </tr>
        </thead>
        <tbody>
          ${technicianPerformance.map((tech: any) => {
            const completionRate = tech.completion_rate || 0
            return `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">
                  ${getPerformanceIcon(completionRate)} <strong>${tech.technician_name}</strong>
                </td>
                <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">${tech.scheduled}</td>
                <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">${tech.completed}</td>
                <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">
                  <span style="color: ${getPerformanceColor(completionRate)}; font-weight: 600;">
                    ${completionRate.toFixed(1)}%
                  </span>
                </td>
                <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">
                  <span style="color: ${tech.issues_found > 0 ? '#DC2626' : '#64748B'};">
                    ${tech.issues_found || 0}
                  </span>
                </td>
                <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">
                  ${tech.avg_completion_time_hours ? `${tech.avg_completion_time_hours.toFixed(1)}h` : '-'}
                </td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : ''

  // Create asset performance table
  const assetPerformanceHtml = assetPerformance.length > 0 ? `
    <div style="margin-bottom: 30px;">
      <h3 style="color: #0C4A6E; font-size: 18px; margin: 0 0 15px 0; border-bottom: 2px solid #E0F2FE; padding-bottom: 8px;">
        🔧 Rendimiento por Activo
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #F8FAFC;">
            <th style="text-align: left; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Activo</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Checklists</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Completados</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Issues Totales</th>
            <th style="text-align: center; padding: 12px; color: #64748B; font-weight: 500; border-bottom: 2px solid #E2E8F0;">Issues Críticos</th>
          </tr>
        </thead>
        <tbody>
          ${assetPerformance.map((asset: any) => `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #E2E8F0;">
                <strong>${asset.asset_name}</strong><br>
                <span style="font-size: 12px; color: #64748B;">${asset.asset_code}</span>
              </td>
              <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">${asset.checklists_scheduled}</td>
              <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">${asset.checklists_completed}</td>
              <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">
                <span style="color: ${asset.issues_found > 0 ? '#DC2626' : '#64748B'};">
                  ${asset.issues_found || 0}
                </span>
              </td>
              <td style="text-align: center; padding: 12px; border-bottom: 1px solid #E2E8F0;">
                <span style="color: ${asset.critical_issues > 0 ? '#DC2626' : '#64748B'}; font-weight: ${asset.critical_issues > 0 ? '600' : 'normal'};">
                  ${asset.critical_issues || 0}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : ''

  // Create incomplete checklists alert
  const incompleteChecklistsHtml = incompleteChecklists.length > 0 ? `
    <div style="background-color: #FEF2F2; padding: 20px; border-radius: 8px; border-left: 4px solid #DC2626; margin-bottom: 30px;">
      <h3 style="color: #DC2626; margin: 0 0 15px 0; font-size: 16px;">⚠️ Checklists Pendientes (${incompleteChecklists.length})</h3>
      ${incompleteChecklists.map((incomplete: any) => `
        <div style="margin-bottom: 10px; padding: 8px; background-color: #FFFFFF; border-radius: 4px;">
          <strong style="color: #DC2626;">${incomplete.asset_name} (${incomplete.asset_code})</strong><br>
          <span style="font-size: 14px; color: #64748B;">
            Checklist: ${incomplete.checklist_name}<br>
            Técnico: ${incomplete.assigned_technician}<br>
            Planta: ${incomplete.plant_name}
          </span>
        </div>
      `).join('')}
    </div>
  ` : ''

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reporte Vespertino de Checklists</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #F8FAFC; color: #334155;">
      <div style="max-width: 800px; margin: 0 auto; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background-color: #0C4A6E; padding: 30px; text-align: center; border-bottom: 5px solid #0369A1;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 600;">🌙 Reporte Vespertino - Checklists</h1>
          <p style="color: #BAE6FD; margin: 10px 0 0 0; font-size: 16px;">${formattedDate}</p>
        </div>
        
        <!-- Executive Summary -->
        <div style="padding: 20px; background-color: #F0F9FF; border-left: 4px solid #0369A1; margin: 20px;">
          <h2 style="color: #0C4A6E; margin: 0 0 15px 0; font-size: 18px;">📊 Resumen de Completación</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: #0369A1;">${totalScheduled}</div>
              <div style="font-size: 12px; color: #64748B;">Programados</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: #10B981;">${totalCompleted}</div>
              <div style="font-size: 12px; color: #64748B;">Completados</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: ${getPerformanceColor(completionRate)};">${completionRate.toFixed(1)}%</div>
              <div style="font-size: 12px; color: #64748B;">Tasa Completación</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: ${issuesFound > 0 ? '#DC2626' : '#10B981'};">${issuesFound}</div>
              <div style="font-size: 12px; color: #64748B;">Issues Encontrados</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: ${criticalIssues > 0 ? '#DC2626' : '#10B981'};">${criticalIssues}</div>
              <div style="font-size: 12px; color: #64748B;">Issues Críticos</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: 700; color: ${workOrdersGenerated > 0 ? '#F59E0B' : '#64748B'};">${workOrdersGenerated}</div>
              <div style="font-size: 12px; color: #64748B;">OT Generadas</div>
            </div>
          </div>
          
          <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 20px; font-weight: 700; color: #0369A1;">
                ${avgCompletionTime > 0 ? `${avgCompletionTime.toFixed(1)}h` : '-'}
              </div>
              <div style="font-size: 12px; color: #64748B;">Tiempo Promedio</div>
            </div>
            <div style="text-align: center; padding: 15px; background-color: #FFFFFF; border-radius: 8px;">
              <div style="font-size: 20px; font-weight: 700; color: ${incompleteChecklists.length > 0 ? '#DC2626' : '#10B981'};">
                ${incompleteChecklists.length}
              </div>
              <div style="font-size: 12px; color: #64748B;">Pendientes</div>
            </div>
          </div>
          
          ${completionRate < 80 ? `
            <div style="margin-top: 15px; padding: 10px; background-color: #FEF2F2; border-radius: 6px; border-left: 3px solid #DC2626;">
              <span style="color: #DC2626; font-weight: 600;">⚠️ Atención:</span> 
              <span style="color: #7F1D1D;">Tasa de completación por debajo del objetivo (80%)</span>
            </div>
          ` : ''}
        </div>

        <!-- Content -->
        <div style="padding: 20px;">
          ${incompleteChecklistsHtml}
          ${technicianPerformanceHtml}
          ${assetPerformanceHtml}
          
          ${issuesFound > 0 ? `
            <div style="background-color: #FFFBEB; padding: 20px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 30px;">
              <h3 style="color: #92400E; margin: 0 0 10px 0; font-size: 16px;">🔍 Resumen de Issues</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                  <span style="color: #78350F; font-weight: 600;">Total de Issues:</span>
                  <span style="color: #92400E; font-size: 18px; font-weight: 700; margin-left: 8px;">${issuesFound}</span>
                </div>
                <div>
                  <span style="color: #78350F; font-weight: 600;">Issues Críticos:</span>
                  <span style="color: #DC2626; font-size: 18px; font-weight: 700; margin-left: 8px;">${criticalIssues}</span>
                </div>
              </div>
              ${workOrdersGenerated > 0 ? `
                <div style="margin-top: 10px; padding: 8px; background-color: #F0F9FF; border-radius: 4px;">
                  <span style="color: #0369A1; font-weight: 600;">✅ Órdenes de Trabajo Generadas:</span>
                  <span style="color: #0C4A6E; font-weight: 700; margin-left: 8px;">${workOrdersGenerated}</span>
                </div>
              ` : ''}
            </div>
          ` : `
            <div style="background-color: #F0FDF4; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
              <p style="margin: 0; font-size: 16px; color: #166534;">✅ Excelente trabajo! No se encontraron issues críticos hoy.</p>
            </div>
          `}
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
    console.log('Evening checklist report function triggered')
    
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
    
    console.log(`Generating evening report for date: ${targetDate}`)
    
    // Execute the evening report database function
    const { data: reportData, error } = await supabase
      .rpc('get_daily_checklist_evening_report', { target_date: targetDate })
    
    if (error) {
      console.error('Database query error:', error)
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    console.log(`Evening report data for ${targetDate}:`, reportData)
    
    // The function returns a single row with aggregated data
    const reportResult = reportData && reportData.length > 0 ? reportData[0] : {
      total_scheduled: 0,
      total_completed: 0,
      completion_rate: 0,
      issues_found: 0,
      critical_issues: 0,
      work_orders_generated: 0,
      avg_completion_time_hours: 0,
      technician_performance: [],
      asset_performance: [],
      incomplete_checklists: []
    }
    
    // Check if we should send email (has data or force flag)
    const shouldSendEmail = (reportResult.total_scheduled > 0) || forceSend
    
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
    const emailContent = buildEveningReportEmail(reportResult, targetDate)
    
    // Prepare email data for SendGrid
    const emailData = {
      personalizations: [
        {
          to: [{ email: RECIPIENT_EMAIL }],
          subject: `Resumen Checklists Completados - ${targetDate} - Dashboard de Mantenimiento`
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
        title: 'Evening Checklist Report Failed',
        message: `Failed to send evening report for ${targetDate}: ${errorText.slice(0, 200)}`,
        type: 'EVENING_CHECKLIST_REPORT_ERROR',
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
      title: 'Evening Checklist Report Sent',
      message: `Evening report sent successfully for ${targetDate} with ${reportResult.total_scheduled} scheduled checklists`,
      type: 'EVENING_CHECKLIST_REPORT',
      related_entity: 'system',
      priority: 'medium',
      status: 'unread'
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Evening checklist report sent successfully for ${targetDate}`,
      date: targetDate,
      total_scheduled: reportResult.total_scheduled,
      total_completed: reportResult.total_completed,
      completion_rate: reportResult.completion_rate,
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
