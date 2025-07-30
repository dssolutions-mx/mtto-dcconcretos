import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    // Use raw SQL to get checklists with issues but NO work orders
    const { data: unresolvedIssues, error } = await supabase
      .rpc('get_truly_unresolved_checklist_issues')

    if (error) {
      console.error('Error fetching unresolved issues:', error)
      return NextResponse.json(
        { error: 'Error al obtener problemas no resueltos' },
        { status: 500 }
      )
    }

    // Group issues by checklist and format for the component
    const issuesByChecklist = new Map<string, any>()

    for (const issue of unresolvedIssues || []) {
      const checklistId = issue.checklist_id

      if (!issuesByChecklist.has(checklistId)) {
        issuesByChecklist.set(checklistId, {
          id: `db-${checklistId}`, // Prefix to distinguish from local storage
          checklistId: checklistId,
          assetId: issue.asset_uuid,
          assetName: issue.asset_name,
          assetCode: issue.asset_code,
          technician: issue.technician,
          completionDate: issue.completion_date,
          issues: [],
          issueCount: 0,
          timestamp: new Date(issue.completion_date).getTime(),
          synced: true, // Database issues are always "synced"
          source: 'database'
        })
      }

      const groupedIssue = issuesByChecklist.get(checklistId)!
      groupedIssue.issues.push({
        id: issue.item_id,
        description: issue.description,
        notes: issue.notes || '',
        photo: issue.photo_url,
        status: issue.status as "flag" | "fail",
        sectionTitle: 'Problema detectado',
        sectionType: 'maintenance'
      })
      groupedIssue.issueCount++
    }

    // Convert map to array
    const formattedIssues = Array.from(issuesByChecklist.values())

    return NextResponse.json({
      success: true,
      issues: formattedIssues,
      count: formattedIssues.length
    })

  } catch (error: any) {
    console.error('Error in unresolved issues endpoint:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
} 