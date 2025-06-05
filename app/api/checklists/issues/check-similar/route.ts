import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { asset_id, items, consolidation_window_days = 30 } = body

    if (!asset_id || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'asset_id e items son requeridos' },
        { status: 400 }
      )
    }

    const similarIssuesResults = []

    // Check each item for similar issues
    for (const item of items) {
      try {
        // Generate fingerprint for this issue
        const { data: fingerprint, error: fingerprintError } = await supabase
          .rpc('generate_issue_fingerprint', {
            p_asset_id: asset_id,
            p_item_description: item.description,
            p_status: item.status,
            p_notes: item.notes || ''
          })

        if (fingerprintError || !fingerprint) {
          console.error('Error generating fingerprint:', fingerprintError)
          continue
        }

        // Find similar open issues
        const { data: similarIssues, error: similarError } = await supabase
          .rpc('find_similar_open_issues', {
            p_fingerprint: fingerprint,
            p_asset_id: asset_id,
            p_consolidation_window: `${consolidation_window_days} days`
          })

        if (!similarError && similarIssues && similarIssues.length > 0) {
          // Get work order details for the similar issues
          const workOrderIds = [...new Set(similarIssues.map((issue: any) => issue.work_order_id))]
          
          const { data: workOrders, error: woError } = await supabase
            .from('work_orders')
            .select(`
              id,
              order_id,
              description,
              priority,
              status,
              created_at,
              updated_at,
              profiles:assigned_to(nombre, apellido)
            `)
            .in('id', workOrderIds)

          if (!woError && workOrders) {
            const enrichedSimilarIssues = similarIssues.map((issue: any) => {
              const workOrder = workOrders.find(wo => wo.id === issue.work_order_id)
              return {
                ...issue,
                work_order: workOrder,
                assignee_name: workOrder?.profiles ? 
                  `${(workOrder.profiles as any).nombre} ${(workOrder.profiles as any).apellido}` : 
                  'Sin asignar'
              }
            })

            similarIssuesResults.push({
              item: item,
              fingerprint: fingerprint,
              similar_issues: enrichedSimilarIssues,
              consolidation_recommended: true,
              recurrence_count: enrichedSimilarIssues[0]?.recurrence_count + 1 || 2
            })
          }
        } else {
          // No similar issues found
          similarIssuesResults.push({
            item: item,
            fingerprint: fingerprint,
            similar_issues: [],
            consolidation_recommended: false,
            recurrence_count: 1
          })
        }
      } catch (itemError) {
        console.error(`Error checking item ${item.id}:`, itemError)
        continue
      }
    }

    return NextResponse.json({
      success: true,
      asset_id: asset_id,
      consolidation_window_days: consolidation_window_days,
      items_checked: items.length,
      similar_issues_results: similarIssuesResults,
      total_with_similar_issues: similarIssuesResults.filter(r => r.similar_issues.length > 0).length,
      summary: {
        new_work_orders: similarIssuesResults.filter(r => r.similar_issues.length === 0).length,
        consolidations: similarIssuesResults.filter(r => r.similar_issues.length > 0).length
      }
    })

  } catch (error) {
    console.error('Error checking for similar issues:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 