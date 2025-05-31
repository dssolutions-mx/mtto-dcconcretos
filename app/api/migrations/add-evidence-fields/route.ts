import { createClient } from '@/lib/supabase'
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createClient()
    
    // Check if section_type column exists and add it if not
    try {
      const { error: sectionTypeError } = await supabase
        .from('checklist_sections')
        .select('section_type')
        .limit(1)
      
      if (sectionTypeError && sectionTypeError.message.includes('column "section_type" does not exist')) {
        // Column doesn't exist, we need to create it manually
        console.log('section_type column does not exist, needs to be added manually')
      }
    } catch (err) {
      console.log('Error checking section_type column:', err)
    }

    // Check if evidence_config column exists
    try {
      const { error: evidenceConfigError } = await supabase
        .from('checklist_sections')
        .select('evidence_config')
        .limit(1)
      
      if (evidenceConfigError && evidenceConfigError.message.includes('column "evidence_config" does not exist')) {
        // Column doesn't exist, we need to create it manually
        console.log('evidence_config column does not exist, needs to be added manually')
      }
    } catch (err) {
      console.log('Error checking evidence_config column:', err)
    }

    // Try to do a test insert to see what happens
    const testResult = await supabase
      .from('checklist_sections')
      .select('id, title, section_type, evidence_config')
      .limit(1)

    return NextResponse.json({
      message: 'Evidence fields migration check completed',
      test_query: testResult.error ? 'failed' : 'success',
      error: testResult.error?.message || null,
      sample_data: testResult.data || null
    })
  } catch (error: any) {
    console.error('Error in evidence fields migration:', error)
    return NextResponse.json(
      { 
        error: 'Error in migration check', 
        details: error.message,
        stack: error.stack 
      },
      { status: 500 }
    )
  }
} 