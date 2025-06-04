import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
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

    const body = await request.json()
    const { 
      checklist_id, 
      items_with_issues, 
      priority = "Media",
      description,
      asset_id 
    } = body

    if (!checklist_id) {
      return NextResponse.json(
        { error: "ID de checklist completado es requerido" },
        { status: 400 }
      )
    }

    if (!items_with_issues || items_with_issues.length === 0) {
      return NextResponse.json(
        { error: "Se requieren elementos con problemas para generar la orden correctiva" },
        { status: 400 }
      )
    }

    // Description is now optional - each work order gets its own specific description
    // Additional notes from user will be appended if provided

    // Get checklist and asset information
    const { data: checklistData, error: checklistError } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        checklist_id,
        assets!inner(
          id,
          name,
          asset_id,
          location
        ),
        checklists!inner(
          name
        )
      `)
      .eq('id', checklist_id)
      .single()

    if (checklistError || !checklistData) {
      console.error('Error fetching checklist info:', checklistError)
      return NextResponse.json(
        { error: "No se pudo obtener información del checklist" },
        { status: 500 }
      )
    }

    // Note: order_id will be generated automatically by database trigger

    // First, save the checklist issues
    const issuesData = items_with_issues.map((item: any) => ({
      checklist_id: checklist_id,
      item_id: item.id,
      status: item.status,
      description: item.description,
      notes: item.notes || null,
      photo_url: item.photo || null,
      resolved: false,
      created_at: new Date().toISOString(),
      created_by: user.id
    }))

    const { data: savedIssues, error: issuesError } = await supabase
      .from('checklist_issues')
      .insert(issuesData)
      .select('id, item_id, status, description, notes, photo_url')

    if (issuesError) {
      console.error('Error saving checklist issues:', issuesError)
      return NextResponse.json(
        { error: `Error al guardar problemas del checklist: ${issuesError.message}` },
        { status: 500 }
      )
    }

    // Create individual work orders and incidents for each issue
    const createdWorkOrders = []
    const createdIncidents = []

    for (const issue of savedIssues) {
      const item = items_with_issues.find((i: any) => i.id === issue.item_id)
      
      // Note: order_id will be generated automatically by database trigger

      // Create individual work order description
      let workOrderDescription = `${issue.description}

PROBLEMA: ${issue.status === 'fail' ? 'FALLA DETECTADA' : 'REQUIERE REVISIÓN'}
${issue.notes ? `Observaciones: ${issue.notes}` : ''}${issue.photo_url ? '\nEvidencia fotográfica disponible' : ''}

ORIGEN:
• Checklist: ${(checklistData.checklists as any)?.name || 'N/A'}
• Fecha: ${new Date().toLocaleDateString()}
• Activo: ${(checklistData.assets as any)?.name || 'N/A'} (${(checklistData.assets as any)?.asset_id || 'N/A'})
• Ubicación: ${(checklistData.assets as any)?.location || 'N/A'}`

      // Add additional context if provided by user
      if (description && description.trim()) {
        workOrderDescription += `\n\nCONTEXTO ADICIONAL:\n${description.trim()}`
      }

      // Create work order (order_id will be generated automatically by trigger)
      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .insert({
          asset_id: asset_id,
          description: workOrderDescription.trim(),
          type: 'corrective',
          priority: priority,
          status: 'Pendiente',
          checklist_id: checklist_id,
          issue_items: [issue],
          requested_by: user.id,
          created_at: new Date().toISOString()
        })
        .select('id, order_id, description, status, priority')
        .single()

      if (workOrderError) {
        console.error(`Error creating work order for issue ${issue.id}:`, workOrderError)
        continue // Continue with other issues
      }

      createdWorkOrders.push(workOrder)

      // Update checklist issue with work order ID
      await supabase
        .from('checklist_issues')
        .update({ work_order_id: workOrder.id })
        .eq('id', issue.id)

      // Create individual incident
      const { data: incident, error: incidentError } = await supabase
        .from('incident_history')
        .insert({
          asset_id: asset_id,
          date: new Date().toISOString(),
          type: 'Mantenimiento',
          description: `${issue.description} - ${issue.notes || 'Problema detectado en checklist'}`,
          impact: priority === 'Alta' ? 'Alto' : (priority === 'Media' ? 'Medio' : 'Bajo'),
          status: 'Abierto',
          reported_by: user.id,
          created_by: user.id,
          work_order_id: workOrder.id,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (!incidentError && incident) {
        createdIncidents.push(incident)
        
        // Update checklist issue with incident ID
        await supabase
          .from('checklist_issues')
          .update({ incident_id: incident.id })
          .eq('id', issue.id)
      }
    }

    // Update asset status to maintenance if priority is high
    if (priority === 'Alta' && createdWorkOrders.length > 0) {
      await supabase
        .from('assets')
        .update({ status: 'maintenance' })
        .eq('id', asset_id)
    }

    return NextResponse.json({
      success: true,
      work_orders_created: createdWorkOrders.length,
      work_orders: createdWorkOrders,
      incidents_created: createdIncidents.length,
      issues_saved: savedIssues?.length || 0,
      message: `Se crearon ${createdWorkOrders.length} órdenes de trabajo correctivas (una por cada problema detectado) con prioridad ${priority.toLowerCase()}`
    })

  } catch (error) {
    console.error('Error in enhanced corrective work order generation:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 