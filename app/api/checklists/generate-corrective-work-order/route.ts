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
    const { checklist_id, items_with_issues } = body

    if (!checklist_id) {
      return NextResponse.json(
        { error: "ID de checklist completado es requerido" },
        { status: 400 }
      )
    }

    // First, make sure the checklist issues are saved
    if (items_with_issues && items_with_issues.length > 0) {
      const issuesData = items_with_issues.map((item: any) => ({
        checklist_id: checklist_id,
        item_id: item.id,
        status: item.status,
        description: item.description,
        notes: item.notes || null,
        photo_url: item.photo || null,
        resolved: false,
        created_at: new Date().toISOString()
      }))

      const { error: issuesError } = await supabase
        .from('checklist_issues')
        .insert(issuesData)

      if (issuesError) {
        console.error('Error saving checklist issues:', issuesError)
        return NextResponse.json(
          { error: `Error al guardar problemas del checklist: ${issuesError.message}` },
          { status: 500 }
        )
      }
    }

    // Call the enhanced database function to generate work order and incidents
    const { data: workOrderId, error } = await supabase
      .rpc('generate_corrective_work_order_enhanced', {
        p_checklist_id: checklist_id
      })

    if (error) {
      console.error('Error generating corrective work order with incidents:', error)
      return NextResponse.json(
        { error: `Error al generar orden de trabajo correctiva: ${error.message}` },
        { status: 500 }
      )
    }

    // Get the generated work order details
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('id, order_id, description, status, priority')
      .eq('id', workOrderId)
      .single()

    if (workOrderError) {
      console.error('Error fetching generated work order:', workOrderError)
      return NextResponse.json(
        { error: 'Orden de trabajo generada pero error al obtener detalles' },
        { status: 500 }
      )
    }

    // Count how many incidents were created
    const { data: incidentsCount, error: countError } = await supabase
      .from('incident_history')
      .select('id', { count: 'exact' })
      .eq('work_order_id', workOrderId)

    return NextResponse.json({
      success: true,
      work_order_id: workOrderId,
      work_order: workOrder,
      incidents_created: incidentsCount?.length || 0,
      message: 'Orden de trabajo correctiva e incidencias generadas exitosamente'
    })

  } catch (error) {
    console.error('Error in generate corrective work order API:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 