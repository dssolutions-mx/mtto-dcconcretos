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
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(7)
  
  try {
    console.log(`[${requestId}] 🚀 Starting cleanliness reports API request`)
    
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    console.log(`[${requestId}] 📊 Request parameters:`, {
      url: request.url,
      searchParams: Object.fromEntries(searchParams),
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    // Handle individual evaluation details request
    const evaluationId = searchParams.get('evaluation_id')
    if (evaluationId) {
      console.log(`[${requestId}] 🔍 Processing evaluation details for ID: ${evaluationId}`)
      return await getEvaluationDetails(supabase, evaluationId, requestId)
    }
    
    // Handle cleanliness reports request
    const period = searchParams.get('period') || 'current_week'
    const weekNumber = searchParams.get('week_number') // Specific week number (1-53)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const technician = searchParams.get('technician')
    const search = searchParams.get('search')

    console.log(`[${requestId}] 📋 Processing cleanliness reports with filters:`, {
      period,
      weekNumber,
      year,
      technician,
      search
    })

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
    
    // Calculate date range based on period
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

    console.log(`[${requestId}] 📅 Date range calculated:`, {
      period,
      startDate,
      endDate,
      currentWeekNumber,
      currentYear
    })

    // Get all completed WEEKLY checklists with cleanliness evaluations in the date range
    // Filter specifically for weekly checklists using template version relationships
    let baseQuery = supabase
      .from('completed_checklists')
      .select(`
        id,
        checklist_id,
        template_version_id,
        completion_date,
        technician,
        completed_items,
        notes,
        assets (
          id,
          name,
          asset_id
        ),
        checklist_template_versions!inner (
          id,
          template_id,
          version_number,
          name
        ),
        checklists!inner (
          id,
          name,
          frequency
        )
      `)
      .gte('completion_date', startDate)
      .lte('completion_date', endDate)
      .not('completed_items', 'is', null)
      .eq('checklists.frequency', 'semanal')

    if (technician && technician !== 'all') {
      baseQuery = baseQuery.ilike('technician', `%${technician}%`)
    }

    console.log(`[${requestId}] 🔍 Executing main query for completed checklists...`)
    const { data: completedChecklists, error: checklistError } = await baseQuery

    if (checklistError) {
      console.error(`[${requestId}] ❌ Error fetching completed checklists:`, checklistError)
      throw checklistError
    }

    console.log(`[${requestId}] ✅ Found ${completedChecklists?.length || 0} completed weekly checklists`)

    // Get cleanliness section items from template version JSONB sections
    const templateVersionIds = completedChecklists?.map(cc => cc.template_version_id).filter(Boolean) || []
    
    console.log(`[${requestId}] 🔧 Processing ${templateVersionIds.length} unique template versions:`, templateVersionIds)
    
    let cleanlinessItemsMap: Record<string, string[]> = {}
    
    if (templateVersionIds.length > 0) {
      const { data: templateVersions, error: templateError } = await supabase
        .from('checklist_template_versions')
        .select(`
          id,
          template_id,
          sections
        `)
        .in('id', templateVersionIds)

      if (templateError) {
        console.error(`[${requestId}] ❌ Error fetching template versions:`, templateError)
      } else {
        console.log(`[${requestId}] 📑 Retrieved ${templateVersions?.length || 0} template versions`)
      }

      if (!templateError && templateVersions) {
        // Build map of template_version_id to cleanliness item IDs by parsing JSONB sections
        for (const templateVersion of templateVersions) {
          const sections = templateVersion.sections as any[]
          if (!sections || !Array.isArray(sections)) {
            console.log(`[${requestId}] ⚠️ Template version ${templateVersion.id} has no valid sections`)
            continue
          }
          
          const cleanlinessItemIds: string[] = []
          let totalItems = 0
          let totalSections = sections.length
          let cleanlinessSections = 0
          
          // Find cleanliness sections by title and get ALL items from those sections
          for (const section of sections) {
            if (!section.items || !Array.isArray(section.items)) continue
            
            totalItems += section.items.length
            
            // Check if this is a cleanliness section by title
            if (isCleanlinessSection(section.title)) {
              cleanlinessSections++
              console.log(`[${requestId}] 🧹 Found cleanliness section "${section.title}" with ${section.items.length} items`)
              
              // Add ALL items from cleanliness sections
              for (const item of section.items) {
                cleanlinessItemIds.push(item.id)
              }
            }
          }
          
          console.log(`[${requestId}] 📊 Template ${templateVersion.id}: ${cleanlinessItemIds.length} cleanliness items from ${cleanlinessSections} cleanliness sections (total: ${totalSections} sections, ${totalItems} items)`)
          
          if (cleanlinessItemIds.length > 0) {
            cleanlinessItemsMap[templateVersion.id] = cleanlinessItemIds
          }
        }
        
        console.log(`[${requestId}] 🎯 Final cleanliness mapping:`, {
          totalTemplates: Object.keys(cleanlinessItemsMap).length,
          itemCounts: Object.fromEntries(
            Object.entries(cleanlinessItemsMap).map(([id, items]) => [id, items.length])
          )
        })
      }
    }

    const reports: CleanlinessReport[] = []

    console.log(`[${requestId}] 🔄 Processing ${completedChecklists?.length || 0} completed checklists...`)

    // Process each completed checklist
    for (const checklist of completedChecklists || []) {
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

      // Get cleanliness item IDs for this specific template version
      const templateVersionId = checklist.template_version_id
      if (!templateVersionId) continue
      
      const cleanlinessItemIds = cleanlinessItemsMap[templateVersionId] || []
      
      if (cleanlinessItemIds.length === 0) {
        continue // Skip if no cleanliness items found for this template
      }

      // Calculate cleanliness evaluation using template-specific item IDs
      const evaluation = calculateCleanlinessEvaluationByTemplate(checklist, cleanlinessItemIds)
      
      if (evaluation) {
        const asset = Array.isArray(checklist.assets) ? checklist.assets[0] : checklist.assets
        
        console.log(`[${requestId}] ✅ Processed checklist ${checklist.id} for asset ${asset?.asset_id}: ${evaluation.overall_score}% (${evaluation.passed_both ? 'PASSED' : 'FAILED'})`)
        
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
      } else {
        console.log(`[${requestId}] ⚠️ No cleanliness evaluation generated for checklist ${checklist.id}`)
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

    const executionTime = Date.now() - startTime
    
    console.log(`[${requestId}] 🎯 Final response summary:`, {
      totalReports: reports.length,
      passedReports: (stats as any).passed,
      failedReports: (stats as any).failed,
      passRate: stats.pass_rate,
      executionTime: `${executionTime}ms`
    })

    return NextResponse.json({
      reports,
      stats,
      total: reports.length
    })

  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error(`[${requestId}] ❌ Error in cleanliness reports API (${executionTime}ms):`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Error al obtener los reportes de limpieza' },
      { status: 500 }
    )
  }
}

async function getEvaluationDetails(supabase: any, evaluationId: string, requestId?: string): Promise<NextResponse> {
  const startTime = Date.now()
  const logId = requestId || Math.random().toString(36).substring(7)
  
  try {
    console.log(`[${logId}] 🔍 Getting evaluation details for ID: ${evaluationId}`)
    // Get the completed checklist with template version information (filter for weekly only)
    const { data: checklist, error: checklistError } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        checklist_id,
        template_version_id,
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
        checklist_template_versions!inner (
          id,
          name,
          version_number,
          template_id
        ),
        checklists!inner (
          id,
          name,
          frequency
        )
      `)
      .eq('id', evaluationId)
      .eq('checklists.frequency', 'semanal')
      .single()

    if (checklistError || !checklist) {
      return NextResponse.json(
        { error: 'Evaluación no encontrada o no es de tipo semanal' },
        { status: 404 }
      )
    }

    // Get cleanliness section items from the template version JSONB sections
    const { data: templateVersion, error: templateError } = await supabase
      .from('checklist_template_versions')
      .select(`
        id,
        sections
      `)
      .eq('id', checklist.template_version_id)
      .single()

    if (templateError) {
      throw templateError
    }

    // Parse cleanliness items from JSONB sections - ONLY from cleanliness sections
    // and only show sections that have completed items to avoid duplicates
    const sections = templateVersion?.sections as any[] || []
    const cleanlinessItems: any[] = []
    const completedItemIds = new Set(checklist.completed_items?.map((item: any) => item.item_id) || [])
    const processedSectionTitles = new Set<string>()
    
    for (const section of sections) {
      if (!section.items || !Array.isArray(section.items)) continue
      
      // Only process sections that are specifically cleanliness sections
      if (isCleanlinessSection(section.title)) {
        // Check if this section has any completed items
        const sectionHasCompletedItems = section.items.some((item: any) => 
          completedItemIds.has(item.id)
        )
        
        // Skip duplicate section titles or sections with no completed items
        if (!sectionHasCompletedItems || processedSectionTitles.has(section.title)) {
          continue
        }
        
        processedSectionTitles.add(section.title)
        cleanlinessItems.push({
          id: section.id,
          title: section.title,
          checklist_items: section.items.map((item: any) => ({
            id: item.id,
            description: item.description
          }))
        })
      }
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

    // Build cleanliness item IDs from template sections
    const cleanlinessItemIds = cleanlinessItems?.flatMap((section: any) => 
      section.checklist_items?.map((item: any) => item.id) || []
    ) || []

    // Filter completed items to only cleanliness items using template-specific item IDs
    const completedCleanlinessItems = checklist.completed_items?.filter((item: any) => 
      cleanlinessItemIds.includes(item.item_id)
    ) || []

    // Format cleanliness sections using template structure
    const formattedSections = cleanlinessItems?.map((section: any) => ({
      title: section.title,
      items: (section.checklist_items || []).map((templateItem: any) => {
        const completedItem = completedCleanlinessItems.find((ci: any) => ci.item_id === templateItem.id)
        return {
          id: templateItem.id,
          description: templateItem.description,
          status: completedItem?.status || 'pass',
          notes: completedItem?.notes || undefined
        }
      })
    })) || []

    const evaluation: EvaluationDetails = {
      id: checklist.id,
      asset_name: checklist.assets?.name || 'N/A',
      asset_code: checklist.assets?.asset_id || 'N/A',
      technician_name: checklist.technician || 'N/A',
      completed_date: checklist.completion_date,
      checklist_name: checklist.checklist_template_versions?.name || 'N/A',
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

    const executionTime = Date.now() - startTime
    
    console.log(`[${logId}] ✅ Successfully retrieved evaluation details:`, {
      evaluationId,
      assetName: (evaluation as any).asset_name,
      overallScore: (evaluation as any).overall_score,
      passedBoth: (evaluation as any).passed_both,
      sectionsCount: (evaluation as any).sections?.length || 0,
      totalItems: (evaluation as any).sections?.reduce((acc: number, section: any) => 
        acc + (section.checklist_items?.length || 0), 0) || 0,
      executionTime: `${executionTime}ms`
    })

    return NextResponse.json({ evaluation })

  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error(`[${logId}] ❌ Error getting evaluation details (${executionTime}ms):`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      evaluationId
    })
    return NextResponse.json(
      { error: 'Error al obtener los detalles de la evaluación' },
      { status: 500 }
    )
  }
}

// Function to identify cleanliness sections by their exact titles
function isCleanlinessSection(sectionTitle: string): boolean {
  if (!sectionTitle) return false
  
  const title = sectionTitle.toLowerCase().trim()
  
  // Exact cleanliness section titles from the database
  const cleanlinessSectionTitles = [
    'verificación de limpieza',
    'verificacion de limpieza',  // without accent
    'verificación de limpieza 1',
    'verificacion de limpieza 1', // without accent
    'limpieza',
    'cleanliness',
    'cleaning'
  ]
  
  return cleanlinessSectionTitles.includes(title)
}

function calculateCleanlinessEvaluationByTemplate(checklist: any, cleanlinessItemIds: string[]) {
  if (!checklist.completed_items || !Array.isArray(checklist.completed_items)) {
    return null
  }

  // Filter items to only cleanliness items using the template-specific item IDs
  const cleanlinessItems = checklist.completed_items.filter((item: any) => 
    cleanlinessItemIds.includes(item.item_id)
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

  // Categorize items by description patterns for interior/exterior classification
  const interiorItems = cleanlinessItems.filter((item: any) => 
    item.description?.toLowerCase().includes('interior') ||
    item.description?.toLowerCase().includes('cabina') ||
    item.description?.toLowerCase().includes('asientos') ||
    item.description?.toLowerCase().includes('espejo') ||
    item.description?.toLowerCase().includes('luz interior')
  )
  
  const exteriorItems = cleanlinessItems.filter((item: any) => 
    item.description?.toLowerCase().includes('exterior') ||
    item.description?.toLowerCase().includes('carrocería') ||
    item.description?.toLowerCase().includes('llantas')
  )
  
  const generalItems = cleanlinessItems.filter((item: any) => 
    item.description?.toLowerCase().includes('olla') ||
    item.description?.toLowerCase().includes('limpi') && 
    !item.description?.toLowerCase().includes('interior') && 
    !item.description?.toLowerCase().includes('exterior')
  )

  // Combine general items with both interior and exterior for scoring
  const allInteriorItems = [...interiorItems, ...generalItems]
  const allExteriorItems = [...exteriorItems, ...generalItems]
  
  let interiorStatus: 'pass' | 'fail' = 'pass'
  let exteriorStatus: 'pass' | 'fail' = 'pass'
  let interiorNotes = ''
  let exteriorNotes = ''

  // Check interior items (including general cleanliness)
  if (allInteriorItems.length > 0) {
    interiorStatus = getSectionStatus(allInteriorItems)
    const issueItems = allInteriorItems.filter((item: any) => 
      item.status === 'fail' || item.status === 'flag'
    )
    interiorNotes = issueItems.map((item: any) => item.notes).filter(Boolean).join('; ')
  }

  // Check exterior items (including general cleanliness)
  if (allExteriorItems.length > 0) {
    exteriorStatus = getSectionStatus(allExteriorItems)
    const issueItems = allExteriorItems.filter((item: any) => 
      item.status === 'fail' || item.status === 'flag'
    )
    exteriorNotes = issueItems.map((item: any) => item.notes).filter(Boolean).join('; ')
  }

  // If we couldn't categorize, treat all as general cleanliness
  if (allInteriorItems.length === 0 && allExteriorItems.length === 0) {
    const generalStatus = getSectionStatus(cleanlinessItems)
    const issueItems = cleanlinessItems.filter((item: any) => 
      item.status === 'fail' || item.status === 'flag'
    )
    const notes = issueItems.map((item: any) => item.notes).filter(Boolean).join('; ')
    
    interiorStatus = generalStatus
    exteriorStatus = generalStatus
    interiorNotes = notes
    exteriorNotes = notes
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