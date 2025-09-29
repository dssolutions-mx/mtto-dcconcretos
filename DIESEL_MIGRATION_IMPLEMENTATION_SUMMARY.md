# Diesel Control Migration - Implementation Summary

## ✅ Completed (Phase 1)

### 1. Enhanced Type System (`types/diesel.ts`)
Added comprehensive types for diesel migration:
- **`MovementCategory`**: Classifies each row as inventory_opening, fuel_receipt, asset_consumption, etc.
- **`MeterReading`**: Captures horometer/kilometer readings with validation and delta calculations
- **`PlantBatch`**: Per-plant processing unit with stats, inventory reconciliation, and meter tracking
- **`MeterConflict`**: Tracks conflicts between diesel readings and checklist data
- **`MeterReconciliationPreferences`**: User preferences for handling meter conflicts

### 2. Parser Utilities (`lib/diesel-parser-utils.ts`)
Implements the complete parsing algorithm:

#### Movement Classification
- **Inventory Opening**: `Entrada` with no unit, no liters, has `INVENTARIO INICIAL`
- **Fuel Receipt**: `Entrada` with no unit, large liters (>1000L typically)
- **Asset Consumption**: `Salida` with unit identifier
- **Unassigned Consumption**: `Salida` without unit (needs mapping)
- **Adjustments**: Detected by patterns (validation discrepancies, round numbers)

#### Per-Row Enhancement
- Parses Smartsheet date format (MM/DD/YY)
- Coerces all numeric fields with null handling
- Builds chronological sort key (date + time + row)
- Flags validation discrepancies (comparing `litros_cantidad` vs `validacion`)
- Extracts meter readings when present
- Determines if asset mapping is required

#### Plant Batch Grouping
- Groups rows by `planta` + `almacen`
- Sorts chronologically within each batch
- Computes:
  - Initial inventory (from opening row)
  - Final inventory (computed vs Smartsheet-provided)
  - Inventory discrepancy detection
  - Movement counts (receipts, consumptions, adjustments)
  - Unique assets and unmapped assets
  - Total liters in/out
  - Date range

#### Meter Reading Processing
- Extracts meter readings per asset
- Sorts chronologically
- Computes deltas between consecutive readings
- Calculates daily averages (hours/day, km/day)
- Computes fuel efficiency (L/hour, L/km)
- Validates readings:
  - ⚠️ Warning if >20 hrs/day usage
  - ❌ Error if >24 hrs/day (impossible)
  - ❌ Error if negative delta (meter reset/rollover)
  - ⚠️ Warning if fuel consumed but no meter change
  - ⚠️ Warning if efficiency anomalous (<0.5 or >50 L/hr)

### 3. Store Enhancement (`store/diesel-store.ts`)
Added plant batch management:

#### New State
```typescript
plantBatches: PlantBatch[]              // All parsed plant batches
selectedPlantBatch: string | null       // Currently selected batch_id
meterConflicts: MeterConflict[]         // Detected conflicts with checklist
meterPreferences: {                     // User preferences
  default_action: 'prompt',
  update_threshold_days: 7,
  prompt_if_discrepancy_gt: 10
}
```

#### New Actions
- `setPlantBatches(batches)`: Store parsed batches
- `selectPlantBatch(batchId)`: Select batch for processing
- `getSelectedPlantBatch()`: Get current batch
- `updatePlantBatch(batchId, updates)`: Update batch stats
- `setMeterConflicts(conflicts)`: Store detected conflicts
- `resolveMeterConflict(assetCode, resolution)`: User decision on conflict
- `setMeterPreferences(prefs)`: Update user preferences

### 4. ExcelUploader Enhancement
Updated to use new parser:
- Calls `buildEnhancedRow()` instead of inline coercion
- Calls `groupIntoPlantBatches()` after parsing
- Stores batches in Zustand with `setPlantBatches()`
- Notifies user of batch count

---

## 📋 Sample Data Analysis (planta 1 incompleto.csv)

### File Structure
- **20 rows** (19 data rows + 1 header)
- **Plant**: P1 (all rows)
- **Warehouse**: 6 (all rows)
- **Date Range**: Feb 8-17, 2025
- **Movement Types**: 1 opening, 1 fuel receipt, 17 consumptions, 1 unassigned

### Movement Breakdown
| Category | Count | Notes |
|----------|-------|-------|
| Inventory Opening | 1 | Row 2: Initial 2511L |
| Fuel Receipt | 1 | Row 6: +9900L entrada |
| Asset Consumption | 16 | Normal equipment refueling |
| Unassigned Consumption | 1 | Row 4: No unit but has readings |

### Asset Inventory
| Asset ID | Appearances | Reading Types | Notes |
|----------|-------------|---------------|-------|
| CR-16 | 2 | Horometer + Km | +29.5 hr, +622 km over 5 days |
| CR-24 | 2 | Horometer + Km | +21 hr, +234 km over 3 days |
| CR-20 | 2 | Horometer + Km | +48 hr, +575 km (⚠️ 16 hr/day) |
| BP-03 | 2 | Horometer + Km | +32.1 hr, +122.4 km |
| CR-15 | 2 | Horometer + Km | Normal usage |
| CR-26 | 2 | Horometer + Km | Normal usage |
| CR-17, CF-01, PIPA-P01, CR-19 | 1 each | Various | Single readings |
| (empty) | 3 | Mixed | Need mapping |

### Inventory Reconciliation
- **Initial**: 2511L
- **Total In**: 9900L
- **Total Out**: 4090L
- **Computed Final**: 8321L
- **Smartsheet Final**: 8571L
- **Discrepancy**: 250L ⚠️

### Validation Discrepancies Found
- Row 11: 277L vs validation 278L (+1L)
- Row 17: 225L vs validation 226L (+1L)
- Row 19: 301L vs validation 298L (-3L)

### Meter Reading Warnings
- **CR-20**: 16 hours/day average (⚠️ very high usage)
- **Row 4**: No unit identifier but has horometer 5599

---

## 🔄 Migration Workflow (Implemented)

### Phase 1: Upload & Parsing ✅
1. User uploads `.xlsx` or `.csv` from Smartsheet
2. Parser detects file type, reads with appropriate method
3. For each row:
   - Maps headers (fuzzy matching, diacritics-normalized)
   - Coerces types (numbers, dates, tipo)
   - Classifies movement category
   - Detects adjustments
   - Extracts meter readings
   - Flags validation discrepancies
4. Groups rows into `PlantBatch` objects (by plant + warehouse)
5. Computes per-batch stats:
   - Inventory reconciliation
   - Movement counts
   - Asset lists (unique, unmapped, with meters)
   - Meter delta calculations
   - Validation warnings/errors
6. Stores batches in Zustand
7. Shows preview with stats

---

## 🚧 Next Steps (Phase 2)

### 5. DieselPreview Update (TODO)
Show per-plant batch preview:
- Plant selector (if multiple batches)
- Movement category breakdown
- Inventory reconciliation status
- Meter reading summary per asset
- Filters: by movement category, date range, asset
- Expandable rows showing:
  - Original Smartsheet data
  - Computed deltas
  - Validation issues
  - Meter reading progression

### 6. Meter Reconciliation Dialog (TODO)
When diesel readings conflict with checklist data:
```typescript
interface MeterConflictDialog {
  // Show side-by-side comparison
  asset: Asset
  diesel_reading: { date, horometer, kilometer }
  checklist_reading: { date, horometer, kilometer, source }
  
  // User options
  actions: [
    'use_diesel_reading',    // Update asset with diesel data
    'keep_checklist',        // Ignore diesel, keep checklist as primary
    'skip_this_asset'        // Don't import meter readings for this asset
  ]
  
  // Apply to all checkbox
  remember_preference: boolean
}
```

### 7. Mapping Tab Enhancement (TODO)
Focus on selected plant batch:
- Show only unmapped assets from current batch
- Display asset usage stats (occurrences, total liters, date range)
- Suggest formal assets based on fuzzy matching
- Allow creating exception assets
- Mark as general plant consumption
- Persist mappings for future imports

### 8. Processing Implementation (TODO)

#### Server-Side API (`/api/diesel/process-plant-batch`)
```typescript
async function processPlantBatch(batch: PlantBatch, meterPrefs: MeterReconciliationPreferences) {
  // 1. Stage data
  await insertIntoStaging(batch.rows)
  
  // 2. Resolve references
  const plantId = await resolvePlant(batch.plant_code)
  const warehouseId = await resolveWarehouse(plantId, batch.warehouse_number)
  
  // 3. Resolve assets
  for (const assetCode of batch.unique_assets) {
    const resolved = await resolveAsset(assetCode, plantId)
    if (!resolved) {
      // Check mappings table
      // If still unmapped, mark for manual mapping
    }
  }
  
  // 4. Check meter conflicts
  const conflicts = []
  for (const reading of batch.meter_readings) {
    const currentReading = await getLatestChecklistReading(reading.asset_code)
    if (shouldPrompt(reading, currentReading, meterPrefs)) {
      conflicts.push(buildConflict(reading, currentReading))
    }
  }
  
  if (conflicts.length > 0) {
    return { status: 'needs_meter_resolution', conflicts }
  }
  
  // 5. Recompute inventory
  const recomputed = recomputeInventory(batch.rows, batch.initial_inventory)
  if (Math.abs(recomputed - batch.final_inventory_provided) > 2) {
    // Log discrepancy warning
  }
  
  // 6. Insert transactions
  await insertTransactions(batch.rows)
  
  // 7. Update inventories
  await updateWarehouseInventory(warehouseId, recomputed)
  
  // 8. Optionally update meter readings (based on user decisions)
  if (meterPrefs.default_action === 'use_diesel_if_newer') {
    await updateAssetMeterReadings(batch.meter_readings)
  }
  
  // 9. Return summary
  return {
    status: 'completed',
    processed: batch.total_rows,
    transactions_created: batch.rows.filter(r => r.processing_status === 'processed').length,
    inventory_updated: true,
    meter_readings_updated: meterReadingsUpdatedCount
  }
}
```

---

## 📊 Database Schema (Recommended)

### New Tables Needed

```sql
-- Store meter readings from diesel transactions
CREATE TABLE diesel_asset_meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id),
  plant_id UUID REFERENCES plants(id),
  
  reading_date DATE NOT NULL,
  reading_time TIME,
  reading_source TEXT DEFAULT 'diesel_transaction',
  
  horometer_reading NUMERIC(10,2),
  horometer_delta NUMERIC(10,2),
  horometer_daily_avg NUMERIC(10,2),
  
  kilometer_reading NUMERIC(10,2),
  kilometer_delta NUMERIC(10,2),
  kilometer_daily_avg NUMERIC(10,2),
  
  fuel_consumed_liters NUMERIC(10,2),
  fuel_efficiency_per_hour NUMERIC(10,2),
  fuel_efficiency_per_km NUMERIC(10,2),
  
  diesel_transaction_id UUID REFERENCES diesel_transactions(id),
  operator_id UUID REFERENCES profiles(id),
  
  validation_status TEXT DEFAULT 'valid',
  validation_flags JSONB,
  is_anomaly BOOLEAN DEFAULT FALSE,
  
  days_since_last_reading INTEGER,
  previous_reading_id UUID REFERENCES diesel_asset_meter_readings(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_asset_reading UNIQUE(asset_id, reading_date, reading_time)
);

-- Store persistent asset mappings (for future imports)
CREATE TABLE diesel_asset_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES plants(id),
  
  original_asset_code TEXT NOT NULL, -- From Smartsheet
  mapped_asset_id UUID REFERENCES assets(id),
  mapping_type TEXT, -- 'formal', 'exception', 'general'
  exception_asset_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT unique_plant_asset_code UNIQUE(plant_id, original_asset_code)
);

-- Track import batches and history
CREATE TABLE diesel_import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL,
  plant_id UUID REFERENCES plants(id),
  warehouse_id UUID REFERENCES diesel_warehouses(id),
  
  original_filename TEXT,
  total_rows INTEGER,
  processed_rows INTEGER,
  error_rows INTEGER,
  
  initial_inventory NUMERIC(10,2),
  final_inventory_computed NUMERIC(10,2),
  final_inventory_provided NUMERIC(10,2),
  inventory_discrepancy NUMERIC(10,2),
  
  meter_readings_imported INTEGER,
  meter_conflicts_resolved INTEGER,
  
  processing_summary JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ
);
```

---

## 🎯 Key Features Implemented

### ✅ Robust Header Mapping
- Normalizes diacritics (Horómetro → horometro)
- Case-insensitive matching
- Fuzzy contains matching
- Handles Smartsheet variations

### ✅ Movement Classification
- Detects inventory openings vs fuel receipts vs consumptions
- Flags adjustments based on patterns
- Identifies unmapped assets requiring attention

### ✅ Meter Reading Extraction
- Captures horometer & kilometer per asset
- Computes deltas between readings
- Validates daily usage (flags >20 hr/day, errors on >24 hr/day)
- Calculates fuel efficiency
- Detects anomalies (negative deltas, zero change with fuel)

### ✅ Inventory Reconciliation
- Recomputes running balance from transactions
- Compares against Smartsheet-provided inventory
- Flags discrepancies >2L as warnings

### ✅ Per-Plant Batching
- Separates multi-plant files automatically
- Processes each plant independently
- Maintains audit trail per batch

---

## 🔐 Critical Design Decisions

### 1. Checklist is Primary Source of Truth
- Diesel meter readings are **supplementary**
- During migration, **prompt user** before overwriting checklist data
- Store diesel readings in separate table for audit
- Allow user to choose conflict resolution strategy

### 2. Asset Mapping Persistence
- Store mappings in `diesel_asset_mappings` table
- Future imports auto-resolve based on saved mappings
- Per-plant mapping context (same asset code may differ across plants)

### 3. Adjustment Detection
- Use pattern recognition (validation discrepancies, round numbers, empty units)
- Flag for review rather than auto-categorizing
- Preserve original Smartsheet data for audit

### 4. Inventory Validation
- Recompute from scratch (don't trust Smartsheet formulas blindly)
- Compare recomputed vs provided
- Log discrepancies but proceed with import
- Allow reconciliation reports post-import

---

## 📈 Performance Considerations

- **Client-side parsing**: Fast for files <10MB, use Web Workers for larger
- **Batch grouping**: O(n) complexity, efficient for thousands of rows
- **Meter delta computation**: O(n log n) per asset (sorting), acceptable for typical datasets
- **Server-side staging**: Batch insert 100-500 rows at a time
- **Transaction safety**: Use database transactions, rollback on errors

---

## 🧪 Testing Strategy

### Unit Tests (Recommended)
- `parseSmartsheetDate()`: Various date formats
- `classifyMovement()`: All movement categories
- `computeMeterDeltas()`: Edge cases (negatives, zeros, large jumps)
- `groupIntoPlantBatches()`: Multi-plant files

### Integration Tests
- Upload sample file (20 rows)
- Verify plant batches created
- Check inventory reconciliation
- Validate meter reading extraction
- Ensure no data loss

### User Acceptance Testing
1. Upload "planta 1 incompleto.csv"
2. Verify preview shows:
   - 1 plant batch (P1-6)
   - 19 rows
   - 250L inventory discrepancy flagged
   - CR-20 flagged for high usage
3. Proceed to mapping tab
4. Verify meter reconciliation prompt (if checklist data exists)
5. Complete processing
6. Verify transactions created
7. Check diesel_asset_meter_readings table populated

---

## 📝 Next Immediate Steps

1. ✅ Types updated
2. ✅ Parser implemented
3. ✅ Store enhanced
4. ✅ ExcelUploader updated
5. ⏳ Update DieselPreview to show plant batches
6. ⏳ Create MeterReconciliationDialog component
7. ⏳ Implement server-side processing API
8. ⏳ Update MappingTab for plant batch context
9. ⏳ Update ProcessingTab with meter conflict handling
10. ⏳ Create database migrations for new tables
11. ⏳ Add meter reading query views for maintenance team

**Status**: Phase 1 Complete (parsing + batching). Ready to proceed with UI enhancements and server-side processing.
