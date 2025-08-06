import { createClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check for Authorization header first (for offline service requests)
    const authHeader = request.headers.get('authorization')
    let supabase
    
    if (authHeader?.startsWith('Bearer ')) {
      // Create client with the provided token for Zustand auth
      const token = authHeader.replace('Bearer ', '')
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          },
          cookies: {
            getAll: () => [],
            setAll: () => {}
          }
        }
      )
    } else {
      // Use normal cookie-based auth
      supabase = await createClient()
    }
    
    const {
      completed_items,
      technician,
      notes,
      signature,
      hours_reading,
      kilometers_reading,
      evidence_data
    } = await request.json()

    console.log('=== COMPLETANDO CHECKLIST SIN AUTO-WORK-ORDER ===')
    console.log('Schedule ID:', id)
    console.log('Technician:', technician)
    console.log('Hours reading:', hours_reading)
    console.log('Kilometers reading:', kilometers_reading)
    console.log('Items count:', completed_items?.length)
    console.log('Evidence sections:', Object.keys(evidence_data || {}).length)
    console.log('Full payload:', JSON.stringify({
      completed_items,
      technician,
      notes,
      signature,
      hours_reading,
      kilometers_reading,
      evidence_data
    }, null, 2))

    // Validar parámetros requeridos
    if (!completed_items || !Array.isArray(completed_items)) {
      console.error('Missing or invalid completed_items:', completed_items)
      return NextResponse.json(
        { error: 'Se requieren los items completados' },
        { status: 400 }
      )
    }

    if (!technician || typeof technician !== 'string') {
      console.error('Missing or invalid technician:', technician)
      return NextResponse.json(
        { error: 'Se requiere el nombre del técnico' },
        { status: 400 }
      )
    }

    // Validate completed_items structure
    for (let i = 0; i < completed_items.length; i++) {
      const item = completed_items[i]
      if (!item.item_id || !item.status) {
        console.error(`Invalid item at index ${i}:`, item)
        return NextResponse.json(
          { error: `Item ${i} inválido: se requiere item_id y status` },
          { status: 400 }
        )
      }
      if (!['pass', 'fail', 'flag', 'na'].includes(item.status)) {
        console.error(`Invalid status for item ${i}:`, item.status)
        return NextResponse.json(
          { error: `Item ${i} tiene status inválido: ${item.status}` },
          { status: 400 }
        )
      }
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

    // 🛡️ PROTECCIÓN ANTI-DUPLICADOS: Verificar si este checklist ya fue completado recientemente
    console.log('🔍 Checking for recent completions to prevent duplicates...')
    const { data: recentCompletions, error: recentError } = await supabase
      .from('completed_checklists')
      .select('id, completion_date, technician, notes')
      .eq('checklist_id', scheduleData.template_id)
      .eq('asset_id', scheduleData.asset_id)
      .gte('completion_date', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Within last hour
      .order('completion_date', { ascending: false })

    if (!recentError && recentCompletions && recentCompletions.length > 0) {
      for (const completion of recentCompletions) {
        const completionTime = new Date(completion.completion_date).getTime()
        const now = Date.now()
        const timeDiffMinutes = (now - completionTime) / (1000 * 60)
        
        // If completed within last 10 minutes by same technician, likely duplicate from offline sync
        if (timeDiffMinutes < 10 && completion.technician === technician) {
          console.log(`⚠️ DUPLICATE PREVENTION: Found recent completion by same technician`, {
            existingId: completion.id,
            existingTime: completion.completion_date,
            technician: completion.technician,
            timeDiffMinutes: Math.round(timeDiffMinutes * 100) / 100
          })
          
          return NextResponse.json({
            success: true,
            message: 'Checklist ya fue completado recientemente - evitando duplicado',
            data: {
              completed_id: completion.id,
              is_duplicate_prevented: true,
              original_completion_date: completion.completion_date,
              time_difference_minutes: Math.round(timeDiffMinutes * 100) / 100
            }
          })
        }
      }
      
      // Log all recent completions for debugging
      console.log(`📊 Found ${recentCompletions.length} recent completions for this asset/template:`)
      recentCompletions.forEach((comp, index) => {
        const timeDiff = (Date.now() - new Date(comp.completion_date).getTime()) / (1000 * 60)
        console.log(`  ${index + 1}. ID: ${comp.id}, Technician: ${comp.technician}, ${Math.round(timeDiff)} min ago`)
      })
    }

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

    // 🔄 VERSIONING: Asegurar que el template tiene versión antes de completar
    let templateVersionId = null
    try {
      console.log('🔍 Ensuring template versioning before completion...')
      
      // Obtener versión activa existente
      const { data: activeVersion, error: versionError } = await supabase
        .from('checklist_template_versions')
        .select('id')
        .eq('template_id', scheduleData.template_id)
        .eq('is_active', true)
        .single()

      if (activeVersion && !versionError) {
        templateVersionId = activeVersion.id
        console.log('✅ Template tiene versión activa:', templateVersionId)
      } else {
        console.log('⚠️ Template sin versión, creando automáticamente...')
        
        // Crear versión inicial automáticamente
        const { data: newVersionId, error: createVersionError } = await supabase.rpc(
          'create_template_version',
          {
            p_template_id: scheduleData.template_id,
            p_change_summary: 'Versión inicial - creada automáticamente al completar checklist',
            p_migration_notes: 'Auto-creada por sistema de versionado (complete-with-readings)'
          }
        )

        if (createVersionError) {
          console.error('❌ Error creando versión automática:', createVersionError)
          // Continuar sin versioning como fallback
        } else {
          templateVersionId = newVersionId
          console.log('✅ Versión automática creada:', templateVersionId)
        }
      }
    } catch (versioningError) {
      console.error('⚠️ Error en versioning (no crítico):', versioningError)
      // Continuar sin template_version_id
    }

    // Usar la función mejorada para completar el checklist
    console.log('=== CALLING complete_checklist_with_readings RPC ===')
    console.log('Parameters:', {
      p_schedule_id: id,
      p_completed_items: completed_items,
      p_technician: technician,
      p_notes: notes || null,
      p_signature_data: signature || null,
      p_hours_reading: hours_reading,
      p_kilometers_reading: kilometers_reading,
      template_version_ensured: templateVersionId ? 'YES' : 'NO'
    })

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
      console.error('=== RPC ERROR ===')
      console.error('Error details:', completionError)
      console.error('Error message:', completionError.message)
      console.error('Error code:', completionError.code)
      console.error('Error hint:', completionError.hint)
      console.error('Error details:', completionError.details)
      
      return NextResponse.json(
        { 
          error: completionError.message || 'Error completando el checklist',
          details: completionError.details || '',
          code: completionError.code || '',
          hint: completionError.hint || ''
        },
        { status: 500 }
      )
    }

    if (!completionResult) {
      console.error('=== NO RESULT FROM RPC ===')
      return NextResponse.json(
        { error: 'No se obtuvo resultado del procedimiento de completado' },
        { status: 500 }
      )
    }

    console.log('=== RPC SUCCESS ===')
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

    // Respuesta exitosa - NO crear work orders automáticamente
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