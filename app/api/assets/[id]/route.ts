import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    const { data: asset, error } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        status,
        location,
        department,
        department_id,
        current_hours,
        current_kilometers,
        fabrication_year,
        serial_number,
        notes,
        plant_id,
        model_id,
        equipment_models (
          id,
          name,
          manufacturer,
          category,
          year_introduced,
          maintenance_unit
        ),
        plants (
          id,
          name,
          code
        ),
        departments (
          id,
          name
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching asset:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    return NextResponse.json(asset)
  } catch (error: unknown) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
