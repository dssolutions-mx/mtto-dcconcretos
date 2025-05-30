import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
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
    
    // Obtener todas las plantillas con sus secciones e items
    const { data, error } = await supabase
      .from('checklists')
      .select(`
        *,
        equipment_models(*),
        maintenance_intervals(*),
        checklist_sections(
          *,
          checklist_items(*)
        )
      `)
      .order('name')
    
    if (error) {
      console.error('Error fetching checklist templates:', error)
      return NextResponse.json(
        { error: 'Error al obtener las plantillas de checklist' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching checklist templates:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

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
    
    // Obtener datos de la plantilla del cuerpo de la solicitud
    const { template } = await request.json()
    
    // Verificar datos requeridos
    if (!template || !template.name || !template.model_id || !template.frequency) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos para la plantilla' },
        { status: 400 }
      )
    }
    
    if (!template.sections || template.sections.length === 0) {
      return NextResponse.json(
        { error: 'La plantilla debe tener al menos una sección' },
        { status: 400 }
      )
    }
    
    // Verificar que cada sección tenga título y contenido apropiado según su tipo
    for (const section of template.sections) {
      if (!section.title) {
        return NextResponse.json(
          { error: 'Cada sección debe tener un título' },
          { status: 400 }
        )
      }
      
      if (section.section_type === 'evidence') {
        // Para secciones de evidencia, verificar configuración
        if (!section.evidence_config) {
          return NextResponse.json(
            { error: `La sección de evidencia "${section.title}" no tiene configuración` },
            { status: 400 }
          )
        }
        
        const config = section.evidence_config
        if (!config.categories || config.categories.length === 0) {
          return NextResponse.json(
            { error: `La sección de evidencia "${section.title}" debe tener al menos una categoría` },
            { status: 400 }
          )
        }
        
        if (config.min_photos < 1 || config.max_photos < config.min_photos) {
          return NextResponse.json(
            { error: `Configuración de fotos inválida en la sección "${section.title}"` },
            { status: 400 }
          )
        }
      } else {
        // Para secciones normales de checklist, verificar items
        if (!section.items || section.items.length === 0) {
          return NextResponse.json(
            { error: `La sección "${section.title}" debe tener al menos un item` },
            { status: 400 }
          )
        }
        
        // Verificar que cada item tenga descripción
        for (const item of section.items) {
          if (!item.description) {
            return NextResponse.json(
              { error: 'Cada item debe tener una descripción' },
              { status: 400 }
            )
          }
        }
      }
    }
    
    // Obtener el usuario actual para registrar quien creó la plantilla
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id
    
    // Crear la plantilla en la base de datos
    const { data: checklistData, error: checklistError } = await supabase
      .from('checklists')
      .insert({
        name: template.name,
        description: template.description || null,
        model_id: template.model_id,
        frequency: template.frequency,
        interval_id: template.interval_id || null,
        created_by: userId
      })
      .select('id')
      .single()
    
    if (checklistError) {
      console.error('Error creating checklist template:', checklistError)
      return NextResponse.json(
        { error: 'Error al crear la plantilla de checklist' },
        { status: 500 }
      )
    }
    
    const checklistId = checklistData.id
    
    // Crear las secciones para la plantilla
    for (let i = 0; i < template.sections.length; i++) {
      const section = template.sections[i]
      
      const { data: sectionData, error: sectionError } = await supabase
        .from('checklist_sections')
        .insert({
          checklist_id: checklistId,
          title: section.title,
          order_index: i,
          section_type: section.section_type || 'checklist',
          evidence_config: section.evidence_config || null
        })
        .select('id')
        .single()
      
      if (sectionError) {
        console.error('Error creating checklist section:', sectionError)
        continue
      }
      
      const sectionId = sectionData.id
      
      // Solo crear items para secciones normales de checklist
      if (section.section_type === 'checklist' || !section.section_type) {
        // Crear los items para la sección
        for (let j = 0; j < section.items.length; j++) {
          const item = section.items[j]
          
          await supabase
            .from('checklist_items')
            .insert({
              section_id: sectionId,
              description: item.description,
              required: item.required || false,
              item_type: item.item_type || 'check',
              expected_value: item.expected_value || null,
              tolerance: item.tolerance || null,
              order_index: j
            })
        }
      }
      // Para secciones de evidencia, no se crean items individuales
      // La configuración se almacena en evidence_config
    }
    
    return NextResponse.json({
      success: true,
      checklist_id: checklistId
    })
  } catch (error) {
    console.error('Error creating checklist template:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
} 