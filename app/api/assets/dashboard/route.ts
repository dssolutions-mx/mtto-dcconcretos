import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get all data in parallel for better performance
    const [assetsResult, incidentsResult, schedulesResult] = await Promise.all([
      // Get all assets with organizational structure
      supabase
        .from('assets')
        .select(`
          id,
          name,
          asset_id,
          location,
          department,
          status,
          current_hours,
          current_kilometers,
          model_id,
          plant_id,
          department_id,
          plants (
            id,
            name,
            code
          ),
          departments (
            id,
            name,
            code
          ),
          equipment_models (
            id,
            name,
            maintenance_unit
          )
        `)
        .order('asset_id'),
      
      // Get pending incidents count
      supabase
        .from('incident_history')
        .select('id, asset_id, status')
        .eq('status', 'Pendiente'),
      
      // Get pending checklist schedules for additional context
      supabase
        .from('checklist_schedules')
        .select('asset_id, scheduled_date, status')
        .eq('status', 'pendiente')
    ])

    if (assetsResult.error) {
      console.error('Error fetching assets:', assetsResult.error)
      return NextResponse.json({ error: assetsResult.error.message }, { status: 500 })
    }

    const assets = assetsResult.data || []
    const pendingIncidents = incidentsResult.data || []
    const pendingSchedules = schedulesResult.data || []

    // Get maintenance intervals and history for proper maintenance status calculation
    const assetsWithModels = assets.filter(asset => asset.model_id)
    const modelIds = [...new Set(assetsWithModels.map(asset => asset.model_id!))]
    const assetIds = assets.map(asset => asset.id)
    
    let maintenanceIntervals: any[] = []
    let maintenanceHistory: any[] = []
    
    if (modelIds.length > 0) {
      // Fetch maintenance intervals for all models
      const { data: intervals, error: intervalsError } = await supabase
        .from('maintenance_intervals')
        .select('*')
        .in('model_id', modelIds)
        
      if (intervalsError) {
        console.error('Error fetching maintenance intervals:', intervalsError)
      } else {
        maintenanceIntervals = intervals || []
      }
    }
    
    if (assetIds.length > 0) {
      // Fetch maintenance history for all assets
      const { data: history, error: historyError } = await supabase
        .from('maintenance_history')
        .select('asset_id, maintenance_plan_id, hours, kilometers, date')
        .in('asset_id', assetIds)
        .order('date', { ascending: false })
        
      if (historyError) {
        console.error('Error fetching maintenance history:', historyError)
      } else {
        maintenanceHistory = history || []
      }
    }

    // Calculate stats
    const stats = {
      total: assets.length,
      operational: assets.filter(a => a.status === 'operational').length,
      maintenance: assets.filter(a => a.status === 'maintenance').length,
      repair: assets.filter(a => a.status === 'repair').length,
      inactive: assets.filter(a => a.status === 'inactive').length,
      criticalAlerts: pendingIncidents.length
    }

    // Enhance assets with proper maintenance status calculation
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const enhancedAssets = assets.map(asset => {
      const assetIncidents = pendingIncidents.filter(i => i.asset_id === asset.id)
      const assetSchedules = pendingSchedules.filter(s => s.asset_id === asset.id)
      const overdueSchedules = assetSchedules.filter(s => new Date(s.scheduled_date) < today)

      // Get maintenance intervals for this asset
      const assetIntervals = maintenanceIntervals.filter(interval => 
        interval.model_id === asset.model_id
      )
      
      // Get maintenance history for this asset
      const assetHistory = maintenanceHistory.filter(h => h.asset_id === asset.id)
      
      // Calculate proper maintenance status using same logic as individual asset page
      let hasMaintenanceOverdue = false
      let hasMaintenanceUpcoming = false
      
      if (assetIntervals.length > 0) {
        // Find the last maintenance hours for this asset
        const allMaintenanceHours = assetHistory
          .map(m => Number(m.hours) || 0)
          .filter(h => h > 0)
          .sort((a, b) => b - a) // Sort from highest to lowest
        
        const lastMaintenanceHours = allMaintenanceHours.length > 0 ? allMaintenanceHours[0] : 0
        const currentHours = asset.current_hours || 0
        
        for (const interval of assetIntervals) {
          const intervalHours = interval.interval_value || 0
          
          // Find if this specific maintenance was already performed
          const lastMaintenanceOfType = assetHistory.find(m => 
            m.maintenance_plan_id === interval.id
          )
          
          if (lastMaintenanceOfType) {
            // This maintenance was already performed, skip it
            continue
          }
          
          // Check if it was "covered" by later maintenances
          if (intervalHours <= lastMaintenanceHours) {
            // Was covered by later maintenances, skip it
            continue
          } else if (currentHours >= intervalHours) {
            // Current hours already passed this interval - OVERDUE
            hasMaintenanceOverdue = true
            break // No need to check further if we found an overdue maintenance
          } else {
            // Current hours haven't reached this interval yet - check proximity
            const hoursRemaining = intervalHours - currentHours
            if (hoursRemaining <= 100) {
              hasMaintenanceUpcoming = true
            }
          }
        }
      }

      // Determine priority status for sorting
      let priorityScore = 0
      let maintenanceStatus = 'ok'
      
      if (hasMaintenanceOverdue) {
        priorityScore = 4 // Highest priority - overdue maintenance
        maintenanceStatus = 'overdue'
      } else if (overdueSchedules.length > 0) {
        priorityScore = 3 // High priority - overdue checklists
        maintenanceStatus = 'overdue'
      } else if (assetIncidents.length > 0) {
        priorityScore = 2 // High priority - pending incidents
        maintenanceStatus = 'upcoming'
      } else if (hasMaintenanceUpcoming || assetSchedules.length > 0) {
        priorityScore = 1 // Medium priority - upcoming maintenance or checklists
        maintenanceStatus = 'upcoming'
      }

      return {
        ...asset,
        maintenance_status: maintenanceStatus,
        pending_incidents: assetIncidents.length,
        pending_schedules: assetSchedules.length,
        priority_score: priorityScore,
        alerts: [
          ...(hasMaintenanceOverdue ? ['Mantenimiento vencido'] : []),
          ...(overdueSchedules.length > 0 ? [`${overdueSchedules.length} checklist(s) atrasado(s)`] : []),
          ...(assetIncidents.length > 0 ? [`${assetIncidents.length} incidente(s) pendiente(s)`] : []),
          ...(hasMaintenanceUpcoming ? ['Mantenimiento próximo'] : []),
          ...(asset.status === 'repair' ? ['En reparación'] : []),
          ...(asset.status === 'maintenance' ? ['En mantenimiento'] : [])
        ]
      }
    })

    // Sort assets by asset_id as it was before (CR-01, CR-02, etc.)
    const sortedAssets = enhancedAssets.sort((a, b) => {
      const idA = a.asset_id
      const idB = b.asset_id
      
      // Extract prefix and number for IDs like CR-01, CR-02, etc.
      const matchA = idA.match(/^([A-Z]+)-(\d+)$/)
      const matchB = idB.match(/^([A-Z]+)-(\d+)$/)
      
      if (matchA && matchB) {
        // Both have the CR-XX format
        const prefixA = matchA[1]
        const prefixB = matchB[1]
        const numberA = parseInt(matchA[2], 10)
        const numberB = parseInt(matchB[2], 10)
        
        // First compare prefix (CR vs other prefixes)
        if (prefixA !== prefixB) {
          return prefixA.localeCompare(prefixB)
        }
        
        // Then compare numbers numerically (CR-01 < CR-02 < CR-10 < CR-21)
        return numberA - numberB
      }
      
      // Fallback to string comparison for non-standard formats
      return idA.localeCompare(idB)
    })

    // Get unique locations and departments for filtering
    const locations = [...new Set(
      assets
        .map(asset => (asset as any).plants?.name || asset.location)
        .filter(Boolean)
    )].sort()

    const departments = [...new Set(
      assets
        .map(asset => (asset as any).departments?.name || asset.department)
        .filter(Boolean)
    )].sort()

    return NextResponse.json({ 
      data: {
        assets: sortedAssets,
        stats,
        locations,
        departments,
        metadata: {
          total_maintenance_items: 0, // Simplified for now
          total_incidents: pendingIncidents.length,
          total_pending_schedules: pendingSchedules.length
        }
      }
    })
  } catch (error: any) {
    console.error('Assets dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 