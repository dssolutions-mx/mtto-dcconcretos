# Diesel Control Excel Import - Main Guidelines

## **Overview**
You have an Excel file "Control de Diese4l.xlsx" with 1,885 rows of diesel transaction data that needs to be imported into your Supabase "mantenimiento" database. The file contains both inventory transactions (Entrada/Salida) with complex data relationships.

## **Excel File Structure Analysis**

### **Headers (18 columns A-R):**
1. **Creado** (A) - Creation timestamp 
2. **Planta** (B) - Plant code (P1, P3, P4)
3. **CLAVE DE PRODUCTO** (C) - Product code (07DS01)
4. **Almacen** (D) - Warehouse number
5. **Tipo** (E) - Transaction type (Entrada/Salida)
6. **Unidad** (F) - Asset/Unit identifier 
7. **Identificador** (G) - Transaction identifier
8. **Fecha_** (H) - Transaction date
9. **Horario** (I) - Scheduled time
10. **Horómetro** (J) - Horometer reading
11. **Kilometraje** (K) - Kilometer reading  
12. **Litros (Cantidad)** (L) - Quantity in liters
13. **Cuenta litros** (M) - Liter counter/meter reading
14. **Responsable de unidad** (N) - Unit responsible person
15. **Responsable de suministro** (O) - Supply responsible person
16. **Validación** (P) - Validation number/code
17. **INVENTARIO INICIAL** (Q) - Initial inventory
18. **Inventario** (R) - Final inventory

### **Key Data Patterns:**
- **Total Records**: 1,885 rows (including header)
- **Transaction Types**: "Entrada" (incoming), "Salida" (outgoing)
- **Plant Codes**: P1, P3, P4
- **Product Code**: Primarily 07DS01 (diesel)
- **Data Quality**: ~97% filled for critical fields (Litros, Cuenta litros)

## **Database Schema Mapping**

### **Target Table: `diesel_transactions`**
Your existing table has these key fields that map to Excel columns:

| Excel Column | Database Field | Type | Notes |
|-------------|----------------|------|-------|
| Creado (A) | created_at | timestamptz | Import timestamp |
| Planta (B) | plant_id | uuid | Need plant lookup |
| Almacen (D) | warehouse_id | uuid | Need warehouse lookup |
| Tipo (E) | transaction_type | text | Direct mapping |
| Unidad (F) | asset_id | uuid | Asset lookup (nullable) |
| Identificador (G) | transaction_id | text | Unique identifier |
| Fecha_ (H) | transaction_date | timestamptz | Transaction date |
| Horario (I) | scheduled_time | time | Schedule time |
| Horómetro (J) | horometer_reading | integer | Current reading |
| Kilometraje (K) | kilometer_reading | integer | Current reading |
| Litros (L) | quantity_liters | numeric | Quantity |
| Cuenta litros (M) | cuenta_litros | numeric | Meter reading |
| Responsable unidad (N) | operator_id | uuid | Operator lookup |
| Responsable suministro (O) | supplier_responsible | text | Direct text |
| Validación (P) | validation_notes | text | Convert to text |

### **Staging Table: `diesel_excel_staging`**
Use this for initial data loading and validation before final import.

## **Import Workflow Strategy**

### **Phase 1: Data Staging**
1. **Load Excel to Staging Table**
   - Use `diesel_excel_staging` table for raw data import
   - Map all Excel columns to staging columns
   - Preserve original data types and formats
   - Add `import_batch_id` for tracking

2. **Data Validation & Cleansing**
   - Validate date formats and ranges
   - Check for duplicate transaction IDs
   - Validate plant codes against `plants` table
   - Validate warehouse numbers against `diesel_warehouses`
   - Handle missing/null values appropriately

### **Phase 2: Reference Data Resolution**
1. **Plant ID Lookup**
   ```sql
   UPDATE diesel_excel_staging SET plant_uuid = (
     SELECT id FROM plants WHERE code = staging.planta
   )
   ```

2. **Warehouse ID Resolution**
   ```sql
   UPDATE diesel_excel_staging SET warehouse_uuid = (
     SELECT id FROM diesel_warehouses 
     WHERE plant_id = staging.plant_uuid 
     AND warehouse_number = staging.almacen::integer
   )
   ```

3. **Asset ID Resolution** (Optional - many may be null)
   ```sql
   UPDATE diesel_excel_staging SET asset_uuid = (
     SELECT id FROM assets WHERE asset_id = staging.unidad
   )
   ```

4. **Operator ID Resolution**
   ```sql
   UPDATE diesel_excel_staging SET operator_uuid = (
     SELECT id FROM profiles 
     WHERE LOWER(nombre) = LOWER(staging.responsable_unidad)
   )
   ```

### **Phase 3: Business Logic Processing**

1. **Transaction Type Classification**
   - "Entrada" → "incoming" 
   - "Salida" → "outgoing"
   - Add `asset_category` based on asset type or default

2. **Calculate Previous Readings**
   - For horometer: Find previous reading for same asset
   - For kilometers: Find previous reading for same asset
   - Set `previous_horometer` and `previous_kilometer`

3. **Handle Inventory Transactions**
   - Process initial inventory entries first
   - Calculate running inventory balances
   - Validate inventory consistency

### **Phase 4: Final Import**
```sql
INSERT INTO diesel_transactions (
  transaction_id, plant_id, warehouse_id, asset_id,
  product_id, transaction_type, quantity_liters,
  horometer_reading, kilometer_reading,
  operator_id, supplier_responsible,
  transaction_date, scheduled_time,
  cuenta_litros, validation_notes,
  created_by, source_system, import_batch_id
) 
SELECT 
  identificador,
  plant_uuid,
  warehouse_uuid, 
  asset_uuid,
  (SELECT id FROM diesel_products WHERE code = '07DS01'),
  CASE tipo WHEN 'Entrada' THEN 'incoming' ELSE 'outgoing' END,
  litros_cantidad,
  horometro,
  kilometraje,
  operator_uuid,
  responsable_suministro,
  fecha_,
  horario,
  cuenta_litros,
  validacion::text,
  (SELECT id FROM auth.users LIMIT 1), -- Import user
  'excel_import',
  import_batch_id
FROM diesel_excel_staging 
WHERE processed = false;
```

## **Critical Implementation Guidelines**

### **1. Data Integrity**
- **NEVER** import without staging validation
- **ALWAYS** check for duplicate transaction_ids
- **VALIDATE** all foreign key references before import
- **PRESERVE** original Excel data in staging for audit

### **2. Error Handling**
- Track failed imports with detailed error messages
- Use transactions to rollback on failures
- Log all import steps with timestamps
- Provide detailed import summary reports

### **3. Performance Optimization**
- Process in batches of 100-500 records
- Use bulk INSERT operations where possible
- Index staging table on key lookup fields
- Clear processed records periodically

### **4. Workflow Automation**
```javascript
// Recommended parser structure
class DieselExcelParser {
  async parseFile(file) {
    // 1. Read Excel file
    // 2. Validate structure 
    // 3. Stage raw data
    // 4. Resolve references
    // 5. Apply business logic
    // 6. Import to final table
    // 7. Generate report
  }
}
```

### **5. Validation Rules**
- **Transaction ID**: Must be unique across imports
- **Dates**: Must be valid and within reasonable range
- **Quantities**: Must be positive for valid transactions
- **Plant Codes**: Must exist in plants table
- **Warehouses**: Must exist for specified plant

### **6. Edge Cases**
- Handle missing asset IDs (many transactions are inventory-only)
- Process "Entrada" transactions without consumption data
- Handle timezone conversion for dates
- Deal with Excel formatting inconsistencies

## **Next Steps**
1. Create the Excel parser using SheetJS
2. Implement staging table insert logic
3. Build reference resolution functions
4. Create validation and import procedures
5. Add comprehensive error reporting
6. Test with subset of data first

This workflow ensures data integrity, provides audit trails, and handles the complexity of your diesel transaction data systematically.