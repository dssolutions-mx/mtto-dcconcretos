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
      automaticForAllAssets = false 
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
    
    // If a model is specified but no specific templates, get all templates for this model
    if (modelId && templatesToSchedule.length === 0) {
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
    
    // Validate assets and templates
    if (!assetsToSchedule.length || !templatesToSchedule.length) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un activo y una plantilla' },
        { status: 400 }
      )
    }
    
    // Array to store created schedule IDs
    const createdSchedules = []
    
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
        
        // Calculate dates based on the pattern
        const scheduleDates = []
        let currentDate = new Date(startDateTime)
        
        switch (pattern) {
          case 'daily':
            // Daily
            while (currentDate <= endDateTime) {
              scheduleDates.push(new Date(currentDate))
              currentDate = addDays(currentDate, 1)
            }
            break
            
          case 'weekly':
            // Weekly (same day of the week)
            while (currentDate <= endDateTime) {
              scheduleDates.push(new Date(currentDate))
              currentDate = addWeeks(currentDate, 1)
            }
            break
            
          case 'biweekly':
            // Biweekly
            while (currentDate <= endDateTime) {
              scheduleDates.push(new Date(currentDate))
              currentDate = addDays(currentDate, 14)
            }
            break
            
          case 'monthly':
            // Monthly (same day of the month)
            while (currentDate <= endDateTime) {
              scheduleDates.push(new Date(currentDate))
              currentDate = addMonths(currentDate, 1)
            }
            break
            
          case 'workdays':
            // Only workdays (Monday to Friday)
            while (currentDate <= endDateTime) {
              const dayOfWeek = getDay(currentDate)
              if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                scheduleDates.push(new Date(currentDate))
              }
              currentDate = addDays(currentDate, 1)
            }
            break
            
          default:
            // If no pattern specified, just use startDate
            scheduleDates.push(new Date(startDateTime))
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
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      count: createdSchedules.length,
      schedules: createdSchedules
    })
    
  } catch (error) {
    console.error('Error generating schedules:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
} 