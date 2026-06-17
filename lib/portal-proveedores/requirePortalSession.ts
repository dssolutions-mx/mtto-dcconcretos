import { createClient } from "@/lib/supabase-server"
import { resolvePortalContext } from "./resolvePortalContext"
import type { SupplierPortalContext } from "./types"

export type PortalSessionResult =
  | { ok: true; userId: string; email: string | undefined; ctx: SupplierPortalContext }
  | { ok: false; status: number; message: string }

export async function requirePortalSession(): Promise<PortalSessionResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, status: 401, message: "No autorizado" }
  }

  const resolved = await resolvePortalContext(supabase, user.id)
  if (!resolved.ok) {
    return { ok: false, status: resolved.status, message: resolved.message }
  }

  return {
    ok: true,
    userId: user.id,
    email: user.email,
    ctx: resolved.ctx,
  }
}
