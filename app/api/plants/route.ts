import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'

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

    return NextResponse.json(data || [])
  } catch (e: any) {
    console.error('GET plants error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
