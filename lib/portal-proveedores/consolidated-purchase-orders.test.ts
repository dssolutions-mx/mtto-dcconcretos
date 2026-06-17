import test from "node:test"
import assert from "node:assert/strict"
import { isCotizadorConfigured } from "./cotizador-client"
import { detailHref } from "./consolidated-purchase-orders"

test("isCotizadorConfigured requires both env vars", () => {
  const url = process.env.COTIZADOR_SUPABASE_URL
  const key = process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
  process.env.COTIZADOR_SUPABASE_URL = "https://example.supabase.co"
  process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY = "secret"
  assert.equal(isCotizadorConfigured(), true)
  delete process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
  assert.equal(isCotizadorConfigured(), false)
  process.env.COTIZADOR_SUPABASE_URL = url
  process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY = key
})

test("detailHref routes cotizador orders to dedicated path", () => {
  assert.equal(
    detailHref({
      id: "abc",
      source: "cotizador",
      order_id: "PO-1",
      status: "open",
      total_amount: 0,
      supplier: null,
      created_at: "2026-01-01",
      plant_label: null,
      invoice_count: 0,
      can_upload_invoice: false,
    }),
    "/portal-proveedores/ordenes/cotizador/abc"
  )
  assert.equal(
    detailHref({
      id: "xyz",
      source: "mtto",
      order_id: "OC-1",
      status: "approved",
      total_amount: 0,
      supplier: null,
      created_at: "2026-01-01",
      plant_label: null,
      invoice_count: 0,
      can_upload_invoice: true,
    }),
    "/portal-proveedores/ordenes/xyz"
  )
})
