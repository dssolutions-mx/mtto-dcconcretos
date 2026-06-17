import { describe, expect, it, vi } from "vitest"
import { updatePortalProfile } from "./profile"

describe("updatePortalProfile", () => {
  it("rejects invalid notification email", async () => {
    const supabase = {
      from: vi.fn(),
    } as unknown as Parameters<typeof updatePortalProfile>[0]

    const result = await updatePortalProfile(supabase, "user-1", {
      notificationEmail: "not-an-email",
    })

    expect(result).toEqual({
      ok: false,
      message: "El correo de notificaciones no es válido.",
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it("trims empty strings to null before update", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const supabase = {
      from: vi.fn().mockReturnValue({ update }),
    } as unknown as Parameters<typeof updatePortalProfile>[0]

    const result = await updatePortalProfile(supabase, "user-1", {
      contactName: "  ",
      contactPhone: "55 0000 0000",
      notificationEmail: " avisos@proveedor.mx ",
    })

    expect(result).toEqual({ ok: true })
    expect(update).toHaveBeenCalledWith({
      contact_name: null,
      contact_phone: "55 0000 0000",
      notification_email: "avisos@proveedor.mx",
    })
  })
})
