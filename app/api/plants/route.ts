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
        business_units:business_unit_id(id, name)
      `)
      .eq('status', 'active')
      .order('name')

    // Apply role-based filtering
    if (currentProfile.role === 'GERENCIA_GENERAL') {
      // General management can see all plants
    } else if (currentProfile.role === 'JEFE_UNIDAD_NEGOCIO') {
      // Business unit managers can see plants in their business unit
      if (currentProfile.business_unit_id) {
        query = query.eq('business_unit_id', currentProfile.business_unit_id)
      }
    } else if (currentProfile.role === 'JEFE_PLANTA' || currentProfile.role === 'ENCARGADO_MANTENIMIENTO') {
      // Plant managers and maintenance specialists can see their plant and related plants in same business unit
      if (currentProfile.business_unit_id) {
        query = query.eq('business_unit_id', currentProfile.business_unit_id)
      }
    } else {
      // Other roles can only see their assigned plant
      if (currentProfile.plant_id) {
        query = query.eq('id', currentProfile.plant_id)
      } else {
        // If no plant assigned, return empty array
        return NextResponse.json([])
      }
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