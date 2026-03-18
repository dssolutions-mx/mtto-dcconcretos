# Supabase Purchase Order & Email System — Database Summary

**Project:** mantenimiento (`txapndpstzcspgxlybll`)  
**Generated:** 2025-03-18

---

## 1. Database Objects Overview

### Tables Related to Purchase Orders / Compras

| Table | Purpose |
|-------|---------|
| `purchase_orders` | Main PO table; workflow status, approval chain, payment tracking |
| `purchase_order_quotations` | Supplier quotations linked to a PO; selection/approval flow |
| `po_action_tokens` | JWT tokens for email-based approve/reject actions |
| `notifications` | In-app notifications and email send audit logs |

---

## 2. Purchase Order Schema (Status & Approval Columns)

### `purchase_orders`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `order_id` | text | Human-readable PO number |
| `status` | text | Workflow status (default: `'Pendiente'`) |
| `viability_state` | text | Admin viability confirmation (`'viable'` = approved) |
| `viability_checked_by` | uuid | Admin who confirmed viability |
| `authorized_by` | uuid | BU/technical approver (Gerente Mantenimiento) |
| `authorization_date` | timestamptz | When BU authorized |
| `approved_by` | uuid | Final approver (Gerencia General) |
| `approval_date` | timestamptz | When final approval occurred |
| `approval_amount` | numeric | Amount used for approval threshold |
| `approval_amount_source` | text | Source of approval amount |
| `requested_by` | uuid | Requester |
| `requires_approval` | boolean | Whether approval is needed |
| `requires_quote` | boolean | Whether quotation is required |
| `quotation_selection_required` | boolean | Multiple quotes need selection |
| `quotation_selection_status` | text | `'not_required'`, `'pending'`, etc. |
| `selected_quotation_id` | uuid | FK to chosen quotation |
| `payment_status` | text | `'paid'`, `'pending'`, `'overdue'`, etc. |
| `enhanced_status` | text | Extended status label |

Other columns: `total_amount`, `supplier`, `supplier_id`, `items` (jsonb), `po_type`, `po_purpose`, `work_order_type`, `plant_id`, etc.

### `purchase_order_quotations`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `purchase_order_id` | uuid | FK to `purchase_orders` |
| `status` | text | `'pending'`, `'selected'`, `'rejected'` (default: `'pending'`) |
| `selected_at` | timestamptz | When selected |
| `selected_by` | uuid | Who selected |
| `selection_reason` | text | Reason for selection |
| `rejection_reason` | text | Reason if rejected |

Other columns: `supplier_name`, `supplier_id`, `quoted_amount`, `quotation_items` (jsonb), etc.

### `po_action_tokens`

| Column | Type | Purpose |
|--------|------|---------|
| `purchase_order_id` | uuid | PO reference |
| `recipient_email` | text | Email recipient |
| `recipient_user_id` | uuid | Optional user ID |
| `action` | text | `'approve'` or `'reject'` |
| `quotation_id` | uuid | For approve-with-quotation |
| `jwt_token` | text | Signed token for link |
| `expires_at` | timestamptz | Token expiry |

---

## 3. Triggers on Purchase Order Tables

### Triggers firing on status / approval changes

| Trigger | Table | Fires On | Function | Purpose |
|---------|-------|----------|----------|---------|
| **`trg_notify_po_pending_approval`** | `purchase_orders` | `AFTER INSERT OR UPDATE OF status, authorized_by, viability_state` | `notify_po_pending_approval` | Calls Edge Function to send approval emails |
| **`trigger_notify_purchase_order_update`** | `purchase_orders` | `AFTER INSERT OR UPDATE OF status` | `notify_purchase_order_update` | Inserts in-app notification for requester |
| **`trigger_po_quotations_status_update`** | `purchase_order_quotations` | `AFTER INSERT OR DELETE OR UPDATE` | `trigger_update_quotation_selection_status` | Updates PO `quotation_selection_status` |

### Other purchase-order-related triggers

| Trigger | Table | Fires On | Function | Purpose |
|---------|-------|----------|----------|---------|
| `trigger_validate_po_status` | `purchase_orders` | `BEFORE UPDATE` | `validate_po_status` | Validates quotation requirements |
| `trigger_set_requires_quote` | `purchase_orders` | `BEFORE INSERT OR UPDATE` | `set_requires_quote` | Sets `requires_quote` based on po_type/amount |
| `trigger_update_payment_status` | `purchase_orders` | `BEFORE INSERT OR UPDATE` | `update_payment_status` | Derives `payment_status` from payment fields |
| `trigger_auto_select_single_quotation` | `purchase_order_quotations` | `AFTER INSERT` | `auto_select_single_quotation` | Auto-selects when only 1 quotation |
| `trigger_notify_quotation_selection` | `purchase_order_quotations` | `AFTER INSERT` | `notify_quotation_selection_required` | When 2 quotations exist, invokes quotation-selection Edge Function |
| `set_user_fields` | `purchase_orders` | `BEFORE INSERT OR UPDATE` | `set_user_tracking_fields` | Sets `updated_by` |
| `trg_generate_purchase_order_id` | `purchase_orders` | `BEFORE INSERT` | `generate_purchase_order_id_trigger` | Generates `order_id` |
| `set_purchase_order_id_trigger` | `purchase_orders` | `BEFORE INSERT` | `set_purchase_order_id` | Sets PO id |
| `po_delete_inventory_check` | `purchase_orders` | `BEFORE DELETE` | `prevent_po_delete_with_inventory` | Blocks delete if inventory fulfilled |

---

## 4. Function Logic Summary

### `notify_po_pending_approval` (SECURITY DEFINER)

**Logic:**  
- Reads `edge_po_notify_url` and `edge_bearer` from `app_settings`.  
- **Triggers notification when:**
  - INSERT with `status = 'pending_approval'`
  - UPDATE: `authorized_by` set and `status = 'pending_approval'` and `total_amount > 5000` (escalation to GM)
  - UPDATE: `viability_state = 'viable'` and `authorized_by` set and `status = 'pending_approval'`
  - UPDATE: `status` changes to `'pending_approval'`  
- **Action:** Calls Edge Function via `net.http_post`; inserts audit row in `notifications` (success or failure).

### `notify_purchase_order_update` (in-database only)

**Logic:**  
- On `status` change, creates an in-app notification for `requested_by`:
  - `pending_approval` → "Orden de Compra Pendiente de Aprobación"
  - `approved` → "Orden de Compra Aprobada"
  - `rejected` → "Orden de Compra Rechazada"  
- Does not send email; writes to `notifications` table.

### `notify_quotation_selection_required` (SECURITY DEFINER)

**Logic:**  
- Runs on INSERT of a quotation.  
- If total quotations for that PO = 2, invokes `edge_quotation_selection_url` Edge Function via `net.http_post`.  
- Inserts audit row in `notifications` (success or failure).

### `process_po_email_action(p_token text)` (RPC, SECURITY DEFINER)

**Logic:**  
- Validates JWT from `po_action_tokens`, resolves user.  
- Performs approve/reject via `po_action_tokens.action`:
  - **Approve:** Role-based: GERENCIA_GENERAL (final approve), GERENTE_MANTENIMIENTO (technical), AREA_ADMINISTRATIVA (viability).  
  - **Reject:** Sets `status = 'rejected'`.  
- Supports approve-with-specific-quotation via `quotation_id`.  
- Applies GM escalation threshold ($7,000) and viability path logic.  
- Does **not** send email; used by API when user clicks email link.

---

## 5. Edge Functions That Send Emails

| Edge Function | Triggered By | Recipients | Purpose |
|---------------|--------------|------------|---------|
| **`purchase-order-approval-notification`** | Trigger `trg_notify_po_pending_approval` | GERENTE_MANTENIMIENTO, AREA_ADMINISTRATIVA, GERENCIA_GENERAL | Sends approval emails with approve/reject links |
| **`quotation-selection-notification`** | Trigger `trigger_notify_quotation_selection` | `requested_by` (requester) | Notifies when 2+ quotations exist; asks to select one |

### Email mechanics

- **Provider:** SendGrid (`SENDGRID_API_KEY`, `SENDGRID_FROM`).  
- **Links:** JWT tokens in `po_action_tokens`; processed by `process_po_email_action` RPC via API route.  
- **App settings:** `edge_po_notify_url`, `edge_quotation_selection_url`, `edge_bearer` (in `app_settings`).

---

## 6. RPC Functions Related to Email / Notifications

| Function | Sends Email? | Purpose |
|----------|--------------|---------|
| `process_po_email_action(p_token)` | No | Executes approve/reject from email link token |
| `notify_po_pending_approval` | No (calls Edge Function) | Enqueues approval Edge Function |
| `notify_quotation_selection_required` | No (calls Edge Function) | Enqueues quotation-selection Edge Function |
| `notify_purchase_order_update` | No | In-app notification only |

---

## 7. App Settings (Edge Function URLs)

| Key | Value (example) |
|-----|------------------|
| `edge_po_notify_url` | `https://txapndpstzcspgxlybll.supabase.co/functions/v1/purchase-order-approval-notification` |
| `edge_quotation_selection_url` | `https://txapndpstzcspgxlybll.supabase.co/functions/v1/quotation-selection-notification` |
| `edge_bearer` | JWT for Edge Function auth (configured in `app_settings`) |

---

## 8. Workflow Summary

1. **PO created** → `trg_generate_purchase_order_id`, `set_requires_quote`, `set_user_fields`.
2. **Quotation added:**
   - 1 quotation → `auto_select_single_quotation` (auto-select, PO → `pending_approval`).
   - 2 quotations → `notify_quotation_selection_required` → Edge Function emails requester to select.
3. **PO status → pending_approval** → `trg_notify_po_pending_approval` → Edge Function sends approval emails.
4. **Approver clicks link** → API calls `process_po_email_action` → updates PO (authorized_by, viability_state, approved_by, status).

---

## 9. Related Support Functions

- `update_quotation_selection_status(po_id)` — Called by `trigger_update_quotation_selection_status`.
- `requires_quotation(po_type, total_amount, po_purpose)` — Used by `set_requires_quote`.
- `select_quotation(quotation_id, actor_id, reason)` — Used by `process_po_email_action` for approve-with-quotation.
