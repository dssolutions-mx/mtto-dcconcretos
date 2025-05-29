import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: incidents, error } = await supabase
      .from('incident_history')
      .select(`
        *,
        assets (
          id,
          name,
          asset_id
        )
      `)
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching incidents:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(incidents)
  } catch (error: any) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 