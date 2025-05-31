import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
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

    console.log('🚀 Creando plantilla de ejemplo con evidencias...')

    // Obtener el primer modelo de equipo disponible
    const { data: models, error: modelsError } = await supabase
      .from('equipment_models')
      .select('id')
      .limit(1)

    if (modelsError || !models || models.length === 0) {
      throw new Error('No hay modelos de equipos disponibles')
    }

    const modelId = models[0].id

    // Crear plantilla de ejemplo
    const { data: checklist, error: checklistError } = await supabase
      .from('checklists')
      .insert({
        name: 'Inspección Semanal con Evidencias',
        description: 'Plantilla de ejemplo que incluye secciones de evidencia fotográfica',
        model_id: modelId,
        frequency: 'semanal'
      })
      .select('id')
      .single()

    if (checklistError) throw checklistError

    const checklistId = checklist.id

    // Crear sección normal de checklist
    const { data: normalSection, error: normalSectionError } = await supabase
      .from('checklist_sections')
      .insert({
        checklist_id: checklistId,
        title: 'Inspección Mecánica',
        order_index: 0,
        section_type: 'checklist'
      })
      .select('id')
      .single()

    if (normalSectionError) throw normalSectionError

    // Crear items para la sección normal
    const normalItems = [
      'Verificar nivel de aceite hidráulico',
      'Inspeccionar mangueras y conexiones',
      'Revisar estado de filtros'
    ]

    for (let i = 0; i < normalItems.length; i++) {
      await supabase
        .from('checklist_items')
        .insert({
          section_id: normalSection.id,
          description: normalItems[i],
          required: true,
          item_type: 'check',
          order_index: i
        })
    }

    // Crear sección de evidencia fotográfica
    const { data: evidenceSection, error: evidenceSectionError } = await supabase
      .from('checklist_sections')
      .insert({
        checklist_id: checklistId,
        title: 'Documentación Fotográfica',
        order_index: 1,
        section_type: 'evidence',
        evidence_config: {
          min_photos: 2,
          max_photos: 8,
          categories: [
            'Vista General',
            'Motor/Compartimento',
            'Problemas Identificados',
            'Estado de Mangueras'
          ],
          descriptions: {
            'Vista General': 'Capturar una vista completa del equipo desde el frente y costado',
            'Motor/Compartimento': 'Fotografiar el compartimento del motor mostrando estado general',
            'Problemas Identificados': 'Documentar cualquier anomalía, daño o desgaste detectado',
            'Estado de Mangueras': 'Fotografiar conexiones hidráulicas y estado de mangueras'
          }
        }
      })
      .select('id')
      .single()

    if (evidenceSectionError) throw evidenceSectionError

    console.log('✅ Plantilla con evidencias creada exitosamente')
    console.log(`📋 Checklist ID: ${checklistId}`)
    console.log(`📝 Sección normal ID: ${normalSection.id}`)
    console.log(`📸 Sección evidencia ID: ${evidenceSection.id}`)

    return NextResponse.json({
      success: true,
      message: 'Plantilla de ejemplo con evidencias creada exitosamente',
      checklist_id: checklistId,
      sections: {
        normal: normalSection.id,
        evidence: evidenceSection.id
      }
    })

  } catch (error: any) {
    console.error('❌ Error creando plantilla de ejemplo:', error)
    return NextResponse.json(
      { 
        error: 'Error al crear la plantilla de ejemplo',
        details: error.message 
      },
      { status: 500 }
    )
  }
} 