# Usage Verification — Security Assessment

**Date:** 2025-03-13  
**Purpose:** Verify that flagged security findings apply to components actually used in the application.

---

## Methodology

For each initially flagged endpoint or component:
1. Grep for fetch/link references in `*.{tsx,ts,jsx,js}`
2. Check if the component is imported and rendered
3. Trace call chains from user-facing UI

---

## Results

### Not Used in App

| Endpoint / Component | Finding | Verification |
|----------------------|---------|--------------|
| `/api/notifications/test-email` | Unauthenticated, uses service_role | No fetch, link, or import in app code. Dev/test utility only. |
| `POST /api/maintenance/work-orders` | No auth when service_role | No frontend calls it. Work order creation uses `generate-corrective-work-order-enhanced`. |
| `/api/fix-duplicate-ids` | exec_sql, no role check | No UI reference. Admin/debug tool. |
| `/api/checklists/cleanup-schedules` | No auth | `MaintenanceCleanupButton` calls it, but the button is never imported or rendered anywhere. |

### Used in App

| Endpoint / Component | Caller |
|----------------------|--------|
| `generate-corrective-work-order-enhanced` | corrective-work-order-dialog, checklist-execution |
| `maintenance/work-orders/[id]/update-status` | compras/[id]/recibido, compras/[id]/pedido |
| `maintenance/work-orders/[id]/additional-expenses` | ordenes/[id]/generar-oc-ajuste |
| `storage/upload` | Receipt uploads, evidence uploads |
| `suppliers` | Supplier management UI |
| `purchase-orders` | PO workflow |
| `authorization/summary` | Authorization management |

---

## Severity Adjustments

Findings for **unused** components were downgraded:
- test-email: Critical → Medium (still recommend removal/gating)
- maintenance/work-orders POST: Critical → Medium (orphaned)
- fix-duplicate-ids: Critical → Medium (not discoverable)
- cleanup-schedules: High → Low (button not rendered)

Findings for **used** components retain original severity.

---

## Remediation (2025-03-13)

All **unused** endpoints and dead code have been **removed**:
- `app/api/notifications/test-email/` — deleted
- `app/api/fix-duplicate-ids/` — deleted
- `app/api/maintenance/work-orders/route.ts` (POST) — deleted
- `app/api/checklists/cleanup-schedules/` — deleted
- `components/dashboard/maintenance-cleanup-button.tsx` — deleted

**Additional security fixes:**
- Rate limiting: use **Vercel Firewall** (Project → Firewall → Configure). See [vercel-firewall-setup.md](./vercel-firewall-setup.md) for full instructions.
- Error handling: storage/upload, suppliers, authorization/summary, checklists/execution return generic messages
- Next.js upgraded to 16.1.6
