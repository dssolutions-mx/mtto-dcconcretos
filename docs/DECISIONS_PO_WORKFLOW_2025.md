# Purchase Order Workflow & Edge Functions - Decisions Log 2025

This document captures architectural and implementation decisions for the PO approval workflow, edge functions, and asset movement notifications. It provides traceability for future changes.

---

## Decisions Log

| ID | Date | Decision | Rationale |
|----|------|----------|------------|
| D001 | 2025-02 | Allow `pending_approval` with 2+ quotes when BU is first approver | BU should approve and select in one step; requester selection becomes optional |
| D002 | 2025-02 | Per-quote approve tokens instead of `approve_quotation_{id}` in action | GM needs distinct actions per quote; cleaner with `quotation_id` column |
| D003 | 2025-02 | Add `quotation_id` (nullable) to `po_action_tokens` | Cleaner than overloading `action`; `action=approve` + `quotation_id=X` means "approve with quote X" |
| D004 | 2025-02 | Asset notification via DB trigger on `asset_assignment_history` | Single source of truth; works for API, future bulk updates, and migrations |
| D005 | 2025-02 | Use `recipient_user_id` in tokens as primary actor resolution | Fixes profiles.email ≠ auth.email; `get_profile_id_by_email` kept as fallback |
| D006 | 2025-02 | Fix MAIRA `profiles.email` typo as immediate workaround | Unblocks approvals before schema migration |
| D007 | 2025-02 | Redeploy `purchase-order-approval-notification` from repo | Deployed version lacked quote comparison; repo has it |
| D008 | 2025-02 | `get_po_action_token` add optional `p_quotation_id` | When provided, return token where quotation_id matches; backward compatible (null = any approve token) |
| D009 | 2025-02 | `process_po_email_action` idempotent when already approved | If PO already approved/rejected, return success; avoid duplicate approval errors |

---

## Implementation Summary

### Phase 1 – Quick Fixes
- **MAIRA email fix**: Migration `20260211_fix_maira_profile_email_typo.sql` – update `profiles.email` to match auth.
- **Edge function redeploy**: `purchase-order-approval-notification` v18+ with quote comparison table.

### Phase 2 – Token/Actor Robustness
- **Migration** `20260211_add_po_action_tokens_quotation_and_user.sql`:
  - `po_action_tokens.quotation_id` (nullable, FK to purchase_order_quotations)
  - `po_action_tokens.recipient_user_id` (nullable)
  - `get_po_action_token(p_po_id, p_action, p_recipient_email, p_quotation_id)`
  - `process_po_email_action` updated: recipient_user_id, quotation_id, BU escalation, idempotency
- **Edge function**: Inserts `recipient_user_id` when creating tokens.
- **direct-action route**: Supports `quotation` query param.

### Phase 3 – BU Approve + Select
- **PurchaseOrderService**: Allow `pending_approval` when `quotation_selection_status = 'pending_selection'`; skip items check.
- **advance-workflow route**: When approving with 2+ quotes and no selection, require `quotation_id`; call `select_quotation` first.
- **AdvanceWorkflowRequest**: Added `quotation_id?: string`.
- **WorkflowStatusDisplay**: Inline quotation picker when 2+ quotes and none selected; pass `quotation_id` on approve.

### Phase 4 – GM Quote Override
- **Edge function**: When GM escalation (hasFirstApproval) with 2+ quotations, create per-quote approve tokens with `quotation_id`.
- **Email**: "Aprobar con [Proveedor X]" buttons per quote; URLs include `?quotation=...`.
- **process_po_email_action**: When token has `quotation_id`, calls `select_quotation` before approval.

### Phase 5 – Asset Movement Notification
- **Edge function** `asset-movement-notification`: Sends email to GERENCIA_GENERAL with asset code, from/to plant, changed_by.
- **Migration** `20260211_add_asset_movement_notification_trigger.sql`:
  - `notify_asset_movement()` function
  - `trg_notify_asset_movement` on `asset_assignment_history` AFTER INSERT
  - `app_settings.edge_asset_movement_url`

---

## Files Modified / Created

### Migrations
- `migrations/sql/20260211_fix_maira_profile_email_typo.sql`
- `migrations/sql/20260211_add_po_action_tokens_quotation_and_user.sql`
- `migrations/sql/20260211_add_asset_movement_notification_trigger.sql`

### Edge Functions
- `supabase/functions/purchase-order-approval-notification/index.ts` – recipient_user_id, GM per-quote tokens
- `supabase/functions/asset-movement-notification/index.ts` – **new**

### API Routes
- `app/api/purchase-order-actions/direct-action/route.ts` – `quotation` param
- `app/api/purchase-orders/advance-workflow/[id]/route.ts` – `quotation_id` body, select_quotation before approve

### Services & Types
- `lib/services/purchase-order-service.ts` – relaxed pending_selection validation
- `types/purchase-orders.ts` – `AdvanceWorkflowRequest.quotation_id`

### Components
- `components/purchase-orders/workflow/WorkflowStatusDisplay.tsx` – quotation picker, quotation_id on advance
- `hooks/usePurchaseOrders.ts` – advanceWorkflow(id, status, notes?, quotationId?)

---

## Verification Checklist

### Token / Actor
- [ ] GM/BU with email mismatch can approve from email (recipient_user_id or MAIRA fix)
- [ ] BU approval from email for amount > $5k escalates to GM

### Workflow
- [ ] BU can approve + select quote when 2+ exist (from app)
- [ ] GM email shows both quotes + per-quote approve buttons
- [ ] GM "Approve with other quote" correctly runs select_quotation then approval
- [ ] POs with 1 quote still auto-select and flow unchanged

### Asset Notification
- [ ] Moving asset via plant-assignment API triggers notification
- [ ] GM receives email with asset code, from/to plant, changed_by
- [ ] `notifications` table has enqueue/success/failure records

---

## References

- Plan: `.cursor/plans/po_edge_functions_analysis_48c9ab47.plan.md`
- `QUOTATION_WORKFLOW_IMPLEMENTATION.md`
- `migrations/sql/20250730_po_email_actions_trigger.sql`
