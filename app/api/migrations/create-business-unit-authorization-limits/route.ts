import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST() {
  try {
    const supabase = await createClient()

    console.log('Starting business unit authorization limits migration...')

    // For now, we'll create a simplified version using the application layer
    // The actual table creation would need to be done via Supabase dashboard or CLI

    // First, let's check if the table exists by trying to query it
    const { data: existingTable, error: checkError } = await supabase
      .from('business_unit_authorization_limits')
      .select('id')
      .limit(1)

    if (checkError && checkError.code === 'PGRST116') {
      // Table doesn't exist - this is expected for the first run
      console.log('business_unit_authorization_limits table does not exist yet')
      return NextResponse.json({ 
        error: 'Las tablas necesarias deben ser creadas manualmente en Supabase. Por favor contacta al administrador del sistema.',
        details: 'business_unit_authorization_limits table needs to be created manually'
      }, { status: 400 })
    }

    if (checkError) {
      console.error('Error checking table existence:', checkError)
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    // If we get here, the table exists
    console.log('business_unit_authorization_limits table already exists')

    // Check for audit table
    const { data: existingAuditTable, error: auditCheckError } = await supabase
      .from('user_authorization_changes')
      .select('id')
      .limit(1)

    if (auditCheckError && auditCheckError.code === 'PGRST116') {
      console.log('user_authorization_changes table does not exist yet')
      return NextResponse.json({ 
        error: 'Las tablas de auditoría necesarias deben ser creadas manualmente en Supabase. Por favor contacta al administrador del sistema.',
        details: 'user_authorization_changes table needs to be created manually'
      }, { status: 400 })
    }

    if (auditCheckError) {
      console.error('Error checking audit table existence:', auditCheckError)
      return NextResponse.json({ error: auditCheckError.message }, { status: 500 })
    }

    console.log('All required tables exist. Migration check completed successfully')

    return NextResponse.json({ 
      success: true, 
      message: 'Todas las tablas necesarias existen. Sistema de autorización listo para usar.' 
    })

  } catch (error) {
    console.error('Unexpected error in business unit authorization limits migration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 