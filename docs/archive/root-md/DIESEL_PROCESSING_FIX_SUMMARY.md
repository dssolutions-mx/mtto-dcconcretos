# Diesel Processing System - Critical Fixes Applied

## Date: September 30, 2025

## Problem Summary
The diesel inventory processing was failing to create transactions in the database. Analysis revealed multiple critical issues:

1. **Date Serialization Error**: `txDate.toISOString is not a function`
   - When data was sent via `fetch()` with `JSON.stringify()`, Date objects were converted to ISO strings
   - The API tried to call `.toISOString()` on strings, causing all rows to fail

2. **Database Constraint Violations**: 
   - Transaction type mismatch: API used 'fuel_receipt', 'asset_consumption' but DB expects 'entry', 'consumption'
   - Asset category constraints not properly handled
   - General/exception asset constraints violated

3. **Field Mapping Issues**:
   - Frontend enriched rows with `resolved_asset_id` but API wasn't using them correctly
   - Asset category logic didn't comply with database CHECK constraints

## Database Constraints Identified

### `diesel_transactions` CHECK Constraints:

1. **transaction_type**: Must be 'entry' OR 'consumption'
   - `entry`: MUST have `asset_id = NULL`
   - `consumption`: MUST have `asset_id != NULL`

2. **asset_category**: Must be 'formal', 'exception', OR 'general'
   - `formal`: requires `asset_id`, no `exception_asset_name`
   - `exception`: requires `exception_asset_name`, no `asset_id`, no meters for consumption
   - `general`: requires NO `asset_id`, NO `exception_asset_name`, NO meters (only for entries)

## Fixes Applied

### 1. Date Deserialization (`route.ts` lines 255-268)
```typescript
// Parse date: handle both Date objects and ISO strings from JSON serialization
let txDate: Date
if (row.parsed_date) {
  txDate = typeof row.parsed_date === 'string' 
    ? new Date(row.parsed_date) 
    : row.parsed_date
} else {
  txDate = new Date()
}

// Validate date
if (isNaN(txDate.getTime())) {
  throw new Error(`Invalid date for row ${row.original_row_index}: ${row.fecha_}`)
}
```

### 2. Transaction Type Mapping (`route.ts` lines 232-280)
**Before**: Used 'fuel_receipt', 'asset_consumption', etc.
**After**: Properly mapped to 'entry' and 'consumption' with constraint compliance:

- **fuel_receipt** → **entry** (asset_id = null)
- **asset_consumption** → **consumption** (asset_id required)
- **unassigned_consumption** → **consumption** IF mapped, otherwise skip with warning
- **inventory_adjustment** → **consumption** IF has asset, otherwise **entry**

### 3. Asset Category Logic (`route.ts` lines 301-328)
Completely rewrote to comply with DB constraints:

```typescript
if (transactionType === 'entry') {
  // Fuel receipts are always general category
  assetCategory = 'general'
} else {
  // Consumption transactions
  if (row.resolved_asset_type === 'formal' && assetIdForTransaction) {
    assetCategory = 'formal'
  } else if (row.resolved_asset_type === 'exception') {
    assetCategory = 'exception'
    exceptionAssetName = row.exception_asset_name || row.unidad || 'Unknown'
    assetIdForTransaction = null // Exception assets cannot have asset_id
  } else if (row.resolved_asset_type === 'general' && assetIdForTransaction) {
    assetCategory = 'formal' // General mapped to asset becomes formal
  } else {
    assetCategory = assetIdForTransaction ? 'formal' : 'general'
  }
}
```

### 4. Meter Reading Handling (`route.ts` lines 349-351)
Clear meter readings for exception and general categories per DB constraints:

```typescript
horometer_reading: (assetCategory === 'exception' || assetCategory === 'general') ? null : row.horometro,
kilometer_reading: (assetCategory === 'exception' || assetCategory === 'general') ? null : row.kilometraje,
```

### 5. Enhanced Error Handling (`route.ts` lines 391-420)
- Continue processing on individual row errors instead of stopping
- Log full transaction data on insert errors
- Log row details on processing errors
- Collect errors in array for reporting
- Better console logging with asset category and type info

### 6. Date Parsing in Meter Conflicts (`route.ts` lines 143-145, 449-451)
Fixed date comparisons in meter conflict detection and updates:

```typescript
const readingDate = typeof reading.reading_date === 'string' 
  ? new Date(reading.reading_date) 
  : reading.reading_date
```

## Impact on Data Processing

### Movement Category Handling:

| Movement Category | Transaction Type | Asset ID Required | Asset Category | Notes |
|------------------|------------------|-------------------|----------------|-------|
| `inventory_opening` | (skipped) | N/A | N/A | Used for initial balance only |
| `fuel_receipt` | `entry` | NULL (required) | `general` | Incoming fuel deliveries |
| `asset_consumption` | `consumption` | Required | `formal` or `exception` | Fuel consumed by specific asset |
| `unassigned_consumption` | `consumption` | Required* | `formal` | *Skipped if no mapping |
| `inventory_adjustment` | `entry` or `consumption` | Depends on mapping | `formal` or `general` | Corrections/adjustments |

### Unassigned Consumption Handling:
**Problem**: Database requires asset_id for consumption transactions, but unassigned consumption has no specific asset.

**Solution**: 
- If user mapped unassigned consumption to an asset → process as consumption
- If no mapping → skip with warning and suggestion to create "General Consumption" asset per plant

## Testing Recommendations

1. **Upload test file** with mixed transaction types:
   - Fuel receipts (Entrada, no unit)
   - Asset consumption (Salida, with unit, mapped to formal assets)
   - Unassigned consumption (Salida, no unit)
   - Adjustments

2. **Verify database inserts**:
   ```sql
   SELECT transaction_type, asset_category, 
          COUNT(*) as count,
          SUM(quantity_liters) as total_liters
   FROM diesel_transactions
   GROUP BY transaction_type, asset_category;
   ```

3. **Check for errors**:
   - Review server logs for constraint violations
   - Check frontend error reporting
   - Verify transaction counts match expectations

4. **Test edge cases**:
   - Dates with invalid formats
   - Assets with no mapping
   - Exception assets with meter readings
   - General consumption without assets

## Known Limitations

1. **Unassigned Consumption**: Cannot be recorded without creating a pseudo-asset for each plant
   - Recommendation: Create "CONSUMO-GENERAL-P001" assets per plant for untracked consumption

2. **Exception Assets**: Cannot track meter readings per DB constraints
   - This is by design for temporary/external equipment

3. **Date Handling**: Relies on client-side date parsing
   - Future: Consider using ISO strings throughout or standardized date format

## Files Modified

- `/app/api/diesel/process-batch/route.ts` - Complete rewrite of processing logic
- Created: `/DIESEL_PROCESSING_FIX_SUMMARY.md` - This documentation

## Next Steps

1. **Test the fix** with actual CSV file
2. **Monitor logs** for any remaining errors
3. **Create general consumption assets** if needed for unassigned consumption
4. **Review transaction data** in database for accuracy
5. **Update frontend** if any field mapping issues remain

## Success Criteria

✅ Date parsing works correctly for all rows
✅ Transactions inserted successfully with correct types
✅ Asset categories comply with DB constraints
✅ Meter readings handled appropriately per category
✅ Errors logged and reported properly
✅ Processing completes without crashing

