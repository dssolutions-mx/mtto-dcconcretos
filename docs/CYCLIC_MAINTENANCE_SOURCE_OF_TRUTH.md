# Cyclic maintenance — source of truth

## Canonical engine

All cyclic preventive logic lives in **`lib/maintenance/due-engine.ts`** (`buildDueLedger`).

Public adapter for UI and reports: **`lib/utils/cyclic-maintenance.ts`** (`computeCyclicIntervalResults`, `computeCyclicIntervalResultsForAsset`).

Do not reimplement cycle windows, category gates, or earliest-unpaid overrides elsewhere.

## Core invariant (checkpoint semantics)

> A due can only be **overdue** if it falls strictly after the latest preventive service meter value.

A completed preventive service is a **checkpoint** that settles every unperformed due at or below its meter reading. Dues are:

- **`paid`** — exact interval match (one history row → one due)
- **`absorbed`** — settled by a later checkpoint without exact tier match
- **`unpaid`** — only these can become **overdue** when current meter is past the due

Overdue ⊆ `(lastServiceMeter, currentValue]`.

## Policies

| ID | Rule |
|----|------|
| **P1** | `maintenance_category` is display metadata only — never a coverage gate. |
| **P2** | Checkpoint absorption as above. Completions store `absorbed_services` on `maintenance_history` (see migration `20260611100000`). |
| **P3** | `both`-unit models: hour-typed / legacy `"Preventivo"` intervals use hours; km-typed intervals use km (`lib/maintenance/dual-meter.ts`). |

## Status per interval

| Status | Meaning |
|--------|---------|
| `completed` | Current-cycle due paid by exact match |
| `covered` | Current-cycle due absorbed by a checkpoint |
| `overdue` | Earliest unpaid due in `(lastServiceMeter, currentValue]` |
| `upcoming` / `scheduled` | Next due above current meter (thresholds: 100 / 1000) |
| `not_applicable` | First-cycle-only beyond cycle 1, non-recurring, or beyond horizon |

## History preprocessing

`lib/maintenance/history-preprocess.ts` — before the ledger runs:

- Remap legacy `maintenance_plans.id` → `maintenance_intervals.id`
- Resolve dead interval ids when catalog provided
- Emit `excludedHistory` with reasons (`null_meter`, `dead_interval_id`, …) — never silent drops

## Write path

`app/api/maintenance/work-completions/route.ts`:

- Preventive completions require meter value and linked `interval_id`
- Writes `interval_value_snapshot` and `absorbed_services`
- `both` models keep both `hours` and `kilometers` on history rows

## Interval definition changes

- Ledger always recomputes from **current** `maintenance_intervals` (recompute-from-current).
- `interval_value_snapshot` preserves what each service meant at completion time.
- Model editor shows impact preview when cycle-defining interval changes (`impact-preview` API).
- Changes audited in `maintenance_interval_changes`.

## Observability

- Asset mantenimiento tab: `?debugCycles=1` — reasons trail per interval
- Fleet diagnostics: `/gestion/mantenimiento/diagnosticos` (API: `/api/maintenance/fleet-diagnostics`)

## Tests

```bash
npm run test:unit
```

BP-01 replay (`135b269a-b9a5-4f96-872e-83628f9186bd` @ 5130h) is the regression anchor.
