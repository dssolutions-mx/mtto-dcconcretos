import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user and check permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'GERENCIA_GENERAL') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    console.log('Fixing maintenance_tasks RLS policies...')

    // Fix RLS policies for maintenance_tasks table
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Disable RLS temporarily on maintenance_tasks for emergency fix
        ALTER TABLE maintenance_tasks DISABLE ROW LEVEL SECURITY;

        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view maintenance tasks" ON maintenance_tasks;
        DROP POLICY IF EXISTS "Users can manage maintenance tasks in their scope" ON maintenance_tasks;
        DROP POLICY IF EXISTS "Allow technical roles to access maintenance tasks" ON maintenance_tasks;

        -- Create more permissive RLS policies for maintenance_tasks
        CREATE POLICY "Allow authenticated users to view maintenance tasks" ON maintenance_tasks
        FOR SELECT USING (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.status = 'active'
          )
        );

        CREATE POLICY "Allow technical roles to manage maintenance tasks" ON maintenance_tasks
        FOR ALL USING (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.status = 'active'
            AND p.role IN (
              'GERENCIA_GENERAL',
              'JEFE_UNIDAD_NEGOCIO', 
              'JEFE_PLANTA',
              'ENCARGADO_MANTENIMIENTO'
            )
          )
        );

        -- Re-enable RLS with new policies
        ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;

        -- Grant necessary permissions
        GRANT ALL ON maintenance_tasks TO authenticated;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

        -- Verify the policies were created successfully
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename = 'maintenance_tasks';
      `
    })

    if (policyError) {
      console.error('Error updating maintenance_tasks RLS policies:', policyError)
      return NextResponse.json({ 
        error: `Failed to update RLS policies: ${policyError.message}` 
      }, { status: 500 })
    }

    console.log('Successfully updated maintenance_tasks RLS policies')

    return NextResponse.json({ 
      success: true,
      message: 'maintenance_tasks RLS policies updated successfully'
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
} 