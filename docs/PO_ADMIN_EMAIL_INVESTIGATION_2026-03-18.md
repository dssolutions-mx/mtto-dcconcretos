# PO Administration Approval Email – Investigation Report
**Date:** 2026-03-18  
**Status:** Root cause identified, fix ready

---

## Summary

Emails for purchase orders requiring **Administration (AREA_ADMINISTRATIVA) viability approval** are **not being sent** after technical validation when the PO amount is **≤ $5,000 MXN**.

## Root Cause

The database trigger `notify_po_pending_approval` has a **hardcoded `total_amount > 5000` condition** that blocks notification when the technical approver (GERENTE_MANTENIMIENTO) completes validation.

### Trigger logic (current – problematic)

```sql
-- Escalation: BU approved, escalate to GM
IF old.authorized_by IS NULL 
   AND new.authorized_by IS NOT NULL
   AND new.status = 'pending_approval'
   AND new.total_amount > 5000 THEN   -- ❌ BUG: blocks viability paths ≤ 5000
  v_should_notify := true;
```

When technical validation completes for POs that:

- Require **Administration viability** (Via 3: `inventory_restock`, Via 4: `work_order_cash` / `mixed`)
- Have `total_amount` or `approval_amount` **≤ 5,000 MXN**

…the trigger does **not** fire, so no email is sent to Administration.

### Why this is wrong

- **Viability paths** require Administration approval regardless of amount.
- The **5000** value was originally for GM-escalation (amount-based), but it was applied incorrectly to the “technical approved” case.
- The Edge Function already implements the correct routing and will send to Administration when `hasFirstApproval && requiresViability && viability_state !== 'viable'`.

---

## Evidence (Supabase MCP)

### 1. PO-050292-IDM (amount 3,500 MXN)

- `po_purpose`: work_order_cash (viability required)
- `authorized_by`: set on 2026-03-18 18:04
- `viability_state`: pending
- `total_amount`: 3,500 (≤ 5,000)

**Notifications:**

| When        | Type                             | Note                                                |
|------------|-----------------------------------|-----------------------------------------------------|
| 2026-03-13 | PURCHASE_ORDER_APPROVAL_ENQUEUE   | Initial pending_approval → technical approver       |
| 2026-03-13 | PURCHASE_ORDER_APPROVAL_EMAIL      | Email sent to salvador.grajeda@dcconcretos.com.mx   |
| 2026-03-18 | (none)                            | No enqueue or email when technical approved         |

The trigger did not fire when `authorized_by` was set because `3500 > 5000` is false.

### 2. Other affected POs (examples)

| Order ID      | Amount  | Purpose           | Viability required | Trigger fired on tech approval? |
|---------------|---------|-------------------|--------------------|----------------------------------|
| PO-793366-27T | 1,700   | inventory_restock | Yes                | No                               |
| PO-806186-T9L | 900     | inventory_restock | Yes                | No                               |
| PO-044982-5KY | 500     | work_order_cash   | Yes                | No                               |

### 3. Configuration checked

- Trigger: `AFTER INSERT OR UPDATE OF status, authorized_by, viability_state` – definition is correct.
- `app_settings`: `edge_po_notify_url` and `edge_bearer` are set.
- `AREA_ADMINISTRATIVA` profiles: 4 active users with valid emails.

---

## Fix

**Remove** the `total_amount > 5000` condition from the “technical approval” branch. The Edge Function already decides recipients and may return “No recipients” when appropriate.

Updated condition:

```sql
-- Technical approved: notify next approver (Admin for viability, GM for escalation)
IF old.authorized_by IS NULL 
   AND new.authorized_by IS NOT NULL
   AND new.status = 'pending_approval' THEN
  v_should_notify := true;
```

The Edge Function will route:

- To Administration when `requiresViability && viability_state !== 'viable'`
- To GM when `requiresGMEscalation`
- Or return “No recipients” if all approvals are satisfied

---

## Migration

A migration file has been added to apply this fix:  
`migrations/sql/20260318_fix_po_admin_email_trigger.sql`
