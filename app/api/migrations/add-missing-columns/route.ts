import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Add missing downtime_hours column to maintenance_history table
    const { error: downtimeError } = await supabase.rpc('add_column_if_not_exists', {
      p_table: 'maintenance_history',
      p_column: 'downtime_hours',
      p_type: 'numeric',
      p_constraint: 'DEFAULT 0'
    })
    
    if (downtimeError) {
      console.error('Error adding downtime_hours column to maintenance_history:', downtimeError)
    }
    
    // Add missing completion_date column to service_orders table
    const { error: completionDateError } = await supabase.rpc('add_column_if_not_exists', {
      p_table: 'service_orders',
      p_column: 'completion_date',
      p_type: 'timestamp with time zone',
      p_constraint: 'NULL'
    })
    
    if (completionDateError) {
      console.error('Error adding completion_date column to service_orders:', completionDateError)
    }
    
    // Add missing technician_notes column to maintenance_history if needed
    const { error: technicianNotesError } = await supabase.rpc('add_column_if_not_exists', {
      p_table: 'maintenance_history',
      p_column: 'technician_notes',
      p_type: 'text',
      p_constraint: 'NULL'
    })
    
    if (technicianNotesError) {
      console.error('Error adding technician_notes column to maintenance_history:', technicianNotesError)
    }
    
    // Add missing resolution_details column to maintenance_history if needed
    const { error: resolutionDetailsError } = await supabase.rpc('add_column_if_not_exists', {
      p_table: 'maintenance_history',
      p_column: 'resolution_details',
      p_type: 'text',
      p_constraint: 'NULL'
    })
    
    if (resolutionDetailsError) {
      console.error('Error adding resolution_details column to maintenance_history:', resolutionDetailsError)
    }
    
    return NextResponse.json({
      message: 'Migration completed',
      results: {
        downtimeHours: downtimeError ? 'Error' : 'Added or already exists',
        completionDate: completionDateError ? 'Error' : 'Added or already exists',
        technicianNotes: technicianNotesError ? 'Error' : 'Added or already exists',
        resolutionDetails: resolutionDetailsError ? 'Error' : 'Added or already exists'
      }
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
} 