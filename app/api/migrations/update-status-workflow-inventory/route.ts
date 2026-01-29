import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { readFileSync } from "fs"
import { join } from "path"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: "No autorizado" 
      }, { status: 401 })
    }

    // Read migration file
    const migrationPath = join(process.cwd(), 'migrations/sql/20260129_update_status_workflow_for_inventory.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    // Split migration into individual statements (semicolon-separated)
    // Remove comments and empty lines, then split by semicolons
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .map(s => s + ';') // Add semicolon back

    console.log(`Executing ${statements.length} SQL statements...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`Executing statement ${i + 1}/${statements.length}...`)
      
      // Skip empty statements
      if (!statement || statement.trim() === ';') continue

      // Execute via RPC if available, otherwise direct query
      try {
        // Try using exec_sql RPC function if it exists
        const { error: rpcError } = await supabase.rpc('exec_sql', { 
          sql: statement 
        })
        
        if (rpcError) {
          // If RPC doesn't work, try direct query (may not work for DDL)
          console.warn(`RPC exec_sql failed, trying alternative method:`, rpcError.message)
          // For DDL operations, we might need to use a different approach
          // This is a limitation - DDL operations typically need to be run via Supabase Dashboard or MCP
          throw new Error(`Cannot execute DDL via client. Please run migration manually in Supabase SQL Editor: ${rpcError.message}`)
        }
      } catch (err) {
        console.error(`Error executing statement ${i + 1}:`, err)
        throw err
      }
    }

    return NextResponse.json({ 
      success: true,
      message: "Migration applied successfully",
      statements_executed: statements.length
    })
  } catch (error) {
    console.error('Error applying migration:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Error applying migration",
      note: "DDL operations may need to be run manually in Supabase SQL Editor"
    }, { status: 500 })
  }
}
