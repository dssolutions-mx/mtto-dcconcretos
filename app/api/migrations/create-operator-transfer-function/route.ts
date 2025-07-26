import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user and verify admin permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin privileges
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'GERENCIA_GENERAL') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Create the operator transfer function
    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create function for atomic operator transfers
        CREATE OR REPLACE FUNCTION transfer_operator_assignment(
          p_operator_id UUID,
          p_from_asset_id UUID,
          p_to_asset_id UUID,
          p_assignment_type TEXT DEFAULT 'primary',
          p_user_id UUID,
          p_transfer_reason TEXT DEFAULT 'Transfer operation',
          p_force_transfer BOOLEAN DEFAULT FALSE
        ) RETURNS JSON AS $$
        DECLARE
          v_existing_primary_id UUID;
          v_removed_assignments INTEGER := 0;
          v_created_assignments INTEGER := 0;
          v_transfer_id UUID := uuid_generate_v4();
          v_current_assignment RECORD;
          v_result JSON;
        BEGIN
          -- Start transaction
          -- Check if operator exists and is active
          IF NOT EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = p_operator_id AND status = 'active'
          ) THEN
            RAISE EXCEPTION 'Operator not found or inactive';
          END IF;

          -- Check if target asset exists
          IF NOT EXISTS (
            SELECT 1 FROM assets WHERE id = p_to_asset_id
          ) THEN
            RAISE EXCEPTION 'Target asset not found';
          END IF;

          -- Check if operator is already assigned to target asset
          IF EXISTS (
            SELECT 1 FROM asset_operators
            WHERE operator_id = p_operator_id 
            AND asset_id = p_to_asset_id 
            AND status = 'active'
          ) THEN
            RAISE EXCEPTION 'Operator is already assigned to this asset';
          END IF;

          -- If assigning as primary, check for existing primary operator
          IF p_assignment_type = 'primary' THEN
            SELECT id INTO v_existing_primary_id
            FROM asset_operators
            WHERE asset_id = p_to_asset_id 
            AND assignment_type = 'primary' 
            AND status = 'active'
            LIMIT 1;

            -- If there's an existing primary and force_transfer is false, raise error
            IF v_existing_primary_id IS NOT NULL AND NOT p_force_transfer THEN
              RAISE EXCEPTION 'Asset already has a primary operator. Use force_transfer to replace.';
            END IF;

            -- If force_transfer is true, deactivate existing primary
            IF v_existing_primary_id IS NOT NULL AND p_force_transfer THEN
              UPDATE asset_operators
              SET 
                status = 'inactive',
                end_date = CURRENT_DATE,
                updated_by = p_user_id,
                updated_at = NOW(),
                notes = COALESCE(notes, '') || ' | Replaced by transfer operation: ' || p_transfer_reason
              WHERE id = v_existing_primary_id;
              
              v_removed_assignments := v_removed_assignments + 1;
            END IF;
          END IF;

          -- If from_asset_id is provided, deactivate assignments from that asset
          IF p_from_asset_id IS NOT NULL THEN
            FOR v_current_assignment IN
              SELECT id, assignment_type
              FROM asset_operators
              WHERE operator_id = p_operator_id 
              AND asset_id = p_from_asset_id 
              AND status = 'active'
            LOOP
              UPDATE asset_operators
              SET 
                status = 'inactive',
                end_date = CURRENT_DATE,
                updated_by = p_user_id,
                updated_at = NOW(),
                notes = COALESCE(notes, '') || ' | Transfer to asset: ' || p_to_asset_id || ' - ' || p_transfer_reason
              WHERE id = v_current_assignment.id;
              
              v_removed_assignments := v_removed_assignments + 1;
            END LOOP;
          ELSE
            -- If no from_asset_id specified, deactivate ALL active assignments for this operator
            -- This ensures clean transfer when moving operators between assets
            FOR v_current_assignment IN
              SELECT id, assignment_type, asset_id
              FROM asset_operators
              WHERE operator_id = p_operator_id 
              AND status = 'active'
            LOOP
              UPDATE asset_operators
              SET 
                status = 'inactive',
                end_date = CURRENT_DATE,
                updated_by = p_user_id,
                updated_at = NOW(),
                notes = COALESCE(notes, '') || ' | Transferred to asset: ' || p_to_asset_id || ' - ' || p_transfer_reason
              WHERE id = v_current_assignment.id;
              
              v_removed_assignments := v_removed_assignments + 1;
            END LOOP;
          END IF;

          -- Create new assignment
          INSERT INTO asset_operators (
            id,
            asset_id,
            operator_id,
            assignment_type,
            start_date,
            status,
            notes,
            assigned_by,
            created_by,
            updated_by
          ) VALUES (
            uuid_generate_v4(),
            p_to_asset_id,
            p_operator_id,
            p_assignment_type,
            CURRENT_DATE,
            'active',
            'Created by transfer operation: ' || p_transfer_reason,
            p_user_id,
            p_user_id,
            p_user_id
          );

          v_created_assignments := 1;

          -- Update asset status to active if assigning primary operator
          IF p_assignment_type = 'primary' THEN
            UPDATE assets
            SET 
              status = 'active',
              updated_by = p_user_id,
              updated_at = NOW()
            WHERE id = p_to_asset_id;
          END IF;

          -- If we removed assignments from source asset and it was a primary operator,
          -- check if the source asset should be marked as inactive
          IF p_from_asset_id IS NOT NULL THEN
            IF NOT EXISTS (
              SELECT 1 FROM asset_operators
              WHERE asset_id = p_from_asset_id 
              AND assignment_type = 'primary' 
              AND status = 'active'
            ) THEN
              UPDATE assets
              SET 
                status = 'inactive',
                updated_by = p_user_id,
                updated_at = NOW()
              WHERE id = p_from_asset_id;
            END IF;
          END IF;

          -- Log the transfer operation in assignment history (if table exists)
          BEGIN
            INSERT INTO asset_assignment_history (
              asset_id,
              operator_id,
              operation_type,
              previous_asset_id,
              new_asset_id,
              assignment_type,
              changed_by,
              change_reason,
              transfer_id
            ) VALUES (
              p_to_asset_id,
              p_operator_id,
              'transfer',
              p_from_asset_id,
              p_to_asset_id,
              p_assignment_type,
              p_user_id,
              p_transfer_reason,
              v_transfer_id
            );
          EXCEPTION WHEN undefined_table THEN
            -- Ignore if history table doesn't exist yet
            NULL;
          END;

          -- Build result
          v_result := json_build_object(
            'success', true,
            'transfer_id', v_transfer_id,
            'removed_assignments', v_removed_assignments,
            'created_assignments', v_created_assignments,
            'operator_id', p_operator_id,
            'target_asset_id', p_to_asset_id,
            'assignment_type', p_assignment_type
          );

          RETURN v_result;

        EXCEPTION WHEN OTHERS THEN
          -- Re-raise the exception with more context
          RAISE EXCEPTION 'Transfer operation failed: %', SQLERRM;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        -- Grant execute permission to authenticated users
        GRANT EXECUTE ON FUNCTION transfer_operator_assignment TO authenticated;

        -- Create assignment history table if it doesn't exist
        CREATE TABLE IF NOT EXISTS asset_assignment_history (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          asset_id UUID REFERENCES assets(id),
          operator_id UUID REFERENCES profiles(id),
          operation_type TEXT NOT NULL CHECK (operation_type IN ('assign', 'unassign', 'transfer', 'replace')),
          previous_asset_id UUID REFERENCES assets(id),
          new_asset_id UUID REFERENCES assets(id),
          assignment_type TEXT NOT NULL CHECK (assignment_type IN ('primary', 'secondary')),
          changed_by UUID REFERENCES auth.users(id),
          change_reason TEXT,
          transfer_id UUID,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Indexes for better performance
          INDEX idx_assignment_history_asset_id (asset_id),
          INDEX idx_assignment_history_operator_id (operator_id),
          INDEX idx_assignment_history_transfer_id (transfer_id),
          INDEX idx_assignment_history_created_at (created_at)
        );

        -- Enable RLS on history table
        ALTER TABLE asset_assignment_history ENABLE ROW LEVEL SECURITY;

        -- Create policy for assignment history
        DROP POLICY IF EXISTS "Users can view assignment history in their scope" ON asset_assignment_history;
        CREATE POLICY "Users can view assignment history in their scope" ON asset_assignment_history
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM profiles p 
            JOIN assets a ON a.id = asset_assignment_history.asset_id
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

        -- Grant permissions on history table
        GRANT SELECT ON asset_assignment_history TO authenticated;
      `
    })

    if (functionError) {
      console.error('Error creating transfer function:', functionError)
      return NextResponse.json({ 
        error: `Failed to create transfer function: ${functionError.message}` 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Operator transfer function created successfully',
      function_name: 'transfer_operator_assignment',
      features: [
        'Atomic operator transfers between assets',
        'Automatic cleanup of previous assignments', 
        'Force transfer option for replacing primary operators',
        'Asset status management (active/inactive)',
        'Assignment history tracking',
        'Comprehensive error handling'
      ]
    })

  } catch (error) {
    console.error('Error in migration:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 