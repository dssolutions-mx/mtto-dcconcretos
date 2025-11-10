import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const assetId = resolvedParams.id
    const { searchParams } = new URL(request.url)
    
    // Get date range parameters
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    // Set default date range (last 3 months if not specified)
    const defaultEndDate = new Date().toISOString().split('T')[0]
    const defaultStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const periodStart = startDate || defaultStartDate
    const periodEnd = endDate || defaultEndDate

    const supabase = await createClient()

    // Get asset information
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        location,
        department,
        status,
        plants:plant_id (
          name,
          location
        ),
        departments:department_id (
          name
        )
      `)
      .eq('id', assetId)
      .single()

    if (assetError || !asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Get completed checklists for the asset in the date range
    // Primero obtener los checklists completados con template_version_id
    const { data: completedChecklists, error: checklistsError } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        checklist_id,
        template_version_id,
        asset_id,
        technician,
        completion_date,
        notes,
        status,
        signature_data,
        created_by,
        completed_items,
        security_data,
        profiles:created_by (
          id,
          nombre,
          apellido,
          role,
          telefono,
          avatar_url,
          departamento
        )
      `)
      .eq('asset_id', assetId)
      .gte('completion_date', periodStart)
      .lte('completion_date', periodEnd + 'T23:59:59.999Z')
      .order('completion_date', { ascending: false })

    if (checklistsError) {
      console.error('Error fetching completed checklists:', checklistsError)
      return NextResponse.json(
        { error: 'Error fetching completed checklists' },
        { status: 500 }
      )
    }

    // Get issues for all completed checklists
    const checklistIds = completedChecklists?.map(c => c.id) || []
    
    let issues: any[] = []
    
    if (checklistIds.length > 0) {
      // Get issues related to these checklists
      const { data: issuesData, error: issuesError } = await supabase
        .from('checklist_issues')
        .select('*')
        .in('checklist_id', checklistIds)

      if (issuesError) {
        console.error('Error fetching issues:', issuesError)
      } else {
        issues = issuesData || []
      }
    }

    // Group issues by checklist
    const issuesByChecklist = issues.reduce((acc: any, issue: any) => {
      if (!acc[issue.checklist_id]) {
        acc[issue.checklist_id] = []
      }
      acc[issue.checklist_id].push({
        id: issue.id,
        description: issue.description,
        status: issue.status,
        notes: issue.notes,
        photo_url: issue.photo_url,
        work_order_id: issue.work_order_id,
        resolved: issue.resolved
      })
      return acc
    }, {})

    // Get unique template_version_ids to fetch template versions
    const templateVersionIds = [...new Set(
      (completedChecklists || [])
        .map((checklist: any) => checklist.template_version_id)
        .filter(Boolean)
    )]

    // Fetch template versions
    let templateVersionsMap = new Map()
    if (templateVersionIds.length > 0) {
      const { data: templateVersions, error: versionsError } = await supabase
        .from('checklist_template_versions')
        .select('*')
        .in('id', templateVersionIds)

      if (versionsError) {
        console.error('Error fetching template versions:', versionsError)
      } else {
        templateVersions?.forEach((version: any) => {
          templateVersionsMap.set(version.id, version)
        })
      }
    }

    // Combine data - completed_items are already in the completed_checklists records as JSON field
    const enrichedChecklists = (completedChecklists || []).map((checklist: any) => {
      // Parse completed_items if it's a JSON string
      let completedItems = checklist.completed_items || []
      if (typeof completedItems === 'string') {
        try {
          completedItems = JSON.parse(completedItems)
        } catch (error) {
          console.error('Error parsing completed_items JSON:', error)
          completedItems = []
        }
      }
      
      // Ensure completed_items is an array with proper structure
      if (!Array.isArray(completedItems)) {
        console.warn(`Completed items for checklist ${checklist.id} is not an array:`, completedItems)
        completedItems = []
      }
      
      // Get template version data for this checklist
      const templateVersion = templateVersionsMap.get(checklist.template_version_id)
      let checklistTemplateData = null
      
      if (templateVersion) {
        // Transform template version structure to match expected format
        const transformedSections = (templateVersion.sections || []).map((section: any) => ({
          ...section,
          section_type: section.section_type ?? (section.security_config ? 'security_talk' : section.section_type),
          security_config: section.security_config || null,
          checklist_items: section.items || [] // Convert 'items' to 'checklist_items'
        }))
        
        checklistTemplateData = {
          id: templateVersion.template_id,
          name: templateVersion.name,
          frequency: templateVersion.frequency,
          description: templateVersion.description,
          checklist_sections: transformedSections
        }
      }
      
      // Parse security data if present
      let securityData = checklist.security_data || null
      if (typeof securityData === 'string') {
        try {
          securityData = JSON.parse(securityData)
        } catch (error) {
          console.warn(`Failed to parse security_data for checklist ${checklist.id}:`, error)
          securityData = null
        }
      }
      
      // Log the structure for debugging
      console.log(`Checklist ${checklist.id} has ${completedItems.length} completed items`)
      if (completedItems.length > 0) {
        console.log('Sample completed item structure:', completedItems[0])
      }
      
      return {
        ...checklist,
        completed_items: completedItems,
        security_data: securityData,
        checklists: checklistTemplateData, // Add the template version data
        issues: issuesByChecklist[checklist.id] || [],
        profile: checklist.profiles // Make sure profile is included
      }
    })

    // Calculate summary statistics from all completed items
    const allCompletedItems = enrichedChecklists.reduce((acc: any[], checklist: any) => {
      return acc.concat(checklist.completed_items || [])
    }, [])
    const summary = {
      total_items: allCompletedItems.length,
      passed_items: allCompletedItems.filter(item => item.status === 'pass').length,
      flagged_items: allCompletedItems.filter(item => item.status === 'flag').length,
      failed_items: allCompletedItems.filter(item => item.status === 'fail').length,
      total_issues: issues.length
    }

    const reportData = {
      asset,
      completed_checklists: enrichedChecklists,
      total_checklists: enrichedChecklists.length,
      period_start: periodStart,
      period_end: periodEnd,
      summary
    }

    return NextResponse.json({
      success: true,
      data: reportData
    })

  } catch (error) {
    console.error('Error generating checklist evidence report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}