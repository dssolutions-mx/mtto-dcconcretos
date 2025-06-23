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

    // Calculate stats
    const stats = {
      total: assets.length,
      operational: assets.filter(a => a.status === 'operational').length,
      maintenance: assets.filter(a => a.status === 'maintenance').length,
      repair: assets.filter(a => a.status === 'repair').length,
      inactive: assets.filter(a => a.status === 'inactive').length,
      criticalAlerts: pendingIncidents.length
    }

    // Enhance assets with basic priority information
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const enhancedAssets = assets.map(asset => {
      const assetIncidents = pendingIncidents.filter(i => i.asset_id === asset.id)
      const assetSchedules = pendingSchedules.filter(s => s.asset_id === asset.id)
      const overdueSchedules = assetSchedules.filter(s => new Date(s.scheduled_date) < today)

      // Determine priority status for sorting
      let priorityScore = 0
      let maintenanceStatus = 'ok'
      
      if (overdueSchedules.length > 0) {
        priorityScore = 3 // Highest priority - overdue checklists
        maintenanceStatus = 'overdue'
      } else if (assetIncidents.length > 0) {
        priorityScore = 2 // High priority - pending incidents
        maintenanceStatus = 'upcoming'
      } else if (assetSchedules.length > 0) {
        priorityScore = 1 // Medium priority - upcoming checklists
        maintenanceStatus = 'upcoming'
      }

      // Simple maintenance check based on current hours
      const currentHours = asset.current_hours || 0
      const hasHighHours = currentHours > 1000 // Simple threshold
      if (hasHighHours && priorityScore === 0) {
        priorityScore = 1
        maintenanceStatus = 'upcoming'
      }

      return {
        ...asset,
        maintenance_status: maintenanceStatus,
        pending_incidents: assetIncidents.length,
        pending_schedules: assetSchedules.length,
        priority_score: priorityScore,
        alerts: [
          ...(overdueSchedules.length > 0 ? [`${overdueSchedules.length} checklist(s) atrasado(s)`] : []),
          ...(assetIncidents.length > 0 ? [`${assetIncidents.length} incidente(s) pendiente(s)`] : []),
          ...(hasHighHours ? ['Horas altas - revisar mantenimiento'] : []),
          ...(asset.status === 'repair' ? ['En reparación'] : []),
          ...(asset.status === 'maintenance' ? ['En mantenimiento'] : [])
        ]
      }
    })

    // Sort assets properly with numeric sorting for asset_id and priority
    const sortedAssets = enhancedAssets.sort((a, b) => {
      // First sort by priority (critical alerts first)
      if (a.priority_score !== b.priority_score) {
        return b.priority_score - a.priority_score
      }

      // Then sort by asset_id numerically (CR-09 < CR-16 < CR-21 < CR-26)
      const idA = a.asset_id
      const idB = b.asset_id
      
      // Extract prefix and number for IDs like CR-26, CR-09, etc.
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
        
        // Then compare numbers numerically
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