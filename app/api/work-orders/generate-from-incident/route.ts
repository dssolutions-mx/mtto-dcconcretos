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

    // Get the generated work order (with asset_id for plant_id update)
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .select('id, order_id, asset_id, description, status, priority')
      .eq('id', workOrderId)
      .single()

    if (workOrderError) {
      console.error('Error fetching generated work order:', workOrderError)
      return NextResponse.json(
        { error: 'Orden de trabajo generada pero error al obtener detalles' },
        { status: 500 }
      )
    }

    // Post-update: set plant_id from asset and creation_photos from incident documents
    const updatePayload: Record<string, unknown> = {}

    if (workOrder?.asset_id) {
      const { data: assetRow } = await supabase
        .from('assets')
        .select('plant_id')
        .eq('id', workOrder.asset_id)
        .single()
      if (assetRow?.plant_id) {
        updatePayload.plant_id = assetRow.plant_id
      }
    }

    // Map incident documents to work_orders.creation_photos
    const { data: incident } = await supabase
      .from('incident_history')
      .select('documents')
      .eq('id', incident_id)
      .single()

    if (incident?.documents && Array.isArray(incident.documents) && incident.documents.length > 0) {
      const mappedPhotos = incident.documents.map((d: string | { url?: string; description?: string; category?: string; uploaded_at?: string }) => {
        if (typeof d === 'string') {
          return { url: d, description: '', category: 'incident', uploaded_at: new Date().toISOString() }
        }
        return {
          url: d.url ?? '',
          description: d.description ?? '',
          category: d.category ?? 'incident',
          uploaded_at: d.uploaded_at ?? new Date().toISOString()
        }
      })
      updatePayload.creation_photos = mappedPhotos
    }

    if (Object.keys(updatePayload).length > 0) {
      await supabase
        .from('work_orders')
        .update(updatePayload)
        .eq('id', workOrderId)
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