-- Suppliers System Database Schema
-- This migration creates a comprehensive supplier management system
-- to improve purchase orders and work order efficiency

-- Create suppliers table (main supplier registry)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255), -- Razón social
    tax_id VARCHAR(50), -- RFC/CUIT
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'México',

    -- Business information
    supplier_type VARCHAR(50) CHECK (supplier_type IN ('individual', 'company', 'distributor', 'manufacturer', 'service_provider')),
    industry VARCHAR(100),
    specialties TEXT[], -- Array of specialties/services
    certifications TEXT[], -- Array of certifications
    business_hours JSONB, -- Store business hours as JSON

    -- Financial information
    payment_terms VARCHAR(50), -- '30_days', '15_days', 'cash', 'immediate'
    payment_methods TEXT[], -- Array of accepted payment methods
    bank_account_info JSONB, -- Encrypted bank details
    tax_exempt BOOLEAN DEFAULT false,

    -- Performance tracking
    rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5),
    total_orders INTEGER DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    avg_order_amount DECIMAL(10,2) DEFAULT 0,
    avg_delivery_time INTEGER, -- in days
    reliability_score DECIMAL(3,2) CHECK (reliability_score >= 0 AND reliability_score <= 100),

    -- System fields
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'blacklisted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Indexes
    CONSTRAINT suppliers_name_unique UNIQUE (name)
);

-- Create supplier_contacts table (multiple contacts per supplier)
CREATE TABLE IF NOT EXISTS supplier_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    contact_type VARCHAR(50) DEFAULT 'general', -- 'general', 'technical', 'billing', 'emergency'
    name VARCHAR(255) NOT NULL,
    position VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile_phone VARCHAR(50),
    notes TEXT,

    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create supplier_services table (services/products offered by supplier)
CREATE TABLE IF NOT EXISTS supplier_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    service_category VARCHAR(100), -- 'maintenance', 'repair', 'parts', 'tools', 'equipment'
    description TEXT,
    unit_cost DECIMAL(10,2),
    unit_of_measure VARCHAR(50), -- 'hour', 'piece', 'kg', 'liter', etc.
    lead_time_days INTEGER, -- estimated delivery time
    warranty_period VARCHAR(50), -- '6_months', '1_year', '2_years', etc.

    is_active BOOLEAN DEFAULT true,
    stock_available INTEGER DEFAULT 0,
    min_order_quantity INTEGER DEFAULT 1,
    max_order_quantity INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create supplier_performance_history table (historical data)
CREATE TABLE IF NOT EXISTS supplier_performance_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    purchase_order_id UUID REFERENCES purchase_orders(id),
    work_order_id UUID REFERENCES work_orders(id),

    -- Performance metrics for this specific order
    order_date DATE NOT NULL,
    delivery_date DATE,
    promised_delivery_date DATE,
    actual_cost DECIMAL(10,2),
    quoted_cost DECIMAL(10,2),
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
    service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),

    -- Issues and notes
    issues TEXT[],
    notes TEXT,
    resolution_time_hours INTEGER, -- time to resolve issues

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create supplier_work_history table (specific work history with assets)
CREATE TABLE IF NOT EXISTS supplier_work_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    work_order_id UUID REFERENCES work_orders(id),
    asset_id UUID REFERENCES assets(id),

    -- Work details
    work_type VARCHAR(100), -- 'repair', 'maintenance', 'installation', 'inspection'
    problem_description TEXT,
    solution_description TEXT,
    parts_used JSONB, -- array of parts with quantities and costs
    labor_hours DECIMAL(6,2),
    total_cost DECIMAL(10,2),

    -- Performance
    completed_on_time BOOLEAN,
    quality_satisfaction INTEGER CHECK (quality_satisfaction >= 1 AND quality_satisfaction <= 5),
    would_recommend BOOLEAN,

    -- Follow-up
    warranty_expiration DATE,
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create supplier_certifications table (certifications and licenses)
CREATE TABLE IF NOT EXISTS supplier_certifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    certification_name VARCHAR(255) NOT NULL,
    issuing_body VARCHAR(255),
    certification_number VARCHAR(100),
    issue_date DATE,
    expiration_date DATE,
    certificate_url TEXT, -- URL to certificate document

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(supplier_type);
CREATE INDEX IF NOT EXISTS idx_suppliers_industry ON suppliers(industry);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_rating ON suppliers(rating);
CREATE INDEX IF NOT EXISTS idx_suppliers_specialties ON suppliers USING GIN(specialties);

CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier_id ON supplier_contacts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_primary ON supplier_contacts(supplier_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_active ON supplier_contacts(supplier_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_supplier_services_supplier_id ON supplier_services(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_services_category ON supplier_services(service_category);
CREATE INDEX IF NOT EXISTS idx_supplier_services_active ON supplier_services(supplier_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_supplier_performance_supplier_id ON supplier_performance_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_performance_order_date ON supplier_performance_history(order_date);
CREATE INDEX IF NOT EXISTS idx_supplier_performance_ratings ON supplier_performance_history(quality_rating, delivery_rating, service_rating);

CREATE INDEX IF NOT EXISTS idx_supplier_work_history_supplier_id ON supplier_work_history(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_work_history_asset_id ON supplier_work_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_supplier_work_history_work_type ON supplier_work_history(work_type);

CREATE INDEX IF NOT EXISTS idx_supplier_certifications_supplier_id ON supplier_certifications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_certifications_expiration ON supplier_certifications(expiration_date);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_contacts_updated_at BEFORE UPDATE ON supplier_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_services_updated_at BEFORE UPDATE ON supplier_services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_performance_history_updated_at BEFORE UPDATE ON supplier_performance_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_work_history_updated_at BEFORE UPDATE ON supplier_work_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_work_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_certifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic - can be enhanced based on organizational structure)
-- Users can view all active suppliers
CREATE POLICY "Allow view active suppliers" ON suppliers
    FOR SELECT USING (status = 'active');

-- Users can view their own supplier records
CREATE POLICY "Allow view own suppliers" ON suppliers
    FOR SELECT USING (auth.uid() = created_by);

-- Only authenticated users can insert suppliers
CREATE POLICY "Allow insert suppliers" ON suppliers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can update suppliers they created
CREATE POLICY "Allow update own suppliers" ON suppliers
    FOR UPDATE USING (auth.uid() = created_by);

-- Similar policies for other tables
CREATE POLICY "Allow view supplier contacts" ON supplier_contacts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = supplier_contacts.supplier_id
            AND (s.status = 'active' OR s.created_by = auth.uid())
        )
    );

CREATE POLICY "Allow insert supplier contacts" ON supplier_contacts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.id = supplier_contacts.supplier_id
            AND auth.role() = 'authenticated'
        )
    );

-- Apply similar patterns to other tables
CREATE POLICY "Allow view supplier services" ON supplier_services
    FOR SELECT USING (is_active = true);

CREATE POLICY "Allow view supplier performance" ON supplier_performance_history
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow view supplier work history" ON supplier_work_history
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow view supplier certifications" ON supplier_certifications
    FOR SELECT USING (is_active = true);

-- Add comments for documentation
COMMENT ON TABLE suppliers IS 'Main supplier registry with contact and business information';
COMMENT ON TABLE supplier_contacts IS 'Multiple contacts per supplier with different roles';
COMMENT ON TABLE supplier_services IS 'Services and products offered by each supplier';
COMMENT ON TABLE supplier_performance_history IS 'Historical performance data for supplier evaluation';
COMMENT ON TABLE supplier_work_history IS 'Specific work history with assets and work orders';
COMMENT ON TABLE supplier_certifications IS 'Certifications and licenses held by suppliers';
