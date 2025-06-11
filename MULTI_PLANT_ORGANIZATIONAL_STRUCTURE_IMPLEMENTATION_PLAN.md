# Multi-Plant Organizational Structure Implementation Plan

## Executive Summary

This document outlines the implementation plan for transforming the maintenance dashboard into a multi-plant organizational system with proper plant secularization, role-based access control, and operator-asset assignment management.

## Current State Analysis

### Existing Structure
- Basic `profiles` table with limited roles: `EJECUTIVO`, `JEFE DE PLANTA`, `ENCARGADO DE MANTENIMIENTO`
- Assets with text-based location fields (PLANTA 1, PLANTA 3, P4, etc.)
- No formal organizational hierarchy
- No operator-asset assignment relationships
- No plant management hierarchy

### Identified Organizational Structure
Based on existing data analysis:
- **BAJIO Business Unit**: Plant 1, Plant 5
- **Tijuana Business Unit**: Plant 2, Plant 3, Plant 4

## Implementation Plan

### Phase 1: Database Schema - Organizational Foundation

#### 1.1 Business Units and Plants Structure

```sql
-- Business Units (Unidades de Negocio)
CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Plants (Plantas)
CREATE TABLE plants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_unit_id UUID REFERENCES business_units(id),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  location TEXT,
  address TEXT,
  plant_manager_id UUID REFERENCES auth.users(id),
  maintenance_supervisor_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  operating_hours JSONB, -- {"start": "06:00", "end": "22:00", "shifts": 3}
  contact_info JSONB, -- {"phone": "...", "email": "...", "emergency": "..."}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Departments within plants
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID NOT NULL REFERENCES plants(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  supervisor_id UUID REFERENCES profiles(id),
  budget_code TEXT,
  cost_center TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, code)
);
```

#### 1.2 Simplified User Roles (Based on Actual Structure)

```sql
-- Simplified role system matching actual company structure
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM (
  'GERENCIA_GENERAL',        -- General management
  'JEFE_UNIDAD_NEGOCIO',     -- Business unit manager (Bajío/Tijuana)
  'ENCARGADO_MANTENIMIENTO', -- Maintenance specialist (Bajío only)
  'JEFE_PLANTA',             -- Plant manager
  'DOSIFICADOR',             -- Dosing operator (acts as plant manager in León)
  'OPERADOR',                -- Equipment operator
  'AUXILIAR_COMPRAS',        -- Purchasing assistant (Tijuana only)
  'AREA_ADMINISTRATIVA',     -- Administrative area (Bajío purchasing)
  'VISUALIZADOR'             -- Read-only access
);

-- Update profiles table to match company structure
ALTER TABLE profiles 
ADD COLUMN plant_id UUID REFERENCES plants(id),
ADD COLUMN business_unit_id UUID REFERENCES business_units(id),
ADD COLUMN employee_code TEXT UNIQUE,
ADD COLUMN position TEXT,
ADD COLUMN shift TEXT CHECK (shift IN ('morning', 'afternoon', 'night')),
ADD COLUMN phone_secondary TEXT,
ADD COLUMN emergency_contact JSONB,
ADD COLUMN hire_date DATE,
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN can_authorize_up_to NUMERIC DEFAULT 1000; -- Authorization limit in MXN

-- Update role column to use new enum
ALTER TABLE profiles ALTER COLUMN role TYPE user_role USING role::text::user_role;
```

#### 1.3 Simplified Asset-Operator Assignment

```sql
-- Simple Asset Operators Table (no teams complexity)
CREATE TABLE asset_operators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  operator_id UUID NOT NULL REFERENCES profiles(id),
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
  
  -- One primary operator per asset
  UNIQUE(asset_id, assignment_type) DEFERRABLE INITIALLY DEFERRED
);

-- Fuel control records (based on company policy)
CREATE TABLE fuel_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  operator_id UUID NOT NULL REFERENCES profiles(id),
  fuel_amount NUMERIC NOT NULL,
  odometer_reading INTEGER,
  hour_meter_reading INTEGER,
  photo_evidence TEXT[], -- Array of photo URLs
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  validated_by UUID REFERENCES profiles(id),
  validation_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 2: Data Migration Strategy

#### 2.1 Create Specific Business Units and Plants

```sql
-- Insert the specific business units matching company structure
INSERT INTO business_units (name, code, description) VALUES 
('BAJIO', 'BU001', 'Unidad de Negocio Bajío - León/Planta 1 y Planta 5'),
('Tijuana', 'BU002', 'Unidad de Negocio Tijuana - Plantas 2, 3 y 4');

-- Insert plants with correct business unit assignments
INSERT INTO plants (business_unit_id, name, code, location) VALUES 
-- BAJIO plants (León has dosificador as plant manager)
((SELECT id FROM business_units WHERE code = 'BU001'), 'León/Planta 1', 'P001', 'PLANTA 1'),
((SELECT id FROM business_units WHERE code = 'BU001'), 'Planta 5', 'P005', 'PLANTA 5'),
-- Tijuana plants (all have regular plant managers)
((SELECT id FROM business_units WHERE code = 'BU002'), 'Planta 2', 'P002', 'PLANTA 2'),
((SELECT id FROM business_units WHERE code = 'BU002'), 'Planta 3', 'P003', 'PLANTA 3'),
((SELECT id FROM business_units WHERE code = 'BU002'), 'Planta 4', 'P004', 'PLANTA 4');

-- Set authorization levels based on company policy
UPDATE business_units SET 
  manager_authorization_limit = 5000 -- Jefe de Unidad can authorize up to $5,000 MXN
WHERE code IN ('BU001', 'BU002');

-- Add authorization limits to plants table
ALTER TABLE plants ADD COLUMN authorization_limit NUMERIC DEFAULT 1000;
```

#### 2.2 Transform Text-Based Plant Assignments to UUIDs

```sql
-- Update assets table to include plant_id
ALTER TABLE assets 
ADD COLUMN plant_id UUID REFERENCES plants(id),
ADD COLUMN department_id UUID REFERENCES departments(id),
ADD COLUMN area TEXT,
ADD COLUMN criticality_level TEXT CHECK (criticality_level IN ('critical', 'important', 'standard', 'low')),
ADD COLUMN responsible_supervisor_id UUID REFERENCES profiles(id);

-- Migration script to convert text locations to plant UUIDs
UPDATE assets SET plant_id = (
  CASE 
    WHEN UPPER(TRIM(location)) IN ('PLANTA 1', 'PLANTA1', 'P1') THEN 
      (SELECT id FROM plants WHERE code = 'P001')
    WHEN UPPER(TRIM(location)) IN ('PLANTA 2', 'PLANTA2', 'P2') THEN 
      (SELECT id FROM plants WHERE code = 'P002')
    WHEN UPPER(TRIM(location)) IN ('PLANTA 3', 'PLANTA3', 'P3') THEN 
      (SELECT id FROM plants WHERE code = 'P003')
    WHEN UPPER(TRIM(location)) IN ('PLANTA 4', 'PLANTA4', 'P4') THEN 
      (SELECT id FROM plants WHERE code = 'P004')
    WHEN UPPER(TRIM(location)) IN ('PLANTA 5', 'PLANTA5', 'P5') THEN 
      (SELECT id FROM plants WHERE code = 'P005')
    ELSE NULL
  END
);

-- Create default departments for each plant
INSERT INTO departments (plant_id, name, code)
SELECT p.id, 'Producción', 'PROD'
FROM plants p;

INSERT INTO departments (plant_id, name, code)
SELECT p.id, 'Mantenimiento', 'MANT'
FROM plants p;

-- Update assets with default department
UPDATE assets SET department_id = (
  SELECT d.id FROM departments d 
  WHERE d.plant_id = assets.plant_id 
  AND d.code = 'PROD'
  LIMIT 1
);
```

### Phase 3: Row Level Security Implementation

```sql
-- Enable RLS on key tables
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view assets from their scope" ON assets 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND (
      p.plant_id = assets.plant_id 
      OR p.role IN ('SUPER_ADMIN', 'EJECUTIVO')
      OR (p.role = 'JEFE_UNIDAD_NEGOCIO' AND p.business_unit_id = (
        SELECT business_unit_id FROM plants WHERE id = assets.plant_id
      ))
    )
  )
);

CREATE POLICY "Plant access based on role" ON plants 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND (
      p.plant_id = plants.id
      OR p.role IN ('SUPER_ADMIN', 'EJECUTIVO')
      OR (p.role = 'JEFE_UNIDAD_NEGOCIO' AND p.business_unit_id = plants.business_unit_id)
    )
  )
);
```

### Phase 4: Frontend Implementation

#### 4.1 New Sidebar Navigation Structure

```typescript
// Enhanced navigation items
const navigationItems = [
  // Existing items...
  
  // New organizational management section
  {
    title: "Gestión Organizacional",
    icon: "building",
    role: ["SUPER_ADMIN", "EJECUTIVO", "JEFE_UNIDAD_NEGOCIO", "JEFE_PLANTA"],
    children: [
      {
        title: "Configuración de Plantas",
        href: "/plantas/configuracion",
        role: ["SUPER_ADMIN", "EJECUTIVO"]
      },
      {
        title:           "Gestión de Personal",
          href: "/personal/gestion",
          role: ["GERENCIA_GENERAL", "JEFE_UNIDAD_NEGOCIO", "JEFE_PLANTA", "ENCARGADO_MANTENIMIENTO"]
        },
        {
          title: "Asignación de Activos",
          href: "/activos/asignacion",
          role: ["JEFE_UNIDAD_NEGOCIO", "JEFE_PLANTA", "ENCARGADO_MANTENIMIENTO"]
        },
        {
          title: "Control de Combustible",
          href: "/combustible/control",
          role: ["JEFE_PLANTA", "DOSIFICADOR", "OPERADOR"]
      }
    ]
  }
];
```

#### 4.2 Plant Configuration Page (`/plantas/configuracion`)

```typescript
// PlantConfigurationPage.tsx
interface PlantConfigurationPageProps {
  userRole: UserRole;
  accessiblePlants: Plant[];
}

const PlantConfigurationPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Configuración de Plantas</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Planta
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plants.map(plant => (
          <PlantCard 
            key={plant.id}
            plant={plant}
            onEdit={() => handleEdit(plant)}
            onViewDetails={() => handleViewDetails(plant)}
          />
        ))}
      </div>
      
      <PlantDetailsModal />
      <CreatePlantModal />
    </div>
  );
};
```

#### 4.3 Operator Management Page (`/operadores/gestion`)

```typescript
// OperatorManagementPage.tsx
const OperatorManagementPage = () => {
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [unassignedOperators, setUnassignedOperators] = useState<Operator[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestión de Personal</h1>
        <div className="flex gap-2">
          <PlantSelector 
            selectedPlant={selectedPlant}
            onPlantChange={setSelectedPlant}
          />
          <Button onClick={() => setShowCreateModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nuevo Empleado
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Plant Personnel Overview */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedPlant ? `Personal - ${selectedPlant.name}` : 'Seleccione una Planta'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPlant && (
              <div className="space-y-4">
                {/* Management Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Dirección</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PersonnelCard 
                      title="Jefe de Planta" 
                      person={plantManager}
                      onEdit={handleEditPerson}
                      canEdit={canEditManagement}
                    />
                    {selectedPlant.code === 'P001' && (
                      <PersonnelCard 
                        title="Dosificador (Jefe)" 
                        person={dosificadorJefe}
                        onEdit={handleEditPerson}
                        canEdit={canEditManagement}
                      />
                    )}
                  </div>
                </div>
                
                {/* Operators Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Operadores</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {operators.filter(op => op.plantId === selectedPlant.id).map(operator => (
                      <OperatorCard 
                        key={operator.id} 
                        operator={operator}
                        onEdit={handleEditOperator}
                        onAssignAsset={handleAssignAsset}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
```

#### 4.4 Asset Assignment Page (`/activos/asignacion`)

```typescript
// AssetAssignmentPage.tsx
const AssetAssignmentPage = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);
  const [assignedOperators, setAssignedOperators] = useState<AssetOperator[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Asignación de Activos</h1>
        <AssetSelector 
          selectedAsset={selectedAsset}
          onAssetChange={setSelectedAsset}
        />
      </div>

      {selectedAsset && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asset Information */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Activo</CardTitle>
            </CardHeader>
            <CardContent>
              <AssetInfoDisplay asset={selectedAsset} />
            </CardContent>
          </Card>

          {/* Available Operators */}
          <Card>
            <CardHeader>
              <CardTitle>Operadores Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <DragDropOperatorList 
                operators={availableOperators}
                onDrop={handleOperatorAssignment}
              />
            </CardContent>
          </Card>

          {/* Assigned Operators */}
          <Card>
            <CardHeader>
              <CardTitle>Operadores Asignados</CardTitle>
            </CardHeader>
            <CardContent>
              <AssignedOperatorsList 
                assignments={assignedOperators}
                onRemove={handleRemoveAssignment}
                onEditAssignment={handleEditAssignment}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <AssignmentDetailsModal />
    </div>
  );
};
```

#### 4.5 Shared Components

```typescript
// PlantSelector.tsx
export const PlantSelector = ({ selectedPlant, onPlantChange, userRole }) => {
  const { data: plants } = useQuery(['accessible-plants'], 
    () => getAccessiblePlants(userRole)
  );

  return (
    <Select value={selectedPlant?.id} onValueChange={(id) => 
      onPlantChange(plants.find(p => p.id === id))
    }>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Seleccionar Planta" />
      </SelectTrigger>
      <SelectContent>
        {plants?.map(plant => (
          <SelectItem key={plant.id} value={plant.id}>
            {plant.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// OperatorCard.tsx with drag and drop
export const OperatorCard = React.forwardRef<HTMLDivElement, OperatorCardProps>(
  ({ operator, isDragging, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        {...props}
        className={cn(
          "p-4 border rounded-lg bg-white shadow-sm cursor-move transition-shadow",
          isDragging && "shadow-lg border-blue-500"
        )}
      >
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={operator.avatarUrl} />
            <AvatarFallback>
              {operator.nombre?.[0]}{operator.apellido?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">
              {operator.nombre} {operator.apellido}
            </p>
            <p className="text-sm text-gray-500">{operator.employeeCode}</p>
            <Badge variant="outline">{operator.role}</Badge>
          </div>
        </div>
      </div>
    );
  }
);
```

### Phase 5: API Enhancement

#### 5.1 Enhanced API Endpoints

```typescript
// api/plants/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessUnitId = searchParams.get('businessUnitId');
  
  const plants = await getAccessiblePlants(user.id, { businessUnitId });
  return NextResponse.json(plants);
}

// api/operators/assignments/route.ts
export async function POST(request: Request) {
  const { assetId, operatorId, assignmentType, shift, notes } = await request.json();
  
  const assignment = await createOperatorAssignment({
    assetId,
    operatorId,
    assignmentType,
    shift,
    notes,
    assignedBy: user.id
  });
  
  return NextResponse.json(assignment);
}

// api/operators/transfer/route.ts
export async function POST(request: Request) {
  const { operatorId, fromPlantId, toPlantId, transferDate, reason } = await request.json();
  
  const result = await transferOperatorToPlant({
    operatorId,
    fromPlantId,
    toPlantId,
    transferDate,
    reason,
    processedBy: user.id
  });
  
  return NextResponse.json(result);
}
```

### Phase 6: Implementation of Company Policies

#### 6.1 Authorization Matrix (Based on Current Policy)

```sql
-- Create authorization matrix table
CREATE TABLE authorization_matrix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role user_role NOT NULL,
  max_amount NUMERIC NOT NULL,
  requires_approval BOOLEAN DEFAULT false,
  approver_role user_role,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert authorization levels per policy
INSERT INTO authorization_matrix (role, max_amount, requires_approval, approver_role, description) VALUES
('OPERADOR', 0, true, 'JEFE_PLANTA', 'Operators cannot authorize purchases'),
('DOSIFICADOR', 1000, false, null, 'Dosing operators can auto-approve up to $1,000 MXN'),
('JEFE_PLANTA', 1000, false, null, 'Plant managers can auto-approve up to $1,000 MXN'),
('ENCARGADO_MANTENIMIENTO', 1000, false, null, 'Maintenance specialist can auto-approve up to $1,000 MXN'),
('JEFE_UNIDAD_NEGOCIO', 5000, false, null, 'Business unit managers can approve up to $5,000 MXN'),
('GERENCIA_GENERAL', 999999, false, null, 'General management has unlimited authorization');
```

#### 6.2 Fuel Control Implementation

```sql
-- Enhanced fuel records with validation
ALTER TABLE fuel_records ADD COLUMN validation_status TEXT DEFAULT 'pending' 
  CHECK (validation_status IN ('pending', 'approved', 'rejected', 'incomplete'));

-- Fuel control sanctions table  
CREATE TABLE fuel_sanctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fuel_record_id UUID REFERENCES fuel_records(id),
  operator_id UUID REFERENCES profiles(id),
  plant_manager_id UUID REFERENCES profiles(id),
  business_unit_manager_id UUID REFERENCES profiles(id),
  operator_penalty_pct NUMERIC DEFAULT 30,
  plant_manager_penalty_pct NUMERIC DEFAULT 35,
  unit_manager_penalty_pct NUMERIC DEFAULT 35,
  total_amount NUMERIC,
  reason TEXT,
  applied_date TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);
```

#### 6.3 Preventive Maintenance Scheduling

```sql
-- Maintenance schedules (100h/1000km before due)
CREATE TABLE maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  maintenance_type TEXT NOT NULL,
  interval_hours INTEGER,
  interval_kilometers INTEGER,
  last_performed_at TIMESTAMPTZ,
  next_due_hours INTEGER,
  next_due_kilometers INTEGER,
  alert_threshold_hours INTEGER DEFAULT 100,
  alert_threshold_km INTEGER DEFAULT 1000,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 7: Implementation Timeline

| Week | Phase | Activities |
|------|-------|------------|
| 1 | Database Setup | Create tables, enums, relationships |
| 2 | Data Migration | Transform existing data, create business units/plants |
| 3 | RLS & Security | Implement row-level security policies |
| 4 | Frontend Structure | New navigation, plant selector, basic pages |
| 5 | Operator Management | Drag & drop interface, assignment logic |
| 6 | Asset Assignment | Asset-operator assignment interface |
| 7 | Testing & Refinement | Integration testing, UX improvements |
| 8 | Production Deployment | Deploy with training and documentation |

### Phase 7: Success Metrics

- **Data Integrity**: 100% of assets correctly assigned to plants
- **User Adoption**: All operators properly assigned to assets within 2 weeks
- **Performance**: Page load times under 2 seconds for plant-filtered views
- **Security**: Zero unauthorized access incidents
- **Usability**: Operator reassignment process under 30 seconds

### Next Steps

1. **Database Implementation**: Start with creating the organizational tables
2. **Data Migration**: Transform existing plant text references to UUIDs
3. **Frontend Development**: Begin with navigation and plant selector
4. **User Training**: Prepare documentation for new organizational features

This implementation will provide a robust, scalable foundation for multi-plant operations with clear organizational boundaries and efficient operator management capabilities. 