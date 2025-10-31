import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'

// GET: Fetch distinct department values from profiles
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()

    // Get distinct department values from profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('departamento')
      .not('departamento', 'is', null)

    if (error) {
      console.error('Fetch departments error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Extract unique department values and sort them
    const departments = Array.from(
      new Set(
        (data || [])
          .map(p => p.departamento)
          .filter(Boolean)
      )
    ).sort()

    return NextResponse.json({ departments })
  } catch (e: any) {
    console.error('GET departments error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

