# Diesel analytics — product and technical spec (MantenPro)

## UX journey (industry-aligned)

1. **Overview** — Period filters, total consumption / entries / transfers, warehouse-level net flow (same scope as user’s plants/BU).
2. **By warehouse** — Pick warehouse → ranked assets (formal + external rows), liters, transaction count, last activity, optional L/h and L/km when `hours_consumed` / `kilometers_consumed` exist on rows.
3. **By asset + month** — Monthly buckets per asset **in that warehouse** (`year_month`), drill to transaction list with readings and evidence links.
4. **Exceptions** — Queue of data-quality and policy signals (no GPS): non-monotonic readings, missing denominator, duplicate window, after-hours dispense (configurable hours), implausible rate (conservative threshold). Each row includes human-readable **reason**.
5. **External equipment** — `exception_assets_review` + per-`exception_asset_name` from transactions; not a single “externos” aggregate.

## Metrics (definitions)

| Metric | Definition | Confidence |
|--------|------------|------------|
| Total consumption (period) | Sum `quantity_liters` where `transaction_type = consumption` and not transfer | High |
| Total entries (period) | Sum `quantity_liters` for `entry`, not transfer | High |
| Transfer volume (period) | Sum liters where `is_transfer` | High |
| L / engine hour (asset, period) | `SUM(liters) / NULLIF(SUM(hours_consumed), 0)` from transaction rows | Medium — only when `hours_consumed` populated |
| L / km (asset, period) | `SUM(liters) / NULLIF(SUM(kilometers_consumed), 0)` | Medium |
| Monthly liters | Sum by `year_month` in warehouse + asset dimension | High |

When denominator is missing: show **“Sin denominador”** — do not infer from checklists in v1 of the new API (avoids opaque client merges; checklist join can be a later RPC).

## Explicit non-goals

- Telematics: idle fuel, GPS distance-to-pump, CAN burn, driver scorecards.
- Physical dip / snapshot UI (separate initiative).
- Temperature/density correction.

## Job / OT attribution

- `work_order_id` / `service_order_id` exist on `diesel_transactions` but are **not** required in consumption forms today.
- Reporting v1 focuses on **warehouse + asset + time**. OT-level fuel reports require UI capture + spec extension.

## Tolerances (exception rules)

- **After-hours**: default `hour < 6` OR `hour >= 22` (local Mexico City) OR Saturday/Sunday — flag as `after_hours` (informational).
- **Duplicate window**: same `asset_id` (or same `exception_asset_name`), same calendar day, ≥2 transactions within **15 minutes** — `duplicate_burst`.
- **Non-monotonic**: formal asset, ordered by `transaction_date`: `horometer_reading` or `kilometer_reading` decreases vs previous non-null — `reading_rollback`.
- **Implausible rate**: if `hours_consumed > 0` and `quantity_liters / hours_consumed > 200` (L/h) — `implausible_rate` (tune later).

## Data sources

- Primary: `diesel_transactions`, `diesel_warehouses`, `diesel_products`, `assets`, `profiles` (scope).
- Views: `diesel_asset_consumption_by_warehouse`, `diesel_monthly_consumption_by_asset` (migration), existing `diesel_inventory_detailed`, `exception_assets_review`.
- APIs: server `createClient()` with user session; RLS applies.
