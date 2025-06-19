# Complete RLS Implementation Plan: Fix Hierarchy + Extend Coverage

## 🎯 **Current State Analysis**

### ✅ **Working Tables (RLS Enabled)**
- `assets` - Hierarchical access working
- `plants` - Hierarchical access working  
- `business_units` - Hierarchical access working

### ⚠️ **Profile Hierarchy Issues Found**
- GERENCIA_GENERAL users have `business_unit_id` set (should be NULL for total access)
- JEFE_PLANTA users have NULL values (should have specific plant assignments)

### ❌ **Missing RLS Tables**
- `work_orders` - Critical for operational security
- `maintenance_tasks` - Critical for maintenance workflow
- `asset_operators` - Critical for operator assignments
- `completed_checklists` - Critical for compliance
- `purchase_orders` - Critical for financial control
- `profiles` - Critical for user management

## 🔧 **PHASE 1: Fix Profile Hierarchy**

### **Current vs Intended Structure**
```sql
-- CURRENT (Incorrect):
-- GERENCIA_GENERAL: business_unit_id = 'bd2c18a9...' (should be NULL)
-- JEFE_PLANTA: plant_id = NULL (should be specific plant)

-- INTENDED (Correct):
-- GERENCIA_GENERAL: plant_id = NULL, business_unit_id = NULL (TOTAL ACCESS)
-- JEFE_UNIDAD_NEGOCIO: plant_id = NULL, business_unit_id = specific (UNIT ACCESS)  
-- JEFE_PLANTA: plant_id = specific, business_unit_id = specific (PLANT ACCESS)
```

### **Migration Script**
```sql
-- Step 1: Backup current state
CREATE TABLE profiles_backup_rls_fix AS SELECT * FROM profiles;

-- Step 2: Fix GERENCIA_GENERAL for total access
UPDATE profiles 
SET business_unit_id = NULL, plant_id = NULL
WHERE role = 'GERENCIA_GENERAL' 
AND status = 'active';

-- Step 3: Fix JEFE_UNIDAD_NEGOCIO assignments
-- (Need to identify which users belong to which business unit)

-- Step 4: Fix JEFE_PLANTA assignments  
-- (Need to identify which users belong to which plant)

-- Step 5: Verify hierarchy
SELECT 
  role,
  CASE 
    WHEN plant_id IS NULL AND business_unit_id IS NULL THEN 'TOTAL_ACCESS'
    WHEN plant_id IS NULL AND business_unit_id IS NOT NULL THEN 'UNIT_ACCESS'
    WHEN plant_id IS NOT NULL THEN 'PLANT_ACCESS'
  END as access_level,
  count(*) as user_count
FROM profiles 
WHERE status = 'active'
GROUP BY role, access_level
ORDER BY role;
```

## 🚀 **PHASE 2: Extend RLS to Critical Tables**

### **1. Work Orders RLS**
```sql
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Work orders hierarchical access" ON work_orders
FOR ALL TO authenticated
USING (
  -- Total access (Gerencia General)
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND plant_id IS NULL 
    AND business_unit_id IS NULL
  ))
  OR
  -- Unit access (Jefe Unidad)
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    JOIN assets a ON a.plant_id = pl.id
    WHERE p.id = auth.uid() 
    AND p.plant_id IS NULL 
    AND p.business_unit_id IS NOT NULL
    AND work_orders.asset_id = a.id
  ))
  OR
  -- Plant access (Jefe Planta, Encargado Mantenimiento)
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN assets a ON a.plant_id = p.plant_id
    WHERE p.id = auth.uid() 
    AND p.plant_id IS NOT NULL
    AND work_orders.asset_id = a.id
  ))
  OR
  -- Operator access (assigned assets)
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN asset_operators ao ON ao.operator_id = p.id
    JOIN assets a ON a.id = ao.asset_id
    WHERE p.id = auth.uid()
    AND p.role = 'OPERADOR'
    AND work_orders.asset_id = a.id
    AND ao.status = 'active'
  ))
);
```

### **2. Maintenance Tasks RLS**
```sql
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Maintenance tasks hierarchical access" ON maintenance_tasks
FOR ALL TO authenticated
USING (
  -- Same hierarchical pattern as work_orders
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND plant_id IS NULL 
    AND business_unit_id IS NULL
  ))
  OR
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    JOIN assets a ON a.plant_id = pl.id
    WHERE p.id = auth.uid() 
    AND p.plant_id IS NULL 
    AND p.business_unit_id IS NOT NULL
    AND maintenance_tasks.asset_id = a.id
  ))
  OR
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN assets a ON a.plant_id = p.plant_id
    WHERE p.id = auth.uid() 
    AND p.plant_id IS NOT NULL
    AND maintenance_tasks.asset_id = a.id
  ))
);
```

### **3. Asset Operators RLS**
```sql
ALTER TABLE asset_operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Asset operators hierarchical access" ON asset_operators
FOR ALL TO authenticated
USING (
  -- Total access
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND plant_id IS NULL 
    AND business_unit_id IS NULL
  ))
  OR
  -- Unit access
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    JOIN assets a ON a.plant_id = pl.id
    WHERE p.id = auth.uid() 
    AND p.plant_id IS NULL 
    AND p.business_unit_id IS NOT NULL
    AND asset_operators.asset_id = a.id
  ))
  OR
  -- Plant access
  (EXISTS (
    SELECT 1 FROM profiles p
    JOIN assets a ON a.plant_id = p.plant_id
    WHERE p.id = auth.uid() 
    AND p.plant_id IS NOT NULL
    AND asset_operators.asset_id = a.id
  ))
  OR
  -- Self access (operators can see their own assignments)
  (operator_id = auth.uid())
);
```

### **4. Profiles RLS (Careful - No Recursion)**
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Simple policy without recursion
CREATE POLICY "Profiles hierarchical access" ON profiles
FOR SELECT TO authenticated
USING (
  -- Self access
  (id = auth.uid())
  OR
  -- Total admin access via user_admin_context
  (EXISTS (
    SELECT 1 FROM user_admin_context 
    WHERE user_id = auth.uid() 
    AND admin_level = 'TOTAL'
  ))
  OR
  -- Unit admin access via user_admin_context
  (EXISTS (
    SELECT 1 FROM user_admin_context uac
    WHERE uac.user_id = auth.uid() 
    AND uac.admin_level = 'UNIT'
    AND (
      profiles.business_unit_id = uac.business_unit_id
      OR profiles.plant_id IN (
        SELECT id FROM plants WHERE business_unit_id = uac.business_unit_id
      )
    )
  ))
  OR
  -- Plant admin access via user_admin_context
  (EXISTS (
    SELECT 1 FROM user_admin_context uac
    WHERE uac.user_id = auth.uid() 
    AND uac.admin_level = 'PLANT'
    AND profiles.plant_id = uac.plant_id
  ))
);
```

## 📊 **PHASE 3: Performance Optimization**

### **Critical Indexes**
```sql
-- Optimize profile hierarchy queries
CREATE INDEX IF NOT EXISTS idx_profiles_hierarchy_total 
ON profiles (id) WHERE plant_id IS NULL AND business_unit_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_hierarchy_unit 
ON profiles (id, business_unit_id) WHERE plant_id IS NULL AND business_unit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_hierarchy_plant 
ON profiles (id, plant_id) WHERE plant_id IS NOT NULL;

-- Optimize asset-related queries
CREATE INDEX IF NOT EXISTS idx_assets_plant_id ON assets (plant_id);
CREATE INDEX IF NOT EXISTS idx_asset_operators_active ON asset_operators (asset_id, operator_id) WHERE status = 'active';
```

## 🧪 **PHASE 4: Testing Strategy**

### **Test Cases by Role**
```sql
-- Test 1: GERENCIA_GENERAL should see everything
-- Test 2: JEFE_UNIDAD should see only their business unit
-- Test 3: JEFE_PLANTA should see only their plant
-- Test 4: OPERADOR should see only assigned assets
```

### **Verification Queries**
```sql
-- Check access levels after migration
SELECT 
  p.email,
  p.role,
  CASE 
    WHEN p.plant_id IS NULL AND p.business_unit_id IS NULL THEN 'TOTAL'
    WHEN p.plant_id IS NULL AND p.business_unit_id IS NOT NULL THEN 'UNIT'
    WHEN p.plant_id IS NOT NULL THEN 'PLANT'
  END as access_level,
  bu.name as business_unit_name,
  pl.name as plant_name
FROM profiles p
LEFT JOIN business_units bu ON p.business_unit_id = bu.id
LEFT JOIN plants pl ON p.plant_id = pl.id
WHERE p.status = 'active'
ORDER BY p.role, access_level;
```

## ⚠️ **Implementation Considerations**

### **Risk Mitigation**
1. **Backup everything** before starting
2. **Test in development** environment first
3. **Implement gradually** (one table at a time)
4. **Monitor performance** after each step
5. **Have rollback plan** ready

### **Rollback Strategy**
```sql
-- If issues occur, quickly disable RLS
ALTER TABLE work_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks DISABLE ROW LEVEL SECURITY;
-- etc.

-- Restore profiles from backup if needed
DELETE FROM profiles WHERE id IN (SELECT id FROM profiles_backup_rls_fix);
INSERT INTO profiles SELECT * FROM profiles_backup_rls_fix;
```

## 🎯 **Expected Outcome**

### **After Implementation**
- ✅ **Consistent hierarchy** across all users
- ✅ **Comprehensive RLS** on all critical tables
- ✅ **Performance optimized** with proper indexes
- ✅ **Security enforced** at database level
- ✅ **Maintainable structure** for future expansion

### **Access Matrix**
| Role | Access Level | Can See |
|------|-------------|---------|
| GERENCIA_GENERAL | TOTAL | All assets, work orders, maintenance tasks |
| JEFE_UNIDAD_NEGOCIO | UNIT | Only their business unit's data |
| JEFE_PLANTA | PLANT | Only their plant's data |
| OPERADOR | ASSIGNED | Only assigned assets and related tasks |

## 📅 **Implementation Timeline**

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1** | 1 day | Fix profile hierarchy |
| **Phase 2** | 2-3 days | Implement RLS on all tables |
| **Phase 3** | 1 day | Performance optimization |
| **Phase 4** | 1 day | Testing and verification |
| **Total** | **5-6 days** | **Complete RLS implementation** |

---

**Next Step**: Would you like me to start with Phase 1 (fixing the profile hierarchy) or do you prefer to implement this gradually table by table? 