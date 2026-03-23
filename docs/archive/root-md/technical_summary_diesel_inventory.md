# Diesel Inventory Control System - Technical Summary

## 🎯 System Overview

The enhanced diesel inventory control system handles **three categories of fuel consumption**:

1. **Formal Assets** - Equipment registered in your assets table
2. **Exception Assets** - External equipment (partners, rentals, utilities)
3. **General Consumption** - Plant operations without specific asset attribution

---

## 📋 Database Schema Structure

### Core Tables

#### `diesel_transactions` (Enhanced)
**Purpose**: Main transaction log with exception handling
**New Columns Added**:
```sql
-- Exception handling
exception_asset_name TEXT            -- Asset name when no formal asset exists
asset_category TEXT                  -- 'formal', 'exception', 'general'

-- Validation
cuenta_litros DECIMAL(10,2)         -- Physical meter reading
validation_difference DECIMAL(10,2)  -- Auto-calculated difference

-- Adjustments
adjustment_reason TEXT              -- Why adjustment was made
adjustment_category TEXT            -- 'physical_count', 'evaporation', etc.
reference_transaction_id UUID       -- Links to related transactions

-- Efficiency tracking
hours_consumed INTEGER              -- Auto-calculated from readings
kilometers_consumed INTEGER         -- Auto-calculated from readings

-- Import tracking
source_system TEXT                  -- 'manual', 'excel_import', 'checklist'
import_batch_id TEXT               -- Groups imported records
```

#### `exception_assets`
**Purpose**: Registry of non-formal assets
```sql
CREATE TABLE exception_assets (
    id UUID PRIMARY KEY,
    exception_name TEXT UNIQUE NOT NULL,
    normalized_name TEXT,
    asset_type TEXT,                -- 'partner', 'rental', 'utility'
    description TEXT,
    owner_info TEXT,
    
    -- Auto-calculated statistics
    total_transactions INTEGER DEFAULT 0,
    total_consumption_liters DECIMAL(10,2) DEFAULT 0,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    
    -- Promotion to formal asset
    promoted_to_asset_id UUID REFERENCES assets(id),
    promoted_at TIMESTAMP,
    promoted_by UUID
);
```

#### `asset_name_mappings`
**Purpose**: Maps text names to formal/exception assets
```sql
CREATE TABLE asset_name_mappings (
    id UUID PRIMARY KEY,
    original_name TEXT UNIQUE NOT NULL,
    
    -- Either formal or exception, not both
    asset_id UUID REFERENCES assets(id),
    exception_asset_id UUID REFERENCES exception_assets(id),
    
    mapping_type TEXT,              -- 'formal', 'exception', 'ignore'
    confidence_level DECIMAL(3,2),  -- 0.0 to 1.0
    mapping_source TEXT             -- 'automatic', 'manual', 'verified'
);
```

#### `diesel_excel_staging`
**Purpose**: Temporary table for Excel import processing
```sql
-- Contains all columns from your Excel file
-- Plus processing status fields
processed BOOLEAN DEFAULT FALSE,
processing_notes TEXT
```

---

## ⚙️ Core Functions

### `resolve_asset_name(input_name, auto_create_exception)`
**Purpose**: Smart asset resolution with fuzzy matching
**Returns**: `(resolution_type, asset_id, exception_asset_id, asset_category)`

**Logic Flow**:
1. Check existing mappings
2. Try fuzzy matching against formal assets (>60% similarity)
3. Create exception asset if no match
4. Return resolution details

```sql
-- Example usage
SELECT * FROM resolve_asset_name('CAT 320 EXCAVATOR', true);
-- Returns: ('formal', uuid, null, 'formal')

SELECT * FROM resolve_asset_name('Partner Truck XYZ', true);  
-- Returns: ('exception', null, uuid, 'exception')
```

### `get_unmapped_assets()`
**Purpose**: Get list of assets needing manual mapping
**Returns**: Asset names with occurrence counts and suggestions

### `create_asset_mapping(original_name, asset_id, mapping_type, created_by)`
**Purpose**: Manually create asset mappings
**Usage**: Called from your mapping UI

### `reconcile_diesel_inventory(warehouse_id, physical_count, count_date, reason, created_by)`
**Purpose**: Monthly inventory reconciliation
**Returns**: Transaction UUID for the adjustment record

### `get_warehouse_balance(warehouse_id, as_of_date)`
**Purpose**: Get current inventory balance for warehouse
**Returns**: Current balance in liters

---

## 📊 Enhanced Views

### `diesel_inventory_detailed`
**Purpose**: Daily inventory movements with running balances
**Key Columns**:
- `formal_asset_consumption` - Consumption by registered assets
- `exception_asset_consumption` - Consumption by partner/rental equipment  
- `general_consumption` - Plant operations
- `running_balance` - Cumulative balance

### `diesel_asset_consumption_summary`
**Purpose**: Asset performance metrics
**Key Columns**:
- `avg_liters_per_hour` - Fuel efficiency
- `activity_status` - 'Active', 'Recent', 'Inactive', 'Dormant'
- `consumption_last_30_days` - Recent usage

### `exception_assets_review`
**Purpose**: Exception assets requiring review/mapping
**Key Columns**:
- `mapping_status` - Current mapping state
- `is_promoted` - Whether promoted to formal asset
- `total_consumption_liters` - Usage volume

### `monthly_inventory_summary`  
**Purpose**: Monthly reconciliation data
**Key Columns**:
- `adjustment_level` - Variance classification
- `month_end_balance` - Closing inventory

---

## 🔄 Transaction Flow Logic

### Recording Consumption
```javascript
// Web app workflow
1. User enters asset name: "RETROEXCAVADORA JCB"
2. Call resolve_asset_name() function
3. Based on resolution_type:
   - formal: Use asset_id, allow horometer/km readings
   - exception: Use exception_asset_name, no readings
   - general: No asset info

4. Insert into diesel_transactions with appropriate asset_category
```

### Data Constraints
```sql
-- Auto-enforced rules:
- formal: must have asset_id, exception_asset_name = NULL
- exception: must have exception_asset_name, asset_id = NULL, no readings
- general: both asset fields NULL, no readings
- entries: no asset requirements
```

---

## 🛠️ Web App Integration Points

### 1. Asset Resolution API
```javascript
// Call when user types asset name
const resolution = await supabase.rpc('resolve_asset_name', {
  input_name: userInput,
  auto_create_exception: true
});

// Use resolution to determine UI fields
if (resolution.resolution_type === 'formal') {
  showHorometerField();
  showKilometerField();
} else {
  hideReadingFields();
}
```

### 2. Asset Mapping Interface
```javascript
// Get assets needing review
const unmapped = await supabase.rpc('get_unmapped_assets');

// Allow manual mapping
await supabase.rpc('create_asset_mapping', {
  p_original_name: 'Partner Truck XYZ',
  p_asset_id: selectedAssetId,
  p_mapping_type: 'formal',
  p_created_by: userId
});
```

### 3. Transaction Recording
```javascript
// Standard consumption recording
await supabase
  .from('diesel_transactions')
  .insert({
    transaction_id: generateId(),
    plant_id: currentPlant,
    warehouse_id: selectedWarehouse,
    asset_id: resolution.asset_id,
    exception_asset_name: resolution.resolution_type === 'exception' ? assetName : null,
    asset_category: resolution.asset_category,
    product_id: dieselProductId,
    transaction_type: 'consumption',
    quantity_liters: amount,
    horometer_reading: resolution.asset_category === 'formal' ? horometer : null,
    kilometer_reading: resolution.asset_category === 'formal' ? kilometers : null,
    operator_id: currentUser,
    transaction_date: new Date().toISOString(),
    created_by: currentUser
  });
```

### 4. Monthly Reconciliation
```javascript
// Month-end inventory count
const adjustmentId = await supabase.rpc('reconcile_diesel_inventory', {
  p_warehouse_id: warehouseId,
  p_physical_count: physicalCount,
  p_count_date: new Date().toISOString(),
  p_reason: 'Monthly physical count',
  p_created_by: userId
});
```

### 5. Dashboard Queries
```javascript
// Current warehouse balance
const balance = await supabase.rpc('get_warehouse_balance', {
  p_warehouse_id: warehouseId
});

// Asset performance
const { data: assetSummary } = await supabase
  .from('diesel_asset_consumption_summary')
  .select('*')
  .order('total_consumption', { ascending: false });

// Exception assets needing review
const { data: exceptionsToReview } = await supabase
  .from('exception_assets_review')
  .select('*')
  .eq('mapping_status', 'unmapped')
  .order('total_consumption_liters', { ascending: false });
```

---

## 🔐 Row Level Security (RLS)

The existing RLS policies on your tables will automatically apply to the new diesel system:

- **Plant-based access**: Users can only see transactions from their assigned plants
- **Role-based permissions**: Different roles have appropriate create/read/update permissions
- **Hierarchical access**: Higher roles can access multiple plants

---

## 📈 Performance Considerations

### Indexes Created
```sql
-- New indexes for performance
idx_diesel_transactions_asset_category    -- Fast category filtering
idx_asset_mappings_original              -- Asset name lookups
idx_exception_assets_normalized          -- Fuzzy matching
idx_diesel_transactions_validation       -- Validation queries
```

### Query Optimization
- Views use CTEs for better query planning
- Generated columns for automatic calculations
- Proper foreign key relationships for joins

---

## 🚀 Migration Path

### For Your Web App Development

1. **Phase 1: Basic Exception Handling**
   - Update transaction recording to use `resolve_asset_name()`
   - Handle three asset categories in UI
   - Test with existing data

2. **Phase 2: Asset Mapping Interface**
   - Build UI for `get_unmapped_assets()`
   - Implement manual mapping functionality
   - Process any historical data

3. **Phase 3: Enhanced Features**
   - Add monthly reconciliation workflow
   - Implement validation checking (cuenta_litros)
   - Add efficiency reporting

4. **Phase 4: Excel Import**
   - Build import interface using `diesel_excel_staging`
   - Implement batch processing with asset resolution
   - Add import validation and error handling

---

## 🔍 Monitoring & Maintenance

### Key Metrics to Track
```sql
-- Exception assets with high usage (candidates for promotion)
SELECT exception_name, total_consumption_liters 
FROM exception_assets 
WHERE total_consumption_liters > 500
ORDER BY total_consumption_liters DESC;

-- Validation differences requiring attention
SELECT COUNT(*) as validation_issues
FROM diesel_transactions 
WHERE validation_difference > 5;

-- Monthly adjustment patterns
SELECT warehouse_code, AVG(monthly_adjustments) as avg_adjustment
FROM monthly_inventory_summary
GROUP BY warehouse_code;
```

### Maintenance Tasks
- Weekly: Review unmapped assets
- Monthly: Run reconciliation process
- Quarterly: Promote high-usage exceptions to formal assets
- Annually: Review and optimize asset mappings

---

## 💡 Key Benefits

1. **Zero Data Loss**: All consumption tracked regardless of asset status
2. **Flexible Growth**: Exception assets can become formal assets anytime  
3. **Backward Compatible**: Works with existing transaction patterns
4. **Performance Optimized**: Proper indexing for fast queries
5. **Audit Ready**: Full transaction history with validation tracking
6. **Integration Friendly**: Functions designed for web app consumption

---

## 🔧 Next Steps for Implementation

1. **Test the functions** in your development environment
2. **Build asset mapping UI** using the provided functions
3. **Update transaction recording** to use the new asset categories
4. **Implement reconciliation workflow** for monthly closing
5. **Add validation features** for cuenta_litros checking

The system is now ready for your web app integration!