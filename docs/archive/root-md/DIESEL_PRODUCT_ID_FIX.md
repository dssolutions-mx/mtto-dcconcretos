# Diesel Product ID Foreign Key Constraint Fix

## Error Encountered

```
409 Conflict
insert or update on table "diesel_transactions" violates 
foreign key constraint "diesel_transactions_product_id_fkey"

Key is not present in table "diesel_products".
```

## Root Cause

The consumption form was using a **hardcoded fake product_id**:

```typescript
// WRONG ❌
product_id: '00000000-0000-0000-0000-000000000001'
```

This UUID doesn't exist in the `diesel_products` table.

---

## Solution

### 1. ✅ Found Real Product ID

Queried the database to find the actual diesel product:

```sql
SELECT id, product_code, name 
FROM diesel_products;

Result:
id: a780e0bc-d693-423e-889d-73a8e7e6d9fc
product_code: 07DS01
name: Diesel Convencional
```

### 2. ✅ Made Product ID Dynamic

Instead of hardcoding, the form now:
1. Loads product ID on mount
2. Searches for product code '07DS01' (the standard diesel)
3. Falls back to any diesel product if '07DS01' not found
4. Validates product ID before submission

**Implementation**:

```typescript
// New state
const [dieselProductId, setDieselProductId] = useState<string | null>(null)

// Load product on mount
const loadDieselProduct = async () => {
  try {
    // Try to get 07DS01 (standard diesel)
    const { data, error } = await supabase
      .from('diesel_products')
      .select('id')
      .eq('product_code', '07DS01')
      .single()

    if (error) {
      // Fallback: get any diesel product
      const { data: fallback } = await supabase
        .from('diesel_products')
        .select('id')
        .limit(1)
        .single()
      
      if (fallback) {
        setDieselProductId(fallback.id)
      }
    } else if (data) {
      setDieselProductId(data.id)
    }
  } catch (error) {
    console.error('Error loading diesel product:', error)
  }
}

// Validate before submission
if (!dieselProductId) {
  toast.error("Error: No se encontró el producto diesel")
  return
}

// Use real product ID
const transactionData = {
  ...
  product_id: dieselProductId,  // ✅ Real ID from database
  ...
}
```

---

## Benefits

### Before (BROKEN) ❌
- **Hardcoded fake ID**
- **409 Conflict error** on every submission
- **Cannot create transactions**
- **No error handling**

### After (WORKING) ✅
- **Dynamic product loading**
- **Uses real database ID**
- **Transactions work correctly**
- **Fallback if product code changes**
- **Validates before submission**

---

## Testing

### Test Scenario 1: Normal Case
```
1. Form loads
2. Product ID fetched: a780e0bc-d693-423e-889d-73a8e7e6d9fc
3. User fills form
4. Submit → Success ✅
```

### Test Scenario 2: Product Code Changed
```
1. Form loads
2. '07DS01' not found
3. Falls back to any diesel product
4. User fills form
5. Submit → Success ✅
```

### Test Scenario 3: No Products (Edge Case)
```
1. Form loads
2. No diesel products in database
3. dieselProductId remains null
4. User fills form
5. Submit → Error: "No se encontró el producto diesel" ⚠️
```

---

## Database Structure

### diesel_products Table

```sql
CREATE TABLE diesel_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Diesel',
  unit_of_measure TEXT NOT NULL DEFAULT 'liters',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Current data
INSERT INTO diesel_products (id, product_code, name)
VALUES (
  'a780e0bc-d693-423e-889d-73a8e7e6d9fc',
  '07DS01',
  'Diesel Convencional'
);
```

### diesel_transactions Foreign Key

```sql
ALTER TABLE diesel_transactions
ADD CONSTRAINT diesel_transactions_product_id_fkey
FOREIGN KEY (product_id) 
REFERENCES diesel_products(id);
```

This constraint **requires** a valid product_id from diesel_products table.

---

## Files Modified

1. **`components/diesel-inventory/consumption-entry-form.tsx`**
   - Added `dieselProductId` state
   - Added `loadDieselProduct()` function
   - Added validation before submission
   - Replaced hardcoded ID with dynamic ID

---

## Future Improvements

### 1. Product Selection (Optional)
If you have multiple diesel types (e.g., premium, conventional):

```typescript
// Add product selector to form
const [products, setProducts] = useState<any[]>([])
const [selectedProduct, setSelectedProduct] = useState<string | null>(null)

// Load all products
const { data } = await supabase
  .from('diesel_products')
  .select('*')
  .order('name')

// UI
<select value={selectedProduct}>
  <option value="">Seleccionar tipo de diesel...</option>
  {products.map(p => (
    <option key={p.id} value={p.id}>
      {p.name} ({p.product_code})
    </option>
  ))}
</select>
```

### 2. Caching Product ID
```typescript
// Cache in localStorage to avoid fetching every time
const cachedProductId = localStorage.getItem('diesel-product-id')
if (cachedProductId) {
  setDieselProductId(cachedProductId)
} else {
  const id = await loadDieselProduct()
  localStorage.setItem('diesel-product-id', id)
}
```

### 3. Product Management UI
Create admin interface to:
- Add new diesel products
- Update product codes
- Set default product
- Deactivate old products

---

## Rollback Plan

If issues arise, revert to hardcoded ID (but create the product first):

```sql
-- Option 1: Create the fake UUID in database
INSERT INTO diesel_products (id, product_code, name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'DIESEL',
  'Diesel Default'
);

-- Option 2: Use existing product in code
product_id: 'a780e0bc-d693-423e-889d-73a8e7e6d9fc'
```

**NOT RECOMMENDED**: Better to keep dynamic loading.

---

## Related Issues

This same pattern should be applied to:

1. **Diesel Entry Form** (when we build it)
2. **Adjustment Form** (when we build it)
3. **Any other form** that creates diesel_transactions

**Pattern to follow**:
```typescript
// ✅ DO THIS
const loadDieselProduct = async () => { ... }
product_id: dieselProductId

// ❌ DON'T DO THIS
product_id: '00000000-0000-0000-0000-000000000001'
product_id: 'hardcoded-uuid'
```

---

## Verification

To verify the fix is working:

```sql
-- 1. Check product exists
SELECT * FROM diesel_products WHERE product_code = '07DS01';

-- 2. After form submission, check transaction has correct product_id
SELECT 
  dt.id,
  dt.product_id,
  dp.product_code,
  dp.name
FROM diesel_transactions dt
JOIN diesel_products dp ON dt.product_id = dp.id
ORDER BY dt.created_at DESC
LIMIT 1;

-- Should show: product_code = '07DS01', name = 'Diesel Convencional'
```

---

## Success Criteria

✅ **Form loads without errors**
✅ **Product ID fetched dynamically**
✅ **Submission succeeds (no 409 Conflict)**
✅ **Transaction created with valid product_id**
✅ **Warehouse auto-updates via trigger**

---

**Status**: **Fixed** ✅
**Tested**: Product loading and submission working ✅
**No breaking changes**: Fully compatible ✅

