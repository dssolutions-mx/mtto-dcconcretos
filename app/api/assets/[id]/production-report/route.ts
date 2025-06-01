import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 1. Get complete asset information
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select(`
        *,
        equipment_models (
          id,
          name,
          manufacturer,
          model_id,
          category,
          description,
          specifications,
          maintenance_unit,
          maintenance_intervals (*)
        )
      `)
      .eq('id', id)
      .single()

    if (assetError) {
      return NextResponse.json({ error: assetError.message }, { status: 500 })
    }

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // 2. Get completed checklists with details
    const { data: completedChecklists, error: checklistsError } = await supabase
      .from('completed_checklists')
      .select(`
        *,
        checklists (
          id,
          name,
          description,
          frequency,
          checklist_sections (
            id,
            title,
            checklist_items (
              id,
              description,
              required,
              item_type
            )
          )
        ),
        checklist_issues (
          id,
          status,
          description,
          notes,
          photo_url,
          resolved,
          resolution_date
        )
      `)
      .eq('asset_id', id)
      .order('completion_date', { ascending: false })

    if (checklistsError) {
      console.error('Error fetching completed checklists:', checklistsError)
    }

    // 3. Get incident history related to checklists and general incidents
    const { data: incidents, error: incidentsError } = await supabase
      .from('incident_history')
      .select('*')
      .eq('asset_id', id)
      .order('date', { ascending: false })

    if (incidentsError) {
      console.error('Error fetching incidents:', incidentsError)
    }

    // 4. Get maintenance history
    const { data: maintenanceHistory, error: maintenanceError } = await supabase
      .from('maintenance_history')
      .select('*')
      .eq('asset_id', id)
      .order('date', { ascending: false })

    if (maintenanceError) {
      console.error('Error fetching maintenance history:', maintenanceError)
    }

    // 5. Get work orders (both completed and pending)
    const { data: workOrders, error: workOrdersError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('asset_id', id)
      .order('created_at', { ascending: false })

    if (workOrdersError) {
      console.error('Error fetching work orders:', workOrdersError)
    }

    // 6. Get service orders
    const { data: serviceOrders, error: serviceOrdersError } = await supabase
      .from('service_orders')
      .select('*')
      .eq('asset_id', id)
      .order('date', { ascending: false })

    if (serviceOrdersError) {
      console.error('Error fetching service orders:', serviceOrdersError)
    }

    // 7. Get upcoming maintenance plans
    const { data: maintenancePlans, error: plansError } = await supabase
      .from('maintenance_plans')
      .select(`
        *,
        maintenance_intervals (
          id,
          interval_value,
          type,
          description,
          name
        )
      `)
      .eq('asset_id', id)
      .order('next_due', { ascending: true })

    if (plansError) {
      console.error('Error fetching maintenance plans:', plansError)
    }

    // 8. Get maintenance intervals for this asset's model
    let maintenanceIntervals = []
    let intervalAnalysis = []
    
    if (asset.equipment_models?.id) {
      const { data: intervalsData, error: intervalsError } = await supabase
        .from('maintenance_intervals')
        .select(`
          *,
          maintenance_tasks(
            id,
            description,
            task_parts(*)
          )
        `)
        .eq('model_id', asset.equipment_models.id)
        .order('interval_value', { ascending: true })

      if (intervalsError) {
        console.error('Error fetching maintenance intervals:', intervalsError)
      } else {
        maintenanceIntervals = intervalsData || []
        
        // Analyze each interval status
        const currentHours = asset.current_hours || 0
        
        // Find the highest maintenance hours for "covered" logic
        const allMaintenanceHours = (maintenanceHistory || [])
          .map(m => Number(m.hours) || 0)
          .filter(h => h > 0)
          .sort((a, b) => b - a) // Sort from highest to lowest
        const lastMaintenanceHours = allMaintenanceHours.length > 0 ? allMaintenanceHours[0] : 0
        
        intervalAnalysis = maintenanceIntervals.map(interval => {
          const intervalHours = interval.interval_value || 0
          
          // Find the corresponding maintenance plan for this interval by interval_value
          // (interval_id may not match if model was changed)
          const correspondingPlan = (maintenancePlans || []).find(plan => 
            plan.interval_value === interval.interval_value
          )
          
          // Find if this specific maintenance was performed (by maintenance_plan_id or interval_id)
          // Some historical records may have interval_id instead of maintenance_plan_id
          const lastMaintenanceOfType = (maintenanceHistory || []).find(m => 
            m.maintenance_plan_id === correspondingPlan?.id ||
            m.maintenance_plan_id === correspondingPlan?.interval_id
          )
          
          let status = 'pending'
          let progress = 0
          let nextHours = intervalHours
          let hoursOverdue = 0
          let wasPerformed = !!lastMaintenanceOfType
          let urgencyLevel = 'normal'
          
          if (lastMaintenanceOfType) {
            // This maintenance WAS performed - it's completed, no next cycle
            wasPerformed = true
            status = 'completed'
            progress = 100
            urgencyLevel = 'low'
            nextHours = intervalHours // Keep the original interval hours
          } else {
            // This maintenance was NEVER performed
            wasPerformed = false
            
            // Check if it was "covered" by subsequent maintenance
            if (intervalHours <= lastMaintenanceHours) {
              // Covered by subsequent maintenance
              status = 'covered'
              progress = 100
              urgencyLevel = 'low'
            } else if (currentHours >= intervalHours) {
              // Current hours already passed this interval - OVERDUE
              hoursOverdue = currentHours - intervalHours
              status = 'overdue'
              progress = 100
              
              if (hoursOverdue > intervalHours * 0.5) {
                urgencyLevel = 'high'
              } else {
                urgencyLevel = 'medium'
              }
            } else {
              // Current hours haven't reached this interval yet - SCHEDULED/UPCOMING
              progress = Math.round((currentHours / intervalHours) * 100)
              const hoursRemaining = intervalHours - currentHours
              
              if (hoursRemaining <= 100) {
                status = 'upcoming'
                urgencyLevel = 'high'
              } else if (hoursRemaining <= 200) {
                status = 'upcoming'
                urgencyLevel = 'medium'
              } else {
                status = 'scheduled'
                urgencyLevel = 'low'
              }
            }
          }
          
          return {
            ...interval,
            correspondingPlan,
            analysis: {
              status,
              progress: Math.min(progress, 100), // Cap at 100% since there's no next cycle
              nextHours,
              hoursOverdue,
              wasPerformed,
              urgencyLevel,
              lastMaintenance: lastMaintenanceOfType ? {
                date: lastMaintenanceOfType.date,
                hours: lastMaintenanceOfType.hours,
                technician: lastMaintenanceOfType.technician || 'No especificado',
                description: lastMaintenanceOfType.description
              } : null,
              intervalHours,
              planId: correspondingPlan?.id
            }
          }
        })
        
        console.log(`Asset ${id}: Found ${maintenanceIntervals.length} intervals, ${intervalAnalysis.length} analyzed`)
      }
    }

    // 9. Filter out reading-only updates from maintenance history
    const actualMaintenanceHistory = (maintenanceHistory || [])
      .filter(record => {
        const description = record.description?.toLowerCase() || ''
        const type = record.type?.toLowerCase() || ''
        
        // Exclude entries that are just reading updates
        const isReadingUpdate = description.includes('lectura') || 
                               description.includes('reading') ||
                               description.includes('actualización de horas') ||
                               description.includes('actualización de horómetro') ||
                               description.includes('actualización de kilómetros') ||
                               description.includes('update hours') ||
                               description.includes('update kilometers') ||
                               description.includes('horómetro') ||
                               description.includes('horometro') ||
                               description.includes('via checklist') ||
                               description.includes('→') || // Arrow character often used in hour updates
                               description.includes('->') || // ASCII arrow
                               type === 'reading' ||
                               type === 'lectura' ||
                               (description.includes('actualización') && (description.includes('1332') || description.includes('1385'))) // Specific hour values
        
        return !isReadingUpdate
      })

    // 10. Calculate summary statistics  
    const totalMaintenanceCost = actualMaintenanceHistory
      .reduce((sum, record) => sum + (parseFloat(record.total_cost || '0')), 0)

    const totalIncidentCost = (incidents || [])
      .reduce((sum, incident) => sum + (parseFloat(incident.total_cost || '0')), 0)

    const totalMaintenanceHours = actualMaintenanceHistory
      .reduce((sum, record) => sum + (record.labor_hours || 0), 0)

    const preventiveMaintenance = actualMaintenanceHistory
      .filter(record => {
        const type = record.type?.toLowerCase()
        // Un mantenimiento es preventivo si:
        // 1. Tiene tipo explícito preventivo/preventive
        // 2. Está asociado a un plan de mantenimiento (maintenance_plan_id)
        return type === 'preventive' || type === 'preventivo' || record.maintenance_plan_id
      })

    const correctiveMaintenance = actualMaintenanceHistory
      .filter(record => {
        const type = record.type?.toLowerCase()
        // Un mantenimiento es correctivo si:
        // 1. Tiene tipo explícito correctivo/corrective
        // 2. NO está asociado a un plan de mantenimiento Y no es preventivo
        return (type === 'corrective' || type === 'correctivo') || 
               (!record.maintenance_plan_id && type !== 'preventive' && type !== 'preventivo')
      })

    const completedChecklistsCount = (completedChecklists || []).length

    // Get unique checklist issues (avoid double counting)
    const allChecklistIssues = (completedChecklists || [])
      .flatMap(checklist => checklist.checklist_issues || [])
      .filter((issue, index, array) => 
        // Remove duplicates based on ID if available, otherwise include all
        !issue.id || array.findIndex(i => i.id === issue.id) === index
      )

    const checklistIssuesCount = allChecklistIssues.length

    const resolvedIssuesCount = allChecklistIssues
      .filter((issue: any) => issue.resolved).length

    // 11. Calculate availability and reliability metrics
    const totalDowntime = (incidents || [])
      .reduce((sum, incident) => sum + (incident.downtime || 0), 0)

    const currentDate = new Date()
    const installationDate = asset.installation_date ? new Date(asset.installation_date) : new Date(asset.created_at)
    const operatingDays = Math.ceil((currentDate.getTime() - installationDate.getTime()) / (1000 * 60 * 60 * 24))
    const totalOperatingHours = operatingDays * 24
    const availability = totalOperatingHours > 0 ? ((totalOperatingHours - totalDowntime) / totalOperatingHours) * 100 : 100

    // 12. Warranty status
    const warrantyStatus = asset.warranty_expiration 
      ? new Date(asset.warranty_expiration) > currentDate ? 'Active' : 'Expired'
      : 'Not specified'

    const daysToWarrantyExpiration = asset.warranty_expiration 
      ? Math.ceil((new Date(asset.warranty_expiration).getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Compile the comprehensive report data
    const reportData = {
      asset,
      completedChecklists: completedChecklists || [],
      incidents: incidents || [],
      maintenanceHistory: actualMaintenanceHistory || [],
      allMaintenanceHistory: maintenanceHistory || [], // Keep original for reference
      workOrders: workOrders || [],
      serviceOrders: serviceOrders || [],
      maintenancePlans: maintenancePlans || [],
      maintenanceIntervals: maintenanceIntervals || [],
      intervalAnalysis: intervalAnalysis || [],
      summary: {
        totalMaintenanceCost,
        totalIncidentCost,
        totalCost: totalMaintenanceCost + totalIncidentCost,
        totalMaintenanceHours,
        preventiveMaintenanceCount: preventiveMaintenance.length,
        correctiveMaintenanceCount: correctiveMaintenance.length,
        completedChecklistsCount,
        checklistIssuesCount,
        resolvedIssuesCount,
        openIssuesCount: checklistIssuesCount - resolvedIssuesCount,
        totalDowntime,
        availability: parseFloat(availability.toFixed(2)),
        operatingDays,
        warrantyStatus,
        daysToWarrantyExpiration
      },
      generatedAt: new Date().toISOString()
    }

    return NextResponse.json(reportData)
  } catch (error: any) {
    console.error('Error generating production report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 