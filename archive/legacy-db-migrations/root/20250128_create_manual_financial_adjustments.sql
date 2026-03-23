-- Manual Financial Adjustments Table
-- For tracking nomina and otros indirectos that are entered manually by admins/RH
CREATE TABLE IF NOT EXISTS manual_financial_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization hierarchy
  business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
  
  -- Time period (month-based for aggregation)
  period_month DATE NOT NULL, -- First day of the month (e.g., '2025-01-01')
  
  -- Category and details
  category TEXT NOT NULL CHECK (category IN ('nomina', 'otros_indirectos')),
  department TEXT, -- Optional: Specific department (e.g., 'RH', 'Admin', 'Operaciones')
  subcategory TEXT, -- Optional: Free-form subcategory for granular tracking
  description TEXT,
  
  -- Financial data
  amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  
  -- Notes
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_period ON manual_financial_adjustments(period_month);
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_plant ON manual_financial_adjustments(plant_id);
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_bu ON manual_financial_adjustments(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_category ON manual_financial_adjustments(category);
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_created_at ON manual_financial_adjustments(created_at);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_lookup 
  ON manual_financial_adjustments(period_month, plant_id, category);

-- Enable RLS
ALTER TABLE manual_financial_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin and Gerente can view all
CREATE POLICY "Admin and Gerente can view manual_financial_adjustments"
  ON manual_financial_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gerente', 'rh')
    )
  );

-- Admin and RH can insert
CREATE POLICY "Admin and RH can insert manual_financial_adjustments"
  ON manual_financial_adjustments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'rh')
    )
  );

-- Admin and RH can update their own or all (if admin)
CREATE POLICY "Admin and RH can update manual_financial_adjustments"
  ON manual_financial_adjustments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (profiles.role = 'rh' AND manual_financial_adjustments.created_by = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (profiles.role = 'rh' AND manual_financial_adjustments.created_by = auth.uid())
      )
    )
  );

-- Admin can delete
CREATE POLICY "Admin can delete manual_financial_adjustments"
  ON manual_financial_adjustments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add audit trigger
CREATE TRIGGER manual_financial_adjustments_updated_at
  BEFORE UPDATE ON manual_financial_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE manual_financial_adjustments IS 'Manual financial entries for nómina and otros indirectos costs that cannot be automatically calculated';
COMMENT ON COLUMN manual_financial_adjustments.period_month IS 'First day of the month for aggregation (YYYY-MM-01)';
COMMENT ON COLUMN manual_financial_adjustments.category IS 'Either nomina or otros_indirectos';
COMMENT ON COLUMN manual_financial_adjustments.department IS 'Optional department for granular tracking';
COMMENT ON COLUMN manual_financial_adjustments.subcategory IS 'Free-form subcategory for flexibility';




