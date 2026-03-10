# Cyclic Maintenance — Source of Truth Analysis

## Canonical Implementation

**The asset-maintenance-summary API** ([`app/api/reports/asset-maintenance-summary/route.ts`](../app/api/reports/asset-maintenance-summary/route.ts)) is the implementation that works correctly. It is also used by the maintenance alerts email (Supabase edge function mirrors this logic).

**Reference asset:** `f6c24547-3403-47fd-9d2f-e41f9c249745` (CR-12 / 00equipo de pruebas)

---

## Data Structure (from Supabase)

### Asset
| Field | Value |
|-------|-------|
| current_hours | 2100 |
| current_kilometers | 42 |
| model | C7H 360HP 6X4 (MANUAL) |
| maintenance_unit | hours |

### Model Intervals (13 total for Sitrak)
| interval_value | name | is_first_cycle_only | maintenance_category |
|----------------|------|---------------------|----------------------|
| 100 | SERVICIO 100–300 HORAS (ASENTAMIENTO) | true | break_in |
| 300 | SERVICIO 300 HORAS... | false | standard |
| 600, 900, 1200, 1500, 1800, 2100... | ... | false | standard/intermediate/major |
| 3600 | SERVICIO 3,600 HORAS (ULTRA COMPLETO) | false | overhaul |

**Cycle length** = max(interval_value) = 3600h

### Maintenance History
| hours | maintenance_plan_id → interval | date |
|-------|------------------------------|------|
| 1650 | 1500h interval (babc0d5c...) | 2025-10-20 |
| 323 | 300h interval (504e757a...) | 2025-07-31 |

**Key:** `maintenance_history.maintenance_plan_id` = `maintenance_intervals.id` directly.

---

## Core Logic (Summary API)

### 1. Cycle Calculation
```
currentCycle = floor(currentValue / maxInterval) + 1
cycleStart = (currentCycle - 1) * maxInterval
cycleEnd = currentCycle * maxInterval
```

For 2100h: cycle 1, range [0, 3600).

### 2. Current-Cycle Maintenance Filter
```typescript
mValue > cycleStart && mValue < cycleEnd  // Exclusive end
```
Maintenance at exact boundary (e.g. 3600h) is excluded.

### 3. Preventive History Filter
- `type` = preventive / Preventivo / preventivo
- `maintenance_plan_id` matches an interval in the model's intervals
- `maintenance_plan_id` IS the interval.id (no plan→interval mapping)

### 4. Completion
Exact interval performed in current cycle:  
`currentCycleMaintenances.some(m => m.maintenance_plan_id === interval.id)`

### 5. Coverage (Hours Path)
Requires **all** of:
- `performedInterval.interval_value >= dueInterval.interval_value`
- `performedAtValue >= nextDueHour` (timing check)
- Same `type` (unit)

**Category:** `maintenance_category` is NOT a coverage gate. A 1500h "standard" service covers 600h "intermediate" — category is metadata for display, not coverage logic.

**Timing check:** Prevents 1500h service at 5145h from covering 1800h due at 5400h.

### 6. Coverage (Kilometers Path)
**Inconsistency:** Kilometers path uses interval-only (no `performedAfterDue`).  
Both units should use the same rule.

### 7. First Overdue Selection
Select **lowest** `interval_value` among overdue intervals (the one that should be done first).

---

## Gaps in Current Implementation

| Gap | Location | Fix |
|-----|----------|-----|
| ~~Category blocked coverage~~ | **FIXED** | Removed category requirement—coverage is interval-value + timing (hours) or interval-only (km) |
| Kilometers coverage lacks timing | Summary API km path | Add `performedAtKm >= nextDueKm` for consistency |
| Kilometers cycle filter includes prev cycle | Lines 997–1004 | Remove `(mKm >= cycleStart - 200)`; use same as hours |
| Duplication | 7+ files | Extract shared utility from summary API |

---

## Shared Utility Design (From Summary API)

```typescript
// lib/utils/cyclic-maintenance.ts

type ComputeParams = {
  intervals: Array<{ id: string; interval_value: number; type: string; maintenance_category?: string }>
  history: Array<{ maintenance_plan_id: string; hours: number | null; kilometers: number | null }>
  currentValue: number
  unit: 'hours' | 'kilometers'
  tolerance?: number  // default 200 for "next cycle window"
}

// Returns status per interval: overdue | upcoming | scheduled | covered | completed | not_applicable
```

**Use summary API logic as the spec.** The asset page and maintenance page should delegate to this utility (or call the summary API) instead of reimplementing.

---

## Efficient Implementation Notes

1. **Set for valid plan IDs:** `validPlanIds = new Set(intervals.map(i => i.id))` → O(H) filter instead of O(H×n)
2. **Map for interval lookup:** `intervalById = new Map(intervals.map(i => [i.id, i]))` → O(1) in coverage check instead of O(n)
3. **Single preventive filter:** One pass over history
4. **Batch history fetch:** Calendar API should batch by asset_id (fix N+1)
