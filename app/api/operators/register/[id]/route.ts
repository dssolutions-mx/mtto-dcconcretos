import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update operators
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only certain roles can update operators
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO']
    if (!allowedRoles.includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id: operatorId } = await params
    const updateData = await request.json()

    // Remove fields that shouldn't be updated directly
    const { id, created_at, created_by, updated_by, updated_at, ...allowedFields } = updateData

    // Use only the allowed fields
    const fieldsToUpdate = allowedFields

    // Update the operator
    const { data: operator, error } = await supabase
      .from('profiles')
      .update(fieldsToUpdate)
      .eq('id', operatorId)
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
      console.error('Error updating operator:', error)
      return NextResponse.json({ error: 'Error updating operator' }, { status: 500 })
    }

    if (!operator) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 })
    }

    return NextResponse.json(operator)

  } catch (error) {
    console.error('Error in operators PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: operatorId } = await params

    const { data: operator, error } = await supabase
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
      .eq('id', operatorId)
      .single()

    if (error) {
      console.error('Error fetching operator:', error)
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 })
    }

    return NextResponse.json(operator)

  } catch (error) {
    console.error('Error in operators GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 