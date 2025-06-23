import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: plants, error } = await supabase
      .from('plants')
      .select(`
        id,
        name,
        code,
        location,
        status,
        business_unit_id,
        contact_phone,
        contact_email,
        address
      `)
      .eq('status', 'active')
      .order('name')

    if (error) {
      console.error('Error fetching plants:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plants: plants || [] })

  } catch (error) {
    console.error('Unexpected error in GET /api/plants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to create plants
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only certain roles can create plants
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO']
    if (!allowedRoles.includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const {
      name,
      code,
      business_unit_id,
      location,
      address,
      contact_phone,
      contact_email
    } = await request.json()

    // Validate required fields
    if (!name || !code || !business_unit_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, code, business_unit_id' 
      }, { status: 400 })
    }

    // Check if code already exists
    const { data: existingPlant } = await supabase
      .from('plants')
      .select('id')
      .eq('code', code)
      .single()

    if (existingPlant) {
      return NextResponse.json({ 
        error: 'Plant code already exists' 
      }, { status: 400 })
    }

    // Create the plant
    const { data: plant, error } = await supabase
      .from('plants')
      .insert({
        name,
        code,
        business_unit_id,
        location,
        address,
        contact_phone,
        contact_email,
        status: 'active',
        created_by: user.id,
        updated_by: user.id
      })
      .select(`
        id,
        name,
        code,
        location,
        status,
        business_unit_id,
        contact_phone,
        contact_email,
        address,
        business_units:business_unit_id(id, name)
      `)
      .single()

    if (error) {
      console.error('Error creating plant:', error)
      return NextResponse.json({ error: 'Error creating plant' }, { status: 500 })
    }

    return NextResponse.json(plant, { status: 201 })

  } catch (error) {
    console.error('Error in plants POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 