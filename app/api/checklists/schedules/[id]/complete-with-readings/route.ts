import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const {
      completed_items,
      technician,
      notes,
      signature,
      hours_reading,
      kilometers_reading,
      evidence_data
    } = await request.json()

    console.log('=== COMPLETANDO CHECKLIST CON LECTURAS Y EVIDENCIAS ===')
    console.log('Schedule ID:', id)
    console.log('Technician:', technician)
    console.log('Hours reading:', hours_reading)
    console.log('Kilometers reading:', kilometers_reading)
    console.log('Items count:', completed_items?.length)
    console.log('Evidence sections:', Object.keys(evidence_data || {}).length)

    // Validar parámetros requeridos
    if (!completed_items || !Array.isArray(completed_items)) {
      return NextResponse.json(
        { error: 'Se requieren los items completados' },
        { status: 400 }
      )
    }

    if (!technician || typeof technician !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere el nombre del técnico' },
        { status: 400 }
      )
    }

    // Obtener información del activo para validar lecturas
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('checklist_schedules')
      .select(`
        id,
        asset_id,
        template_id,
        assets!inner(
          id,
          name,
          current_hours,
          current_kilometers,
          equipment_models(
            maintenance_unit
          )
        )
      `)
      .eq('id', id)
      .single()

    if (scheduleError || !scheduleData) {
      console.error('Error fetching schedule:', scheduleError)
      return NextResponse.json(
        { error: 'Checklist programado no encontrado' },
        { status: 404 }
      )
    }

    const asset = scheduleData.assets as any

    // Validar lecturas si se proporcionaron
    if (hours_reading !== null || kilometers_reading !== null) {
      const { data: validationResult, error: validationError } = await supabase
        .rpc('validate_equipment_readings', {
          p_asset_id: scheduleData.asset_id,
          p_hours_reading: hours_reading,
          p_kilometers_reading: kilometers_reading
        })

      if (validationError) {
        console.error('Error validating readings:', validationError)
        return NextResponse.json(
          { error: 'Error validando lecturas del equipo' },
          { status: 500 }
        )
      }

      if (!validationResult?.valid) {
        return NextResponse.json(
          { 
            error: 'Lecturas del equipo inválidas',
            validation_errors: validationResult?.errors || [],
            validation_warnings: validationResult?.warnings || []
          },
          { status: 400 }
        )
      }

      // Si hay advertencias, incluirlas en la respuesta pero continuar
      if (validationResult?.warnings?.length > 0) {
        console.log('Validation warnings:', validationResult.warnings)
      }
    }

    // Validar evidencias si se proporcionaron
    let evidenceValidation = null
    if (evidence_data && Object.keys(evidence_data).length > 0) {
      // Convertir evidencias a formato plano para validación
      const flattenedEvidences = Object.values(evidence_data)
        .flat()
        .map((evidence: any) => ({
          section_id: evidence.section_id,
          category: evidence.category,
          photo_url: evidence.photo_url,
          description: evidence.description || '',
          sequence_order: evidence.sequence_order || 1
        }))

      const { data: evidenceValidationResult, error: evidenceValidationError } = await supabase
        .rpc('validate_evidence_requirements', {
          p_completed_checklist_id: null, // Se validará después de crear el checklist
          p_evidence_data: flattenedEvidences
        })

      if (evidenceValidationError) {
        console.error('Error validating evidence:', evidenceValidationError)
        return NextResponse.json(
          { error: 'Error validando evidencias fotográficas' },
          { status: 500 }
        )
      }

      evidenceValidation = evidenceValidationResult

      if (!evidenceValidationResult?.valid) {
        return NextResponse.json(
          { 
            error: 'Evidencias fotográficas incompletas',
            validation_errors: evidenceValidationResult?.errors || [],
            validation_warnings: evidenceValidationResult?.warnings || []
          },
          { status: 400 }
        )
      }
    }

    // Usar la función mejorada para completar el checklist
    const { data: completionResult, error: completionError } = await supabase
      .rpc('complete_checklist_with_readings', {
        p_schedule_id: id,
        p_completed_items: completed_items,
        p_technician: technician,
        p_notes: notes || null,
        p_signature_data: signature || null,
        p_hours_reading: hours_reading,
        p_kilometers_reading: kilometers_reading
      })

    if (completionError) {
      console.error('Error completing checklist:', completionError)
      return NextResponse.json(
        { error: completionError.message || 'Error completando el checklist' },
        { status: 500 }
      )
    }

    console.log('Checklist completion result:', completionResult)

    // Guardar evidencias si se proporcionaron
    let evidenceSaveResult = null
    if (evidence_data && Object.keys(evidence_data).length > 0 && completionResult?.completed_id) {
      try {
        // Preparar evidencias para guardar
        const evidencesToSave = Object.values(evidence_data)
          .flat()
          .map((evidence: any) => ({
            ...evidence,
            completed_checklist_id: completionResult.completed_id
          }))

        const { data: saveResult, error: saveError } = await supabase
          .rpc('save_checklist_evidence', {
            p_completed_checklist_id: completionResult.completed_id,
            p_evidence_data: evidencesToSave
          })

        if (saveError) {
          console.error('Error saving evidence:', saveError)
          // No fallar el checklist por esto, solo registrar el error
        } else {
          evidenceSaveResult = saveResult
          console.log('Evidence saved successfully:', saveResult)
        }
      } catch (evidenceError) {
        console.error('Error in evidence saving process:', evidenceError)
        // No fallar el checklist por esto
      }
    }

    // Si hay problemas detectados, crear orden de trabajo correctiva
    if (completionResult?.has_issues) {
      console.log('Issues detected, creating corrective work order...')
      
      try {
        // Obtener items con problemas para la descripción
        const problemItems = completed_items
          .filter((item: any) => item.status === 'flag' || item.status === 'fail')
          .map((item: any) => `• ${item.description || 'Item'}: ${item.notes || 'Problema detectado'}`)
          .join('\n')

        const workOrderDescription = `ORDEN CORRECTIVA - Problemas detectados en checklist
        
Activo: ${asset?.name || 'Desconocido'}
Técnico: ${technician}
Fecha: ${new Date().toLocaleDateString()}

PROBLEMAS DETECTADOS:
${problemItems}

${notes ? `NOTAS ADICIONALES: ${notes}` : ''}

${evidenceSaveResult ? `EVIDENCIAS FOTOGRÁFICAS: ${evidenceSaveResult.saved_count} fotos capturadas` : ''}`

        // Crear orden de trabajo correctiva
        const { data: workOrderData, error: workOrderError } = await supabase
          .from('work_orders')
          .insert({
            asset_id: scheduleData.asset_id,
            description: workOrderDescription,
            type: 'corrective',
            priority: 'Media',
            status: 'Pendiente',
            checklist_id: completionResult.completed_id,
            issue_items: completed_items.filter((item: any) => 
              item.status === 'flag' || item.status === 'fail'
            ),
            created_at: new Date().toISOString()
          })
          .select('id, order_id')
          .single()

        if (workOrderError) {
          console.error('Error creating work order:', workOrderError)
          // No fallar el checklist por esto, solo log el error
        } else {
          console.log('Corrective work order created:', workOrderData)
        }
      } catch (workOrderCreationError) {
        console.error('Error in work order creation process:', workOrderCreationError)
        // No fallar el checklist por esto
      }
    }

    // Respuesta exitosa
    const response = {
      success: true,
      message: 'Checklist completado exitosamente',
      data: {
        completed_id: completionResult.completed_id,
        has_issues: completionResult.has_issues,
        reading_update: completionResult.reading_update,
        evidence_summary: evidenceSaveResult,
        asset_info: {
          name: asset?.name || 'Desconocido',
          previous_hours: completionResult.reading_update?.previous_hours,
          previous_kilometers: completionResult.reading_update?.previous_kilometers,
          updated_hours: completionResult.reading_update?.updated_hours,
          updated_kilometers: completionResult.reading_update?.updated_kilometers
        }
      }
    }

    // Agregar mensajes adicionales
    let messageAdditions = []
    
    if (completionResult?.has_issues) {
      messageAdditions.push('Se detectaron problemas y se creará una orden de trabajo correctiva')
    }
    
    if (evidenceSaveResult?.saved_count > 0) {
      messageAdditions.push(`Se guardaron ${evidenceSaveResult.saved_count} evidencias fotográficas`)
    }
    
    if (messageAdditions.length > 0) {
      response.message += `. ${messageAdditions.join('. ')}.`
    }

    return NextResponse.json(response)
    
  } catch (error: any) {
    console.error('Error in checklist completion:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
} 