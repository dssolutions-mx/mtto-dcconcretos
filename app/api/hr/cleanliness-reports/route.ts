import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

interface CleanlinessReport {
  id: string
  asset_id?: string // For operator lookup
  asset_name: string
  asset_code: string
  technician_name: string
  completed_date: string
  interior_status: 'pass' | 'fail'
  exterior_status: 'pass' | 'fail'
  interior_notes: string
  exterior_notes: string
  overall_score: number
  passed_both: boolean
  // Operator information
  primary_operator_name?: string
  primary_operator_code?: string
  secondary_operator_name?: string
}

interface CleanlinessStats {
  total_evaluations: number
  pass_rate: number
  passed_count: number
  top_performers: Array<{
    technician: string
    score: number
    evaluations: number
  }>
}

interface EvaluationDetails {
  id: string
  asset_name: string
  asset_code: string
  technician_name: string
  completed_date: string
  checklist_name: string
  cleanliness_sections: Array<{
    title: string
    items: Array<{
      id: string
      description: string
      status: 'pass' | 'fail' | 'flag'
      notes?: string
    }>
  }>
  notes: string
  signature_data?: string
  evidence: Array<{
    id: string
    category: string
    description: string
    photo_url: string
    sequence_order: number
    created_at: string
  }>
  // Operator information
  primary_operator_name?: string
  primary_operator_code?: string
  secondary_operator_name?: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    // Handle individual evaluation details request
    const evaluationId = searchParams.get('evaluation_id')
    if (evaluationId) {
      return await getEvaluationDetails(supabase, evaluationId)
    }
    
    // Handle cleanliness reports request
    const period = searchParams.get('period') || 'current_week'
    const weekNumber = searchParams.get('week_number') // Specific week number (1-53)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const technician = searchParams.get('technician')
    const search = searchParams.get('search')

    // Group cleanliness items by checklist template to avoid duplicates
    const cleanlinessItemsByTemplate = await supabase
      .from('checklist_sections')
      .select(`
        checklist_id,
        id,
        title,
        checklist_items (
          id,
          description
        )
      `)
      .eq('section_type', 'cleanliness_bonus')

    if (cleanlinessItemsByTemplate.error) {
      throw cleanlinessItemsByTemplate.error
    }

    // Process each template separately to avoid cross-contamination
    const templatesData = cleanlinessItemsByTemplate.data.reduce((acc, section) => {
      const templateId = section.checklist_id
      if (!acc[templateId]) {
        acc[templateId] = {
          sections: [],
          itemIds: []
        }
      }
      
      acc[templateId].sections.push({
        id: section.id,
        title: section.title,
        items: section.checklist_items || []
      })
      
      const itemIds = (section.checklist_items || []).map(item => item.id)
      acc[templateId].itemIds.push(...itemIds)
      
      return acc
    }, {} as Record<string, any>)

    // Calculate date range based on week number and year (UTC-based for consistency with database)
    let startDate = ''
    let endDate = ''
    const now = new Date()
    
    // Helper function to get ISO week number (UTC-based)
    function getISOWeek(date: Date): number {
      const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
      const dayNum = (target.getUTCDay() + 6) % 7
      target.setUTCDate(target.getUTCDate() - dayNum + 3)
      const firstThursday = target.valueOf()
      target.setUTCMonth(0, 1)
      if (target.getUTCDay() !== 4) {
        target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7)
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
    }

    // Helper function to get UTC start and end dates of a specific week
    function getWeekDatesUTC(year: number, week: number): { start: Date, end: Date } {
      // Start with January 1st of the given year in UTC
      const firstDay = new Date(Date.UTC(year, 0, 1))
      
      // Find the first Monday of the year (or the Monday of week 1)
      const firstMonday = new Date(firstDay)
      const dayOfWeek = firstDay.getUTCDay()
      const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek // Sunday = 0, so we need 1 day to Monday
      firstMonday.setUTCDate(firstDay.getUTCDate() + daysToMonday - 7) // Go to previous Monday for week 1
      
      // Calculate the target week start (Monday)
      const targetWeekStart = new Date(firstMonday)
      targetWeekStart.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7)
      
      // Calculate the target week end (Sunday 23:59:59.999)
      const targetWeekEnd = new Date(targetWeekStart)
      targetWeekEnd.setUTCDate(targetWeekStart.getUTCDate() + 6)
      targetWeekEnd.setUTCHours(23, 59, 59, 999)
      
      return { start: targetWeekStart, end: targetWeekEnd }
    }

    const currentYear = parseInt(year)
    const currentWeekNumber = getISOWeek(now)
    
    if (period === 'specific_week' && weekNumber) {
      // Filter by specific week number
      const targetWeek = parseInt(weekNumber)
      const { start, end } = getWeekDatesUTC(currentYear, targetWeek)
      startDate = start.toISOString()
      endDate = end.toISOString()
    } else if (period === 'current_week') {
      // Filter by current week
      const { start, end } = getWeekDatesUTC(currentYear, currentWeekNumber)
      startDate = start.toISOString()
      endDate = end.toISOString()
    } else if (period === 'last_4_weeks') {
      // Last 4 weeks for broader comparison
      const { start } = getWeekDatesUTC(currentYear, Math.max(1, currentWeekNumber - 3))
      const { end } = getWeekDatesUTC(currentYear, currentWeekNumber)
      startDate = start.toISOString()
      endDate = end.toISOString()
    } else {
      // Default to current week
      const { start, end } = getWeekDatesUTC(currentYear, currentWeekNumber)
      startDate = start.toISOString()
      endDate = end.toISOString()
    }

    const reports: CleanlinessReport[] = []
    const processedChecklistIds = new Set<string>()

    // Process each template separately
    for (const [templateId, templateData] of Object.entries(templatesData)) {
      const { itemIds } = templateData as any

      if (itemIds.length === 0) continue

      // Get completed checklists for this template with operator information
      let query = supabase
        .from('completed_checklists')
        .select(`
          id,
          checklist_id,
          completion_date,
          technician,
          completed_items,
          notes,
          assets (
            id,
            name,
            asset_id
          ),
          checklists(
            id,
            name,
            frequency,
            description
          )
        `)
        .eq('checklist_id', templateId)
        .gte('completion_date', startDate)
        .lte('completion_date', endDate)

      if (technician && technician !== 'all') {
        query = query.ilike('technician', `%${technician}%`)
      }

      const { data: completedChecklists, error: checklistError } = await query

      if (checklistError) {
        throw checklistError
      }

      // Process each completed checklist
      for (const checklist of completedChecklists || []) {
        // Skip if already processed (avoid duplicates)
        if (processedChecklistIds.has(checklist.id)) {
          continue
        }
        processedChecklistIds.add(checklist.id)

                 // Apply search filter if provided
         if (search) {
           const asset = Array.isArray(checklist.assets) ? checklist.assets[0] : checklist.assets
           const assetMatches = asset?.name?.toLowerCase().includes(search.toLowerCase()) ||
                                asset?.asset_id?.toLowerCase().includes(search.toLowerCase())
           const technicianMatches = checklist.technician?.toLowerCase().includes(search.toLowerCase())
          
          if (!assetMatches && !technicianMatches) {
            continue
          }
        }

        // Calculate cleanliness evaluation
        const evaluation = calculateCleanlinessEvaluation(checklist, itemIds)
        
                         if (evaluation) {
          const asset = Array.isArray(checklist.assets) ? checklist.assets[0] : checklist.assets
          reports.push({
            id: checklist.id,
            asset_id: asset?.id, // Store asset ID for operator lookup
            asset_name: asset?.name || 'N/A',
            asset_code: asset?.asset_id || 'N/A',
            technician_name: checklist.technician || 'N/A',
            completed_date: checklist.completion_date,
            interior_status: evaluation.interior_status,
            exterior_status: evaluation.exterior_status,
            interior_notes: evaluation.interior_notes,
            exterior_notes: evaluation.exterior_notes,
            overall_score: evaluation.overall_score,
            passed_both: evaluation.passed_both
          })
        }
      }
    }

    // Fetch operator information for all assets in the reports
    if (reports.length > 0) {
      const assetIds = reports.map(r => r.asset_id).filter(Boolean)
      
      if (assetIds.length > 0) {
        const { data: operatorAssignments, error: operatorError } = await supabase
          .from('asset_operators_full')
          .select(`
            asset_id,
            assignment_type,
            operator_nombre,
            operator_apellido,
            employee_code,
            status
          `)
          .in('asset_id', assetIds)
          .eq('status', 'active')

        if (!operatorError && operatorAssignments) {
          // Create a map of asset_id to operators
          const operatorMap = operatorAssignments.reduce((acc, op) => {
            if (!acc[op.asset_id]) {
              acc[op.asset_id] = { primary: null, secondary: [] }
            }
            
            const operatorName = `${op.operator_nombre || ''} ${op.operator_apellido || ''}`.trim()
            const operatorInfo = {
              name: operatorName,
              code: op.employee_code
            }

            if (op.assignment_type === 'primary') {
              acc[op.asset_id].primary = operatorInfo
            } else if (op.assignment_type === 'secondary') {
              acc[op.asset_id].secondary.push(operatorInfo)
            }
            
            return acc
          }, {} as Record<string, { primary: any, secondary: any[] }>)

          // Update reports with operator information
          reports.forEach(report => {
            if (report.asset_id && operatorMap[report.asset_id]) {
              const operators = operatorMap[report.asset_id]
              
              if (operators.primary) {
                report.primary_operator_name = operators.primary.name
                report.primary_operator_code = operators.primary.code
              }
              
              if (operators.secondary && operators.secondary.length > 0) {
                // Join multiple secondary operators
                report.secondary_operator_name = operators.secondary
                  .map(op => op.name)
                  .filter(Boolean)
                  .join(', ')
              }
            }
            
            // Remove asset_id from final response as it's only needed for lookup
            delete report.asset_id
          })
        }
      }
    }

    // Calculate statistics
    const stats = calculateStats(reports)

    // Sort reports by date (most recent first)
    reports.sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime())

    return NextResponse.json({
      reports,
      stats,
      total: reports.length
    })

  } catch (error) {
    console.error('Error in cleanliness reports API:', error)
    return NextResponse.json(
      { error: 'Error al obtener los reportes de limpieza' },
      { status: 500 }
    )
  }
}

async function getEvaluationDetails(supabase: any, evaluationId: string): Promise<NextResponse> {
  try {
    // Get the completed checklist
    const { data: checklist, error: checklistError } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        checklist_id,
        completion_date,
        technician,
        completed_items,
        notes,
        signature_data,
        assets (
          id,
          name,
          asset_id
        ),
        checklists (
          name
        )
      `)
      .eq('id', evaluationId)
      .single()

    if (checklistError || !checklist) {
      return NextResponse.json(
        { error: 'Evaluación no encontrada' },
        { status: 404 }
      )
    }

    // Get only cleanliness sections for this checklist
    const { data: cleanlinessSections, error: sectionsError } = await supabase
      .from('checklist_sections')
      .select(`
        id,
        title,
        checklist_items (
          id,
          description
        )
      `)
      .eq('checklist_id', checklist.checklist_id)
      .eq('section_type', 'cleanliness_bonus')

    if (sectionsError) {
      throw sectionsError
    }

    // Get checklist evidence
    const { data: evidence, error: evidenceError } = await supabase
      .from('checklist_evidence')
      .select(`
        id,
        category,
        description,
        photo_url,
        sequence_order,
        created_at
      `)
      .eq('completed_checklist_id', evaluationId)
      .order('category')
      .order('sequence_order')

    if (evidenceError) {
      console.error('Error fetching evidence:', evidenceError)
      // Don't throw error, just continue without evidence
    }

         // Format cleanliness sections with completed status
     const formattedSections = cleanlinessSections.map((section: any) => ({
       title: section.title,
       items: (section.checklist_items || []).map((item: any) => {
        const completedItem = checklist.completed_items?.find((ci: any) => ci.item_id === item.id)
        return {
          id: item.id,
          description: item.description,
          status: completedItem?.status || 'pass',
          notes: completedItem?.notes || undefined
        }
      })
    }))

    const evaluation: EvaluationDetails = {
      id: checklist.id,
      asset_name: checklist.assets?.name || 'N/A',
      asset_code: checklist.assets?.asset_id || 'N/A',
      technician_name: checklist.technician || 'N/A',
      completed_date: checklist.completion_date,
      checklist_name: checklist.checklists?.name || 'N/A',
      cleanliness_sections: formattedSections,
      notes: checklist.notes || '',
      signature_data: checklist.signature_data || undefined,
      evidence: evidence || []
    }

    // Fetch operator information for this specific asset
    if (checklist.assets?.id) {
      const { data: operatorAssignments, error: operatorError } = await supabase
        .from('asset_operators_full')
        .select(`
          assignment_type,
          operator_nombre,
          operator_apellido,
          employee_code,
          status
        `)
        .eq('asset_id', checklist.assets.id)
        .eq('status', 'active')

      if (!operatorError && operatorAssignments) {
        const primaryOperator = operatorAssignments.find((op: any) => op.assignment_type === 'primary')
        const secondaryOperators = operatorAssignments.filter((op: any) => op.assignment_type === 'secondary')
        
        if (primaryOperator) {
          evaluation.primary_operator_name = `${primaryOperator.operator_nombre || ''} ${primaryOperator.operator_apellido || ''}`.trim()
          evaluation.primary_operator_code = primaryOperator.employee_code || undefined
        }
        
        if (secondaryOperators.length > 0) {
          evaluation.secondary_operator_name = secondaryOperators
            .map((op: any) => `${op.operator_nombre || ''} ${op.operator_apellido || ''}`.trim())
            .filter(Boolean)
            .join(', ')
        }
      }
    }

    return NextResponse.json({ evaluation })

  } catch (error) {
    console.error('Error getting evaluation details:', error)
    return NextResponse.json(
      { error: 'Error al obtener los detalles de la evaluación' },
      { status: 500 }
    )
  }
}

function calculateCleanlinessEvaluation(checklist: any, itemIds: string[]) {
  if (!checklist.completed_items || !Array.isArray(checklist.completed_items)) {
    return null
  }

  // Filter items to only cleanliness items for this template
  const cleanlinessItems = checklist.completed_items.filter((item: any) => 
    itemIds.includes(item.item_id)
  )

  if (cleanlinessItems.length === 0) {
    return null
  }

  // Function to calculate score based on status
  const getItemScore = (status: string): number => {
    switch (status) {
      case 'pass': return 1.0  // 100%
      case 'flag': return 0.5  // 50% - observación
      case 'fail': return 0.0  // 0% - falla
      default: return 1.0
    }
  }

  // Function to determine if a section passes (threshold: 75%)
  const getSectionStatus = (items: any[]): 'pass' | 'fail' => {
    if (items.length === 0) return 'pass'
    
    const totalScore = items.reduce((sum: number, item: any) => sum + getItemScore(item.status), 0)
    const averageScore = totalScore / items.length
    
    return averageScore >= 0.75 ? 'pass' : 'fail'
  }

  // Categorize items (assuming interior/exterior based on description)
  const interiorItems = cleanlinessItems.filter((item: any) => 
    item.description?.toLowerCase().includes('interior') ||
    item.description?.toLowerCase().includes('cabina') ||
    item.description?.toLowerCase().includes('asientos')
  )
  
  const exteriorItems = cleanlinessItems.filter((item: any) => 
    item.description?.toLowerCase().includes('exterior') ||
    item.description?.toLowerCase().includes('carrocería') ||
    item.description?.toLowerCase().includes('llantas')
  )

  // If we can't categorize, treat all as general cleanliness
  const hasCategories = interiorItems.length > 0 || exteriorItems.length > 0
  
  let interiorStatus: 'pass' | 'fail' = 'pass'
  let exteriorStatus: 'pass' | 'fail' = 'pass'
  let interiorNotes = ''
  let exteriorNotes = ''

  if (hasCategories) {
    // Check interior items using weighted scoring
    if (interiorItems.length > 0) {
      interiorStatus = getSectionStatus(interiorItems)
      const issueItems = interiorItems.filter((item: any) => 
        item.status === 'fail' || item.status === 'flag'
      )
      interiorNotes = issueItems.map((item: any) => item.notes).filter(Boolean).join('; ')
    }

    // Check exterior items using weighted scoring
    if (exteriorItems.length > 0) {
      exteriorStatus = getSectionStatus(exteriorItems)
      const issueItems = exteriorItems.filter((item: any) => 
        item.status === 'fail' || item.status === 'flag'
      )
      exteriorNotes = issueItems.map((item: any) => item.notes).filter(Boolean).join('; ')
    }
  } else {
    // General cleanliness evaluation using weighted scoring
    const generalStatus = getSectionStatus(cleanlinessItems)
    const issueItems = cleanlinessItems.filter((item: any) => 
      item.status === 'fail' || item.status === 'flag'
    )
    
    interiorStatus = generalStatus
    exteriorStatus = generalStatus
    interiorNotes = issueItems.map((item: any) => item.notes).filter(Boolean).join('; ')
    exteriorNotes = interiorNotes
  }

  // Calculate overall score using weighted scoring (pass=100%, flag=50%, fail=0%)
  const totalItems = cleanlinessItems.length
  const totalScore = cleanlinessItems.reduce((sum: number, item: any) => sum + getItemScore(item.status), 0)
  const overallScore = Math.round((totalScore / totalItems) * 100)

  return {
    interior_status: interiorStatus,
    exterior_status: exteriorStatus,
    interior_notes: interiorNotes,
    exterior_notes: exteriorNotes,
    overall_score: overallScore,
    passed_both: interiorStatus === 'pass' && exteriorStatus === 'pass'
  }
}

function calculateStats(reports: CleanlinessReport[]): CleanlinessStats {
  const totalEvaluations = reports.length
  const passedCount = reports.filter(r => r.passed_both).length
  const passRate = totalEvaluations > 0 ? (passedCount / totalEvaluations) * 100 : 0

  // Calculate top performing operators (those assigned to assets, not technicians who evaluated)
  const operatorStats = reports.reduce((acc, report) => {
    // Only consider reports where there's an assigned operator
    if (report.primary_operator_name) {
      const operator = report.primary_operator_name
      if (!acc[operator]) {
        acc[operator] = { total: 0, passed: 0 }
      }
      acc[operator].total++
      if (report.passed_both) {
        acc[operator].passed++
      }
    }
    return acc
  }, {} as Record<string, { total: number, passed: number }>)

  const topPerformers = Object.entries(operatorStats)
    .map(([operator, stats]) => ({
      technician: operator, // Keep field name for compatibility with frontend
      score: (stats.passed / stats.total) * 100,
      evaluations: stats.total
    }))
    .filter(p => p.evaluations >= 1) // Only include operators with at least 1 evaluation
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return {
    total_evaluations: totalEvaluations,
    pass_rate: passRate,
    passed_count: passedCount,
    top_performers: topPerformers
  }
} 