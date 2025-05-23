import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Crear un cliente de servicio que use la service_role key para bypass RLS
const createServiceClient = () => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op for service client
        },
      },
    }
  )
}

export async function POST(request: Request) {
  try {
    const { type, asset_id, description, issues, checklist_id, creation_photos } = await request.json()
    
    if (!asset_id || !description) {
      return NextResponse.json({ 
        error: 'Faltan campos requeridos (asset_id, description)' 
      }, { status: 400 })
    }

    // Verificar variables de entorno y usar el cliente apropiado
    let supabase
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('Usando cliente de servicio para work orders')
      supabase = createServiceClient()
    } else {
      console.log('Usando cliente anónimo para work orders')
      const cookieStore = await cookies()
      
      supabase = createServerClient(
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
                // Ignorar errores de cookies en server components
              }
            },
          },
        }
      )
    }

    // Obtener información del usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    let requestedBy = null

    if (user) {
      requestedBy = user.id
    }

    // Generar descripción completa para órdenes desde checklist
    let fullDescription = description
    if (checklist_id && issues && Array.isArray(issues)) {
      const issuesList = issues
        .map(issue => `• ${issue.description}${issue.notes ? `: ${issue.notes}` : ''}`)
        .join('\n')
      
      fullDescription = `${description}\n\nProblemas detectados:\n${issuesList}`
    }

    // Crear la orden de trabajo - el trigger generará el order_id automáticamente
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .insert({
        // No incluir order_id - el trigger lo generará automáticamente con formato OT-XXXX
        type: type || 'corrective',
        asset_id: asset_id,
        description: fullDescription,
        status: 'pending',
        priority: 'medium',
        checklist_id: checklist_id || null,
        creation_photos: creation_photos || null,
        planned_date: new Date().toISOString(),
        issue_items: issues || null,
        requested_by: requestedBy
      })
      .select('id, order_id')
      .single()

    if (workOrderError) {
      console.error('Error creating work order:', workOrderError)
      throw workOrderError
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        id: workOrder.id,
        order_id: workOrder.order_id,
        message: `Orden de trabajo ${workOrder.order_id} creada exitosamente`
      }
    })

  } catch (error: any) {
    console.error('Error creating work order:', error)
    return NextResponse.json({ 
      error: error.message || 'Error interno del servidor'
    }, { status: 500 })
  }
} 