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

    console.log('Fixing asset_operators RLS policies...')

    // Fix RLS policies for asset_operators table
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view asset operators from their scope" ON asset_operators;
        DROP POLICY IF EXISTS "Users can manage asset operators in their scope" ON asset_operators;

        -- Create simplified and more permissive RLS policies
        CREATE POLICY "Allow authenticated users to view asset operators" ON asset_operators
        FOR SELECT USING (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.status = 'active'
          )
        );

        CREATE POLICY "Allow users to manage asset operators" ON asset_operators
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

        -- Create policy for operators to view their own assignments
        CREATE POLICY "Allow operators to view their assignments" ON asset_operators
        FOR SELECT USING (
          auth.uid() = operator_id
        );

        -- Ensure RLS is enabled
        ALTER TABLE asset_operators ENABLE ROW LEVEL SECURITY;

        -- Grant necessary permissions
        GRANT ALL ON asset_operators TO authenticated;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      `
    })

    if (policyError) {
      console.error('Error updating RLS policies:', policyError)
      return NextResponse.json({ 
        error: `Failed to update RLS policies: ${policyError.message}` 
      }, { status: 500 })
    }

    console.log('✅ Asset operators RLS policies updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Asset operators RLS policies updated successfully',
      changes: [
        'Simplified view policy for authenticated users',
        'Restricted management to authorized roles',
        'Added policy for operators to view their own assignments',
        'Ensured proper permissions are granted'
      ]
    })

  } catch (error) {
    console.error('RLS policy update error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
} 