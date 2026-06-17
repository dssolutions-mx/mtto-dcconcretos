import test from "node:test"
import assert from "node:assert/strict"
import {
  assertCotizadorPurchaseOrderAccess,
  COTIZADOR_VISIBLE_PO_STATUSES,
} from "./cotizador-purchase-orders"
import type { SupplierPortalContext } from "./types"

const ctx: SupplierPortalContext = {
  membershipId: "mem-1",
  rfc: "XAXX010101000",
  status: "active",
  mttoSupplierId: null,
  cotizadorGroupId: "group-1",
  supplierName: null,
}

test("COTIZADOR_VISIBLE_PO_STATUSES excludes cancelled", () => {
  assert.equal(COTIZADOR_VISIBLE_PO_STATUSES.includes("cancelled" as never), false)
  assert.equal(COTIZADOR_VISIBLE_PO_STATUSES.includes("open"), true)
})

test("assertCotizadorPurchaseOrderAccess rejects when cotizador not configured", async () => {
  const originalUrl = process.env.COTIZADOR_SUPABASE_URL
  const originalKey = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
  delete process.env.COTIZADOR_SUPABASE_URL
  delete process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY

  try {
    const result = await assertCotizadorPurchaseOrderAccess(ctx, "po-cot-1")
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.status, 503)
  } finally {
    process.env.COTIZADOR_SUPABASE_URL = originalUrl
    process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY = originalKey
  }
})

test("assertCotizadorPurchaseOrderAccess rejects suspended membership", async () => {
  const originalUrl = process.env.COTIZADOR_SUPABASE_URL
  const originalKey = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
  process.env.COTIZADOR_SUPABASE_URL = "https://example.supabase.co"
  process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY = "test-key"

  try {
    const result = await assertCotizadorPurchaseOrderAccess(
      { ...ctx, status: "suspended" },
      "po-cot-1"
    )
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.status, 403)
  } finally {
    process.env.COTIZADOR_SUPABASE_URL = originalUrl
    process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY = originalKey
  }
})
