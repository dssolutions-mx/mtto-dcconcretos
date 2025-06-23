import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

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
    const business_unit_id = searchParams.get('business_unit_id')

    let query = supabase
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
        address,
        business_units:business_unit_id(id, name)
      `)
      .eq('status', 'active')
      .order('name')

    // Apply role-based filtering - let RLS policies handle the actual access control
    if (currentProfile.role === 'GERENCIA_GENERAL') {
      // General management can see all plants
    } else if (currentProfile.role === 'JEFE_UNIDAD_NEGOCIO') {
      // Business unit managers can see plants in their business unit
      if (currentProfile.business_unit_id) {
        query = query.eq('business_unit_id', currentProfile.business_unit_id)
      }
      // If no business unit assigned, show all (for assignment purposes)
    } else if (currentProfile.role === 'JEFE_PLANTA' || currentProfile.role === 'ENCARGADO_MANTENIMIENTO') {
      // Plant managers and maintenance specialists can see their plant and related plants in same business unit
      if (currentProfile.business_unit_id) {
        query = query.eq('business_unit_id', currentProfile.business_unit_id)
      }
      // If no business unit assigned, show all (for assignment purposes)
    } else {
      // Other roles: if assigned, show their plant; if unassigned, show all for assignment
      if (currentProfile.plant_id) {
        query = query.eq('id', currentProfile.plant_id)
      } else if (currentProfile.business_unit_id) {
        // If assigned to business unit but not plant, show plants in their business unit
        query = query.eq('business_unit_id', currentProfile.business_unit_id)
      }
      // If no assignment at all, show all available options for assignment
      // RLS policies will control actual access
    }

    // Apply additional filters if provided
    if (business_unit_id) {
      query = query.eq('business_unit_id', business_unit_id)
    }

    const { data: plants, error } = await query

    if (error) {
      console.error('Error fetching plants:', error)
      return NextResponse.json({ error: 'Failed to fetch plants' }, { status: 500 })
    }

    return NextResponse.json(plants || [])

  } catch (error) {
    console.error('Error in plants GET:', error)
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