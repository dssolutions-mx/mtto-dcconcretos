import test from "node:test"
import assert from "node:assert/strict"
import { normalizeSupplierRfc, isValidSupplierRfc } from "./rfc"
import { canInviteSupplierPortal } from "./staff-permissions"
import { resolvePortalContext } from "./resolvePortalContext"
import type { SupplierPortalMembershipRow } from "./types"

test("normalizeSupplierRfc trims and uppercases", () => {
  assert.equal(normalizeSupplierRfc("  abc123456xy0  "), "ABC123456XY0")
})

test("isValidSupplierRfc accepts standard RFC shapes", () => {
  assert.equal(isValidSupplierRfc("XAXX010101000"), true)
  assert.equal(isValidSupplierRfc("ABC850101XY9"), true)
  assert.equal(isValidSupplierRfc("not-an-rfc"), false)
})

test("canInviteSupplierPortal allows procurement and padron editors", () => {
  assert.equal(canInviteSupplierPortal("AUXILIAR_COMPRAS"), true)
  assert.equal(canInviteSupplierPortal("AREA_ADMINISTRATIVA"), true)
  assert.equal(canInviteSupplierPortal("MECANICO"), false)
})

test("resolvePortalContext returns membership for active portal user", async () => {
  const row: SupplierPortalMembershipRow = {
    id: "mem-1",
    auth_user_id: "user-1",
    rfc: "XAXX010101000",
    mtto_supplier_id: "sup-1",
    cotizador_group_id: null,
    status: "active",
    invited_by: "staff-1",
    invited_at: "2026-06-17T00:00:00Z",
    accepted_at: "2026-06-17T01:00:00Z",
    created_at: "2026-06-17T00:00:00Z",
    updated_at: "2026-06-17T01:00:00Z",
  }

  const supabase = {
    from(table: string) {
      if (table === "supplier_portal_users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
            }),
          }),
        }
      }
      if (table === "suppliers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { name: "Proveedor Demo", business_name: "Demo SA" },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }

  const result = await resolvePortalContext(supabase as never, "user-1")
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.ctx.rfc, "XAXX010101000")
  assert.equal(result.ctx.supplierName, "Demo SA")
})

test("resolvePortalContext rejects suspended membership", async () => {
  const supabase = {
    from(table: string) {
      if (table === "supplier_portal_users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "mem-1",
                  auth_user_id: "user-1",
                  rfc: "XAXX010101000",
                  mtto_supplier_id: null,
                  cotizador_group_id: null,
                  status: "suspended",
                  invited_by: null,
                  invited_at: null,
                  accepted_at: null,
                  created_at: "2026-06-17T00:00:00Z",
                  updated_at: "2026-06-17T00:00:00Z",
                },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }

  const result = await resolvePortalContext(supabase as never, "user-1")
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.status, 403)
})

test("resolvePortalContext returns 403 when no membership", async () => {
  const supabase = {
    from() {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }
    },
  }

  const result = await resolvePortalContext(supabase as never, "user-orphan")
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.status, 403)
})
