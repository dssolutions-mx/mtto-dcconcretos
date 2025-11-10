import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const resolvedParams = await params
  const id = resolvedParams.id
  
  console.log('Fetching completed checklist with ID:', id)
  
  if (!id) {
    return NextResponse.json({ error: 'Se requiere ID del checklist completado' }, { status: 400 })
  }
  
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

  try {
    // Primero intentar obtener directamente desde completed_checklists
    console.log('Trying to fetch from completed_checklists...')
    let { data: completedChecklist, error: mainError } = await supabase
      .from('completed_checklists')
      .select('*, security_data')
      .eq('id', id)
      .maybeSingle()

    // Si no se encuentra, intentar buscar usando el ID como schedule_id
    if (!completedChecklist && !mainError) {
      console.log('Not found in completed_checklists, trying via schedule_id...')
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('checklist_schedules')
        .select('template_id, asset_id')
        .eq('id', id)
        .single()

      if (scheduleError) {
        console.error('Error fetching schedule:', scheduleError)
        return NextResponse.json({ error: 'Checklist completado no encontrado' }, { status: 404 })
      }

      if (scheduleData) {
        // Buscar el completed_checklist correspondiente
        console.log('Found schedule, looking for completed checklist...')
        const { data: foundCompleted, error: completedError } = await supabase
          .from('completed_checklists')
          .select('*, security_data')
          .eq('checklist_id', scheduleData.template_id)
          .eq('asset_id', scheduleData.asset_id)
          .order('completion_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (completedError) {
          console.error('Error fetching completed checklist via schedule:', completedError)
          return NextResponse.json({ error: completedError.message }, { status: 500 })
        }

        completedChecklist = foundCompleted
      }
    }

    if (mainError) {
      console.error('Error fetching completed checklist:', mainError)
      return NextResponse.json({ error: mainError.message }, { status: 500 })
    }

    if (!completedChecklist) {
      console.log('No completed checklist found')
      return NextResponse.json({ error: 'Checklist completado no encontrado' }, { status: 404 })
    }

    console.log('Found completed checklist:', completedChecklist)

    // Obtener información del checklist usando la versión específica del template
    let checklistData = null
    if (completedChecklist.template_version_id) {
      console.log('Fetching template version data for ID:', completedChecklist.template_version_id)
      const { data, error: versionError } = await supabase
        .from('checklist_template_versions')
        .select('*')
        .eq('id', completedChecklist.template_version_id)
        .maybeSingle()

      if (versionError) {
        console.error('Error fetching template version data:', versionError)
      } else if (data) {
        console.log('Found template version data:', data)
        // Transformar la estructura de template version a formato compatible
        // Ensure section_type and security_config are preserved in transformed sections
        // Use nullish coalescing (??) to preserve 'security_talk' and other types
        const transformedSections = (data.sections || []).map((section: any) => ({
          ...section,
          section_type: section.section_type ?? 'checklist', // Only default if null/undefined
          security_config: section.security_config || null,
          checklist_items: section.items || [] // Convert 'items' to 'checklist_items'
        }))
        
        checklistData = {
          id: data.template_id,
          name: data.name,
          description: data.description,
          frequency: data.frequency,
          checklist_sections: transformedSections
        }
      }
    } else if (completedChecklist.checklist_id) {
      // Fallback a la versión actual si no hay template_version_id
      console.log('No template_version_id found, falling back to current template for ID:', completedChecklist.checklist_id)
      const { data, error: checklistError } = await supabase
        .from('checklists')
        .select(`
          *,
          checklist_sections (
            id,
            title,
            order_index,
            section_type,
            security_config,
            evidence_config,
            cleanliness_config,
            checklist_items (*)
          )
        `)
        .eq('id', completedChecklist.checklist_id)
        .maybeSingle()

      if (checklistError) {
        console.error('Error fetching checklist data:', checklistError)
      } else {
        console.log('Found checklist data:', data)
        // Ensure section_type and security_config are included in sections
        // IMPORTANT: Don't override section_type if it's already set - preserve the actual value from DB
        if (data?.checklist_sections) {
          data.checklist_sections = data.checklist_sections.map((section: any) => ({
            ...section,
            // Only set default if section_type is null/undefined, not if it's already set
            section_type: section.section_type ?? 'checklist',
            security_config: section.security_config || null
          }))
          console.log('🔍 Processed checklist sections:', data.checklist_sections.map((s: any) => ({
            id: s.id,
            title: s.title,
            section_type: s.section_type,
            security_config: s.security_config
          })))
        }
        checklistData = data
      }
    }

    // Obtener información del activo
    let assetData = null
    if (completedChecklist.asset_id) {
      console.log('Fetching asset data for ID:', completedChecklist.asset_id)
      const { data, error: assetError } = await supabase
        .from('assets')
        .select('id, name, asset_id, location, department')
        .eq('id', completedChecklist.asset_id)
        .maybeSingle()

      if (assetError) {
        console.error('Error fetching asset data:', assetError)
      } else {
        console.log('Found asset data:', data)
        assetData = data
      }
    }

    // Obtener información del perfil del técnico que ejecutó el checklist
    let profileData = null
    if (completedChecklist.created_by) {
      console.log('Fetching profile data for user ID:', completedChecklist.created_by)
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, nombre, apellido, role, telefono, avatar_url, departamento')
        .eq('id', completedChecklist.created_by)
        .maybeSingle()

      if (profileError) {
        console.error('Error fetching profile data:', profileError)
      } else {
        console.log('Found profile data:', data)
        profileData = data
      }
    }

    // Obtener los issues asociados si los hay
    console.log('Fetching issues for completed checklist ID:', completedChecklist.id)
    const { data: issues, error: issuesError } = await supabase
      .from('checklist_issues')
      .select('*')
      .eq('checklist_id', completedChecklist.id)

    if (issuesError) {
      console.error('Error fetching checklist issues:', issuesError)
    } else {
      console.log('Found issues:', issues)
    }

    // Construir la respuesta
    const response = {
      ...completedChecklist,
      security_data: completedChecklist.security_data || null, // Ensure security_data is included
      checklists: checklistData,
      assets: assetData,
      profile: profileData,
      issues: issues || []
    }

    console.log('Returning response with security_data:', {
      hasSecurityData: !!completedChecklist.security_data,
      securityDataKeys: completedChecklist.security_data ? Object.keys(completedChecklist.security_data) : [],
      securityData: completedChecklist.security_data
    })
    return NextResponse.json({ data: response })

  } catch (error: any) {
    console.error('Error in completed checklist API:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
} 