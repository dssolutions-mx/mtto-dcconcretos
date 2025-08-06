import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const plant = searchParams.get('plant')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    if (!plant) {
      return NextResponse.json(
        { error: 'Plant parameter is required' },
        { status: 400 }
      )
    }
    
    // Set default date range (last 30 days if not specified)
    const defaultEndDate = new Date().toISOString().split('T')[0]
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const periodStart = startDate || defaultStartDate
    const periodEnd = endDate || defaultEndDate

    const supabase = await createClient()

    // Get all assets for the specified plant
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        location,
        department,
        status,
        plants:plant_id (
          name,
          location
        ),
        departments:department_id (
          name
        )
      `)
      .or(`plants.name.eq.${plant},location.eq.${plant}`)

    if (assetsError || !assets || assets.length === 0) {
      return NextResponse.json(
        { error: 'No assets found for the specified plant' },
        { status: 404 }
      )
    }

    const assetIds = assets.map(asset => asset.id)

    // Get completed checklists for these assets in the date range
    const { data: completedChecklists, error: checklistsError } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        checklist_id,
        asset_id,
        technician,
        completion_date,
        notes,
        status,
        signature_data,
        created_by,
        checklists:checklist_id (
          id,
          name,
          frequency,
          description,
          checklist_sections (
            id,
            title,
            order_index,
            checklist_items (
              id,
              description,
              required,
              order_index
            )
          )
        ),
        profiles:created_by (
          id,
          nombre,
          apellido,
          role,
          telefono,
          avatar_url,
          departamento
        )
      `)
      .in('asset_id', assetIds)
      .gte('completion_date', periodStart)
      .lte('completion_date', periodEnd + 'T23:59:59.999Z')
      .order('completion_date', { ascending: false })

    if (checklistsError) {
      console.error('Error fetching completed checklists:', checklistsError)
      return NextResponse.json(
        { error: 'Error fetching completed checklists' },
        { status: 500 }
      )
    }

    if (!completedChecklists || completedChecklists.length === 0) {
      return NextResponse.json(
        { error: 'No completed checklists found for the specified criteria' },
        { status: 404 }
      )
    }

    // Get completed items for each checklist
    const checklistIds = completedChecklists.map(c => c.id)
    
    let completedItems: any[] = []
    let issues: any[] = []
    
    if (checklistIds.length > 0) {
      // Get completed items
      const { data: itemsData, error: itemsError } = await supabase
        .from('completed_checklist_items')
        .select('*')
        .in('completed_checklist_id', checklistIds)

      if (!itemsError) {
        completedItems = itemsData || []
      }

      // Get issues related to these checklists
      const { data: issuesData, error: issuesError } = await supabase
        .from('checklist_issues')
        .select('*')
        .in('checklist_id', checklistIds)

      if (!issuesError) {
        issues = issuesData || []
      }
    }

    // Group data by checklist
    const itemsByChecklist = completedItems.reduce((acc: any, item: any) => {
      if (!acc[item.completed_checklist_id]) {
        acc[item.completed_checklist_id] = []
      }
      acc[item.completed_checklist_id].push({
        id: item.id,
        item_id: item.item_id,
        status: item.status,
        notes: item.notes,
        photo_url: item.photo_url
      })
      return acc
    }, {})

    const issuesByChecklist = issues.reduce((acc: any, issue: any) => {
      if (!acc[issue.checklist_id]) {
        acc[issue.checklist_id] = []
      }
      acc[issue.checklist_id].push({
        id: issue.id,
        description: issue.description,
        status: issue.status,
        notes: issue.notes,
        photo_url: issue.photo_url,
        work_order_id: issue.work_order_id,
        resolved: issue.resolved
      })
      return acc
    }, {})

    // Combine all checklists into consolidated report data
    const consolidatedReportData = {
      plant,
      periodStart,
      periodEnd,
      assets,
      checklists: completedChecklists.map(checklist => {
        const asset = assets.find(a => a.id === checklist.asset_id)
        return {
          ...checklist,
          completed_items: itemsByChecklist[checklist.id] || [],
          issues: issuesByChecklist[checklist.id] || [],
          asset
        }
      }).filter(c => c.asset), // Only include checklists with valid assets
      summary: {
        total_checklists: completedChecklists.length,
        total_assets: [...new Set(completedChecklists.map(c => c.asset_id))].length,
        total_items: completedItems.length,
        passed_items: completedItems.filter(item => item.status === 'pass').length,
        flagged_items: completedItems.filter(item => item.status === 'flag').length,
        failed_items: completedItems.filter(item => item.status === 'fail').length,
        total_issues: issues.length,
        resolved_issues: issues.filter(issue => issue.resolved).length
      }
    }

    // Generate consolidated HTML report
    const consolidatedHTML = generateConsolidatedReportHTML(consolidatedReportData)

    // Return HTML report (user can print to PDF)
    return new NextResponse(consolidatedHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename=reporte-evidencias-${plant}-${new Date().toISOString().split('T')[0]}.html`
      }
    })

  } catch (error: any) {
    console.error('Error generating batch evidence report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateConsolidatedReportHTML(reportData: any): string {
  const { plant, periodStart, periodEnd, checklists, summary } = reportData
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return '✅'
      case 'flag': return '⚠️'
      case 'fail': return '❌'
      default: return '❓'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pass': return 'Correcto'
      case 'flag': return 'Atención'
      case 'fail': return 'Falla'
      default: return 'Desconocido'
    }
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reporte Consolidado de Evidencias - ${plant}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.5;
          color: #333;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20px;
          background: white;
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 20px;
        }
        
        .header h1 {
          color: #2563eb;
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: bold;
        }
        
        .header .subtitle {
          font-size: 18px;
          color: #1f2937;
          margin-bottom: 10px;
        }
        
        .header p {
          margin: 5px 0;
          color: #6b7280;
        }
        
        .summary-section {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 2px solid #0369a1;
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 30px;
        }
        
        .summary-title {
          color: #0369a1;
          margin: 0 0 20px 0;
          font-size: 20px;
          text-align: center;
        }
        
        .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .stat-card {
          text-align: center;
          padding: 15px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .stat-number {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .stat-label {
          color: #6b7280;
          font-size: 12px;
          font-weight: 500;
        }
        
        .period-info {
          text-align: center;
          color: #0369a1;
          font-weight: 500;
        }
        
        .checklists-container {
          margin-top: 30px;
        }
        
        .checklist-card {
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          margin-bottom: 40px;
          overflow: hidden;
          page-break-inside: avoid;
          background: white;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .checklist-header {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .checklist-title {
          color: #1e293b;
          margin: 0 0 15px 0;
          font-size: 20px;
          font-weight: bold;
        }
        
        .checklist-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        
        .info-group {
          background: white;
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        
        .info-label {
          font-weight: 600;
          color: #374151;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .info-value {
          color: #1f2937;
          font-size: 14px;
          margin-top: 2px;
        }
        
        .checklist-summary {
          display: flex;
          justify-content: space-around;
          padding: 15px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .summary-item {
          text-align: center;
        }
        
        .summary-number {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 3px;
        }
        
        .summary-text {
          font-size: 11px;
          color: #6b7280;
        }
        
        .sections {
          padding: 0;
        }
        
        .section {
          border-bottom: 1px solid #f1f5f9;
        }
        
        .section:last-child {
          border-bottom: none;
        }
        
        .section-header {
          background: #f8fafc;
          padding: 12px 20px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .section-title {
          margin: 0;
          color: #1e293b;
          font-size: 16px;
          font-weight: 600;
        }
        
        .items {
          padding: 0 20px;
        }
        
        .item {
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        
        .item:last-child {
          border-bottom: none;
        }
        
        .item-status {
          font-size: 16px;
          line-height: 1;
          margin-top: 2px;
        }
        
        .item-content {
          flex: 1;
        }
        
        .item-description {
          font-weight: 500;
          margin-bottom: 4px;
          color: #1f2937;
        }
        
        .item-meta {
          font-size: 11px;
          color: #6b7280;
          margin-bottom: 6px;
        }
        
        .item-notes {
          background: #f8fafc;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          border-left: 3px solid #2563eb;
        }
        
        .issues-section {
          background: #fef2f2;
          border: 2px solid #fecaca;
          border-radius: 8px;
          padding: 15px 20px;
          margin: 15px 20px;
        }
        
        .issues-title {
          color: #dc2626;
          margin: 0 0 10px 0;
          font-size: 14px;
          font-weight: 600;
        }
        
        .issue-item {
          background: white;
          padding: 8px;
          border-radius: 4px;
          border-left: 4px solid #dc2626;
          margin-bottom: 8px;
          font-size: 12px;
        }
        
        .technician-info {
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 6px;
          padding: 12px 20px;
          margin: 15px 20px;
          font-size: 12px;
        }
        
        .print-controls {
          position: fixed;
          top: 20px;
          right: 20px;
          background: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 1000;
          border: 1px solid #e5e7eb;
        }
        
        .print-button {
          background: #2563eb;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          margin-right: 10px;
        }
        
        .print-button:hover {
          background: #1d4ed8;
        }
        
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
        
        @media print {
          body { margin: 0; padding: 15px; font-size: 11px; }
          .print-controls { display: none; }
          .checklist-card { margin-bottom: 30px; }
          .summary-stats { grid-template-columns: repeat(4, 1fr); }
          .checklist-info { grid-template-columns: repeat(2, 1fr); }
          .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      <div class="print-controls">
        <button class="print-button" onclick="window.print()">🖨️ Imprimir/PDF</button>
        <button class="print-button" onclick="window.close()" style="background: #6b7280;">✕ Cerrar</button>
      </div>

      <div class="header">
        <h1>REPORTE CONSOLIDADO DE EVIDENCIAS</h1>
        <div class="subtitle">Mantenimiento Preventivo - ${plant}</div>
        <p>Generado el ${formatDate(new Date().toISOString())}</p>
      </div>

      <div class="summary-section">
        <h2 class="summary-title">📊 Resumen Ejecutivo del Período</h2>
        
        <div class="summary-stats">
          <div class="stat-card">
            <div class="stat-number" style="color: #2563eb;">${summary.total_checklists}</div>
            <div class="stat-label">Checklists Completados</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color: #7c3aed;">${summary.total_assets}</div>
            <div class="stat-label">Activos Evaluados</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color: #059669;">${summary.total_items}</div>
            <div class="stat-label">Total de Ítems</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color: #16a34a;">${summary.passed_items}</div>
            <div class="stat-label">Ítems Correctos</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color: #eab308;">${summary.flagged_items}</div>
            <div class="stat-label">Con Atención</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color: #dc2626;">${summary.failed_items}</div>
            <div class="stat-label">Ítems Fallidos</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color: #ea580c;">${summary.total_issues}</div>
            <div class="stat-label">Issues Detectados</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="color: #10b981;">${summary.resolved_issues}</div>
            <div class="stat-label">Issues Resueltos</div>
          </div>
        </div>
        
        <div class="period-info">
          📅 Período: ${formatDateShort(periodStart)} - ${formatDateShort(periodEnd)}
        </div>
      </div>

      <div class="checklists-container">
        <h2 style="color: #1f2937; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
          📋 Detalle de Checklists Completados (${checklists.length})
        </h2>
        
        ${checklists.map((checklistData: any, index: number) => {
          const { asset, checklists: checklistTemplate, technician, completion_date, completed_items, issues, profiles, notes } = checklistData
          
          const totalItems = completed_items.length
          const passedItems = completed_items.filter((item: any) => item.status === 'pass').length
          const flaggedItems = completed_items.filter((item: any) => item.status === 'flag').length
          const failedItems = completed_items.filter((item: any) => item.status === 'fail').length
          
          return `
            ${index > 0 && index % 3 === 0 ? '<div class="page-break"></div>' : ''}
            <div class="checklist-card">
              <div class="checklist-header">
                <div class="checklist-title">
                  ${index + 1}. ${checklistTemplate?.name || 'Checklist sin nombre'}
                </div>
                
                <div class="checklist-info">
                  <div class="info-group">
                    <div class="info-label">🚛 Activo</div>
                    <div class="info-value">${asset.name} (${asset.asset_id})</div>
                  </div>
                  
                  <div class="info-group">
                    <div class="info-label">📍 Ubicación</div>
                    <div class="info-value">${asset.plants?.name || asset.location || 'No especificada'}</div>
                  </div>
                  
                  <div class="info-group">
                    <div class="info-label">🏢 Departamento</div>
                    <div class="info-value">${asset.departments?.name || asset.department || 'No especificado'}</div>
                  </div>
                  
                  <div class="info-group">
                    <div class="info-label">👨‍🔧 Técnico</div>
                    <div class="info-value">${profiles?.nombre && profiles?.apellido ? `${profiles.nombre} ${profiles.apellido}` : technician}</div>
                  </div>
                  
                  <div class="info-group">
                    <div class="info-label">📅 Completado</div>
                    <div class="info-value">${formatDate(completion_date)}</div>
                  </div>
                  
                  <div class="info-group">
                    <div class="info-label">🔄 Frecuencia</div>
                    <div class="info-value">${checklistTemplate?.frequency || 'No especificada'}</div>
                  </div>
                </div>
              </div>

              <div class="checklist-summary">
                <div class="summary-item">
                  <div class="summary-number" style="color: #2563eb;">${totalItems}</div>
                  <div class="summary-text">Total Ítems</div>
                </div>
                <div class="summary-item">
                  <div class="summary-number" style="color: #16a34a;">${passedItems}</div>
                  <div class="summary-text">Correctos</div>
                </div>
                <div class="summary-item">
                  <div class="summary-number" style="color: #eab308;">${flaggedItems}</div>
                  <div class="summary-text">Atención</div>
                </div>
                <div class="summary-item">
                  <div class="summary-number" style="color: #dc2626;">${failedItems}</div>
                  <div class="summary-text">Fallidos</div>
                </div>
              </div>

              <div class="sections">
                ${checklistTemplate?.checklist_sections?.sort((a: any, b: any) => a.order_index - b.order_index).map((section: any) => `
                  <div class="section">
                    <div class="section-header">
                      <div class="section-title">${section.title}</div>
                    </div>
                    <div class="items">
                      ${section.checklist_items?.sort((a: any, b: any) => a.order_index - b.order_index).map((item: any) => {
                        const completionData = completed_items.find((ci: any) => ci.item_id === item.id)
                        return `
                          <div class="item">
                            <div class="item-status">${completionData ? getStatusIcon(completionData.status) : '❓'}</div>
                            <div class="item-content">
                              <div class="item-description">${item.description}</div>
                              <div class="item-meta">
                                Estado: ${completionData ? getStatusText(completionData.status) : 'No evaluado'}
                                ${item.required ? ' • Obligatorio' : ''}
                              </div>
                              ${completionData?.notes ? `<div class="item-notes"><strong>Observaciones:</strong> ${completionData.notes}</div>` : ''}
                            </div>
                          </div>
                        `
                      }).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>

              ${issues && issues.length > 0 ? `
                <div class="issues-section">
                  <div class="issues-title">⚠️ Problemas Detectados (${issues.length})</div>
                  ${issues.map((issue: any) => `
                    <div class="issue-item">
                      <div style="font-weight: 600;">${issue.description}</div>
                      ${issue.notes ? `<div style="margin-top: 3px;">${issue.notes}</div>` : ''}
                      ${issue.work_order_id ? `<div style="margin-top: 3px; color: #2563eb;">Orden: ${issue.work_order_id}</div>` : ''}
                      ${issue.resolved ? '<div style="margin-top: 3px; color: #16a34a;">✓ Resuelto</div>' : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              <div class="technician-info">
                <strong>👨‍🔧 Información del Técnico:</strong>
                ${profiles?.nombre && profiles?.apellido ? `${profiles.nombre} ${profiles.apellido}` : technician}
                ${profiles?.role ? ` • ${profiles.role}` : ''}
                ${profiles?.departamento ? ` • ${profiles.departamento}` : ''}
                • Ejecutado: ${formatDate(completion_date)}
                ${notes ? `<br><strong>Notas:</strong> ${notes}` : ''}
              </div>
            </div>
          `
        }).join('')}
      </div>

      <div class="footer">
        <p><strong>Reporte generado automáticamente el ${formatDate(new Date().toISOString())}</strong></p>
        <p>Documento consolidado de evidencias de mantenimiento preventivo para ${plant}</p>
        <p>Total de checklists incluidos: ${checklists.length} | Período: ${formatDateShort(periodStart)} - ${formatDateShort(periodEnd)}</p>
      </div>

      <script>
        // Auto-print functionality
        window.addEventListener('load', function() {
          // Add print keyboard shortcut
          document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'p') {
              e.preventDefault();
              window.print();
            }
          });
        });
      </script>
    </body>
    </html>
  `
}