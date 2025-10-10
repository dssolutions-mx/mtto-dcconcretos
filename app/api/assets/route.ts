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
      // First, get all component asset IDs that are actively part of a composite
      const { data: componentIds, error: componentError } = await supabase
        .from('asset_composite_relationships')
        .select('component_asset_id')
        .eq('status', 'active')

      if (componentError) {
        console.error('Error fetching component relationships:', componentError)
        return NextResponse.json({ error: componentError.message }, { status: 500 })
      }

      const excludedIds = componentIds?.map(r => r.component_asset_id) || []

      // Build query to fetch assets excluding components
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

      const { data: allAssets, error } = await query.order('name', { ascending: true })
      
      if (error) {
        console.error('Error fetching assets:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Filter out component assets
      const data = excludedIds.length > 0
        ? allAssets?.filter(asset => !excludedIds.includes(asset.id))
        : allAssets
      
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