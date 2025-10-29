# Gerencial Ingresos vs Gastos - Implementation Summary

## Overview
Successfully implemented a dedicated financial analysis page for the gerencial report that displays income vs expenses in a transposed table format, combining automated data from Supabase views with manual cost entries.

## Components Implemented

### 1. Database Schema (`migrations/20250128_create_manual_financial_adjustments.sql`)
- Created `manual_financial_adjustments` table for storing manual financial entries
- Fields: business_unit_id, plant_id, period_month, category (nomina/otros_indirectos), department, subcategory, description, amount, notes
- Indexes for performance optimization
- RLS policies for admin/RH/gerente roles
- Audit triggers for tracking changes

### 2. API Routes

#### `/api/reports/gerencial/ingresos-gastos`
- **POST endpoint** that combines data from multiple sources:
  - `vw_plant_financial_analysis_unified` view for revenue and material costs
  - Gerencial API for diesel and maintenance costs (reuses existing logic)
  - Manual adjustments for nómina and otros indirectos
- Returns unified plant-level financial data for a specific month
- Supports filtering by business unit and plant

#### `/api/reports/gerencial/manual-costs`
- **GET**: Fetch manual cost entries for a specific month/plant/BU
- **POST**: Create new manual cost entry
- **PUT**: Update existing manual cost entry
- **DELETE**: Remove manual cost entry
- Full CRUD operations with proper validation and authorization

#### `/api/business-units` & `/api/plants`
- Simple GET endpoints for dropdown filters
- Returns organizational structure data

### 3. Admin Interface (`/reportes/gerencial/manual-costs/page.tsx`)
- Dedicated page for RH and Admin users to manage manual costs
- Features:
  - Month-based filtering
  - Business unit and plant filters
  - Totals summary cards (Nómina, Otros Indirectos, Total)
  - Full CRUD table with edit/delete actions
  - Create/Edit dialog with form validation
  - Category selection (Nómina vs Otros Indirectos)
  - Department and subcategory fields for granular tracking
  - Notes and description fields

### 4. Main Report Page (`/reportes/gerencial/ingresos-gastos/page.tsx`)
- Transposed table layout (rows = metrics, columns = plants)
- Sections:
  - **Ingresos Concreto**: Volume, f'c, age, PV unitario, total sales
  - **Costo Materia Prima**: MP unitario, cement consumption, costs, percentages
  - **Spread**: Unitario and percentage
  - **Costo Operativo**: Diesel, Mantenimiento, Nómina, Otros Indirectos (totals, unitarios, percentages)
  - **EBITDA**: Total and percentage
  - **Optional Bombeo**: Volume and unit price (if data exists)
- Sticky headers and first column for horizontal scrolling
- Color-coded section headers matching screenshot aesthetics
- Apple HIG design principles: clean typography, proper spacing, clear hierarchy
- Responsive design with empty states

### 5. Navigation
- Added button to gerencial report page to navigate to Ingresos vs Gastos
- Added button to Ingresos vs Gastos page to manage manual costs

## Data Flow

```
1. View Data (vw_plant_financial_analysis_unified)
   ↓
   [Volumen, f'c, Edad, PV, Ventas, MP Costs, Cement Data]

2. Gerencial API (reused logic)
   ↓
   [Diesel Costs per Plant, Maintenance Costs per Plant]

3. Manual Adjustments Table
   ↓
   [Nómina Totals per Plant, Otros Indirectos Totals per Plant]

4. Unified API (/ingresos-gastos)
   ↓
   Combines all sources → Calculates derived metrics → Returns plant data

5. UI Component
   ↓
   Renders transposed table with formatting
```

## Key Features

1. **Month-Based Analysis**: All data segmented by month for accurate period reporting
2. **Automatic Calculations**: All unitarios, percentages, spreads, and EBITDA calculated dynamically
3. **Manual Input Flexibility**: Admins can add costs with custom categories and departments
4. **Consistent Logic**: Reuses proven diesel/maintenance aggregation from gerencial report
5. **Granular Tracking**: Department and subcategory fields for detailed cost analysis
6. **Audit Trail**: created_by, updated_by, timestamps for all manual entries
7. **Role-Based Access**: RLS policies ensure proper data security
8. **Modern UX**: Clean, responsive design following Apple HIG principles

## Table Structure (Transposed)

| Metric | P2 - Tij | P4 - Tij | P2-P4 Viad | P3 - IT VR | P1 - Sil |
|--------|----------|----------|------------|------------|----------|
| **Ingresos Concreto** | | | | | |
| Volumen Concreto (m³) | 3,140.00 | 1,853.00 | 4,993.00 | 2,041.60 | 2,304.50 |
| PV Unitario | $4,039.09 | $3,692.20 | $3,910.35 | $5,900.16 | $2,004.00 |
| Ventas Total Concreto | $12,682,754 | $6,841,642 | $19,524,396 | $12,045,766 | $4,656,983 |
| **Costo Materia Prima** | | | | | |
| Costo MP Unitario | $2,883.37 | $2,637.66 | $2,792.19 | $4,297.42 | $1,350.92 |
| Costo MP Total Concreto | $9,053,792 | $4,887,588 | $13,941,380 | $8,773,692 | $3,165,250 |
| **Spread** | | | | | |
| Spread Unitario | $1,155.72 | $1,054.54 | $1,118.17 | $1,602.74 | $653.08 |
| **Costo Operativo** | | | | | |
| Diesel (Todas las Unidades) | $267,221 | $144,102 | $392,422 | - | - |
| MANTTO. (Todas las Unidades) | $181,163 | $36,923 | $35,980 | - | - |
| Nómina Totales | $1,539,366 | $820,333 | $934,920 | - | - |
| Otros Indirectos Totales | $1,352,923 | $679,962 | $908,108 | - | - |
| TOTAL COSTO OP | $3,340,673 | $1,681,321 | $2,271,430 | - | - |
| **EBITDA** | | | | | |
| EBITDA | $2,242,342 | $1,590,753 | -$779,697 | - | - |

## Next Steps & Future Enhancements

1. **Migration Execution**: Apply the database migration in production
2. **Testing**: Validate data accuracy with real financial data
3. **Export Functionality**: Add CSV/Excel export for the table
4. **Print View**: Optimize layout for printing/PDF generation
5. **Historical Comparison**: Add month-over-month comparison features
6. **Budget Integration**: Allow budget targets and variance analysis
7. **Category Presets**: Add predefined categories for common cost types
8. **Bulk Import**: CSV import for batch manual cost entries
9. **Approval Workflow**: Add review/approval process for manual entries
10. **Notifications**: Alert relevant users when manual costs are due

## Files Modified/Created

### Created:
- `migrations/20250128_create_manual_financial_adjustments.sql`
- `app/api/reports/gerencial/ingresos-gastos/route.ts`
- `app/api/reports/gerencial/manual-costs/route.ts`
- `app/api/business-units/route.ts`
- `app/api/plants/route.ts`
- `app/reportes/gerencial/manual-costs/page.tsx`
- `app/reportes/gerencial/ingresos-gastos/page.tsx`

### Modified:
- `app/reportes/gerencial/page.tsx` (added navigation button)

## Technical Notes

1. **View Dependency**: Requires `vw_plant_financial_analysis_unified` view to exist in Supabase
2. **Date Handling**: All period_month values stored as first day of month (YYYY-MM-01)
3. **Aggregation**: Manual costs aggregated by category per plant per month
4. **Performance**: Indexes created for common query patterns
5. **Reusability**: Diesel/maintenance logic reused via internal API call to gerencial endpoint
6. **Error Handling**: Comprehensive try-catch blocks with user-friendly error messages
7. **Type Safety**: Full TypeScript types for all API responses and data structures

## Security Considerations

- RLS policies restrict access to admin, RH, and gerente roles
- Manual adjustments can only be modified by creators (RH) or admins
- Audit trail tracks all changes with user IDs and timestamps
- Input validation on all API endpoints
- Protected routes require authentication

## Deployment Checklist

- [ ] Apply database migration
- [ ] Verify RLS policies work correctly
- [ ] Test with real financial data from view
- [ ] Validate calculations against existing reports
- [ ] Train RH/Admin users on manual cost entry
- [ ] Set up monitoring for API performance
- [ ] Document any view schema dependencies
- [ ] Create backup of manual adjustments table regularly


