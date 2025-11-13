import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * Auto-create work orders for pending issues older than 1 hour
 *
 * This endpoint calls the Supabase database function that handles auto-creation.
 * The actual cron job runs in the database using pg_cron (see migration file).
 *
 * This endpoint can be used for:
 * 1. Manual triggering from admin dashboard
 * 2. Monitoring/testing the auto-creation system
 * 3. Backup trigger if database cron fails
 */

export async function GET() {
  try {
    const supabase = await createClient()

    console.log('🔄 Triggering auto-create for pending work orders...')

    // Call the database function that handles all the logic
    const { data, error } = await supabase
      .rpc('auto_create_pending_work_orders')

    if (error) {
      console.error('Error calling auto-create function:', error)
      return NextResponse.json(
        {
          error: 'Error al ejecutar auto-creación',
          details: error.message
        },
        { status: 500 }
      )
    }

    console.log('✅ Auto-create completed:', data)

    return NextResponse.json({
      success: true,
      ...data
    })

  } catch (error: any) {
    console.error('Error in auto-create endpoint:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}

// Also support POST for more secure manual triggers
export async function POST() {
  return GET()
}
