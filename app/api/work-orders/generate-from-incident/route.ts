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
    const { incident_id, priority = 'Media' } = body

    if (!incident_id) {
      return NextResponse.json(
        { error: "ID de incidente es requerido" },
        { status: 400 }
      )
    }

    // Call the database function to generate work order from incident
    const { data: workOrderId, error } = await supabase
      .rpc('generate_work_order_from_incident', {
        p_incident_id: incident_id,
        p_priority: priority
      })

    if (error) {
      console.error('Error generating work order from incident:', error)
      return NextResponse.json(
        { error: `Error al generar orden de trabajo: ${error.message}` },
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

    return NextResponse.json({
      success: true,
      work_order_id: workOrderId,
      work_order: workOrder,
      message: 'Orden de trabajo generada exitosamente desde incidente'
    })

  } catch (error) {
    console.error('Error in generate work order from incident API:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 