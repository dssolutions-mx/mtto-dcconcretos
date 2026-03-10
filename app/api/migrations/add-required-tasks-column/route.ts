import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

const MIGRATION_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'work_orders'
    AND column_name = 'required_tasks'
  ) THEN
    ALTER TABLE work_orders
    ADD COLUMN required_tasks JSONB DEFAULT '[]'::jsonb;

    COMMENT ON COLUMN work_orders.required_tasks IS 'Array of maintenance tasks from the maintenance plan, stored as JSONB with task details including id, description, type, estimated_time, requires_specialist, and associated parts';
  END IF;
END $$;
`

export async function GET() {
  return NextResponse.json({
    message: "Migration: Add required_tasks column to work_orders table",
    sql: MIGRATION_SQL.trim(),
    instructions: [
      "1. Go to Supabase Dashboard",
      "2. Navigate to SQL Editor",
      "3. Execute the SQL provided above",
      "4. Verify the column was added by checking the work_orders table schema",
    ],
  })
}

export async function POST() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if column exists by attempting a select
    const { error: selectError } = await supabase
      .from("work_orders")
      .select("required_tasks")
      .limit(1)

    if (!selectError) {
      return NextResponse.json({
        success: true,
        message: "Column required_tasks already exists",
        columnExists: true,
      })
    }

    // Column doesn't exist - return SQL for manual execution
    // (Supabase client cannot execute DDL directly)
    return NextResponse.json({
      success: false,
      message: "Column does not exist. Please execute the SQL in Supabase SQL Editor.",
      sql: MIGRATION_SQL.trim(),
      instructions: [
        "1. Go to Supabase Dashboard",
        "2. Navigate to SQL Editor",
        "3. Execute the SQL provided above",
      ],
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to check migration status"
    return NextResponse.json(
      {
        error: msg,
        sql: MIGRATION_SQL.trim(),
        instructions: "Execute the SQL above in Supabase SQL Editor to add the required_tasks column.",
      },
      { status: 500 }
    )
  }
}
