import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { technician, notes, signature, completed_items } = await request.json()
  
  try {
    // Llamar a la función RPC para marcar el checklist como completado
    const { data, error } = await supabase.rpc('mark_checklist_as_completed', {
      p_schedule_id: id,
      p_completed_items: completed_items,
      p_technician: technician,
      p_notes: notes,
      p_signature_data: signature
    })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Si hay problemas, crear una orden de trabajo
    if (data.has_issues) {
      // Obtener información del checklist
      const { data: scheduleData } = await supabase
        .from('checklist_schedules')
        .select(`
          *,
          checklists(name),
          assets(id, name, asset_id, model_id)
        `)
        .eq('id', id)
        .single()
        
      if (scheduleData) {
        // Crear una orden de trabajo para los problemas detectados
        const { data: workOrder, error: workOrderError } = await supabase
          .from('work_orders')
          .insert({
            title: `Problemas detectados en checklist ${scheduleData.checklists.name}`,
            description: `Durante la inspección se detectaron problemas que requieren atención.\n\nNotas: ${notes || 'No se proporcionaron notas adicionales'}`,
            asset_id: scheduleData.assets.id,
            priority: 'media',
            status: 'pendiente',
            type: 'correctivo',
            requested_by: technician,
            reported_issue: 'Problemas detectados durante checklist de inspección',
            completed_checklist_id: data.completed_id
          })
          .select()
          .single()
        
        if (workOrderError) {
          console.error('Error creating work order:', workOrderError)
        } else {
          // Actualizar el registro de problemas con la orden de trabajo
          await supabase
            .from('checklist_issues')
            .update({ work_order_id: workOrder.id })
            .eq('checklist_id', data.completed_id)
        }
          
        // Incluir información de la orden de trabajo en la respuesta
        data.work_order = workOrder
      }
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error completing checklist:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
} 