import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Disable public registration at API level
  console.log('🛑 Registration endpoint is disabled')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  return NextResponse.json({
    error: 'Public registration is disabled',
    host,
  }, { status: 403 })

  // The code below is preserved for potential future re-enable
  try {
    const body = await request.json()
    console.log('📝 Request body received:', { ...body, password: '[HIDDEN]' })
    
    const {
      nombre,
      apellido,
      email,
      role,
      telefono,
      emergency_contact,
      password,
    } = body

    // Validate required fields
    if (!nombre || !apellido || !email || !role || !password) {
      return NextResponse.json({
        error: 'Missing required fields: nombre, apellido, email, role, password'
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        error: 'Invalid email format'
      }, { status: 400 })
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({
        error: 'Password must be at least 6 characters long'
      }, { status: 400 })
    }

    // Validate role
    const validRoles = [
      'GERENCIA_GENERAL',
      'JEFE_UNIDAD_NEGOCIO', 
      'ENCARGADO_MANTENIMIENTO',
      'JEFE_PLANTA',
      'DOSIFICADOR',
      'OPERADOR',
      'AUXILIAR_COMPRAS',
      'AREA_ADMINISTRATIVA',
      'EJECUTIVO',
      'VISUALIZADOR'
    ]
    
    if (!validRoles.includes(role)) {
      return NextResponse.json({
        error: 'Invalid role specified'
      }, { status: 400 })
    }

    // Use regular client for signup
    console.log('👤 Creating user with standard signup...')
    const supabase = await createClient()

    // Sign up user - this will trigger our profile creation automatically
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellido,
          role,
        }
      }
    })

    if (signUpError) {
      console.error('❌ SignUp error:', signUpError)
      return NextResponse.json({
        error: signUpError.message
      }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({
        error: 'Failed to create user account'
      }, { status: 500 })
    }

    console.log('✅ User created:', authData.user.id)

    // Create profile manually (since trigger is disabled temporarily)
    console.log('📝 Creating profile record...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        nombre,
        apellido,
        email,
        role,
        telefono: telefono || null,
        emergency_contact: emergency_contact && (emergency_contact.name || emergency_contact.phone) 
          ? {
              name: emergency_contact.name || null,
              phone: emergency_contact.phone || null,
            }
          : null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        id,
        nombre,
        apellido,
        email,
        role,
        telefono,
        emergency_contact,
        status,
        created_at
      `)
      .single()

    if (profileError) {
      console.error('❌ Profile creation error:', profileError)
      // Don't fail the entire registration - user is created but profile failed
      console.log('⚠️ User created but profile creation failed - user can still login')
    }

    console.log('✅ Registration completed successfully')

    // Success response
    return NextResponse.json({
      message: 'User registered successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        nombre,
        apellido,
        role,
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Registration error:', error)
    return NextResponse.json({
      error: 'Internal server error during registration'
    }, { status: 500 })
  }
} 