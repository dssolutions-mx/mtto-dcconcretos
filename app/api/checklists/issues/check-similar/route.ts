import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { asset_id, items, consolidation_window_days = 90 } = body

    if (!asset_id || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'asset_id e items son requeridos' },
        { status: 400 }
      )
    }

    const similarIssuesResults = []

    for (const item of items) {
      try {
        const { data: canonicalKey, error: canonicalKeyError } = await supabase
          .rpc('generate_canonical_issue_key', {
            p_asset_id: asset_id,
            p_description: item.description,
          })

        if (canonicalKeyError || !canonicalKey) {
          console.error('Error generating canonical key:', canonicalKeyError)
          continue
        }

        const { data: activeThreads, error: threadError } = await supabase
          .rpc('find_active_issue_thread', {
            p_asset_id: asset_id,
            p_canonical_key: canonicalKey,
          })

        if (!threadError && activeThreads && activeThreads.length > 0) {
          const thread = activeThreads[0]
          const workOrderIds = thread.work_order_id ? [thread.work_order_id] : []
          
          const { data: workOrders, error: woError } = await supabase
            .from('work_orders')
            .select(`
              id,
              order_id,
              description,
              priority,
              status,
              created_at,
              updated_at
            `)
            .in('id', workOrderIds)

          if (!woError && workOrders) {
            const workOrder = workOrders.find(wo => wo.id === thread.work_order_id)
            similarIssuesResults.push({
              item: item,
              fingerprint: canonicalKey,
              similar_issues: [{
                ...thread,
                issue_id: thread.issue_id,
                work_order: workOrder,
                assignee_name: 'Sin asignar',
              }],
              consolidation_recommended: true,
              recurrence_count: (thread.recurrence_count ?? 1) + 1,
            })
          } else {
            similarIssuesResults.push({
              item: item,
              fingerprint: canonicalKey,
              similar_issues: [thread],
              consolidation_recommended: true,
              recurrence_count: (thread.recurrence_count ?? 1) + 1,
            })
          }
        } else {
          similarIssuesResults.push({
            item: item,
            fingerprint: canonicalKey,
            similar_issues: [],
            consolidation_recommended: false,
            recurrence_count: 1,
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
