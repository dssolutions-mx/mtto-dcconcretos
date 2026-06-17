import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { loadPortalProfile } from "@/lib/portal-proveedores/profile"
import { resolvePortalContext } from "@/lib/portal-proveedores/resolvePortalContext"
import { PortalPerfilForm } from "@/components/portal-proveedores/portal-perfil-form"
import { PortalProveedoresShell } from "@/components/portal-proveedores/portal-proveedores-shell"

export const metadata = {
  title: "Perfil | Portal de proveedores",
  robots: { index: false, follow: false },
}

export default async function PortalPerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/portal-proveedores/login")
  }

  const resolved = await resolvePortalContext(supabase, user.id)
  if (!resolved.ok) {
    redirect("/portal-proveedores/login?error=portal_access")
  }

  const profile = await loadPortalProfile(
    supabase,
    user.id,
    user.email,
    resolved.ctx
  )

  return (
    <PortalProveedoresShell showNav>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Mi perfil</h2>
          <p className="text-muted-foreground">
            Consulte sus datos fiscales y actualice su contacto para el portal.
          </p>
        </div>
        <PortalPerfilForm initialProfile={profile} />
      </div>
    </PortalProveedoresShell>
  )
}
