import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

interface ComplianceReport {
  business_unit_id: string
  business_unit_name: string
  plant_id: string
  plant_name: string
  asset_id: string
  asset_name: string
  asset_code: string
  checklist_name: string
  frequency: string
  days_overdue: number
  weeks_overdue: number
  last_completed: string | null
  assigned_technician: string | null
  scheduled_date: string
  status: 'pending' | 'overdue' | 'critical'
  recurrence_pattern: string
}

interface ComplianceStats {
  total_assets: number
  compliant_assets: number
  overdue_assets: number
  critical_assets: number
  compliance_rate: number
  average_days_overdue: number
  business_unit_breakdown: Array<{
    business_unit: string
    total: number
    compliant: number
    overdue: number
    compliance_rate: number
  }>
  plant_breakdown: Array<{
    plant: string
    business_unit: string
    total: number
    compliant: number
    overdue: number
    compliance_rate: number
  }>
}

function calculateRecurrencePattern(
  completionHistory: any[],
  frequency: string,
  daysOverdue: number
): string {
  if (completionHistory.length === 0) {
    return `Sin historial - ${daysOverdue} días sin completar`
  }
  
  const avgGap = completionHistory.length > 1 ? 
    completionHistory.reduce((sum, _, index, arr) => {
      if (index === 0) return sum
      return sum + (new Date(arr[index-1].completion_date).getTime() - new Date(arr[index].completion_date).getTime()) / (1000 * 60 * 60 * 24)
    }, 0) / (completionHistory.length - 1) : 0
  
  return `Frecuencia: ${frequency} - Promedio entre completados: ${Math.round(avgGap)} días`
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const businessUnit = searchParams.get('business_unit')
    const plant = searchParams.get('plant')
    const severity = searchParams.get('severity') // 'all', 'overdue', 'critical'
    const period = searchParams.get('period') || '30' // days to look back
    
    const today = new Date()
    
    // Step 1: Get ALL operational assets first to ensure complete compliance coverage
    let assetsQuery = supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        plant_id,
        plants (
          id,
          name,
          business_unit_id,
          business_units (
            id,
            name
          )
        )
      `)
      .eq('status', 'operational') // Only include operational assets
    
    // Apply filters to assets
    if (businessUnit && businessUnit !== 'all') {
      assetsQuery = assetsQuery.eq('plants.business_unit_id', businessUnit)
    }
    
    if (plant && plant !== 'all') {
      assetsQuery = assetsQuery.eq('plant_id', plant)
    }
    
    const { data: allAssets, error: assetsError } = await assetsQuery
    
    if (assetsError) {
      console.error('Error fetching assets:', assetsError)
      return NextResponse.json({ error: 'Error fetching assets' }, { status: 500 })
    }
    
    if (!allAssets || allAssets.length === 0) {
      return NextResponse.json({ 
        reports: [], 
        stats: {
          total_assets: 0,
          compliant_assets: 0,
          overdue_assets: 0,
          critical_assets: 0,
          compliance_rate: 0,
          average_days_overdue: 0,
          business_unit_breakdown: [],
          plant_breakdown: []
        }
      })
    }
    
    // Step 2: Get all checklist schedules for these assets
    const assetIds = allAssets.map(a => a.id)
    
    // Get only OVERDUE schedules (past due date and not completed)
    // Use a date that's clearly before today to avoid timezone issues
    const yesterdayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59)
    
    const { data: allSchedules, error: schedulesError } = await supabase
      .from('checklist_schedules')
      .select(`
        id,
        scheduled_date,
        status,
        assigned_to,
        template_id,
        asset_id,
        checklists (
          id,
          name,
          frequency
        )
      `)
      .in('asset_id', assetIds)
      .lte('scheduled_date', yesterdayEnd.toISOString()) // Only dates up to yesterday
      .neq('status', 'completado') // Exclude completed checklists
    
    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError)
      return NextResponse.json({ error: 'Error fetching schedules' }, { status: 500 })
    }
    
    // Step 3: Get completion history for pattern analysis
    const { data: completionHistory, error: completionError } = await supabase
      .from('completed_checklists')
      .select('asset_id, checklist_id, completion_date')
      .in('asset_id', assetIds)
      .gte('completion_date', new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
    
    if (completionError) {
      console.error('Error fetching completion history:', completionError)
    }
    
    // Step 4: Get technician names for assigned users
    const assignedUserIds = [...new Set(allSchedules?.map((s: any) => s.assigned_to).filter(Boolean))]
    let technicianProfiles: any[] = []
    
    if (assignedUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nombre, apellido')
        .in('id', assignedUserIds)
      
      if (!profilesError && profiles) {
        technicianProfiles = profiles
      }
    }
    
    // Step 5: Process compliance reports for ALL assets
    const reports: ComplianceReport[] = []
    
    // Group schedules by asset for efficient processing
    const schedulesByAsset = new Map()
    allSchedules?.forEach((schedule: any) => {
      const assetId = schedule.asset_id
      if (!schedulesByAsset.has(assetId)) {
        schedulesByAsset.set(assetId, [])
      }
      schedulesByAsset.get(assetId).push(schedule)
    })
    
    // Process each asset to determine compliance status
    for (const asset of allAssets) {
      const plant = Array.isArray(asset.plants) ? asset.plants[0] : asset.plants
      const businessUnit = plant?.business_units ? 
        (Array.isArray(plant.business_units) ? plant.business_units[0] : plant.business_units) : null
      
      if (!plant || !businessUnit) continue
      
      const assetSchedules = schedulesByAsset.get(asset.id) || []
      
      // If no overdue schedules for this asset, skip it (compliant)
      if (assetSchedules.length === 0) {
        // Asset is compliant - no overdue checklists
        continue
      }
      
      // Process each schedule for this asset
      for (const schedule of assetSchedules) {
        const checklist = Array.isArray(schedule.checklists) ? 
          schedule.checklists[0] : schedule.checklists
        
        if (!checklist) continue
        
        const scheduledDate = new Date(schedule.scheduled_date)
        const daysOverdue = Math.floor((today.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24))
        const weeksOverdue = Math.floor(daysOverdue / 7)
        
        // Double-check: Skip if not actually overdue (safety filter)
        if (daysOverdue < 1) continue
        
        // Find last completion for this asset/checklist combination
        const lastCompletion = completionHistory
          ?.filter(h => h.asset_id === asset.id && h.checklist_id === checklist.id)
          .sort((a, b) => new Date(b.completion_date).getTime() - new Date(a.completion_date).getTime())[0]
        
        // Calculate recurrence pattern
        const recurrencePattern = calculateRecurrencePattern(
          completionHistory?.filter(h => h.asset_id === asset.id && h.checklist_id === checklist.id) || [],
          checklist.frequency,
          daysOverdue
        )
        
        // Determine status based on days overdue (all schedules here are already overdue)
        let status: 'pending' | 'overdue' | 'critical' = 'overdue'
        if (daysOverdue > 14) {
          status = 'critical'
        } else if (daysOverdue > 7) {
          status = 'overdue'
        } else {
          status = 'overdue' // Still overdue but recent
        }
        
        // Apply severity filter
        if (severity && severity !== 'all') {
          if (severity === 'overdue' && status === 'critical') continue
          if (severity === 'critical' && status !== 'critical') continue
        }
        
        // Get technician name from profiles
        const technician = technicianProfiles.find(p => p.id === schedule.assigned_to)
        const technicianName = technician 
          ? `${technician.nombre || ''} ${technician.apellido || ''}`.trim()
          : null
        
        reports.push({
          business_unit_id: businessUnit.id,
          business_unit_name: businessUnit.name,
          plant_id: plant.id,
          plant_name: plant.name,
          asset_id: asset.id,
          asset_name: asset.name,
          asset_code: asset.asset_id,
          checklist_name: checklist.name,
          frequency: checklist.frequency || 'No especificada',
          days_overdue: Math.max(0, daysOverdue),
          weeks_overdue: Math.max(0, weeksOverdue),
          last_completed: lastCompletion?.completion_date || null,
          assigned_technician: technicianName,
          scheduled_date: schedule.scheduled_date,
          status,
          recurrence_pattern: recurrencePattern
        })
      }
    }
    
    // Step 6: Calculate statistics based on overdue analysis
    // Group reports by asset to determine overall asset compliance status
    const assetsWithOverdue = new Set(reports.map(r => r.asset_id))
    const compliantAssets = allAssets.filter(asset => !assetsWithOverdue.has(asset.id))
    
    const assetComplianceMap = new Map()
    reports.forEach(report => {
      const assetId = report.asset_id
      if (!assetComplianceMap.has(assetId)) {
        assetComplianceMap.set(assetId, {
          asset_id: assetId,
          asset_name: report.asset_name,
          business_unit_id: report.business_unit_id,
          business_unit_name: report.business_unit_name,
          plant_id: report.plant_id,
          plant_name: report.plant_name,
          statuses: [],
          days_overdue: []
        })
      }
      assetComplianceMap.get(assetId).statuses.push(report.status)
      assetComplianceMap.get(assetId).days_overdue.push(report.days_overdue)
    })
    
    // Determine overall status for each asset with overdue items
    const overdueAssetStatuses = Array.from(assetComplianceMap.values()).map(asset => {
      let overallStatus = 'overdue'
      
      if (asset.statuses.includes('critical')) {
        overallStatus = 'critical'
      }
      
      const maxDaysOverdue = asset.days_overdue.length > 0 ? Math.max(...asset.days_overdue) : 0
      
      return {
        ...asset,
        overall_status: overallStatus,
        max_days_overdue: maxDaysOverdue
      }
    })
    
    const stats: ComplianceStats = {
      total_assets: allAssets.length,
      compliant_assets: compliantAssets.length, // Assets without overdue checklists
      overdue_assets: overdueAssetStatuses.length, // Assets with overdue checklists
      critical_assets: overdueAssetStatuses.filter(a => a.overall_status === 'critical').length,
      compliance_rate: 0,
      average_days_overdue: 0,
      business_unit_breakdown: [],
      plant_breakdown: []
    }
    
    stats.compliance_rate = allAssets.length > 0 ? (stats.compliant_assets / allAssets.length) * 100 : 0
    
    stats.average_days_overdue = overdueAssetStatuses.length > 0 
      ? overdueAssetStatuses.reduce((sum, a) => sum + a.max_days_overdue, 0) / overdueAssetStatuses.length 
      : 0
    
    // Business unit breakdown
    const buGroups = new Map()
    allAssets.forEach(asset => {
      const plant = Array.isArray(asset.plants) ? asset.plants[0] : asset.plants
      const bu = plant?.business_units ? 
        (Array.isArray(plant.business_units) ? plant.business_units[0] : plant.business_units) : null
      
      if (bu) {
        if (!buGroups.has(bu.id)) {
          buGroups.set(bu.id, { name: bu.name, assets: [] })
        }
        buGroups.get(bu.id).assets.push(asset.id)
      }
    })
    
    stats.business_unit_breakdown = Array.from(buGroups.entries()).map(([buId, buData]: [string, any]) => {
      const buOverdueAssets = overdueAssetStatuses.filter(a => buData.assets.includes(a.asset_id))
      const buCompliantAssets = compliantAssets.filter(a => buData.assets.includes(a.id))
      const total = buData.assets.length
      const compliant = buCompliantAssets.length
      const overdue = buOverdueAssets.length
      
      return {
        business_unit: buData.name,
        total,
        compliant,
        overdue,
        compliance_rate: total > 0 ? (compliant / total) * 100 : 0
      }
    })
    
    // Plant breakdown
    const plantGroups = new Map()
    allAssets.forEach(asset => {
      const plant = Array.isArray(asset.plants) ? asset.plants[0] : asset.plants
      const bu = plant?.business_units ? 
        (Array.isArray(plant.business_units) ? plant.business_units[0] : plant.business_units) : null
      
      if (plant && bu) {
        if (!plantGroups.has(plant.id)) {
          plantGroups.set(plant.id, { 
            name: plant.name, 
            business_unit: bu.name,
            assets: [] 
          })
        }
        plantGroups.get(plant.id).assets.push(asset.id)
      }
    })
    
    stats.plant_breakdown = Array.from(plantGroups.entries()).map(([plantId, plantData]: [string, any]) => {
      const plantOverdueAssets = overdueAssetStatuses.filter(a => plantData.assets.includes(a.asset_id))
      const plantCompliantAssets = compliantAssets.filter(a => plantData.assets.includes(a.id))
      const total = plantData.assets.length
      const compliant = plantCompliantAssets.length
      const overdue = plantOverdueAssets.length
      
      return {
        plant: plantData.name,
        business_unit: plantData.business_unit,
        total,
        compliant,
        overdue,
        compliance_rate: total > 0 ? (compliant / total) * 100 : 0
      }
    })
    
    return NextResponse.json({ reports, stats })
    
  } catch (error: any) {
    console.error('Error in checklist compliance API:', error)
    return NextResponse.json({ 
      error: 'Error al cargar los datos de cumplimiento',
      details: error.message 
    }, { status: 500 })
  }
} 