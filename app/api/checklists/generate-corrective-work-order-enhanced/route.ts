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

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "La descripción de la orden de trabajo es requerida" },
        { status: 400 }
      )
    }

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

    // Generate unique work order ID
    const currentYear = new Date().getFullYear()
    const { data: sequenceData, error: seqError } = await supabase
      .from('work_order_sequence')
      .select('nextval(*)')
      .single()

    if (seqError) {
      // Try alternative approach with raw SQL
      const { data: altData, error: altError } = await supabase
        .rpc('execute_sql', { 
          query: "SELECT nextval('work_order_sequence') as next_val" 
        })
      
      if (altError) {
        console.error('Error getting sequence value:', altError)
        return NextResponse.json(
          { error: "Error al generar ID de orden de trabajo" },
          { status: 500 }
        )
      }
      
      const orderNumber = String(altData[0]?.next_val || Date.now()).padStart(4, '0')
      var orderId = `OT-${currentYear}-${orderNumber}`
    } else {
      const orderNumber = String(sequenceData?.nextval || Date.now()).padStart(4, '0')
      var orderId = `OT-${currentYear}-${orderNumber}`
    }

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
      
      // Generate unique work order ID for each issue
      const { data: seqData, error: seqError } = await supabase
        .rpc('execute_sql', { 
          query: "SELECT nextval('work_order_sequence') as next_val" 
        })
      
      const currentYear = new Date().getFullYear()
      const orderNumber = String(seqData?.[0]?.next_val || Date.now()).padStart(4, '0')
      const issueOrderId = `OT-${currentYear}-${orderNumber}`

      // Create individual work order description
      const workOrderDescription = `ACCIÓN CORRECTIVA - ${issue.description}

Activo: ${(checklistData.assets as any)?.name || 'N/A'}
Código: ${(checklistData.assets as any)?.asset_id || 'N/A'}
Ubicación: ${(checklistData.assets as any)?.location || 'N/A'}

PROBLEMA DETECTADO:
• Estado: ${issue.status === 'fail' ? 'Falla' : 'Requiere revisión'}
• Descripción: ${issue.description}
• Notas: ${issue.notes || 'Sin notas adicionales'}
${issue.photo_url ? '• Evidencia fotográfica disponible' : ''}

Fuente: Checklist completado por ${description.split('\n')[0].replace('Acción correctiva generada desde checklist: ', '')}
Fecha detección: ${new Date().toLocaleDateString()}

${description.includes('NOTAS ADICIONALES') ? description.split('NOTAS ADICIONALES:')[1] : ''}`

      // Create work order
      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .insert({
          order_id: issueOrderId,
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