-- Create offices table for credential card management
-- This table stores office information for employee credentials

CREATE TABLE IF NOT EXISTS offices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    hr_phone VARCHAR(50) NOT NULL,
    
    -- System fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add office_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES offices(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_office_id ON profiles(office_id);

-- Insert default offices (DC CONCRETOS has 2 offices)
INSERT INTO offices (name, address, email, phone, hr_phone) 
VALUES 
    (
        'Oficina Tijuana',
        'Calle Caracas #12428, El Paraíso 22106',
        'rh.tj@dcconcretos.com.mx',
        '664 905 1813',
        '477 288 0120'
    ),
    (
        'Oficina Principal',
        'Dirección pendiente',
        'contacto@dcconcretos.com.mx',
        'Teléfono pendiente',
        '477 288 0120'
    )
ON CONFLICT (name) DO NOTHING;

-- Add comment
COMMENT ON TABLE offices IS 'Stores office information for employee credential cards';

