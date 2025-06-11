import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

interface CleanlinessReport {
  id: string
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const technician = searchParams.get('technician')

    // First, get all cleanliness item IDs
    const { data: cleanlinessItems } = await supabase
      .from('checklist_sections')
      .select(`
        checklist_items(
          id,
          description
        )
      `)
      .eq('section_type', 'cleanliness_bonus')

    if (!cleanlinessItems || cleanlinessItems.length === 0) {
      return NextResponse.json({
        reports: [],
        stats: {
          total_evaluations: 0,
          pass_rate: 0,
          passed_count: 0,
          top_performers: []
        }
      })
    }

    // Get all cleanliness item IDs
    const allCleanlinessItems: any[] = []
    cleanlinessItems.forEach((section: any) => {
      if (section.checklist_items) {
        allCleanlinessItems.push(...section.checklist_items)
      }
    })

    const cleanlinessItemIds = allCleanlinessItems.map(item => item.id)

    // Build query for completed checklists
    let query = supabase
      .from('completed_checklists')
      .select(`
        id,
        completion_date,
        technician,
        completed_items,
        assets(
          name,
          asset_id
        )
      `)

    if (startDate) {
      query = query.gte('completion_date', startDate)
    }
    if (endDate) {
      query = query.lte('completion_date', endDate)
    }
    if (technician) {
      query = query.eq('technician', technician)
    }

    const { data: completedChecklists } = await query

    const cleanlinessReports: CleanlinessReport[] = []

    if (completedChecklists) {
      for (const evaluation of completedChecklists) {
        if (!evaluation.completed_items || !Array.isArray(evaluation.completed_items)) {
          continue
        }

        // Filter only cleanliness items
        const cleanlinessCompletedItems = evaluation.completed_items.filter((item: any) => 
          cleanlinessItemIds.includes(item.item_id)
        )

        if (cleanlinessCompletedItems.length === 0) {
          continue
        }

        // Find interior and exterior items
        const interiorItem = cleanlinessCompletedItems.find((item: any) => {
          const cleanlinessItem = allCleanlinessItems.find(ci => ci.id === item.item_id)
          return cleanlinessItem?.description?.toLowerCase().includes('interior')
        })

        const exteriorItem = cleanlinessCompletedItems.find((item: any) => {
          const cleanlinessItem = allCleanlinessItems.find(ci => ci.id === item.item_id)
          return cleanlinessItem?.description?.toLowerCase().includes('exterior')
        })

        const interiorStatus = interiorItem?.status === 'pass' ? 'pass' : 'fail'
        const exteriorStatus = exteriorItem?.status === 'pass' ? 'pass' : 'fail'
        
        const passedItems = [interiorStatus, exteriorStatus].filter(status => status === 'pass').length
        const overallScore = Math.round((passedItems / 2) * 100)
        const passedBoth = interiorStatus === 'pass' && exteriorStatus === 'pass'
        
        const asset = Array.isArray(evaluation.assets) ? evaluation.assets[0] : evaluation.assets
        
        cleanlinessReports.push({
          id: evaluation.id,
          asset_name: asset?.name || 'N/A',
          asset_code: asset?.asset_id || 'N/A',
          technician_name: evaluation.technician || 'N/A',
          completed_date: evaluation.completion_date,
          interior_status: interiorStatus,
          exterior_status: exteriorStatus,
          interior_notes: interiorItem?.notes || '',
          exterior_notes: exteriorItem?.notes || '',
          overall_score: overallScore,
          passed_both: passedBoth
        })
      }
    }

    // Calculate statistics
    const totalEvaluations = cleanlinessReports.length
    const passedEvaluations = cleanlinessReports.filter(r => r.passed_both).length
    const passRate = totalEvaluations > 0 ? (passedEvaluations / totalEvaluations) * 100 : 0

    // Calculate top performers
    const technicianStats: Record<string, { total: number; passed: number }> = {}
    cleanlinessReports.forEach(report => {
      const tech = report.technician_name
      if (!technicianStats[tech]) {
        technicianStats[tech] = { total: 0, passed: 0 }
      }
      technicianStats[tech].total++
      if (report.passed_both) {
        technicianStats[tech].passed++
      }
    })

    const topPerformers = Object.entries(technicianStats)
      .map(([technician, stats]) => ({
        technician,
        score: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0,
        evaluations: stats.total
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    const statsResult: CleanlinessStats = {
      total_evaluations: totalEvaluations,
      pass_rate: Math.round(passRate),
      passed_count: passedEvaluations,
      top_performers: topPerformers
    }

    return NextResponse.json({
      reports: cleanlinessReports,
      stats: statsResult
    })

  } catch (error) {
    console.error('Error in cleanliness reports API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cleanliness reports' },
      { status: 500 }
    )
  }
} 