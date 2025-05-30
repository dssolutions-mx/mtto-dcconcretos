import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { template_id, change_summary, migration_notes } = body

    if (!template_id || !change_summary) {
      return NextResponse.json(
        { error: 'Template ID and change summary are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Call the database function to create a new version
    const { data, error } = await supabase.rpc('create_template_version', {
      p_template_id: template_id,
      p_change_summary: change_summary,
      p_migration_notes: migration_notes || null
    })

    if (error) {
      console.error('Error creating template version:', error)
      return NextResponse.json(
        { error: 'Failed to create template version', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      version_id: data,
      message: 'Template version created successfully'
    })

  } catch (error) {
    console.error('Error in create-version API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 