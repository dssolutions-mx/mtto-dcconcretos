# Roles, Purchase Orders, and RLS Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the system to the new role model and purchase-order approval flow without breaking authorization, inventory controls, email approvals, or the intentionally non-RLS `profiles` auth foundation.

**Architecture:** Introduce compatibility layers before changing live authority. Normalize purchase-order routing inputs, centralize server-side authorization and workflow policy decisions, model warehouse custody as a scoped assignment instead of a standalone role, and only then migrate SQL/RLS/types. Keep `profiles` as a special-case table without RLS to avoid circular-reference failures; express new authority through helper functions, scoped tables, and RLS on dependent tables instead.

**Tech Stack:** Next.js App Router, TypeScript, Zustand auth, Supabase SSR, Supabase Postgres functions/RLS, Edge Functions, ESLint, Playwright as a separate post-implementation verification track

---

## Preconditions

- Discovery source of truth: `docs/2026-03-06-roles-po-rls-discovery-report.md`
- Do not enable RLS on `profiles`
- Do not rename current DB enum values early
- Do not implement the new PO flow only in UI
- Do not leave email approval on legacy branching once workflow migration starts
- Defer Playwright automation until after the migration is complete and dedicated test users exist for the new roles

## Task 1: Establish Compatibility Domain Model

**Files:**
- Create: `lib/auth/role-model.ts`
- Create: `lib/auth/warehouse-responsibility.ts`
- Modify: `lib/auth/role-permissions.ts`
- Modify: `types/index.ts`
- Modify: `types/auth-store.ts`
- Modify: `hooks/use-auth-zustand.ts`

**Step 1: Create the future role model module**

Define:

- legacy roles
- future business roles
- mapping from legacy DB role to future business role
- role scope metadata
- helper predicates for:
  - technical approver
  - viability reviewer
  - GM escalator
  - RH owner

Target file: `lib/auth/role-model.ts`

**Step 2: Create warehouse responsibility helpers**

Define a responsibility contract that is separate from role:

- `canReleaseInventory`
- `canReceiveInventory`
- `canAdjustInventory`
- `isWarehouseResponsible`

Target file: `lib/auth/warehouse-responsibility.ts`

This file should remain app-level only at first and must not assume the final schema exists yet.

**Step 3: Refactor auth-facing helpers to consume the compatibility model**

Update:

- `lib/auth/role-permissions.ts`
- `hooks/use-auth-zustand.ts`
- `types/index.ts`
- `types/auth-store.ts`

Goals:

- stop hardcoding scattered role semantics as plain strings where possible
- keep legacy role support intact
- add types for future business roles and warehouse responsibility concepts

**Step 4: Run targeted verification**

Run: `npx eslint lib/auth/role-model.ts lib/auth/warehouse-responsibility.ts lib/auth/role-permissions.ts types/index.ts types/auth-store.ts hooks/use-auth-zustand.ts`

Expected: exit code `0`

Run: `npm run build`

Expected: `next build` completes successfully

## Task 2: Normalize Purchase-Order Routing Inputs

**Files:**
- Create: `lib/purchase-orders/routing-context.ts`
- Create: `lib/purchase-orders/payment-condition.ts`
- Modify: `types/purchase-orders.ts`
- Modify: `app/api/purchase-orders/create-typed/route.ts`
- Modify: `lib/services/purchase-order-service.ts`
- Modify: `components/purchase-orders/creation/DirectPurchaseForm.tsx`
- Modify: `components/purchase-orders/creation/DirectServiceForm.tsx`
- Modify: `components/purchase-orders/creation/SpecialOrderForm.tsx`
- Modify: `app/ordenes/[id]/generar-oc/page.tsx`

**Step 1: Define canonical routing inputs**

Create `lib/purchase-orders/routing-context.ts` that builds a normalized PO routing context containing:

- `poPurpose`
- `workOrderType`
- `approvalAmount`
- `paymentCondition`
- `requesterScope`
- `requiresQuotation`

**Step 2: Define canonical payment condition semantics**

Create `lib/purchase-orders/payment-condition.ts` that resolves:

- `cash`
- `credit`
- fallback behavior when supplier/provider metadata is incomplete

Administration viability must consume this value later.

**Step 3: Add routing fields to shared PO types**

Update `types/purchase-orders.ts` so the domain can represent:

- normalized work-order type
- viability state
- approval amount source
- payment condition

Do not remove backward-compatible fields yet.

**Step 4: Refactor typed PO creation to compute one canonical context**

Update:

- `app/api/purchase-orders/create-typed/route.ts`
- `lib/services/purchase-order-service.ts`
- all three creation forms
- `app/ordenes/[id]/generar-oc/page.tsx`

Goals:

- each creation entrypoint produces the same routing input shape
- `po_purpose` is not derived differently depending on UI path
- preventive/corrective context stops living only in launch pages
- one canonical amount is stored for approval logic

**Step 5: Run targeted verification**

Run: `npx eslint lib/purchase-orders/routing-context.ts lib/purchase-orders/payment-condition.ts types/purchase-orders.ts app/api/purchase-orders/create-typed/route.ts lib/services/purchase-order-service.ts components/purchase-orders/creation/DirectPurchaseForm.tsx components/purchase-orders/creation/DirectServiceForm.tsx components/purchase-orders/creation/SpecialOrderForm.tsx app/ordenes/[id]/generar-oc/page.tsx`

Expected: exit code `0`

Run: `npm run build`

Expected: `next build` completes successfully

## Task 3: Centralize Server-Side Authorization And Workflow Policy

**Files:**
- Create: `lib/auth/server-authorization.ts`
- Create: `lib/purchase-orders/workflow-policy.ts`
- Modify: `app/api/purchase-orders/advance-workflow/[id]/route.ts`
- Modify: `app/api/authorization/purchase-order/route.ts`
- Modify: `app/api/users/update-authorization/route.ts`
- Modify: `app/api/operators/register/route.ts`
- Modify: `app/api/operators/register/[id]/route.ts`
- Modify: `app/api/users/deactivate/route.ts`
- Modify: `app/api/users/[id]/route.ts`

**Step 1: Create server-side authorization helpers**

Create `lib/auth/server-authorization.ts` with helpers that:

- load current actor profile
- resolve effective future business role
- check scope
- check RH ownership authority
- check technical approval authority

These helpers must not rely on RLS for `profiles`; they should explicitly query `profiles` using the SSR authenticated client, matching the current system design.

**Step 2: Create workflow-policy helpers**

Create `lib/purchase-orders/workflow-policy.ts` that codifies the four PO paths:

- Path A: `work_order_inventory` + preventive
- Path B: `work_order_inventory` + corrective
- Path C: `inventory_restock`
- Path D: `work_order_cash` or `mixed`

It must also encode:

- Administration viability requirement
- GM escalation threshold `>= 7000 MXN`
- preventive vs corrective branching
- skip rules

**Step 3: Refactor the main approval endpoints to use shared helpers**

Update:

- `app/api/purchase-orders/advance-workflow/[id]/route.ts`
- `app/api/authorization/purchase-order/route.ts`

Goals:

- suggested approvers and actual approvers follow the same rule engine
- remove duplicated role branching
- stop hardcoding legacy BU-manager-only logic

**Step 4: Refactor personnel administration routes to use shared authz**

Update all listed user-admin routes so they use the same server helper rather than local arrays.

**Step 5: Run targeted verification**

Run: `npx eslint lib/auth/server-authorization.ts lib/purchase-orders/workflow-policy.ts app/api/purchase-orders/advance-workflow/[id]/route.ts app/api/authorization/purchase-order/route.ts app/api/users/update-authorization/route.ts app/api/operators/register/route.ts app/api/operators/register/[id]/route.ts app/api/users/deactivate/route.ts app/api/users/[id]/route.ts`

Expected: exit code `0`

Run: `npm run build`

Expected: `next build` completes successfully

## Task 4: Implement The New PO Workflow Engine

**Files:**
- Modify: `lib/services/purchase-order-service.ts`
- Modify: `app/api/purchase-orders/advance-workflow/[id]/route.ts`
- Modify: `app/api/purchase-orders/workflow-status/[id]/route.ts`
- Modify: `components/purchase-orders/workflow/WorkflowStatusDisplay.tsx`
- Modify: `components/work-orders/purchase-orders-list.tsx`
- Modify: `app/compras/[id]/page.tsx`
- Modify: `app/compras/[id]/mobile/page.tsx`

**Step 1: Make the app-layer workflow engine authoritative before SQL migration**

Refactor `advance-workflow` and `purchase-order-service` so they route using the canonical workflow-policy helper.

Behavior required:

- Path A: technical approval -> warehouse release, skip admin and GM
- Path B: technical approval -> GM only if `>= 7000`
- Path C: technical approval -> viability -> GM if `>= 7000`
- Path D preventive: technical approval -> viability -> CxP, no GM
- Path D corrective: technical approval -> viability -> GM if `>= 7000`

**Step 2: Add viability state and UI**

Update workflow status and `WorkflowStatusDisplay` so Administration sees:

- payment condition highlighted clearly
- viability action/status
- correct next step for each path

**Step 3: Make detail/list UIs represent first approval, viability, and final approval consistently**

Update:

- `components/work-orders/purchase-orders-list.tsx`
- `app/compras/[id]/page.tsx`
- `app/compras/[id]/mobile/page.tsx`

Goal:

- the user should see the real workflow state, not only legacy `approved_by`

**Step 4: Run targeted verification**

Run: `npx eslint lib/services/purchase-order-service.ts app/api/purchase-orders/advance-workflow/[id]/route.ts app/api/purchase-orders/workflow-status/[id]/route.ts components/purchase-orders/workflow/WorkflowStatusDisplay.tsx components/work-orders/purchase-orders-list.tsx app/compras/[id]/page.tsx app/compras/[id]/mobile/page.tsx`

Expected: exit code `0`

Run: `npm run build`

Expected: `next build` completes successfully

## Task 5: Align Email Approval And Notification Paths

**Files:**
- Modify: `app/api/purchase-order-actions/process/route.ts`
- Modify: `app/api/purchase-order-actions/direct-action/route.ts`
- Modify: `supabase/functions/purchase-order-approval-notification/index.ts`
- Modify: `archive/legacy-db-migrations/sql/20250730_po_email_actions.sql`
- Modify: `archive/legacy-db-migrations/sql/20260211_add_po_action_tokens_quotation_and_user.sql`

**Step 1: Remove workflow drift between UI and email approval**

Refactor email-action processing so it consults the same routing and authorization decisions used by `advance-workflow`.

**Step 2: Update notification recipient selection**

Edge-function behavior must align with:

- technical approver role
- administration viability stage
- GM escalation threshold `>= 7000`
- skipped steps for preventive inventory and preventive external/mixed flows

**Step 3: Run targeted verification**

Run: `npx eslint app/api/purchase-order-actions/process/route.ts app/api/purchase-order-actions/direct-action/route.ts supabase/functions/purchase-order-approval-notification/index.ts`

Expected: exit code `0`

Run: `npm run build`

Expected: `next build` completes successfully

## Task 6: Implement Warehouse Responsibility Model

**Files:**
- Create: `archive/legacy-db-migrations/sql/20260306_create_warehouse_responsibilities.sql`
- Create: `lib/inventory/warehouse-authority.ts`
- Modify: `components/purchase-orders/inventory-actions.tsx`
- Modify: `components/inventory/receive-po-dialog.tsx`
- Modify: `components/inventory/fulfill-po-dialog.tsx`
- Modify: `app/api/purchase-orders/[id]/receive-to-inventory/route.ts`
- Modify: `app/api/purchase-orders/[id]/fulfill-from-inventory/route.ts`
- Modify: `app/api/inventory/stock/adjust/route.ts`
- Modify: `app/api/inventory/stock/transfer/route.ts`
- Modify: `lib/services/inventory-receipt-service.ts`
- Modify: `lib/services/inventory-fulfillment-service.ts`
- Modify: `archive/legacy-db-migrations/sql/20250125_006_create_inventory_rls.sql`

**Step 1: Add a dedicated warehouse responsibility table**

Create migration `archive/legacy-db-migrations/sql/20260306_create_warehouse_responsibilities.sql` with fields for:

- `user_id`
- `warehouse_id`
- `plant_id`
- `can_release_inventory`
- `can_receive_inventory`
- `can_adjust_inventory`
- effective dates
- audit fields

Do not use `profiles` RLS or role mutation for this.

**Step 2: Add warehouse authority helpers**

Create `lib/inventory/warehouse-authority.ts` that resolves warehouse permissions from:

- primary role compatibility
- warehouse assignment rows
- organizational scope

**Step 3: Gate UI actions**

Update `components/purchase-orders/inventory-actions.tsx` and dialogs so users only see inventory actions they can perform.

**Step 4: Gate routes and services**

Update the listed API routes and services so authz is checked before stock movement is attempted.

**Step 5: Update inventory RLS**

Refactor inventory RLS so write authority depends on warehouse assignment and action type, not only broad role membership.

Do not introduce `profiles` RLS.

**Step 6: Run targeted verification**

Run: `npx eslint lib/inventory/warehouse-authority.ts components/purchase-orders/inventory-actions.tsx components/inventory/receive-po-dialog.tsx components/inventory/fulfill-po-dialog.tsx app/api/purchase-orders/[id]/receive-to-inventory/route.ts app/api/purchase-orders/[id]/fulfill-from-inventory/route.ts app/api/inventory/stock/adjust/route.ts app/api/inventory/stock/transfer/route.ts lib/services/inventory-receipt-service.ts lib/services/inventory-fulfillment-service.ts`

Expected: exit code `0`

Run: `npm run build`

Expected: `next build` completes successfully

## Task 7: Introduce RH Ownership For Personnel And Conciliation

**Files:**
- Modify: `components/auth/user-registration-tool.tsx`
- Modify: `components/personnel/personnel-management-drag-drop.tsx`
- Modify: `app/api/operators/register/route.ts`
- Modify: `app/api/operators/register/[id]/route.ts`
- Modify: `app/api/users/update-authorization/route.ts`
- Modify: `app/api/users/deactivate/route.ts`
- Modify: `app/api/users/[id]/route.ts`
- Modify: `app/api/asset-operators/route.ts`
- Modify: `app/api/asset-operators/transfer/route.ts`
- Modify: `app/api/compliance/incidents/[id]/dispute/review/route.ts`
- Modify: `app/api/compliance/sanctions/route.ts`
- Modify: `app/api/compliance/sanctions/[id]/route.ts`
- Modify: `app/api/hr/checklist-compliance/route.ts`

**Step 1: Add RH as the new primary owner in app/server authorization**

Refactor listed routes and UI so `RECURSOS_HUMANOS` becomes the owner for:

- profile creation
- role changes
- operator reassignment governance
- conciliation/compliance closure

Keep explicit exceptions for `GERENCIA_GENERAL` only where required.

**Step 2: Separate personnel master-data ownership from operational side effects**

Refactor `operators/register/[id]` and asset-assignment endpoints so HR ownership does not directly imply uncontrolled asset reassignment behavior.

**Step 3: Protect RH reporting**

Add explicit route-level authorization to `app/api/hr/checklist-compliance/route.ts`.

**Step 4: Run targeted verification**

Run: `npx eslint components/auth/user-registration-tool.tsx components/personnel/personnel-management-drag-drop.tsx app/api/operators/register/route.ts app/api/operators/register/[id]/route.ts app/api/users/update-authorization/route.ts app/api/users/deactivate/route.ts app/api/users/[id]/route.ts app/api/asset-operators/route.ts app/api/asset-operators/transfer/route.ts app/api/compliance/incidents/[id]/dispute/review/route.ts app/api/compliance/sanctions/route.ts app/api/compliance/sanctions/[id]/route.ts app/api/hr/checklist-compliance/route.ts`

Expected: exit code `0`

Run: `npm run build`

Expected: `next build` completes successfully

## Task 8: Migrate SQL, Types, And Compatibility Gaps

**Files:**
- Modify: `archive/legacy-db-migrations/sql/20260129_update_status_workflow_for_inventory.sql`
- Modify: `archive/legacy-db-migrations/sql/20260123_purchase_order_quotations.sql`
- Modify: `complete_schema.sql`
- Modify: `types/supabase-types.ts`
- Modify: `types/index.ts`

**Step 1: Move the four-path logic into SQL only after app compatibility exists**

Update SQL workflow and quotation functions to match the same policy decisions already proven in app/server code.

**Step 2: Keep `profiles` as a no-RLS special-case table**

Do not add `profiles` RLS here.

**Step 3: Regenerate or reconcile generated types**

Update `types/supabase-types.ts` so it reflects the live schema and the newly introduced migration artifacts.

**Step 4: Run targeted verification**

Run: `npx eslint types/supabase-types.ts types/index.ts`

Expected: exit code `0`

Run: `npm run build`

Expected: `next build` completes successfully

## Task 9: Rollout Verification And Cutover

**Files:**
- Create: `docs/verification/roles-po-rls-cutover-checklist.md`
- Create: `docs/verification/roles-po-rls-rollback.md`
- Modify: `docs/2026-03-06-roles-po-rls-discovery-report.md`

**Step 1: Write the cutover checklist**

Create `docs/verification/roles-po-rls-cutover-checklist.md` with explicit checks for:

- four PO paths
- viability UI
- GM escalation
- email approvals
- warehouse assignment enforcement
- RH ownership flows
- no circular-reference regressions around `profiles`

**Step 2: Write rollback guidance**

Create `docs/verification/roles-po-rls-rollback.md` with rollback procedures for:

- workflow engine cutover
- inventory assignment enforcement
- RH ownership routes
- SQL migration rollback boundaries

**Step 3: Run final verification**

Run: `npx eslint docs/verification/roles-po-rls-cutover-checklist.md docs/verification/roles-po-rls-rollback.md`

Expected: markdown/docs accepted and test file lintable

Run: `npm run build`

Expected: `next build` completes successfully

## Execution Notes

- Do not combine Task 6 and Task 8 in one batch; warehouse authority and SQL migration are both high-risk.
- Do not roll out the new email approval logic before Task 4 is complete.
- Do not migrate role enums or remove legacy roles until Task 8 verification is complete.
- Keep `profiles` outside RLS throughout the migration.
- If any route still relies on a hardcoded role array after Task 3, treat that as incomplete.
- If any approval path bypasses the shared workflow policy after Task 5, treat that as incomplete.
- If any inventory write path still depends only on broad role membership after Task 6, treat that as incomplete.

## Post-Implementation Optional Playwright Track

After the main migration is complete, create a separate verification approach for Playwright.

Preconditions for that separate track:

- the new roles are already implemented
- you have created dedicated test users with the new roles
- the main migration already passes lint, build, API verification, and manual smoke checks

Recommended setup:

1. Create dedicated non-production users for:
   - technical approver
   - administration viability reviewer
   - GM approver
   - RH owner
   - warehouse-responsible user
2. Add a Playwright auth strategy:
   - either env-based credentials
   - or a setup project that generates `storageState` per role
3. Add Playwright coverage as a follow-up package of work for:
   - four-path PO workflow
   - email approval happy paths
   - warehouse responsibility enforcement
   - RH ownership flows

This keeps Playwright from blocking the main migration while still leaving room for stronger end-to-end coverage afterward.
