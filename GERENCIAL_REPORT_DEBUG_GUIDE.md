# Gerencial Report - Debugging "No Data" Issue

## Quick Debugging Steps

### Step 1: Check Browser Console
1. Open the page: http://localhost:3000/reportes/gerencial
2. Open Browser DevTools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Look for any red errors
5. Go to **Network** tab
6. Find the POST request to `/api/reports/gerencial`
7. Click on it and check:
   - **Request** tab: What data was sent?
   - **Response** tab: What data was returned?
   - **Status**: Is it 200 OK or an error?

### Step 2: Check Server Logs
If running `npm run dev`, look at the terminal for console.log output showing:
```
Gerencial Report Summary: {
  totalAssets: X,
  totalBusinessUnits: Y,
  totalPlants: Z,
  ...
}
```

### Step 3: Check Database Has Data

Open a Supabase SQL editor and run:

```sql
-- Check if you have assets
SELECT COUNT(*) as asset_count FROM public.assets;

-- Check if assets have plant assignments
SELECT COUNT(*) as assets_with_plants 
FROM public.assets 
WHERE plant_id IS NOT NULL;

-- Check if you have diesel transactions in the date range
SELECT COUNT(*) as diesel_tx_count,
       MIN(transaction_date) as earliest,
       MAX(transaction_date) as latest
FROM public.diesel_transactions;

-- Check if you have maintenance history in the date range
SELECT COUNT(*) as maint_count,
       MIN(date) as earliest,
       MAX(date) as latest
FROM public.maintenance_history;

-- Check business unit structure
SELECT 
  bu.name as business_unit,
  COUNT(DISTINCT p.id) as plants_count,
  COUNT(DISTINCT a.id) as assets_count
FROM public.business_units bu
LEFT JOIN public.plants p ON p.business_unit_id = bu.id
LEFT JOIN public.assets a ON a.plant_id = p.id
GROUP BY bu.id, bu.name;
```

## Common Issues & Solutions

### Issue 1: "0 activos" in asset tab

**Possible Causes:**
1. No assets in database
2. Assets not assigned to plants
3. Plants not assigned to business units
4. Date filter excludes all data
5. Business Unit/Plant filter too restrictive

**Solution:**
1. Check that assets exist and have `plant_id` set
2. Check that plants have `business_unit_id` set
3. Try removing filters (set to "Todas")
4. Expand date range to cover more data

### Issue 2: API returns empty arrays

**Check API Response:**
```bash
# Test the API directly
curl -X POST http://localhost:3000/api/reports/gerencial \
  -H "Content-Type: application/json" \
  -d '{
    "dateFrom": "2024-01-01",
    "dateTo": "2025-12-31",
    "businessUnitId": null,
    "plantId": null
  }'
```

**Expected Response:**
```json
{
  "summary": { ... },
  "businessUnits": [...],
  "plants": [...],
  "assets": [...],
  "filters": { ... }
}
```

**If you see an error:**
- Check server logs for stack trace
- Verify Supabase connection is working
- Check RLS policies allow reading data

### Issue 3: Authentication/RLS Issues

**Symptoms:**
- API returns 403 or empty data
- Console shows "access denied" or RLS errors

**Solution:**
1. Make sure you're logged in to the app
2. Check that your user has proper role permissions
3. Verify RLS policies allow SELECT on these tables:
   - `business_units`
   - `plants`
   - `assets`
   - `diesel_transactions`
   - `diesel_products`
   - `maintenance_history`

```sql
-- Check your current user role
SELECT auth.uid(), auth.role();

-- Temporarily disable RLS for testing (BE CAREFUL - only in dev!)
-- ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;
```

### Issue 4: Date Range Issues

**Check date format:**
- Frontend sends: `"2025-10-01"` (YYYY-MM-DD)
- API should handle this format correctly

**Try expanding the date range:**
1. Set "Fecha Inicio" to a year ago
2. Set "Fecha Fin" to today
3. Click "Actualizar"

### Issue 5: Missing Environment Variables

**Check `.env.local` has:**
```bash
COTIZADOR_SUPABASE_URL=https://pkjqznogflgbnwzkzmpg.supabase.co
COTIZADOR_SUPABASE_SERVICE_ROLE_KEY=<actual-key>
COTIZADOR_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Restart dev server after adding variables:**
```bash
# Stop current server (Ctrl+C)
npm run dev
```

## Step-by-Step Data Population Check

If your database is empty or missing connections, follow this checklist:

### 1. Business Units
```sql
SELECT * FROM public.business_units;
-- Should return at least one row
-- If empty, create one:
-- INSERT INTO public.business_units (name, code) VALUES ('Unidad Principal', 'UP001');
```

### 2. Plants
```sql
SELECT p.*, bu.name as business_unit_name 
FROM public.plants p
LEFT JOIN public.business_units bu ON bu.id = p.business_unit_id;
-- Each plant MUST have business_unit_id set
```

### 3. Assets
```sql
SELECT a.*, p.name as plant_name 
FROM public.assets a
LEFT JOIN public.plants p ON p.id = a.plant_id;
-- Each asset should have plant_id set
-- If many are NULL, run:
-- UPDATE public.assets SET plant_id = '<some-plant-id>' WHERE plant_id IS NULL;
```

### 4. Diesel Transactions
```sql
SELECT 
  dt.*,
  a.name as asset_name,
  dp.name as product_name
FROM public.diesel_transactions dt
LEFT JOIN public.assets a ON a.id = dt.asset_id
LEFT JOIN public.diesel_products dp ON dp.id = dt.product_id
ORDER BY dt.transaction_date DESC
LIMIT 10;
-- Check that asset_id is set on consumption transactions
```

### 5. Diesel Product Prices
```sql
SELECT * FROM public.diesel_products;
-- Check if price_per_liter is set
-- If NULL, update:
-- UPDATE public.diesel_products SET price_per_liter = 24.50 WHERE id = '<product-id>';
```

### 6. Maintenance History
```sql
SELECT 
  mh.*,
  a.name as asset_name
FROM public.maintenance_history mh
LEFT JOIN public.assets a ON a.id = mh.asset_id
ORDER BY mh.date DESC
LIMIT 10;
-- Check that asset_id is set
```

## Frontend Debugging

### Check if data is received but not displayed

Add this temporarily to `/app/reportes/gerencial/page.tsx` after `setData(json)`:

```typescript
useEffect(() => {
  if (data) {
    console.log('Gerencial data received:', {
      summary: data.summary,
      businessUnitsCount: data.businessUnits?.length,
      plantsCount: data.plants?.length,
      assetsCount: data.assets?.length,
      assets: data.assets
    })
  }
}, [data])
```

Then check browser console to see what data is actually loaded.

### Check filter state

Add this to see current filter values:

```typescript
console.log('Current filters:', {
  dateFrom,
  dateTo,
  businessUnitId,
  plantId,
  includeVat
})
```

## Quick Fix: Reset Everything

If nothing works, try:

1. **Clear filters:**
   - Set Business Unit to "Todas"
   - Set Plant to "Todas"
   - Set date range to last 12 months

2. **Hard refresh page:**
   - Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

3. **Clear cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

4. **Check if OTHER reports work:**
   - Go to http://localhost:3000/reportes
   - If that works, the issue is specific to gerencial
   - If that fails too, it's a broader auth/data issue

## Still Not Working?

### Last Resort Debugging

Add extensive logging to `/app/api/reports/gerencial/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('1. Request body:', body)

    const supabase = await createServerSupabase()
    console.log('2. Supabase client created')

    const { data: businessUnitsRaw, error: buError } = await buQuery
    console.log('3. Business units fetched:', {
      count: businessUnitsRaw?.length,
      error: buError
    })

    // ... continue adding logs at each step
  } catch (e: any) {
    console.error('FULL ERROR:', e)
    return NextResponse.json({ error: e?.message, stack: e?.stack }, { status: 500 })
  }
}
```

Then watch the terminal logs as you load the page.

---

## Success Criteria

You'll know it's working when:
- ✅ Assets tab shows a table with rows
- ✅ Summary cards show non-zero numbers
- ✅ Charts render with data
- ✅ Business Units tab shows units
- ✅ Plants tab shows plants
- ✅ Console has no errors

---

## Need Help?

If after following all these steps you still see "No hay datos":

1. Share the **browser console output**
2. Share the **terminal/server logs**
3. Share the **SQL query results** from Step 3
4. Share the **API response** from the Network tab

This will help identify the exact issue!

