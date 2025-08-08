import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { addDays, addMonths, addWeeks, getDay, format } from 'date-fns'

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
      pattern, 
      startDate, 
      endDate, 
      assetIds, 
      templateIds, 
      assignedTo, 
      modelId,
      automaticForAllAssets = false,
      maxSchedulesPerTemplate = 10 // Limit to prevent excessive schedules
    } = await request.json()
    
    const startDateTime = new Date(startDate)
    const endDateTime = new Date(endDate)
    
    // Validate dates
    if (endDateTime <= startDateTime) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
        { status: 400 }
      )
    }
    
    // Limit the date range to prevent excessive schedules
    const maxDays = 90 // Maximum 90 days
    const daysDifference = Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDifference > maxDays) {
      return NextResponse.json(
        { error: `El rango de fechas no puede exceder ${maxDays} días` },
        { status: 400 }
      )
    }
    
    // Get assets to schedule for
    let assetsToSchedule = assetIds || []
    
    // If automatic scheduling for all assets with this model is requested
    if (automaticForAllAssets && modelId) {
      const { data: modelAssets, error: assetsError } = await supabase
        .from('assets')
        .select('id')
        .eq('model_id', modelId)
        .eq('status', 'operational')
      
      if (assetsError) {
        return NextResponse.json(
          { error: 'Error obteniendo activos para el modelo' },
          { status: 500 }
        )
      }
      
      if (modelAssets && modelAssets.length > 0) {
        assetsToSchedule = modelAssets.map(asset => asset.id)
      }
    }
    
    // Get templates to schedule
    let templatesToSchedule = templateIds || []
    
    // If automatic scheduling is requested, get templates for the model
    if (automaticForAllAssets && modelId) {
      const { data: modelTemplates, error: templatesError } = await supabase
        .from('checklists')
        .select('id')
        .eq('model_id', modelId)
      
      if (templatesError) {
        return NextResponse.json(
          { error: 'Error obteniendo plantillas para el modelo' },
          { status: 500 }
        )
      }
      
      if (modelTemplates && modelTemplates.length > 0) {
        templatesToSchedule = modelTemplates.map(template => template.id)
      }
    }
    
    if (!assetsToSchedule.length || !templatesToSchedule.length) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un activo y una plantilla' },
        { status: 400 }
      )
    }
    
    const createdSchedules: string[] = []
    
    // Process each combination of asset and template
    for (const assetId of assetsToSchedule) {
      for (const templateId of templatesToSchedule) {
        
        // Get template information
        const { data: template } = await supabase
          .from('checklists')
          .select('*')
          .eq('id', templateId)
          .single()
          
        if (!template) continue
        
        // Check for existing pending schedules to avoid duplicates
          const { data: existingSchedules } = await supabase
          .from('checklist_schedules')
            .select('id, scheduled_date, scheduled_day')
          .eq('template_id', templateId)
          .eq('asset_id', assetId)
          .eq('status', 'pendiente')
          .gte('scheduled_date', new Date().toISOString())
        
        // Calculate dates based on the pattern with intelligent frequency handling
        const scheduleDates = []
        let currentDate = new Date(startDateTime)
        let scheduleCount = 0
        
        // For frequency-based patterns, respect the template's frequency
        const templateFrequency = template.frequency
        let effectivePattern = pattern
        
        // Override pattern based on template frequency if it makes sense
        if (templateFrequency === 'diario' && pattern !== 'daily') {
          effectivePattern = 'daily'
        } else if (templateFrequency === 'semanal' && !['weekly', 'biweekly'].includes(pattern)) {
          effectivePattern = 'weekly'
        } else if (templateFrequency === 'mensual' && pattern !== 'monthly') {
          effectivePattern = 'monthly'
        }
        
        switch (effectivePattern) {
          case 'daily':
            // Daily - but limit to reasonable amount
            while (currentDate <= endDateTime && scheduleCount < maxSchedulesPerTemplate) {
              // Check if this date already has a schedule
              const hasExisting = existingSchedules?.some(s => 
                new Date((s as any).scheduled_day || s.scheduled_date).toDateString() === currentDate.toDateString()
              )
              
              if (!hasExisting) {
                scheduleDates.push(new Date(currentDate))
                scheduleCount++
              }
              currentDate = addDays(currentDate, 1)
            }
            break
            
          case 'weekly':
            // Weekly (same day of the week)
            while (currentDate <= endDateTime && scheduleCount < maxSchedulesPerTemplate) {
              const hasExisting = existingSchedules?.some(s => 
                new Date((s as any).scheduled_day || s.scheduled_date).toDateString() === currentDate.toDateString()
              )
              
              if (!hasExisting) {
                scheduleDates.push(new Date(currentDate))
                scheduleCount++
              }
              currentDate = addWeeks(currentDate, 1)
            }
            break
            
          case 'biweekly':
            // Biweekly
            while (currentDate <= endDateTime && scheduleCount < maxSchedulesPerTemplate) {
              const hasExisting = existingSchedules?.some(s => 
                new Date((s as any).scheduled_day || s.scheduled_date).toDateString() === currentDate.toDateString()
              )
              
              if (!hasExisting) {
                scheduleDates.push(new Date(currentDate))
                scheduleCount++
              }
              currentDate = addDays(currentDate, 14)
            }
            break
            
          case 'monthly':
            // Monthly (same day of the month)
            while (currentDate <= endDateTime && scheduleCount < maxSchedulesPerTemplate) {
              const hasExisting = existingSchedules?.some(s => 
                new Date((s as any).scheduled_day || s.scheduled_date).toDateString() === currentDate.toDateString()
              )
              
              if (!hasExisting) {
                scheduleDates.push(new Date(currentDate))
                scheduleCount++
              }
              currentDate = addMonths(currentDate, 1)
            }
            break
            
          case 'workdays':
            // Only workdays (Monday to Friday)
            while (currentDate <= endDateTime && scheduleCount < maxSchedulesPerTemplate) {
              const dayOfWeek = getDay(currentDate)
              if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const hasExisting = existingSchedules?.some(s => 
                  new Date(s.scheduled_date).toDateString() === currentDate.toDateString()
                )
                
                if (!hasExisting) {
                  scheduleDates.push(new Date(currentDate))
                  scheduleCount++
                }
              }
              currentDate = addDays(currentDate, 1)
            }
            break
            
          default:
            // If no pattern specified, just use startDate
            const hasExisting = existingSchedules?.some(s => 
              new Date(s.scheduled_date).toDateString() === startDateTime.toDateString()
            )
            
            if (!hasExisting) {
              scheduleDates.push(new Date(startDateTime))
            }
            break
        }
        
        // Create schedules in the database
        for (const scheduleDate of scheduleDates) {
          const { data, error } = await supabase
            .from('checklist_schedules')
            .insert({
              template_id: templateId,
              asset_id: assetId,
              scheduled_date: scheduleDate.toISOString(),
              status: 'pendiente',
              assigned_to: assignedTo
            })
            .select()
            .single()
            
          if (!error) {
            createdSchedules.push(data.id)
          } else {
            console.error('Error creating schedule:', error)
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      count: createdSchedules.length,
      schedules: createdSchedules,
      message: `Se crearon ${createdSchedules.length} programaciones de checklist`
    })
    
  } catch (error) {
    console.error('Error generating schedules:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
} 