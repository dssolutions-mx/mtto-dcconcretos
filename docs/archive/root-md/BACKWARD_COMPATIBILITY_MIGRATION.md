# Backward Compatibility & Legacy Quotation Migration

## Overview

This document describes the backward compatibility implementation for the new multi-vendor quotation system and the migration of legacy purchase orders with quotations in the old format.

---

## Problem Statement

**Legacy Format:**
- `quotation_url` (TEXT) - Single quotation file URL
- `quotation_urls` (JSONB array) - Multiple quotation file URLs

**New Format:**
- `purchase_order_quotations` table - Structured quotation data with supplier, pricing, terms, status

**Challenge:**
Existing POs in `pending_approval` status with legacy quotations would fail validation if we only checked the new table.

---

## Solution: Dual-System Support

### 1. Backward Compatible Validation

The `validate_po_status()` function now checks **both** systems:

```sql
-- Check for legacy quotations
IF (NEW.quotation_url IS NOT NULL AND trim(NEW.quotation_url) != '') 
   OR (NEW.quotation_urls IS NOT NULL AND jsonb_array_length(NEW.quotation_urls) > 0) THEN
  v_has_legacy_quotation := true;
END IF;

-- Validation: Require selected quotation OR legacy quotation
WHEN 'approved' THEN
  IF v_selected_count = 0 AND NOT v_has_legacy_quotation THEN
    RAISE EXCEPTION 'Cannot approve: quotation is required but not selected';
  END IF;
```

### 2. has_quotations() Function

Updated to check both systems with fallback:

```sql
CREATE OR REPLACE FUNCTION has_quotations(p_purchase_order_id uuid)
RETURNS boolean AS $$
DECLARE
  v_count integer;
  v_quotation_url text;
  v_quotation_urls jsonb;
BEGIN
  -- First, check new purchase_order_quotations table
  SELECT COUNT(*) INTO v_count
  FROM purchase_order_quotations
  WHERE purchase_order_id = p_purchase_order_id;
  
  IF v_count > 0 THEN
    RETURN true;
  END IF;
  
  -- Fallback: Check legacy fields
  SELECT quotation_url, quotation_urls INTO v_quotation_url, v_quotation_urls
  FROM purchase_orders
  WHERE id = p_purchase_order_id;
  
  IF v_quotation_url IS NOT NULL AND trim(v_quotation_url) != '' THEN
    RETURN true;
  END IF;
  
  IF v_quotation_urls IS NOT NULL AND jsonb_array_length(v_quotation_urls) > 0 THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;
```

---

## Migration Functions

### migrate_legacy_quotation(po_id)

Migrates a single PO from legacy format to new table.

**Behavior:**
- Converts `quotation_url` → 1 entry in `purchase_order_quotations`
- Converts `quotation_urls` array → N entries (one per URL)
- Sets `status = 'selected'` (already approved/used)
- Links first quotation via `selected_quotation_id`
- Safe to run multiple times (checks if already migrated)

**Example:**
```sql
SELECT migrate_legacy_quotation('c56bbc6d-8e23-43bf-ae8e-cd24b59b2bf5');
-- Result: {"success": true, "migrated_count": 1, "order_id": "PO-844927-FHQ"}
```

### migrate_all_legacy_quotations(limit)

Batch migrates multiple legacy POs.

**Behavior:**
- Processes up to `limit` POs
- Returns detailed results for each
- Handles errors gracefully per-PO
- Can be run multiple times safely

**Example:**
```sql
SELECT migrate_all_legacy_quotations(100);
-- Result: {"success": true, "total_processed": 84, "success_count": 84, "error_count": 0}
```

---

## Migration Results

### Execution Summary

**Migration Run 1:**
- POs processed: 20
- Success: 20
- Errors: 0

**Migration Run 2:**
- POs processed: 84
- Success: 84
- Errors: 0

**Total Legacy POs Migrated: 104**

### Migration Details

Most POs had 1 quotation (from `quotation_urls` array). Some had multiple:
- `PO-271752-82K`: 3 quotations
- `PO-979609-3QU`: 2 quotations
- `PO-333928-E1M`: 2 quotations
- `PO-744518-F65`: 2 quotations
- `PO-292367-FD5`: 2 quotations

---

## Status of Legacy POs After Migration

All migrated POs now have:
- ✅ Entries in `purchase_order_quotations` table
- ✅ `status = 'selected'` (since they were already approved)
- ✅ `selected_quotation_id` linked to first quotation
- ✅ Full backward compatibility maintained

---

## Key Benefits

### 1. Zero Downtime
- No changes required to existing POs
- Legacy POs continue to function
- Gradual migration approach

### 2. No Breaking Changes
- Existing approved POs remain valid
- Validation works for both formats
- Email functions check both systems

### 3. Data Integrity
- Migration is idempotent (safe to re-run)
- Per-PO error handling
- Detailed audit trail in migration results

### 4. Future-Proof
- New POs use only new table
- Legacy fields remain for historical reference
- Can be deprecated gradually

---

## Testing

### Test Cases

#### TC1: Legacy PO with single quotation_url
- ✅ Passes validation
- ✅ Can be approved
- ✅ Successfully migrated

#### TC2: Legacy PO with multiple quotation_urls
- ✅ Passes validation
- ✅ Can be approved
- ✅ All quotations migrated as separate entries

#### TC3: New PO with quotations in new table
- ✅ Passes validation
- ✅ Requires selected quotation for approval
- ✅ No legacy fields needed

#### TC4: Mixed scenario (old + new POs)
- ✅ Both systems coexist
- ✅ No conflicts
- ✅ All validations pass

---

## Database Functions Modified

### validate_po_status()
**Changes:**
- Added `v_has_legacy_quotation` flag
- Check legacy fields before raising exception
- Backward compatible for `pending_approval` and `approved` statuses

**Migration:** `backward_compatibility_legacy_quotations.sql`

### has_quotations()
**Changes:**
- Check new table first
- Fallback to legacy fields
- Return true if either exists

**Migration:** `update_has_quotations_check_new_table.sql`

### auto_select_single_quotation()
**Changes:**
- Fixed UUID MAX() error
- Use `NEW.id` directly instead

**Migration:** `fix_uuid_max_in_triggers.sql`

### migrate_legacy_quotation()
**Changes:**
- Use `file_url` and `file_name` (not `quotation_url`)
- Fixed field mapping to match actual schema
- Added notes for audit trail

**Migration:** `fix_legacy_quotation_migration.sql`

---

## Monitoring & Maintenance

### Check Migration Status
```sql
-- Count remaining legacy POs
SELECT COUNT(*) as remaining_legacy_pos
FROM purchase_orders po
WHERE requires_quote = true
  AND (
    (quotation_url IS NOT NULL AND trim(quotation_url) != '')
    OR (quotation_urls IS NOT NULL AND jsonb_array_length(quotation_urls) > 0)
  )
  AND NOT EXISTS (
    SELECT 1 FROM purchase_order_quotations WHERE purchase_order_id = po.id
  );
```

### Verify Migrated POs
```sql
-- Check migrated POs
SELECT 
  po.order_id,
  po.total_amount,
  (SELECT COUNT(*) FROM purchase_order_quotations WHERE purchase_order_id = po.id) as quotation_count,
  (SELECT status FROM purchase_order_quotations WHERE purchase_order_id = po.id LIMIT 1) as quotation_status
FROM purchase_orders po
WHERE selected_quotation_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

---

## Rollback Plan

If issues arise, the legacy fields are still intact:

```sql
-- Revert to legacy-only validation (NOT RECOMMENDED)
CREATE OR REPLACE FUNCTION validate_po_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check legacy fields...
  -- (restore old function body)
END;
$$ LANGUAGE plpgsql;
```

**Note:** Rollback should be a last resort. The dual-system approach is designed to handle all edge cases safely.

---

## Future Considerations

### Deprecation Timeline

**Phase 1 (Current):** Dual system - both formats supported
**Phase 2 (3-6 months):** All POs migrated, new system only
**Phase 3 (6-12 months):** Remove legacy fields from schema

### Cleanup Script (Future)
```sql
-- After all POs migrated and validated:
ALTER TABLE purchase_orders 
  DROP COLUMN quotation_url,
  DROP COLUMN quotation_urls;
```

---

## Conclusion

The backward compatibility implementation ensures:
- ✅ **Zero disruption** to existing workflows
- ✅ **Safe migration** of legacy data
- ✅ **Dual system** support during transition
- ✅ **Future-proof** architecture
- ✅ **Complete audit trail** of all changes

All 104 legacy POs have been successfully migrated to the new quotation system while maintaining full backward compatibility.
