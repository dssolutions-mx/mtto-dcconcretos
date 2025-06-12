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
      email,
      password,
      nombre,
      apellido,
      telefono,
      phone_secondary,
      role,
      plant_id,
      business_unit_id,
      employee_code,
      position,
      shift,
      emergency_contact,
      hire_date,
      can_authorize_up_to
    } = await request.json()

    // Validate required fields
    if (!email || !password || !nombre || !apellido || !role || !plant_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: email, password, nombre, apellido, role, plant_id' 
      }, { status: 400 })
    }

    // Create user in auth.users using admin client
    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (adminError) {
      return NextResponse.json({ 
        error: 'Admin client not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.' 
      }, { status: 500 })
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for internal users
      user_metadata: {
        nombre,
        apellido,
        role,
        plant_id,
        employee_code
      }
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return NextResponse.json({ 
        error: `Failed to create user: ${createError.message}` 
      }, { status: 400 })
    }

    // Update the profile that was automatically created by the trigger
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        nombre,
        apellido,
        telefono,
        phone_secondary,
        role,
        plant_id,
        business_unit_id,
        employee_code,
        position,
        shift,
        emergency_contact: emergency_contact ? JSON.stringify(emergency_contact) : null,
        hire_date,
        can_authorize_up_to,
        status: 'active'
      })
      .eq('id', newUser.user.id)
      .select(`
        *,
        plants:plant_id(id, name, code),
        business_units:business_unit_id(id, name)
      `)
      .single()

    if (updateError) {
      console.error('Error updating profile:', updateError)
      // If profile update fails, we should delete the auth user to maintain consistency
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json({ 
        error: `Failed to update profile: ${updateError.message}` 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        profile: updatedProfile
      }
    })

  } catch (error) {
    console.error('Operator registration error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
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

    const { searchParams } = new URL(request.url)
    const plant_id = searchParams.get('plant_id')
    const role = searchParams.get('role')
    const status = searchParams.get('status') || 'active'

    let query = supabase
      .from('profiles')
      .select(`
        id,
        nombre,
        apellido,
        telefono,
        phone_secondary,
        role,
        employee_code,
        position,
        shift,
        hire_date,
        status,
        can_authorize_up_to,
        plants:plant_id(id, name, code),
        business_units:business_unit_id(id, name)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (plant_id) {
      query = query.eq('plant_id', plant_id)
    }

    if (role) {
      query = query.eq('role', role)
    }

    const { data: operators, error } = await query

    if (error) {
      console.error('Error fetching operators:', error)
      return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 })
    }

    return NextResponse.json(operators)

  } catch (error) {
    console.error('Error in operators GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 