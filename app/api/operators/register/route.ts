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
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO']
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
      can_authorize_up_to
    } = await request.json()

    // Validate required fields
    if (!nombre || !apellido || !email || !role || !employee_code) {
      return NextResponse.json({ 
        error: 'Missing required fields: nombre, apellido, email, role, employee_code' 
      }, { status: 400 })
    }

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

    // Create operator profile (without auth user since this is just a profile record)
    const { data: operator, error } = await supabase
      .from('profiles')
      .insert({
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
        plant_id,
        business_unit_id,
        can_authorize_up_to: can_authorize_up_to || 0,
        status: 'active',
        created_by: user.id,
        updated_by: user.id
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

    return NextResponse.json(operator, { status: 201 })

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
      // Business unit managers can see operators in their business unit
      if (currentProfile.business_unit_id) {
        query = query.eq('business_unit_id', currentProfile.business_unit_id)
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
      query = query.eq('plant_id', plant_id)
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