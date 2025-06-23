import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Create authorization_limits table
    const createAuthorizationLimitsTable = `
      CREATE TABLE IF NOT EXISTS authorization_limits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        granted_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
        business_unit_id uuid REFERENCES business_units(id) ON DELETE CASCADE,
        plant_id uuid REFERENCES plants(id) ON DELETE CASCADE,
        max_amount decimal(15,2) NOT NULL DEFAULT 0,
        delegatable_amount decimal(15,2) NOT NULL DEFAULT 0,
        created_at timestamptz DEFAULT NOW(),
        updated_at timestamptz DEFAULT NOW(),
        is_active boolean DEFAULT true,
        notes text,
        
        -- Constraints
        UNIQUE(user_id, business_unit_id, plant_id, is_active),
        CHECK (max_amount >= 0),
        CHECK (delegatable_amount >= 0),
        CHECK (delegatable_amount <= max_amount)
      );
    `

    // Create authorization_delegations table  
    const createAuthorizationDelegationsTable = `
      CREATE TABLE IF NOT EXISTS authorization_delegations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        grantor_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        grantee_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        original_limit_id uuid NOT NULL REFERENCES authorization_limits(id) ON DELETE CASCADE,
        delegated_amount decimal(15,2) NOT NULL,
        business_unit_id uuid REFERENCES business_units(id) ON DELETE CASCADE,
        plant_id uuid REFERENCES plants(id) ON DELETE CASCADE,
        created_at timestamptz DEFAULT NOW(),
        updated_at timestamptz DEFAULT NOW(),
        is_active boolean DEFAULT true,
        notes text,
        
        -- Constraints
        CHECK (delegated_amount > 0),
        CHECK (grantor_user_id != grantee_user_id)
      );
    `

    // Create indexes for performance
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_authorization_limits_user_id ON authorization_limits(user_id);
      CREATE INDEX IF NOT EXISTS idx_authorization_limits_granted_by ON authorization_limits(granted_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_authorization_limits_business_unit ON authorization_limits(business_unit_id);
      CREATE INDEX IF NOT EXISTS idx_authorization_limits_plant ON authorization_limits(plant_id);
      CREATE INDEX IF NOT EXISTS idx_authorization_limits_active ON authorization_limits(is_active);
      
      CREATE INDEX IF NOT EXISTS idx_authorization_delegations_grantor ON authorization_delegations(grantor_user_id);
      CREATE INDEX IF NOT EXISTS idx_authorization_delegations_grantee ON authorization_delegations(grantee_user_id);
      CREATE INDEX IF NOT EXISTS idx_authorization_delegations_original_limit ON authorization_delegations(original_limit_id);
      CREATE INDEX IF NOT EXISTS idx_authorization_delegations_active ON authorization_delegations(is_active);
    `

    // Create view for easy authorization queries
    const createAuthorizationView = `
      CREATE OR REPLACE VIEW user_authorization_summary AS
      SELECT 
        p.id as user_id,
        p.nombre || ' ' || p.apellido as user_name,
        p.role as user_role,
        bu.id as business_unit_id,
        bu.name as business_unit_name,
        pl.id as plant_id,
        pl.name as plant_name,
        COALESCE(al.max_amount, 0) as direct_authorization_limit,
        COALESCE(
          (SELECT SUM(ad.delegated_amount) 
           FROM authorization_delegations ad 
           WHERE ad.grantee_user_id = p.id AND ad.is_active = true), 
          0
        ) as delegated_authorization_limit,
        COALESCE(al.max_amount, 0) + COALESCE(
          (SELECT SUM(ad.delegated_amount) 
           FROM authorization_delegations ad 
           WHERE ad.grantee_user_id = p.id AND ad.is_active = true), 
          0
        ) as total_authorization_limit,
        COALESCE(al.delegatable_amount, 0) - COALESCE(
          (SELECT SUM(ad.delegated_amount) 
           FROM authorization_delegations ad 
           WHERE ad.grantor_user_id = p.id AND ad.is_active = true), 
          0
        ) as available_to_delegate,
        COALESCE(
          (SELECT SUM(ad.delegated_amount) 
           FROM authorization_delegations ad 
           WHERE ad.grantor_user_id = p.id AND ad.is_active = true), 
          0
        ) as delegated_to_others,
        al.granted_by_user_id,
        CASE 
          WHEN al.granted_by_user_id IS NULL THEN gp.nombre || ' ' || gp.apellido
          ELSE NULL
        END as granted_by_user_name,
        CASE 
          WHEN p.role = 'GERENCIA_GENERAL' THEN 0
          WHEN p.role = 'JEFE_UNIDAD_NEGOCIO' THEN 1
          WHEN p.role = 'AREA_ADMINISTRATIVA' THEN 2
          WHEN p.role = 'JEFE_PLANTA' THEN 2
          ELSE 3
        END as hierarchy_level
      FROM profiles p
      LEFT JOIN authorization_limits al ON p.id = al.user_id AND al.is_active = true
      LEFT JOIN business_units bu ON al.business_unit_id = bu.id
      LEFT JOIN plants pl ON al.plant_id = pl.id
      LEFT JOIN profiles gp ON al.granted_by_user_id = gp.id
      WHERE p.is_active = true;
    `

    // Function to calculate available delegation amount
    const createDelegationFunction = `
      CREATE OR REPLACE FUNCTION get_available_delegation_amount(
        p_user_id uuid,
        p_business_unit_id uuid DEFAULT NULL,
        p_plant_id uuid DEFAULT NULL
      )
      RETURNS decimal(15,2)
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_delegatable_amount decimal(15,2) := 0;
        v_already_delegated decimal(15,2) := 0;
      BEGIN
        -- Get the user's delegatable amount
        SELECT COALESCE(delegatable_amount, 0)
        INTO v_delegatable_amount
        FROM authorization_limits
        WHERE user_id = p_user_id 
          AND is_active = true
          AND (business_unit_id = p_business_unit_id OR (business_unit_id IS NULL AND p_business_unit_id IS NULL))
          AND (plant_id = p_plant_id OR (plant_id IS NULL AND p_plant_id IS NULL));
        
        -- Get amount already delegated
        SELECT COALESCE(SUM(delegated_amount), 0)
        INTO v_already_delegated
        FROM authorization_delegations
        WHERE grantor_user_id = p_user_id 
          AND is_active = true
          AND (business_unit_id = p_business_unit_id OR (business_unit_id IS NULL AND p_business_unit_id IS NULL))
          AND (plant_id = p_plant_id OR (plant_id IS NULL AND p_plant_id IS NULL));
        
        RETURN v_delegatable_amount - v_already_delegated;
      END;
      $$;
    `

    // Function to check if user can authorize amount
    const createAuthorizationCheckFunction = `
      CREATE OR REPLACE FUNCTION can_user_authorize_amount(
        p_user_id uuid,
        p_amount decimal(15,2),
        p_business_unit_id uuid DEFAULT NULL,
        p_plant_id uuid DEFAULT NULL
      )
      RETURNS boolean
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_total_limit decimal(15,2) := 0;
      BEGIN
        -- Get total authorization limit (direct + delegated)
        SELECT total_authorization_limit
        INTO v_total_limit
        FROM user_authorization_summary
        WHERE user_id = p_user_id
          AND (business_unit_id = p_business_unit_id OR (business_unit_id IS NULL AND p_business_unit_id IS NULL))
          AND (plant_id = p_plant_id OR (plant_id IS NULL AND p_plant_id IS NULL));
        
        RETURN COALESCE(v_total_limit, 0) >= p_amount;
      END;
      $$;
    `

    // Enable RLS
    const enableRLS = `
      ALTER TABLE authorization_limits ENABLE ROW LEVEL SECURITY;
      ALTER TABLE authorization_delegations ENABLE ROW LEVEL SECURITY;
    `

    // Create RLS policies
    const createRLSPolicies = `
      -- Authorization limits policies
      CREATE POLICY "Users can view their own authorization limits" ON authorization_limits
        FOR SELECT USING (user_id = auth.uid());
      
      CREATE POLICY "Users can view limits they granted" ON authorization_limits
        FOR SELECT USING (granted_by_user_id = auth.uid());
      
      CREATE POLICY "Admin roles can view all authorization limits" ON authorization_limits
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA')
          )
        );
      
      CREATE POLICY "Admin roles can manage authorization limits" ON authorization_limits
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA')
          )
        );
      
      -- Authorization delegations policies  
      CREATE POLICY "Users can view delegations they granted or received" ON authorization_delegations
        FOR SELECT USING (grantor_user_id = auth.uid() OR grantee_user_id = auth.uid());
      
      CREATE POLICY "Users can create delegations they grant" ON authorization_delegations
        FOR INSERT WITH CHECK (grantor_user_id = auth.uid());
      
      CREATE POLICY "Users can update delegations they granted" ON authorization_delegations
        FOR UPDATE USING (grantor_user_id = auth.uid());
      
      CREATE POLICY "Admin roles can view all delegations" ON authorization_delegations
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA')
          )
        );
    `

    // Execute all SQL statements
    const { error: tableError1 } = await supabase.rpc('exec_sql', { 
      sql_query: createAuthorizationLimitsTable 
    })
    if (tableError1) throw tableError1

    const { error: tableError2 } = await supabase.rpc('exec_sql', { 
      sql_query: createAuthorizationDelegationsTable 
    })
    if (tableError2) throw tableError2

    const { error: indexError } = await supabase.rpc('exec_sql', { 
      sql_query: createIndexes 
    })
    if (indexError) throw indexError

    const { error: viewError } = await supabase.rpc('exec_sql', { 
      sql_query: createAuthorizationView 
    })
    if (viewError) throw viewError

    const { error: functionError1 } = await supabase.rpc('exec_sql', { 
      sql_query: createDelegationFunction 
    })
    if (functionError1) throw functionError1

    const { error: functionError2 } = await supabase.rpc('exec_sql', { 
      sql_query: createAuthorizationCheckFunction 
    })
    if (functionError2) throw functionError2

    const { error: rlsError } = await supabase.rpc('exec_sql', { 
      sql_query: enableRLS 
    })
    if (rlsError) throw rlsError

    const { error: policyError } = await supabase.rpc('exec_sql', { 
      sql_query: createRLSPolicies 
    })
    if (policyError) throw policyError

    return NextResponse.json({
      success: true,
      message: 'Authorization delegation system created successfully',
      tables_created: [
        'authorization_limits',
        'authorization_delegations',
        'user_authorization_summary (view)'
      ],
      functions_created: [
        'get_available_delegation_amount',
        'can_user_authorize_amount'
      ]
    })

  } catch (error) {
    console.error('Error creating authorization delegation system:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create authorization delegation system',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 