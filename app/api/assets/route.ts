import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: assets, error } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        status,
        equipment_models (
          id,
          name,
          manufacturer
        )
      `)
      .order('name', { ascending: true })

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