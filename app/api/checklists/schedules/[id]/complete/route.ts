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
    // Get current user for proper work order attribution
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error('Error getting user:', authError)
      return NextResponse.json({ error: 'Error de autenticación' }, { status: 401 })
    }

    // Llamar a la función RPC para marcar el checklist como completado
    const { data, error } = await supabase.rpc('mark_checklist_as_completed', {
      p_schedule_id: id,
      p_completed_items: completed_items,
      p_technician: technician,
      p_notes: notes,
      p_signature_data: signature
    })
    
    if (error) {
      console.error('Error in mark_checklist_as_completed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Si hay problemas, crear una orden de trabajo COMPLETA usando el endpoint estándar
    if (data.has_issues) {
      console.log('Issues detected, creating comprehensive work order for completed checklist:', data.completed_id)
      
      // Obtener información completa del checklist y activo
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('checklist_schedules')
        .select(`
          *,
          checklists!inner(
            id,
            name,
            model_id,
            equipment_models(name, manufacturer)
          ),
          assets!inner(
            id, 
            name, 
            asset_id, 
            model_id, 
            location,
            current_hours,
            current_kilometers
          )
        `)
        .eq('id', id)
        .single()
        
      if (scheduleError) {
        console.error('Error fetching schedule data:', scheduleError)
        return NextResponse.json({ error: 'Error obteniendo datos del checklist' }, { status: 500 })
      }
      
      if (scheduleData) {
        // Obtener las issues detectadas con TODA la información
        const { data: issues, error: issuesError } = await supabase
          .from('checklist_issues')
          .select(`
            *,
            checklist_items:item_id (
              id,
              description,
              item_type,
              expected_value,
              tolerance
            )
          `)
          .eq('checklist_id', data.completed_id)
          .eq('resolved', false)
        
        if (issuesError) {
          console.error('Error fetching issues:', issuesError)
          return NextResponse.json({ error: 'Error obteniendo problemas del checklist' }, { status: 500 })
        }

        // Preparar los datos de las issues con formato completo
        const issueItems = issues?.map(issue => ({
          id: issue.id,
          item_id: issue.item_id,
          checklist_item_description: issue.checklist_items?.description || 'Item de checklist',
          status: issue.status,
          description: issue.description,
          notes: issue.notes || '',
          photo_url: issue.photo_url,
          created_at: issue.created_at,
          severity: issue.status === 'fail' ? 'high' : 'medium',
          item_type: issue.checklist_items?.item_type || 'inspection',
          expected_value: issue.checklist_items?.expected_value,
          tolerance: issue.checklist_items?.tolerance
        })) || []

        // Preparar las fotos de evidencia para creation_photos
        const creationPhotos = issues?.filter(issue => issue.photo_url)
          .map(issue => ({
            url: issue.photo_url,
            description: `Evidencia: ${issue.description} - ${issue.notes || 'Sin notas adicionales'}`,
            category: issue.status === 'fail' ? 'falla' : 'observacion',
            uploaded_at: issue.created_at || new Date().toISOString(),
            item_id: issue.item_id,
            checklist_item: issue.checklist_items?.description || 'Item de checklist'
          })) || []

        // Crear resumen detallado de problemas
        const issuesSummary = issues?.map(issue => {
          const severity = issue.status === 'fail' ? '🔴 CRÍTICO' : '🟡 ATENCIÓN'
          const itemDesc = issue.checklist_items?.description || 'Item de checklist'
          const notes = issue.notes ? ` - ${issue.notes}` : ''
          const photo = issue.photo_url ? ' [CON EVIDENCIA FOTOGRÁFICA]' : ''
          return `${severity}: ${itemDesc}${notes}${photo}`
        }).join('\n') || 'Sin detalles específicos de problemas'

        // Construir descripción completa de la orden de trabajo
        const workOrderDescription = `ORDEN CORRECTIVA GENERADA DESDE CHECKLIST

📋 CHECKLIST: ${scheduleData.checklists.name}
🏭 ACTIVO: ${scheduleData.assets.name} (${scheduleData.assets.asset_id})
📍 UBICACIÓN: ${scheduleData.assets.location || 'No especificada'}
👤 TÉCNICO: ${technician}
📅 FECHA INSPECCIÓN: ${new Date().toLocaleDateString('es-ES')}

🔍 PROBLEMAS DETECTADOS:
${issuesSummary}

📝 NOTAS ADICIONALES:
${notes || 'No se proporcionaron notas adicionales'}

⚙️ INFORMACIÓN TÉCNICA:
- Modelo: ${scheduleData.checklists.equipment_models?.name || 'No especificado'}
- Fabricante: ${scheduleData.checklists.equipment_models?.manufacturer || 'No especificado'}
- Horas actuales: ${scheduleData.assets.current_hours || 'No registradas'}
- Kilómetros actuales: ${scheduleData.assets.current_kilometers || 'No registrados'}

🎯 ACCIÓN REQUERIDA:
Esta orden de trabajo requiere atención inmediata para resolver los problemas identificados durante la inspección. Revisar evidencia fotográfica adjunta y coordinar con el equipo de mantenimiento para la planificación de la intervención.`

        // Determinar prioridad basada en los tipos de problemas
        const hasCriticalIssues = issues?.some(issue => issue.status === 'fail') || false
        const priority = hasCriticalIssues ? 'alta' : 'media'

        // Crear la orden de trabajo usando la estructura estándar
        const { data: workOrder, error: workOrderError } = await supabase
          .from('work_orders')
          .insert({
            description: workOrderDescription,
            asset_id: scheduleData.assets.id,
            priority: priority,
            status: 'pendiente',
            type: 'correctivo',
            requested_by: user?.id || null,
            checklist_id: data.completed_id,
            issue_items: issueItems,
            creation_photos: creationPhotos,
            estimated_duration: hasCriticalIssues ? 4.0 : 2.0, // Horas estimadas basadas en criticidad
            planned_date: new Date().toISOString()
          })
          .select('id, order_id, description, status, priority')
          .single()
        
        if (workOrderError) {
          console.error('Error creating comprehensive work order:', workOrderError)
          return NextResponse.json({ 
            error: 'Checklist completado pero no se pudo crear la orden de trabajo: ' + workOrderError.message 
          }, { status: 500 })
        }
        
        console.log('Comprehensive work order created successfully:', workOrder.id)
        
        // Actualizar el registro de problemas con la orden de trabajo
        const { error: updateError } = await supabase
          .from('checklist_issues')
          .update({ 
            work_order_id: workOrder.id,
            updated_at: new Date().toISOString()
          })
          .eq('checklist_id', data.completed_id)
          .eq('resolved', false)
          
        if (updateError) {
          console.error('Error updating checklist_issues with work_order_id:', updateError)
          // No retornamos error aquí porque la orden de trabajo sí se creó
        } else {
          console.log('Successfully updated checklist_issues with work_order_id:', workOrder.id)
        }
        
        // Generar incidentes en el historial del activo (opcional, si se requiere)
        try {
          for (const issue of issues || []) {
            const { error: incidentError } = await supabase
              .from('incident_history')
              .insert({
                asset_id: scheduleData.assets.id,
                type: issue.status === 'fail' ? 'Falla crítica detectada' : 'Observación de mantenimiento',
                description: `${issue.checklist_items?.description || 'Item de checklist'}: ${issue.description}`,
                severity: issue.status === 'fail' ? 'Alta' : 'Media',
                status: 'Abierto',
                reported_by: user?.id,
                work_order_id: workOrder.id,
                checklist_issue_id: issue.id,
                photos: issue.photo_url ? [{ url: issue.photo_url, description: issue.notes }] : null,
                notes: issue.notes
              })
            
            if (incidentError) {
              console.warn('Error creating incident for issue:', issue.id, incidentError)
            }
          }
        } catch (incidentCreationError) {
          console.warn('Error creating incidents:', incidentCreationError)
          // No interrumpir el flujo principal
        }
        
        // Incluir información completa de la orden de trabajo en la respuesta
        data.work_order = {
          ...workOrder,
          issue_count: issues?.length || 0,
          critical_issues: issues?.filter(i => i.status === 'fail').length || 0,
          photos_count: creationPhotos.length,
          asset_name: scheduleData.assets.name,
          asset_code: scheduleData.assets.asset_id
        }
      }
    }
    
    return NextResponse.json({
      ...data,
      message: data.has_issues 
        ? `Checklist completado con ${data.work_order?.issue_count || 0} problema(s) detectado(s). Orden de trabajo ${data.work_order?.order_id} creada.`
        : 'Checklist completado exitosamente sin problemas detectados.'
    })
  } catch (error) {
    console.error('Error completing checklist:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
} 