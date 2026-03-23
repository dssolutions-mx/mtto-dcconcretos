# Database: `profiles`, enums, RLS posture

## `profiles` row shape (TypeScript source of truth)

**Verified:** `types/supabase-types.ts` — `Database["public"]["Tables"]["profiles"]["Row"]`.

Auth-relevant columns (subset; full row includes HR fields):

| Column | Type (generated) | Purpose |
|--------|------------------|---------|
| `id` | `string` | User id (matches auth user) |
| `role` | `Database["public"]["Enums"]["user_role"] \| null` | Primary persisted role enum |
| `business_role` | `string \| null` | Business-layer role string |
| `business_unit_id` | `string \| null` | BU scope |
| `plant_id` | `string \| null` | Plant scope |
| `can_authorize_up_to` | `number \| null` | Monetary authorization ceiling |
| `role_scope` | `string \| null` | Scope hint stored in DB |
| `is_active` | `boolean` | Active flag |
| `status` | `string \| null` | Status string |

**App extension:** `types/index.ts` defines `Profile = DbTables['profiles']['Row'] & { plant?, business_unit?, assigned_assets?, office?, business_role?, role_scope?, warehouse_responsibility? }` — joined / enriched fields may not all exist on the raw `profiles` row.

**Client profile shape:** `types/auth-store.ts` — `UserProfile` includes `role`, `business_role`, `role_scope`, `warehouse_responsibility`, `plant_id`, `business_unit_id`, `can_authorize_up_to`, etc.

## `user_role` enum (generated)

**Verified:** `types/supabase-types.ts` — `Enums.user_role` — see [03-role-terminology-and-db-mapping.md](./03-role-terminology-and-db-mapping.md) for full list.

## Server authorization loading

**Verified:** `lib/auth/server-authorization.ts` — `loadActorContext(supabase, userId)` loads profile and builds `ActorContext` (effective business role, scope, authorization limit).

## RLS and live database (dated third-party report)

**Source:** [docs/2026-03-06-roles-po-rls-discovery-report.md](../../2026-03-06-roles-po-rls-discovery-report.md) — dated discovery; **not re-run** for this pack.

Facts stated in that report (summarize only; see original for evidence):

- Project reference: `mantenimiento`, Postgres 15, project id `txapndpstzcspgxlybll` (as of report date).  
- Tables **with RLS enabled** (per report): `purchase_orders`, `work_orders`, `inventory_warehouses`, `inventory_stock`, `inventory_movements`, `po_inventory_receipts`, `asset_operators`.  
- **`profiles`:** report states `rls_enabled: false` in live DB at time of report, described as intentional to avoid circular-reference breakage in authorization chain.  
- **Drift warning:** report notes live `user_role` enum at time of investigation may differ from app assumptions (e.g. `ENCARGADO_ALMACEN` handling).

**Banner:** Before security sign-off, re-check RLS and enums against **current** Supabase — this file does not claim live parity with `types/supabase-types.ts` on any remote environment.

## Checked-in types vs report

The **repository** `types/supabase-types.ts` at `f71dd87f008ac869c10ca07afce2c3eeb7e89a41` includes `GERENTE_MANTENIMIENTO`, `COORDINADOR_MANTENIMIENTO`, `MECANICO`, `RECURSOS_HUMANOS` in `user_role`. The March 2026 discovery report listed an older live enum snapshot **without** some of those values. Treat **generated types** as target schema for app builds; treat **discovery report** as historical live snapshot — reconcile in [07-gaps-drift-and-open-questions.md](./07-gaps-drift-and-open-questions.md).
