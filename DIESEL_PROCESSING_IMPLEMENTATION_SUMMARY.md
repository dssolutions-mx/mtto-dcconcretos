# Diesel Inventory Processing Implementation Summary

## Overview
This document summarizes the implementation of the diesel inventory processing system, which handles migration of historical Smartsheet data into a structured multi-table database schema.

## Processing Flow

### 1. File Upload & Parsing (`ExcelUploader.tsx`)
- Accepts CSV/XLSX files from Smartsheet exports
- Parses and normalizes data using `xlsx` library
- Classifies each row into movement categories:
  - `inventory_opening`: Initial inventory balance row
  - `fuel_receipt`: Incoming fuel deliveries (Entrada without unit)
  - `asset_consumption`: Fuel consumed by specific assets (Salida with unit)
  - `unassigned_consumption`: Exits without assigned unit
  - `inventory_adjustment`: Manual corrections/adjustments
- Groups rows into **Plant Batches** by `planta` and `almacen`
- Extracts meter readings (horometer/kilometer) with delta calculations
- Stores parsed data in Zustand store

### 2. Data Preview (`DieselPreviewEnhanced.tsx`)
- Displays comprehensive batch statistics
- Shows inventory reconciliation (computed vs. provided)
- Lists unique assets with fuel consumption totals
- Displays meter reading history per asset with validation warnings
- Highlights unmapped assets and unassigned consumptions

### 3. Asset Mapping (`MappingTab.tsx` & `AssetMapper.tsx`)
- **Loads formal assets** from database (now with simplified query to avoid 400 errors)
- **Manual search & assignment**: Users can search all assets and select mappings
- **Auto-detection of adjustments**: Automatically classifies inventory adjustment entries as "general" category
- **Mapping decisions** stored in `pendingMappings` (Map<string, AssetResolution>)
- **Three resolution types**:
  - `formal`: Maps to an existing formal asset in the system
  - `exception`: Creates a new exception asset (external/temporary)
  - `general`: General plant consumption (no specific asset)
  - `unmapped`: User chose to skip (will be flagged in processing)

### 4. Processing (`ProcessingTab.tsx`)
**What happens when you click "Iniciar Procesamiento":**

1. **Validation Step**
   - Confirms parsed data exists
   - Verifies plant batch is selected
   - Checks that pending mappings are available

2. **Enrichment Step**
   - Applies asset mappings to plant batch rows
   - Adds `resolved_asset_id`, `resolved_asset_name`, `resolved_asset_type` to each row
   - Prepares data payload for server API

3. **API Call** (`/api/diesel/process-batch`)
   - Sends enriched plant batch to server
   - Includes meter preferences and resolutions
   - Includes asset mapping decisions

4. **Server-Side Processing** (route.ts)
   - **Resolves plant and warehouse** from codes
   - **Checks for meter conflicts** with checklist data
   - **Processes rows by movement category**:
     - **Inventory Opening**: Skipped (used only for initial balance)
     - **Fuel Receipt**: Creates incoming transaction (no asset)
     - **Asset Consumption**: Creates outgoing transaction linked to asset
     - **Unassigned Consumption**: Creates general consumption transaction
     - **Inventory Adjustment**: Creates adjustment transaction
   - **Updates asset meters** (if user chose "use_diesel" resolution)
   - **Returns summary** with transaction counts by type

5. **Completion**
   - Displays success message with statistics
   - Shows transactions by type
   - Provides option to export report or start new import

## Key Data Structures

### DieselExcelRow
Enhanced row with:
- Raw CSV fields (planta, almacen, tipo, unidad, etc.)
- `movement_category`: Classified movement type
- `requires_asset_mapping`: Boolean flag
- `resolved_asset_id`: Applied from pendingMappings
- `meter_reading`: Extracted horometer/kilometer data
- `validation_status`: 'valid' | 'warning' | 'error'

### PlantBatch
Per-plant/warehouse grouping:
- `batch_id`: Unique identifier
- `plant_code`, `warehouse_number`: Location identifiers
- `rows`: Array of DieselExcelRow
- `initial_inventory`: From inventory_opening row
- `final_inventory_computed`: Recalculated balance
- `inventory_discrepancy`: Difference from Smartsheet
- `unique_assets`: List of all assets in batch
- `unmapped_assets`: Assets needing mapping
- `meter_readings`: Extracted meter data

### AssetResolution
Mapping decision:
- `original_name`: Legacy asset name from Smartsheet
- `resolution_type`: 'formal' | 'exception' | 'general' | 'unmapped'
- `asset_id`: UUID of formal asset (if formal)
- `asset_name`: Display name
- `confidence`: Matching confidence score
- `mapping_notes`: User notes

## Recent Fixes

### Fix 1: Asset Query 400 Error
**Problem**: Complex nested Supabase select was rejected with 400 Bad Request
**Solution**: Simplified query to select only direct columns from `assets` table, removed nested relations

### Fix 2: Processing Button Not Working
**Problem**: Clicking "Iniciar Procesamiento" did nothing
**Root Causes Addressed**:
1. **Missing data enrichment**: Rows weren't being enriched with mapping resolutions before sending to API
2. **Field mismatch**: ProcessingTab referenced `asset_category` which didn't exist in AssetResolution (should be `resolution_type`)
3. **No console logging**: Hard to debug what was happening

**Solutions**:
1. Added enrichment step that applies pendingMappings to plant batch rows before API call
2. Updated field references to use correct property names
3. Added comprehensive console.log statements for debugging
4. Fixed API route to properly handle movement categories and create appropriate transaction types

## Debug Information
The system now logs:
- Start of processing with all relevant state
- Current plant batch details
- Number of mappings applied
- Rows sent to server
- Server-side processing by movement category
- Transaction counts by type
- Any errors encountered

Check browser console and server logs for detailed processing information.

## Database Schema (To Be Created)
The following tables are referenced but not yet created (INSERT statements are commented out):

### `diesel_transactions`
- `plant_id`, `warehouse_id`
- `transaction_type`: 'fuel_receipt' | 'asset_consumption' | 'general_consumption' | 'adjustment'
- `movement_direction`: 'in' | 'out'
- `quantity_liters`, `transaction_date`, `transaction_time`
- `asset_id` (nullable)
- `horometer_reading`, `kilometer_reading`
- `operator_name`, `supplier_responsible`
- `validation_notes`, `smartsheet_identifier`
- `source_system`, `import_batch_id`, `original_row_number`
- `created_by`, `created_at`

### `diesel_warehouses`
- `id`, `plant_id`, `warehouse_number`
- `name`, `capacity_liters`, `status`

### `diesel_import_history`
- `batch_id`, `plant_id`, `warehouse_id`
- `original_filename`, `total_rows`, `processed_rows`, `error_rows`
- `initial_inventory`, `final_inventory_computed`, `final_inventory_provided`, `inventory_discrepancy`
- `meter_readings_imported`, `meter_conflicts_resolved`
- `processing_summary` (JSON)
- `created_by`, `created_at`

## Next Steps

1. **Test the processing flow**
   - Upload sample CSV
   - Complete asset mapping
   - Click "Iniciar Procesamiento"
   - Check console logs for processing details

2. **Create database tables**
   - Run migrations for diesel tables
   - Uncomment INSERT statements in API route

3. **Implement meter conflict dialog**
   - Already built, just needs testing with real conflicts

4. **Add export functionality**
   - Generate processing report
   - Export transaction details

## User Workflow
1. Navigate to Diesel Inventory → Migration
2. Upload CSV file from Smartsheet
3. Review parsed data and batch statistics
4. Map assets (formal/exception/general)
5. Click "Iniciar Procesamiento"
6. Review results and export report

## Notes
- Checklists remain the primary source for asset meter readings
- Diesel data provides a secondary historical track record
- Users decide how to handle meter conflicts (use diesel vs. keep checklist)
- Inventory discrepancies are flagged but don't block processing
- All data is preserved with source references for auditability

