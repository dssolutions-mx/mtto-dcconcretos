# Gerencial Purchase Order Date Filtering

This note documents how purchase orders are included in the gerencial maintenance totals that feed `POST /api/reports/gerencial/ingresos-gastos`.

## Where this is implemented

- `lib/reports/run-gerencial-report.ts`
- `lib/reports/purchase-order-report-eligibility.ts`
- `lib/reports/ingresos-gastos-compute.ts`

`runIngresosGastosPost()` uses `runGerencialReport()` to build the maintenance numbers. The rollup path stores and serves snapshots built from the same rule, so this logic is the source of truth for both the live compute path and the KPI rollup.

## Purchase order status eligibility

The gerencial report excludes a purchase order from maintenance expense when `status` is any of:

- empty or null
- `draft`
- `rejected`
- `pending_approval`

The report includes purchase orders that have already crossed into operational or final states such as:

- `approved`
- `purchased`
- `receipt_uploaded`
- `ordered`
- `received`
- `fulfilled`
- `validated`

Important business rule: technical approval alone does not make a PO reportable. A PO that is still in `pending_approval` is excluded even if fields such as `authorized_by` are already populated.

## Date used for PO month and range filtering

The report filters each purchase order into the requested date range using this precedence:

1. `purchase_orders.purchase_date`
2. `work_orders.completed_at`
3. `work_orders.planned_date`
4. `work_orders.created_at`
5. `purchase_orders.created_at`

That means `purchase_date` is the primary date for month attribution whenever it exists. The PO creation timestamp is only a final fallback.

## Comparison behavior

Date filtering is done as date-only comparison in `YYYY-MM-DD` form:

- the report strips time and timezone data before comparing
- `dateFrom` and `dateTo` are inclusive
- this avoids timezone drift moving a PO into the wrong day or month

Examples:

- `2026-03-09` in `purchase_date` counts in March
- `2026-03-09T23:30:00-06:00` and `2026-03-10T05:30:00Z` both compare as the same date once normalized if they refer to the same stored calendar day string

## Why this matters

When someone checks a month total and expects a PO to appear, there are two separate gates to verify:

1. Is the PO already in a reportable status, or is it still `pending_approval`?
2. Which date won the precedence chain for that PO?

If either answer does not match the expectation, the maintenance total will differ.
