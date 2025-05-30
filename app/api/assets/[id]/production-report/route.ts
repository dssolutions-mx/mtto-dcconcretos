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
        
        intervalAnalysis = maintenanceIntervals.map(interval => {
          const intervalHours = interval.interval_value || 0
          
          // Find maintenance records that could be related to this interval
          // Look for maintenance records that mention this interval type or are within the interval range
          const relatedMaintenanceRecords = (maintenanceHistory || []).filter(m => {
            const maintenanceHours = Number(m.hours) || 0
            const maintenanceType = (m.type || '').toLowerCase()
            const intervalType = (interval.type || '').toLowerCase()
            const intervalName = (interval.name || '').toLowerCase()
            const intervalDesc = (interval.description || '').toLowerCase()
            const maintenanceDesc = (m.description || '').toLowerCase()
            
            // Multiple ways to match maintenance to intervals:
            // 1. Direct maintenance_plan_id match
            if (m.maintenance_plan_id === interval.id) return true
            
            // 2. Type-based matching (e.g., "preventive" maintenance for "preventive" intervals)
            if (intervalType.includes('preventivo') || intervalType.includes('preventive')) {
              if (maintenanceType.includes('preventivo') || maintenanceType.includes('preventive')) {
                return true
              }
            }
            
            // 3. Content-based matching (description contains interval keywords)
            const intervalKeywords = [
              intervalType,
              intervalName,
              ...intervalDesc.split(' ').filter((word: string) => word.length > 3)
            ].filter(Boolean)
            
            const hasKeywordMatch = intervalKeywords.some(keyword => 
              maintenanceDesc.includes(keyword.toLowerCase())
            )
            
            if (hasKeywordMatch) return true
            
            // 4. Hour-based proximity matching for preventive maintenance
            if ((maintenanceType.includes('preventivo') || maintenanceType.includes('preventive')) && maintenanceHours > 0) {
              // Check if maintenance was done near an interval milestone
              const intervalMilestones = []
              for (let i = 1; i <= Math.ceil(currentHours / intervalHours) + 1; i++) {
                intervalMilestones.push(i * intervalHours)
              }
              
              // Check if maintenance was done within ±10% of any milestone
              const tolerance = intervalHours * 0.1
              return intervalMilestones.some(milestone => 
                Math.abs(maintenanceHours - milestone) <= tolerance
              )
            }
            
            return false
          })
          
          // Sort related maintenance by hours (most recent first)
          relatedMaintenanceRecords.sort((a, b) => (Number(b.hours) || 0) - (Number(a.hours) || 0))
          
          // Find the most recent relevant maintenance
          const lastMaintenanceOfType = relatedMaintenanceRecords[0]
          
          let status = 'pending'
          let progress = 0
          let nextHours = intervalHours
          let hoursOverdue = 0
          let wasPerformed = !!lastMaintenanceOfType
          let urgencyLevel = 'normal'
          
          if (lastMaintenanceOfType) {
            const lastMaintenanceHoursOfType = Number(lastMaintenanceOfType.hours) || 0
            
            // Calculate next due based on the last maintenance of this type
            nextHours = lastMaintenanceHoursOfType + intervalHours
            const hoursOverdueCalc = currentHours - nextHours
            
            if (hoursOverdueCalc >= 0) {
              status = 'overdue'
              hoursOverdue = hoursOverdueCalc
              progress = 100 + Math.round((hoursOverdueCalc / intervalHours) * 20) // Show overdue progress
              urgencyLevel = hoursOverdueCalc > intervalHours * 0.5 ? 'high' : 'medium'
            } else {
              const hoursSinceLastMaintenance = currentHours - lastMaintenanceHoursOfType
              progress = Math.min(Math.round((hoursSinceLastMaintenance / intervalHours) * 100), 100)
              
              if (progress >= 90) {
                status = 'upcoming'
                urgencyLevel = Math.abs(hoursOverdueCalc) <= 100 ? 'high' : 'medium'
              } else {
                status = 'scheduled'
                urgencyLevel = 'low'
              }
            }
          } else {
            // Never performed - check if we're past due for first performance
            if (currentHours >= intervalHours) {
              status = 'overdue'
              hoursOverdue = currentHours - intervalHours
              progress = 100
              urgencyLevel = hoursOverdue > intervalHours * 0.5 ? 'high' : 'medium'
              nextHours = intervalHours // First time due
            } else {
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
              nextHours = intervalHours // First time due
            }
          }
          
          return {
            ...interval,
            analysis: {
              status,
              progress: Math.min(progress, 150), // Cap at 150% for display
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
              relatedMaintenanceCount: relatedMaintenanceRecords.length
            }
          }
        })
        
        console.log(`Asset ${id}: Found ${maintenanceIntervals.length} intervals, ${intervalAnalysis.length} analyzed`)
      }
    }

    // 9. Calculate summary statistics
    const totalMaintenanceCost = (maintenanceHistory || [])
      .reduce((sum, record) => sum + (parseFloat(record.total_cost || '0')), 0)

    const totalIncidentCost = (incidents || [])
      .reduce((sum, incident) => sum + (parseFloat(incident.total_cost || '0')), 0)

    const totalMaintenanceHours = (maintenanceHistory || [])
      .reduce((sum, record) => sum + (record.labor_hours || 0), 0)

    const preventiveMaintenance = (maintenanceHistory || [])
      .filter(record => {
        const type = record.type?.toLowerCase()
        // Un mantenimiento es preventivo si:
        // 1. Tiene tipo explícito preventivo/preventive
        // 2. Está asociado a un plan de mantenimiento (maintenance_plan_id)
        return type === 'preventive' || type === 'preventivo' || record.maintenance_plan_id
      })

    const correctiveMaintenance = (maintenanceHistory || [])
      .filter(record => {
        const type = record.type?.toLowerCase()
        // Un mantenimiento es correctivo si:
        // 1. Tiene tipo explícito correctivo/corrective
        // 2. NO está asociado a un plan de mantenimiento Y no es preventivo
        return (type === 'corrective' || type === 'correctivo') || 
               (!record.maintenance_plan_id && type !== 'preventive' && type !== 'preventivo')
      })

    const completedChecklistsCount = (completedChecklists || []).length

    const checklistIssuesCount = (completedChecklists || [])
      .reduce((sum, checklist) => sum + (checklist.checklist_issues?.length || 0), 0)

    const resolvedIssuesCount = (completedChecklists || [])
      .reduce((sum, checklist) => {
        return sum + (checklist.checklist_issues?.filter((issue: any) => issue.resolved).length || 0)
      }, 0)

    // 10. Calculate availability and reliability metrics
    const totalDowntime = (incidents || [])
      .reduce((sum, incident) => sum + (incident.downtime || 0), 0)

    const currentDate = new Date()
    const installationDate = asset.installation_date ? new Date(asset.installation_date) : new Date(asset.created_at)
    const operatingDays = Math.ceil((currentDate.getTime() - installationDate.getTime()) / (1000 * 60 * 60 * 24))
    const totalOperatingHours = operatingDays * 24
    const availability = totalOperatingHours > 0 ? ((totalOperatingHours - totalDowntime) / totalOperatingHours) * 100 : 100

    // 11. Warranty status
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
      maintenanceHistory: maintenanceHistory || [],
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