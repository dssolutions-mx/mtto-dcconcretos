import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create operators
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only certain roles can create operators
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO', 'EJECUTIVO']
    if (!allowedRoles.includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const {
      nombre,
      apellido,
      email,
      telefono,
      phone_secondary,
      role,
      employee_code,
      position,
      shift,
      hire_date,
      plant_id,
      business_unit_id,
      can_authorize_up_to,
      notes,
      password
    } = await request.json()

    // Validate required fields
    if (!nombre || !apellido || !email || !role || !employee_code || !password) {
      return NextResponse.json({ 
        error: 'Missing required fields: nombre, apellido, email, role, employee_code, password' 
      }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'Password must be at least 6 characters long' 
      }, { status: 400 })
    }

    // Validate UUID fields - convert empty strings to null
    const validatedPlantId = plant_id && plant_id.trim() !== '' ? plant_id : null
    const validatedBusinessUnitId = business_unit_id && business_unit_id.trim() !== '' ? business_unit_id : null

    // Check if employee code already exists
    const { data: existingOperator } = await supabase
      .from('profiles')
      .select('id')
      .eq('employee_code', employee_code)
      .single()

    if (existingOperator) {
      return NextResponse.json({ 
        error: 'Employee code already exists' 
      }, { status: 400 })
    }

    // Create auth user first - password is stored securely in auth.users table
    // NEVER store passwords in profiles table for security
    const adminSupabase = createAdminClient()
    const { data: authData, error: createUserError } = await adminSupabase.auth.admin.createUser({
      email,
      password: password, // Use provided provisional password - stored in auth.users
      email_confirm: true,
      user_metadata: {
        nombre,
        apellido,
        role,
        employee_code
      }
    })

    if (createUserError || !authData.user) {
      console.error('Error creating auth user:', createUserError)
      return NextResponse.json({ error: 'Error creating user account' }, { status: 500 })
    }

    // Create operator profile with the auth user ID
    // NOTE: Password is NOT stored here - only in auth.users table for security
    const { data: operator, error } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id, // Links to auth.users.id
        nombre,
        apellido,
        email,
        telefono,
        phone_secondary,
        role,
        employee_code,
        position,
        shift,
        hire_date: hire_date || new Date().toISOString(),
        plant_id: validatedPlantId,
        business_unit_id: validatedBusinessUnitId,
        can_authorize_up_to: can_authorize_up_to || 0,
        status: 'active',
        notas_rh: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
        // system_password and system_access_password are NOT set here
        // These are separate credentials for other systems, not auth passwords
      })
      .select(`
        id,
        nombre,
        apellido,
        email,
        telefono,
        phone_secondary,
        role,
        employee_code,
        position,
        shift,
        hire_date,
        status,
        can_authorize_up_to,
        plant_id,
        business_unit_id,
        plants:plant_id(id, name, code),
        business_units:business_unit_id(id, name)
      `)
      .single()

    if (error) {
      console.error('Error creating operator:', error)
      return NextResponse.json({ error: 'Error creating operator' }, { status: 500 })
    }

    return NextResponse.json({
      ...operator,
      message: 'User created successfully',
      login_instructions: {
        email: email,
        password: password,
        note: 'User can login with their email and the provisional password provided'
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error in operators POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to determine access level
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const plant_id = searchParams.get('plant_id')
    const business_unit_id = searchParams.get('business_unit_id')
    const role = searchParams.get('role')
    const status = searchParams.get('status') || 'active'

    let query = supabase
      .from('profiles')
      .select(`
        id,
        nombre,
        apellido,
        email,
        telefono,
        phone_secondary,
        role,
        employee_code,
        position,
        shift,
        hire_date,
        status,
        can_authorize_up_to,
        plant_id,
        business_unit_id,
        plants:plant_id(id, name, code),
        business_units:business_unit_id(id, name)
      `)
      .eq('status', status)
      .order('nombre')

    // Apply role-based filtering
    if (currentProfile.role === 'GERENCIA_GENERAL') {
      // General management can see all operators
    } else if (currentProfile.role === 'JEFE_UNIDAD_NEGOCIO') {
      // Business unit managers can see operators in their business unit AND unassigned operators
      if (currentProfile.business_unit_id) {
        // Use OR filter to include both assigned and unassigned operators
        query = query.or(`business_unit_id.eq.${currentProfile.business_unit_id},business_unit_id.is.null`)
      }
    } else if (currentProfile.role === 'JEFE_PLANTA' || currentProfile.role === 'ENCARGADO_MANTENIMIENTO') {
      // Plant managers and maintenance specialists can see operators in their plant
      if (currentProfile.plant_id) {
        query = query.eq('plant_id', currentProfile.plant_id)
      }
    } else {
      // Other roles cannot see operators list
      return NextResponse.json([])
    }

    // Apply additional filters if provided
    if (plant_id) {
      // For business unit managers, include unassigned operators even when plant_id filter is applied
      if (currentProfile.role === 'JEFE_UNIDAD_NEGOCIO') {
        query = query.or(`plant_id.eq.${plant_id},plant_id.is.null`)
      } else {
        query = query.eq('plant_id', plant_id)
      }
    }

    if (business_unit_id) {
      query = query.eq('business_unit_id', business_unit_id)
    }

    if (role) {
      query = query.eq('role', role)
    }

    const { data: operators, error } = await query

    if (error) {
      console.error('Error fetching operators:', error)
      return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 })
    }

    return NextResponse.json(operators || [])

  } catch (error) {
    console.error('Error in operators GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 