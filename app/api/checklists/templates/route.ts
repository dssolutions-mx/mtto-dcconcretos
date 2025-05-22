import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  const { data, error } = await supabase
    .from('checklists')
    .select(`
      *,
      checklist_sections(
        *,
        checklist_items(*)
      ),
      equipment_models(
        name,
        manufacturer
      ),
      maintenance_intervals(
        name,
        interval_value,
        type
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  const { template } = await request.json()
  
  // 1. Crear la plantilla de checklist
  const { data: checklistData, error: checklistError } = await supabase
    .from('checklists')
    .insert({
      name: template.name,
      description: template.description,
      model_id: template.model_id,
      frequency: template.frequency,
      hours_interval: template.hours_interval,
      interval_id: template.interval_id || null,
    })
    .select('*')
    .single()

  if (checklistError) {
    return NextResponse.json({ error: checklistError.message }, { status: 500 })
  }

  const checklistId = checklistData.id

  // 2. Crear las secciones
  for (const [sectionIndex, section] of template.sections.entries()) {
    const { data: sectionData, error: sectionError } = await supabase
      .from('checklist_sections')
      .insert({
        checklist_id: checklistId,
        title: section.title,
        order_index: sectionIndex,
      })
      .select('*')
      .single()

    if (sectionError) {
      return NextResponse.json({ error: sectionError.message }, { status: 500 })
    }

    const sectionId = sectionData.id

    // 3. Crear los items de cada sección
    for (const [itemIndex, item] of section.items.entries()) {
      const { error: itemError } = await supabase
        .from('checklist_items')
        .insert({
          section_id: sectionId,
          description: item.description,
          required: item.required ?? true,
          item_type: item.item_type ?? 'check',
          expected_value: item.expected_value,
          tolerance: item.tolerance,
          order_index: itemIndex,
        })

      if (itemError) {
        return NextResponse.json({ error: itemError.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ success: true, id: checklistId })
} 