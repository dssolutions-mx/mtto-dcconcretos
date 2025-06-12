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

    console.log('Creating asset_operators table...')

    // Create asset_operators table
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create asset_operators table for managing operator assignments
        CREATE TABLE IF NOT EXISTS asset_operators (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
          operator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          assignment_type TEXT NOT NULL CHECK (assignment_type IN ('primary', 'secondary')) DEFAULT 'primary',
          start_date DATE NOT NULL DEFAULT CURRENT_DATE,
          end_date DATE,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
          notes TEXT,
          assigned_by UUID REFERENCES profiles(id),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_by UUID REFERENCES auth.users(id),
          updated_by UUID REFERENCES auth.users(id),
          
          -- Constraints
          UNIQUE(asset_id, operator_id, assignment_type) DEFERRABLE INITIALLY DEFERRED,
          
          -- Ensure only one primary operator per asset at a time
          EXCLUDE (asset_id WITH =, assignment_type WITH =) 
          WHERE (assignment_type = 'primary' AND status = 'active')
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_asset_operators_asset_id ON asset_operators(asset_id);
        CREATE INDEX IF NOT EXISTS idx_asset_operators_operator_id ON asset_operators(operator_id);
        CREATE INDEX IF NOT EXISTS idx_asset_operators_status ON asset_operators(status);
        CREATE INDEX IF NOT EXISTS idx_asset_operators_assignment_type ON asset_operators(assignment_type);
        CREATE INDEX IF NOT EXISTS idx_asset_operators_active_assignments 
          ON asset_operators(asset_id, assignment_type) 
          WHERE status = 'active';

        -- Create trigger for updated_at
        CREATE OR REPLACE FUNCTION update_asset_operators_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_asset_operators_updated_at ON asset_operators;
        CREATE TRIGGER trigger_asset_operators_updated_at
          BEFORE UPDATE ON asset_operators
          FOR EACH ROW
          EXECUTE FUNCTION update_asset_operators_updated_at();

        -- Enable RLS
        ALTER TABLE asset_operators ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        DROP POLICY IF EXISTS "Users can view asset operators from their scope" ON asset_operators;
        CREATE POLICY "Users can view asset operators from their scope" ON asset_operators
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM profiles p 
            JOIN assets a ON a.id = asset_operators.asset_id
            WHERE p.id = auth.uid() 
            AND (
              p.plant_id = a.plant_id 
              OR p.role IN ('GERENCIA_GENERAL')
              OR (p.role = 'JEFE_UNIDAD_NEGOCIO' AND p.business_unit_id = (
                SELECT business_unit_id FROM plants WHERE id = a.plant_id
              ))
            )
          )
        );

        DROP POLICY IF EXISTS "Users can manage asset operators in their scope" ON asset_operators;
        CREATE POLICY "Users can manage asset operators in their scope" ON asset_operators
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM profiles p 
            JOIN assets a ON a.id = asset_operators.asset_id
            WHERE p.id = auth.uid() 
            AND (
              p.plant_id = a.plant_id 
              OR p.role IN ('GERENCIA_GENERAL')
              OR (p.role = 'JEFE_UNIDAD_NEGOCIO' AND p.business_unit_id = (
                SELECT business_unit_id FROM plants WHERE id = a.plant_id
              ))
              OR (p.role IN ('JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO') AND p.plant_id = a.plant_id)
            )
          )
        );

        -- Grant permissions
        GRANT ALL ON asset_operators TO authenticated;
        GRANT USAGE ON SEQUENCE asset_operators_id_seq TO authenticated;
      `
    })

    if (createTableError) {
      console.error('Error creating asset_operators table:', createTableError)
      return NextResponse.json({ 
        error: 'Error creating asset_operators table',
        details: createTableError.message 
      }, { status: 500 })
    }

    console.log('Asset operators table created successfully')

    return NextResponse.json({ 
      message: 'Asset operators table created successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in asset operators migration:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 