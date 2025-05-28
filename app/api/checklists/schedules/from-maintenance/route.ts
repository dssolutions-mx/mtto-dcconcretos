import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { 
      assetId, 
      modelId, 
      frequency, 
      assignedTo, 
      maintenanceIntervalId, 
      maintenancePlanId 
    } = await request.json()
    
    if (!assetId || !modelId) {
      return NextResponse.json(
        { error: 'Se requieren los IDs del activo y del modelo' },
        { status: 400 }
      )
    }
    
    // Get asset information
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', assetId)
      .single()
    
    if (assetError || !asset) {
      return NextResponse.json(
        { error: 'Error al obtener información del activo' },
        { status: 500 }
      )
    }
    
    // Get maintenance plans and intervals
    let maintenanceInterval = null
    
    if (maintenanceIntervalId) {
      // Get specific maintenance interval if provided
      const { data: interval, error: intervalError } = await supabase
        .from('maintenance_intervals')
        .select('*')
        .eq('id', maintenanceIntervalId)
        .single()
      
      if (intervalError) {
        return NextResponse.json(
          { error: 'Error al obtener intervalo de mantenimiento' },
          { status: 500 }
        )
      }
      
      maintenanceInterval = interval
    }
    
    // 1. Find suitable checklist templates for this model and frequency
    console.log('Searching for templates with:', {
      model_id: modelId,
      frequency: frequency || 'mensual',
      interval_id: maintenanceIntervalId || 'any'
    });

    // Primero buscar plantillas que coincidan con modelo, frecuencia e intervalo específico
    let templateQuery = supabase
      .from('checklists')
      .select('*, maintenance_intervals(*), equipment_models(*)')
      .eq('model_id', modelId)
      .eq('frequency', frequency || 'mensual')
    
    // Si tenemos un intervalo específico, filtrar por ese también
    if (maintenanceIntervalId) {
      templateQuery = templateQuery.eq('interval_id', maintenanceIntervalId)
    }
    
    const { data, error: templatesError } = await templateQuery
    
    let templates = data || []
    
    if (templatesError) {
      console.error('Template query error:', templatesError);
      return NextResponse.json(
        { error: 'Error al buscar plantillas de checklist', details: templatesError },
        { status: 500 }
      )
    }
    
    console.log(`Found ${templates.length} templates matching criteria`);

    if (!templates || templates.length === 0) {
      // Si no se encontraron plantillas con filtro de interval_id, probar sin ese filtro
      if (maintenanceIntervalId) {
        console.log('No templates found with interval filter, trying without it');
        const { data: fallbackTemplates, error: fallbackError } = await supabase
          .from('checklists')
          .select('*, maintenance_intervals(*), equipment_models(*)')
          .eq('model_id', modelId)
          .eq('frequency', frequency || 'mensual')
        
        console.log(`Found ${fallbackTemplates?.length || 0} templates without interval filter`);
        
        if (!fallbackError && fallbackTemplates && fallbackTemplates.length > 0) {
          // Usar plantillas sin filtro de intervalo
          templates = fallbackTemplates
        } else {
          // También probar con cualquier intervalo asociado al modelo
          console.log('Trying with any interval for this model');
          const { data: intervalTemplates, error: intervalError } = await supabase
            .from('checklists')
            .select('*, maintenance_intervals(*), equipment_models(*)')
            .eq('model_id', modelId)
            .not('interval_id', 'is', null)
          
          console.log(`Found ${intervalTemplates?.length || 0} templates with any interval for this model`);
          
          if (!intervalError && intervalTemplates && intervalTemplates.length > 0) {
            templates = intervalTemplates;
          } else {
            // Verificar si existen plantillas para este modelo con cualquier frecuencia
            const { data: anyFreqTemplates } = await supabase
              .from('checklists')
              .select('id, frequency, maintenance_intervals(*)')
              .eq('model_id', modelId)
            
            // Verificar si existen plantillas para esta frecuencia con cualquier modelo
            const { data: anyModelTemplates } = await supabase
              .from('checklists')
              .select('id, model_id, frequency, equipment_models(name), maintenance_intervals(*)')
              .eq('frequency', frequency || 'mensual')
            
            // Verificar si existen plantillas con intervalos
            const { data: intervalOnlyTemplates } = await supabase
              .from('checklists')
              .select('id, model_id, frequency, equipment_models(name), maintenance_intervals(*)')
              .not('interval_id', 'is', null)
            
            return NextResponse.json(
              { 
                error: 'No existen plantillas de checklist para este modelo y frecuencia',
                details: {
                  modelId,
                  frequency,
                  maintenanceIntervalId,
                  templatesForModel: anyFreqTemplates || [],
                  templatesForFrequency: anyModelTemplates || [],
                  templatesWithIntervals: intervalOnlyTemplates || []
                }
              },
              { status: 404 }
            )
          }
        }
      } else {
        // Check if any templates exist for this model with any frequency
        const { data: anyFreqTemplates } = await supabase
          .from('checklists')
          .select('id, frequency')
          .eq('model_id', modelId)
        
        // Check if any templates exist for this frequency with any model
        const { data: anyModelTemplates } = await supabase
          .from('checklists')
          .select('id, model_id, frequency')
          .eq('frequency', frequency || 'mensual')
        
        return NextResponse.json(
          { 
            error: 'No existen plantillas de checklist para este modelo y frecuencia',
            details: {
              modelId,
              frequency,
              templatesForModel: anyFreqTemplates || [],
              templatesForFrequency: anyModelTemplates || []
            }
          },
          { status: 404 }
        )
      }
    }
    
    // 2. Schedule a checklist for each template found
    const today = new Date()
    const createdSchedules = []
    
    // Calculate appropriate scheduled date based on frequency, not maintenance plan
    let scheduledDate = today
    
    for (const template of templates) {
      // Calculate next appropriate date based on checklist frequency
      switch (template.frequency) {
        case 'diario':
          scheduledDate = today
          break
        case 'semanal':
          // Schedule for next week if it's a weekly checklist
          scheduledDate = new Date(today)
          scheduledDate.setDate(today.getDate() + 7)
          break
        case 'mensual':
          // Schedule for next month if it's a monthly checklist
          scheduledDate = new Date(today)
          scheduledDate.setMonth(today.getMonth() + 1)
          break
        case 'trimestral':
          // Schedule for next quarter if it's a quarterly checklist
          scheduledDate = new Date(today)
          scheduledDate.setMonth(today.getMonth() + 3)
          break
        default:
          scheduledDate = today
      }
      
      // If we have a maintenance plan and it's due soon (within 30 days), use that date instead
      if (maintenancePlanId) {
        const { data: plan } = await supabase
          .from('maintenance_plans')
          .select('next_due')
          .eq('id', maintenancePlanId)
          .single()
        
        if (plan && plan.next_due) {
          const planDate = new Date(plan.next_due)
          const daysDifference = Math.ceil((planDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          // Only use plan date if it's within 30 days, otherwise use frequency-based date
          if (daysDifference >= 0 && daysDifference <= 30) {
            scheduledDate = planDate
          }
        }
      }
      
      // Check if a similar schedule already exists to avoid duplicates
      const { data: existingSchedule } = await supabase
        .from('checklist_schedules')
        .select('id')
        .eq('template_id', template.id)
        .eq('asset_id', assetId)
        .eq('status', 'pendiente')
        .gte('scheduled_date', today.toISOString().split('T')[0]) // Only check future schedules
        .single()
      
      if (existingSchedule) {
        console.log(`Skipping duplicate schedule for template ${template.id} and asset ${assetId}`)
        continue
      }
      
      const { data, error } = await supabase
        .from('checklist_schedules')
        .insert({
          template_id: template.id,
          asset_id: assetId,
          scheduled_date: scheduledDate.toISOString(),
          status: 'pendiente',
          assigned_to: assignedTo,
          maintenance_plan_id: maintenancePlanId,
          maintenance_interval_id: maintenanceIntervalId
        })
        .select('*')
        .single()
      
      if (error) {
        console.error('Error creating checklist schedule:', error)
        continue
      }
      
      createdSchedules.push(data)
    }
    
    if (createdSchedules.length === 0) {
      return NextResponse.json(
        { error: 'No se pudieron crear programaciones de checklist' },
        { status: 500 }
      )
    }
    
    // 3. Fetch additional details for the created schedules
    const { data: schedulesWithDetails, error: detailsError } = await supabase
      .from('checklist_schedules')
      .select(`
        *,
        checklists (
          *,
          equipment_models (name, manufacturer)
        ),
        assets (name, asset_id, location)
      `)
      .in('id', createdSchedules.map(s => s.id))
    
    if (detailsError) {
      console.error('Error fetching schedule details:', detailsError)
    }
    
    // 4. If this is part of a maintenance plan, update the plan status
    if (maintenancePlanId) {
      await supabase
        .from('maintenance_plans')
        .update({ status: 'Checklist Programado' })
        .eq('id', maintenancePlanId)
    }
    
    return NextResponse.json({
      success: true,
      count: createdSchedules.length,
      data: schedulesWithDetails || createdSchedules
    })
  } catch (error) {
    console.error('Error creating checklists from maintenance interval:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
} 