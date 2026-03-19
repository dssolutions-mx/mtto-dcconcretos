# Supabase Purchase Order & Email System — Database Summary

**Project (live):** mantenimiento — Supabase ref `txapndpstzcspgxlybll`  
**Verified:** metadata queried directly from this project’s Postgres (`pg_trigger`, `pg_get_functiondef`, `information_schema`, `pg_constraint`, `app_settings`).  
**Verified at:** 2026-03-19 (America/Mexico City)

**Narrative workflow (OT → OC → aprobaciones → inventario):** [INVENTORY_PO_WORKFLOW_SOURCE_OF_TRUTH.md](./INVENTORY_PO_WORKFLOW_SOURCE_OF_TRUTH.md)

**Note:** The git repo’s `migrations/sql/` folder can lag behind or diverge from this database (e.g. quotation triggers exist **here** but are not all checked into that folder). **This document reflects the live database only.**

---

## 1. Tables (scope of this summary)

| Table | Role |
|-------|------|
| `purchase_orders` | OC principal |
| `purchase_order_quotations` | Cotizaciones estructuradas |
| `po_action_tokens` | Tokens para acciones por correo |
| `notifications` | Auditoría / notificaciones (incl. encolado de Edge Functions) |
| `app_settings` | URLs y secretos para `pg_net` → Edge Functions |

---

## 2. `purchase_orders` — constraints and defaults (live)

- **`status` default:** `'Pendiente'::text` (`information_schema.columns`).
- **`quotation_selection_status` CHECK** (`purchase_orders_quotation_selection_status_check`):  
  allowed values — `not_required`, `pending_quotations`, `pending_selection`, `selected`.

Other columns (approval routing, amounts, `po_purpose`, `work_order_type`, inventory flags, etc.) follow the same semantics as in [INVENTORY_PO_WORKFLOW_SOURCE_OF_TRUTH.md](./INVENTORY_PO_WORKFLOW_SOURCE_OF_TRUTH.md); use `information_schema.columns` for exact types.

---

## 3. Triggers on `public.purchase_orders` (live)

| Trigger | Timing | Function |
|---------|--------|----------|
| `po_delete_inventory_check` | `BEFORE DELETE` | `prevent_po_delete_with_inventory()` |
| `set_purchase_order_id_trigger` | `BEFORE INSERT` | `set_purchase_order_id()` |
| `set_user_fields` | `BEFORE INSERT OR UPDATE` | `set_user_tracking_fields()` |
| `trg_generate_purchase_order_id` | `BEFORE INSERT` | `generate_purchase_order_id_trigger()` |
| **`trg_notify_po_pending_approval`** | **`AFTER INSERT OR UPDATE OF status, authorized_by, viability_state`** | **`notify_po_pending_approval()`** |
| `trg_notify_po_ready_to_pay` | `AFTER UPDATE OF status` | `notify_po_ready_to_pay()` |
| `trigger_notify_purchase_order_update` | `AFTER INSERT OR UPDATE OF status` | `notify_purchase_order_update()` |
| `trigger_set_requires_quote` | `BEFORE INSERT OR UPDATE` | `set_requires_quote()` |
| `trigger_update_payment_status` | `BEFORE INSERT OR UPDATE` | `update_payment_status()` |
| `trigger_validate_po_status` | `BEFORE UPDATE` | `validate_po_status()` |

---

## 4. Triggers on `public.purchase_order_quotations` (live)

| Trigger | Timing | Function |
|---------|--------|----------|
| **`trigger_auto_select_single_quotation`** | **`AFTER INSERT`** | **`auto_select_single_quotation()`** |
| **`trigger_notify_quotation_selection`** | **`AFTER INSERT`** | **`notify_quotation_selection_required()`** |
| `trigger_po_quotations_status_update` | `AFTER INSERT OR DELETE OR UPDATE` | `trigger_update_quotation_selection_status()` |
| `update_po_quotations_updated_at` | `BEFORE UPDATE` | `update_updated_at_column()` |

---

## 5. `notify_po_pending_approval()` — behavior (live function body)

- Reads `edge_po_notify_url` and `edge_bearer` from `app_settings` (with GUC fallback). Missing URL → **`RAISE EXCEPTION`** (blocks the triggering statement).
- Sets `v_should_notify` when:
  - **INSERT:** `NEW.status = 'pending_approval'`
  - **UPDATE:** `authorized_by` goes from NULL to set, and `NEW.status = 'pending_approval'`
  - **UPDATE:** `viability_state` becomes `'viable'` (from a non-viable prior value), and `authorized_by` is set, and `status = 'pending_approval'`
  - **UPDATE:** `status` becomes `'pending_approval'` and differs from old `status`
- On notify: `net.http_post(url, body: {"po_id": new.id}, …)` and insert into `notifications` with type `PURCHASE_ORDER_APPROVAL_ENQUEUE` or `PURCHASE_ORDER_APPROVAL_ERROR`.

Because the trigger includes **`viability_state`**, an update that **only** records viability (e.g. Admin via email RPC) **does** fire this trigger when the viability branch matches—no longer dependent on `status`/`authorized_by` changing in the same statement for that case.

**Application duplication:** The Next.js app may also call the same Edge Function via `notifyNextApprover(poId)` (`lib/purchase-orders/notify-approver.ts`).

---

## 6. `notify_quotation_selection_required()` — behavior (live)

- Runs on **INSERT** on `purchase_order_quotations`.
- Counts quotations for `NEW.purchase_order_id`.
- When count **equals 2**, POSTs to `app_settings.edge_quotation_selection_url` with `{"po_id": <purchase_order_id>}` and `Authorization: Bearer <edge_bearer>`.
- Missing URL → `RAISE WARNING`, does not block insert.
- Audit rows: `QUOTATION_SELECTION_ENQUEUE` / `QUOTATION_SELECTION_ERROR`.

---

## 7. `auto_select_single_quotation()` — behavior (live)

- Runs on **INSERT** on `purchase_order_quotations`.
- After insert, if total quotations for that PO **= 1**:
  - Marks the quotation `selected`, reason `Auto-seleccionada (única cotización)`.
  - Updates `purchase_orders`: `selected_quotation_id`, `supplier`, `supplier_id`, `total_amount` from quote, builds `items` from `quotation_items` when present, sets **`status = 'pending_approval'`**.

When a **second** quotation is added, this branch does not run (`count = 2`); the selection-notification trigger handles the “two options” case.

---

## 8. `notify_po_ready_to_pay()` — behavior (live)

- **`AFTER UPDATE OF status`** on `purchase_orders`.
- If `status` transitions **to** `approved`: POST `edge_po_ready_to_pay_url` with `{"po_id": NEW.id}`.
- If URL empty: returns without error (no enqueue).
- Audit: `PO_READY_TO_PAY_ENQUEUE` / `PO_READY_TO_PAY_ERROR`.

**Duplication:** The app can also invoke `po-ready-to-pay-notification` from `notifyReadyToPay` when advancing workflow.

---

## 9. `po_action_tokens` — RLS (live)

- Policy **`deny all`**: `USING (false)` for all commands — clients cannot read/write tokens directly; use **SECURITY DEFINER** RPCs / service role (e.g. `process_po_email_action`, Edge Function with service key).

---

## 10. `app_settings` keys present (live)

Keys observed for this project (values are operational secrets or URLs; **do not commit** `edge_bearer` to git):

| Key | Purpose |
|-----|---------|
| `edge_po_notify_url` | `purchase-order-approval-notification` |
| `edge_quotation_selection_url` | `quotation-selection-notification` |
| `edge_po_ready_to_pay_url` | `po-ready-to-pay-notification` |
| `edge_bearer` | Bearer token for `pg_net` calls to Edge Functions |
| `po_admin_approval_email` | Designated admin inbox for viability / approval emails (Edge Function reads this) |

---

## 11. Edge Functions (repo + live wiring)

These functions exist under `supabase/functions/` and are referenced by the URLs above:

| Function | Live enqueue path |
|----------|-------------------|
| `purchase-order-approval-notification` | Trigger `trg_notify_po_pending_approval` + optional app `notifyNextApprover` |
| `quotation-selection-notification` | Trigger `trigger_notify_quotation_selection` when 2 quotations exist |
| `po-ready-to-pay-notification` | Trigger `trg_notify_po_ready_to_pay` + optional app `notifyReadyToPay` |

---

## 12. RPCs used from the app (email clicks)

| RPC | Role |
|-----|------|
| `get_po_action_token` | Resolves stored JWT for `direct-action` links |
| `process_po_email_action` | Applies approve/reject / viability from token |

Exact branching (roles, GM threshold, quotation id) matches the migration history applied **to this database**; compare with `pg_get_functiondef('process_po_email_action')` if you change SQL.

---

## 13. Re-verification queries (copy/paste)

```sql
-- Triggers on purchase_orders
SELECT t.tgname, pg_get_triggerdef(t.oid, true)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'purchase_orders' AND NOT t.tgisinternal
ORDER BY 1;

-- Triggers on purchase_order_quotations
SELECT t.tgname, pg_get_triggerdef(t.oid, true)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'purchase_order_quotations' AND NOT t.tgisinternal
ORDER BY 1;

-- notify_po_pending_approval source
SELECT pg_get_functiondef('public.notify_po_pending_approval()'::regprocedure);
```

---

## 14. Repo vs database

Some objects above (e.g. `trigger_notify_quotation_selection`, `trigger_auto_select_single_quotation`, **`viability_state` on `trg_notify_po_pending_approval`**) may **not** appear in `migrations/sql/` in this workspace. Treat **this file** as the snapshot of **Supabase project `txapndpstzcspgxlybll`** at verification time; export or add migrations if you need the repo to match production.
