# Composite Asset Implementation Plan
## Unified Asset Management with Component Flexibility

### 🎯 **Project Overview**
Transform the maintenance dashboard to support composite assets (e.g., pumping trucks) that can be managed both as unified units and individual components, with shared operational hours and coordinated maintenance workflows.

---

## 📊 **Business Requirements Analysis**

### **Core Requirements:**
- ✅ **Shared Hours**: Truck and pump share operational hours (240h truck = 240h pump)
- ✅ **Separate Maintenance**: Individual maintenance schedules per component
- ✅ **Unified Issues**: Issues from one component affect both components
- ✅ **Retroactive Compatibility**: Convert existing assets to composites
- ✅ **Flexible Management**: Manage as whole or separate components

### **User Experience Goals:**
- 🎯 **Single Composite Page**: Unified view for pumping truck operations
- 🎯 **Component Detail Access**: Drill down to individual truck/pump when needed
- 🎯 **Smart Workflow**: Automatic coordination between components
- 🎯 **Familiar Interface**: Enhance existing asset detail page

---

## 🏗️ **Technical Architecture**

### **Database Schema Enhancement**

```sql
-- Add composite support to existing assets table
ALTER TABLE assets ADD COLUMN is_composite BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN component_assets UUID[] DEFAULT '{}';
ALTER TABLE assets ADD COLUMN composite_type TEXT; -- 'pumping_truck', 'crane_truck', etc.
ALTER TABLE assets ADD COLUMN primary_component_id UUID REFERENCES assets(id);

-- Create composite relationship tracking
CREATE TABLE asset_composite_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  composite_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  component_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  attachment_date DATE DEFAULT CURRENT_DATE,
  detachment_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'detached')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(composite_asset_id, component_asset_id),
  UNIQUE(component_asset_id) -- One component can only be in one composite
);

-- Create composite maintenance coordination
CREATE TABLE composite_maintenance_coordination (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  composite_asset_id UUID NOT NULL REFERENCES assets(id),
  maintenance_plan_id UUID REFERENCES maintenance_plans(id),
  affected_components UUID[] NOT NULL, -- Which components are affected
  coordination_type TEXT NOT NULL, -- 'shared_hours', 'cascade_issue', 'combined_schedule'
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Key Design Principles:**

1. **🔄 Shared Hours Synchronization**
   ```typescript
   // When one component's hours update, sync to all components
   const syncComponentHours = async (componentId: string, newHours: number) => {
     const composite = await getCompositeByComponent(componentId);
     if (composite) {
       await updateAllComponentHours(composite.component_assets, newHours);
     }
   };
   ```

2. **📋 Separate Maintenance Schedules**
   ```typescript
   // Each component maintains its own maintenance intervals (different brands)
   const getComponentMaintenance = async (componentId: string) => {
     return await getMaintenancePlans(componentId); // Individual schedules per brand
   };
   ```

3. **🚨 Unified Issue Management**
   ```typescript
   // ALL issues cascade to all components in composite
   const cascadeIssueToComponents = async (issue: Issue, compositeId: string) => {
     const components = await getCompositeComponents(compositeId);
     await Promise.all(components.map(comp => 
       createRelatedIssue(issue, comp.id, 'cascaded_from_composite')
     ));
   };
   ```

4. **⏱️ Automatic Hours Synchronization**
   ```typescript
   // Always sync hours across all components when one updates
   const syncComponentHours = async (componentId: string, newHours: number) => {
     const composite = await getCompositeByComponent(componentId);
     if (composite) {
       await updateAllComponentHours(composite.component_assets, newHours);
     }
   };
   ```

---

## 🎨 **User Interface Design**

### **Enhanced Asset Detail Page Structure**

#### **1. Composite Asset Header**
```
🚛 Pumping Truck PT-001 (Composite Asset)
├── 📊 Combined Status: Operational (2/2 components)
├── ⏱️ Shared Hours: 2,450h (synchronized across components)
├── 🔧 Next Maintenance: Truck (50h) | Pump (200h)
└── 🚨 Active Issues: 1 (affects both components)
```

#### **2. Component Breakdown Section**
```
📋 COMPONENT STATUS
├── 🚛 Truck Chassis (EQ-045): 2,450h | Status: Operational
│   ├── Next Maintenance: 2,500h (50h remaining)
│   └── Last Maintenance: 2,200h (250h ago)
│
└── ⚙️ Pump Unit (EQ-178): 2,450h | Status: Maintenance Due
    ├── Next Maintenance: 2,250h (200h overdue)
    └── Last Maintenance: 2,000h (450h ago)
```

#### **3. Enhanced Tab Structure**
```
📑 COMPOSITE ASSET TABS
├── 🏠 Estado & Mantenimiento
│   ├── Combined maintenance status
│   ├── Shared hours tracking
│   └── Component-specific schedules
│
├── 🚨 Incidentes & Checklists
│   ├── Unified issue management
│   ├── Composite checklists
│   └── Component-specific tasks
│
├── 📊 Información Técnica
│   ├── Combined specifications
│   ├── Component details
│   └── Performance metrics
│
└── 📋 Documentación
    ├── Composite documentation
    ├── Component manuals
    └── Maintenance records
```

---

## 🔧 **Implementation Phases**

### **Phase 1: Database Foundation (Week 1)**
**Duration**: 3-4 days  
**Deliverables**: Database schema, basic API endpoints

#### **Tasks:**
1. **Database Migration**
   ```sql
   -- Apply schema changes
   -- Create composite relationship tables
   -- Add indexes for performance
   ```

2. **API Endpoints**
   ```typescript
   // New endpoints for composite management
   POST /api/assets/composite/create
   GET /api/assets/composite/{id}/components
   PUT /api/assets/composite/{id}/components
   DELETE /api/assets/composite/{id}/components/{componentId}
   ```

3. **Data Services**
   ```typescript
   // Core composite management services
   export const compositeAssetService = {
     createComposite(components: Asset[], metadata: CompositeMetadata),
     getCompositeWithComponents(compositeId: string),
     syncComponentHours(componentId: string, hours: number),
     cascadeIssueToComponents(issue: Issue, compositeId: string)
   };
   ```

### **Phase 2: Asset Detail Enhancement (Week 2)**
**Duration**: 4-5 days  
**Deliverables**: Enhanced asset detail page, composite-aware components

#### **Tasks:**
1. **Enhanced Asset Loading**
   ```typescript
   // Smart asset loading with component detection
   const loadAssetWithComposites = async (assetId: string) => {
     const asset = await fetchAsset(assetId);
     
     if (asset.is_composite) {
       const components = await fetchComponents(asset.component_assets);
       const compositeData = await aggregateCompositeData(asset, components);
       return { ...asset, components, compositeData };
     }
     
     // Check if asset is part of a composite
     const composite = await getCompositeByComponent(assetId);
     if (composite) {
       return { ...asset, parentComposite: composite };
     }
     
     return asset;
   };
   ```

2. **Composite-Aware Components**
   ```typescript
   // Enhanced components that understand composites
   const CompositeMaintenanceStatus = ({ asset, components }) => {
     if (asset.is_composite) {
       return <CompositeMaintenanceView asset={asset} components={components} />;
     }
     return <StandardMaintenanceView asset={asset} />;
   };
   ```

3. **Shared Hours Synchronization**
   ```typescript
   // Automatic hours sync across components
   const updateComponentHours = async (componentId: string, newHours: number) => {
     await updateAssetHours(componentId, newHours);
     
     const composite = await getCompositeByComponent(componentId);
     if (composite) {
       await syncHoursToAllComponents(composite.id, newHours);
     }
   };
   ```

### **Phase 3: Composite Creation Workflow (Week 3)**
**Duration**: 3-4 days  
**Deliverables**: Composite asset creation interface, component selection

#### **Tasks:**
1. **Composite Creation Form**
   ```typescript
   // New composite creation workflow
   const CreateCompositeAssetForm = () => {
     const [selectedComponents, setSelectedComponents] = useState<Asset[]>([]);
     const [compositeMetadata, setCompositeMetadata] = useState({});
     
     const handleCreateComposite = async () => {
       await compositeAssetService.createComposite(selectedComponents, compositeMetadata);
     };
   };
   ```

2. **Component Selection Interface**
   ```typescript
   // Asset picker for composite creation
   const ComponentAssetPicker = ({ onSelect }) => {
     const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
     
     return (
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {availableAssets.map(asset => (
           <AssetSelectionCard 
             key={asset.id}
             asset={asset}
             onSelect={() => onSelect(asset)}
           />
         ))}
       </div>
     );
   };
   ```

3. **Validation Logic**
   ```typescript
   // Ensure components can be combined
   const validateCompositeComponents = (components: Asset[]) => {
     const errors = [];
     
     // Check for conflicts
     components.forEach(component => {
       if (component.is_composite) {
         errors.push(`${component.name} is already a composite asset`);
       }
       if (component.component_assets.length > 0) {
         errors.push(`${component.name} is already part of a composite`);
       }
     });
     
     return errors;
   };
   ```

### **Phase 4: Issue Management Enhancement (Week 4)**
**Duration**: 3-4 days  
**Deliverables**: Unified issue management, cascade logic

#### **Tasks:**
1. **Issue Cascade Logic**
   ```typescript
   // When issue is created on component, cascade to composite
   const handleComponentIssue = async (issue: Issue, componentId: string) => {
     const composite = await getCompositeByComponent(componentId);
     
     if (composite) {
       // Create related issues for all components
       await cascadeIssueToComponents(issue, composite.id);
       
       // Update composite status
       await updateCompositeStatus(composite.id, 'issue_detected');
     }
   };
   ```

2. **Unified Issue Display**
   ```typescript
   // Show all issues from composite and components
   const CompositeIssuesView = ({ composite, components }) => {
     const allIssues = [
       ...composite.issues,
       ...components.flatMap(c => c.issues)
     ];
     
     return (
       <div className="space-y-4">
         <h3>All Issues ({allIssues.length})</h3>
         {allIssues.map(issue => (
           <IssueCard 
             key={issue.id}
             issue={issue}
             showComponent={true}
           />
         ))}
       </div>
     );
   };
   ```

3. **Maintenance Coordination**
   ```typescript
   // Coordinate maintenance with separate work orders per component
   const coordinateMaintenance = async (compositeId: string, maintenanceType: string) => {
     const components = await getCompositeComponents(compositeId);
     
     if (maintenanceType === 'shared_hours') {
       // Always sync hours across all components
       await syncHoursToAllComponents(compositeId, newHours);
     } else if (maintenanceType === 'cascade_issue') {
       // ALL issues cascade to all components
       await cascadeIssueToComponents(issue, compositeId);
     } else if (maintenanceType === 'separate_maintenance') {
       // Create separate work orders for each component (different brands)
       await Promise.all(components.map(comp => 
         createComponentWorkOrder(comp.id, maintenanceType)
       ));
     }
   };
   ```

---

## 🚀 **Migration Strategy**

### **Retroactive Compatibility Approach**

#### **Step 1: User-Driven Creation**
```typescript
// No automatic migration - users create composites as needed
const createCompositeFromExisting = async (componentIds: string[], metadata: CompositeMetadata) => {
  // Validate components can be combined
  const components = await fetchAssets(componentIds);
  const validationErrors = validateCompositeComponents(components);
  
  if (validationErrors.length > 0) {
    throw new Error(`Cannot create composite: ${validationErrors.join(', ')}`);
  }
  
  // Create composite asset
  const composite = await createCompositeAsset({
    name: metadata.name,
    composite_type: metadata.type,
    components: componentIds
  });
  
  return composite;
};
```

#### **Step 2: Testing and Learning**
```typescript
// Allow users to experiment with composite creation
const enableCompositeCreation = async () => {
  // Add composite creation UI to asset management
  // Provide clear documentation and examples
  // Allow testing with existing assets
};
```

#### **Step 3: Gradual Adoption**
```typescript
// Users create composites as they discover the need
const monitorCompositeAdoption = async () => {
  // Track composite creation patterns
  // Gather user feedback
  // Optimize workflow based on usage
};
```

---

## 📊 **Testing Strategy**

### **Unit Testing**
```typescript
describe('Composite Asset Management', () => {
  test('should create composite from existing assets', async () => {
    const truck = await createTestAsset({ name: 'Test Truck' });
    const pump = await createTestAsset({ name: 'Test Pump' });
    
    const composite = await createComposite([truck, pump]);
    
    expect(composite.is_composite).toBe(true);
    expect(composite.component_assets).toContain(truck.id);
    expect(composite.component_assets).toContain(pump.id);
  });
  
  test('should sync hours across components', async () => {
    const composite = await createTestComposite();
    await updateComponentHours(composite.components[0].id, 2500);
    
    const updatedComponents = await getCompositeComponents(composite.id);
    expect(updatedComponents[0].current_hours).toBe(2500);
    expect(updatedComponents[1].current_hours).toBe(2500);
  });
});
```

### **Integration Testing**
```typescript
describe('Composite Asset Workflows', () => {
  test('should cascade issues to all components', async () => {
    const composite = await createTestComposite();
    const issue = await createTestIssue(composite.components[0].id);
    
    const cascadedIssues = await getCascadedIssues(issue.id);
    expect(cascadedIssues).toHaveLength(composite.components.length);
  });
  
  test('should maintain separate maintenance schedules', async () => {
    const composite = await createTestComposite();
    
    const truckMaintenance = await getMaintenancePlans(composite.components[0].id);
    const pumpMaintenance = await getMaintenancePlans(composite.components[1].id);
    
    expect(truckMaintenance).not.toEqual(pumpMaintenance);
  });
});
```

---

## 📈 **Success Metrics**

### **Technical Metrics**
- ✅ **Zero downtime** during migration
- ✅ **100% backward compatibility** with existing assets
- ✅ **<100ms** response time for composite asset loading
- ✅ **99.9%** data integrity during hours synchronization

### **User Experience Metrics**
- ✅ **Single page** management for composite assets
- ✅ **Reduced clicks** for maintenance coordination
- ✅ **Improved accuracy** in shared hours tracking
- ✅ **Enhanced visibility** of component relationships

### **Business Metrics**
- ✅ **Faster maintenance** planning for composite units
- ✅ **Reduced errors** in hours tracking
- ✅ **Better resource** allocation for composite maintenance
- ✅ **Improved compliance** with maintenance schedules

---

## 🎯 **Next Steps**

### **Immediate Actions (This Week)**
1. **Review and approve** this implementation plan
2. **Set up development** environment for composite features
3. **Create database** migration scripts
4. **Begin Phase 1** implementation

### **Week 1 Goals**
- ✅ Complete database schema implementation
- ✅ Create basic API endpoints for composite management
- ✅ Set up testing framework for composite features

### **Week 2 Goals**
- ✅ Enhance asset detail page with composite awareness
- ✅ Implement shared hours synchronization
- ✅ Create composite-aware UI components

### **Week 3 Goals**
- ✅ Build composite asset creation workflow
- ✅ Implement component selection interface
- ✅ Add validation and error handling

### **Week 4 Goals**
- ✅ Implement unified issue management
- ✅ Add cascade logic for component coordination
- ✅ Complete migration of existing combinations

---

## ✅ **Requirements Confirmed**

### **Component Roles**: 
- ❌ **No specific roles** - Keep it simple and flexible
- ✅ **Generic component relationships** - Avoid overcomplication

### **Hours Synchronization**: 
- ✅ **Always sync to all components** - Necessary and useful
- ✅ **Automatic synchronization** - No manual override needed
- ✅ **Real-time updates** - When one component updates, all sync

### **Issue Cascade**: 
- ✅ **All issues cascade** - Every issue affects all components
- ✅ **Individual attention possible** - Can be addressed in individual asset view
- ✅ **Unified view** - Composite view shows all issues from both components

### **Maintenance Scheduling**: 
- ✅ **Separate work orders** - Different maintenance schedules per component
- ✅ **Brand-specific maintenance** - Different brands have different requirements
- ✅ **Component-specific planning** - Each component maintains its own schedule

### **Existing Data Migration**: 
- ✅ **No manual selection** - Allow for testing and user learning
- ✅ **User-driven creation** - End users create composites as needed
- ✅ **Fresh start approach** - Start with new composite assets

---

## 🚀 **Implementation Ready**

**All requirements clarified. Ready to proceed with Phase 1 implementation!** 