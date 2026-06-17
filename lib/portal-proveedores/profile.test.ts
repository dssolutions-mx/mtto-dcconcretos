import test from "node:test"
import assert from "node:assert/strict"
import { updatePortalProfile } from "./profile"

test("updatePortalProfile rejects invalid notification email", async () => {
  const supabase = {
    from() {
      throw new Error("should not query")
    },
  }

  const result = await updatePortalProfile(supabase as never, "user-1", {
    notificationEmail: "not-an-email",
  })

  assert.deepEqual(result, {
    ok: false,
    message: "El correo de notificaciones no es válido.",
  })
})

test("updatePortalProfile trims empty strings to null before update", async () => {
  const updates: Record<string, unknown>[] = []
  const supabase = {
    from() {
      return {
        update(payload: Record<string, unknown>) {
          updates.push(payload)
          return {
            eq: async () => ({ error: null }),
          }
        },
      }
    },
  }

  const result = await updatePortalProfile(supabase as never, "user-1", {
    contactName: "  ",
    contactPhone: "55 0000 0000",
    notificationEmail: " avisos@proveedor.mx ",
  })

  assert.deepEqual(result, { ok: true })
  assert.deepEqual(updates[0], {
    contact_name: null,
    contact_phone: "55 0000 0000",
    notification_email: "avisos@proveedor.mx",
  })
})
