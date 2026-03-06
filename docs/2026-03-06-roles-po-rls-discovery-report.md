# Roles, Purchase Orders, and RLS Discovery Report

## Goal

Create a safe discovery baseline for changing roles, purchase-order routing, and warehouse responsibility without breaking authorization, RLS, or operational flows.

This report combines:

- codebase inspection
- live Supabase inspection for project `mantenimiento`
- current workflow and policy drift analysis
- a role/responsibility matrix
- a purchase-order routing matrix
- a phased implementation strategy

## Executive Summary

The system does not currently have a single source of truth for authorization or purchase-order routing.

The biggest discovery findings are:

1. Roles are duplicated across the frontend permission map, UI guards, sidebar logic, API allowlists, SQL policies, and database functions.
2. The live database already differs from checked-in assumptions in important ways.
3. `advance-workflow` is only one of several approval paths today. Email approval, direct SQL functions, inventory actions, and legacy creation flows can bypass or diverge from it.
4. Warehouse authority is not modeled as a dedicated responsibility. Today it is mostly approximated by broad role-based RLS plus route-level authentication.
5. `profiles` is especially sensitive because app code treats it as central auth state, and in the live DB its RLS is intentionally disabled to avoid circular-reference failures in the authorization chain.
6. The safest path is not a direct role rename. It is a staged compatibility migration across app permissions, API enforcement, SQL/RLS, and workflow orchestration.

## Live Database Facts

These findings came from the Supabase MCP against project `mantenimiento`:

- Project ID: `txapndpstzcspgxlybll`
- Status: `ACTIVE_HEALTHY`
- Database: Postgres 15

Important live DB facts:

- `purchase_orders`, `work_orders`, `inventory_warehouses`, `inventory_stock`, `inventory_movements`, `po_inventory_receipts`, and `asset_operators` all have RLS enabled.
- `profiles` currently shows `rls_enabled: false` in the live database, which matches the current system design choice to avoid circular-reference breakage.
- The live `user_role` enum includes:
  - `GERENCIA_GENERAL`
  - `JEFE_UNIDAD_NEGOCIO`
  - `ENCARGADO_MANTENIMIENTO`
  - `JEFE_PLANTA`
  - `DOSIFICADOR`
  - `OPERADOR`
  - `AUXILIAR_COMPRAS`
  - `AREA_ADMINISTRATIVA`
  - `EJECUTIVO`
  - `VISUALIZADOR`
  - `ENCARGADO_ALMACEN`

This is already notable drift, because the app does not consistently treat `ENCARGADO_ALMACEN` as a live first-class role.

## 1. Current Authorization Surface

### Current canonical roles by layer

App permission matrix:

- `lib/auth/role-permissions.ts`

Main roles found there:

- `GERENCIA_GENERAL`
- `JEFE_UNIDAD_NEGOCIO`
- `AREA_ADMINISTRATIVA`
- `ENCARGADO_MANTENIMIENTO`
- `JEFE_PLANTA`
- `AUXILIAR_COMPRAS`
- `DOSIFICADOR`
- `OPERADOR`
- `VISUALIZADOR`
- `EJECUTIVO`

Auth state and profile loading:

- `hooks/use-auth-zustand.ts`
- `store/slices/auth-slice.ts`
- `types/auth-store.ts`

Important characteristics:

- The app binds permission helpers to `profile.role`.
- `types/auth-store.ts` still uses `role: string`, so role drift is not caught by TypeScript.
- `auth-slice` loads `profiles` directly and makes the profile row the basis for UI and route access.

UI guards and route exposure:

- `components/auth/role-guard.tsx`
- `components/auth/role-provider.tsx`
- `components/sidebar.tsx`

Important characteristics:

- Role groups are duplicated in convenience guards.
- Sidebar visibility contains separate hard-coded role arrays.
- Some sections are organized around business assumptions, not just module permissions.

Database enum and schema surfaces:

- `complete_schema.sql`
- live DB `user_role` enum
- `types/supabase-types.ts`

Important characteristics:

- `complete_schema.sql` still reflects an older snapshot in several areas.
- `types/supabase-types.ts` is stale and not trustworthy as the live schema contract.

### Authorization drift findings

1. App and DB role definitions are out of sync.

- `lib/auth/role-permissions.ts` does not consistently reflect live DB role reality.
- Live DB includes `ENCARGADO_ALMACEN`, but the app discovery target for phase 1 is to avoid modeling warehouse responsibility as a pure role.

2. Generated types are stale.

- `types/supabase-types.ts` still exposes an incomplete `user_role` enum.
- This creates a dangerous false sense of safety around role migrations.

3. `role: string` weakens every layer above the DB.

- `types/auth-store.ts` lets role mismatches pass through the app unchecked.

4. Guards are duplicated.

- `components/auth/role-guard.tsx` contains hard-coded groups for admin, authorization, maintenance, and purchase access.
- `components/sidebar.tsx` contains separate hard-coded logic for procurement, compliance, and RH-style navigation.

5. API enforcement is fragmented.

- Many routes enforce role arrays independently.
- Others only check authentication and rely on RLS or SQL functions.
- Service-role routes bypass RLS entirely.

### Candidate centralization seam

The best future centralization seam is:

1. app role/responsibility definitions in `lib/auth/role-permissions.ts`
2. server-side shared authorization helpers for route handlers
3. SQL helper functions for scope and action checks
4. RLS policies built on those helper functions

Today, those four layers are not unified.

## 2. Warehouse Responsibility Discovery

### Confirmed target model

The future state should not require `ENCARGADO_ALMACEN` as the main identity model.

Instead:

- the user keeps a primary role, such as `COORDINADOR_MANTENIMIENTO`
- warehouse custody is assigned as a responsibility
- release authority is conditional on policy, not just module access

### Current state

UI:

- `components/purchase-orders/inventory-actions.tsx`
- `components/inventory/receive-po-dialog.tsx`
- `components/inventory/fulfill-po-dialog.tsx`
- `components/work-orders/inventory-actions.tsx`
- `components/inventory/stock-management.tsx`

Current behavior:

- inventory receipt and fulfillment buttons are shown based mostly on PO or work-order state
- they are not explicitly gated by inventory-write permission or warehouse assignment

API and services:

- `app/api/purchase-orders/[id]/receive-to-inventory/route.ts`
- `app/api/purchase-orders/[id]/fulfill-from-inventory/route.ts`
- `app/api/inventory/stock/adjust/route.ts`
- `app/api/inventory/stock/transfer/route.ts`
- `app/api/inventory/warehouses/route.ts`
- `app/api/inventory/movements/route.ts`
- `lib/services/inventory-receipt-service.ts`
- `lib/services/inventory-fulfillment-service.ts`
- `lib/services/movement-service.ts`

Current behavior:

- most routes only enforce authentication
- most services do not load `profiles`
- effective authority is pushed down into RLS and table/function access

RLS:

- `migrations/sql/20250125_006_create_inventory_rls.sql`

Current behavior:

- inventory access is role-based and organization-scoped
- it is not warehouse-assignment-scoped
- write access is broad for supervisor-like roles

### Key findings

1. There is no native warehouse-assignment model today.

- No dedicated user-to-warehouse assignment table exists in the inventory schema.

2. Inventory authority is currently broader than the desired responsibility model.

- broad role groups can write inventory stock and movements
- routes do not add extra app-level restrictions

3. The current model is better suited to `role + scoped assignment` than to `new standalone role`.

- a standalone `ENCARGADO_ALMACEN` role would still not solve warehouse-level scope
- an assignment model matches the actual business intent better

### Modeling options

#### Option A: `profiles` flag

Example concept:

- `profiles.is_warehouse_responsible`
- maybe also `profiles.warehouse_scope_type`

Pros:

- simplest to thread through existing auth/profile loading
- easiest to expose in UI quickly

Cons:

- poor fit for multi-warehouse assignment
- weak for temporary or delegated custody
- still needs SQL policy redesign to become authoritative

Assessment:

- acceptable only as a short-lived compatibility measure

#### Option B: dedicated assignment table

Example concept:

- `warehouse_responsibilities`
- `user_id`
- `warehouse_id`
- `plant_id`
- `can_release_inventory`
- `can_receive_inventory`
- `can_adjust_inventory`
- effective dates

Pros:

- best fit for the business rule
- supports specific users, multiple warehouses, temporary coverage, and action-level authority
- aligns well with future auditability

Cons:

- largest implementation surface
- requires RLS, API, and UI redesign

Assessment:

- best long-term model for this project

#### Option C: scoped permission model only

Example concept:

- extend permissions to `inventory.release`, `inventory.receive`, `inventory.adjust`
- derive scope from role plus plant/business unit

Pros:

- aligns with existing module-permission thinking
- good for UI behavior

Cons:

- not enough on its own
- if not backed by RLS or route-level checks, it stays cosmetic

Assessment:

- should complement the assignment table, not replace it

### Recommendation

Target warehouse authority should become:

- primary role
- plus warehouse assignment table
- plus action-level scoped permissions

Not:

- standalone warehouse role only

## 3. Purchase-Order Routing Discovery

### Current workflow entry points

Creation:

- `app/ordenes/[id]/generar-oc/page.tsx`
- `app/compras/crear-tipificada/page.tsx`
- `components/purchase-orders/creation/EnhancedPurchaseOrderCreationForm.tsx`
- `components/purchase-orders/creation/DirectPurchaseForm.tsx`
- `components/purchase-orders/creation/DirectServiceForm.tsx`
- `components/purchase-orders/creation/SpecialOrderForm.tsx`
- legacy path in `components/work-orders/purchase-order-form.tsx`

Approval and workflow:

- `components/purchase-orders/workflow/WorkflowStatusDisplay.tsx`
- `hooks/usePurchaseOrders.ts`
- `app/api/purchase-orders/advance-workflow/[id]/route.ts`
- `lib/services/purchase-order-service.ts`
- SQL function `advance_purchase_order_workflow`

Quotation handling:

- `app/api/purchase-orders/quotations/route.ts`
- `app/api/purchase-orders/quotations/[id]/select/route.ts`
- SQL `select_quotation`
- SQL `requires_quotation`

Inventory actions:

- `components/purchase-orders/inventory-actions.tsx`
- `app/api/purchase-orders/[id]/fulfill-from-inventory/route.ts`
- `app/api/purchase-orders/[id]/receive-to-inventory/route.ts`
- `lib/services/inventory-fulfillment-service.ts`
- `lib/services/inventory-receipt-service.ts`

Email approval:

- `supabase/functions/purchase-order-approval-notification/index.ts`
- `app/api/purchase-order-actions/direct-action/route.ts`
- `app/api/purchase-order-actions/process/route.ts`
- SQL from `20250730_po_email_actions` and `20260211_add_po_action_tokens_quotation_and_user`

### Current routing inputs and where they come from

`po_purpose`:

- derived differently by creation form
- not normalized in one place

`work_order.type`:

- used near work-order creation entrypoints
- not persisted in a way the PO engine consistently consumes later

`total_amount`:

- derived differently by different PO types
- sometimes based on quotations, sometimes manual estimate, sometimes average quotation

`payment_method`:

- set in creation forms
- later checked in service/API logic

selected quotation:

- stored as `selected_quotation_id`
- but selection does not fully rewrite the PO economic state

organizational scope:

- derived partly from profile plant/business unit
- partly from plant resolution in `advance-workflow`
- partly from SQL authorization RPCs

### Key routing findings

1. `advance-workflow` is not yet the only workflow engine.

It is one important engine, but not the only one:

- email approval has its own path
- inventory actions change fulfillment state outside the main status path
- legacy creation still exists
- SQL functions participate directly in several approval decisions

2. Preventive vs corrective context is not a stable PO-level routing input.

This is critical because the new four-path policy depends on it.

Right now:

- preventive/corrective context lives mainly in work-order context
- downstream PO routing does not consistently use it

3. Approval scope is split across three systems.

- app route logic in `advance-workflow`
- SQL RPC authorizer helpers
- edge/email notification logic

4. Data used for approval may be stale or differently interpreted.

- quotation selection does not fully normalize PO financial state
- `total_amount` can mean different things depending on form type

5. Inventory execution is not tightly coupled to workflow progression.

- receipt and fulfillment update flags
- they do not inherently drive the central workflow engine

### What must be true before the new four-path logic is safe

The future routing engine must consume stable, normalized inputs:

- `po_purpose`
- `work_order_type` or equivalent preventive/corrective indicator
- `total_amount`
- `payment_condition`
- scope of requester
- scope and authority of technical approver
- viability result
- warehouse release eligibility

## 4. Data Dependency Audit

### Required routing inputs

The new policy requires these inputs to be authoritative:

| Input | Current state | Risk |
| --- | --- | --- |
| `po_purpose` | Derived inconsistently by creation form | Same business case can route differently |
| `work_order.type` | Available in work-order context, not normalized for PO routing | Four-path engine cannot branch reliably |
| `total_amount` | Derived differently across PO types | Threshold escalation can disagree |
| `payment_method` / payment condition | Exists, but viability presentation is not guaranteed | Administration may not get the right financial signal |
| quotation state | Selected quotation does not fully normalize PO economics | Approval may use stale amount/items |
| org scope | Derived by route logic and SQL functions separately | Scope decisions can drift |

### Most important missing normalized concepts

Before implementing the new routing policy, the system likely needs:

- a normalized PO-level indicator for preventive vs corrective context
- a canonical monetary amount used for approval decisions
- a canonical payment condition field for Administration review
- a canonical action/result model for viability review

## 5. Personnel, RH, and Compliance Ownership Discovery

### Current user lifecycle

Creation:

- `app/api/operators/register/route.ts`
- uses `lib/supabase-admin.ts`
- creates auth user via service role and inserts into `profiles`

Role and authorization changes:

- `app/api/users/update-authorization/route.ts`
- current allowlist includes `GERENCIA_GENERAL`, `JEFE_UNIDAD_NEGOCIO`, `AREA_ADMINISTRATIVA`

Deactivation:

- `app/api/users/deactivate/route.ts`
- current allowlist includes `GERENCIA_GENERAL`, `JEFE_UNIDAD_NEGOCIO`

Deletion:

- `app/api/users/[id]/route.ts`
- only `GERENCIA_GENERAL`

### Current personnel and asset-assignment ownership

Personnel placement:

- `components/personnel/personnel-management-drag-drop.tsx`
- `app/api/operators/register/[id]/route.ts`

Operator assignment:

- `app/api/asset-operators/route.ts`
- `app/api/asset-operators/transfer/route.ts`

Key finding:

- active asset-assignment routes mainly check authentication, not explicit role/scope allowlists

### Current compliance and RH ownership

Compliance domain:

- `migrations/sql/20251220_compliance_governance_system.sql`
- `migrations/sql/20251220_compliance_functions.sql`
- `app/api/compliance/incidents/[id]/dispute/review/route.ts`
- `app/api/compliance/sanctions/route.ts`
- `components/compliance/compliance-incident-detail-page.tsx`

RH-branded reporting:

- `app/rh/cumplimiento-checklists/page.tsx`
- `components/hr/checklist-compliance-view.tsx`
- `app/api/hr/checklist-compliance/route.ts`

Key findings:

1. There is no live `RECURSOS_HUMANOS` ownership model yet.
2. Personnel and compliance ownership are currently split across:
   - `AREA_ADMINISTRATIVA`
   - `EJECUTIVO`
   - plant and business-unit leadership
   - operational maintenance roles
3. RH exists more as a reporting/navigation idea than as a full authority domain.

## 6. Role and Responsibility Matrix

| Capability | Current role(s) or authority | Future primary role(s) | Future responsibility assignment | Scope | Current enforcement layer | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| Create PO | `ENCARGADO_MANTENIMIENTO`, `JEFE_PLANTA`, others via purchase permissions and current flow drift | `COORDINADOR_MANTENIMIENTO` | No | Plant or BU | UI, API, service, SQL | High |
| Technical PO approval | `JEFE_UNIDAD_NEGOCIO`, `GERENCIA_GENERAL` in current route logic | `GERENTE_MANTENIMIENTO` | No | Global or BU/plant by assignment model | API, SQL, email, notifications | High |
| Final GM escalation approval | `GERENCIA_GENERAL` | `GERENCIA_GENERAL` | No | Global | API, SQL, email | Medium |
| Viability review | `AREA_ADMINISTRATIVA` style logic, receipt validation also partly admin | `AREA_ADMINISTRATIVA` or equivalent admin finance owner | No | Global | API, UI, workflow | High |
| Accounts payable continuation | Mixed current behavior | Administrative finance owner | No | Global | UI and workflow conventions | Medium |
| Manage supplier registry | `AREA_ADMINISTRATIVA` plus some purchase surfaces | `AREA_ADMINISTRATIVA` with maintenance collaboration | No | Global | UI, API, table access | Medium |
| Create work order | Maintenance operational roles | `COORDINADOR_MANTENIMIENTO` | No | Plant or BU | UI, API, SQL | Medium |
| Upload WO evidence | Assigned technicians and operator-like roles | `MECANICO` | No | Plant / assignment | UI, API, storage, SQL | Medium |
| Release inventory | Broad inventory supervisor-style roles today | Primary role varies | Yes, warehouse custody assignment | Warehouse / plant | UI, API, service, RLS | High |
| Receive to inventory | Broad inventory supervisor-style roles today | Primary role varies | Yes, warehouse custody assignment | Warehouse / plant | UI, API, service, RLS | High |
| Create inventory movement | Broad inventory supervisor-style roles today | Primary role varies | Yes, by movement action | Warehouse / plant | API, service, RLS | High |
| Adjust inventory | Manager-only subset in SQL | Primary role varies | Yes, likely restricted assignment | Warehouse / plant | API, service, RLS | High |
| Cycle counts | Not clearly isolated today | Warehouse-responsible user | Yes | Warehouse / plant | UI and future API/RLS | Medium |
| Block delivery without approved PO | Not explicitly modeled as responsibility | Warehouse-responsible user | Yes | Warehouse / plant | Workflow + inventory execution | High |
| Create user/profile | `GERENCIA_GENERAL`, `JEFE_UNIDAD_NEGOCIO`, `JEFE_PLANTA`, `ENCARGADO_MANTENIMIENTO`, `EJECUTIVO` today | `RECURSOS_HUMANOS` | No | Global | API + service-role admin | High |
| Change user role / limits | `GERENCIA_GENERAL`, `JEFE_UNIDAD_NEGOCIO`, `AREA_ADMINISTRATIVA` today | `RECURSOS_HUMANOS` | No | Global | API | High |
| Deactivate user | `GERENCIA_GENERAL`, `JEFE_UNIDAD_NEGOCIO` today | `RECURSOS_HUMANOS` plus high-trust exceptions | No | Global | API + service-role admin | High |
| Delete user | `GERENCIA_GENERAL` today | likely keep restricted | No | Global | API + service-role admin | High |
| Reassign operator to asset | Authenticated route today, weak role gating | `RECURSOS_HUMANOS` for personnel ownership, with operational coordination seam | No | Plant / BU | API, RPC, UI | High |
| Review compliance incident | Managers + admin combinations today | `RECURSOS_HUMANOS` | No | Global | UI, API, SQL | High |
| Close conciliation/dispute outcome | Managers + admin combinations today | `RECURSOS_HUMANOS` | No | Global | UI, API, SQL | High |

## 7. Purchase-Order Routing Matrix

| Path | Context conditions | Required approvals | Skip conditions | Escalation threshold | Final releaser / validator | Where logic lives today | Where logic should live later |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Internal inventory for preventive work | `po_purpose = work_order_inventory` and preventive WO | Technical approval by maintenance leader | Skip Administration, skip GM | None | Warehouse-responsible user releases inventory | Currently split across creation forms, `advance-workflow`, inventory actions, and services | Central workflow engine plus warehouse-assignment checks |
| B. Internal inventory for corrective work | `po_purpose = work_order_inventory` and corrective WO | Technical approval by maintenance leader | Skip Administration | `>= 7000 MXN` to GM | Warehouse-responsible user if below threshold, otherwise post-GM release | Currently not modeled end to end | Central workflow engine with normalized WO type and amount |
| C. Inventory restock | `po_purpose = inventory_restock` with no WO | Technical approval and Administration viability | None | `>= 7000 MXN` to GM | Admin/finance completes viability, then inventory receipt/release path | Currently split between forms, auth RPCs, `advance-workflow`, receipt routes | Central workflow engine with viability state and amount-based escalation |
| D1. External or mixed for preventive WO | `po_purpose = work_order_cash` or `mixed`, preventive WO | Technical approval, Administration viability | Skip GM | None | Accounts payable or downstream procurement completion | Currently only partially represented | Central workflow engine with explicit preventive branch |
| D2. External or mixed for corrective WO | `po_purpose = work_order_cash` or `mixed`, corrective WO | Technical approval, Administration viability | None | `>= 7000 MXN` to GM | Admin/finance then GM if needed | Currently split and not normalized | Central workflow engine with explicit corrective branch |

## 8. Major Risks

### Authorization and RLS risks

1. Role drift already exists between app, schema, and live DB.
2. `profiles` is critical to auth state and intentionally operates as a special-case table without RLS, so surrounding auth and policy changes must avoid reintroducing circular references.
3. Service-role routes bypass the normal scope model.
4. Some APIs rely only on auth and leave authorization to the DB.
5. Some UI paths expose actions the backend may later reject.

### Workflow risks

1. `advance-workflow` is not the only approval path.
2. Email approval is a separate stack that can bypass future logic.
3. Preventive vs corrective is not yet a normalized routing input.
4. PO amount semantics are inconsistent.
5. Inventory execution and workflow progression are not tightly unified.

### Organizational migration risks

1. `RECURSOS_HUMANOS` is not additive; it displaces current authority held by several roles.
2. Warehouse custody cannot be solved by role rename alone.
3. Existing docs and comments still describe obsolete thresholds and flows.

## 9. Recommended Phased Implementation Strategy

### Phase 0: Freeze and inventory

Before any role or workflow change:

- freeze role-name churn
- freeze ad hoc RLS edits
- identify every active route and function that touches PO approvals, user admin, inventory movement, and compliance ownership

Deliverables:

- this discovery report
- explicit file inventory
- agreed target business rules

### Phase 1: Introduce compatibility concepts without changing live authority yet

Implement only compatibility structures:

- add a normalized future role model in app code
- add a role-mapping layer from current roles to future business roles
- define warehouse responsibility as a separate concept
- define explicit workflow decision inputs

Do not yet:

- rename DB enum values
- cut over RLS
- move email approval logic

### Phase 2: Normalize workflow inputs

Before routing changes:

- persist a stable PO-level preventive/corrective indicator
- normalize the canonical approval amount
- normalize payment condition for Administration review
- define explicit viability state

Goal:

- make the routing engine deterministic

### Phase 3: Centralize server-side authorization

Create shared server helpers for:

- role mapping
- action authorization
- scope resolution
- warehouse responsibility checks

Then migrate route handlers to use them.

Goal:

- remove duplicated role arrays from route files

### Phase 4: Build the new workflow engine

Refactor the approval system so that:

- one central engine computes the next allowed action
- one central engine computes approver requirements
- one central engine handles the four routing paths

Then make these consumers use it:

- `advance-workflow`
- workflow status API
- email approval processing
- notification selection logic
- viability UI

### Phase 5: Introduce warehouse responsibility properly

Add:

- assignment table
- scoped warehouse actions
- UI action gating
- route/service checks
- RLS helper functions and policies

Goal:

- warehouse release and receipt become responsibility-based, not broad-role-based

### Phase 6: Migrate personnel and RH ownership

Add `RECURSOS_HUMANOS` as a real authority domain only after:

- user lifecycle routes are centralized
- operator assignment ownership is disentangled from general personnel updates
- compliance review ownership is explicitly reassigned

### Phase 7: Migrate DB roles and RLS

Only after all app and server compatibility exists:

- update DB enum usage
- migrate policies and helper functions
- regenerate types
- remove legacy role assumptions

### Phase 8: Rollout and rollback controls

For rollout safety:

- feature-flag the new workflow engine if possible
- verify old and new approval entrypoints produce the same routing result before cutover
- add migration verification scripts for role coverage and policy behavior
- keep rollback path for:
  - workflow routing
  - email approval processing
  - inventory responsibility enforcement

## 10. Verification Checklist For The Later Implementation Phase

Before claiming the migration is safe later, verify:

- every active approval entrypoint uses the same routing engine
- the same PO gets the same approver path from UI, API, SQL, and email channels
- warehouse-responsible users can operate only within assigned scope
- non-assigned users cannot release or receive inventory even if they can access purchases
- `RECURSOS_HUMANOS` owns user creation, reassignment, and compliance closure where intended
- stale generated types are regenerated and aligned to the live schema
- all changed routes still work under RLS

## Bottom Line

The safe path is a staged migration from:

- duplicated role logic
- fragmented PO routing
- broad inventory authority

to:

- normalized role and responsibility concepts
- one authoritative purchase-order routing engine
- scoped warehouse responsibility
- deliberate RLS migration only after compatibility seams exist
