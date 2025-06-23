import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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
      .select('role, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    let query = supabase
      .from('business_units')
      .select(`
        id,
        name,
        code,
        description,
        status
      `)
      .eq('status', 'active')
      .order('name')

    // Apply role-based filtering - let RLS policies handle the actual access control
    if (currentProfile.role === 'GERENCIA_GENERAL') {
      // General management can see all business units
    } else if (currentProfile.role === 'JEFE_UNIDAD_NEGOCIO') {
      // Business unit managers can see their business unit
      if (currentProfile.business_unit_id) {
        query = query.eq('id', currentProfile.business_unit_id)
      }
      // If no business unit assigned, show all (for assignment purposes)
    } else {
      // Other roles: if assigned, show their business unit; if unassigned, show all for assignment
      if (currentProfile.business_unit_id) {
        query = query.eq('id', currentProfile.business_unit_id)
      }
      // If no business unit assigned, show all available options for assignment
      // RLS policies will control actual access
    }

    const { data: businessUnits, error } = await query

    if (error) {
      console.error('Error fetching business units:', error)
      return NextResponse.json({ error: 'Failed to fetch business units' }, { status: 500 })
    }

    return NextResponse.json(businessUnits || [])

  } catch (error) {
    console.error('Error in business-units GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission (only GERENCIA_GENERAL)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'GERENCIA_GENERAL') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code } = body

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 })
    }

    // Create business unit
    const { data: businessUnit, error } = await supabase
      .from('business_units')
      .insert({
        name,
        code,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating business unit:', error)
      return NextResponse.json({ error: 'Error creating business unit' }, { status: 500 })
    }

    return NextResponse.json(businessUnit)
  } catch (error) {
    console.error('Error in business units POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 