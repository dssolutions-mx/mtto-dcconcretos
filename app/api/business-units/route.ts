import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabase()

    const { data, error } = await supabase
      .from('business_units')
      .select('id, name, code')
      .order('name')

    if (error) {
      console.error('Business units fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ business_units: data || [] })
  } catch (e: any) {
    console.error('GET business units error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
