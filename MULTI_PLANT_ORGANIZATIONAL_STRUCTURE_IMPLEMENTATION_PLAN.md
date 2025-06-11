# Multi-Plant Organizational Structure Implementation Plan

## Executive Summary

This document outlines the implementation plan for transforming the maintenance dashboard into a multi-plant organizational system with proper plant secularization, role-based access control, and operator-asset assignment management.

## Phase 1 Implementation Results ✅ COMPLETED (December 2024)

### Implementation Details

**Project**: `txapndpstzcspgxlybll` (Supabase)  
**Implementation Date**: December 2024  
**Status**: Phase 1 Successfully Completed

### Database Migrations Applied

1. **create_organizational_structure_20241224**: Created business_units, plants, and departments tables
2. **populate_organizational_data_20241224**: Inserted business units and plants with proper hierarchy
3. **migrate_assets_to_plants_20241224**: Added plant_id and department_id columns to assets, migrated text locations to UUIDs

### Migration Results Verified

**Business Units Created:**
- BAJIO (BU001): Managing León/Planta 1 and Planta 5
- Tijuana (BU002): Managing Planta 2, 3, and 4

**Plants Operational:**
- P001 - León/Planta 1 (BAJIO) - 9 assets migrated
- P002 - Planta 2 (Tijuana) - 0 assets  
- P003 - Planta 3 (Tijuana) - 5 assets migrated
- P004 - Planta 4 (Tijuana) - 4 assets migrated
- P005 - Planta 5 (BAJIO) - 2 assets migrated

**Data Integrity:**
- ✅ 20/20 assets successfully migrated from text to UUID references
- ✅ 10 departments created (Production + Maintenance per plant)
- ✅ All foreign key relationships established correctly
- ✅ Zero data conflicts or orphaned records

### Frontend Integration Completed

**TypeScript Updates:**
- Enhanced `Database` interface with organizational tables
- Updated `Assets` type to include plant and department relationships
- Added plant name resolution in asset displays

**Component Updates:**
- Modified `AssetsList` component to show plant information
- Maintained full backward compatibility
- Added plant-based filtering capability foundation

## Current State Analysis

### ✅ Already Implemented Features
- **Checklist Scheduling System** ✅ - 100h/1000km alert system fully operational
- **Purchase Order Authorization** ✅ - Complete approval workflow with status tracking
- **Work Order Management** ✅ - Creation, assignment, completion, and cost tracking
- **Equipment Readings Integration** ✅ - Hours/kilometers tracking through completed checklists
- **Asset Management System** ✅ - CRUD operations, maintenance history, status tracking
- **Dashboard Analytics** ✅ - Real-time KPIs and maintenance metrics
- **Mobile Responsive Design** ✅ - Optimized for field work
- **Evidence Management** ✅ - Photo uploads and validation system

### ❌ Missing Organizational Structure (TO IMPLEMENT)
- Basic `profiles` table with limited roles: `EJECUTIVO`, `JEFE DE PLANTA`, `ENCARGADO DE MANTENIMIENTO`
- Assets with text-based location fields (PLANTA 1, PLANTA 3, P4, etc.) - **NEEDS UUID CONVERSION**
- No formal business unit/plant hierarchy
- No operator-asset assignment relationships
- No plant-specific access control
- No drag & drop operator management interface

### Identified Organizational Structure
Based on existing data analysis:
- **BAJIO Business Unit**: Plant 1, Plant 5
- **Tijuana Business Unit**: Plant 2, Plant 3, Plant 4

## Implementation Plan (Focused on Missing Features)

> **Note**: This plan focuses only on the organizational structure features that are missing. All maintenance scheduling, work order management, and equipment tracking features are already fully implemented and operational.

### Phase 1: Plant/Business Unit Structure and Data Migration ✅ COMPLETED

#### 1.1 Database Structure Implementation ✅ COMPLETED

**Successfully Created Tables:**
- `business_units` - Business unit hierarchy with management references
- `plants` - Plant entities linked to business units with operational details
- `departments` - Departmental structure within plants
- Enhanced `assets` table with `plant_id` and `department_id` foreign keys

**Implementation Results:**
```sql
-- ✅ Successfully implemented business_units table structure
-- ✅ Successfully implemented plants table structure  
-- ✅ Successfully implemented departments table structure
-- ✅ Successfully added organizational columns to assets table
```

#### 1.2 Data Population Results ✅ COMPLETED

**Business Units Created:**
- **BAJIO (BU001)**: Unidad de Negocio Bajío - León/Planta 1 y Planta 5
- **Tijuana (BU002)**: Unidad de Negocio Tijuana - Plantas 2, 3 y 4

**Plants Created (5 Total):**
- **P001 - León/Planta 1** (BAJIO Business Unit)
- **P002 - Planta 2** (Tijuana Business Unit)  
- **P003 - Planta 3** (Tijuana Business Unit)
- **P004 - Planta 4** (Tijuana Business Unit)
- **P005 - Planta 5** (BAJIO Business Unit)

**Departments Created (10 Total):**
- Production and Maintenance departments for each plant (2 departments × 5 plants)

#### 1.3 Data Migration Analysis ✅ COMPLETED

**Asset Distribution Results:**
- **Total Assets Migrated**: 20 assets
- **León/Planta 1 (P001)**: 9 assets (45%)
- **Planta 3 (P003)**: 5 assets (25%)  
- **Planta 4 (P004)**: 4 assets (20%)
- **Planta 5 (P005)**: 2 assets (10%)
- **Planta 2 (P002)**: 0 assets (0%)

**Migration Pattern Findings:**
```sql
-- ✅ Successfully mapped text variations:
-- 'PLANTA 1', 'Planta 1', 'P1' → P001 (León/Planta 1)
-- 'PLANTA 3', 'Planta 3', 'P3' → P003 (Planta 3)  
-- 'PLANTA 4', 'Planta 4', 'P4' → P004 (Planta 4)
-- 'PLANTA 5', 'Planta 5', 'P5' → P005 (Planta 5)
-- No assets found for P002 (Planta 2)
```

**Data Quality Observations:**
- ✅ 100% of assets successfully migrated to UUID plant references
- ✅ All assets assigned to Production departments by default
- ✅ Foreign key relationships established without conflicts
- ✅ No orphaned records or referential integrity issues

#### 1.4 Frontend Type System Integration ✅ COMPLETED

**Updated TypeScript Types:**
- Enhanced `Database` interface with new organizational tables
- Added `Business_units`, `Plants`, and `Departments` type definitions
- Extended `Assets` type to include `plant_id` and `department_id`
- Updated asset listing components to handle plant relationships

**Component Updates:**
- ✅ Modified `AssetsList` component to display plant information
- ✅ Added plant name resolution in asset displays
- ✅ Maintained backward compatibility with existing asset views

### Phase 2: Enhanced Role System with Authorization Limits

#### 2.1 Simplified User Roles (Based on Actual Structure)

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
```

#### 3.1 New Sidebar Navigation Structure

```typescript
// Enhanced navigation items
const navigationItems = [
  // Existing items...
  
  // New organizational management section
  {
    title: "Gestión Organizacional",
    icon: "building",
    role: ["GERENCIA_GENERAL", "JEFE_UNIDAD_NEGOCIO", "JEFE_PLANTA"],
    children: [
      {
        title: "Configuración de Plantas",
        href: "/plantas/configuracion",
        role: ["GERENCIA_GENERAL", "JEFE_UNIDAD_NEGOCIO"]
      },
      {
        title: "Gestión de Personal",
        href: "/personal/gestion",
        role: ["GERENCIA_GENERAL", "JEFE_UNIDAD_NEGOCIO", "JEFE_PLANTA", "ENCARGADO_MANTENIMIENTO"]
      },
      {
        title: "Asignación de Activos",
        href: "/activos/asignacion",
        role: ["JEFE_UNIDAD_NEGOCIO", "JEFE_PLANTA", "ENCARGADO_MANTENIMIENTO"]
      }
    ]
  }
];
```

#### 3.2 Plant Configuration Page (`/plantas/configuracion`)

```typescript
// PlantConfigurationPage.tsx
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

#### 3.3 Drag & Drop Operator Management Interface

```typescript
// OperatorManagementPage.tsx
const OperatorManagementPage = () => {
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);

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

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Operators */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="available-operators">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {availableOperators.map((operator, index) => (
                      <OperatorCard 
                        key={operator.id} 
                        operator={operator}
                        index={index}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>

          {/* Plant Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedPlant ? `${selectedPlant.name} - Personal Asignado` : 'Seleccione una Planta'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedPlant && (
                <Droppable droppableId={`plant-${selectedPlant.id}`}>
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {assignedOperators.map((operator, index) => (
                        <OperatorCard 
                          key={operator.id} 
                          operator={operator}
                          index={index}
                          assigned={true}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </CardContent>
          </Card>
        </div>
      </DragDropContext>
    </div>
  );
};
```

### Phase 4: Fuel Control System with Photo Evidence

```sql
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
  validation_status TEXT DEFAULT 'pending' 
    CHECK (validation_status IN ('pending', 'approved', 'rejected', 'incomplete')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

#### 4.2 Fuel Control Frontend Interface

```typescript
// FuelControlPage.tsx
const FuelControlPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Control de Combustible</h1>
        <Button onClick={() => setShowCreateRecord(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Combustible
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Validations */}
        <Card>
          <CardHeader>
            <CardTitle>Registros Pendientes de Validación</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingRecords.map(record => (
              <FuelRecordCard 
                key={record.id}
                record={record}
                onValidate={handleValidate}
                showPhotos={true}
              />
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <FuelActivityTimeline records={recentActivity} />
          </CardContent>
        </Card>
      </div>

      <FuelRecordModal 
        isOpen={showCreateRecord}
        onClose={() => setShowCreateRecord(false)}
        onSubmit={handleCreateRecord}
      />
    </div>
  );
};
```

#### 5.1 Authorization Matrix Database Structure

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

-- Insert authorization levels per company policy
INSERT INTO authorization_matrix (role, max_amount, requires_approval, approver_role, description) VALUES
('OPERADOR', 0, true, 'JEFE_PLANTA', 'Operators cannot authorize purchases'),
('DOSIFICADOR', 1000, false, null, 'Dosing operators can auto-approve up to $1,000 MXN'),
('JEFE_PLANTA', 1000, false, null, 'Plant managers can auto-approve up to $1,000 MXN'),
('ENCARGADO_MANTENIMIENTO', 1000, false, null, 'Maintenance specialist can auto-approve up to $1,000 MXN'),
('JEFE_UNIDAD_NEGOCIO', 5000, false, null, 'Business unit managers can approve up to $5,000 MXN'),
('GERENCIA_GENERAL', 999999, false, null, 'General management has unlimited authorization');
```

#### 5.2 Integration with Existing Purchase Order System ✅

```sql
-- NOTE: Purchase Order system is ALREADY IMPLEMENTED
-- Integration points for new authorization matrix:

-- Add plant_id to existing work_orders table
ALTER TABLE work_orders 
ADD COLUMN plant_id UUID REFERENCES plants(id);

-- Update work orders with plant information based on asset
UPDATE work_orders SET plant_id = (
  SELECT a.plant_id FROM assets a WHERE a.id = work_orders.asset_id
) WHERE asset_id IS NOT NULL;

-- Add plant_id to existing purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN plant_id UUID REFERENCES plants(id);

-- Update purchase orders with plant information
UPDATE purchase_orders SET plant_id = (
  SELECT wo.plant_id FROM work_orders wo WHERE wo.id = purchase_orders.work_order_id
) WHERE work_order_id IS NOT NULL;

-- Add authorization tracking
ALTER TABLE purchase_orders
ADD COLUMN requires_approval BOOLEAN DEFAULT false,
ADD COLUMN authorized_by UUID REFERENCES profiles(id),
ADD COLUMN authorization_date TIMESTAMPTZ;
```

#### 5.3 Row Level Security Implementation

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
      OR p.role IN ('GERENCIA_GENERAL')
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
      OR p.role IN ('GERENCIA_GENERAL')
      OR (p.role = 'JEFE_UNIDAD_NEGOCIO' AND p.business_unit_id = plants.business_unit_id)
    )
  )
);
```

### Implementation Timeline (5 Phases)

> **Updated timeline reflecting completed Phase 1 and current status**

| Week | Phase | Activities | Status |
|------|-------|------------|---------|
| ✅ **WEEK 1** | **Phase 1: Plant/Business Unit Structure & Data Migration** | ✅ Created business_units, plants, departments tables<br/>✅ Converted 20 assets from text to UUID plant references<br/>✅ Updated TypeScript types and frontend components | **✅ COMPLETED** |
| 2 | **Phase 2: Enhanced Role System with Authorization Limits** | Update user roles enum, add plant assignments, authorization limits | 🔄 **Next Priority** |
| 3-4 | **Phase 3: Organizational Management Frontend Interfaces** | New sidebar navigation, plant configuration pages, drag & drop operator management | 🔄 Ready to start |
| 5 | **Phase 4: Fuel Control System with Photo Evidence** | Fuel records database, photo evidence system, validation workflow | 🔄 Ready to start |
| 6 | **Phase 5: Authorization Matrix with Amount-Based Approvals** | Authorization matrix, RLS policies, purchase order integration | 🔄 Ready to start |
| 7 | **Integration Testing & Deployment** | Test with existing systems, production deployment | 🔄 Ready to start |

### Phase 8: Success Metrics

- **Data Integrity**: 100% of assets correctly assigned to plants
- **User Adoption**: All operators properly assigned to assets within 2 weeks
- **Performance**: Page load times under 2 seconds for plant-filtered views
- **Security**: Zero unauthorized access incidents
- **Usability**: Operator reassignment process under 30 seconds

### Phase 1 Implementation Summary ✅ COMPLETED

**Key Achievements:**
1. **✅ Database Foundation Complete**: Successfully created the organizational foundation with business_units, plants, and departments tables
2. **✅ Data Migration Successful**: Transformed 20 assets from text-based plant references to UUID relationships with 100% success rate
3. **✅ Frontend Integration**: Updated TypeScript types and asset listing components to display plant information
4. **✅ Data Integrity Verified**: All foreign key relationships established without conflicts, zero orphaned records

**Migration Results Breakdown:**
- **BAJIO Business Unit**: 11 assets total (León: 9 assets, Planta 5: 2 assets)
- **Tijuana Business Unit**: 9 assets total (Planta 3: 5 assets, Planta 4: 4 assets, Planta 2: 0 assets)
- **Total Organizational Structure**: 2 business units, 5 plants, 10 departments (Production + Maintenance per plant)

### Next Steps (Phase 2 Priority Actions)

1. **✅ COMPLETED**: Database Foundation & Data Migration
2. **🔄 NEXT**: Enhanced Role System with Authorization Limits (Phase 2)
3. **🔄 READY**: Frontend Management Interfaces (Phase 3)
4. **🔄 READY**: Connect organizational structure with existing work orders and checklists
5. **🔄 READY**: Implement plant-specific access control and operator assignments

### Benefits of Current State

The implementation is **significantly simplified** because:
- **No need to build scheduling system** - 100h/1000km alerts already work perfectly
- **No need to rebuild work order system** - Complete workflow already exists
- **No need to create equipment tracking** - Hours/kilometers already integrated
- **No need to design approval workflows** - Purchase order system already operational

### Estimated Effort Reduction & Progress Update

- **Original Estimate**: 12-16 weeks for full system
- **Revised Estimate**: 6-8 weeks for organizational features only
- **Phase 1 Completed**: Week 1 ✅ (On schedule)
- **Remaining Effort**: 5-6 weeks for Phases 2-5
- **Effort Reduction**: ~60% less work needed due to existing robust maintenance system

**Phase 1 Success Factors:**
- **Supabase Migration System**: Seamless database schema changes with rollback capability
- **Existing Data Quality**: Clean asset location data enabled straightforward text-to-UUID migration
- **TypeScript Integration**: Strong typing system caught potential issues during development
- **Component Architecture**: Modular design allowed easy integration of plant information display

This focused implementation successfully established the organizational foundation for transforming the maintenance dashboard into a true multi-plant management system, while preserving all existing maintenance functionality. 