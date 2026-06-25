import { createClient } from '@/lib/supabase-server'
import { enrichEquipmentReadingsValidation } from '@/lib/checklist/equipment-readings-validation'
import {
  assertCanCompleteChecklistSchedule,
  resolveScheduleAuthContext,
} from '@/lib/checklist/executor-authorization'
import { isOperationsEvaluationCompletedItem } from '@/lib/checklist/section-funnel'
import { loadActorContext } from '@/lib/auth/server-authorization'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import {
  saveChecklistTireReadings,
  type ChecklistTireReadingInput,
} from '@/lib/tires/checklist-readings'
import { clearedScheduleDraftRowUpdate } from '@/lib/checklist/schedule-draft'
import { writeAllOperatorEvaluationEvents } from '@/lib/hr/operator-evaluation-events'

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

    // Verify user is authenticated and has permission to complete checklists
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json(
        { error: 'Perfil no encontrado o inactivo' },
        { status: 403 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.status !== 'active') {
      return NextResponse.json(
        { error: 'Perfil no encontrado o inactivo' },
        { status: 403 }
      )
    }
    
    const {
      completed_items,
      technician,
      notes,
      signature,
      hours_reading,
      kilometers_reading,
      evidence_data,
      security_data,
      plant_operations_data,
      tire_readings,
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
        scheduled_day,
        scheduled_date,
        checklists!template_id (
          executor_roles,
          model_id,
          equipment_models ( maintenance_unit )
        ),
        assets!inner(
          id,
          name,
          plant_id,
          model_id,
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

    const { executorRoles, asset: authAsset } =
      resolveScheduleAuthContext(scheduleData)

    const assetRow = Array.isArray(scheduleData.assets)
      ? scheduleData.assets[0]
      : scheduleData.assets
    const asset = assetRow as {
      id?: string
      name?: string
      plant_id?: string | null
      model_id?: string | null
      current_hours?: number | null
      current_kilometers?: number | null
      equipment_models?: { maintenance_unit?: string | null } | null
    }

    const completionAuth = await assertCanCompleteChecklistSchedule(
      supabase,
      actor,
      executorRoles,
      authAsset
    )

    if (!completionAuth.allowed) {
      return NextResponse.json(
        {
          error: 'No tiene permisos para completar este checklist',
          details: completionAuth.reason,
        },
        { status: 403 }
      )
    }

    // De-duplication is handled deterministically inside complete_checklist_with_readings,
    // which is idempotent per schedule_id (returns the existing completion instead of
    // inserting a second one). The previous heuristic here keyed on template + asset +
    // technician within a 10-minute window, which both MISSED real duplicates (retries
    // that span more than 10 min) and, worse, DISCARDED legitimate completions when an
    // operator synced several days' worth of the same daily checklist for one asset at
    // once. That is why it was removed.

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
        const enriched = enrichEquipmentReadingsValidation(validationResult, {
          hours_reading,
          kilometers_reading,
        })

        return NextResponse.json(
          {
            error: 'Lecturas del equipo inválidas',
            validation_errors: enriched?.errors || validationResult?.errors || [],
            validation_warnings: enriched?.warnings || validationResult?.warnings || [],
            validation_hints: enriched?.hints || [],
            current_hours: enriched?.current_hours ?? validationResult?.current_hours,
            current_kilometers: enriched?.current_kilometers ?? validationResult?.current_kilometers,
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

    // Completar vía RPC — excluye secciones Lane B (evaluación operativa) de
    // checklist_issues y estado "Con Problemas" (ver section-funnel + migración RPC).
    const opsEvalIssueCount = completed_items.filter(
      (item: {
        status?: string
        section_type?: string
        funnel_lane?: string
      }) =>
        (item.status === 'flag' || item.status === 'fail') &&
        isOperationsEvaluationCompletedItem(item)
    ).length
    if (opsEvalIssueCount > 0) {
      console.log(
        `Lane B: ${opsEvalIssueCount} ítem(s) con falla/flag no generan checklist_issues`
      )
    }

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

    const { error: draftClearError } = await supabase
      .from('checklist_schedules')
      .update(clearedScheduleDraftRowUpdate())
      .eq('id', id)

    if (draftClearError) {
      console.error('[complete] failed to clear schedule draft (non-critical):', draftClearError)
    }

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

    // Guardar datos de seguridad si se proporcionaron
    let persistedSecurityData = security_data as Record<string, unknown> | null | undefined
    if (security_data && Object.keys(security_data).length > 0 && completionResult?.completed_id) {
      try {
        const { error: securityError } = await supabase
          .from('completed_checklists')
          .update({ security_data: security_data })
          .eq('id', completionResult.completed_id)

        if (securityError) {
          console.error('Error saving security data:', securityError)
          // No fallar el checklist por esto, solo registrar el error
        } else {
          console.log('Security data saved successfully')
          persistedSecurityData = security_data
        }
      } catch (securityError) {
        console.error('Error in security data saving process:', securityError)
        // No fallar el checklist por esto
      }
    }

    if (
      plant_operations_data &&
      Object.keys(plant_operations_data).length > 0 &&
      completionResult?.completed_id
    ) {
      try {
        const { error: plantOpsError } = await supabase
          .from('completed_checklists')
          .update({ plant_operations_data })
          .eq('id', completionResult.completed_id)

        if (plantOpsError) {
          console.error('Error saving plant operations data:', plantOpsError)
        } else {
          console.log('Plant operations data saved successfully')
        }
      } catch (plantOpsError) {
        console.error('Error in plant operations data saving process:', plantOpsError)
      }
    }

    // Lane B: denormalized operator evaluation events (idempotent per completion)
    let evaluationEventsSummary = null
    if (completionResult?.completed_id && asset?.plant_id) {
      try {
        const scheduleRow = scheduleData as {
          scheduled_day?: string | null
          scheduled_date?: string | null
        }
        const eventDate =
          scheduleRow.scheduled_day ??
          (scheduleRow.scheduled_date
            ? String(scheduleRow.scheduled_date).split('T')[0]
            : new Date().toISOString().split('T')[0])

        evaluationEventsSummary = await writeAllOperatorEvaluationEvents(supabase, {
          completion: {
            id: completionResult.completed_id,
            schedule_id: id,
            event_date: eventDate,
            asset_id: scheduleData.asset_id,
            template_version_id: templateVersionId,
          },
          plantId: asset.plant_id,
          plantOperationsData: plant_operations_data,
          securityData: persistedSecurityData as typeof security_data,
          completedItems: completed_items,
        })
        console.log('Operator evaluation events written:', evaluationEventsSummary)
        if (
          persistedSecurityData &&
          Object.keys(persistedSecurityData).length > 0 &&
          evaluationEventsSummary.byType.security_talk === 0
        ) {
          console.warn(
            '[complete] security_data present but no security_talk events written',
            {
              completion_id: completionResult.completed_id,
              schedule_id: id,
              plant_id: asset.plant_id,
            }
          )
        }
      } catch (evalEventsError) {
        console.error('Error writing operator evaluation events (non-critical):', evalEventsError)
      }
    } else if (
      completionResult?.completed_id &&
      security_data &&
      Object.keys(security_data).length > 0 &&
      !asset?.plant_id
    ) {
      console.warn(
        '[complete] skipped operator evaluation events — asset missing plant_id',
        { schedule_id: id, asset_id: scheduleData.asset_id }
      )
    }

    // Guardar lecturas de llantas (Phase D)
    let tireReadingsSummary = null
    const tireRows = (tire_readings ?? []) as ChecklistTireReadingInput[]
    if (tireRows.length > 0 && completionResult?.completed_id) {
      try {
        tireReadingsSummary = await saveChecklistTireReadings(supabase, {
          checklist_id: completionResult.completed_id,
          asset_id: scheduleData.asset_id,
          recorded_by: user.id,
          readings: tireRows,
          odometer_km: kilometers_reading ?? asset?.current_kilometers ?? null,
          horometer_hours: hours_reading ?? asset?.current_hours ?? null,
        })
      } catch (tireErr) {
        console.error('Error saving tire readings (non-critical):', tireErr)
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
        tire_readings_summary: tireReadingsSummary,
        evaluation_events_summary: evaluationEventsSummary,
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