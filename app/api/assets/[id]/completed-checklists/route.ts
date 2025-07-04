import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: assetId } = await params
    
    const { data: completedChecklists, error } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        checklist_id,
        asset_id,
        completed_items,
        technician,
        completion_date,
        created_at,
        status,
        notes,
        signature_data,
        checklists(
          id,
          name,
          frequency,
          description
        )
      `)
      .eq('asset_id', assetId)
      .order('completion_date', { ascending: false })

    if (error) {
      console.error('Error fetching completed checklists:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: completedChecklists || [] })
  } catch (error: any) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 