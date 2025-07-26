import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: modelId } = await params
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get templates count for this model
    const { data: templates, error: templatesError } = await supabase
      .from('checklists')
      .select('id')
      .eq('model_id', modelId)

    if (templatesError) {
      console.error('Error fetching templates:', templatesError)
      return NextResponse.json(
        { error: 'Error al obtener plantillas' },
        { status: 500 }
      )
    }

    // Get assets count for this model
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id')
      .eq('model_id', modelId)

    if (assetsError) {
      console.error('Error fetching assets:', assetsError)
      return NextResponse.json(
        { error: 'Error al obtener activos' },
        { status: 500 }
      )
    }

    const assetIds = assets?.map(asset => asset.id) || []

    // Get completed checklists count for assets of this model
    const { data: completedChecklists, error: completedError } = await supabase
      .from('completed_checklists')
      .select('id')
      .in('asset_id', assetIds.length > 0 ? assetIds : ['']) // Prevent empty IN clause

    if (completedError) {
      console.error('Error fetching completed checklists:', completedError)
      return NextResponse.json(
        { error: 'Error al obtener checklists completados' },
        { status: 500 }
      )
    }

    // Get pending issues count for this model (placeholder - issues table may not exist yet)
    let pendingIssues: any[] = []
    try {
      const { data, error } = await supabase
        .from('checklist_issues')
        .select('id')
        .eq('resolved', false)
        .in('asset_id', assetIds.length > 0 ? assetIds : ['']) // Prevent empty IN clause

      if (!error) {
        pendingIssues = data || []
      }
    } catch (error) {
      // Issues table may not exist yet, continue with zero issues
      console.log('Issues table not found, using zero count')
    }

    // Calculate recent activity (this week and this month)
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    const oneMonthAgo = new Date()
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)

    // Checklists completed this week
    const { data: recentChecklists, error: recentChecklistsError } = await supabase
      .from('completed_checklists')
      .select('id')
      .in('asset_id', assetIds.length > 0 ? assetIds : [''])
      .gte('completion_date', oneWeekAgo.toISOString())

    if (recentChecklistsError) {
      console.error('Error fetching recent checklists:', recentChecklistsError)
    }

    // Templates created this month for this model
    const { data: recentTemplates, error: recentTemplatesError } = await supabase
      .from('checklists')
      .select('id')
      .eq('model_id', modelId)
      .gte('created_at', oneMonthAgo.toISOString())

    if (recentTemplatesError) {
      console.error('Error fetching recent templates:', recentTemplatesError)
    }

    // Assets registered this month for this model
    const { data: recentAssets, error: recentAssetsError } = await supabase
      .from('assets')
      .select('id')
      .eq('model_id', modelId)
      .gte('created_at', oneMonthAgo.toISOString())

    if (recentAssetsError) {
      console.error('Error fetching recent assets:', recentAssetsError)
    }

    // Calculate average completion rate (simplified - could be more sophisticated)
    const totalTemplates = templates?.length || 0
    const totalCompleted = completedChecklists?.length || 0
    const averageCompletionRate = totalTemplates > 0 
      ? Math.min(100, Math.round((totalCompleted / totalTemplates) * 10)) // Simplified calculation
      : 0

    const stats = {
      templatesCount: totalTemplates,
      assetsCount: assets?.length || 0,
      completedChecklistsCount: totalCompleted,
      pendingIssuesCount: pendingIssues?.length || 0,
      averageCompletionRate,
      recentActivity: {
        checklistsCompletedThisWeek: recentChecklists?.length || 0,
        templatesCreatedThisMonth: recentTemplates?.length || 0,
        newAssetsThisMonth: recentAssets?.length || 0
      }
    }

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error fetching model stats:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
} 