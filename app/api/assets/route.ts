import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get('plant_id')
    const status = searchParams.get('status')
    const excludeComponents = searchParams.get('exclude_components') === 'true'
    
    if (excludeComponents) {
      // Exclude assets that are active components of a composite to avoid incorrect assignment
      const whereParts: string[] = []
      if (plantId) whereParts.push(`a.plant_id = '${plantId}'`)
      if (status) whereParts.push(`a.status = '${status}'`)
      const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

      const sql = `
        SELECT a.id, a.name, a.asset_id, a.status, a.location, a.department, a.current_hours,
               a.plant_id, a.department_id
        FROM assets a
        ${whereSql}
        AND NOT EXISTS (
          SELECT 1 FROM asset_composite_relationships r
          WHERE r.component_asset_id = a.id AND r.status = 'active'
        )
        ORDER BY a.name ASC;
      `

      const { data, error } = await supabase.rpc('exec_sql', { sql })
      if (error) {
        console.error('Error fetching assignable assets:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(data || [])
    }

    let query = supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        status,
        location,
        department,
        current_hours,
        plant_id,
        department_id,
        plants (
          id,
          name,
          code,
          business_units (
            id,
            name,
            code
          )
        ),
        departments (
          id,
          name,
          code
        ),
        equipment_models (
          id,
          name,
          manufacturer
        )
      `)

    // Apply filters
    if (plantId) {
      query = query.eq('plant_id', plantId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: assets, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Error fetching assets:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(assets)
  } catch (error: any) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 