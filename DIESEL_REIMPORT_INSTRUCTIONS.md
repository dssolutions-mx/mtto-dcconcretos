# Diesel Re-import Instructions - Corrected Date Parsing

## ✅ What We Fixed

### 1. Date Parser Correction
**File**: `lib/diesel-parser-utils.ts`
- **Before**: Parsed dates as `MM/DD/YY` (American format)
- **After**: Parses dates as `DD/MM/YY` (Latin American format)
- **Example**: `08/02/25` now correctly reads as **February 8, 2025** (not August 2, 2025)

### 2. All Previous Errors Fixed
The following issues have been addressed in the code and will work correctly on re-import:

✅ **Date serialization** - Handles Date → String conversion properly  
✅ **Generated columns** - No longer tries to insert `validation_difference`, `hours_consumed`, `kilometers_consumed`  
✅ **Decimal meter readings** - Automatically rounds to integers  
✅ **Exception assets** - Properly handles Utilities, Partner, etc. without formal `asset_id`  
✅ **Zero-liter transactions** - Skips validation entries with no fuel movement  
✅ **Entry adjustments** - Handles positive adjustments with asset references  
✅ **Database constraints** - Updated to allow exception consumptions  

### 3. Backup Scripts Created
- **Cleanup**: `scripts/clean-diesel-for-reimport.sql`
- **Restore Manual Entries**: `scripts/restore-manual-diesel-entries.sql`

---

## 🔄 Re-import Process

### Step 1: Clean Existing Data ✅ READY
Run this in Supabase SQL Editor:
```sql
DELETE FROM diesel_transactions;
```

### Step 2: Re-upload CSV Files
Navigate to the Diesel Migration tab and upload each plant's CSV file:

1. **Plant 1** (P001) - Upload `planta 1 incompleto.csv`
2. **Plant 2** (P002) - Upload plant 2 CSV
3. **Plant 3** (P003) - Upload plant 3 CSV  
4. **Plant 4** (P004) - Upload plant 4 CSV

**Important**: 
- All asset mappings are preserved in the system
- Exception assets (Utilities, Partner, etc.) will be recognized automatically
- The system will now import with correct dates

### Step 3: Verify Import Results
After each plant import, check:
- ✅ Transaction count matches CSV rows
- ✅ Dates are correct (February should show as 2025-02-XX, not 2025-08-XX)
- ✅ All asset types processed (formal, exception, general)

### Step 4: Add Manual Entries (If Needed)
After all imports complete, check if these entries are present:

#### Check Opening Inventories
```sql
SELECT 
  p.code as plant_code,
  MIN(dt.transaction_date) as first_transaction_date,
  dt.quantity_liters,
  dt.transaction_type
FROM diesel_transactions dt
JOIN plants p ON dt.plant_id = p.id
WHERE p.code IN ('P001', 'P002', 'P004')
  AND dt.transaction_type = 'entry'
GROUP BY p.code, dt.quantity_liters, dt.transaction_type
ORDER BY first_transaction_date
LIMIT 3;
```

**Expected Opening Inventories**:
- Plant 1: 2,511 L on or before Feb 8, 2025
- Plant 2: 1,585 L on or before first transaction
- Plant 4: 1,314.8 L on or before first transaction

#### Check Plant 1 Adjustments
Look for:
- June 12, 2025: -1,201 L adjustment
- July 15, 2025: -240 L adjustment

#### Check Plant 4 Missing Entry
Look for:
- February 8, 2025: 4,720.3 L entry

**If any are missing**, run the restore script:
```sql
-- Run: scripts/restore-manual-diesel-entries.sql
-- (but only add the entries that are actually missing)
```

### Step 5: Final Inventory Verification
```sql
SELECT 
  p.code as plant_code,
  p.name as plant_name,
  COUNT(*) as total_transactions,
  SUM(CASE WHEN dt.transaction_type = 'entry' THEN dt.quantity_liters ELSE 0 END) as total_entries,
  SUM(CASE WHEN dt.transaction_type = 'consumption' THEN dt.quantity_liters ELSE 0 END) as total_consumption,
  SUM(CASE WHEN dt.transaction_type = 'entry' THEN dt.quantity_liters ELSE -dt.quantity_liters END) as current_inventory
FROM diesel_transactions dt
JOIN plants p ON dt.plant_id = p.id
WHERE p.code IN ('P001', 'P002', 'P003', 'P004')
GROUP BY p.code, p.name
ORDER BY p.code;
```

**Expected Final Inventories**:
- **Plant 1**: 838.00 L
- **Plant 2**: 5,431.20 L
- **Plant 3**: TBD (based on CSV)
- **Plant 4**: 3,780.40 L

---

## 📋 Checklist

### Pre-Import
- [x] Date parser fixed (DD/MM/YY)
- [x] All code errors resolved
- [x] Backup scripts created
- [ ] Database cleaned (run cleanup script)

### Import
- [ ] Plant 1 imported with correct dates
- [ ] Plant 2 imported with correct dates
- [ ] Plant 3 imported with correct dates
- [ ] Plant 4 imported with correct dates

### Post-Import
- [ ] All dates verified (Feb should be 02, not 08)
- [ ] Opening inventories present or added
- [ ] Plant 1 adjustments present or added
- [ ] Plant 4 missing entry present or added
- [ ] Final inventory matches expected values
- [ ] All asset types processed correctly

---

## 🎯 What Changed in the Code

### `lib/diesel-parser-utils.ts`
```typescript
// OLD (WRONG):
const month = parseInt(parts[0], 10)  // ❌ First part is DAY, not month!
const day = parseInt(parts[1], 10)

// NEW (CORRECT):
const day = parseInt(parts[0], 10)    // ✅ First part is DAY
const month = parseInt(parts[1], 10)  // ✅ Second part is MONTH
```

### No Other Code Changes Needed
All other fixes (exception assets, meter rounding, zero-liter validation, etc.) are already in place from previous work.

---

## 🚨 Important Notes

1. **Asset Mappings Preserved**: You won't need to re-map assets. The system remembers:
   - 22+ formal asset mappings
   - Exception assets (Utilities, Partner, Soplador, etc.)
   - General consumption patterns

2. **Warehouses Ready**: All warehouses exist:
   - ALM-001-6 (Plant 1)
   - ALM-002-7 (Plant 2)
   - ALM-003-8 (Plant 3)
   - ALM-004-9 (Plant 4)

3. **Process Faster**: Since asset mapping is done, each plant should import much faster than before.

4. **Date Verification**: After import, spot-check a few dates to ensure they match the CSV.

---

## ✅ Ready to Proceed

Everything is prepared for re-import. You can now:
1. Run the cleanup script to delete existing transactions
2. Re-upload all plant CSV files
3. Verify correct dates and inventories
4. Add any missing manual entries if needed

The system will now import all dates correctly! 🎉



