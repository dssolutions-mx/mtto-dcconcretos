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

    // Fetch completed checklists to get section_type information
    const checklistIds = [...new Set((unresolvedIssues || []).map((issue: any) => issue.checklist_id))]
    const { data: completedChecklists } = await supabase
      .from('completed_checklists')
      .select('id, completed_items')
      .in('id', checklistIds)

    // Create a map of checklist_id -> completed_items for quick lookup
    const completedItemsMap = new Map<string, any[]>()
    if (completedChecklists) {
      for (const checklist of completedChecklists) {
        completedItemsMap.set(checklist.id, checklist.completed_items || [])
      }
    }

    // Group issues by checklist and format for the component
    const issuesByChecklist = new Map<string, any>()

    for (const issue of unresolvedIssues || []) {
      const checklistId = issue.checklist_id

      // Get section_type from completed_items
      const completedItems = completedItemsMap.get(checklistId) || []
      const completedItem = completedItems.find((item: any) => item.item_id === issue.item_id)
      const sectionType = completedItem?.section_type || 'maintenance'
      const sectionTitle = completedItem?.section_title || 'Problema detectado'

      // Skip cleanliness and security sections
      if (sectionType === 'cleanliness_bonus' || sectionType === 'security_talk') {
        continue
      }

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
        sectionTitle: sectionTitle,
        sectionType: sectionType
      })
      groupedIssue.issueCount++
    }

    // Convert map to array
    const formattedIssues = Array.from(issuesByChecklist.values())

    // Trigger auto-creation for issues older than 1 hour (database handles the logic)
    let autoCreatedCount = 0
    try {
      const { data: autoCreateResult } = await supabase
        .rpc('auto_create_pending_work_orders')

      if (autoCreateResult) {
        autoCreatedCount = autoCreateResult.created_count || 0
        if (autoCreatedCount > 0) {
          console.log(`✅ Auto-created ${autoCreatedCount} work order(s)`)
        }
      }
    } catch (error) {
      console.error('Error triggering auto-creation:', error)
      // Continue even if auto-creation fails
    }

    // Re-fetch issues after auto-creation (to exclude newly created work orders)
    let finalIssues = formattedIssues
    if (autoCreatedCount > 0) {
      // Re-run the query to get updated list
      const { data: updatedIssues } = await supabase
        .rpc('get_truly_unresolved_checklist_issues')

      if (updatedIssues) {
        // Re-process the filtered list
        const updatedIssuesByChecklist = new Map<string, any>()

        for (const issue of updatedIssues) {
          const checklistId = issue.checklist_id
          const completedItems = completedItemsMap.get(checklistId) || []
          const completedItem = completedItems.find((item: any) => item.item_id === issue.item_id)
          const sectionType = completedItem?.section_type || 'maintenance'
          const sectionTitle = completedItem?.section_title || 'Problema detectado'

          if (sectionType === 'cleanliness_bonus' || sectionType === 'security_talk') {
            continue
          }

          if (!updatedIssuesByChecklist.has(checklistId)) {
            updatedIssuesByChecklist.set(checklistId, {
              id: `db-${checklistId}`,
              checklistId: checklistId,
              assetId: issue.asset_uuid,
              assetName: issue.asset_name,
              assetCode: issue.asset_code,
              technician: issue.technician,
              completionDate: issue.completion_date,
              issues: [],
              issueCount: 0,
              timestamp: new Date(issue.completion_date).getTime(),
              synced: true,
              source: 'database'
            })
          }

          const groupedIssue = updatedIssuesByChecklist.get(checklistId)!
          groupedIssue.issues.push({
            id: issue.item_id,
            description: issue.description,
            notes: issue.notes || '',
            photo: issue.photo_url,
            status: issue.status as "flag" | "fail",
            sectionTitle: sectionTitle,
            sectionType: sectionType
          })
          groupedIssue.issueCount++
        }

        finalIssues = Array.from(updatedIssuesByChecklist.values())
      }
    }

    return NextResponse.json({
      success: true,
      issues: finalIssues,
      count: finalIssues.length,
      auto_created_count: autoCreatedCount
    })

  } catch (error: any) {
    console.error('Error in unresolved issues endpoint:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
} 