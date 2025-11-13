import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * Auto-create work orders for pending issues older than 1 hour
 * This endpoint should be called periodically by a cron job
 *
 * Setup instructions:
 * 1. Use Vercel Cron Jobs (add to vercel.json):
 *    {
 *      "crons": [{
 *        "path": "/api/checklists/auto-create-pending-work-orders",
 *        "schedule": "0 * * * *"  // Run every hour
 *      }]
 *    }
 *
 * 2. Or use an external cron service like cron-job.org to call this endpoint every hour
 * 3. Or call it from your monitoring dashboard periodically
 */

export async function GET() {
  try {
    const supabase = await createClient()

    console.log('🔄 Starting auto-create check for pending work orders...')

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

    if (!unresolvedIssues || unresolvedIssues.length === 0) {
      console.log('✅ No unresolved issues found')
      return NextResponse.json({
        success: true,
        message: 'No unresolved issues to process',
        auto_created_count: 0
      })
    }

    // Fetch completed checklists to get section_type information
    const checklistIds = [...new Set(unresolvedIssues.map((issue: any) => issue.checklist_id))]
    const { data: completedChecklists } = await supabase
      .from('completed_checklists')
      .select('id, completed_items, completion_date')
      .in('id', checklistIds)

    // Create a map of checklist_id -> data for quick lookup
    const checklistDataMap = new Map<string, any>()
    if (completedChecklists) {
      for (const checklist of completedChecklists) {
        checklistDataMap.set(checklist.id, checklist)
      }
    }

    // Group issues by checklist and format for processing
    const issuesByChecklist = new Map<string, any>()

    for (const issue of unresolvedIssues) {
      const checklistId = issue.checklist_id
      const checklistData = checklistDataMap.get(checklistId)

      if (!checklistData) continue

      // Get section_type from completed_items
      const completedItems = checklistData.completed_items || []
      const completedItem = completedItems.find((item: any) => item.item_id === issue.item_id)
      const sectionType = completedItem?.section_type || 'maintenance'
      const sectionTitle = completedItem?.section_title || 'Problema detectado'

      // Skip cleanliness and security sections
      if (sectionType === 'cleanliness_bonus' || sectionType === 'security_talk') {
        continue
      }

      if (!issuesByChecklist.has(checklistId)) {
        issuesByChecklist.set(checklistId, {
          checklistId: checklistId,
          assetId: issue.asset_uuid,
          assetName: issue.asset_name,
          completionDate: checklistData.completion_date,
          issues: [],
          timestamp: new Date(checklistData.completion_date).getTime()
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
    }

    const formattedIssues = Array.from(issuesByChecklist.values())

    // Auto-create work orders for issues older than 1 hour
    const ONE_HOUR_MS = 60 * 60 * 1000
    const now = Date.now()
    const autoCreatedChecklistIds: string[] = []
    const errors: string[] = []

    for (const issueGroup of formattedIssues) {
      const issueAge = now - issueGroup.timestamp

      if (issueAge > ONE_HOUR_MS) {
        console.log(`🔄 Auto-creating work orders for checklist ${issueGroup.checklistId} (${Math.round(issueAge / 1000 / 60)} minutes old)`)

        try {
          // Prepare items with issues
          const itemsWithIssues = issueGroup.issues.map((item: any) => ({
            id: item.id,
            description: item.description,
            notes: item.notes,
            photo_url: item.photo,
            status: item.status,
            sectionTitle: item.sectionTitle,
            sectionType: item.sectionType
          }))

          // Determine priorities based on status (fail = high, flag = medium)
          const priorities = itemsWithIssues.map((item: any) =>
            item.status === 'fail' ? 'Alta' : 'Media'
          )

          // Create work orders with auto-consolidation enabled (all set to 'consolidate')
          const consolidationChoices = itemsWithIssues.reduce((acc: any, item: any) => {
            acc[item.id] = 'consolidate'
            return acc
          }, {})

          // Import and call the work order creation logic directly
          const workOrderModule = await import('../generate-corrective-work-order-enhanced/route')

          // Create a mock request for the work order creation
          const workOrderBody = {
            checklist_id: issueGroup.checklistId,
            asset_id: issueGroup.assetId,
            items_with_issues: itemsWithIssues,
            priorities,
            consolidation_choices: consolidationChoices,
            auto_created: true
          }

          const mockRequest = new Request('http://localhost:3000/api/checklists/generate-corrective-work-order-enhanced', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(workOrderBody)
          })

          const workOrderResponse = await workOrderModule.POST(mockRequest as any)

          if (workOrderResponse.ok) {
            console.log(`✅ Auto-created work orders for checklist ${issueGroup.checklistId}`)
            autoCreatedChecklistIds.push(issueGroup.checklistId)
          } else {
            const errorText = await workOrderResponse.text()
            const errorMsg = `Failed to auto-create for ${issueGroup.checklistId}: ${errorText}`
            console.error(`❌ ${errorMsg}`)
            errors.push(errorMsg)
          }
        } catch (error) {
          const errorMsg = `Error auto-creating for ${issueGroup.checklistId}: ${error}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }
    }

    const responseData = {
      success: true,
      message: `Processed ${formattedIssues.length} pending issue groups`,
      auto_created_count: autoCreatedChecklistIds.length,
      auto_created_checklist_ids: autoCreatedChecklistIds,
      pending_count: formattedIssues.length - autoCreatedChecklistIds.length,
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('✅ Auto-create check completed:', responseData)

    return NextResponse.json(responseData)

  } catch (error: any) {
    console.error('Error in auto-create endpoint:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}

// Also support POST for more secure cron job calls
export async function POST() {
  return GET()
}
