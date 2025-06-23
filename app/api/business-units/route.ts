import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: businessUnits, error } = await supabase
      .from('business_units')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching business units:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ business_units: businessUnits || [] })

  } catch (error) {
    console.error('Unexpected error in GET /api/business-units:', error)
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