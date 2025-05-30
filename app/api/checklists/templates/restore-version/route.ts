import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { version_id } = body

    if (!version_id) {
      return NextResponse.json(
        { error: 'Version ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Call the database function to restore the version
    const { data, error } = await supabase.rpc('restore_template_version', {
      p_version_id: version_id
    })

    if (error) {
      console.error('Error restoring template version:', error)
      return NextResponse.json(
        { error: 'Failed to restore template version', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      restored: data,
      message: 'Template version restored successfully'
    })

  } catch (error) {
    console.error('Error in restore-version API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 