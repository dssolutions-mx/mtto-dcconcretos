# Diesel Management System - Comprehensive Implementation Plan

## Executive Summary
Transform the diesel inventory system from a migration tool into a **production-ready, mobile-first diesel management platform** with offline capabilities, evidence backing, and comprehensive analytics.

---

## System Understanding & Current State

### Database Structure ✅
- **diesel_transactions** (1,948 migrated records)
  - Supports: entries, consumptions, adjustments
  - Captures: asset readings (hours/kilometers), operator info, validation workflow
  - Links: assets, plants, warehouses, operators, work orders
  
- **diesel_warehouses** (14 warehouses, 4 active)
- **diesel_products** (1 product: Diesel)
- **Views**: `diesel_inventory_detailed`, `diesel_asset_consumption_summary`

### Current Active Warehouses
1. **León/Planta 1 - Almacén 6**: 838L balance (500 transactions)
2. **Planta 2 - Almacén 7**: 5,431L balance (767 transactions)
3. **Planta 3 - Almacén 8**: 5,905L balance (355 transactions)
4. **Planta 4 - Almacén 9**: 3,780L balance (326 transactions)

### Storage Buckets Available
- ✅ checklist-photos (50MB limit, images/PDF)
- ✅ work-order-evidence (50MB limit, images/PDF/docs)
- ✅ incident-evidence (50MB limit, images/PDF/docs)
- ⚠️ **MISSING**: diesel-evidence bucket

---

## User Experience Requirements

### Target Users
1. **Operators** (Non-technical, mobile-first)
   - Quick diesel consumption recording
   - Simple asset selection by familiar name/code
   - Automatic reading validation
   - Offline-first operation

2. **Supervisors** (Field management)
   - Real-time inventory monitoring
   - Consumption pattern analysis
   - Anomaly detection & validation
   - Mobile & desktop access

3. **Administrators** (Plant managers, logistics)
   - Inventory analytics & reporting
   - Trend analysis & forecasting
   - Audit trails & compliance
   - Desktop-focused with mobile support

---

## Implementation Stages

## **STAGE 1: Foundation & Infrastructure** (Days 1-2)

### 1.1 Database Enhancements
```sql
-- Add balance tracking columns to diesel_transactions (for traceability)
ALTER TABLE diesel_transactions 
ADD COLUMN previous_balance NUMERIC(10,2),
ADD COLUMN current_balance NUMERIC(10,2);

-- Create diesel_evidence table
CREATE TABLE diesel_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES diesel_transactions(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('consumption', 'entry', 'adjustment', 'meter_reading', 'cuenta_litros', 'delivery', 'invoice')),
  photo_url TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'machine_display', 'cuenta_litros', 'delivery_truck', 'invoice', 'before', 'after'
  metadata JSONB, -- {original_size, compressed_size, device_info, timestamp}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create diesel_inventory_snapshots for daily/monthly reconciliation
CREATE TABLE diesel_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID REFERENCES diesel_warehouses(id),
  snapshot_date DATE NOT NULL,
  opening_balance NUMERIC(10,2) NOT NULL,
  total_entries NUMERIC(10,2) DEFAULT 0,
  total_consumptions NUMERIC(10,2) DEFAULT 0,
  total_adjustments NUMERIC(10,2) DEFAULT 0,
  closing_balance NUMERIC(10,2) NOT NULL,
  physical_count NUMERIC(10,2), -- Manual count
  variance NUMERIC(10,2), -- Difference between calculated and physical
  notes TEXT,
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, snapshot_date)
);

-- Create indices for performance
CREATE INDEX idx_diesel_evidence_transaction ON diesel_evidence(transaction_id);
CREATE INDEX idx_diesel_evidence_type ON diesel_evidence(evidence_type);
CREATE INDEX idx_diesel_snapshots_warehouse_date ON diesel_inventory_snapshots(warehouse_id, snapshot_date DESC);
CREATE INDEX idx_diesel_transactions_date_type ON diesel_transactions(transaction_date, transaction_type);
CREATE INDEX idx_diesel_transactions_asset_date ON diesel_transactions(asset_id, transaction_date DESC);
```

### 1.2 Storage Bucket Creation
- Create `diesel-evidence` bucket (50MB limit, public read)
- Configure RLS policies for evidence access
- Set up automatic cleanup for old evidence (optional)

### 1.3 RLS Policies
```sql
-- diesel_transactions RLS
ALTER TABLE diesel_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see diesel transactions in their business unit"
  ON diesel_transactions FOR SELECT
  USING (
    plant_id IN (
      SELECT p.id FROM plants p
      WHERE p.business_unit_id IN (
        SELECT business_unit_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users create diesel transactions in their plants"
  ON diesel_transactions FOR INSERT
  WITH CHECK (
    plant_id IN (
      SELECT plant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- diesel_evidence RLS
ALTER TABLE diesel_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see evidence for accessible transactions"
  ON diesel_evidence FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM diesel_transactions
    )
  );

CREATE POLICY "Users can upload evidence"
  ON diesel_evidence FOR INSERT
  WITH CHECK (auth.uid() = created_by);
```

---

## **STAGE 2: Core Components - Mobile First** (Days 3-5)

### 2.1 Asset Selection Component
**File**: `components/diesel-inventory/asset-selector-mobile.tsx`
- Intelligent search (asset_id, name, partial match)
- Filter by business unit (automatic based on user)
- Recent assets quick access
- Asset status indicators
- Shows current hours/kilometers
- Offline-capable with cached assets

### 2.2 Reading Capture Component
**File**: `components/diesel-inventory/reading-capture.tsx`
- Hours/kilometers input with validation
- Comparison with last known reading
- Visual warnings for anomalies
- Option to skip if asset has no meter
- Automatic increment calculation
- Inspired by checklist reading logic

### 2.3 Evidence Capture
**File**: Use existing `components/checklists/smart-photo-upload.tsx`
- Reuse proven checklist photo capture system
- Native device camera (no nested camera component)
- Automatic compression
- Multiple photo support
- Category tagging (machine_display, cuenta_litros, delivery_truck, invoice)
- Offline queue management
- Upload progress tracking

### 2.4 Consumption Entry Form
**File**: `components/diesel-inventory/consumption-entry-form.tsx`
**Features**:
- Asset selection (smart search by business unit)
- Quantity input (liters with validation)
- **Cuenta litros capture** (critical for validation)
- Meter reading capture (hours/kilometers)
- Operator selection (current user pre-filled)
- **Evidence upload (REQUIRED)**:
  - Photo 1: Machine display showing liters
  - Photo 2: Cuenta litros meter reading
- Notes/observations
- Automatic validation (quantity vs cuenta litros movement)
- Previous balance → Current balance calculation
- Offline support with sync
- Success feedback with transaction summary

### 2.5 Diesel Entry Form
**File**: `components/diesel-inventory/diesel-entry-form.tsx`
**Features**:
- Warehouse selection (user's plant)
- Quantity input (liters)
- Supplier/delivery info
- Unit cost (optional)
- **Evidence upload (REQUIRED)**:
  - Delivery truck/tanker photo
  - Invoice or delivery note
  - Tank gauge reading (if applicable)
- Previous balance → Current balance calculation
- Invoice reference
- Batch/lot information
- Delivery date/time

### 2.6 Adjustment Form
**File**: `components/diesel-inventory/adjustment-form.tsx`
**Features**:
- Warehouse selection
- Adjustment type (physical_count, evaporation, spillage, measurement_error, manual, other)
- Quantity (positive/negative)
- Reason (required, detailed justification)
- **Evidence (FLEXIBLE)**:
  - Optional for small adjustments (< 50L)
  - Recommended for medium (50-100L)
  - Optional but documented for large (> 100L)
- Previous balance → Current balance calculation
- Approval workflow for large adjustments
- Reference to physical count or incident

---

## **STAGE 3: Inventory Views & Analytics** (Days 6-8)

### 3.1 Current Inventory Dashboard
**File**: `app/diesel/inventory/page.tsx`
**Features**:
- Current balance per warehouse (cards)
- Low stock warnings (based on minimum_stock_level)
- Recent transactions feed
- Quick actions (entry, consumption, adjustment)
- Real-time updates
- Mobile-optimized cards
- Filters: plant, date range

### 3.2 Transaction Log Viewer
**File**: `components/diesel-inventory/transaction-log.tsx`
**Features**:
- Searchable, filterable list
- Group by: date, type, asset, operator
- Evidence preview (thumbnail)
- Export to CSV/PDF
- Pagination (infinite scroll on mobile)
- Quick filters (today, this week, this month)

### 3.3 Asset Consumption Analytics
**File**: `components/diesel-inventory/asset-consumption-analytics.tsx`
**Features**:
- Consumption per asset (bar chart)
- Consumption trends (line chart over time)
- Efficiency metrics (L/hour, L/km)
- Top consumers list
- Anomaly highlights
- Export capabilities
- Date range selector

### 3.4 Warehouse Balance History
**File**: `components/diesel-inventory/warehouse-balance-history.tsx`
**Features**:
- Balance trend chart (line graph)
- Entry vs consumption comparison
- Running balance visualization
- Monthly summaries
- Variance analysis (physical vs calculated)
- Reorder point indicators

---

## **STAGE 4: Inspection & Monitoring Tools** (Days 9-10)

### 4.1 Monthly Analysis Dashboard
**File**: `app/diesel/analysis/page.tsx`
**Features**:
- Month-over-month comparison
- Plant-wise consumption breakdown
- Asset category analysis (formal, exception, general)
- Cost analysis (if unit costs available)
- Efficiency trends
- Forecasting (simple linear projection)

### 4.2 Consumption Metrics
**File**: `components/diesel-inventory/consumption-metrics.tsx`
**Features**:
- Per asset metrics:
  - Total consumption
  - Average per transaction
  - Liters/hour efficiency
  - Liters/km efficiency
  - Activity status (active, recent, inactive, dormant)
- Comparative analysis
- Benchmark against fleet average
- Period comparison (this month vs last month)

### 4.3 Validation & Audit Trail
**File**: `components/diesel-inventory/validation-manager.tsx`
**Features**:
- Transactions requiring validation
- Reading anomalies (suspicious jumps)
- Large consumption alerts
- Missing evidence warnings
- Validation workflow (approve/reject)
- Audit log with user actions
- Comments/notes on validations

---

## **STAGE 5: Offline Capabilities** (Days 11-12)

### 5.1 Offline Service
**File**: `lib/services/diesel-offline-service.ts`
**Features**:
- Cache warehouses, products, recent assets
- Queue transactions for sync
- Store evidence locally (IndexedDB)
- Sync strategy (retry with exponential backoff)
- Conflict resolution
- Status monitoring
- Auto-sync when online

### 5.2 Offline Status Component
**File**: `components/diesel-inventory/diesel-offline-status.tsx`
**Features**:
- Connection indicator
- Pending transactions count
- Evidence upload queue
- Manual sync trigger
- Sync progress
- Error recovery

---

## **STAGE 6: Mobile Optimization & UX** (Days 13-14)

### 6.1 Mobile Navigation
- Bottom navigation for quick actions
- Floating action button (FAB) for quick consumption entry
- Gesture support (swipe to refresh, pull to navigate)
- Touch-optimized inputs (large buttons, easy selection)

### 6.2 Progressive Enhancement
- Camera integration (Web API)
- Barcode/QR scanning for assets (future)
- GPS location tagging (optional)
- Voice notes (optional)

### 6.3 User Onboarding
- First-time tutorial
- Contextual help
- Common patterns guidance
- Error prevention tips

---

## **STAGE 7: API Endpoints** (Days 15-16)

### 7.1 Transaction Endpoints
```
POST   /api/diesel/transactions/consumption
POST   /api/diesel/transactions/entry
POST   /api/diesel/transactions/adjustment
GET    /api/diesel/transactions
GET    /api/diesel/transactions/[id]
PATCH  /api/diesel/transactions/[id]/validate
DELETE /api/diesel/transactions/[id] (soft delete)
```

### 7.2 Analytics Endpoints
```
GET    /api/diesel/analytics/consumption-summary
GET    /api/diesel/analytics/warehouse-balance
GET    /api/diesel/analytics/asset-metrics
GET    /api/diesel/analytics/monthly-report
```

### 7.3 Evidence Endpoints
```
POST   /api/diesel/evidence/upload
GET    /api/diesel/evidence/[transaction_id]
DELETE /api/diesel/evidence/[id]
```

---

## Technical Specifications

### Mobile-First Design Principles
1. **Touch Targets**: Minimum 44x44px (iOS), 48x48px (Android)
2. **Font Sizes**: Minimum 16px for body, 14px for labels
3. **Input Fields**: Large, easy to tap, auto-focus
4. **Forms**: Single column, progressive disclosure
5. **Loading States**: Skeleton screens, not spinners
6. **Error Handling**: Inline validation, clear recovery paths
7. **Performance**: <3s initial load, <100ms interaction response

### Offline Strategy
1. **Data Caching**: IndexedDB for transactions, localStorage for preferences
2. **Evidence Storage**: IndexedDB with size limits, automatic cleanup
3. **Sync Priority**: Transactions > Evidence > Analytics
4. **Conflict Resolution**: Last-write-wins with manual review option
5. **Network Detection**: Online/offline events + periodic checks

### Evidence Requirements
- **Consumption**: REQUIRED (2 photos)
  - Photo 1: Machine display showing liters dispensed
  - Photo 2: Cuenta litros meter reading
- **Entry**: REQUIRED (minimum 1 photo)
  - Delivery truck/tanker
  - Invoice or delivery note
  - Tank gauge (if applicable)
- **Adjustment**: FLEXIBLE
  - Optional for all adjustments
  - Strongly recommended for physical counts
  - Document reason in notes if no photo
- **Compression**: Max 1MB per photo, 80% quality JPEG
- **Metadata**: Timestamp, device info (no GPS needed)

### Validation Rules
1. **Cuenta Litros Validation** (CRITICAL):
   - Compare quantity_liters with cuenta_litros movement
   - Calculate: current_cuenta_litros - previous_cuenta_litros
   - Allow small variance (±2L for measurement tolerance)
   - Flag for validation if variance > 2L
   - Store validation_difference for audit
   
2. **Reading Validation**:
   - Cannot decrease (except for meter reset with justification)
   - Cannot increase > 10,000 hours or 100,000 km in single transaction
   - Warning if increment < expected based on consumption
   - Some assets may not have readings - allow null
   
3. **Quantity Validation**:
   - Consumption: Must be > 0, < warehouse balance + safety margin (50L)
   - Entry: Must be > 0, reasonable for delivery (< 50,000L)
   - Adjustment: |quantity| < warehouse capacity
   
4. **Balance Validation**:
   - Previous balance must match last known warehouse balance
   - Current balance = previous balance ± transaction quantity
   - Alert if balance mismatch detected
   
5. **Required Manual Validations**:
   - Consumption > 500L
   - Cuenta litros variance > 2L
   - Adjustment > 100L or < -100L
   - Reading anomalies (>20% variance from average)
   - Negative warehouse balance

---

## User Flows

### Flow 1: Operator Records Consumption (Mobile)
1. Open app → Dashboard shows current balance
2. Tap "Record Consumption" FAB
3. Search/select asset (smart suggestions)
4. Enter quantity (predictive values based on history)
5. Capture meter reading (optional, with validation)
6. Take photo of meter (required)
7. Add notes (optional)
8. Review summary
9. Submit → Success with updated balance
10. Auto-sync when online (if offline)

**Time to complete**: < 60 seconds

### Flow 2: Supervisor Monitors Inventory
1. Open Inventory Dashboard
2. View current balances (all warehouses)
3. See low stock warnings
4. Review recent transactions
5. Drill into specific warehouse history
6. Analyze consumption patterns
7. Export report
8. Take action (order diesel, investigate anomaly)

### Flow 3: Administrator Analyzes Trends
1. Open Monthly Analysis
2. Select date range
3. View consumption breakdown (plant, asset, category)
4. Compare periods (MoM, YoY)
5. Identify top consumers
6. Review efficiency metrics
7. Generate forecast
8. Export comprehensive report

---

## Performance Targets

### Mobile
- Initial Load: < 3s on 3G
- Interaction Response: < 100ms
- Photo Upload: < 5s per photo
- Offline Mode: Fully functional
- Battery Impact: < 5% per hour active use

### Desktop
- Initial Load: < 2s
- Dashboard Refresh: < 500ms
- Report Generation: < 2s
- Analytics Rendering: < 1s

### Offline
- Cache Size: < 50MB
- Sync Time: < 30s for 100 transactions
- Evidence Queue: Up to 50 photos
- Storage Cleanup: Automatic after 30 days

---

## Security & Compliance

### Access Control
- RLS policies by business unit
- Plant-level restrictions for data entry
- Role-based feature access
- Audit trail for all actions

### Data Privacy
- Evidence photos: No personal data capture
- GPS coordinates: Optional, explicit consent
- User actions: Logged for audit, anonymized for analytics

### Compliance
- Audit trail retention: 7 years
- Evidence retention: 2 years
- Transaction immutability: No edits, only adjustments with trail
- Validation approval: Required for significant changes

---

## Testing Strategy

### Unit Tests
- Transaction validation logic
- Reading increment calculations
- Inventory balance computations
- Offline sync logic

### Integration Tests
- API endpoint responses
- Database transactions
- Evidence upload pipeline
- RLS policy enforcement

### E2E Tests
- Complete consumption flow
- Entry with evidence
- Adjustment approval workflow
- Offline → Online sync

### User Acceptance Testing
- Operator consumption recording (mobile)
- Supervisor monitoring (tablet)
- Administrator reporting (desktop)
- Offline functionality validation

---

## Deployment Plan

### Pre-Deployment
1. ✅ Database migrations
2. ✅ Storage bucket creation
3. ✅ RLS policies
4. ✅ Seed test data
5. ✅ API endpoint testing

### Deployment Strategy
**Direct to Production** - No pilot phase needed
- Deploy to all plants simultaneously
- Comprehensive user training (1-2 sessions per plant)
- Quick reference guides
- Support team ready for first week

### Post-Deployment
- Daily monitoring (week 1)
- Weekly check-ins (month 1)
- User feedback collection
- Rapid bug fixes if needed
- Iterative improvements based on usage

---

## Success Metrics

### Adoption
- 90% of operators using mobile app within 2 weeks
- < 5% transactions recorded in legacy system after 1 month
- 95% evidence upload compliance

### Performance
- < 2% failed transactions
- < 1% sync errors
- 99.9% uptime

### Business Impact
- 30% faster consumption recording
- 50% reduction in data entry errors
- 100% transaction traceability
- Real-time inventory visibility

---

## Risk Mitigation

### Technical Risks
1. **Offline sync conflicts**: Timestamp-based resolution with manual review
2. **Photo storage limits**: Automatic compression, cleanup, cloud backup
3. **Network instability**: Robust retry logic, queue management
4. **Device compatibility**: Progressive enhancement, feature detection

### Operational Risks
1. **User resistance**: Comprehensive training, easy onboarding
2. **Data migration**: Parallel running, validation, rollback plan
3. **Support load**: FAQ, video tutorials, dedicated support team

### Business Risks
1. **Adoption failure**: Incentivize usage, make it easier than legacy
2. **Accuracy concerns**: Validation workflow, audit trail, evidence requirement
3. **Compliance issues**: Legal review, audit trail design, retention policies

---

## Future Enhancements (Post-MVP)

### Phase 2 Features
- Predictive maintenance integration (low diesel = potential issues)
- Automatic reorder suggestions based on consumption patterns
- Integration with fuel suppliers (order tracking)
- SMS/Email notifications for low stock
- Advanced consumption forecasting (statistical models)
- Asset efficiency benchmarking across fleet
- Fuel quality tracking (manual entry)
- Cost allocation by plant/department

### Integration Points
- ERP system integration
- Fleet management systems
- Maintenance scheduling (auto-schedule based on usage)
- Financial systems (cost allocation)

---

## Conclusion

This comprehensive plan transforms the diesel inventory system into a production-ready, user-friendly platform that:
- ✅ Empowers operators with quick, mobile-first data entry
- ✅ Provides supervisors with real-time monitoring and analytics
- ✅ Gives administrators comprehensive inspection and reporting tools
- ✅ Works seamlessly offline with robust sync
- ✅ Ensures data accuracy through evidence and validation
- ✅ Maintains complete audit trail for compliance
- ✅ Delivers measurable business value

**Estimated Timeline**: 16 working days (3-4 weeks)
**Team Required**: 1-2 full-stack developers
**Dependencies**: Database access, storage configuration, user testing

---

**Ready to proceed with Stage 1: Foundation & Infrastructure?**

