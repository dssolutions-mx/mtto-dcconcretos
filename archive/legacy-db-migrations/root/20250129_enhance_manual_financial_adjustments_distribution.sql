-- Enhancement Migration: Add distribution and classification features to manual financial adjustments
-- Adds bonus/cash payment tracking and distribution system for shared costs

-- Step 1: Add new columns to manual_financial_adjustments table
ALTER TABLE manual_financial_adjustments
  ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_cash_payment BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_distributed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS distribution_method TEXT CHECK (distribution_method IN ('percentage', 'volume', NULL));

-- Step 2: Create manual_financial_adjustment_distributions table
CREATE TABLE IF NOT EXISTS manual_financial_adjustment_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES manual_financial_adjustments(id) ON DELETE CASCADE,
  
  -- Target of distribution (one of these must be set)
  business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  department TEXT, -- Department name from profiles.departamento
  
  -- Distribution amount and percentage
  -- For percentage-based: percentage is user input, amount is calculated
  -- For volume-based: percentage is calculated from volume, amount is calculated
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  
  -- Volume used for distribution (only populated for volume-based method)
  volume_m3 DECIMAL(15,2), -- Concrete volume for this target in the period
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- Ensure at least one target is set
  CHECK (
    (business_unit_id IS NOT NULL)::int + 
    (plant_id IS NOT NULL)::int + 
    (department IS NOT NULL)::int = 1
  )
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_adj_distributions_adjustment 
  ON manual_financial_adjustment_distributions(adjustment_id);
CREATE INDEX IF NOT EXISTS idx_adj_distributions_plant 
  ON manual_financial_adjustment_distributions(plant_id);
CREATE INDEX IF NOT EXISTS idx_adj_distributions_bu 
  ON manual_financial_adjustment_distributions(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_adj_distributions_dept 
  ON manual_financial_adjustment_distributions(department);
CREATE INDEX IF NOT EXISTS idx_adj_distributions_period 
  ON manual_financial_adjustment_distributions(adjustment_id, plant_id);

-- Step 4: Add indexes for new columns in main table
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_is_distributed 
  ON manual_financial_adjustments(is_distributed);
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_distribution_method 
  ON manual_financial_adjustments(distribution_method);
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_is_bonus 
  ON manual_financial_adjustments(is_bonus);
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_is_cash_payment 
  ON manual_financial_adjustments(is_cash_payment);

-- Step 5: Enable RLS on distributions table
ALTER TABLE manual_financial_adjustment_distributions ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for distributions table
-- Admin, Gerente, and RH can view distributions for adjustments they can view
CREATE POLICY "Admin and Gerente can view manual_financial_adjustment_distributions"
  ON manual_financial_adjustment_distributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'AREA_ADMINISTRATIVA'::user_role)
      AND EXISTS (
        SELECT 1 FROM manual_financial_adjustments
        WHERE manual_financial_adjustments.id = manual_financial_adjustment_distributions.adjustment_id
      )
    )
  );

-- Admin and RH can insert distributions
CREATE POLICY "Admin and RH can insert manual_financial_adjustment_distributions"
  ON manual_financial_adjustment_distributions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role)
    )
  );

-- Admin and RH can update distributions (same rules as parent adjustment)
CREATE POLICY "Admin and RH can update manual_financial_adjustment_distributions"
  ON manual_financial_adjustment_distributions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'GERENCIA_GENERAL'::user_role
        OR (
          profiles.role = 'AREA_ADMINISTRATIVA'::user_role
          AND EXISTS (
            SELECT 1 FROM manual_financial_adjustments
            WHERE manual_financial_adjustments.id = manual_financial_adjustment_distributions.adjustment_id
            AND manual_financial_adjustments.created_by = auth.uid()
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'GERENCIA_GENERAL'::user_role
        OR (
          profiles.role = 'AREA_ADMINISTRATIVA'::user_role
          AND EXISTS (
            SELECT 1 FROM manual_financial_adjustments
            WHERE manual_financial_adjustments.id = manual_financial_adjustment_distributions.adjustment_id
            AND manual_financial_adjustments.created_by = auth.uid()
          )
        )
      )
    )
  );

-- Admin can delete distributions
CREATE POLICY "Admin can delete manual_financial_adjustment_distributions"
  ON manual_financial_adjustment_distributions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'GERENCIA_GENERAL'::user_role
    )
  );

-- Step 7: Comments for documentation
COMMENT ON COLUMN manual_financial_adjustments.is_bonus IS 'Flag indicating if this entry is a bonus payment';
COMMENT ON COLUMN manual_financial_adjustments.is_cash_payment IS 'Flag indicating if payment was made in cash';
COMMENT ON COLUMN manual_financial_adjustments.is_distributed IS 'Flag indicating if this entry is distributed across multiple targets';
COMMENT ON COLUMN manual_financial_adjustments.distribution_method IS 'Method used for distribution: percentage (manual) or volume (automatic based on concrete sales)';
COMMENT ON TABLE manual_financial_adjustment_distributions IS 'Distribution breakdowns for manual financial adjustments that are allocated across multiple plants/BUs/departments';
COMMENT ON COLUMN manual_financial_adjustment_distributions.department IS 'Department name from profiles.departamento field';
COMMENT ON COLUMN manual_financial_adjustment_distributions.volume_m3 IS 'Concrete volume (m³) used for volume-based distribution calculations';

