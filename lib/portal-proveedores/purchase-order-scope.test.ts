import test from "node:test"
import assert from "node:assert/strict"
import {
  assertPurchaseOrderAccess,
  filterInvoicesForPortal,
  SUPPLIER_VISIBLE_PO_STATUSES,
} from "./purchase-order-scope"
import type { SupplierPortalContext } from "./types"

const filterCtx: SupplierPortalContext = {
  membershipId: "mem-1",
  rfc: "ABC850101XY9",
  status: "active",
  mttoSupplierId: "sup-1",
  cotizadorGroupId: null,
  supplierName: "Demo",
}

test("filterInvoicesForPortal keeps invoices for supplier_id or matching RFC", () => {
  const invoices = [
    {
      id: "inv-1",
      invoice_number: "A-1",
      invoice_date: null,
      total: 100,
      status: "open",
      cfdi_uuid: null,
      cfdi_emisor_rfc: "ABC850101XY9",
      created_at: null,
      supplier_id: "sup-1",
    },
    {
      id: "inv-2",
      invoice_number: "A-2",
      invoice_date: null,
      total: 200,
      status: "open",
      cfdi_uuid: null,
      cfdi_emisor_rfc: "ZZZ850101ZZ9",
      created_at: null,
      supplier_id: "sup-2",
    },
  ]

  const filtered = filterInvoicesForPortal(invoices, filterCtx)
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.id, "inv-1")
})

const ctx: SupplierPortalContext = {
  membershipId: "mem-1",
  rfc: "XAXX010101000",
  status: "active",
  mttoSupplierId: "sup-1",
  cotizadorGroupId: null,
  supplierName: "Demo SA",
}

const basePo = {
  id: "po-1",
  order_id: "OC-001",
  status: "approved",
  total_amount: 500,
  supplier: "Demo",
  supplier_id: "sup-1",
  created_at: "2026-06-17T00:00:00Z",
  plant_id: "plant-1",
  po_type: "direct_purchase",
  notes: null,
  po_purpose: null,
  accounting_status: "pending_invoice",
}

function invoiceSelectChain() {
  return {
    eq: () => ({
      eq: () => ({
        limit: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    in: async () => ({ data: [], error: null }),
  }
}

function buildAdminMock(po: typeof basePo) {
  return {
    from(table: string) {
      if (table === "purchase_orders") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: po, error: null }),
            }),
          }),
        }
      }
      if (table === "po_supplier_invoices") {
        return {
          select: () => invoiceSelectChain(),
        }
      }
      if (table === "plants") {
        return {
          select: () => ({
            in: async () => ({
              data: [{ id: "plant-1", name: "Planta Norte", code: "PN" }],
              error: null,
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

test("SUPPLIER_VISIBLE_PO_STATUSES excludes draft and pending approval", () => {
  assert.equal(SUPPLIER_VISIBLE_PO_STATUSES.includes("draft" as never), false)
  assert.equal(SUPPLIER_VISIBLE_PO_STATUSES.includes("approved"), true)
})

test("assertPurchaseOrderAccess allows matching supplier_id", async () => {
  const result = await assertPurchaseOrderAccess(
    buildAdminMock(basePo) as never,
    ctx,
    "po-1"
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.po.order_id, "OC-001")
})

test("assertPurchaseOrderAccess rejects foreign PO", async () => {
  const foreignPo = { ...basePo, id: "po-9", supplier_id: "sup-other" }
  const result = await assertPurchaseOrderAccess(
    buildAdminMock(foreignPo) as never,
    ctx,
    "po-9"
  )
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.status, 403)
})
