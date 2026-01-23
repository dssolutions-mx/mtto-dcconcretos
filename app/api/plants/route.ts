import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabase()

    const { data, error } = await supabase
      .from('plants')
      .select('id, name, code, business_unit_id')
      .order('name')

    if (error) {
      console.error('Plants fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plants: data || [] })
  } catch (e: any) {
    console.error('GET plants error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
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
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only certain roles can create plants
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA']
    if (!allowedRoles.includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const plantData = await request.json()

    // Validate required fields
    if (!plantData.name || !plantData.code || !plantData.business_unit_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, code, and business_unit_id are required' },
        { status: 400 }
      )
    }

    // Prepare plant data with defaults
    const plantToCreate = {
      name: plantData.name,
      code: plantData.code,
      business_unit_id: plantData.business_unit_id,
      location: plantData.location || null,
      address: plantData.address || null,
      contact_phone: plantData.contact_phone || null,
      contact_email: plantData.contact_email || null,
      status: plantData.status || 'active',
      created_by: user.id,
      updated_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Create the plant
    const { data: plant, error } = await supabase
      .from('plants')
      .insert(plantToCreate)
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
      return NextResponse.json(
        { error: 'Error creating plant', details: error.message },
        { status: 500 }
      )
    }

    if (!plant) {
      return NextResponse.json({ error: 'Plant was not created' }, { status: 500 })
    }

    return NextResponse.json(plant, { status: 201 })

  } catch (error: any) {
    console.error('Error in plants POST:', error)
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError || error.message?.includes('JSON')) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON.' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}
