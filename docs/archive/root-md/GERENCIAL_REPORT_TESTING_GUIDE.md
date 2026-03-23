# Gerencial Report Testing Guide

## Quick Start Testing

### 1. Set Up Environment Variables

First, ensure you have the correct environment variables in `.env.local`:

```bash
# Cotizador Integration (server-only)
COTIZADOR_SUPABASE_URL=https://pkjqznogflgbnwzkzmpg.supabase.co
COTIZADOR_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
COTIZADOR_SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>

# Base URL (optional for local dev)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Important:** You need to add the actual service role key from the Cotizador project.

### 2. Start the Development Server

```bash
npm run dev
```

Wait for the server to start (usually at http://localhost:3000)

### 3. Navigate to the Gerencial Report

Open your browser and go to:
```
http://localhost:3000/reportes/gerencial
```

---

## Step-by-Step Testing

### Test 1: Page Load
✅ **Expected:** Page loads with:
- Date filters (default to current month)
- Four tabs: Overview, Diesel, Maintenance, Sales
- Loading spinner initially, then data

❌ **If fails:**
- Check browser console for errors
- Verify environment variables are set
- Check API route: `http://localhost:3000/api/reports/gerencial`

### Test 2: Date Filter
1. Change "Fecha Inicio" to first day of previous month
2. Change "Fecha Fin" to last day of previous month
3. Click "Actualizar"

✅ **Expected:**
- Loading spinner appears
- Data refreshes with new date range
- KPI cards update

❌ **If fails:**
- Check browser console
- Verify dates are in correct format (YYYY-MM-DD)
- Check Network tab for API request

### Test 3: Overview Tab
1. Click "Overview" tab (default)
2. Verify KPI cards show:
   - Ventas Totales (with $ symbol)
   - Costo Diésel (with fuel icon)
   - Costo Mantenimiento (with wrench icon)
   - Ratio Costo/Ingreso (with trend icon)

3. Verify charts render:
   - Pie chart: Cost distribution
   - Area chart: Sales trend

✅ **Expected:**
- All numbers formatted as currency or percentages
- Charts are interactive (hover shows tooltips)
- Glass effect visible on cards

❌ **If fails:**
- Check if recharts is installed: `npm list recharts`
- Verify data structure in Network tab
- Check browser console for chart errors

### Test 4: Diesel Tab
1. Click "Diésel" tab
2. Verify KPI cards show:
   - Consumo Total (L)
   - Entradas Total (L)
   - Precio Efectivo ($/L)
   - Balance en Almacén (L)

3. Verify bar chart renders with three bars:
   - Entradas (green)
   - Consumo (amber)
   - Balance (indigo)

✅ **Expected:**
- Diesel metrics are positive numbers
- Bar chart shows comparative view
- Tooltip shows exact values on hover

❌ **If fails:**
- Check if diesel_products has price_per_liter data
- Verify diesel_transactions exist in date range
- Check API response structure

### Test 5: Maintenance Tab
1. Click "Mantenimiento" tab
2. Verify KPI cards show:
   - Costo Total
   - Preventivo (green)
   - Correctivo (red)
   - Downtime (hours)

3. Verify two charts render:
   - Pie chart: Preventive vs. Corrective costs
   - Bar chart: Completed vs. Pending work

✅ **Expected:**
- Maintenance costs are formatted as currency
- Pie chart shows percentage breakdown
- Work status bar chart shows counts

❌ **If fails:**
- Check if work_orders exist in date range
- Verify work_type field has 'preventivo'/'correctivo' values
- Check API aggregation logic

### Test 6: Sales Tab
1. Click "Ventas" tab
2. Verify KPI cards show:
   - Ventas Totales
   - Concreto Total (m³)
   - Remisiones (count)

3. Verify line chart with dual Y-axes:
   - Left axis: Concrete volume (cyan line)
   - Right axis: Revenue (indigo line)

4. Verify data table displays:
   - Week column
   - Asset column (with badge)
   - m³ column
   - Remisiones column
   - Subtotal column
   - Total c/ IVA column

✅ **Expected:**
- Sales data shows weekly breakdown
- Chart has two lines with different colors
- Table is sortable and scrollable
- Asset names appear as badges

❌ **If fails:**
- Check COTIZADOR_SUPABASE_SERVICE_ROLE_KEY is set
- Verify cotizador database has sales_assets_weekly view
- Test integration API directly (see below)
- Check for CORS or network errors

### Test 7: VAT Toggle
1. Go to Overview or Sales tab
2. Check the "Incluir IVA en ventas" checkbox
3. Click "Actualizar"

✅ **Expected:**
- Sales numbers increase by ~16%
- Cost/Revenue ratio decreases
- Chart updates to show higher revenue

❌ **If fails:**
- Check if toggle state is passed to API
- Verify calculations in frontend
- Check sales data has both subtotal and vat amounts

### Test 8: Glass Effects
1. Hover over any KPI card
2. Click a tab trigger
3. Scroll the page

✅ **Expected:**
- Cards lift slightly on hover
- Subtle glass blur effect visible
- Smooth transitions
- Works in both light and dark mode

❌ **If fails:**
- Check if browser supports backdrop-filter
- Verify styles/globals.css has glass utilities
- Test in different browser (Safari, Chrome, Firefox)

### Test 9: Responsive Design
1. Resize browser window to mobile size (< 640px)
2. Check all tabs

✅ **Expected:**
- KPI cards stack vertically
- Charts remain responsive
- Tab triggers show icons only
- Table scrolls horizontally
- Date filters stack

❌ **If fails:**
- Check Tailwind breakpoints (md:, lg:)
- Verify ResponsiveContainer wraps charts
- Test with browser dev tools mobile view

### Test 10: Export Button (Placeholder)
1. Click "Exportar" button

✅ **Expected:**
- Button is visible but may not do anything yet
- No errors in console

❌ **Not yet implemented:**
- PDF/Excel export functionality

---

## API Testing

### Test Integration API Directly

```bash
# Test cotizador sales integration
curl -X POST http://localhost:3000/api/integrations/cotizador/sales/assets/weekly \
  -H "Content-Type: application/json" \
  -d '{
    "dateFrom": "2025-10-01",
    "dateTo": "2025-10-31"
  }'
```

✅ **Expected Response:**
```json
[
  {
    "week_start": "2025-10-06",
    "plant_id": "uuid",
    "asset_name": "MIXER-01",
    "asset_id": "uuid-if-mapped",
    "concrete_m3": 150.5,
    "total_m3": 160.0,
    "subtotal_amount": 125000,
    "total_amount_with_vat": 145000,
    "remisiones_count": 15,
    "remisiones_concrete_count": 14
  }
]
```

### Test Gerencial Report API

```bash
curl -X POST http://localhost:3000/api/reports/gerencial \
  -H "Content-Type: application/json" \
  -d '{
    "dateFrom": "2025-10-01",
    "dateTo": "2025-10-31"
  }'
```

✅ **Expected Response:**
```json
{
  "diesel": {
    "totalConsumptionL": 5000.5,
    "totalEntriesL": 6000.0,
    "dieselCost": 125000,
    "effectivePrice": 24.50,
    "warehouseBalance": 1500.0
  },
  "maintenance": {
    "maintenanceCost": 250000,
    "preventiveCost": 180000,
    "correctiveCost": 70000,
    "downtimeHours": 45.5,
    "completedWork": 25,
    "pendingWork": 8
  },
  "sales": {
    "totalSalesSubtotal": 1500000,
    "totalSalesWithVat": 1740000,
    "totalConcreteM3": 1250.5,
    "weekly": [...]
  }
}
```

---

## Common Issues & Solutions

### Issue: "Missing cotizador env configuration"

**Cause:** Environment variables not set

**Solution:**
1. Check `.env.local` has all cotizador variables
2. Restart dev server after adding variables
3. Verify no typos in variable names

```bash
# Restart server
npm run dev
```

### Issue: Charts not rendering

**Cause:** Recharts not installed or data structure mismatch

**Solution:**
1. Check recharts installation:
```bash
npm list recharts
```

2. If not installed:
```bash
npm install recharts
```

3. Check browser console for errors

### Issue: Glass effects not visible

**Cause:** Browser doesn't support backdrop-filter

**Solution:**
1. Update browser to latest version
2. Test in Safari or Chrome (best support)
3. Check if @layer components is loading:
   - Inspect element
   - Look for backdrop-filter in computed styles

### Issue: No sales data showing

**Cause:** Cotizador integration not working

**Solution:**
1. Verify service role key is correct
2. Test integration API directly (see above)
3. Check cotizador database has the view:
```sql
SELECT * FROM public.sales_assets_weekly LIMIT 1;
```
4. Verify date range has data

### Issue: Diesel cost is $0

**Cause:** No price_per_liter set in diesel_products

**Solution:**
1. Add price to products:
```sql
UPDATE public.diesel_products
SET price_per_liter = 24.50
WHERE id = 'your-product-id';
```

2. Or ensure transactions have unit_cost

### Issue: Maintenance cost is $0

**Cause:** Work orders don't have cost data

**Solution:**
1. Check if work_orders have cost fields populated
2. Verify purchase orders are linked
3. Check date range includes completed work

---

## Performance Testing

### Load Time Benchmarks

**Target Times:**
- Initial page load: < 2 seconds
- Date filter refresh: < 1.5 seconds
- Tab switch: < 100ms (client-only)
- Chart render: < 500ms

**How to Test:**
1. Open browser DevTools → Network tab
2. Refresh page
3. Check API request timing
4. Note total load time

**If Slow:**
- Check database indexes
- Consider pagination for large datasets
- Verify materialized view is used
- Check network latency

---

## Visual Regression Testing

### Screenshots to Take
1. Overview tab (light mode)
2. Overview tab (dark mode)
3. Diesel tab with chart
4. Maintenance tab with charts
5. Sales tab with table
6. Mobile view (375px width)
7. Tablet view (768px width)
8. Desktop view (1440px width)

### Compare Against
- iOS26 design guidelines
- Existing app aesthetics
- Accessibility standards

---

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter/Space activates buttons
- [ ] Arrow keys navigate tabs
- [ ] Esc closes any modals

### Screen Reader
- [ ] Tab labels are announced
- [ ] KPI values are announced
- [ ] Chart data is accessible
- [ ] Error messages are announced

### Color Contrast
- [ ] Text meets WCAG AA standards
- [ ] Icons have sufficient contrast
- [ ] Charts use distinguishable colors
- [ ] Focus indicators are visible

---

## Sign-Off Checklist

### Functionality
- [ ] All tabs load without errors
- [ ] Date filters work correctly
- [ ] VAT toggle updates calculations
- [ ] Charts render and are interactive
- [ ] Data table is sortable
- [ ] API routes return correct data
- [ ] Cross-project integration works

### UI/UX
- [ ] Glass effects visible and smooth
- [ ] Hover states work on cards
- [ ] Responsive on mobile/tablet/desktop
- [ ] Loading states are clear
- [ ] Error states are helpful
- [ ] Typography is hierarchical
- [ ] Spacing is consistent

### Performance
- [ ] Page loads in < 2 seconds
- [ ] No console errors or warnings
- [ ] No memory leaks
- [ ] Charts render quickly
- [ ] Smooth scrolling

### Security
- [ ] Service role key not exposed to client
- [ ] API routes are server-only
- [ ] RLS policies respected
- [ ] No sensitive data in logs

### Compatibility
- [ ] Works in Chrome
- [ ] Works in Safari
- [ ] Works in Firefox
- [ ] Works in Edge
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome

---

## Next Steps After Testing

1. **Fix any bugs found** during testing
2. **Optimize slow queries** if performance is poor
3. **Add plant filtering** if needed
4. **Implement export functionality** (PDF/Excel)
5. **Set up asset mapping UI** for easier management
6. **Add period comparison** (vs. previous month/quarter)
7. **Deploy to staging** for user acceptance testing
8. **Collect feedback** from managers/stakeholders
9. **Iterate based on feedback**
10. **Deploy to production**

---

## Contact & Support

If you encounter issues not covered in this guide:

1. Check the main implementation summary: `GERENCIAL_REPORT_IMPLEMENTATION_SUMMARY.md`
2. Review the API route code for debugging hints
3. Check Supabase logs for database errors
4. Test with mock data to isolate issues
5. Verify environment configuration

**Happy Testing! 🎉**

